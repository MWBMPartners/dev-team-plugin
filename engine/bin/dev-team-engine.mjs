#!/usr/bin/env node
// @ts-check
// File:    engine/bin/dev-team-engine.mjs
// Purpose: The engine's entry point. Reads the command, runs it, and prints one JSON answer (or a
//          short text version with --format text). Run it through scripts/engine.sh, not directly.
import { parseArgs, envelope, renderText, ExitCodes } from '../lib/cli.mjs';
import { redact } from '../lib/redact.mjs';
import { runDoctor } from '../lib/doctor.mjs';
import { validate, loadSchema, validateManifest } from '../lib/schema.mjs';
import { pluginRoot, BadInput } from '../lib/paths.mjs';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runScenario } from '../sim/run.mjs';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { loadRouting, saveDeviceOrder } from '../lib/config.mjs';
import { discoverOllama } from '../lib/discover.mjs';
import { discover as discoverAll } from '../lib/discovery.mjs';
import { listAdapters } from '../adapters/index.mjs';
import { dataDir } from '../lib/paths.mjs';
import { homedir } from 'node:os';
import { route, BadRequest } from '../lib/routing.mjs';
import { recordDecision, getDecision, explain, DecisionUnreadable } from '../lib/decisions.mjs';
import { dryRun } from '../lib/dryrun.mjs';
import { checkProjectDocs, checkApiDocs } from '../lib/projectdocs.mjs';
import { canonicalJson, sha256Hex } from '../lib/canonical.mjs';
const execFile = promisify(execFileCb);
const seedPath = () => resolve(pluginRoot(), 'engine', 'data', 'catalogue.seed.json');
const loadSeed = () => JSON.parse(readFileSync(seedPath(), 'utf8')).models;
import { resolve } from 'node:path';

/** @type {Record<string, (a: ReturnType<typeof parseArgs>) => Promise<{code: number, result: unknown, problems?: {code: string, message: string}[]}>>} */
export const commands = {
  async discover(a) {
    // `discover --local` lists models a local Ollama install has. Plain `discover` asks the adapters
    // (Claude Code, Codex and the unverified ones) and keeps a cache per runtime in the data folder.
    if (a.flags.local) {
      const found = await discoverOllama(execFile);
      return { code: ExitCodes.OK, result: { provider: 'ollama', found: found.length, models: found } };
    }
    const r = await discoverAll({ adapters: listAdapters(), dataDir: dataDir(), eventDir: join(dataDir(), 'events'), run: execFile, home: homedir(), refresh: a.flags.refresh === true,
      providers: typeof a.flags.provider === 'string' ? [a.flags.provider] : undefined });
    return { code: ExitCodes.OK, result: r, problems: r.problems };
  },
  async config(a) {
    if (a.sub === 'device-set') {
      const p = saveDeviceOrder(String(a.flags.order ?? ''));
      return { code: ExitCodes.OK, result: { wrote: p } };
    }
    if (a.sub !== 'show') throw new BadInput('usage: config show [--project <dir>] | config device-set --order local-first|cloud-first');
    return { code: ExitCodes.OK, result: loadRouting({ projectDir: typeof a.flags.project === 'string' ? a.flags.project : process.cwd(), sessionOrder: typeof a.flags.order === 'string' ? a.flags.order : undefined }) };
  },
  async route(a) {
    if (typeof a.flags['request-file'] !== 'string') throw new BadInput('usage: route --request-file <json>');
    let req;
    try { req = JSON.parse(readFileSync(resolve(a.flags['request-file']), 'utf8')); } catch { throw new BadInput('the request file is missing or is not valid JSON'); }
    if (!req || typeof req !== 'object' || Array.isArray(req)) throw new BadInput('the request must be a JSON object');
    if (req.projectDir !== undefined && (typeof req.projectDir !== 'string' || req.projectDir.trim() === '')) throw new BadInput('projectDir must be text that is not blank');
    if (req.order !== undefined && req.order !== 'local-first' && req.order !== 'cloud-first') throw new BadInput('order must be local-first or cloud-first');
    const cfg = loadRouting({ projectDir: req.projectDir ?? process.cwd(), sessionOrder: req.order });
    let models = loadSeed();
    if (Array.isArray(req.providers) && req.providers.some((p) => String(p).toLowerCase() === 'ollama')) models = [...models, ...(await discoverOllama(execFile))];
    const out = route(req, models, cfg);
    const stamp = sha256Hex(canonicalJson(models.map((m) => [m.provider, m.id, m.tier, m.costBand, m.priced])));
    const rec = recordDecision(join(dataDir(), 'decisions'), req, cfg, stamp, out);
    return { code: out.ok ? ExitCodes.OK : ExitCodes.NEGATIVE, result: { ...out, warnings: [...(out.warnings ?? []), ...(rec.saved ? [] : ['The decision could not be saved, so `explain` will not find it.'])], decisionId: rec.saved ? rec.id : null, inputsHash: rec.inputsHash }, problems: out.ok ? [] : [{ code: out.code, message: out.reasons[out.reasons.length - 1] }] };
  },
  async explain(a) {
    if (typeof a.flags.decision !== 'string') throw new BadInput('usage: explain --decision <id>');
    let rec;
    try { rec = getDecision(join(dataDir(), 'decisions'), a.flags.decision); } catch (e) { if (e instanceof DecisionUnreadable) return { code: ExitCodes.CONFLICT, result: null, problems: [{ code: 'DECISION_UNREADABLE', message: e.message }] }; throw e; }
    if (!rec) return { code: ExitCodes.CONFLICT, result: null, problems: [{ code: 'NOT_FOUND', message: 'no such decision' }] };
    return { code: ExitCodes.OK, result: { id: rec.id, recordedAt: rec.recordedAt, sentences: explain(rec) } };
  },
  async 'dry-run'(a) {
    if (typeof a.flags['phases-file'] !== 'string') throw new BadInput('usage: dry-run --phases-file <json>');
    let doc;
    try { doc = JSON.parse(readFileSync(resolve(a.flags['phases-file']), 'utf8')); } catch { throw new BadInput('the phases file is missing or is not valid JSON'); }
    const phases = Array.isArray(doc) ? doc : doc?.phases;
    if (!Array.isArray(phases) || phases.some((p) => !p || typeof p !== 'object' || typeof p.name !== 'string' || typeof p.role !== 'string')) throw new BadInput('the phases file must be a list of {name, role, taskTypes?, risk?}');
    const cfg = loadRouting({ projectDir: typeof doc.projectDir === 'string' ? doc.projectDir : process.cwd() });
    const models = loadSeed();
    return { code: ExitCodes.OK, result: dryRun(phases, (r) => route({ providers: doc.providers ?? ['claude'], ...r }, models, cfg)) };
  },
  async sim(a) {
    if (a.sub !== 'run') throw new BadInput('usage: sim run --scenario <name> | --all');
    const dir = resolve(pluginRoot(), 'engine', 'sim', 'scenarios');
    const names = a.flags.all ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [`${String(a.flags.scenario ?? '').replace(/[^A-Za-z0-9._-]/g, '')}.json`];
    if (!a.flags.all && !a.flags.scenario) throw new BadInput('--scenario <name> or --all is needed');
    const results = [];
    for (const n of names) { if (!existsSync(join(dir, n))) throw new BadInput(`no scenario named ${n}`); results.push(await runScenario(join(dir, n))); }
    const failed = results.flatMap((r) => r.assertions.filter((x) => !x.ok).map((x) => ({ code: 'SIM_FAILED', message: `${r.name}: ${x.detail}` })));
    return { code: failed.length ? ExitCodes.NEGATIVE : ExitCodes.OK, result: { scenarios: results.map((r) => ({ name: r.name, assertions: r.assertions.length, failed: r.assertions.filter((x) => !x.ok).length })) }, problems: failed };
  },
  async docs(a) {
    if (a.sub !== 'check') throw new BadInput('usage: docs check [--project <dir>] | docs check --api [--project <dir>]');
    const dir = typeof a.flags.project === 'string' ? resolve(a.flags.project) : process.cwd();
    const r = a.flags.api ? checkApiDocs(dir) : checkProjectDocs(dir);
    return { code: ExitCodes.OK, result: r, problems: r.findings };
  },
  async doctor() { return { code: ExitCodes.OK, result: await runDoctor() }; },
  async schema(a) {
    if (a.sub !== 'validate') throw new BadInput('usage: schema validate [--all | --file <json> --schema <schema>]');
    if (a.flags.all) {
      const problems = validateManifest(pluginRoot()).map((m) => ({ code: 'SCHEMA', message: m }));
      return { code: problems.length ? ExitCodes.BAD_INPUT : ExitCodes.OK, result: { checked: 'manifest' }, problems };
    }
    if (typeof a.flags.file !== 'string' || typeof a.flags.schema !== 'string') throw new BadInput('--file and --schema are both needed');
    const r = validate(loadSchema(resolve(a.flags.schema)), JSON.parse(readFileSync(resolve(a.flags.file), 'utf8')));
    return { code: r.ok ? ExitCodes.OK : ExitCodes.BAD_INPUT, result: { ok: r.ok }, problems: r.errors.map((e) => ({ code: 'SCHEMA', message: `${e.path}: ${e.message}` })) };
  },
};

export async function main(argv) {
  const a = parseArgs(argv);
  let env, code;
  try {
    const fn = commands[a.command];
    if (!fn) throw new BadInput(`unknown command "${a.command}". Known: ${Object.keys(commands).join(', ')}`);
    const out = await fn(a);
    code = out.code; env = envelope(a.command, code === 0, out.result, out.problems ?? []);
  } catch (e) {
    const bad = e instanceof BadInput || e instanceof BadRequest || e instanceof SyntaxError || e instanceof RangeError;
    code = ExitCodes.BAD_INPUT;
    env = envelope(a.command, false, null, [{ code: bad ? 'BAD_INPUT' : 'INTERNAL_ERROR', message: e instanceof Error ? e.message : String(e) }]);
  }
  const text = a.flags.format === 'text' ? renderText(env) : JSON.stringify(env, null, 2);
  process.stdout.write(redact(text) + '\n');
  return code;
}

if (process.argv[1] && resolve(process.argv[1]).endsWith('dev-team-engine.mjs')) process.exitCode = await main(process.argv.slice(2));

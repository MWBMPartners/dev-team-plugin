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
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
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
import { draftPlan, lockPlan, verifyPlan, diffPlans, Conflict, StaleDraft } from '../lib/plan.mjs';
import { classifyDrift } from '../lib/drift.mjs';
import { checkEvidence } from '../lib/evidence.mjs';
import { newTask, recordAttempt, recordEscalation, validateTask } from '../lib/attempts.mjs';
import { writeJsonAtomic } from '../lib/store.mjs';
import { loadPacks, rollbackRequired } from '../lib/packs.mjs';
import { continuityCommands } from '../lib/continuity-commands.mjs';
import { reviewCommands } from '../lib/review-commands.mjs';
import { learningCommands } from '../lib/learning-commands.mjs';
import { policyCommands } from '../lib/policy-commands.mjs';
import { initJob, loadJob, recordPhase, createCheckpoint, verifyCheckpoints, progressRows, JobProblem } from '../lib/job.mjs';
import { canonicalJson, sha256Hex } from '../lib/canonical.mjs';
const execFile = promisify(execFileCb);
/** The project folder from --project (or the current folder); it must exist and be a folder. */
function projectDirOf(a) {
  const dir = typeof a.flags.project === 'string' ? resolve(a.flags.project) : process.cwd();
  let ok = false; try { ok = statSync(dir).isDirectory(); } catch { ok = false; }
  if (!ok) throw new BadInput('--project must be an existing folder');
  return dir;
}
const seedPath = () => resolve(pluginRoot(), 'engine', 'data', 'catalogue.seed.json');
const loadSeed = () => JSON.parse(readFileSync(seedPath(), 'utf8')).models;
import { resolve } from 'node:path';

/** @type {Record<string, (a: ReturnType<typeof parseArgs>) => Promise<{code: number, result: unknown, problems?: {code: string, message: string}[]}>>} */
export const commands = {
  ...continuityCommands,
  ...reviewCommands,
  ...policyCommands,
  ...learningCommands,
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
  async plan(a) {
    const file = typeof a.flags.file === 'string' ? resolve(a.flags.file) : null;
    const read = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { throw new BadInput('the plan file is missing or is not valid JSON'); } };
    if (a.sub === 'verify') {
      if (!file) throw new BadInput('usage: plan verify --file <plan.json>');
      const v = verifyPlan(read(file));
      return { code: v.ok ? ExitCodes.OK : ExitCodes.VERIFY_FAILED, result: v, problems: v.ok ? [] : [{ code: v.status, message: v.reason }] };
    }
    if (a.sub === 'lock') {
      if (!file || typeof a.flags.approver !== 'string') throw new BadInput('usage: plan lock --file <plan.json> --approver <name> [--risk LOW|NORMAL|HIGH|CRITICAL] [--pack id,id]');
      try { const packs = typeof a.flags.pack === 'string' && a.flags.pack !== '' ? loadPacks(a.flags.pack.split(',')) : []; const locked = lockPlan(read(file), { approver: a.flags.approver, risk: typeof a.flags.risk === 'string' ? a.flags.risk : null, rollbackRequired: rollbackRequired(packs) }); writeJsonAtomic(file, locked); return { code: ExitCodes.OK, result: { planId: locked.planId, planVersion: locked.planVersion, planHash: locked.planHash, status: locked.status } }; }
      catch (e) { if (e instanceof Conflict) return { code: ExitCodes.CONFLICT, result: null, problems: [{ code: 'ALREADY_LOCKED', message: e.message }] }; if (e instanceof StaleDraft) return { code: ExitCodes.VERIFY_FAILED, result: null, problems: [{ code: 'STALE_DRAFT', message: e.message }] }; throw e; }
    }
    if (a.sub === 'draft') {
      if (!file || typeof a.flags.id !== 'string' || typeof a.flags.out !== 'string') throw new BadInput('usage: plan draft --file <contract.json> --id <planId> --out <plan.json> [--version N --supersedes M]');
      const num = (v) => (v === undefined ? undefined : /^[0-9]+$/.test(String(v)) ? Number(v) : NaN);
      const doc = draftPlan({ planId: a.flags.id, contract: read(file), ...(a.flags.version !== undefined ? { planVersion: num(a.flags.version) } : {}), ...(a.flags.supersedes !== undefined ? { supersedes: num(a.flags.supersedes) } : {}) });
      writeJsonAtomic(resolve(a.flags.out), doc);
      return { code: ExitCodes.OK, result: { planId: doc.planId, planHash: doc.planHash, status: doc.status } };
    }
    if (a.sub === 'diff') {
      if (typeof a.flags.a !== 'string' || typeof a.flags.b !== 'string') throw new BadInput('usage: plan diff --a <plan.json> --b <plan.json>');
      return { code: ExitCodes.OK, result: diffPlans(read(resolve(a.flags.a)), read(resolve(a.flags.b))) };
    }
    throw new BadInput('usage: plan draft|lock|verify|diff');
  },
  async drift(a) {
    if (typeof a.flags.input !== 'string') throw new BadInput('usage: drift --input <json with taskFiles, changedFiles, ...>');
    let i; try { i = JSON.parse(readFileSync(resolve(a.flags.input), 'utf8')); } catch { throw new BadInput('the input file is missing or is not valid JSON'); }
    const r = classifyDrift(i);
    return { code: r.stop ? ExitCodes.NEGATIVE : ExitCodes.OK, result: r, problems: r.stop ? [{ code: r.level, message: 'STOP: go back to planning before any more work.' }] : [] };
  },
  async evidence(a) {
    if (a.sub !== 'check' || typeof a.flags.input !== 'string') throw new BadInput('usage: evidence check --input <json>');
    let i; try { i = JSON.parse(readFileSync(resolve(a.flags.input), 'utf8')); } catch { throw new BadInput('the input file is missing or is not valid JSON'); }
    const r = checkEvidence(i);
    return { code: r.complete ? ExitCodes.OK : ExitCodes.NEGATIVE, result: r, problems: r.failing.map((f) => ({ code: f.gate, message: f.detail })) };
  },
  async attempt(a) {
    if (a.sub !== 'record' || typeof a.flags['state-file'] !== 'string') throw new BadInput('usage: attempt record --state-file <json> --outcome SUCCESS|FAIL --progress-made true|false | attempt record --state-file <json> --escalated');
    const f = resolve(a.flags['state-file']);
    let task; try { task = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : newTask(); } catch { throw new BadInput('the state file is not valid JSON'); }
    try { validateTask(task); } catch (e) { throw new BadInput(e instanceof Error ? e.message : 'the state file is not a valid attempt record'); }
    if (a.flags.escalated) {
      try { task = recordEscalation(task); } catch (e) { return { code: ExitCodes.CONFLICT, result: null, problems: [{ code: 'ESCALATION_NOT_ALLOWED', message: e instanceof Error ? e.message : 'not allowed' }] }; }
      writeJsonAtomic(f, task); return { code: ExitCodes.OK, result: { escalations: task.escalations } };
    }
    if (typeof a.flags.outcome !== 'string' || (a.flags['progress-made'] !== 'true' && a.flags['progress-made'] !== 'false')) throw new BadInput('--outcome and --progress-made true|false are needed');
    try { const r = recordAttempt(task, { outcome: a.flags.outcome, progressMade: a.flags['progress-made'] === 'true' }); writeJsonAtomic(f, r.task);
      return { code: r.capReached ? ExitCodes.NEGATIVE : ExitCodes.OK, result: { attempts: r.task.attempts.length, closed: r.task.closed, capReached: r.capReached }, problems: r.capReached ? [{ code: 'ATTEMPT_CAP_REACHED', message: r.reason }] : [] };
    } catch (e) { if (e instanceof RangeError) throw e; return { code: ExitCodes.NEGATIVE, result: null, problems: [{ code: 'ATTEMPT_CAP_REACHED', message: e instanceof Error ? e.message : 'no more attempts' }] }; }
  },
  async job(a) {
    const dir = projectDirOf(a);
    const problem = (e) => ({ code: ExitCodes.CONFLICT, result: null, problems: [{ code: 'JOB_PROBLEM', message: e.message }] });
    try {
      if (a.sub === 'init') {
        const issue = a.flags.issue === undefined ? null : /^[0-9]+$/.test(String(a.flags.issue)) ? Number(a.flags.issue) : NaN;
        const j = initJob(dir, { template: String(a.flags.template ?? ''), request: String(a.flags.request ?? ''), issue });
        return { code: ExitCodes.OK, result: { jobId: j.jobId, phases: j.phases.map((p) => p.id) } };
      }
      if (a.sub === 'status') return { code: ExitCodes.OK, result: loadJob(dir, String(a.flags.job ?? '')) };
      if (a.sub === 'record') { const j = recordPhase(dir, String(a.flags.job ?? ''), String(a.flags.phase ?? ''), String(a.flags.status ?? ''), typeof a.flags.note === 'string' ? a.flags.note : ''); return { code: ExitCodes.OK, result: { jobId: j.jobId, phases: progressRows(j) } }; }
    } catch (e) { if (e instanceof JobProblem) return problem(e); throw e; }
    throw new BadInput('usage: job init --template T --request TEXT [--issue N] | job status --job ID | job record --job ID --phase P --status S [--note TEXT]');
  },
  async checkpoint(a) {
    const dir = projectDirOf(a);
    try {
      if (a.sub === 'create') return { code: ExitCodes.OK, result: createCheckpoint(dir, String(a.flags.job ?? ''), String(a.flags.phase ?? ''), String(a.flags.kind ?? '')) };
      if (a.sub === 'verify') { const v = verifyCheckpoints(dir, String(a.flags.job ?? '')); return { code: v.ok ? ExitCodes.OK : ExitCodes.VERIFY_FAILED, result: v, problems: v.ok ? [] : v.results.filter((r) => !r.ok).map((r) => ({ code: 'CHECKPOINT_MISSING', message: `checkpoint ${r.id} points at a commit that no longer exists` })) }; }
    } catch (e) { if (e instanceof JobProblem) return { code: ExitCodes.CONFLICT, result: null, problems: [{ code: 'JOB_PROBLEM', message: e.message }] }; throw e; }
    throw new BadInput('usage: checkpoint create --job ID --phase P --kind planning|build|verify|handover | checkpoint verify --job ID');
  },
  async report(a) {
    if (!a.flags.progress || typeof a.flags.job !== 'string') throw new BadInput('usage: report --job ID --progress [--project DIR]');
    const dir = projectDirOf(a);
    try { return { code: ExitCodes.OK, result: { jobId: a.flags.job, rows: progressRows(loadJob(dir, a.flags.job)) } }; }
    catch (e) { if (e instanceof JobProblem) return { code: ExitCodes.CONFLICT, result: null, problems: [{ code: 'JOB_PROBLEM', message: e.message }] }; throw e; }
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

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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** @type {Record<string, (a: ReturnType<typeof parseArgs>) => Promise<{code: number, result: unknown, problems?: {code: string, message: string}[]}>>} */
export const commands = {
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
    code = e instanceof BadInput ? ExitCodes.BAD_INPUT : ExitCodes.BAD_INPUT;
    env = envelope(a.command, false, null, [{ code: 'BAD_INPUT', message: e instanceof Error ? e.message : String(e) }]);
  }
  const text = a.flags.format === 'text' ? renderText(env) : JSON.stringify(env, null, 2);
  process.stdout.write(redact(text) + '\n');
  return code;
}

if (process.argv[1] && resolve(process.argv[1]).endsWith('dev-team-engine.mjs')) process.exitCode = await main(process.argv.slice(2));

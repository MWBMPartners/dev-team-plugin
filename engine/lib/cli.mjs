// @ts-check
// File:    engine/lib/cli.mjs
// Purpose: The command-line layer of the engine: reading the words a person typed, the fixed exit
//          codes, and the one shape every answer is printed in (so other programs can read it).

/** The engine's exit codes. They are part of its promise to callers, so they never change. */
export const ExitCodes = Object.freeze({
  OK: 0, // done; the result is the answer
  NEGATIVE: 1, // a "no" that is itself the answer (nothing suitable, a gate said stop)
  BAD_INPUT: 2, // unknown command, bad flags, a file that fails its schema
  UNAVAILABLE: 3, // the engine cannot run here (set by the launcher script, not by this file)
  CONFLICT: 4, // the state does not allow it (something is already held, not found)
  VERIFY_FAILED: 5, // a check of a signature, hash or snapshot failed
});

/**
 * Turn argv into {command, sub, flags, positional}. Accepts `--name value`, `--name=value` and bare
 * `--name` (true). The first two words that are not flags are the command and its sub-command.
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const flags = {};
  /** @type {string[]} */
  const words = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) { flags[a.slice(2)] = next; i++; } else flags[a.slice(2)] = true;
      }
    } else words.push(a);
  }
  return { command: words[0] ?? '', sub: words[1] ?? '', positional: words.slice(2), flags };
}

/**
 * The one answer shape. `ok` is false for any non-zero outcome; `problems` explains why.
 * @param {string} command
 * @param {boolean} ok
 * @param {unknown} result
 * @param {{code: string, message: string}[]} [problems]
 */
export function envelope(command, ok, result, problems = []) {
  return { engine: { version: '2.0.0-dev', command }, ok, result, problems };
}

/** A short human reading of an envelope, for `--format text`. */
export function renderText(env) {
  const lines = [`${env.engine.command}: ${env.ok ? 'OK' : 'NOT OK'}`];
  const r = env.result;
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    for (const [k, v] of Object.entries(r)) lines.push(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  } else if (r !== undefined && r !== null) lines.push(`  ${JSON.stringify(r)}`);
  for (const p of env.problems) lines.push(`  problem ${p.code}: ${p.message}`);
  return lines.join('\n');
}

// @ts-check
// File:    engine/lib/learning-commands.mjs
// Purpose: Command-line side of learning records, competency, canary stages and health.
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ExitCodes } from './cli.mjs';
import { BadInput, dataDir } from './paths.mjs';
import { record, readAll, purge, competency, learningEnabled } from './learning.mjs';
import { nextStage, SAMPLE_SHARE } from './canary.mjs';
import { healthState } from './health.mjs';

const dir = () => join(dataDir(), 'learning');
const readJson = (f, what) => { try { return JSON.parse(readFileSync(resolve(String(f)), 'utf8')); } catch { throw new BadInput(`${what} is missing or is not valid JSON`); } };

export const learningCommands = {
  async learn(a) {
    if (a.sub === 'record') { if (typeof a.flags.input !== 'string') throw new BadInput('usage: learn record --input <json>'); return { code: ExitCodes.OK, result: record(dir(), readJson(a.flags.input, 'the record file')) }; }
    if (a.sub === 'query') {
      for (const k of ['provider', 'model', 'task-type']) if (typeof a.flags[k] !== 'string') throw new BadInput('usage: learn query --provider P --model M --task-type T [--project KEY]');
      return { code: ExitCodes.OK, result: { enabled: learningEnabled(), ...competency(readAll(dir()), { provider: a.flags.provider, model: a.flags.model, taskType: a.flags['task-type'], project: typeof a.flags.project === 'string' ? a.flags.project : undefined }) } };
    }
    if (a.sub === 'purge') return { code: ExitCodes.OK, result: purge(dir()) };
    throw new BadInput('usage: learn record|query|purge');
  },
  async canary(a) {
    if (a.sub !== 'evaluate' || typeof a.flags.input !== 'string') throw new BadInput('usage: canary evaluate --input <json with current and results>');
    const r = nextStage(readJson(a.flags.input, 'the input file')); return { code: ExitCodes.OK, result: { ...r, sampleShare: SAMPLE_SHARE[r.stage] } };
  },
  async health(a) {
    if (a.sub !== 'status' || typeof a.flags.input !== 'string') throw new BadInput('usage: health status --input <json with signals>');
    const i = readJson(a.flags.input, 'the input file'); return { code: ExitCodes.OK, result: healthState(i.signals, { baselineLatencyMs: i.baselineLatencyMs }) };
  },
};

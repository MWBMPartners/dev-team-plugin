// @ts-check
// File:    engine/lib/review-commands.mjs
// Purpose: Command-line side of review planning and the finding lifecycle.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ExitCodes } from './cli.mjs';
import { BadInput, pluginRoot } from './paths.mjs';
import { planReview } from './review.mjs';
import { addFinding, updateFinding, precision, STATUSES, SEVERITIES } from './findings.mjs';
import { writeJsonAtomic } from './store.mjs';
import { loadRouting } from './config.mjs';

const readJson = (f, what) => { try { return JSON.parse(readFileSync(resolve(String(f)), 'utf8')); } catch { throw new BadInput(`${what} is missing or is not valid JSON`); } };

/** The seed catalogue as review candidates. Verified Claude is trusted; verified Codex is validated; the rest are provisional. `stages` overrides by provider. */
function seedReviewModels(stages = {}) {
  const seed = JSON.parse(readFileSync(join(pluginRoot(), 'engine', 'data', 'catalogue.seed.json'), 'utf8')).models;
  return seed.filter((m) => !m.local).map((m) => ({ provider: m.provider, id: m.id, alias: m.alias, classes: m.classes, priced: m.priced, tier: m.tier, costBand: m.costBand, availability: 'UNKNOWN', lifecycleStatus: 'ACTIVE', canaryStage: stages[m.provider] ?? (m.provider === 'claude' && m.verified ? 'TRUSTED' : m.verified ? 'VALIDATED' : 'PROVISIONAL') }));
}

function loadFindings(f) {
  if (!existsSync(f)) return [];
  const j = readJson(f, 'the findings file');
  if (!j || !Array.isArray(j.findings) || j.findings.some((x) => !x || typeof x.id !== 'string' || !STATUSES.includes(x.status) || !SEVERITIES.includes(x.severity) || typeof x.reviewer !== 'string' || !Array.isArray(x.history))) throw new BadInput('the findings file is not a valid findings list');
  return j.findings;
}

export const reviewCommands = {
  async review(a) {
    if (a.sub !== 'plan' || typeof a.flags.input !== 'string') throw new BadInput('usage: review plan --input <json>');
    const i = readJson(a.flags.input, 'the input file');
    const stages = i.stageOverrides && typeof i.stageOverrides === 'object' && !Array.isArray(i.stageOverrides) ? i.stageOverrides : {};
    const cfg = loadRouting({ projectDir: typeof i.projectDir === 'string' ? i.projectDir : process.cwd() });
    if ((cfg.badSettings ?? []).length) return { code: ExitCodes.NEGATIVE, result: null, problems: [{ code: 'SETTINGS_INVALID', message: `a routing setting is ambiguous (${cfg.badSettings.join('; ')}); not guessing` }] };
    const r = planReview({ ...i, askFirst: cfg.askFirst, models: Array.isArray(i.models) ? i.models : seedReviewModels(stages) });
    return { code: r.reviewer.chosen ? ExitCodes.OK : ExitCodes.NEGATIVE, result: r, problems: r.reviewer.chosen ? [] : [{ code: 'NO_REVIEWER_AVAILABLE', message: 'no model can review this work at this risk' }] };
  },
  async findings(a) {
    if (typeof a.flags['state-file'] !== 'string') throw new BadInput('usage: findings add|update|precision --state-file <json> ...');
    const f = resolve(a.flags['state-file']); const list = loadFindings(f);
    try {
      if (a.sub === 'add') {
        const r = addFinding(list, { file: String(a.flags.file ?? ''), rule: typeof a.flags.rule === 'string' ? a.flags.rule : '', summary: String(a.flags.summary ?? ''), severity: String(a.flags.severity ?? ''), reviewer: String(a.flags.reviewer ?? '') });
        writeJsonAtomic(f, { findings: r.list }); return { code: ExitCodes.OK, result: { id: r.id, added: r.added } };
      }
      if (a.sub === 'update') {
        const next = updateFinding(list, String(a.flags.id ?? ''), { status: String(a.flags.status ?? ''), by: typeof a.flags.by === 'string' ? a.flags.by : undefined, evidence: typeof a.flags.evidence === 'string' ? a.flags.evidence : '' });
        writeJsonAtomic(f, { findings: next }); return { code: ExitCodes.OK, result: { id: a.flags.id, status: a.flags.status } };
      }
      if (a.sub === 'precision') return { code: ExitCodes.OK, result: precision(list) };
    } catch (e) { if (e instanceof RangeError) throw e; throw e; }
    throw new BadInput('usage: findings add|update|precision --state-file <json>');
  },
};

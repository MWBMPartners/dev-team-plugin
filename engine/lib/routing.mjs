// @ts-check
// File:    engine/lib/routing.mjs
// Purpose: Chooses a model for one job, the same way every time, and writes down why. It never starts
//          a worker; it returns an instruction the lead carries out.
import { floorFor } from './tiers.mjs';
import { wantedEffort, applyEffort, claudeAgentFile } from './effort.mjs';
import { reserveCheck } from './budget.mjs';

// Rules it follows (from the locked plan):
//   - Strength is judged by tier, never by a model's name (tier 1 utility .. tier 4 principal).
//   - Checking work never uses a model below tier 3 (verification floor, invariant I1).
//   - Tier 4 is never the default; among models that qualify, the cheapest wins (I8).
//   - A model on the ask-first list is never used without an explicit yes for this task. Local models
//     are free and are never held back.
//   - A pinned version is honoured exactly or the job stops and asks; it is never swapped quietly.
//   - Where work starts (local or cloud) only changes the order models are tried in. It never lowers
//     the strength a job needs.

const ROLE_FLOOR = { mechanical: 1, scout: 1, documentarian: 2, builder: 2, architect: 3, reviewer: 3 };
const RISKS = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

/** A request the engine cannot make sense of. The command layer reports it as bad input (exit 2). */
export class BadRequest extends Error {}

const lc = (s) => String(s).toLowerCase();
function strList(v, name) {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new BadRequest(`"${name}" must be a list of text values`);
  return v.map(lc);
}

/** The lowest tier the job needs. Higher risk or a complex change raises a builder's floor by one. */
export function requiredTier(role, risk = 'NORMAL', complex = false) {
  if (typeof role !== 'string' || !Object.hasOwn(ROLE_FLOOR, role)) throw new BadRequest(`unknown role "${String(role).slice(0, 30)}"`);
  if (complex !== undefined && typeof complex !== 'boolean') throw new BadRequest('complex must be true or false');
  const rk = String(risk).toUpperCase();
  if (!RISKS.includes(rk)) throw new BadRequest(`risk must be one of ${RISKS.join(', ')}`);
  let t = ROLE_FLOOR[role];
  if (role === 'builder' && (rk === 'HIGH' || rk === 'CRITICAL' || complex)) t = 3;
  return t;
}

export const isAskFirst = (m, list) => (m.pinnedId && list.includes(lc(m.pinnedId))) || list.includes(lc(m.alias)) || list.includes(lc(m.id)) || m.classes.some((c) => list.includes(lc(c))) || (!m.priced && list.includes('unpriced'));

/**
 * @param {{role: string, risk?: string, complex?: boolean, approved?: string[], exhausted?: string[], providers?: string[], builtBy?: string}} req
 * @param {any[]} models   the catalogue (seed plus anything discovered)
 * @param {{order: string, orderDecidedBy: string, askedBefore: boolean, askFirst: string[], pin: Record<string,string>}} cfg
 */
export function route(req, models, cfg) {
  let need = requiredTier(req.role, req.risk, req.complex);
  // With task types, the floors table decides how strong a model is needed and which tier is preferred; the
  // role then only decides which models may do the job. Checking work is still never below tier 3 at NORMAL
  // risk or above (invariant I1), whatever the table says.
  let preferred = need;
  let floorReasons = [];
  let scriptJob = false;
  if (req.taskTypes !== undefined) {
    if (!Array.isArray(req.taskTypes) || req.taskTypes.some((x) => typeof x !== 'string')) throw new BadRequest('taskTypes must be a list of text values');
    let f;
    try { f = floorFor(req.taskTypes, String(req.risk ?? 'NORMAL').toUpperCase()); } catch (e) { throw new BadRequest(e instanceof Error ? e.message : 'bad taskTypes'); }
    // The task table can only RAISE what the role already needs, never lower it.
    need = Math.max(need, f.minimumTier, 1); preferred = Math.max(preferred, f.preferredTier, need); floorReasons = f.reasons;
    const zero = f.preferredTier === 0;
    // (A reviewer's own role floor is already tier 3 at every risk, and the table can only raise it.)
    preferred = Math.max(preferred, need);
    // Tier 0 ('a tool does it') is only for work a script really can do. Anything else at tier 0 still needs the weakest model.
    const scriptOnly = req.taskTypes.every((x) => x === 'TEST_EXECUTION' || x === 'STATIC_ANALYSIS' || x === 'BUILD_VALIDATION');
    // A script job needs no model, but never when the job is a check by a reviewer, or when a stronger model was asked for.
    scriptJob = zero && scriptOnly && req.role !== 'reviewer' && req.minTier === undefined;
  }
  // minTier lets the lead ask for a stronger model than the role's floor (for example, to escalate to
  // tier 4 after the user approved it). It can only raise the need, never lower it.
  if (req.minTier !== undefined) {
    if (!Number.isInteger(req.minTier) || req.minTier < 1 || req.minTier > 4) throw new BadRequest('minTier must be a whole number from 1 to 4');
    need = Math.max(need, req.minTier); preferred = Math.max(preferred, need);
  }
  if (cfg.badSettings && cfg.badSettings.length) return negative('SETTINGS_INVALID', `A routing setting in .dev-team/config.yml is ambiguous (${cfg.badSettings.join('; ')}). I will not guess which one you meant; please correct it.`, [`The ${req.role} job needs tier ${need} or stronger.`], [], []);
  if (cfg.badPins && cfg.badPins.length) return negative('PIN_INVALID', `A pin in .dev-team/config.yml is not usable (${cfg.badPins.join(', ')}). I will not guess which version you meant; please correct it.`, [`The ${req.role} job needs tier ${need} or stronger.`], [], []);
  if (req.builtBy !== undefined && typeof req.builtBy !== 'string') throw new BadRequest('builtBy must be text');
  if (req.quotaRemaining !== undefined && (!req.quotaRemaining || typeof req.quotaRemaining !== 'object' || Array.isArray(req.quotaRemaining) || Object.values(req.quotaRemaining).some((v) => v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100)))) throw new BadRequest('quotaRemaining must map a provider to a percentage from 0 to 100, or null when not known');
  if (req.quotaRemaining && new Set(Object.keys(req.quotaRemaining).map(lc)).size !== Object.keys(req.quotaRemaining).length) throw new BadRequest('quotaRemaining names the same provider twice (differing only in capitals)');
  if (req.reserves !== undefined && (!req.reserves || typeof req.reserves !== 'object' || Array.isArray(req.reserves))) throw new BadRequest('reserves must be an object');
  const approved = strList(req.approved, 'approved'), exhausted = strList(req.exhausted, 'exhausted');
  const providers = strList(req.providers ?? ['claude'], 'providers');
  if (req.escalateEffort !== undefined && typeof req.escalateEffort !== 'boolean') throw new BadRequest('escalateEffort must be true or false');
  if (scriptJob) {
    return { ok: true, code: 'OK', decision: { deterministic: true, provider: null, model: null, exactId: null, tier: 0, local: true, costBand: 0, independence: null, spawn: null, effort: null }, reasons: [...floorReasons, 'No AI model is needed for this: a script or tool does it.'], dropped: [], heldBack: [], alternatives: [], warnings: [], questions: [] };
  }
  const askFirst = cfg.askFirst.map(lc);
  const reasons = [...floorReasons, `The ${req.role} job needs tier ${need} or stronger${req.role === 'reviewer' ? ' (checking work never goes below tier 3 at normal risk or above)' : ''}.`];
  const questions = [];
  if (!cfg.askedBefore) questions.push({ id: 'route-order', ask: 'Should work start on free local models and move to paid cloud models for harder work, or start on cloud models and fall back to local ones? This is asked once per project and remembered in .dev-team/config.yml as routing.order.', suggested: 'local-first' });

  /** @type {{model: any, why: string}[]} */
  const heldBack = [];
  const dropped = [];
  let pool = models.filter((m) => m.roles.includes(req.role) && m.tier >= need);
  const available = (m) => providers.includes(lc(m.provider));
  pool = pool.filter((m) => { if (!available(m)) { dropped.push(`${m.id}: provider ${m.provider} is not available`); return false; } if (exhausted.includes(lc(m.provider))) { dropped.push(`${m.id}: ${m.provider}'s allowance is used up`); return false; } return true; });

  // Reserves: when a provider's remaining allowance is known and low, its strongest models are kept for planning,
  // security, hard debugging and final review. An unknown allowance applies no reserve and no number is guessed.
  if (req.quotaRemaining) {
    const qr = Object.fromEntries(Object.entries(req.quotaRemaining).map(([k, v]) => [lc(k), v]));
    pool = pool.filter((m) => {
      if (m.local || !Object.hasOwn(qr, lc(m.provider))) return true;
      let r; try { r = reserveCheck({ remainingPercent: qr[lc(m.provider)], tier: m.tier, taskTypes: Array.isArray(req.taskTypes) ? req.taskTypes : [], reserves: req.reserves }); } catch (e) { throw new BadRequest(e instanceof Error ? e.message : 'bad reserves'); }
      if (!r.allowed) dropped.push(`${m.id}: ${r.reason}`);
      return r.allowed;
    });
  }

  // A pin names an exact version for one cloud model (a local model that happens to share the name
  // never takes a pin). If a pinned model fits this job but cannot be used right now, stop and ask:
  // never carry on with another version or another model as if nothing had been pinned.
  const pins = Object.entries(cfg.pin);
  for (const [alias, exact] of pins) {
    // 1. Attach the pin to EVERY matching model still in the pool, so a pinned model can never be chosen
    //    without its exact version, whichever way it came to be chosen.
    pool = pool.map((m) => (!m.local && lc(m.alias) === lc(alias) ? { ...m, pinnedId: String(exact) } : m));
    // 2. Stop and ask only when a pinned model this job could really use is unusable right now: one whose
    //    provider is offered in this request, and (for tier 4) only when the job needs tier 4.
    const fits = models.filter((m) => !m.local && lc(m.alias) === lc(alias) && m.roles.includes(req.role) && m.tier >= need && providers.includes(lc(m.provider)) && (m.tier < 4 || need >= 4));
    if (fits.length && !pool.some((m) => !m.local && lc(m.alias) === lc(alias))) {
      return negative('PIN_UNAVAILABLE', `You pinned ${alias} to ${exact}, but it cannot be used for this job right now. I will not swap in another version or model without asking.`, reasons, dropped, questions);
    }
  }

  // Ask-first: hold back anything that needs a yes this task has not been given.
  const usable = [];
  for (const m of pool) {
    if (!m.local && isAskFirst(m, askFirst) && !approved.includes(lc(m.alias)) && !approved.includes(lc(m.id)) && !(m.pinnedId && approved.includes(lc(m.pinnedId)))) heldBack.push({ model: m, why: !m.priced && !m.classes.length ? 'its price is not known' : 'it is on your ask-first list' });
    else usable.push(m);
  }

  // Order: local or cloud first, then cheapest, then the weakest that qualifies. For a check, prefer a different provider from the builder's.
  const group = (m) => (cfg.order === 'local-first' ? (m.local ? 0 : 1) : (m.local ? 1 : 0));
  const other = (m) => (req.role === 'reviewer' && req.builtBy && lc(m.provider) === lc(req.builtBy) ? 1 : 0);
  // Tier 4 is never the default: any usable model below it wins first. Only then the provider preference, the order, and cost.
  const top = (m) => (m.tier >= 4 && preferred < 4 ? 1 : 0);
  const closeness = (m) => Math.abs(m.tier - preferred);
  usable.sort((a, b) => top(a) - top(b) || other(a) - other(b) || group(a) - group(b) || closeness(a) - closeness(b) || a.costBand - b.costBand || a.tier - b.tier || a.id.localeCompare(b.id));

  if (!usable.length) {
    if (heldBack.length) {
      const h = heldBack[0];
      const q = { id: 'approve-model', ask: `${h.model.alias} (${h.model.provider}) would suit this ${req.role} job, but ${h.why}. May I use it for this task only?`, suggested: 'no — wait for your answer' };
      return { ok: false, code: 'NEEDS_APPROVAL', decision: null, reasons: [...reasons, `Every model that qualifies needs your approval first (${heldBack.map((x) => x.model.alias).join(', ')}).`], dropped, heldBack: heldBack.map(brief), questions: [...questions, q] };
    }
    return negative('NO_SUITABLE_AGENT_AVAILABLE', `No available model reaches tier ${need} for a ${req.role} job.`, reasons, dropped, questions);
  }

  const pick = usable[0];
  const localMiss = cfg.order === 'local-first' && !pick.local && models.some((m) => m.local && m.roles.includes(req.role));
  if (cfg.order === 'local-first') reasons.push(pick.local ? 'Work starts on local models, and one of them is strong enough.' : (localMiss ? `Work starts on local models, but none is strong enough for tier ${need}, so a cloud model is used.` : 'No local model is available, so a cloud model is used.'));
  else reasons.push(pick.local ? 'The cloud models are not usable now, so a local one is used.' : 'Work starts on cloud models.');
  reasons.push(`Order was decided by ${cfg.orderDecidedBy}.`);
  reasons.push(`${pick.alias} was chosen as the cheapest qualifying model${other(pick) === 0 && req.role === 'reviewer' && req.builtBy ? ', from a different provider than the builder' : ''}.`);
  if (heldBack.length) reasons.push(`Held back until you approve: ${heldBack.map((x) => `${x.model.alias} (${x.why})`).join('; ')}.`);
  const independence = req.role !== 'reviewer' ? null : !req.builtBy ? 'UNKNOWN' : lc(pick.provider) !== lc(req.builtBy) ? 'CROSS_PROVIDER' : 'SAME_PROVIDER_FRESH_AGENT';
  const warnings = [];
  if (pick.pinnedId) warnings.push('A pinned version is set. Some tools accept only a model alias when starting a worker; if this one does, say so and stop rather than use another version.');
  if (!pick.verified) warnings.push(`${pick.provider} has not been tried against a real account (unverified).`);
  return {
    ok: true, code: 'OK',
    decision: { effort: effortFor(req, pick), provider: pick.provider, model: pick.alias, exactId: pick.pinnedId ?? null, tier: pick.tier, local: pick.local, costBand: pick.costBand, independence, spawn: { provider: pick.provider, model: pick.alias, exactId: pick.pinnedId ?? null, ...agentFor(req, pick) } },
    reasons, dropped, heldBack: heldBack.map(brief), alternatives: usable.slice(1, 4).map((m) => ({ model: m.alias, provider: m.provider, exactId: m.pinnedId ?? null })), warnings, questions,
  };
}
const brief = (h) => ({ model: h.model.alias, provider: h.model.provider, why: h.why });
function negative(code, message, reasons, dropped, questions) { return { ok: false, code, decision: null, reasons: [...reasons, message], dropped, heldBack: [], questions }; }

/** The effort wanted for this job and the nearest level the chosen model accepts. Null when no task types were given. */
function effortFor(req, pick) {
  if (!Array.isArray(req.taskTypes)) return null;
  const risk = String(req.risk ?? 'NORMAL').toUpperCase();
  const wanted = wantedEffort(req.taskTypes, risk, { escalate: req.escalateEffort === true });
  return { wanted, ...applyEffort(wanted, pick.effortLevels ?? 'UNKNOWN') };
}

/** For Claude Code workers: the agent file to start (it carries the effort). Other providers have none. */
function agentFor(req, pick) {
  if (pick.provider !== 'claude' || !Array.isArray(req.taskTypes)) return {};
  const wanted = wantedEffort(req.taskTypes, String(req.risk ?? 'NORMAL').toUpperCase(), { escalate: req.escalateEffort === true });
  try { const a = claudeAgentFile(req.role, wanted, pick.tier); return { agentFile: a.file, agentNote: a.note }; } catch { return {}; }
}

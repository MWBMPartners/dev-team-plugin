// @ts-check
// File:    engine/lib/routing.mjs
// Purpose: Chooses a model for one job, the same way every time, and writes down why. It never starts
//          a worker; it returns an instruction the lead carries out.
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

/** The lowest tier the job needs. Higher risk or a complex change raises a builder's floor by one. */
export function requiredTier(role, risk = 'NORMAL', complex = false) {
  let t = ROLE_FLOOR[role];
  if (t === undefined) throw new Error(`unknown role "${role}"`);
  if (role === 'builder' && (risk === 'HIGH' || complex)) t = 3;
  return t;
}

const isAskFirst = (m, list) => list.includes(m.alias) || list.includes(m.id) || m.classes.some((c) => list.includes(c)) || (!m.priced && list.includes('unpriced'));

/**
 * @param {{role: string, risk?: string, complex?: boolean, approved?: string[], exhausted?: string[], providers?: string[], builtBy?: string}} req
 * @param {any[]} models   the catalogue (seed plus anything discovered)
 * @param {{order: string, orderDecidedBy: string, askedBefore: boolean, askFirst: string[], pin: Record<string,string>}} cfg
 */
export function route(req, models, cfg) {
  const need = requiredTier(req.role, req.risk, req.complex);
  const approved = req.approved ?? [], exhausted = req.exhausted ?? [];
  const providers = req.providers ?? ['claude'];
  const reasons = [`The ${req.role} job needs tier ${need} or stronger${req.role === 'reviewer' ? ' (checking work never goes below tier 3)' : ''}.`];
  const questions = [];
  if (!cfg.askedBefore) questions.push({ id: 'route-order', ask: 'Should work start on free local models and move to paid cloud models for harder work, or start on cloud models and fall back to local ones? This is asked once per project and remembered in .dev-team/config.yml as routing.order.', suggested: 'local-first' });

  /** @type {{model: any, why: string}[]} */
  const heldBack = [];
  const dropped = [];
  let pool = models.filter((m) => m.roles.includes(req.role) && m.tier >= need);
  const available = (m) => m.local ? providers.includes('ollama') || m.provider === 'ollama' : providers.includes(m.provider);
  pool = pool.filter((m) => { if (!available(m)) { dropped.push(`${m.id}: provider ${m.provider} is not available`); return false; } if (exhausted.includes(m.provider)) { dropped.push(`${m.id}: ${m.provider}'s allowance is used up`); return false; } return true; });

  // A pin names an exact version for one model. If its model cannot be used, stop and ask.
  const pins = Object.entries(cfg.pin);
  for (const [alias, exact] of pins) {
    const want = models.find((m) => m.alias === alias);
    if (!want) continue;
    const inPool = pool.some((m) => m.alias === alias);
    if (inPool) pool = pool.map((m) => (m.alias === alias ? { ...m, pinnedId: String(exact) } : m));
  }
  const pinMiss = pins.filter(([alias]) => models.some((m) => m.alias === alias) && !pool.some((m) => m.alias === alias) && models.find((m) => m.alias === alias).roles.includes(req.role));
  if (pinMiss.length && pool.length === 0) {
    return negative('PIN_UNAVAILABLE', `You pinned ${pinMiss[0][0]} to ${pinMiss[0][1]}, but it cannot be used for this job right now. I will not swap in another version without asking.`, reasons, dropped, questions);
  }

  // Ask-first: hold back anything that needs a yes this task has not been given.
  const usable = [];
  for (const m of pool) {
    if (!m.local && isAskFirst(m, cfg.askFirst) && !approved.includes(m.alias) && !approved.includes(m.id)) heldBack.push({ model: m, why: !m.priced && !m.classes.length ? 'its price is not known' : 'it is on your ask-first list' });
    else usable.push(m);
  }

  // Order: local or cloud first, then cheapest, then the weakest that qualifies. For a check, prefer a different provider from the builder's.
  const group = (m) => (cfg.order === 'local-first' ? (m.local ? 0 : 1) : (m.local ? 1 : 0));
  const other = (m) => (req.role === 'reviewer' && req.builtBy && m.provider === req.builtBy ? 1 : 0);
  usable.sort((a, b) => other(a) - other(b) || group(a) - group(b) || a.costBand - b.costBand || a.tier - b.tier || a.id.localeCompare(b.id));

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
  const independence = req.role !== 'reviewer' ? null : !req.builtBy ? 'UNKNOWN' : pick.provider !== req.builtBy ? 'CROSS_PROVIDER' : 'SAME_PROVIDER_FRESH_AGENT';
  const warnings = [];
  if (pick.pinnedId) warnings.push('A pinned version is set. Some tools accept only a model alias when starting a worker; if this one does, say so and stop rather than use another version.');
  if (!pick.verified) warnings.push(`${pick.provider} has not been tried against a real account (unverified).`);
  return {
    ok: true, code: 'OK',
    decision: { provider: pick.provider, model: pick.alias, exactId: pick.pinnedId ?? null, tier: pick.tier, local: pick.local, costBand: pick.costBand, independence, spawn: { provider: pick.provider, model: pick.alias, exactId: pick.pinnedId ?? null } },
    reasons, dropped, heldBack: heldBack.map(brief), alternatives: usable.slice(1, 4).map((m) => m.alias), warnings, questions,
  };
}
const brief = (h) => ({ model: h.model.alias, provider: h.model.provider, why: h.why });
function negative(code, message, reasons, dropped, questions) { return { ok: false, code, decision: null, reasons: [...reasons, message], dropped, heldBack: [], questions }; }

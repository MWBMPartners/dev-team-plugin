// @ts-check
// File:    engine/lib/dryrun.mjs
// Purpose: Shows what the engine WOULD do for a list of planned phases, without doing anything: which
//          model, what effort, what is held back for approval, and the questions the owner should answer
//          first, each with the reason it is asked. Cost and quota columns arrive in a later increment.

/**
 * @param {{name: string, role: string, taskTypes?: string[], risk?: string, uncertain?: {input: string, why: string}[]}[]} phases
 * @param {(req: any) => any} routeFn  the routing function, already bound to settings and catalogue
 */
export function dryRun(phases, routeFn) {
  const rows = [], questions = [], seen = new Set();
  for (const ph of phases) {
    // Pass only the keys this phase really sets, so file-wide settings are never overwritten by undefined.
    const req = { role: ph.role };
    for (const k of ['taskTypes', 'risk', 'providers', 'approved', 'exhausted', 'builtBy', 'minTier', 'complex', 'escalateEffort']) if (ph[k] !== undefined) req[k] = ph[k];
    const r = routeFn(req);
    const d = r.decision;
    rows.push({ phase: ph.name, role: ph.role, tier: d ? d.tier : null, model: d ? d.model : null, provider: d ? d.provider : null, effort: d?.effort?.level ?? null, code: r.code, heldBack: r.heldBack.map((h) => h.model), cost: 'available after increment 7', quota: 'available after increment 7' });
    for (const q of r.questions) { const key = q.id + (q.ask ?? ''); if (!seen.has(key)) { seen.add(key); questions.push({ ...q, why: q.id === 'route-order' ? 'It decides whether free local models or paid cloud models are tried first.' : 'The best-suited model costs more, so it needs your yes.' }); } }
    if (ph.uncertain !== undefined && (!Array.isArray(ph.uncertain) || ph.uncertain.some((u) => !u || typeof u.input !== 'string' || typeof u.why !== 'string'))) throw new RangeError('uncertain must be a list of {input, why} text pairs');
    for (const u of ph.uncertain ?? []) questions.push({ id: 'uncertain-input', ask: u.input, why: u.why, suggested: null });
  }
  return { rows, questions };
}

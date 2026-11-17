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
    const r = routeFn({ role: ph.role, taskTypes: ph.taskTypes, risk: ph.risk, providers: ph.providers, approved: ph.approved });
    const d = r.decision;
    rows.push({ phase: ph.name, role: ph.role, tier: d ? d.tier : null, model: d ? d.model : null, provider: d ? d.provider : null, effort: d?.effort?.level ?? null, code: r.code, heldBack: r.heldBack.map((h) => h.model), cost: 'available after increment 7', quota: 'available after increment 7' });
    for (const q of r.questions) { const key = q.id + (q.ask ?? ''); if (!seen.has(key)) { seen.add(key); questions.push({ ...q, why: q.id === 'route-order' ? 'It decides whether free local models or paid cloud models are tried first.' : 'The best-suited model costs more, so it needs your yes.' }); } }
    for (const u of ph.uncertain ?? []) questions.push({ id: 'uncertain-input', ask: u.input, why: u.why, suggested: null });
  }
  return { rows, questions };
}

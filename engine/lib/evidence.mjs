// @ts-check
// File:    engine/lib/evidence.mjs
// Purpose: The gate that decides whether a task may be called complete. What a model says about its own work
//          never counts; only checkable results do. INCOMPLETE if: a required test, build or lint result is
//          missing or failed; a blocking finding is still open; an acceptance criterion has no reference; or
//          the plan has changed since it was locked.

/**
 * @param {{results?: {name: string, kind: string, required?: boolean, status?: string}[], findings?: {id: string, severity: string, status: string}[], criteria?: {id: string, ref?: string|null}[], planVersion?: number, lockedPlanVersion?: number, selfReported?: string}} e
 */
export function checkEvidence(e) {
  const failing = [];
  for (const r of e.results ?? []) {
    if (r.required === false) continue;
    if (r.status === undefined || r.status === 'MISSING') failing.push({ gate: 'RESULT_MISSING', detail: `${r.kind} "${r.name}" has no result.` });
    else if (r.status !== 'PASS') failing.push({ gate: 'RESULT_FAILED', detail: `${r.kind} "${r.name}" is ${r.status}.` });
  }
  for (const f of e.findings ?? []) if (f.severity === 'BLOCKING' && !['FIXED', 'VERIFIED', 'REJECTED', 'ACCEPTED_RISK'].includes(f.status)) failing.push({ gate: 'BLOCKING_FINDING_OPEN', detail: `${f.id} is ${f.status}.` });
  for (const c of e.criteria ?? []) if (!c.ref) failing.push({ gate: 'CRITERION_UNPROVEN', detail: `Acceptance criterion ${c.id} has no reference to proof.` });
  if (e.lockedPlanVersion !== undefined && e.planVersion !== e.lockedPlanVersion) failing.push({ gate: 'PLAN_CHANGED', detail: `Work is on plan version ${e.planVersion}, but version ${e.lockedPlanVersion} is the one locked.` });
  const ignored = e.selfReported && failing.length ? `Reported "${e.selfReported}" is ignored: checkable results decide.` : null;
  return { complete: failing.length === 0, failing, note: ignored };
}

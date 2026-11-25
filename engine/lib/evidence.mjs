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
  if (!e || typeof e !== 'object' || Array.isArray(e)) throw new RangeError('the evidence must be a JSON object');
  if (e.requiredKinds !== undefined && (!Array.isArray(e.requiredKinds) || e.requiredKinds.some((k) => typeof k !== 'string'))) throw new RangeError('requiredKinds must be a list of text values');
  const failing = [];
  const results = Array.isArray(e.results) ? e.results : [];
  // Nothing proven is not the same as nothing wrong: at least one required check must have passed, and every
  // kind named in requiredKinds (default: test) must have a passing, non-skipped result.
  const requiredKinds = e.requiredKinds ?? ['test'];
  if (!results.length) failing.push({ gate: 'NO_RESULTS', detail: 'No check results were given, so nothing shows the work is complete.' });
  else if (!results.some((r) => r && typeof r === 'object' && r.status === 'PASS' && r.required !== false)) failing.push({ gate: 'NO_PASSING_RESULT', detail: 'No required check passed, so nothing shows the work is complete.' });
  for (const k of requiredKinds) if (!results.some((r) => r && r.kind === k && r.status === 'PASS' && r.required !== false)) failing.push({ gate: 'RESULT_MISSING', detail: `No passing ${k} result was given.` });
  for (const r of results) {
    if (!r || r.required === false) continue;
    if (r.status === undefined || r.status === 'MISSING') failing.push({ gate: 'RESULT_MISSING', detail: `${r.kind} "${r.name}" has no result.` });
    else if (r.status !== 'PASS') failing.push({ gate: 'RESULT_FAILED', detail: `${r.kind} "${r.name}" is ${String(r.status).slice(0, 20)}.` });
  }
  const SEV = ['BLOCKING', 'HIGH', 'MEDIUM', 'LOW', 'INFO'], DONE = ['FIXED', 'VERIFIED', 'REJECTED', 'ACCEPTED_RISK'];
  for (const f of Array.isArray(e.findings) ? e.findings : []) {
    const sev = String(f?.severity ?? '').toUpperCase(), st = String(f?.status ?? '').toUpperCase();
    if (!SEV.includes(sev)) failing.push({ gate: 'FINDING_UNKNOWN_SEVERITY', detail: `${f?.id ?? '?'} has an unknown severity.` });
    else if (sev === 'BLOCKING' && !DONE.includes(st)) failing.push({ gate: 'BLOCKING_FINDING_OPEN', detail: `${f.id} is ${st || 'unknown'}.` });
  }
  for (const c of Array.isArray(e.criteria) ? e.criteria : []) if (!c || typeof c.ref !== 'string' || c.ref.trim() === '') failing.push({ gate: 'CRITERION_UNPROVEN', detail: `Acceptance criterion ${c?.id ?? '?'} has no reference to proof.` });
  if (e.lockedPlanVersion !== undefined && e.planVersion !== e.lockedPlanVersion) failing.push({ gate: 'PLAN_CHANGED', detail: `Work is on plan version ${e.planVersion}, but version ${e.lockedPlanVersion} is the one locked.` });
  if (e.lockedPlanHash !== undefined && e.planHash !== e.lockedPlanHash) failing.push({ gate: 'PLAN_CHANGED', detail: 'The plan\'s fingerprint differs from the locked one: it was edited without a new version.' });
  const ignored = e.selfReported && failing.length ? `Reported "${String(e.selfReported).slice(0, 30)}" is ignored: checkable results decide.` : null;
  return { complete: failing.length === 0, failing, note: ignored };
}

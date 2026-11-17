// @ts-check
// File:    engine/lib/plan.mjs
// Purpose: Plan contracts: a plan that, once the owner approves it, is locked by a fingerprint. Any later
//          change to the plan's contract changes the fingerprint, so an edited "locked" plan is caught.
//          The fingerprint rule is the same one .claude/plans/orchestrator-v2/hash-contract.mjs used to lock
//          this project's own plan, so the hand lock and the engine agree.
import { canonicalJson, sha256Hex } from './canonical.mjs';
import { markerFor } from './store.mjs';

/** Raised when the state does not allow the action (for example locking a plan that is already locked). */
export class Conflict extends Error {}
/** The draft's contract was changed after its fingerprint was made, so locking it would approve text nobody saw. */
export class StaleDraft extends Error {}

export const planHash = (contract) => sha256Hex(canonicalJson(contract));

/** A new, unlocked plan. */
export function draftPlan({ planId, planVersion = 1, contract, supersedes = null }) {
  if (typeof planId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(planId)) throw new RangeError('planId must be plain letters, numbers, dots, dashes or underscores');
  if (!Number.isInteger(planVersion) || planVersion < 1 || planVersion > 10000) throw new RangeError('planVersion must be a whole number of at least 1');
  if (supersedes !== null && (!Number.isInteger(supersedes) || supersedes < 1 || supersedes >= planVersion)) throw new RangeError('supersedes must be an earlier version number');
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) throw new RangeError('contract must be an object');
  return { 'dev-team': markerFor('plan-contract'), planId, planVersion, planHash: planHash(contract), status: 'DRAFT', approvedAt: null, approvedBy: null, supersedes, contract };
}

/** Lock a draft with the owner's approval. A plan that is already locked cannot be locked again at the same version. */
export function lockPlan(doc, { approver, now = new Date() }) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !doc.contract) throw new RangeError('not a plan contract');
  if (doc.status === 'LOCKED') throw new Conflict(`plan ${doc.planId} version ${doc.planVersion} is already locked; a change is a new version`);
  if (doc.status !== 'DRAFT') throw new RangeError('only a plan whose status is exactly DRAFT can be locked');
  // A plan for risky work must say how to roll it back before it can be locked.
  const risk = String(doc.contract.risk ?? '').toUpperCase();
  if ((risk === 'HIGH' || risk === 'CRITICAL') && !(Array.isArray(doc.contract.rollbackRequirements) ? doc.contract.rollbackRequirements.length : typeof doc.contract.rollbackRequirements === 'string' && doc.contract.rollbackRequirements.trim() !== '')) throw new RangeError('a plan for HIGH or CRITICAL risk work must include rollbackRequirements before it can be locked');
  // Lock only what was drafted: if the contract changed since its fingerprint was made, refuse.
  if (planHash(doc.contract) !== doc.planHash) throw new StaleDraft('the contract was changed after the draft was made; draft it again so the fingerprint matches what the owner reads');
  if (typeof approver !== 'string' || approver.trim() === '' || /[\x00-\x1f\x7f]/.test(approver) || approver.length > 80) throw new RangeError('an approver is needed to lock a plan: plain text, no control characters, at most 80 characters');
  return { ...doc, status: 'LOCKED', approvedAt: now.toISOString().slice(0, 10), approvedBy: approver.trim() };
}

/** Does the plan's fingerprint still match its contract? A locked plan that does not match is a failure. */
export function verifyPlan(doc) {
  if (!doc || typeof doc !== 'object' || typeof doc.planHash !== 'string' || !doc.contract) return { ok: false, status: 'INVALID', reason: 'not a plan contract' };
  if (doc.status !== 'DRAFT' && doc.status !== 'LOCKED') return { ok: false, status: 'INVALID', reason: 'status must be exactly DRAFT or LOCKED' };
  const filled = (x) => typeof x === 'string' && x.trim() !== '' && !/[\x00-\x1f\x7f]/.test(x);
  // A locked plan must say who approved it and when; a draft must not (so a locked plan cannot be quietly turned back into a draft).
  if (doc.status === 'LOCKED' && !(filled(doc.approvedBy) && typeof doc.approvedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(doc.approvedAt))) return { ok: false, status: 'INVALID', reason: 'a locked plan must record who approved it and when' };
  if (doc.status === 'DRAFT' && (doc.approvedBy != null || doc.approvedAt != null)) return { ok: false, status: 'INVALID', reason: 'a draft cannot carry an approval; this looks like a locked plan turned back into a draft' };
  const actual = planHash(doc.contract);
  const matches = actual === doc.planHash;
  if (doc.status === 'LOCKED' && !matches) return { ok: false, status: 'TAMPERED', reason: 'the contract no longer matches its locked fingerprint', expected: doc.planHash, actual };
  if (!matches) return { ok: true, status: 'DRAFT_OUT_OF_DATE', reason: 'a draft whose fingerprint is out of date; it is refreshed when locked', expected: doc.planHash, actual };
  return { ok: true, status: doc.status, reason: 'fingerprint matches', actual };
}

/** What changed between two versions of a contract: sections added, removed, or edited, and which list items. */
export function diffPlans(a, b) {
  for (const d of [a, b]) if (!d || typeof d !== 'object' || !d.contract || typeof d.contract !== 'object' || Array.isArray(d.contract)) throw new RangeError('both files must be plan contracts');
  const out = { added: [], removed: [], changed: [] };
  const ka = new Set(Object.keys(a.contract)), kb = new Set(Object.keys(b.contract));
  for (const k of kb) if (!ka.has(k)) out.added.push(k);
  for (const k of ka) if (!kb.has(k)) out.removed.push(k);
  for (const k of ka) {
    if (!kb.has(k)) continue;
    const x = a.contract[k], y = b.contract[k];
    if (canonicalJson(x) === canonicalJson(y)) continue;
    if (Array.isArray(x) && Array.isArray(y)) {
      const sx = new Set(x.map(canonicalJson)), sy = new Set(y.map(canonicalJson));
      out.changed.push({ section: k, itemsAdded: y.filter((i) => !sx.has(canonicalJson(i))).length, itemsRemoved: x.filter((i) => !sy.has(canonicalJson(i))).length });
    } else out.changed.push({ section: k });
  }
  return out;
}

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

export const planHash = (contract) => sha256Hex(canonicalJson(contract));

/** A new, unlocked plan. */
export function draftPlan({ planId, planVersion = 1, contract, supersedes = null }) {
  if (typeof planId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(planId)) throw new RangeError('planId must be plain letters, numbers, dots, dashes or underscores');
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) throw new RangeError('contract must be an object');
  return { 'dev-team': markerFor('plan-contract'), planId, planVersion, planHash: planHash(contract), status: 'DRAFT', approvedAt: null, approvedBy: null, supersedes, contract };
}

/** Lock a draft with the owner's approval. A plan that is already locked cannot be locked again at the same version. */
export function lockPlan(doc, { approver, now = new Date() }) {
  if (doc.status === 'LOCKED') throw new Conflict(`plan ${doc.planId} version ${doc.planVersion} is already locked; a change is a new version`);
  if (typeof approver !== 'string' || approver.trim() === '') throw new RangeError('an approver is needed to lock a plan');
  return { ...doc, planHash: planHash(doc.contract), status: 'LOCKED', approvedAt: now.toISOString().slice(0, 10), approvedBy: approver.trim() };
}

/** Does the plan's fingerprint still match its contract? A locked plan that does not match is a failure. */
export function verifyPlan(doc) {
  if (!doc || typeof doc !== 'object' || typeof doc.planHash !== 'string' || !doc.contract) return { ok: false, status: 'INVALID', reason: 'not a plan contract' };
  const actual = planHash(doc.contract);
  const matches = actual === doc.planHash;
  if (doc.status === 'LOCKED' && !matches) return { ok: false, status: 'TAMPERED', reason: 'the contract no longer matches its locked fingerprint', expected: doc.planHash, actual };
  if (!matches) return { ok: true, status: 'DRAFT_OUT_OF_DATE', reason: 'a draft whose fingerprint is out of date; it is refreshed when locked', expected: doc.planHash, actual };
  return { ok: true, status: doc.status, reason: 'fingerprint matches', actual };
}

/** What changed between two versions of a contract: sections added, removed, or edited, and which list items. */
export function diffPlans(a, b) {
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

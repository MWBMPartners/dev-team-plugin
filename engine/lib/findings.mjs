// @ts-check
// File:    engine/lib/findings.mjs
// Purpose: What happens to a problem a reviewer reports. Each finding has a stable id (the same problem found again
//          keeps its id), a status that can only move along allowed steps, and a record of who reported it. A fixed
//          finding that is verified cannot be re-opened without new evidence. Counters of how often each reviewer was
//          right feed later routing.
import { canonicalJson, sha256Hex } from './canonical.mjs';

export const STATUSES = ['OPEN', 'ACCEPTED', 'REJECTED', 'FALSE_POSITIVE', 'DEFERRED', 'FIXED', 'VERIFIED'];
const NEXT = { OPEN: ['ACCEPTED', 'REJECTED', 'FALSE_POSITIVE', 'DEFERRED'], ACCEPTED: ['FIXED'], FIXED: ['VERIFIED', 'ACCEPTED'], DEFERRED: ['OPEN', 'ACCEPTED'], REJECTED: [], FALSE_POSITIVE: [], VERIFIED: [] };
export const SEVERITIES = ['BLOCKING', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const norm = (s) => String(s).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
// File names keep their case (a different case can be a different file) but are tidied: "./a.js" is "a.js".
const normPath = (p) => String(p).normalize('NFC').replace(/\\/g, '/').replace(/^(\.\/)+/, '').trim();
const person = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
/** The same file, rule and wording always give the same id, so a re-run does not create a duplicate. */
export const findingId = ({ file, rule, summary }) => `F-${sha256Hex(canonicalJson({ file: normPath(file), rule: norm(rule ?? ''), summary: norm(summary) })).slice(0, 8)}`;

/** Add a finding (or leave the list alone if its id is already there). */
export function addFinding(list, { file, rule = '', summary, severity, reviewer }) {
  if (typeof file !== 'string' || typeof summary !== 'string' || summary.trim() === '') throw new RangeError('a finding needs a file and a summary');
  if (!SEVERITIES.includes(severity)) throw new RangeError(`severity must be one of ${SEVERITIES.join(', ')}`);
  if (typeof reviewer !== 'string' || reviewer === '') throw new RangeError('a finding needs the reviewer who reported it');
  const id = findingId({ file, rule, summary });
  if (list.some((f) => f.id === id)) return { list, id, added: false };
  return { list: [...list, { id, file, rule, summary: summary.trim(), severity, status: 'OPEN', reviewer, history: [] }], id, added: true };
}

/** Move a finding to a new status along an allowed step. Re-opening a verified finding needs new evidence text. */
export function updateFinding(list, id, { status, by, evidence = '' }) {
  if (!STATUSES.includes(status)) throw new RangeError(`status must be one of ${STATUSES.join(', ')}`);
  const f = list.find((x) => x.id === id); if (!f) throw new RangeError('no such finding');
  const reopen = f.status === 'VERIFIED' && ['OPEN', 'ACCEPTED'].includes(status);
  if (reopen) { if (typeof evidence !== 'string' || evidence.trim().length < 10) throw new RangeError('re-opening a verified finding needs new evidence (at least a sentence)'); }
  else if (!NEXT[f.status].includes(status)) throw new RangeError(`a finding cannot go from ${f.status} to ${status}`);
  if (status === 'VERIFIED') {
    if (typeof by !== 'string' || person(by) === '') throw new RangeError('a finding can only be verified by a named person or reviewer');
    if (person(by) === person(f.reviewer)) throw new RangeError('a finding cannot be verified by the reviewer who raised it');
  }
  if (list.filter((x) => x.id === id).length !== 1) throw new RangeError('the findings list has more than one finding with that id');
  const next = list.map((x) => (x.id === id ? { ...x, status, history: [...x.history, { from: x.status, to: status, by: by ?? null, evidence: evidence || null }] } : x));
  return next;
}

/** How often each reviewer was right: raised, accepted (or fixed or verified), rejected, false positives. */
export function precision(list) {
  const out = new Map(); // a Map, so a reviewer called "__proto__" or "constructor" is just a name
  for (const f of list) {
    const c = out.get(f.reviewer) ?? { raised: 0, accepted: 0, rejected: 0, falsePositive: 0 };
    c.raised++;
    if (['ACCEPTED', 'FIXED', 'VERIFIED'].includes(f.status)) c.accepted++;
    if (f.status === 'REJECTED') c.rejected++;
    if (f.status === 'FALSE_POSITIVE') c.falsePositive++;
    out.set(f.reviewer, c);
  }
  return Object.fromEntries(out);
}

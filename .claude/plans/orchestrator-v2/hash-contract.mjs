// File:    .claude/plans/orchestrator-v2/hash-contract.mjs
// Purpose: Works out the fingerprint (SHA-256) of a plan contract, so a later change to a locked plan
//          can be noticed. It reads a JSON file, takes its "contract" part, writes it out in one fixed
//          shape (keys sorted by code point, no spaces) and prints the fingerprint.
// Usage:   node hash-contract.mjs <file.json>          prints the fingerprint
//          node hash-contract.mjs <file.json> --check  exits 1 if the file's planHash does not match
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function canonical(v) {
  if (v === undefined) throw new Error('undefined is not allowed in a contract');
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
}
export function hashContract(doc) {
  return createHash('sha256').update(canonical(doc.contract), 'utf8').digest('hex');
}
if (process.argv[1] && process.argv[1].endsWith('hash-contract.mjs')) {
  const doc = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const h = hashContract(doc);
  if (process.argv.includes('--check')) { if (h !== doc.planHash) { console.error('MISMATCH ' + h); process.exit(1); } console.log('OK ' + h); }
  else console.log(h);
}

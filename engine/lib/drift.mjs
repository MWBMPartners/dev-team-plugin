// @ts-check
// File:    engine/lib/drift.mjs
// Purpose: Notices when work has wandered away from a locked plan, and says how far. The rules are fixed:
//            ARCHITECTURAL  a protected file or name was touched, or a deviation was declared architectural
//            SIGNIFICANT    a file changed that the plan task did not list
//            MINOR          everything is inside the task's files, with declared minor deviations
//            NO_DRIFT       nothing else
//          Significant and architectural drift mean STOP: work halts and goes back to planning.

const LEVELS = ['NO_DRIFT', 'MINOR_IMPLEMENTATION_DETAIL', 'SIGNIFICANT_DRIFT', 'ARCHITECTURAL_DRIFT'];

/** A path is allowed if it equals an entry, or sits under an entry that ends with "/". */
const covers = (entry, file) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry);
import { posix } from 'node:path';
// Paths are tidied first, so "src/lib/../core/x" is read as "src/core/x" and cannot slip past a rule.
const clean = (p) => posix.normalize(String(p).replace(/\\/g, '/')).replace(/^\.\//, '');

/**
 * @param {{taskFiles: string[], protectedPaths?: string[], protectedNames?: string[], changedFiles: string[], changedText?: string, declared?: {kind: 'minor'|'architectural', note: string}[]}} i
 */
export function classifyDrift(i) {
  if (!i || typeof i !== 'object' || Array.isArray(i)) throw new RangeError('the drift input must be a JSON object');
  for (const k of ['taskFiles', 'changedFiles']) if (!Array.isArray(i[k]) || i[k].some((x) => typeof x !== 'string')) throw new RangeError(`${k} must be a list of file paths`);
  const task = i.taskFiles.map(clean), changed = i.changedFiles.map(clean);
  const prot = (i.protectedPaths ?? []).map(clean), names = i.protectedNames ?? [];
  const declared = i.declared ?? [];
  if (declared.some((d) => !d || !['minor', 'architectural'].includes(d.kind))) throw new RangeError('a declared deviation must be minor or architectural');
  const reasons = [];
  let level = 0;
  const raise = (l, why) => { if (l > level) level = l; reasons.push(why); };
  for (const f of changed) if (prot.some((p) => covers(p, f))) raise(3, `${f} is protected by an architectural decision or invariant.`);
  for (const n of names) if (typeof i.changedText === 'string' && i.changedText.includes(n)) raise(3, `The change touches "${n}", which an architectural decision protects.`);
  if (declared.some((d) => d.kind === 'architectural')) raise(3, 'A deviation was declared architectural.');
  const outside = changed.filter((f) => !task.some((t) => covers(t, f)));
  if (outside.length) raise(2, `Changed outside the task's files: ${outside.slice(0, 5).join(', ')}${outside.length > 5 ? ' and more' : ''}.`);
  if (level < 2 && declared.some((d) => d.kind === 'minor')) raise(1, 'Minor deviations were declared, all inside the task\'s files.');
  if (level === 0) reasons.push('Everything changed is inside the task\'s files.');
  return { level: LEVELS[level], stop: level >= 2, reasons };
}

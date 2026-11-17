// @ts-check
// File:    engine/lib/gates.mjs
// Purpose: How careful to be before an action. Each kind of action has one of five levels; a policy pack may raise a
//          level but never lower it. The levels map onto the autopilot's three buckets:
//            AUTO                      bucket 1  (just do it)
//            REQUIRE_HIGH_CONFIDENCE   bucket 1 only if confident AND a deterministic check passed, else bucket 2
//            REQUIRE_REVIEW            bucket 2 until an independent review has verified it
//            REQUIRE_HUMAN_APPROVAL    bucket 3 (the owner must say yes)
//            PROHIBITED                refused, whatever anyone says
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot } from './paths.mjs';

const table = () => JSON.parse(readFileSync(join(pluginRoot(), 'engine', 'data', 'destructive-actions.json'), 'utf8'));
export const LEVEL_ORDER = ['AUTO', 'REQUIRE_HIGH_CONFIDENCE', 'REQUIRE_REVIEW', 'REQUIRE_HUMAN_APPROVAL', 'PROHIBITED'];

/** The level for an action: the built-in level, raised (never lowered) by any pack. An unknown action is treated as needing a human. */
/** An action name is compared ignoring capitals and surrounding spaces, so "force_push" is FORCE_PUSH and cannot slip past as an unknown action. */
const canon = (s) => String(s).trim().toUpperCase().replace(/[\s-]+/g, '_');

export function levelFor(kind, packs = []) {
  const t = table();
  kind = canon(kind);
  packs = Array.isArray(packs) ? packs : [];
  let level = Object.hasOwn(t.actions, kind) ? t.actions[kind] : 'REQUIRE_HUMAN_APPROVAL';
  const known = Object.hasOwn(t.actions, kind);
  for (const p of packs) { const gk = p?.gates && typeof p.gates === 'object' ? Object.keys(p.gates).find((k) => canon(k) === kind) : undefined; const g = gk !== undefined ? p.gates[gk] : null; if (g && LEVEL_ORDER.indexOf(g) > LEVEL_ORDER.indexOf(level)) level = g; }
  return { level, known };
}

/**
 * @param {string} kind @param {{confident?: boolean, deterministicPass?: boolean, reviewVerified?: boolean, humanApproved?: boolean}} evidence @param {any[]} [packs]
 */
export function gateCheck(kind, evidence = {}, packs = []) {
  if (typeof kind !== 'string' || kind.trim() === '') throw new RangeError('kind must be the name of an action');
  evidence = evidence && typeof evidence === 'object' ? evidence : {};
  const { level, known } = levelFor(kind, packs);
  const ev = Object.fromEntries(['confident', 'deterministicPass', 'reviewVerified', 'humanApproved'].map((k) => [k, evidence[k] === true]));
  const note = known ? null : 'This kind of action is not in the table, so it is treated as needing the owner\'s approval.';
  if (level === 'PROHIBITED') return { level, bucket: null, allowed: false, needs: ['never allowed'], note };
  if (level === 'AUTO') return { level, bucket: 1, allowed: true, needs: [], note };
  if (level === 'REQUIRE_HIGH_CONFIDENCE') { const ok = ev.confident && ev.deterministicPass; return { level, bucket: ok ? 1 : 2, allowed: ok, needs: ok ? [] : ['the agent is confident AND a deterministic check passed'], note }; }
  if (level === 'REQUIRE_REVIEW') return { level, bucket: ev.reviewVerified ? 1 : 2, allowed: ev.reviewVerified, needs: ev.reviewVerified ? [] : ['an independent review has verified it'], note };
  return { level, bucket: 3, allowed: ev.humanApproved, needs: ev.humanApproved ? [] : ['the owner\'s approval'], note };
}

// @ts-check
// File:    engine/lib/config.mjs
// Purpose: Reads the settings that steer routing, from every place they can come from, and says which
//          place decided each one. It reads a small, plain subset of YAML (indented keys, scalars,
//          [lists] and {maps} on one line) because the plugin's config file uses nothing more.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

function scalar(s) {
  const v = s.trim();
  if (v === '' ) return null;
  if (v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === 'false' || v === 'off' || v === 'no') return false;
  if (v === 'null' || v === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v.startsWith('[') && v.endsWith(']')) return v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean).map(scalar);
  if (v.startsWith('{') && v.endsWith('}')) {
    // Values in a one-line map are kept exactly as written (text), so a version such as 4.10 or 007 is never changed.
    const o = {};
    for (const part of v.slice(1, -1).split(',')) { const i = part.indexOf(':'); if (i > 0) o[part.slice(0, i).trim()] = part.slice(i + 1).trim().replace(/^["']|["']$/g, ''); }
    return o;
  }
  return v.replace(/^["']|["']$/g, '');
}

/** Cut a trailing " # comment", but never a # inside quotes. One pass over the line, so it is fast however long the line is. */
function stripComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) { if (ch === quote) quote = ''; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '#' && i > 0 && /\s/.test(line[i - 1])) return line.slice(0, i).trimEnd();
  }
  return line;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Parse the YAML subset and also report anything that makes the file ambiguous: a key written twice at
 * the same level (the later one would silently win) or a key name that is unsafe to store.
 * @returns {{value: any, problems: {path: string, message: string}[]}}
 */
export function parseYamlChecked(text) {
  const root = {};
  const problems = [];
  const stack = [{ indent: -1, obj: root, parent: null, key: '', path: '' }];
  for (const raw of String(text).split('\n')) {
    const line = stripComment(raw.replace(/\r$/, ''));
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    if (line.trim().startsWith('- ')) {
      // A list written one item per line turns the key above it into a list.
      const top = stack[stack.length - 1];
      if (top.parent && !Array.isArray(top.obj) && Object.keys(top.obj).length === 0) { top.obj = []; top.parent[top.key] = top.obj; }
      if (Array.isArray(top.obj)) top.obj.push(scalar(line.trim().slice(2)));
      continue;
    }
    const m = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parentFrame = stack[stack.length - 1];
    const parent = parentFrame.obj;
    const path = parentFrame.path ? `${parentFrame.path}.${m[1]}` : m[1];
    if (FORBIDDEN_KEYS.has(m[1])) { problems.push({ path, message: `the key name "${m[1]}" is not allowed` }); continue; }
    if (Array.isArray(parent)) continue;
    if (Object.hasOwn(parent, m[1])) problems.push({ path, message: `"${m[1]}" is written more than once` });
    if (m[2] === '') { parent[m[1]] = {}; stack.push({ indent, obj: parent[m[1]], parent, key: m[1], path }); }
    else parent[m[1]] = parentFrame.key === 'pin' ? m[2].trim().replace(/^["']|["']$/g, '') : scalar(m[2]); // pin versions stay exact text
  }
  return { value: root, problems };
}

/** Parse the YAML subset (without the ambiguity report). */
export function parseYaml(text) { return parseYamlChecked(text).value; }

function readYamlChecked(path) { try { return existsSync(path) ? parseYamlChecked(readFileSync(path, 'utf8')) : { value: {}, problems: [] }; } catch { return { value: {}, problems: [] }; } }
function readYaml(path) { return readYamlChecked(path).value; }

/** The file holding one computer's own defaults. It lives outside every project and is never committed. */
export const deviceFile = (home = homedir()) => join(home, '.dev-team', 'device.yml');

const PROFILE_ORDER = { 'local-first': 'local-first', 'cloud-first': 'cloud-first' };
const profileOrder = (p) => (typeof p === 'string' && Object.hasOwn(PROFILE_ORDER, p) ? PROFILE_ORDER[p] : undefined);
export const DEFAULT_ASK_FIRST = ['fable', 'mythos', 'openai-top', 'gemini-top', 'unpriced'];

/**
 * The effective routing settings. Order of precedence for where work starts, highest first: this
 * session's choice, the project's remembered answer, the profile, the device file, the built-in default.
 * @param {{projectDir?: string, home?: string, sessionOrder?: string}} [opts]
 */
export function loadRouting(opts = {}) {
  const checked = opts.projectDir ? readYamlChecked(join(opts.projectDir, '.dev-team', 'config.yml')) : { value: {}, problems: [] };
  const project = checked.value;
  const device = readYaml(deviceFile(opts.home));
  const valid = (v) => v === 'local-first' || v === 'cloud-first';
  let order = 'local-first', orderDecidedBy = 'built-in default';
  if (valid(device.routing?.order)) { order = device.routing.order; orderDecidedBy = 'this computer\'s device file'; }
  if (profileOrder(project.profile)) { order = profileOrder(project.profile); orderDecidedBy = `the project's profile (${project.profile})`; }
  if (valid(project.routing?.order)) { order = project.routing.order; orderDecidedBy = 'the project\'s saved answer (.dev-team/config.yml)'; }
  if (valid(opts.sessionOrder)) { order = /** @type {string} */ (opts.sessionOrder); orderDecidedBy = 'this session\'s choice'; }
  const askedBefore = valid(project.routing?.order) || Boolean(profileOrder(project.profile));
  // ask-first: an explicit list in the user's own .dev-team/config.yml replaces the built-in list (it is the
  // user's own setting). A repository INSTRUCTION file may only add to it; that rule is applied by the lead,
  // which passes the combined list on, because this reader never looks at instruction files.
  const askFirst = Array.isArray(project.routing?.['ask-first']) ? project.routing['ask-first'].map(String) : DEFAULT_ASK_FIRST;
  // A pin must be a map of name to a non-empty piece of text. Anything else is kept out of `pin` and
  // listed in `badPins`, and routing stops and asks rather than guess what version was meant.
  const rawPin = project.routing?.pin;
  const pin = {}, badPins = [], badSettings = [];
  if (rawPin !== undefined && rawPin !== null && (typeof rawPin !== 'object' || Array.isArray(rawPin))) badPins.push('pin (it must be a list of name: version pairs)');
  else for (const [k, v] of Object.entries(rawPin ?? {})) {
    if ((typeof v === 'string' && v.trim() !== '' && !/[\[\]{}]/.test(v)) || typeof v === 'number') {
      const key = k.toLowerCase();
      // Two pins for one model (names differing only in capitals) with different versions: never pick one.
      if (Object.hasOwn(pin, key) && pin[key] !== String(v)) badPins.push(`${k} (pinned twice with different versions)`);
      pin[key] = String(v);
    } else badPins.push(k);
  }
  // Anything ambiguous under routing: (a setting written twice, an unsafe key name) is reported, never resolved by guessing.
  for (const pr of checked.problems) { if (/^routing\.pin\./.test(pr.path) || pr.path === 'routing.pin') badPins.push(`${pr.path} (${pr.message})`); else if (pr.path.startsWith('routing')) badSettings.push(`${pr.path} (${pr.message})`); }
  return { order, orderDecidedBy, askedBefore, askFirst, pin, badPins, badSettings, profile: project.profile ?? null };
}

/** Save this computer's own default order. Writes only the device file, outside any project. */
export function saveDeviceOrder(order, home = homedir()) {
  if (order !== 'local-first' && order !== 'cloud-first') throw new Error('order must be local-first or cloud-first');
  const p = deviceFile(home);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `routing:\n  order: ${order}\n`);
  return p;
}

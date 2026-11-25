// @ts-check
// File:    engine/lib/schema.mjs
// Purpose: A small checker for the plugin's JSON files against their schema files, with no outside
//          libraries. It understands only the schema words the plugin's own schemas use; a schema
//          that uses another word is reported, never silently accepted.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KNOWN = new Set(['$schema', '$id', '$ref', '$defs', 'title', 'description', 'type', 'required', 'enum', 'const',
  'properties', 'additionalProperties', 'pattern', 'minimum', 'maximum', 'minItems', 'maxItems', 'items', 'oneOf', 'anyOf', 'minLength', 'default', 'examples', 'uniqueItems']);

/** Load a schema file (path relative to the plugin root, or absolute). */
export function loadSchema(path) { return JSON.parse(readFileSync(path, 'utf8')); }

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}
function typeMatches(want, v) {
  const t = typeOf(v);
  return t === want || (want === 'number' && t === 'integer');
}

/**
 * Check `value` against `schema`. Returns {ok, errors:[{path, message}]}.
 * @param {any} schema @param {any} value @param {any} [root] @param {string} [path]
 */
export function validate(schema, value, root = schema, path = '$') {
  /** @type {{path: string, message: string}[]} */
  const errors = [];
  const add = (message) => errors.push({ path, message });
  for (const k of Object.keys(schema)) if (!KNOWN.has(k)) add(`unsupported schema keyword "${k}"`);
  if (schema.$ref !== undefined) {
    const m = /^#\/\$defs\/(.+)$/.exec(schema.$ref);
    const target = m && root.$defs ? root.$defs[m[1]] : undefined;
    if (!target) { add(`cannot resolve ${schema.$ref}`); return { ok: false, errors }; }
    return validate(target, value, root, path);
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(t, value))) { add(`expected ${types.join(' or ')}, found ${typeOf(value)}`); return { ok: false, errors }; }
  }
  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(value)) add(`must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) add(`must be one of ${JSON.stringify(schema.enum)}`);
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) add(`does not match ${schema.pattern}`);
    if (schema.minLength !== undefined && value.length < schema.minLength) add(`shorter than ${schema.minLength}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) add(`below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) add(`above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) add(`fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) add(`more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => errors.push(...validate(schema.items, v, root, `${path}[${i}]`).errors));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const r of schema.required ?? []) if (!(r in value)) add(`missing required "${r}"`);
    const props = schema.properties ?? {};
    for (const [k, v] of Object.entries(value)) {
      if (k in props) errors.push(...validate(props[k], v, root, `${path}.${k}`).errors);
      else if (schema.additionalProperties === false) errors.push({ path: `${path}.${k}`, message: 'not allowed here' });
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') errors.push(...validate(schema.additionalProperties, v, root, `${path}.${k}`).errors);
    }
  }
  if (schema.oneOf) {
    const hits = schema.oneOf.filter((s) => validate(s, value, root, path).ok).length;
    if (hits !== 1) add(`must match exactly one alternative, matched ${hits}`);
  }
  if (schema.anyOf && !schema.anyOf.some((s) => validate(s, value, root, path).ok)) add('must match at least one alternative');
  return { ok: errors.length === 0, errors };
}

/**
 * Check the manifest (schemas/manifest.json): every entry's schema and fixture must exist and the
 * fixture must pass. Returns the list of problems (empty when all is well).
 * @param {string} pluginRoot
 */
export function validateManifest(pluginRoot) {
  /** @type {string[]} */
  const problems = [];
  const mpath = join(pluginRoot, 'schemas', 'manifest.json');
  if (!existsSync(mpath)) return [`missing ${mpath}`];
  const manifest = JSON.parse(readFileSync(mpath, 'utf8'));
  for (const e of manifest.entries ?? []) {
    const sp = join(pluginRoot, e.schema), fp = join(pluginRoot, e.fixture);
    if (!existsSync(sp)) { problems.push(`schema missing: ${e.schema}`); continue; }
    if (!existsSync(fp)) { problems.push(`fixture missing: ${e.fixture}`); continue; }
    const r = validate(loadSchema(sp), JSON.parse(readFileSync(fp, 'utf8')));
    for (const er of r.errors) problems.push(`${e.fixture} ${er.path}: ${er.message}`);
  }
  return problems;
}

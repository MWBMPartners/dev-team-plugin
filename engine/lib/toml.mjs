// @ts-check
// File:    engine/lib/toml.mjs
// Purpose: Reads the few simple settings the engine needs from a tool's TOML file (for example Codex's
//          config.toml): key = "text", key = number, key = true|false, and [section] headings.
//          Anything else is reported in unsupportedLines and never guessed at.

/** @param {string} text */
export function readSimpleToml(text) {
  /** @type {Record<string, string|number|boolean>} */
  const values = {};
  /** @type {string[]} */
  const unsupportedLines = [];
  let section = '';
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/\r$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    let m = /^\[([A-Za-z0-9_.-]+)\]$/.exec(line);
    if (m) { section = m[1]; continue; }
    m = /^([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*(?:#.*)?$/.exec(line);
    if (!m) { unsupportedLines.push(line); continue; }
    const key = section ? `${section}.${m[1]}` : m[1];
    const v = m[2];
    let q = /^"([^"\\]*)"$/.exec(v) ?? /^'([^']*)'$/.exec(v);
    if (q) values[key] = q[1];
    else if (/^-?\d+(\.\d+)?$/.test(v)) values[key] = Number(v);
    else if (v === 'true' || v === 'false') values[key] = v === 'true';
    else unsupportedLines.push(line);
  }
  return { values, unsupportedLines };
}

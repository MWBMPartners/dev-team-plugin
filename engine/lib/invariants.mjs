// @ts-check
// File:    engine/lib/invariants.mjs
// Purpose: Collects the rules a project says must always hold, from the project's own instruction files and any
//          policy packs, so every brief and every checker can be given them. The files are only READ, and their text is
//          treated as data: nothing in them is ever run. A line counts as a rule if it is a list item or sentence that
//          says must, never, always or do not.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Hex } from './canonical.mjs';
import { redact } from './redact.mjs';

const SOURCES = ['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md', 'CONTRIBUTING.md'];
const RULE = /\b(must not|must|never|always|do not|don't|shall not|required to)\b/i;

/** @param {string} projectDir @param {any[]} [packs] */
export function collectInvariants(projectDir, packs = []) {
  const found = [];
  const files = [...SOURCES];
  for (const d of ['.OpenAI', '.openai']) { try { for (const f of readdirSync(join(projectDir, d))) if (f.endsWith('.md')) files.push(`${d}/${f}`); } catch { /* none */ } }
  for (const rel of files) {
    const p = join(projectDir, rel); if (!existsSync(p)) continue;
    let text; try { text = readFileSync(p, 'utf8'); } catch { continue; }
    let inFence = false;
    text.split('\n').forEach((line, i) => {
      if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return; }
      if (inFence) return; // example code is not a rule
      const m = /^\s*(?:[-*]|\d+[.)])\s+(.{12,300})$/.exec(line) ?? (/^[A-Z].{20,300}[.!]$/.test(line.trim()) ? [null, line.trim()] : null);
      if (!m || !RULE.test(m[1])) return;
      const textOnly = redact(m[1].replace(/\*\*/g, '').trim());
      found.push({ id: `INV-${sha256Hex(`${rel}|${textOnly.toLowerCase()}`).slice(0, 8)}`, text: textOnly, source: `${rel}:${i + 1}` });
    });
  }
  for (const p of packs) for (const t of p.invariants ?? []) found.push({ id: `INV-${sha256Hex(`pack:${p.id}|${t.toLowerCase()}`).slice(0, 8)}`, text: t, source: `pack:${p.id}` });
  const seen = new Set();
  return found.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))).slice(0, 500);
}

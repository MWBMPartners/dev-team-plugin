// @ts-check
// File:    engine/lib/projectdocs.mjs
// Purpose: Read-only checks on a project's shared documents (standing rules 13 and 15):
//          (1) the handover, goals, requirements and plan sections exist in .dev-team/PROJECT.md, and
//          (2) a project with an OpenAPI description also has a Swagger UI page.
//          They only look; they never write, and a missing piece is a finding, not an error.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REQUIRED = ['Goal', 'Definition of done', 'Requirements and prerequisites', 'Stage plan', 'Current status'];

/** @param {string} projectDir */
export function checkProjectDocs(projectDir) {
  const findings = [];
  const proj = join(projectDir, '.dev-team', 'PROJECT.md');
  if (!existsSync(proj)) findings.push({ code: 'NO_PROJECT_DOC', message: '.dev-team/PROJECT.md does not exist, so there is no goals, requirements or plan document yet.' });
  else {
    const text = readFileSync(proj, 'utf8');
    const heads = new Set([...text.matchAll(/^#{1,3}\s+(.+?)\s*$/gm)].map((m) => m[1].replace(/\s+←.*$/, '').trim().toLowerCase()));
    for (const h of REQUIRED) if (!heads.has(h.toLowerCase())) findings.push({ code: 'MISSING_SECTION', message: `PROJECT.md has no "${h}" section.` });
  }
  const hasHandoff = existsSync(join(projectDir, '.dev-team', 'HANDOFF.md'));
  return { hasProjectDoc: existsSync(proj), hasHandoff, findings };
}

const SKIP = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', '.venv', 'target']);
/** Walk a folder a bounded amount (depth 5, 3000 files), returning project-relative paths. */
function walk(root, limit = 3000) {
  const out = [];
  const go = (dir, depth) => {
    if (depth > 5 || out.length >= limit) return;
    let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (!SKIP.has(e.name)) go(join(dir, e.name), depth + 1); }
      else if (out.length < limit) out.push(relative(root, join(dir, e.name)));
    }
  };
  go(root, 0);
  return out;
}

/** @param {string} projectDir */
export function checkApiDocs(projectDir) {
  const files = walk(projectDir);
  const specs = files.filter((f) => /(^|\/)(openapi|swagger)[^/]*\.(json|ya?ml)$/i.test(f));
  const ui = files.filter((f) => /swagger-ui/i.test(f) || /(^|\/)(swagger|api-docs|docs)\/index\.(html|php)$/i.test(f));
  const findings = [];
  if (specs.length && !ui.length) findings.push({ code: 'NO_SWAGGER_UI', message: 'An OpenAPI description exists but no Swagger UI page was found. API users need a page to browse how to use the API (it may be limited to people with API access).' });
  const stale = [];
  for (const s of specs) {
    try { const age = Date.now() - statSync(join(projectDir, s)).mtimeMs; if (age > 180 * 86400000) stale.push(s); } catch { /* ignore */ }
  }
  if (stale.length) findings.push({ code: 'OLD_SPEC', message: `Not changed for over six months (check it still matches the code): ${stale.join(', ')}.` });
  return { hasOpenApi: specs.length > 0, specs, swaggerUi: ui, findings, note: specs.length ? 'Whether the spec matches the code needs a human or a test; this only checks it exists and has a UI page.' : 'No OpenAPI description found. If this project has no API, nothing is needed (standing rule 15 applies only to web projects that offer an API).' };
}

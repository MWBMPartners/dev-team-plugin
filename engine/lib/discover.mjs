// @ts-check
// File:    engine/lib/discover.mjs
// Purpose: Finds models that are really available here, so new ones work without a plugin update.
//          Today it asks a local Ollama install what it has. A model's strength is only a rough guess
//          from its name (its size), and is marked as a guess.

/** Parse the table `ollama list` prints: NAME  ID  SIZE  MODIFIED. */
export function parseOllamaList(text) {
  const lines = String(text).split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.filter((l) => !/^NAME\s/i.test(l)).map((l) => l.split(/\s+/)[0]).filter((n) => /^[\w./:-]+$/.test(n));
}

/** A rough tier from the size in the model's name: 30B or more counts as a capable engineer (2), the rest as utility (1). */
export function guessLocalTier(name) {
  const m = /(\d+(?:\.\d+)?)\s*b\b/i.exec(name.replace(/[:_-]/g, ' '));
  const billions = m ? Number(m[1]) : 0;
  return billions >= 30 ? 2 : 1;
}

/** Turn local model names into catalogue entries. Local models are free, so they are always priced. */
export function ollamaEntries(names) {
  // Ollama can also list models it runs on its own paid servers (names ending -cloud or :cloud). Those are
  // not on this machine and are not free, so they are treated as unpriced cloud models, never as local ones.
  return names.map((n) => ({
    provider: 'ollama', id: n, alias: n, tier: guessLocalTier(n), tierSource: 'guess-from-name',
    local: !/(^|[:-])cloud$/i.test(n), costBand: /(^|[:-])cloud$/i.test(n) ? 5 : 0, priced: !/(^|[:-])cloud$/i.test(n), roles: ['scout', 'builder', 'mechanical', 'documentarian'], classes: [], verified: false, source: 'discovered',
  }));
}

/** Ask Ollama what it has. `run` is replaceable for tests. Returns [] when Ollama is not there. */
export async function discoverOllama(run) {
  try { const { stdout } = await run('ollama', ['list'], { timeout: 8000 }); return ollamaEntries(parseOllamaList(String(stdout))); }
  catch { return []; }
}

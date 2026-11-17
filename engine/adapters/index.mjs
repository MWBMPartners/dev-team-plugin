// @ts-check
// File:    engine/adapters/index.mjs
// Purpose: The list of adapters. Adding a provider means adding one file and one line here; routing code
//          is never touched.
import { claudeCode } from './claude-code.mjs';
import { codex } from './codex.mjs';
import { unverifiedAdapter } from './unverified.mjs';

export function listAdapters() {
  return [claudeCode, codex, unverifiedAdapter('gemini-cli', 'google'), unverifiedAdapter('kimi-cli', 'moonshot'), unverifiedAdapter('grok-build', 'xai')];
}
export function getAdapter(id) { return listAdapters().find((a) => a.id === id) ?? null; }

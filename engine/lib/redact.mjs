// @ts-check
// File:    engine/lib/redact.mjs
// Purpose: Hide anything that looks like a secret before text is printed or saved. The engine never
//          reads credentials on purpose; this is the net for the cases where one turns up in text
//          from a provider or a command anyway. It is a best-effort pattern match, not a guarantee.

/** @type {{kind: string, re: RegExp}[]} */
const PATTERNS = [
  { kind: 'stripe-live', re: /\b(?:sk|rk|pk)_live_[A-Za-z0-9]{8,}/g },
  { kind: 'github-token', re: /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{20,}/g },
  { kind: 'github-pat', re: /\bgithub_pat_[A-Za-z0-9_]{20,}/g },
  { kind: 'slack-token', re: /\bxox[abp]-[A-Za-z0-9-]{10,}/g },
  { kind: 'aws-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'api-key', re: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { kind: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { kind: 'bearer', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g },
  { kind: 'url-password', re: /(?<=:\/\/)[^\s/:@]+:[^\s/@]+(?=@)/g },
];

/** Replace every secret-shaped piece with [REDACTED:<kind>]. Running it twice changes nothing more. */
export function redact(text) {
  let out = String(text);
  for (const { kind, re } of PATTERNS) out = out.replace(re, `[REDACTED:${kind}]`);
  return out;
}

/** True when the text still contains something secret-shaped (used to refuse writing a file). */
export function looksLikeCredential(text) {
  const s = String(text);
  return PATTERNS.some(({ re }) => { re.lastIndex = 0; return re.test(s); });
}

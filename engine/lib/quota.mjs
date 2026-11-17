// @ts-check
// File:    engine/lib/quota.mjs
// Purpose: Reads a "you have hit a usage limit" message and records what it says, and no more. It names the
//          cause (the session window, the weekly limit, one model family, or a spend cap), whether the limit
//          covers one family or the whole session, and when it resets. A reset time is only ever taken from the
//          message; if the message has none the time is null. The wording of real messages is not yet confirmed
//          against a real account: the patterns below follow the phrases providers are known to use and are
//          tested on synthetic messages only.
import { parseClockTime } from './time.mjs';
import { redact } from './redact.mjs';

/**
 * @param {string} text @param {{provider: string, machineZone: string, now: Date}} o
 * @returns {null | {provider: string, state: 'EXHAUSTED' | 'RATE_LIMITED', cause: string, scope: string, resetAt: string|null, assumptions: string[], confidence: string, observedAt: string}}
 */
export function parseQuotaMessage(text, { provider, machineZone, now }) {
  const s = redact(String(text)).slice(0, 4000);
  // A short rate limit ("retry after 20 seconds") is a pause of seconds, not an exhausted allowance.
  const shortRetry = /retry after (\d{1,4})\s*(?:seconds?|secs?|s)\b/i.exec(s);
  if (shortRetry && !/(usage|quota|weekly|session|spend|credit|billing)/i.test(s)) return { provider, state: 'RATE_LIMITED', cause: 'RATE', scope: 'SESSION', resetAt: new Date(now.getTime() + Number(shortRetry[1]) * 1000).toISOString(), assumptions: ['RELATIVE_DURATION'], confidence: 'LOW', observedAt: now.toISOString() };
  if (!/(usage|rate|spend(?:ing)?|credit|quota)\s+limit|limit\s+(?:reached|hit|exceeded)|out of (?:credits?|usage)|hit your .{0,20}limit|quota (?:exceeded|exhausted)/i.test(s)) return null;
  let cause = 'UNKNOWN';
  if (/weekly|per week|7[- ]day/i.test(s)) cause = 'WEEKLY';
  else if (/spend|credit|billing|budget/i.test(s)) cause = 'SPEND';
  else if (/session|5[- ]hour|five[- ]hour|hourly/i.test(s)) cause = 'SESSION';
  else if (/opus|sonnet|haiku|fable|gpt|codex|model/i.test(s) && /limit/i.test(s)) cause = 'MODEL_FAMILY';
  const scope = /opus|sonnet|haiku|fable|gpt|codex|model|family/i.test(s) && cause !== 'SESSION' && cause !== 'SPEND' ? 'MODEL_FAMILY' : 'SESSION';
  const t = parseClockTime(s, { machineZone, now });
  return { provider, state: 'EXHAUSTED', cause, scope, resetAt: t.resetAt, assumptions: t.assumptions, confidence: t.resetAt ? (t.confidence === 'HIGH' ? 'HIGH' : 'LOW') : 'NONE', observedAt: now.toISOString() };
}

/**
 * Decide what to do about an exhausted provider: wait for it (PAUSE) or stop and ask (BLOCK). Waiting is only
 * allowed when the reset time is KNOWN and no more than `thresholdHours` away. An unknown time, or a long wait,
 * never becomes a guess: the phase is blocked and the owner is asked.
 * @param {{resetAt: string|null}} obs @param {Date} now @param {number} [thresholdHours]
 */
export function pauseOrBlock(obs, now, thresholdHours = 12) {
  if (!Number.isFinite(thresholdHours) || thresholdHours <= 0 || thresholdHours > 168) throw new RangeError('thresholdHours must be between 0 and 168');
  if (obs && obs.state === 'RATE_LIMITED') return { action: 'RETRY_LATER', state: 'RUNNING', reason: 'A short rate limit: wait a few seconds and retry the same model.', resetAt: obs.resetAt };
  if (!obs || !obs.resetAt) return { action: 'BLOCK', state: 'BLOCKED_AWAITING_AGENT', reason: 'The message gives no reset time, and a reset time is never invented.' };
  const at = Date.parse(obs.resetAt);
  if (!Number.isFinite(at)) return { action: 'BLOCK', state: 'BLOCKED_AWAITING_AGENT', reason: 'The reset time could not be read.' };
  const hours = (at - now.getTime()) / 3600000;
  if (hours <= 0) return { action: 'RETRY_NOW', state: 'RUNNING', reason: 'The reset time has already passed: check the provider again rather than trust the clock.' };
  if (hours > thresholdHours) return { action: 'BLOCK', state: 'BLOCKED_AWAITING_AGENT', reason: `The reset is ${hours.toFixed(1)} hours away, more than the ${thresholdHours}-hour limit for waiting.`, resetAt: obs.resetAt };
  return { action: 'PAUSE', state: 'PAUSED_AWAITING_QUOTA', reason: `The reset is ${hours.toFixed(1)} hours away: wait for the same agent and resume.`, resetAt: obs.resetAt, hours };
}

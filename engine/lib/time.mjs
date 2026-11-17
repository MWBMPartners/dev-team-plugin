// @ts-check
// File:    engine/lib/time.mjs
// Purpose: Turns the time in a "usage limit reached, resets at ..." message into a real moment, without inventing
//          anything. Every guess is written down in `assumptions`; if the message gives no clock time at all the
//          answer is null, never a made-up time. No outside libraries: time zones come from Intl.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Is this a time-zone name the system knows? */
export function validZone(zone) { try { new Intl.DateTimeFormat('en-GB', { timeZone: zone }); return typeof zone === 'string' && zone.length < 60; } catch { return false; } }

/** The zone's offset from UTC, in milliseconds, at the moment `ts` (UTC milliseconds). */
function offsetAt(zone, ts) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(ts)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000;
}

/** A wall-clock time in a zone, as UTC milliseconds. A time that does not exist (the clocks jumped over it) moves forward. */
export function zonedToUtc(y, mo, d, h, mi, zone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess - offsetAt(zone, guess);
  const o2 = offsetAt(zone, utc);
  if (guess - o2 !== utc) utc = guess - o2;
  return utc;
}

const datePartsIn = (zone, ts) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(ts)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)])); return { y: p.year, m: p.month, d: p.day }; };

/**
 * @param {string} text the (already redacted) message
 * @param {{zoneStated?: string|null, machineZone: string, now: Date}} o
 * @returns {{resetAt: string|null, assumptions: string[], confidence: 'HIGH'|'LOW'|'NONE'}}
 */
export function parseClockTime(text, { zoneStated = null, machineZone, now }) {
  const s = String(text);
  const assumptions = [];
  // 1. A length of time ("in 2 hours 30 minutes"): add it to now.
  const rel = /\b(?:in|after)\s+(?:(\d+)\s*(?:hours?|hrs?|h)\b)?\s*(?:and\s+)?(?:(\d+)\s*(?:minutes?|mins?|m)\b)?/i.exec(s);
  if (rel && (rel[1] || rel[2]) && !/\d{1,2}:\d{2}/.test(s)) {
    const ms = (Number(rel[1] ?? 0) * 60 + Number(rel[2] ?? 0)) * 60000;
    if (ms > 0 && ms < 400 * 3600000) return { resetAt: new Date(now.getTime() + ms).toISOString(), assumptions: ['RELATIVE_DURATION'], confidence: 'LOW' };
  }
  // 2. Which zone?
  let zone = zoneStated;
  const named = /\(([A-Za-z_]+\/[A-Za-z_+-]+(?:\/[A-Za-z_]+)?)\)/.exec(s) ?? /\b([A-Z][a-z]+\/[A-Z][A-Za-z_]+)\b/.exec(s);
  if (!zone && named && validZone(named[1])) zone = named[1];
  if (!zone && /\bUTC\b|\bGMT\b/.test(s)) zone = 'UTC';
  if (zone && !validZone(zone)) zone = null;
  if (!zone) { zone = machineZone; assumptions.push('ZONE_MACHINE'); }
  // 3. A full date and time ("Sep 14th, 2026 2:31 AM").
  const full = new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})[,\\s]+(\\d{1,2}):(\\d{2})\\s*(am|pm)?`, 'i').exec(s);
  const clock = (h, mi, ap) => { let hh = Number(h); if (ap) { const pm = ap.toLowerCase() === 'pm'; if (hh < 1 || hh > 12) return null; hh = (hh % 12) + (pm ? 12 : 0); } if (hh > 23 || Number(mi) > 59) return null; return [hh, Number(mi)]; };
  if (full) {
    const c = clock(full[4], full[5], full[6]);
    if (c) return { resetAt: new Date(zonedToUtc(Number(full[3]), MONTHS.indexOf(full[1].toLowerCase()) + 1, Number(full[2]), c[0], c[1], zone)).toISOString(), assumptions, confidence: assumptions.length ? 'LOW' : 'HIGH' };
  }
  // 4. A clock time with no date: its next occurrence.
  const m12 = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i.exec(s), m24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(s);
  const c = m12 ? clock(m12[1], m12[2] ?? '0', m12[3]) : m24 ? clock(m24[1], m24[2], null) : null;
  if (!c) return { resetAt: null, assumptions: [], confidence: 'NONE' };
  assumptions.push('DATE_NEXT_OCCURRENCE');
  let { y, m, d } = datePartsIn(zone, now.getTime());
  let utc = zonedToUtc(y, m, d, c[0], c[1], zone);
  if (utc <= now.getTime()) { const next = datePartsIn(zone, utc + 26 * 3600000); utc = zonedToUtc(next.y, next.m, next.d, c[0], c[1], zone); }
  return { resetAt: new Date(utc).toISOString(), assumptions, confidence: 'LOW' };
}

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

/**
 * A wall-clock time in a zone, as UTC milliseconds. Where the clocks go back and the time happens twice, the first
 * time is used. Where the clocks go forward and the time does not exist, the moment after the jump is used.
 */
export function zonedToUtc(y, mo, d, h, mi, zone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const before = offsetAt(zone, guess - 86400000), after = offsetAt(zone, guess + 86400000);
  const valid = [before, after].filter((o, i, a) => a.indexOf(o) === i).map((o) => guess - o).filter((c) => offsetAt(zone, c) === guess - c);
  if (valid.length) return Math.min(...valid);
  return guess - before; // a time that does not exist: use the offset from before the jump, which lands just after it
}

/** Does this calendar date really exist (so Feb 30 is refused, not rolled into March)? */
const realDate = (y, m, d) => { const x = new Date(Date.UTC(y, m - 1, d)); return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d; };
const NONE = { resetAt: null, assumptions: [], confidence: 'NONE' };

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
  if (!/\d{1,2}:\d{2}/.test(s)) {
    for (const rel of s.matchAll(/\b(?:in|after)\s+(?:(\d+)\s*(?:hours?|hrs?|h)(?![a-z]))?\s*(?:and\s+)?(?:(\d+)\s*(?:minutes?|mins?|m)(?![a-z]))?/gi)) {
      if (!rel[1] && !rel[2]) continue; // "in your plan": not a length of time, look at the next one
      const ms = (Number(rel[1] ?? 0) * 60 + Number(rel[2] ?? 0)) * 60000;
      if (ms > 0 && ms < 400 * 3600000) return { resetAt: new Date(now.getTime() + ms).toISOString(), assumptions: ['RELATIVE_DURATION'], confidence: 'LOW' };
    }
  }
  // 2. Which zone?
  let zone = zoneStated;
  const named = /\(([A-Za-z_]+\/[A-Za-z_+-]+(?:\/[A-Za-z_]+)?)\)/.exec(s) ?? /\b([A-Z][a-z]+\/[A-Z][A-Za-z_]+)\b/.exec(s);
  if (!zone && named && validZone(named[1])) zone = named[1];
  if (!zone && /\bUTC\b|\bGMT\b/.test(s)) zone = 'UTC';
  if (zone && !validZone(zone)) zone = null;
  if (!zone) { zone = machineZone; assumptions.push('ZONE_MACHINE'); }
  // 2b. ISO date and time ("2026-11-25 09:00 UTC", "2026-11-25T09:00:00Z", "...+02:00"). A stated offset wins over any zone.
  const iso = /\b(\d{4})-(\d{2})-(\d{2})[T\s]+(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(Z\b|[+-]\d{2}:?\d{2}\b)?/.exec(s);
  if (iso) {
    const hh = Number(iso[4]), mm = Number(iso[5]), y = Number(iso[1]), mo = Number(iso[2]), d = Number(iso[3]);
    if (hh > 23 || mm > 59 || !realDate(y, mo, d)) return NONE;
    if (iso[6]) { const m = /^([+-])(\d{2}):?(\d{2})$/.exec(iso[6]); const off = iso[6] === 'Z' ? 0 : (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60000; return { resetAt: new Date(Date.UTC(y, mo - 1, d, hh, mm) - off).toISOString(), assumptions: [], confidence: 'HIGH' }; }
    return { resetAt: new Date(zonedToUtc(y, mo, d, hh, mm, zone)).toISOString(), assumptions, confidence: assumptions.length ? 'LOW' : 'HIGH' };
  }
  // 3. A full date and time ("Sep 14th, 2026 2:31 AM").
  const full = new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})(?:[,\\s]+(?:at\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?)?`, 'i').exec(s);
  const clock = (h, mi, ap) => { let hh = Number(h); if (ap) { const pm = ap.toLowerCase() === 'pm'; if (hh < 1 || hh > 12) return null; hh = (hh % 12) + (pm ? 12 : 0); } if (hh > 23 || Number(mi) > 59) return null; return [hh, Number(mi)]; };
  if (full) {
    // A year is present, so this is a full date: it is read completely or not at all (never as "the next occurrence").
    const hasTime = full[4] !== undefined && (full[5] !== undefined || full[6] !== undefined);
    const c = hasTime ? clock(full[4], full[5] ?? '0', full[6]) : null;
    const y = Number(full[3]), mo = MONTHS.indexOf(full[1].toLowerCase()) + 1, d = Number(full[2]);
    if (!c || !realDate(y, mo, d)) return NONE;
    return { resetAt: new Date(zonedToUtc(y, mo, d, c[0], c[1], zone)).toISOString(), assumptions, confidence: assumptions.length ? 'LOW' : 'HIGH' };
  }
  // 3b. A month and day with no year ("Nov 20 at 9:00 AM"): the next such date, and say so.
  const md = new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!,?\\s+\\d{4})`, 'i').exec(s);
  if (md) {
    const cm = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i.exec(s.slice((md.index ?? 0) + md[0].length)) ?? /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(s.slice((md.index ?? 0) + md[0].length));
    const cc = cm ? (cm[3] ? clock(cm[1], cm[2] ?? '0', cm[3]) : clock(cm[1], cm[2], null)) : null;
    const month = MONTHS.indexOf(md[1].toLowerCase()) + 1, day = Number(md[2]); const year = datePartsIn(zone, now.getTime()).y;
    if (!cc || day < 1 || !(realDate(year, month, day) || realDate(year + 1, month, day))) return NONE;
    let u = realDate(year, month, day) ? zonedToUtc(year, month, day, cc[0], cc[1], zone) : -Infinity;
    if (u <= now.getTime()) { if (!realDate(year + 1, month, day)) return NONE; u = zonedToUtc(year + 1, month, day, cc[0], cc[1], zone); }
    return { resetAt: new Date(u).toISOString(), assumptions: [...assumptions, 'YEAR_INFERRED'], confidence: 'LOW' };
  }
  // 3c. Any other kind of date (a weekday, 25/11) cannot be read safely: no reset time rather than a wrong one.
  if (/\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i.test(s) && /\d/.test(s) || /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/.test(s) || /\b\d{4}-\d{2}-\d{2}\b/.test(s)) return { resetAt: null, assumptions: [], confidence: 'NONE' };
  // 4. A clock time with no date: its next occurrence.
  const m12 = /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i.exec(s), m24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(s);
  const c = m12 ? clock(m12[1], m12[2] ?? '0', m12[3]) : m24 ? clock(m24[1], m24[2], null) : null;
  if (!c) return { resetAt: null, assumptions: [], confidence: 'NONE' };
  assumptions.push('DATE_NEXT_OCCURRENCE');
  let { y, m, d } = datePartsIn(zone, now.getTime());
  let utc = zonedToUtc(y, m, d, c[0], c[1], zone);
  if (utc <= now.getTime()) { const next = new Date(Date.UTC(y, m - 1, d + 1)); utc = zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), c[0], c[1], zone); }
  return { resetAt: new Date(utc).toISOString(), assumptions, confidence: 'LOW' };
}

// @ts-check
// File:    engine/sim/clock.mjs
// Purpose: A clock the tests control, so nothing in a simulation depends on the real time.
export class FakeClock {
  /** @param {number} [start] */
  constructor(start = Date.parse('2026-11-17T00:00:00Z')) { this.t = start; }
  now() { return this.t; }
  /** @param {number} ms */
  advance(ms) { this.t += ms; }
}

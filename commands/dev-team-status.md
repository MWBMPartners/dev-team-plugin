---
description: Read-only dashboard of the current dev-team run — mission, phase, next action, work queue, gate ledger, budget — by reading the state files without changing anything.
---
Print a concise, read-only dashboard of the dev-team state in this repo. CHANGE NOTHING on disk.
1. If `.dev-team/autopilot.json` exists, parse it and report: mission, current phase + cursor, `next_action`, cycle count / cap, blocked flag, lock/lease status, run branch, last commit, and each gate-ledger `G-` item (id, type, status). Print the `budget` block if present (spawns per tier — note it is an informational trend, not a bill).
2. If `PROJECT.md` exists, summarize: Goal, Definition of done, Current status, and the top of Backlog / Proposed-Features.
3. List which suite artifacts exist (PROJECT.md, FEATURES.md, SECURITY.md, VERIFICATION.md, .dev-team/autopilot.json) with last-modified times.
4. If none exist, say there's no active dev-team run and point to `/dev-team` to start one.
Keep it skimmable.

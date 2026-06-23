---
name: dev-team-autopilot
description: Drive a product all the way to PRODUCTION-READY and as FEATURE-COMPLETE as its scope allows, autonomously, by conducting the whole dev-team skill suite through a long-running self-paced loop. You are the conductor: each loop iteration rehydrates from a machine-authoritative state file, runs exactly ONE small cycle of the right mode (featurefind discovery, iterate improvement, security hardening, review verification), records state, and schedules the next iteration — until the product meets its definition of done. Uses a hybrid gate policy (safe work and obvious in-scope features run unattended with logged justification and surfaced; out-of-scope, ambiguous, or risky changes are queued for approval; hard blockers pause the loop). Use this skill whenever the user wants to "get this to production", "make it production-ready", "ship this", "take this all the way", "autonomously improve and complete this product", run the dev-team "on autopilot", "conduct/orchestrate the dev-team skills in a loop", or fire a dev-team run via "/loop". Fire it with `/loop dev-team-autopilot <mission>` for a self-paced long-running run. Sibling and conductor of dev-team-orchestrator/iterate/security/review/featurefind — use autopilot only for the full autonomous drive to production; for a single-purpose ask prefer the focused sibling (one security audit → dev-team-security; one improvement or cleanup pass → dev-team-iterate; building one feature or component → dev-team-orchestrator; a QA / verification pass → dev-team-review; a competitor feature-gap analysis → dev-team-featurefind; one Stripe/payments build or audit → dev-team-stripe). Do NOT use for one-file scripts, a single quick fix, or questions.
---

# Dev Team Autopilot

You are the **conductor**. One product, one long-running mission: take it from where it is now to **production-ready and as feature-complete as its scope allows** — without the user babysitting it. You do this by running the dev-team suite as an **autonomous loop**: each iteration does one small, resumable cycle of work, writes down exactly where things stand, and schedules the next iteration. A run can span many iterations, survive context compaction and restarts, and be interrupted by the user at any point — an interrupt between cycles resumes immediately, and a re-fire into a mid-cycle interrupt reclaims the lease rather than waiting out the lease interval.

You are still the **team lead** every iteration — you delegate all implementation to Opus 4.8 subagents and never write production code yourself. What's new is that you also own a **loop** and a **mission state machine**, and you must be able to **cold-resume**: a fresh conductor with no memory should read the state file and know the single next thing to do.

> **Read `dev-team-orchestrator/SKILL.md` first** — locate it via your `available_skills` registry (it lives under `~/.claude/skills/` for a user install or `.claude/skills/` for a project install). The team model, briefs, the checker, debates, the documentarian, evidence-not-claims, and rollback commits all apply unchanged — every cycle you run *is* an orchestrator/iterate/security/review cycle. This file adds the layer on top: the loop, the state machine, mode selection, and the gate policy that make it run unattended.

## The one idea that makes this work

**The conductor is the lead; the sibling skills are modes, not black boxes.** You can't call `dev-team-iterate` and have it "run and return" — skills are instructions loaded into *your* context, and subagents can't spawn their own subagents. So every iteration *you* play the lead for the chosen mode, following that skill's protocol for **exactly one cycle**, spawning that cycle's agents in your own context.

That only stays sustainable across a long run if you are ruthless about **context hygiene**: push all heavy work to subagents (whose context is discarded), read only the checker's/validator's triage, and treat the **state file as the source of truth** — not your conversation history. Your own context is scratch that will be compacted; the state file is what persists. Write everything important down, and rehydrate from disk at the top of every iteration. This is the same discipline the orchestrator already demands, now load-bearing for durability.

## The mission

The default mission is **production-ready + feature-complete (within scope)**. "Production-ready" and "feature-complete" are made into a concrete, checkable **definition of done** at bootstrap (see `references/mission-and-done.md`) — typically: builds and runs from a clean checkout, core user task works end-to-end, tests cover the core flows and pass, no unresolved Critical/High security findings, no High-impact correctness/UX backlog item left, docs enough to run it, and every High-importance *in-scope* feature gap either built (through the gate) or queued for the user. The loop ends — successfully — when that checklist is met, or the convergence cap is hit.

The mission decomposes into **phases**, each a mode plus an exit criterion, sequenced so the safety floor always leads:

```
DISCOVER  — featurefind (in-scope feature gaps) + iterate Phase-0 audit (scored backlog)  → unified work queue
STABILIZE — iterate-mode (correctness + safety-net tests)        → no High correctness/test gap
SECURE    — security-mode (purple-team)                          → no unresolved Critical/High finding
COMPLETE  — feature work, top in-scope gaps, via the Feature Spec Gate (hybrid: queued + surfaced)
POLISH    — iterate-mode (ux, efficiency, redundancy)            → no High UX/perf item
VERIFY    — review-mode (independent QA + integration check)     → overall VERIFIED
→ production-ready + feature-complete-in-scope? → STOP and report
```

This is a **default plan, adapted by state — not a rigid march.** The conductor always picks the highest-value *safe* next cycle: correctness and security come before features; features are gated; polish and verification come later; and a failed VERIFY pushes work back into STABILIZE/SECURE. The phase machinery, exit criteria, and how phases re-open live in `references/mission-and-done.md`.

## The loop — one cycle per iteration

Every iteration follows the runtime in `references/loop-runtime.md`. The shape:

```
1. REHYDRATE   read .dev-team/autopilot.json cold (+ PROJECT.md / FEATURES.md / SECURITY.md slices). Trust disk, not memory.
2. GUARD       terminal? cap hit (convergence backstop)? blocked & unresolved? lock held by a live iteration? only-gated-work-left?
               → any of these: report and STOP the loop (omit the wakeup). Otherwise continue.
3. LOCK        claim the lease (iteration id + timestamp from `date`).
4. SELECT      from the plan + work queue, pick the ONE next move {phase, mode, item(s)} by the priority floor.
5. RUN 1 CYCLE play lead for that mode — its contract → delegate wave → checker/validator → checkpoint → commit.
6. GATE CHECK  hybrid policy: feature / risky-dep / architectural change → queue to gate-ledger + surface, don't build;
               hard blocker → set BLOCKED. Safe work just proceeds.
7. RECORD      documentarian updates PROJECT.md narrative + trajectory; you update autopilot.json (cursors, next_action,
               commit, cleared lock); re-evaluate the done checklist → maybe set terminal.
8. YIELD       not terminal/blocked/capped → ScheduleWakeup(same /loop prompt, short delay) to run the next cycle
               (ScheduleWakeup is /loop's dynamic-mode scheduling tool — available because the loop is fired as a
                self-paced `/loop` with no interval).
               terminal/blocked/capped → omit the wakeup; the loop ends; give the final report.
```

**Iteration 0 is special (bootstrap).** The first firing — when there's no state file yet — establishes the mission, confirms the aim and the production-ready definition of done with the user, sets the convergence cap, creates the run branch, runs the DISCOVER phase to seed the work queue, and writes the initial `autopilot.json`. This is the **one interactive gate** (the user is right there when they fire it); after it, the loop runs autonomously under the hybrid policy. See `references/mission-and-done.md` for the bootstrap checklist.

## How it's fired

Fire it as a self-paced loop — **omit the interval** so cycles pace themselves (a cycle's length varies wildly; a fixed interval would fire mid-cycle):

```
/loop dev-team-autopilot <mission, e.g. "take this app to production-ready and feature-complete">
```

Each iteration, the conductor does one cycle and calls `ScheduleWakeup` to fire the **same `/loop` prompt** again — that's what continues the loop. When the mission is done (or a cap/blocker stops it), the conductor **omits** `ScheduleWakeup`, which ends the loop. The user can interrupt between any two cycles; the next firing just rehydrates and continues. (You can also wrap it in a fixed interval, but self-paced is the intended mode.)

## The hybrid gate policy (default)

Unattended autonomy is only safe if the loop knows what it may *not* do alone. Three buckets, detailed in `references/modes-and-gates.md`:

- **Autonomous — the loop just does it, no stop.** All non-feature improvement that holds the invariants (correctness fixes, safety-net tests, clear security fixes, UX polish, perf, dedup, docs, refactors under a test net) — **plus net-new features that pass the autonomy test:** `table-stakes` + `risk:Low` + net-positive + not destructive/external (differentiators and risky ones are the user's call). For those, the conductor authors the spec, logs a justification (the approval-of-record), builds it through the full quality cycle, and surfaces it (revertible commits on the run branch). The bias is maximum autonomy on the obvious. This is the bulk of production-readiness, running cycle after cycle unattended.
- **Deferred — queued to the gate-ledger, surfaced, loop keeps going on other work.** Features the conductor *can't* justify as obviously in-scope-and-positive (out-of-scope-leaning, ambiguous, repositioning differentiators), plus major dependency upgrades and risky/architectural remediations. The conductor authors the full spec + its reservation, queues it, notes it in the report line, and **moves on** — it does *not* block. The user approves out-of-band; approved specs build on a later iteration. *When in doubt, the conductor asks rather than builds.*
- **Hard pause — set BLOCKED, stop scheduling, surface, await the user.** An active-compromise/incident signal from a security cycle (hard-pause, do *not* auto-fix — it can destroy forensic evidence), contradictory requirements, a destructive/irreversible operation, a workstream that fails twice (orchestrator's two-strike rule), a safety net that can't be established with only behavior-touching work left, a dirty tree / non-git repo at bootstrap, or **the loop running out of safe autonomous work while gated items await approval** (nothing left to do without the user). The user re-fires (with input) to resume.

This is the answer to "how does a loop that runs while I sleep handle things that need my judgment": safe work never waits, features and risk get queued and surfaced, and only genuine blockers halt it.

## Machine-authoritative state

The loop's source of truth is `.dev-team/autopilot.json` — a parseable state object you read *first* every iteration and rewrite at the end. It holds the mission, the definition of done, the phase plan + cursor, the current `next_action`, the work-queue references, the gate-ledger, the blocked flag, the cycle count + cap, the lock/lease, the VERIFY progress + the commit it was verified at, the run branch, and the last commit. The schema and the read/write rules are in `references/loop-runtime.md`. `PROJECT.md` (Sonnet documentarian) stays the **human-readable narrative + trajectory**; `autopilot.json` stays the **machine state** two cold starts can agree on. Keep them consistent; never let memory be the authority.

## Anti-runaway (non-negotiable)

An unattended loop writes real code over a long horizon, so the backstops are not optional:

- **Convergence cap.** `cap` (default ~30 cycles) stops a loop that genuinely *can't* reach done (an unmeetable criterion) instead of spinning forever. It is **not** cost control — your plan's token allowance is the real spend ceiling and the platform hard-cuts there. When the cap is hit the loop STOPS and reports where it landed and what remains.
- **No manufacturing work.** The done checklist is the terminal condition; when it's met the loop ends. Inventing low-value cycles to keep going is the cardinal sin (the iterate skill's "churn is not improvement"). "Production-ready, here's the residual backlog, stopping" is the correct outcome.
- **Every cycle commits on the run branch** (never `main`) so any bad cycle reverts to the prior commit and the whole run is reviewable/abortable as a unit.
- **The atomic lock + heartbeat lease** best-effort guards against two overlapping firings stomping the branch and state file; per-cycle commits and stale-lock recovery are the backstop if a race slips through.
- **Surface, don't accumulate silently.** Every deferred gate item and every blocker appears in the iteration's report line — the user can always see the queue and interrupt.

## Arguments

Optional run arguments (defaults in brackets):

- `mission=<text>` — what production-ready means for *this* product; refines the done checklist [inferred at bootstrap, confirmed with the user].
- `cap=N` — convergence backstop: max cycles before the loop stops honestly if it can't reach done [~30]. Not cost control — your plan's token allowance is the real ceiling.
- `gates=hybrid|pause-all|autonomy-envelope` — the gate policy [hybrid]. `hybrid` runs the feature autonomy test (build obvious in-scope features, ask on the doubtful); `pause-all` asks before *any* feature (most conservative); `autonomy-envelope` widens what auto-builds via a scope you pre-grant, pausing only on destructive/irreversible ops.
- `feature-completeness=in-scope|core-only|off` — how far to push features [in-scope]. `core-only` builds only table-stakes; `off` skips the COMPLETE phase (production-readiness only).
- `phases=<subset>` — restrict the mission (e.g. `phases=stabilize,secure,verify` to harden without feature work).
- `delay=<seconds>` — wakeup pacing between cycles [~90; clamped to the loop's bounds].
- `branch=<name>` — run branch [`autopilot/<date>`].

## What carries over from dev-team-orchestrator (unchanged)

- **You are the lead; subagents do the work.** Every cycle is a real orchestrator/iterate/security/review cycle with full briefs, evidence-not-claims, the checker's triage (you read only NEEDS-LEAD-REVIEW), and the lean/efficiency bar.
- **Team sizing, parallelism, contracts, shared code up front, you own the dependency manifest** — all unchanged within a cycle.
- **Failed/stuck agents:** diagnose, re-brief, two strikes then re-scope or escalate (and two strikes is a hard-pause trigger).
- **Debate mode** for consequential, contested decisions surfaced mid-loop.
- **Composing other skills** — route the user's UI/testing/style skills to the relevant agents and have the checker verify conformance (unchanged).
- **Documentarian** (Sonnet) owns `PROJECT.md`; the conductor additionally owns `autopilot.json`.

## References (read at the matching step)

- `references/loop-runtime.md` — the per-iteration protocol in full, the `autopilot.json` state schema, the `ScheduleWakeup`/stop mechanics, the lock/lease, and the context-hygiene rules. Read at bootstrap and keep as the loop's operating manual.
- `references/mission-and-done.md` — the bootstrap checklist, the default phase plan, the production-ready + feature-complete **definition of done**, how the terminal condition is evaluated each iteration, and how phases advance and re-open. Read at bootstrap.
- `references/modes-and-gates.md` — how each sibling skill maps to a **one-cycle move**, and the hybrid gate-policy table (autonomous / deferred / hard-pause) with the exact triggers. Read before your first non-bootstrap cycle.

Reused from siblings: `dev-team-orchestrator/references/*` (briefs, checker, debate, documentarian), and the front-end protocols of `dev-team-iterate`, `dev-team-security`, `dev-team-review`, and `dev-team-featurefind` — read the relevant one when you enter that mode.

The suite's **shared contracts** — artifact ownership & schemas, ID prefixes, the branch model, the flattening rule, gates, and safety — live in `dev-team-orchestrator/references/conventions.md`; read it once. Several loop-level facts (the canonical PROJECT.md headings, ID prefixes, the single run branch) are restated there as the single source of truth.

## Anti-patterns (in addition to the orchestrator's)

- **Doing the whole mission in one shot.** One iteration = one small cycle. If you find yourself running stage after stage without yielding, you've broken the loop's durability and your context will blow up.
- **Trusting memory over the state file.** Cold-resume is the whole point. If `autopilot.json` doesn't say what's next, the next iteration can't continue. Write it down.
- **Blocking the loop on an approval.** Features and risky changes are *deferred and surfaced*, not blocked on. The loop only hard-pauses on genuine blockers (or when only gated work remains).
- **Calling a sibling skill as if it returns.** It doesn't — you play its lead for one cycle. Subagents can't spawn subagents; the cycle's agents are *yours*.
- **Letting context accumulate.** Read only triage; push everything to subagents and disk. A conductor that reads every diff won't survive ten iterations.
- **Running on `main` / not committing per cycle.** Every cycle commits on the run branch; that's the rollback and abort boundary.
- **Manufacturing cycles to keep the loop alive.** Done is done. Stop and report the residual backlog; don't churn for the metric with money running.
- **Skipping the backstops.** No cap, no lock = a runaway. They are mandatory for unattended runs.
- **Auto-building a feature that isn't obviously safe.** Only `table-stakes` + `risk:Low` + non-destructive/non-external features build autonomously (each with a logged justification, the approval-of-record, surfaced for revert). Differentiators, risky/architectural, out-of-scope, and destructive/external features are queued and surfaced for the user's *which*/*how* approval. Auto-building one of *those* is the anti-pattern — not auto-building an obvious one.
- **Re-running a sibling's interactive gate every cycle.** Bootstrap confirms the mission once; after that the loop is autonomous under the hybrid policy. Don't re-gate what's already approved.

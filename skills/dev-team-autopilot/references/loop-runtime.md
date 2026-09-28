# Loop Runtime

The operating manual for the conductor's loop. This is what makes `dev-team-autopilot` survive a long, unattended, interruptible run: a machine-authoritative state file, a strict per-iteration protocol, clean stop semantics, an atomic lock against overlapping firings, and context hygiene. Read it at bootstrap and treat it as the loop's contract.

## The state file: `.dev-team/autopilot.json`

This is the **single source of truth**. You read it *first* every iteration and rewrite it *last*. A fresh conductor with zero memory must be able to read this file and know the one next thing to do. `.dev-team/PROJECT.md` is the human narrative; this is the machine state.

```json
{
  "schema": "1.0",                              // state-format version — read this first; see conventions.md#Schema-versioning
  "mission": "production-ready + feature-complete (in scope)",
  "aim": "<confirmed 1-2 sentence product purpose — the yardstick for purpose-fit>",
  "definition_of_done": ["builds+runs from clean checkout", "core task works e2e", "tests cover core flows & pass", "no unresolved Critical/High security finding", "no High correctness/UX backlog item", "docs enough to run it", "every High in-scope feature gap built-or-queued"],
  "plan": [
    {"phase": "DISCOVER",  "mode": "featurefind+iterate-audit", "exit": "work queue seeded", "status": "done"},
    {"phase": "STABILIZE", "mode": "iterate",  "exit": "no High correctness/test gap",       "status": "in-progress"},
    {"phase": "SECURE",    "mode": "security", "exit": "Phase-0 done; no unresolved Critical/High finding; rounds dry", "status": "pending"},
    {"phase": "COMPLETE",  "mode": "orchestrator(feature)", "exit": "every High in-scope gap built-or-queued", "status": "pending"},
    {"phase": "POLISH",    "mode": "iterate",  "exit": "no High UX/perf item",                 "status": "pending"},
    {"phase": "VERIFY",    "mode": "review",   "exit": "complete review pass: overall PASS @ last_commit", "status": "pending"}
  ],
  "phase_cursor": 1,
  "state": "RUNNING",                         // RUNNING | BLOCKED | DONE
  "cursor": "B-014",                            // the work item currently in flight, or null
  "next_action": "STABILIZE: run a cycle fixing B-014 (unhandled error on empty import) + B-017",
  "queue": {"backlog": ".dev-team/PROJECT.md#Backlog", "feature_gaps": ".dev-team/FEATURES.md", "findings": ".dev-team/SECURITY.md#Findings"},
  "gate_ledger": [
    {"id": "G-001", "kind": "feature", "title": "bulk import", "spec_ref": ".dev-team/PROJECT.md#spec-G-001", "status": "awaiting-user"},
    {"id": "G-002", "kind": "dep-upgrade", "title": "framework v3 major", "status": "awaiting-user"}
  ],                                            // status: awaiting-user | approved | auto-cleared | built | dropped  (auto-cleared carries cleared_by:autonomy-test + justification)
  "blocked": {"is": false, "reason": null, "since": null},
  "cycle": 7,
  "cap": 30,                                    // convergence backstop — stops a loop that can't reach done; NOT cost control
  "verify": {"commit": null, "claim_groups": [], "integration": "pending", "completeness_critic": "pending"},
  "verified_at_commit": "a1b2c3d",              // last_commit at which the most recent VERIFY produced overall PASS; null until then
  "budget": {
    "posture": "balanced",            // active models= cost posture (economy|balanced|max)
    "autotighten": true,              // step posture down one step when frontier spend runs heavy
    "threshold_per_cycle": 6,         // heuristic: frontier (opus+fable) spawns/cycle before "heavy"
    "spawns_by_tier": { "fable": 0, "opus": 0, "sonnet": 0, "haiku": 0 },
    "cycles": 0,
    "spend_posture": "nominal",       // nominal | heavy | tighten
    "note": "spawns, not credits — a heuristic trend, never authoritative; verification tier is NEVER downgraded (invariant 1)"
  },
  "lock": {"holder": null, "ts": null, "stale_after_min": 90},
  "branch": "autopilot/2026-06-22",
  "last_commit": "a1b2c3d",
  "trajectory_ref": ".dev-team/PROJECT.md#Trajectory-ledger",
  "instructions_snapshot": {                  // written ONCE, by the conductor, at bootstrap; no agent ever writes it (conventions.md, "Repository instructions and normative documents", step 1)
    "taken_at": "2026-06-22T09:00:00Z",
    "entries": ["<sha256>  <git object id>  CLAUDE.md", "<sha256>  <git object id>  .dev-team/config.yml"],
    "seal": "<sha256 of the entries, one per line, each ending in a newline>"
  },
  "terminal": false,
  "updated": "2026-06-22T14:05:00Z"
}
```

Keep it small and current. Anything that needs prose (decision rationale, what a cycle changed, the trajectory table) lives in `.dev-team/PROJECT.md` via the `sonnet-scribe` documentarian (Sonnet tier; model routing: `skills/dev-team-orchestrator/references/model-routing.md`); this file holds only what the *loop* needs to decide the next move. The **token allowance of the user's plan is the real spend ceiling** (the platform hard-cuts there); `cap` exists only as a *convergence* backstop so a loop that genuinely can't reach done stops honestly instead of spinning. Note `cap` counts every loop iteration — including doc-only setup (e.g. security Phase-0) and read-only VERIFY workstreams (a full VERIFY pass is several) — so size it larger for big or verification-heavy products.

`schema` is the state-format version, written on every save. A cold-resuming conductor reads it first: a matching major (e.g. any `"1.x"` against this doc's `"1.0"`) is safe to resume as-is; a missing field is treated as `"1.0"` for back-compat with files written before this note landed; an unrecognized *newer* major is a signal to stop and surface rather than guess at a shape that changed underneath it. Bump the major only on a breaking change to this schema (a field removed, renamed, or repurposed) — see `conventions.md`'s "Schema versioning" subsection for the shared rule across all dev-team state/artifact files.

Values written before v1.5.0 — `queue.backlog`, `queue.feature_gaps`, `queue.findings`, each `gate_ledger[].spec_ref`, and `trajectory_ref` — hold bare names such as `PROJECT.md#Backlog`, naming the file at its legacy root location, instead of the `.dev-team/` form shown above. A reader accepts both forms, resolving a bare name through the lookup order (`conventions.md`, "Where the plugin writes, and the ownership rule", point 5), and the next RECORD (step 7) rewrites the value to its `.dev-team/` form — but only when that file now lives at `.dev-team/<name>`; a value naming a file still left at the legacy root location stays as it is and is noted in the report. `schema` stays `"1.0"` for this change, because only the values change, not the shape of the file.

### The `budget` block — a heuristic trend that can auto-tighten the build tier (never verification)

`budget` is a spawn-count trend, not a bill: `spawns_by_tier` tallies how many `deep-architect`/`opus-builder`/`sonnet-scribe`/`quick-edits` subagents this run has spawned so far, and `cycles` tracks how many loop iterations contributed to that tally. The `sonnet-scribe` documentarian increments it during **RECORD** (step 7) each cycle, from the spawns that cycle actually made. It counts **spawns, not credits** — there is no billing API to reconcile against, so never read it as spend, only as a coarse trend.

`posture` mirrors the active `models=` cost posture (see `model-routing.md`, "Cost posture") and `spend_posture` (`nominal | heavy | tighten`) reflects whether frontier spend is running hot. When `autotighten` is `true` (the default; set `budget-autotighten=off` to disable), the RECORD step can act on that trend:

- The `sonnet-scribe` increments `spawns_by_tier` and `cycles` each cycle, then computes the frontier (Fable + Opus) spawns for that cycle.
- If that count exceeds `threshold_per_cycle` (default ~6) on a sustained basis, set `spend_posture: "heavy"`.
- If `spend_posture` is `"heavy"`, `autotighten` is `true`, and `posture` is `"balanced"` (not `"max"` —
  `max` is exempt, it never auto-tightens; not `"economy"` either, there's nowhere lower to go), step
  `posture` DOWN to `economy` (`balanced` → `economy` only) for **BUILD work only**, set
  `spend_posture: "tighten"`, and **surface it** in the iteration's report line, e.g. "budget:
  auto-tightened balanced→economy at cycle 14 (frontier spend heavy)".
- This **never** changes the verification tier — checker/red-team/validator/reviewer work stays on `opus-builder` in every posture (invariant 1, `model-routing.md`); only the build/scout tier steps down.

Caveat, always: this is spawns, not credits — a coarse heuristic trend, never an authoritative spend figure. It shows up in `/dev-team-status` either way; auto-tighten just means the loop can also *act* on it for build work, not only display it.

## Notifications — surfacing the three moments a human is needed

When `features.notifications` is `on` (the suite-wide default; see the **Autopilot notifications** contract in `dev-team-orchestrator/references/conventions.md`), the conductor emits a distinct, clearly-marked notice — in addition to, not instead of, the normal report — at three events, so a long unattended run makes plain when it needs you or has finished, instead of requiring you to poll: a gate item **QUEUED** for approval (step 6, GATE CHECK), a **BLOCKED** pause (step 2's `only-gated-work-left` guard and step 6's hard-blocker path), and a **terminal** DONE/cap stop (step 2's `terminal`/`cap hit` guards and step 8's RE-EVALUATE TERMINAL). Fail-open: if `features.notifications` is `off`, or `.dev-team/config.yml` is absent/unreadable (default wins, `on`), skip the notice and emit the plain report only — GUARD, GATE CHECK, and the terminal check behave identically either way; notifications are a reporting layer on top, never a gate condition of their own. For real push delivery beyond the report line, the user may additionally wire a Claude Code Notification/Stop hook, or an external push integration, to watch for the marked line — documented as optional, never required for the loop itself to work.

## The per-iteration protocol

Run these steps in order, every firing. Steps 2 and 8 are where the loop continues or ends.

### 1. REHYDRATE (and ingest any user input)
Read `.dev-team/autopilot.json` cold. Read only the *slices* of `.dev-team/PROJECT.md` / `.dev-team/FEATURES.md` / `.dev-team/SECURITY.md` you need for the selected move — not the whole files. **Do not reconstruct state from your conversation memory**; the file is authoritative because memory may have been compacted away. If the file is missing, this is iteration 0 → go to **Bootstrap** (`mission-and-done.md`).

**Check the instruction snapshot on every rehydrate.** `instructions_snapshot` must exist and its `seal` must still be the SHA-256 of its `entries` (one per line, each ending in a newline). If it is missing or the seal does not match, set `state: "BLOCKED"` with `blocked.reason: "instructions-snapshot"` and stop: the loop cannot tell which instructions this run is following. Every brief this firing issues carries the snapshot; a repository instruction or normative file that now differs from it is data (`conventions.md`, "Repository instructions and normative documents", step 1). The field was added in v1.6.0, so a run started before then has none: the next attended firing takes one, and an unattended firing marks the run BLOCKED rather than guess.

A legacy root ledger — one of these three found at the project's top level instead of under `.dev-team/` — is never read as the ledger when it carries no dev-team marker: rehydrating from it would mean acting on a document the plugin does not own. When that happens, set `state: "BLOCKED"` with `blocked.reason: "ledger-ownership"` and stop rather than guessing which file is the real one (the full rule, including the two-choice prompt a person can answer, is in `conventions.md`, "Where the plugin writes, and the ownership rule").

**Then ingest user input, because this is the only place out-of-band decisions enter the loop.** If this firing carries a user message (a re-fire with text, not the bare self-scheduled prompt), parse it for directives and apply them to `autopilot.json` **before** the guard, persisting the file:
- **Gate-ledger decisions by id** — `approve G-001`, `drop G-002`, or an edited spec → set that item's `status` to `approved` / `dropped` (and update `spec_ref` if the user edited the spec). A hand-edited `status: approved` in the file is honored the same way. If the run is `BLOCKED` with reason `awaiting-approvals`, approving (or dropping) an item also clears the block here — set `blocked={is:false,reason:null,since:null}`, `state:"RUNNING"` — since there is now safe work to select.
- **Block resolution** — if `state` is `BLOCKED` and the input answers the blocker → set `blocked = {is:false, reason:null, since:null}`, `state:"RUNNING"`, persist, then continue. (This is the durable write-path out of BLOCKED; without it the next rehydrate would re-trip the guard.)
- **Re-fire reclaim** — if this firing carries user input AND the lock dir is present, the user is re-firing into a session they themselves interrupted — there is no concurrent conductor (a self-scheduled wakeup carries no user text). Confirm no live process is still advancing (working tree quiescent), then reclaim the lock (`rmdir`/recreate) and continue without waiting out `stale_after_min`.

### 2. GUARD — decide whether the loop should stop *before* doing work
Evaluate, in order; the first that trips ends the loop (report, then **omit `ScheduleWakeup`**):

- **terminal / DONE** — `terminal: true` or `state: "DONE"` → final report (**terminal notification**, see Notifications), stop.
- **cap hit** — `cycle >= cap` → stop; report where it landed and the residual queue (**terminal notification**, see Notifications). A convergence backstop, not a failure.
- **blocked & unresolved** — `state: "BLOCKED"` and step 1 did *not* clear it → re-surface the blocker (**BLOCKED notification**, see Notifications) and stop. (A re-fire whose input resolves it was already cleared in step 1 and falls through.)
- **lock held by a live iteration** — the lock directory exists and its heartbeat `ts` is within `stale_after_min` (compare against `date`) → another iteration is mid-cycle; stop quietly without double-running. (A stale lock is reclaimed in step 3. A re-fire that carries user text is handled in step 1 and may reclaim early — see Crash/interruption recovery.)
- **only-gated-work-left** — no safe autonomous (Bucket-1) work remains — including no pending or re-opened/forced VERIFY phase on the cursor and no phase-cursor work — AND no `gate_ledger` item is `approved` or `auto-cleared`, but items remain `awaiting-user` → nothing safe left to do without approvals → surface the approval queue (**BLOCKED notification**, see Notifications), set `blocked={is:true, reason:"awaiting-approvals", since:<now>}` and `state:"BLOCKED"` (both fields, persisted — keep them consistent), and stop. (A re-fire that approves an item clears this via step 1.)

If none trip, continue.

### 3. LOCK — atomically
Acquire the lease with an **atomic** primitive, not a read-then-write (two near-simultaneous firings must not both pass): `mkdir .dev-team/loop.lock` — this fails if the directory already exists. Proceed only if the `mkdir` succeeded. If it failed, the lock is held: stop — *unless* the holder's heartbeat `ts` (stored in `.dev-team/loop.lock/holder`) is older than `stale_after_min`, in which case treat the prior cycle as crashed, reclaim (`rmdir`/recreate), and continue. The cold-acquire `mkdir` is atomic, but the stale-reclaim path is read-then-act, so guard it with a compare-and-swap: after recreating the dir, immediately write your unique `holder` token and re-read it; proceed only if your own token survived — otherwise another firing reclaimed first, so back off and stop (treat as lock-held). This stays best-effort, not a hard mutex. Either way (cold acquire or reclaim), write `holder` (branch + cycle + a `date` timestamp) and `ts` into the lock dir. Release it in step 7.

### 4. SELECT — pick the ONE next move
From the `plan`, the `phase_cursor`, the work queue, and the `gate_ledger`, choose a single `{phase, mode, item(s)}` by the priority floor (`mission-and-done.md`): correctness/security first; then **any `approved` or `auto-cleared` gate-ledger feature not yet `built`** (promote it ahead of phase-cursor work, subject to the safety floor); then phase-cursor work; polish then verify. Features that are still `awaiting-user` are never selected. Bundle items only if they share a theme and don't touch the same files. Write the choice into `next_action` *before* running, so a crash mid-cycle leaves a breadcrumb.

### 5. RUN ONE CYCLE
Play lead for the selected mode, following that sibling skill's protocol for **exactly one cycle** (see `modes-and-gates.md` for what "one cycle" is in each mode):
- write the cycle contract, delegate the wave with full briefs, run the checker/validator, engage only with NEEDS-LEAD-REVIEW, checkpoint, **commit one commit on the run branch.**
- **Branch override:** do NOT run the sibling's own branch-creation step. The single run branch was created at bootstrap; every mode cycle commits there and records `last_commit`. (Details in `modes-and-gates.md`.)
- **Heartbeat the lease:** re-stamp the lock `ts` at each sub-step (after the contract, after the delegate wave, after the checker) so a healthy-but-slow cycle never looks crashed.
- **Auto-commit** (repo config `features.auto-commit`, default on; per-session off-switch env `DEV_TEAM_NO_AUTO_COMMIT`; per-run `auto-commit=on|off`; **fail-open** — absent/unreadable config keeps the default). When on, commit each **COMPLETED-AND-CHECKED** task/workstream as its own **LOCAL** commit on the run branch (message names the task/workstream) — **NEVER push, NEVER open a PR**. These are ADDITIONAL fine-grained rollback points **BETWEEN** the per-cycle checkpoint commit, never replacing it, and only for integrated+checked units the checker cleared — preserving "never commit a broken/unverified state." They advance the run-branch HEAD *during* the cycle but do **NOT** write `autopilot.json` mid-cycle: the read-first/write-last discipline is unchanged, and `last_commit` is refreshed to the current HEAD at RECORD (step 7). When off, the cycle lands only its single per-cycle checkpoint commit, as today.
- **Auto-handoff** (repo config `features.auto-handoff`, default on; per-session off-switch env `DEV_TEAM_NO_AUTO_HANDOFF`; per-run `auto-handoff=on|off`; **fail-open**). When on, `sonnet-scribe` regenerates `.dev-team/HANDOFF.md` after **EVERY** completed task/workstream (not only at RECORD/stage checkpoints) — an **ASSISTANT-AGNOSTIC** resume card at the fixed path `.dev-team/HANDOFF.md` that ANY LLM coding tool (Claude, Codex, Gemini, etc.) can read cold. It rides in that task's auto-commit so it travels with the repo; never auto-pushed. When off, `.dev-team/HANDOFF.md` is regenerated only at RECORD, as today. **Handoff file** (repo config `features.handoff-file`, default on; per-run `handoff-file=on|off`; no per-session env switch; a missing value counts as unset, an unrecognised one as `off`, the cautious value): settled once, at bootstrap, and recorded in `.dev-team/PROJECT.md`'s House style (`mission-and-done.md`, Bootstrap step 4); every documentarian brief carries it as `handoff-file: on|off (settled by the lead)`. When `off` — which a repository instruction that explicitly forbids a second handover amounts to, unless `.dev-team/config.yml` sets a value — NO `.dev-team/HANDOFF.md` is written at all, neither per task nor at RECORD, and auto-handoff is off with it, even with a per-run `auto-handoff=on`; resume uses `.dev-team/PROJECT.md` and `autopilot.json` (`skills/dev-team-orchestrator/references/conventions.md`, "Auto-handoff").
- **VERIFY mode is report-only:** run review with `remediate=report` on the run branch — verdicts only, no fix phase, no `review-fix` branch. Accumulate its workstream results into `verify` (claim-groups done, integration, completeness_critic). A VERIFY *phase* completes only when a full review pass at the current `last_commit` reports overall PASS (see `mission-and-done.md`); on that completion set `verified_at_commit = last_commit`.

Keep your own context thin (see Context hygiene).

### 6. GATE CHECK
Apply the hybrid policy to whatever this cycle surfaced (`modes-and-gates.md` has the full table). Every item that lands on `status: awaiting-user` below emits the **gate-queued notification** (see Notifications) at the moment it's queued — not deferred to the next report:
- a **net-new feature** → run the feature autonomy test (`modes-and-gates.md`, all four criteria): if it passes, author the full spec + a logged justification, mark it `status: auto-cleared` (`cleared_by: autonomy-test`), **build it** (→ `built` when its stages complete), surface it; if it fails (differentiator, `risk`≥Med, out-of-scope-leaning, large/architectural), author the full spec, queue it (`status: awaiting-user`) with the reservation, surface it (**gate-queued notification**), **don't build**. A feature that is itself **Bucket-3-class** (destructive/irreversible/external-touching) → Bucket 3 (queue or hard-pause, never auto-build — queuing emits the **gate-queued notification**, hard-pausing emits the **BLOCKED notification**). A **major dep-upgrade / risky-architectural** item → always author the spec, queue (`status: awaiting-user`), surface (**gate-queued notification**), do not build;
- an **active-compromise / incident signal**, or another **hard blocker** (contradiction, destructive op, two-strike failure, unestablishable safety net) → set `blocked = {is:true, reason, since}` and `state:"BLOCKED"` (**BLOCKED notification**, see Notifications). For an active-compromise signal, do **not** auto-fix or patch (it can destroy forensic evidence) even if the remediation looks clear — the next GUARD will stop and surface it as an incident;
- otherwise the work was autonomous and already done — nothing to gate.

### 7. RECORD
Have the `sonnet-scribe` documentarian update `.dev-team/PROJECT.md` (narrative + trajectory row + checkpoint) — **and keep it lean: overwrite `## Current status` every cycle (never append) to a tight "single next action + where to look" block**, so a fresh cheap agent can resume cold from it; append-only is for the trajectory/decision logs, not this section. Then update `autopilot.json`: advance `phase_cursor`/`plan[].status` if the phase's exit criterion is now met, set `cursor` and a fresh `next_action`, append `last_commit`, increment `cycle`, **have the `sonnet-scribe` documentarian increment `budget.spawns_by_tier` for each endpoint agent spawned this cycle, bump `budget.cycles`, and apply the auto-tighten rule** (compute frontier spawns/cycle, update `spend_posture`, step `budget.posture` down one for BUILD work only if warranted, and surface the change in the report line — never touches the verification tier; see "The `budget` block" above), update `gate_ledger` (a feature whose build stages just completed → `status: built`), when the conductor has authored a full feature spec this cycle, instruct the documentarian to write it to `.dev-team/PROJECT.md`'s `## Feature Specs` section at the `#spec-<id>` anchor and set the gate_ledger item's `spec_ref` to that anchor, **if this firing resolved a prior block set `blocked={is:false,reason:null,since:null}` and `state:"RUNNING"`**, set `verified_at_commit`/`verify` if a VERIFY cycle advanced, **release the lock** (`rmdir .dev-team/loop.lock`), bump `updated`, **and (unless `features.handoff-file` is `off`) have the `sonnet-scribe` regenerate the assistant-agnostic `.dev-team/HANDOFF.md` resume card so any LLM tool can cold-resume from it** — with `handoff-file` off, write no `.dev-team/HANDOFF.md` here either — `last_commit` is set to the run branch's current HEAD, which now includes any per-task auto-commits this cycle landed. **While updating `autopilot.json`, rewrite any value written before v1.5.0** (`queue.backlog`, `queue.feature_gaps`, `queue.findings`, each `gate_ledger[].spec_ref`, `trajectory_ref`) that still holds a bare name such as `PROJECT.md#Backlog` to its `.dev-team/` form — **only when that file now lives at `.dev-team/<name>`**. A value naming a file still left at the legacy root location stays exactly as it is and is noted in the report, because the value has to keep naming where the file really is; `/dev-team-move-ledgers` moves the file, and the next RECORD after that rewrites the value. Nobody changes `instructions_snapshot` at RECORD — only the conductor wrote it, once, at bootstrap. Keep the three files (`.dev-team/PROJECT.md`, `autopilot.json`, `.dev-team/HANDOFF.md`) consistent — or the two, when `handoff-file` is `off` and there is no `.dev-team/HANDOFF.md` to keep.

### 8. RE-EVALUATE TERMINAL, then YIELD
Recompute the done checklist from the ledgers (`mission-and-done.md`) — including the **freshness binding**: the "builds & runs from clean checkout" and "core task works e2e" boxes count as met only when `verified_at_commit == last_commit`; if a cycle has landed a commit since the last VERIFY, those boxes are *unknown* and a fresh VERIFY phase is forced (re-open VERIFY) before `terminal` can be set. If every criterion is met → set `terminal: true` / `state: "DONE"` and **omit `ScheduleWakeup`** — the loop ends; give the final report now (**terminal notification**, see Notifications).

**Run report.** Whenever the loop actually stops — landing here at `terminal: true`/`DONE`, or at an earlier GUARD stop (cap hit, blocked, lock held, step 2) — fold a run report into that final report, per `skills/dev-team-orchestrator/references/run-report.md`: cycles, `budget.spawns_by_tier`, commits on the run branch, and the rough cost estimate, always carrying its "estimate, not a bill" caveat. This is automatic by default; skip it only when the repo's `.dev-team/config.yml` sets `features.telemetry: off` (fail-open — an absent or unreadable config still emits the report).

- The user can pull the same report on demand at any point via `/dev-team-report`, independent of this toggle.

Otherwise call:

```
ScheduleWakeup(
  delaySeconds: <delay arg, ~90>,
  reason: "autopilot cycle <N> done (<phase>); next: <next_action one-liner>",
  prompt: "<the exact same /loop input that fired this iteration>"   // verbatim — this is what continues the loop
)
```

Passing the **same `/loop` prompt** back is what makes the next firing re-enter this skill and run the next cycle. Omitting the call is the *only* way the loop stops — so every terminal/blocked/capped path must reach step 8 and deliberately not schedule.

## Why self-paced, and how to pick the delay

Cycle length varies from a few minutes to tens of minutes, so a fixed interval would fire mid-cycle or waste time — **self-pace.** Cycles are CPU-bound work, not waiting on external state, so you want them roughly back-to-back: use a short `delaySeconds` (~60–120). The loop's bounds clamp it. The small gap between cycles is negligible over a long run and buys you a clean re-entry point each time.

## Context hygiene (load-bearing for durability)

The main loop's context is the scarce resource — it accumulates across iterations until the harness compacts it. Protect it:

- **Delegate everything heavy.** Builders, scouts, researchers, the checker, the documentarian all run as subagents whose context is discarded. You never read a full diff or a full file; you read the checker's triage and the agent's thin report.
- **Summarize to disk, not to context.** The moment a cycle finishes, its durable result is in `.dev-team/PROJECT.md` + `autopilot.json` + the commit. The next iteration rehydrates from disk.
- **Rehydrate, don't remember.** Treat each iteration as if you cold-started. This is what guarantees that when the harness *does* compact your context (or the session restarts), the loop continues correctly.

A conductor that reads every diff and keeps everything in context will not survive ten iterations. One that pushes to subagents and disk can run indefinitely.

## Crash / interruption recovery

Because `next_action` is written *before* the cycle runs and the lock carries a heartbeat timestamp, recovery is automatic. A firing that finds the lock dir present but its heartbeat older than `stale_after_min` treats the prior cycle as crashed, reclaims the lock, and either resumes the in-flight item (if the commit didn't land) or moves on (if it did — check `git log` against `last_commit`). The run branch's per-cycle commits make "did the last cycle actually finish?" a checkable question, not a guess. A stale cycle reclaimed before its RECORD is restarted from `next_action`, but any per-task auto-commits it already landed are **kept** — the lead checks `git log` against `last_commit` and resumes only the not-yet-committed items of the bundle. Any uncommitted working-tree changes are discarded (reset to the run branch's current HEAD, which includes those already-checked per-task commits), because only the *uncommitted* remnant of a crashed wave is of unknown integrity. Cold-resume is correct-but-lossy by design for the not-yet-committed case — it guarantees a known-good restart, not partial-work salvage. Reclamation is a best-effort compare-and-swap, not a hard mutex.

**Only reset on confirmed death, not on tree-dirtiness alone.** A healthy-but-slow cycle keeps its lease fresh via the step-5 heartbeat, so it never looks crashed. Reset a dirty working tree to the run branch's current HEAD *only after* the lock is confirmed stale by its last heartbeat (no live process is still producing output) — never while a heartbeat is still advancing, or you'd wipe a long cycle's uncommitted work.

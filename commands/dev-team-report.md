---
description: Print a read-only, on-demand run report — phases/cycles, commits, agents spawned by tier, and a rough (not-a-bill) cost estimate — computed per run-report.md. Always available regardless of the features.telemetry toggle.
argument-hint: [branch=<base>]
---
Print a run report for the current dev-team state in this repo. Arguments: $ARGUMENTS (optional
`branch=<base>` — the base branch to diff commits against; if omitted, resolve per step 2 below).
Full spec — what the report contains, the cost-weight table and formula, the mandatory caveat, and
the telemetry-toggle semantics — lives in
`skills/dev-team-orchestrator/references/run-report.md`; read it before computing anything. This
command is **read-only**: it never creates, edits, or touches any file, and never runs `git fetch`
or any other network/mutating git command.

1. **Check for dev-team state.** Look for `.dev-team/autopilot.json`, and for `.dev-team/PROJECT.md`
   through the lookup order (`conventions.md`, "Where the plugin writes, and the ownership rule",
   point 5), which never reads a file without the dev-team marker as the ledger — a legacy root
   `PROJECT.md` without the marker does not count as dev-team state. A legacy root `PROJECT.md`
   that does carry the marker is read where it is: this command moves and commits nothing, and the
   report says the move is pending — "`PROJECT.md` is still at the top level of the project — run
   `/dev-team-move-ledgers` to move it into `.dev-team/`." (point 5, read-only commands). If **neither** exists, say plainly "no dev-team run detected in this repo" and point to `/dev-team` (to start
   one) or `/dev-team-status` (for a live dashboard), then stop.
2. **Resolve the base branch.** Precedence: the `branch=<base>` argument if given > `.dev-team/config.yml`'s
   `git.default-branch` if it names an explicit branch > auto-detect (`git symbolic-ref --quiet
   --short refs/remotes/origin/HEAD`, stripping the `origin/` prefix) > fall back to `main` (or
   `master` if `main` doesn't exist). Best-effort and fail-open throughout — an unreadable config or
   an unresolvable auto-detect just falls through to the next rule, never an error.
3. **Gather the facts**, per `run-report.md`:
   - Skill/mode + phases/stages: from `autopilot.json`'s `plan` / `phase_cursor` if present, else
     `.dev-team/PROJECT.md`'s `## Stage plan` and `## Current status` (the file found in step 1).
   - Cycles/stages completed.
   - Agents spawned by tier: `autopilot.json`'s `budget.spawns_by_tier` if present; if
     `autopilot.json` doesn't exist, report tier spawn counts as **"not tracked outside an autopilot
     run"** — a cold command invocation has no conversation memory to count from (see
     `run-report.md`'s "Live vs on-demand"). Never guess a number here.
   - Commits: `git log --oneline <base>..HEAD` on the run's branch (`autopilot.json`'s `branch`
     field if present, else the current branch).
   - Wall-clock: derive from the first and last commit's timestamp in that same range
     (`git log --format=%ai`); if there are fewer than two commits, or the derivation doesn't make
     sense, report "n/a" rather than fabricate a duration.
   - Gate-ledger outcomes: tally `autopilot.json`'s `gate_ledger` by status, if present.
   - Rough cost estimate: apply the weight table and formula from `run-report.md` to the spawn
     counts (only computable when spawns-by-tier is known — otherwise say the cost estimate is
     unavailable for the same reason the spawn counts are). Always attach the mandatory caveat
     verbatim, next to every number.
4. **If `.dev-team/autopilot.json` exists but its `schema` major is newer than this command
   expects** (see `conventions.md`'s "Schema versioning"), say so rather than guessing at a shape
   that may have changed underneath it, and print whatever fields are still safely readable.
5. **Print the report** in the shape shown in `run-report.md`'s "Example rendering". Nothing on disk
   changes — this command reads state, it never writes it.

This command runs **regardless of `features.telemetry`** — that toggle only governs whether a
*running* skill emits this report automatically at its terminal step (see `run-report.md`); asking
for it explicitly, here, is always honored.

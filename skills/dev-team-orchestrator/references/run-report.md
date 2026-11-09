# Run Report — spec + the rough cost-estimate method

Every dev-team run should be able to summarize what it did and roughly what it cost, so cost stays
legible without ever pretending to be a bill. This file is the **authoritative spec** for that
report and the **ONLY** place in the suite the per-tier cost weights live — if you're tempted to
restate a weight number elsewhere, point here instead. It backs two call sites:

- **Automatic / LIVE** — a running skill emits this report itself at its terminal step
  (`dev-team-autopilot`'s loop-runtime.md terminal step; `dev-team-orchestrator`'s SKILL.md "Verify
  and report" step), honoring the `features.telemetry` toggle (see below).
- **On-demand** — `/dev-team-report` (`commands/dev-team-report.md`), read-only, works regardless
  of the toggle.

## What a run report contains

- **Skill/mode + phases run** — e.g. "dev-team-autopilot: DISCOVER → STABILIZE (in-progress)", or
  "dev-team-orchestrator: stages 1–3 of 4".
- **Cycles/stages completed** — autopilot's `cycle` count and `phase_cursor`, or the orchestrator's
  `## Stage plan` status column in `.dev-team/PROJECT.md`.
- **Agents spawned by tier** — from `.dev-team/autopilot.json`'s `budget.spawns_by_tier` when
  present, else counted from the run's briefs. See "Live vs on-demand" below — the second path
  only works when the reporter is the same live session that issued those briefs; a cold report
  with no `autopilot.json` says so rather than guessing.
- **Commits on the run branch** — `git log --oneline <base>..HEAD`.
- **Wall-clock, if derivable** — the span between the first and last commit's timestamp in that
  same range (`git log --format=%ai`); otherwise "n/a" (e.g. zero or one commit, or timestamps that
  don't make sense together). Never fabricate a duration.
- **Gate-ledger outcomes** (autopilot runs only) — a tally of `autopilot.json`'s `gate_ledger` by
  status: `awaiting-user` / `approved` / `auto-cleared` / `built` / `dropped`.
- **The rough cost estimate** — see the method below. Always present, always caveated.

## Live vs on-demand — why spawn counts sometimes say "not tracked"

- **LIVE** (a running skill reporting on itself, at its own terminal step): it has this session's
  own conversation context, so if no `autopilot.json` budget block exists (a plain orchestrator /
  iterate / security / review run has no autopilot state at all), it MAY tally tier spawns from the
  briefs it issued this run.
- **ON-DEMAND** (`/dev-team-report`, invoked cold, in a fresh session with no memory of past
  spawns): it can only compute from what's persisted on disk. If `.dev-team/autopilot.json` exists,
  its `budget.spawns_by_tier` is the source. If it doesn't exist, there is no persisted spawn ledger
  for a plain (non-autopilot) run — report tier spawn counts as **"not tracked outside an autopilot
  run"** rather than inventing a number. Everything else derivable from `git log` and `.dev-team/PROJECT.md`
  (commits, stages, wall-clock) still prints normally.

## Rough cost estimate method (single source of truth for the weights — HERE ONLY)

This is a **spawn-count heuristic**, not a token-accurate cost model — there is no billing API to
reconcile against, and token usage per call varies wildly by task. It exists so a run's relative
cost shape (did this lean on Fable/Opus heavily, or mostly cheap tiers?) is visible at a glance.

**Per-tier relative cost weight** (higher = pricier; tune to your own plan — these are defaults):

| Tier (alias — see `model-routing.md`) | Weight |
|---|---|
| Reasoning (`fable`) | 9 |
| Build/Verify (`opus`) | 6 |
| Scribe (`sonnet`) — also the economy build endpoint | 2 |
| Mechanical (`haiku`) | 1 |
| Optional external bulk executor (GPT-5.5 / Codex), if used | 2 |

These are relative weights for THIS estimate only — a different axis from `orchestration-profiles.md`'s
"cost-efficiency" ranking (which runs the opposite direction: higher there means *cheaper*, tuned for
routing decisions, not for this report's arithmetic). Don't conflate the two tables.

**Formula:**

```
cost_index = Σ (spawns_tier × weight_tier)
```

Sum across every tier with a nonzero spawn count. Optionally break the sum down per tier so the
reader can see which tier dominated it.

**Optional $ conversion — no built-in default.** You MAY multiply `cost_index` by your own blended
$/spawn-unit rate to get a $ range, if you know one for your plan. The suite does not hardcode a
default rate: pricing varies by subscription vs. metered API use, by plan tier, and changes over
time — baking in a number here would produce a stale, false-precision figure. If you do add a $
figure, present it as a wide range, not a point estimate.

**The mandatory caveat — every report line that shows a number carries it, verbatim or equivalent:**

> rough estimate from spawn counts, not a bill — actual cost depends on tokens per call.

Never present `cost_index` (or any derived $ figure) as an authoritative spend total. It is a
coarse trend indicator, in the same spirit as `autopilot.json`'s `budget` block
(`dev-team-autopilot/references/loop-runtime.md`, "The `budget` block") — this file is simply where
the per-tier weights that make the trend legible as a single number live.

**No dated model ids here.** These weights key off tier **names/aliases** (`fable`, `opus`,
`sonnet`, `haiku`) exactly as `model-routing.md` defines them — never a dated `claude-*` id. This
file is not the roster; `model-routing.md` remains the only file allowed to name one
(`scripts/audit-model-ids.sh` enforces this).

## Telemetry toggle — `features.telemetry`

- Schema and default live in `config-and-toggles.md` (`features: telemetry: on|off`, default `on`).
- **`on` (default):** the automatic LIVE report (above) is emitted at a run's terminal step.
- **`off`:** the automatic LIVE report is suppressed — the run completes normally; no numbers are
  computed or printed at the terminal step.
- **`/dev-team-report` always works, regardless of the toggle.** The toggle only silences the
  *automatic* emission; it is not a kill-switch on the read-only, on-demand inspection tool. An
  explicit ask always gets an answer.
- **Fail-open**, same as every other toggle in the suite: a missing or malformed
  `.dev-team/config.yml`, or an unrecognized value for the `telemetry` key, is treated as `on` (the
  built-in default) — never block, error, or skip the rest of a run over a report.

## Example rendering

```
## Run report — dev-team-autopilot (feature/foo)
Phases: DISCOVER (done) -> STABILIZE (in-progress) -> SECURE/COMPLETE/POLISH/VERIFY (pending)
Cycles: 7 (cap 30)
Agents spawned by tier: fable 1, opus 9, sonnet 8, haiku 2
Commits (main..HEAD): 6
Wall-clock: 2h 14m (first commit 14:02 UTC -> last commit 16:16 UTC)
Gate ledger: 1 awaiting-user, 1 auto-cleared, 1 built
Rough cost estimate: cost_index = 1x9 + 9x6 + 8x2 + 2x1 = 9+54+16+2 = 81
  (rough estimate from spawn counts, not a bill — actual cost depends on tokens per call)
```

## See also

- `commands/dev-team-report.md` — the on-demand command that computes this report cold.
- `conventions.md` — "Shared artifacts" (this report is a computed view, not an owned artifact) and
  "Repo config & feature toggles".
- `config-and-toggles.md` — the `features.telemetry` schema entry and fail-open rules.
- `model-routing.md` — the tier → alias mapping these weights key off (and the only file allowed a
  dated model id).
- `dev-team-autopilot/references/loop-runtime.md` — the `budget` block this report reads when
  present, and its own "heuristic trend, not a bill" framing.

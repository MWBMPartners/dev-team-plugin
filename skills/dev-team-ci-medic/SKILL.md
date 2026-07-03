---
name: dev-team-ci-medic
description: Watch a repo's open pull requests for failing CI checks and resolve them safely, as a team lead delegating to opus-builder (Opus tier — diagnosis and all verification) and sonnet-scribe (Sonnet tier — run summaries), with quick-edits (Haiku tier) used only for the purely mechanical autofix step. Classifies every failing check as SAFE-AUTO (formatter/autofix-linter/import-sort/deterministic-regen — fixed, checker-verified, and pushed to the PR branch automatically), FLAKY (rerun and re-evaluate), REAL (a genuine test/type/build/logic failure — diagnosed and PROPOSED, never made to pass by editing the test), or BLOCKED (missing secret/runner/infra/outage — reported, not fixed). Default posture is `autofix=safe`: safe classes auto-resolve, everything else is surfaced with a concrete proposed fix — there is no blanket auto-resolve mode. Use when the user wants to "watch my PRs", "fix CI failures", "monitor checks", "ci medic", "auto-fix PR checks", or keep a PR green while they step away. Runs interactively, via `/dev-team-watch-prs`, looped with `/loop <interval> /dev-team-watch-prs`, or as a scheduled cloud routine (`/schedule`). Sibling of dev-team-orchestrator and dev-team-ship — reuses the orchestrator/review machinery (briefs, checker, evidence-not-claims) scoped to CI-failure remediation on pull requests you own. Never edits a test's assertions to make it pass, never pushes to main or force-pushes, and never touches a PR it doesn't own without explicit per-PR opt-in. Do NOT use to build features (dev-team-orchestrator/iterate) or to stand up the pipeline itself (dev-team-ship) — this skill only reacts to CI failures already happening on open PRs, and does not attack systems the user doesn't own.
---

# Dev Team CI Medic

You are the **PR triage lead**. A pull request's CI is failing; your job is to figure out
**why**, and to fix what's safe to fix automatically while surfacing everything else with a
concrete, confirmable proposal — never silently changing what a test checks, never touching
`main`, never touching a PR that isn't yours without being asked.

This is the **CI-failure-remediation variant** of `dev-team-orchestrator`. It **reuses that
skill's machinery** — briefs, the checker, evidence-not-claims, the documentarian — pointed at
a narrower target: the failing checks on a repo's open PRs, not a feature spec.

> **Read `dev-team-orchestrator/SKILL.md` first** — locate it via your `available_skills`
> registry (it lives under `~/.claude/skills/` for a user install or `.claude/skills/` for a
> project install). Delegation, the brief format, the checker, and the documentarian all apply
> unchanged. This file documents only the ci-medic-specific deltas.

## The idea

**Monitor → triage → resolve-by-class.** Detection is always automatic — every watch pass
enumerates every failing check on every watched PR, no exceptions. *Resolution* is gated by
class: mechanical, reversible fixes (SAFE-AUTO) apply themselves once the checker proves they
work; anything that touches actual logic (REAL) is diagnosed and proposed, never pushed without
confirmation (or the gated remediation cycle below); anything that isn't code-fixable (BLOCKED)
is reported, not attempted. There is no mode that auto-resolves everything — see "The gate."

## Your team

- **Triager** — the `opus-builder` agent (Opus tier), read-only first pass. For each watched
  PR: enumerate failing checks, pull the failure logs, and classify each one against the table
  below. Follow `references/triage-protocol.md`.
- **Fixer** — for **SAFE-AUTO** failures, the mechanical edit (running the formatter/linter
  `--fix`, re-sorting imports, regenerating a deterministic file) is delegated to `quick-edits`
  (Haiku tier) — it is pure, reversible, judgment-free mechanics. Anything that needs judgment,
  including edge cases inside a nominally SAFE-AUTO class, stays on `opus-builder`. For **REAL**
  failures, `opus-builder` diagnoses and drafts the proposed fix; it only *builds* that fix
  through the gated remediation cycle (brief → build → checker), never by hand-editing a test's
  expectations.
- **Checker / verifier** — the `opus-builder` agent (Opus tier). Re-runs the exact failing
  check (locally where reproducible, otherwise via a fresh CI run) and pastes the now-passing
  output before any fix is considered done. Verification never drops to a cheaper tier — same
  invariant as every other dev-team skill (`model-routing.md`, invariant 1).
- **Documentarian** — the `sonnet-scribe` agent (Sonnet tier). Records a short run summary at
  the end of the pass: what was watched, what was fixed, what was proposed, what was blocked.
  If the repo already keeps a `PROJECT.md`, append a note to its Current status; otherwise just
  report the summary directly. Ci-medic introduces no new required artifact.

## Classification

Every failing check gets exactly one of these four classes before anything is touched:

| Class | Signal (from `gh pr checks` + `gh run view --log-failed`) | Action |
|---|---|---|
| **SAFE-AUTO** | Formatter diff (prettier/black/gofmt/rustfmt), linter with a real autofix (eslint `--fix`, ruff `--fix`), import-sort, a deterministically-regenerable generated file or lockfile | Auto-fix → checker verifies → commit + push to the PR branch |
| **FLAKY** | Known-flaky markers, network/timeout error, non-deterministic failure; passes clean on rerun | `gh run rerun --failed`; if it fails again, reclassify as REAL |
| **REAL** | Test assertion failure, type error, build/compile error, an actual logic bug | Diagnose → PROPOSE a fix (or run the gated `dev-team-review`→`dev-team-orchestrator` remediation cycle); confirm before pushing; NEVER edit the test to make it pass |
| **BLOCKED** | Missing secret, runner/infra error, permission failure, external service outage | Not code-fixable — report the specific cause to the user, don't attempt a workaround |

Full rubric, the SAFE-AUTO allowlist, and flaky detection: `references/triage-protocol.md`.

## The gate — `autofix=safe` is the only auto-resolve mode

- **`autofix=safe` (default).** SAFE-AUTO classes are fixed, checker-verified, and pushed
  automatically, then surfaced in the run summary. FLAKY is rerun automatically. REAL is
  diagnosed and PROPOSED — built only on the user's confirmation, or via the gated remediation
  cycle when this skill is embedded under a conductor that already owns that gate. BLOCKED is
  reported. This is the user's chosen default posture.
- **`autofix=off`.** Monitor, classify, and report/propose only. Nothing is modified, nothing
  is pushed — a pure triage pass.
- **There is no blanket auto-resolve mode.** Ci-medic never "just fixes everything" regardless
  of class — REAL failures always need a human confirmation or a gated cycle, by design.

## The per-PR loop

For each watched PR (see Arguments for scope):

1. `gh pr checks <pr>` → the list of failing checks; `gh run view <run-id> --log-failed` →
   the actual failure logs for each.
2. Classify each failure against the table above.
3. **SAFE-AUTO**: check out the PR's head branch; reproduce the check locally where possible;
   apply the minimal mechanical fix (`quick-edits` for pure-mechanical cases, `opus-builder`
   otherwise); the checker re-runs the check and pastes passing evidence; commit
   (`ci-medic: fix <check> — <what changed>`) and push to the **PR branch only**; poll CI to
   confirm green.
4. **FLAKY**: `gh run rerun --failed`; re-evaluate the new result.
5. **REAL**: post a diagnosis and a concrete proposed fix; on confirmation (or under the
   conductor's own gate, when ci-medic is embedded in a larger run), run a scoped remediation
   cycle (an orchestrator brief, the checker verifies), then push; otherwise leave the PR as-is
   and surface it. Never game the test.
6. **BLOCKED**: report the specific cause — don't retry, don't work around it silently.
7. `sonnet-scribe` records a short run summary: watched / fixed / proposed / blocked, per PR.

Full protocol, including reproduce-locally-first and commit/push discipline:
`references/remediation-protocol.md`.

## Non-negotiable safety rules (read before running)

Every ci-medic pass — interactive, looped, or scheduled — obeys these six rules without
exception. They're restated in full in `references/remediation-protocol.md`; this is the
on-ramp every entry point (skill, command, loop, routine) must carry forward.

1. **Never game tests.** If a failing check is a test, fix the CODE UNDER TEST — never edit
   the test's assertions or expectations to make it pass. A test that's genuinely wrong is a
   human call: surface it, don't silently "fix" it by relaxing what it checks.
2. **Push to the PR HEAD branch only — never `main`/`master`, never force-push.** The suite's
   guard hook already blocks pushes to main; this rule is belt-and-suspenders, not the only
   line of defense, and it holds even when a fix is "obviously right."
3. **Only PRs you own** — your repo, your authored PR — unless the user explicitly opts in
   per-PR. Never triage, comment on, or push to someone else's PR uninvited.
4. **`GITHUB_TOKEN` anti-recursion.** A local run pushes with the user's own `gh` credentials,
   so CI re-triggers normally on the push. A scheduled/cloud routine that pushes with the
   default `GITHUB_TOKEN` will **not** re-trigger downstream CI on that push — bridge it with a
   PAT or a `gh workflow run` re-dispatch. Full handling: `references/watch-and-schedule-protocol.md`.
5. **Evidence, not claims.** The checker (`opus-builder`) re-runs the failing check and pastes
   the now-passing output *before* a fix is considered done; the fix commit carries that same
   evidence, not a restated claim that it works.
6. **Verification stays on the frontier tier.** Diagnosis and fix-verification always run on
   `opus-builder` (Opus); only the purely mechanical autofix step may run on `quick-edits`
   (Haiku). Never route verification cheaper (`model-routing.md`, invariant 1).

## How it's run

- **Interactively** — invoke this skill directly (or via `/dev-team`) for a one-shot watch pass
  over the current repo's open PRs.
- **`/dev-team-watch-prs`** — the dedicated command; a single watch-and-resolve pass, read-only
  when nothing is failing.
- **`/loop <interval> /dev-team-watch-prs`** — repeats the pass on an interval (e.g. `/loop 10m
  /dev-team-watch-prs`) for hands-off babysitting during a local session.
- **A scheduled cloud routine** — set up via the `/schedule` skill to run the watch prompt on a
  cron schedule with no local session open. Needs `gh` authenticated in the routine's
  environment and the `GITHUB_TOKEN` bridge from rule 4 above. Full setup:
  `references/watch-and-schedule-protocol.md`.

## Arguments

Optional run arguments (defaults in brackets):

- `pr=<n>` — narrow the run to a single PR number [all open PRs of the current repo].
- `autofix=safe|off` — `safe`: auto-resolve SAFE-AUTO + rerun FLAKY + propose REAL + report
  BLOCKED (see "The gate"). `off`: monitor and report/propose only, touch nothing [safe].
- `interval=<duration>` — only meaningful when fired via `/loop <interval>
  /dev-team-watch-prs`; how often the watch pass repeats. Not a ci-medic argument itself.
- `repo=<current>` — scope is always the current repo's PRs; this argument exists to make that
  explicit in a brief or a scheduled routine's prompt, not to point at another repo.

## Definition of done

Every failing check on a watched PR ends the pass in one of two states: **GREEN** (a SAFE-AUTO
class, fixed and checker-verified) or **classified-and-surfaced with a concrete proposed fix**
(FLAKY re-evaluated, REAL proposed, or BLOCKED reported with its specific cause). Nothing is
pushed to `main`; no test is gamed; no BLOCKED item is silently dropped.

## References

- `references/triage-protocol.md` — the `gh` commands to enumerate PRs/checks/logs, the
  classification rubric, the SAFE-AUTO allowlist, and flaky detection + rerun. Read before the
  first triage pass.
- `references/remediation-protocol.md` — the fix → verify → push loop, reproduce-locally-first,
  minimal-fix discipline, commit/push rules, the never-game-tests rule in full, and the
  `GITHUB_TOKEN` anti-recursion handling (local vs. cloud/routine). Read before applying any fix.
- `references/watch-and-schedule-protocol.md` — the watch pass itself, the `/loop` form, and
  the scheduled-routine setup via `/schedule`, with its authentication and anti-recursion
  caveats. Read before setting up unattended watching.

Reused from `dev-team-orchestrator/references/`: `task-brief-template.md`,
`checker-protocol.md`, `documentarian-protocol.md`.

The suite's **shared contracts** — artifact ownership & schemas, ID prefixes, the branch model,
the flattening rule, gates, and safety — live in
`dev-team-orchestrator/references/conventions.md`; read it once.

## Anti-patterns

- **Gaming a test to make it pass.** Editing an assertion, a fixture, a mock, or an expected
  value instead of the code under test. If the test itself looks wrong, say so — that's a human
  call, not an auto-fix.
- **Force-pushing, or pushing to `main`/`master`.** Every push targets the PR's existing head
  branch, fast-forward, no history rewrite.
- **"Fixing" infrastructure it can't fix.** A missing secret, a runner outage, a permissions
  error — these are BLOCKED, reported with the specific cause, never worked around.
- **Blocking on a flaky failure without a rerun first.** Reclassify to REAL only after a rerun
  genuinely fails again — don't diagnose a network blip as a logic bug.
- **Silent mass changes.** A SAFE-AUTO fix is scoped to the one failing check; it doesn't
  reformat the whole repo or touch unrelated files "while it's in there."
- **Ignoring the `GITHUB_TOKEN` trap in a scheduled routine.** A cloud routine pushing with the
  default token will look like it worked (the push succeeds) while CI silently never re-runs —
  always bridge or document this per `references/watch-and-schedule-protocol.md`.
- **A blanket auto-resolve mode.** There is no `autofix=all`; REAL failures always need
  confirmation or a gated cycle, never a silent auto-push.

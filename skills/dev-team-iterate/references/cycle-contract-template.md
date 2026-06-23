# Cycle Contract Template

In `dev-team-iterate` there are no fixed project done-criteria, so **each cycle defines its own**. The cycle contract is the iterate equivalent of a stage's done-criteria: a bounded theme, checkable criteria, the invariants that must hold, and a blast-radius cap. Write one before delegating each cycle; the documentarian records it; the checker verifies against it verbatim.

A cycle is **one coherent theme**, not a grab-bag. Pull the top backlog item(s) by the UX-first priority order; bundle additional items only if they share the theme and don't touch the same files.

## The contract

```markdown
# Cycle N — [theme, e.g. "Consolidate the two overlapping dashboard tabs"]

## Backlog items addressed
- B-0XX [type] — [one line]
- B-0YY [type] — [one line]   ← only if same theme + non-overlapping files

## Goal
[1–2 sentences: what this cycle makes better, tied to the inferred purpose.]

## Approved feature spec (FEATURE CYCLES ONLY)
[Paste the user-approved spec verbatim — what it does, how it works (UX flow),
behavior/rules, scope. A feature cycle MUST cite an approved spec; if there is none,
this cycle is not allowed to run — return to the Feature Spec Gate first. Build to
the spec exactly; a material deviation stops the cycle and goes back to the user.
"Approved" = user-approved at the standalone Feature Spec Gate, OR — when running under
the `dev-team-autopilot` conductor — a conductor-authored spec whose autonomy-test
justification is logged in the gate-ledger (`status: auto-cleared`); under the conductor
that logged justification is the approval-of-record. `gates=pause-all` removes this path.]

## Acceptance criteria (checkable — the checker verifies these verbatim)
- [ ] [concrete, runnable/observable criterion]
- [ ] [concrete criterion]
- [ ] App still runs: [exact run command] and [observable result]
- [ ] [for feature cycles] behavior matches the approved spec, including its acceptance criteria
- [ ] [for UX cycles] UX rubric satisfied (see Invariants); before/after screenshots attached
- [ ] [for perf cycles] before/after measurement attached: [metric + how measured]

## Invariants (must hold — a violation fails the cycle)
- [ ] All existing tests stay green: [test command]. Net coverage does not drop.
- [ ] No behavior change to existing flows EXCEPT the intentional ones listed below.
- [ ] [UI-touching only] UX rubric holds: steps-to-primary-action flat-or-down,
      default-view element count flat-or-down, no new overlapping surface,
      no new a11y violation. (See ux-rubric.md.)
- [ ] [perf only] the perf claim is backed by pasted before/after numbers, not asserted.
- [ ] Every change is purpose-fit (justified against the inferred purpose).
- [ ] No net-new dependency without lead sign-off; no manifest edits by parallel agents.

## Intentional behavior changes (the allow-list)
- [explicitly list any user-facing behavior this cycle deliberately changes; anything
  not listed here that changes behavior is a regression, not a feature]

## Blast-radius cap
- Theme: one. Files expected to change: [list / glob].
- Ceiling: ~[N] files / ~[M] lines. If the work exceeds this, STOP and split the
  cycle — a sprawling cycle isn't reviewable or cleanly revertible.

## Trajectory metrics to record this cycle
- [the metrics this cycle should move or hold: e.g. steps-to-add-item 4→3,
  bundle -12KB, duplicate-surfaces 2→1, coverage 61%→64%]
```

## How the contract drives the cycle

- **Delegate** against it: paste the relevant criteria, invariants, and blast-radius into each builder brief (orchestrator's `task-brief-template.md`). For UI work, also paste `ux-rubric.md`. For perf work, name the exact metric and how to measure it.
- **Check** against it: the checker (orchestrator's `checker-protocol.md`) verifies every acceptance criterion *and every invariant*, runs the suite, judges test quality, enforces the UX rubric and perf-evidence rule, and confirms purpose-fit. It triages as usual; you read only NEEDS-LEAD-REVIEW.
- **Checkpoint**: re-read the criteria, run the full suite, and confirm the trajectory metrics moved the right way (or held). If the metric moved the *wrong* way (more steps, more clutter, slower, coverage dropped), the cycle drifted — fix or re-scope before committing.
- **Commit**: one commit on the run branch, message `iterate: cycle N — [theme]`. This is the rollback point for the next cycle.
- **Re-score**: light re-audit — did this cycle open or close other backlog items? — then re-sort. Append the cycle's metrics row to the trajectory ledger.

## Invariant rationale (don't relax these)

- **Tests green + coverage not dropping** is the safety net that makes unsupervised iteration safe. If the safety-net gate forced a characterization-test cycle first, this is why.
- **The behavior allow-list** is how "behavior preserved unless intentional" is made checkable: list deliberate changes; everything else changing is a regression.
- **The blast-radius cap** keeps each cycle reviewable and revertible — the whole point of one-commit-per-cycle on a branch.
- **Purpose-fit** is the guard against the loop sprawling the app beyond what it's for.

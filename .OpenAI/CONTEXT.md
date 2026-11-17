# Project context for Codex — dev-team-plugin

<!--
  File:     .OpenAI/CONTEXT.md
  Purpose:  Codex's starting context for this repository. The shared, fuller version is
            .claude/CONTEXT.md; read that too. This file adds what is specific to Codex's role.
  Updated:  5 October 2026 (issue #47: the review history after Codex's catch-up review, and the
            sixth round).
-->

## What Codex does here

In this repository Claude Code builds the work and **Codex reviews it** (standing rule 5). Codex is
normally run read-only by Claude Code, with a written brief, against the working branch compared
with `main`. If Claude Code becomes unavailable, Codex may take over building (standing rule 8); the
work it does is then reviewed by Claude Code when Claude Code is back.

## Where things are

- The repository layout, the checks to run, and the list of open issues: `.claude/CONTEXT.md`.
- Where the work stands right now: `.claude/HANDOFF.md` ("START HERE" section).
- The current review brief for the working branch:
  `.claude/plans/ledger-file-clashes/codex-review-prompt-5.md`.
- A second branch, `feature/bcp47-language-policy` (issue #47), is reviewed in rounds; what the
  branch adds as a whole is in `.claude/HANDOFF.md`. Its review history: Codex reviewed
  `413d570..748e87c` (10 findings) and `748e87c..42bd45e` (6 findings); stand-ins (fresh Opus
  agents) reviewed `748e87c..a9fb292` and `42bd45e..b39f40d`; the fifth round
  (`b39f40d..2f91439`) had no review of its own; then Codex's catch-up review of
  `748e87c..2f91439` (rounds 2 to 5 as one body) was not clean — 8 findings — and the sixth round
  acts on them. Commits after `2f91439` are not yet reviewed. Read `git diff 2f91439..HEAD`,
  starting with `hooks/guard-dev-team.sh`; a problem found anywhere else on the branch is still
  worth reporting. Give each finding a severity: the review loop now stops when a review finds no
  high or medium problems, and low findings, wording points and older faults become GitHub issues
  rather than new rounds. The whole #47 change is compared with `claude/ledger-file-clashes`
  (where it was cut, at `413d570`), not with `main`, so #41's changes are not reported as #47's.
  **Out of date since 9 November 2026:** both are now merged into `main` and that branch is deleted;
  a new review compares the new working branch with `alpha`.
  To run the bats tests, set `TMPDIR` to a writable folder (the sandbox's default was not).
- Earlier Codex review results: `.claude/plans/ledger-file-clashes/codex-review-3.md` and
  `codex-review-3-verification.md`.

## Limits Codex has met here

- Inside the read-only sandbox, Codex could not run the `bats` tests. Say so in the review rather
  than guessing at test results; Claude Code runs them.

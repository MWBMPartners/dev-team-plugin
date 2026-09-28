# Project context for Codex — dev-team-plugin

<!--
  File:     .OpenAI/CONTEXT.md
  Purpose:  Codex's starting context for this repository. The shared, fuller version is
            .claude/CONTEXT.md; read that too. This file adds what is specific to Codex's role.
  Updated:  28 September 2026 (issue #47 branch added).
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
- A second branch, `feature/bcp47-language-policy` (issue #47), needs its own review round —
  compare it with `claude/ledger-file-clashes` (where it was cut, at `413d570`), not with `main`,
  so #41's changes are not reported as #47's. What it adds is in `.claude/HANDOFF.md`. Its last
  two reviews were done by fresh Opus agents because Codex was out of allowance, so a Codex review
  of the whole #47 range is still owed; the newest, unreviewed part is the second-review revision
  (the three commits after `0c25209`, plus a notes commit).
- Earlier Codex review results: `.claude/plans/ledger-file-clashes/codex-review-3.md` and
  `codex-review-3-verification.md`.

## Limits Codex has met here

- Inside the read-only sandbox, Codex could not run the `bats` tests. Say so in the review rather
  than guessing at test results; Claude Code runs them.

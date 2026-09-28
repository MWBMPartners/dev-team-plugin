# Project context for Codex — dev-team-plugin

<!--
  File:     .OpenAI/CONTEXT.md
  Purpose:  Codex's starting context for this repository. The shared, fuller version is
            .claude/CONTEXT.md; read that too. This file adds what is specific to Codex's role.
  Updated:  28 September 2026 (issue #47: the outstanding review range after its fourth round).
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
- A second branch, `feature/bcp47-language-policy` (issue #47), is reviewed in rounds, and each
  round looks only at the work that has not been reviewed yet (what the branch adds as a whole is
  in `.claude/HANDOFF.md`). **The outstanding, unreviewed range is `42bd45e..HEAD`**: the fourth
  round, which acts on Codex's own review of `748e87c..42bd45e` (six findings, not clean) — the
  Bash guard now reads quoted and escaped words and resolves a push that names no branch; the
  smoke test checks each tool-to-guard registration; snapshot copies live in `files/`, apart from
  the manifest and `snapshot/pr/<n>/`; a resumed run checks and reuses its recorded snapshot; a
  ci-medic `/loop` is one run with one snapshot and every pass puts the starting branch back; and
  these notes. Everything up to `42bd45e` has already been reviewed by Codex (`413d570..748e87c`,
  then `748e87c..42bd45e`), and each of those rounds' findings has been acted on, so do not review
  that range again: read `git diff 42bd45e..HEAD`, starting with `hooks/guard-dev-team.sh`. The
  whole #47 change is still compared with `claude/ledger-file-clashes` (where it was cut, at
  `413d570`), not with `main`, so #41's changes are not reported as #47's. To run the bats tests,
  set `TMPDIR` to a writable folder (the sandbox's default was not).
- Earlier Codex review results: `.claude/plans/ledger-file-clashes/codex-review-3.md` and
  `codex-review-3-verification.md`.

## Limits Codex has met here

- Inside the read-only sandbox, Codex could not run the `bats` tests. Say so in the review rather
  than guessing at test results; Claude Code runs them.

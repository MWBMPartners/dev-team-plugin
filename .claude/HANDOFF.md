# Handover — dev-team-plugin

<!--
  File:     .claude/HANDOFF.md
  Purpose:  Lets an interrupted session, or a different AI assistant, pick up this work cold.
            Rewritten as work happens, not tidied at the end. See .claude/CLAUDE.md section 2.
-->

**Last updated:** 13 September 2026, during the analysis stage.
**Working branch:** `claude/ledger-file-clashes` (made from `main`; `alpha` is fully contained in
`main`, so this branch can later go to `alpha` in one pull request). Pushed to GitHub.
**Issue:** [#41](https://github.com/MWBMPartners/dev-team-plugin/issues/41)

## What we are trying to do, and why

The plugin writes its record files — `FEATURES.md`, `SECURITY.md`, `PROJECT.md`, `VERIFICATION.md`
(with `verdict.json`), `MIGRATION.md` and `HANDOFF.md` — into the top level of whichever project it
runs in. Projects often already have files with those names that mean something different. The
plugin never checks before writing. The owner asked whether to rename `FEATURES.md`, then suggested
putting **all** the plugin's documents in the project's `.dev-team/` folder instead.

## What is established (checked by reading the real files)

- **WebMS-Intra** `FEATURES.md` (1,565 lines) is its own product feature list, linked from its
  README and `.claude/CLAUDE.md`. Its `.claude/HANDOFF.md` says featurefind was deliberately not run
  because it would overwrite that file.
- **SIGNula.id** `SECURITY.md` is GitHub's public "report a security problem" page, and a plugin
  security run added internal findings to the bottom of it (from line 144). The clash has already
  caused real damage, not just a risk.
- **SIGNula.id** already keeps the plugin's `FEATURES.md`, `PROJECT.md`, `autopilot.json` and
  `specs/` inside `.dev-team/`, moved by hand.
- **CueRCode, Go2My.Link:** plugin files at the old top-level places. CueRCode's public security page
  is at `.github/SECURITY.md`; its top-level `SECURITY.md` is the plugin's findings list.
- **CloudMapped, iHymns, phpDomainCheckr:** top-level `SECURITY.md` is the project's own public policy.
- Inside the plugin, the file names appear many times (for example `PROJECT.md` on 166 lines in 39
  files). `hooks/`, `scripts/` and `tests/` do not name them; `commands/dev-team-status.md` and
  `commands/dev-team-sync-issues.md` do. The shared list of who owns which file is in
  `skills/dev-team-orchestrator/references/conventions.md`.
- Codex command-line tool 0.153.2 is installed, so a Codex review is possible.

## What was tried and set aside

- **First analysis run (workflow `wf_5462b6ab-1aa`)** was stopped a few minutes in, deliberately, not
  because it failed: the owner suggested the `.dev-team/` folder while it was running, and the
  analysis needed to start from that preference. Restarted with it included.

## Not yet verified

- Which folders GitHub checks for `SECURITY.md`, and in what order. The analysis agent has been
  asked to check this against GitHub's own documentation.

## Task queue

| # | Task | Status |
|---|---|---|
| 1 | Standing rules for this repository (`.claude/CLAUDE.md`) | Done |
| 2 | Device-wide rules (plain English; hand over when a service runs out) | Already present in `~/.claude/CLAUDE.md` — no change needed |
| 3 | Deep analysis (Fable, Opus if Fable unavailable) | Running |
| 4 | Deep plan, file by file (Fable) | Waiting on 3 |
| 5 | Build the change (Sonnet/Haiku; Opus for judgement) | Waiting on 4 |
| 6 | Codex review, fix, re-review until clean | Waiting on 5 |
| 7 | Thorough documentation update (all `.md` files, `.claude/`) | Waiting on 5 |
| 8 | Commit, push, update issue #41, memory, this file | After each task |
| — | Swagger / OpenAPI | Not applicable: the plugin has no web interface or API |

## What to do next

Wait for the analysis and plan. Read both, check anything surprising against the real files, raise any
owner decision in simple words, then build.

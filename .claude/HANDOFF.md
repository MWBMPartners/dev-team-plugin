# Handover — dev-team-plugin

<!--
  File:     .claude/HANDOFF.md
  Purpose:  Lets an interrupted session, or a different AI assistant, pick up this work cold.
            Rewritten as work happens, not tidied at the end. See .claude/CLAUDE.md section 2.
-->

**Last updated:** 13 September 2026. Analysis and plan finished and reviewed; build about to start.
**Working branch:** `claude/ledger-file-clashes` (made from `main`; `alpha` is fully contained in
`main`, so this branch can later go to `alpha` in one pull request). Pushed to GitHub.
**Issue:** [#41](https://github.com/MWBMPartners/dev-team-plugin/issues/41)

## What we are trying to do, and why

The plugin writes its record files — `FEATURES.md`, `SECURITY.md`, `PROJECT.md`, `VERIFICATION.md`
(with `verdict.json`), `MIGRATION.md` and `HANDOFF.md` — into the top level of whichever project it
runs in. Projects often already have files with those names that mean something different, and the
plugin never checks before writing. The owner asked whether to rename `FEATURES.md`, then suggested
putting **all** the plugin's documents in the project's `.dev-team/` folder. That is the design.

## Read these first

1. `.claude/plans/ledger-file-clashes/plan-review.md` — **the lead's corrections. It wins over the plan.**
2. `.claude/plans/ledger-file-clashes/plan.md` — the file-by-file plan (Fable).
3. `.claude/plans/ledger-file-clashes/analysis.md` — the evidence and the options weighed (Fable).

## The design in short

- **Where the files go:** everything the plugin writes lives in `.dev-team/`, with the file names
  unchanged.
- **How the plugin knows a file is its own:** each file carries a marker on line 2, in the form
  `<!-- dev-team: ledger=<kind> schema=1.0 -->`.
- **Check before writing:** the plugin reads the target first. If the marker is missing, it writes
  nothing and asks.
- **Existing installs:** files at the old top-level places are still found. One with the marker is
  moved into `.dev-team/`; one without the marker is asked about. A new command,
  `/dev-team-move-ledgers`, does the same for all seven files at once.
- **New safety hook:** `hooks/guard-ledgers.sh` refuses plugin-marked content written outside
  `.dev-team/`.
- **Self-check script:** `scripts/audit-ledger-paths.sh` fails if any plugin document still points at
  the old top-level place.
- **Schema:** `verdict.json` gets a schema file.
- **Version:** 1.5.0.

## What is established (checked by reading the real files)

- **WebMS-Intra:** `FEATURES.md` is the project's own feature list, and featurefind was deliberately
  not run because it would overwrite it. Its `.claude/HANDOFF.md` already expects
  `.dev-team/FEATURES.md`.
- **SIGNula.id:** `SECURITY.md` is GitHub's public security policy, with plugin findings appended from
  line 144. Real damage, already done.
- **Hand-written handovers:** SIGNula.id and Go2My.Link have a top-level `HANDOFF.md` written by hand.
  Auto-handoff would overwrite it.
- **GitHub (verified from its own documentation):** GitHub reads `SECURITY.md` from `.github/`, then
  the top level, then `docs/` — never from `.dev-team/`. The other six names mean nothing special to
  GitHub.
- **AI coding tools:** none of them read a top-level `HANDOFF.md` on their own. Claude Code reads
  `CLAUDE.md`, Codex reads `AGENTS.md`, Gemini reads `GEMINI.md`.
- **"Is a run in progress?" test:** `hooks/guard-dev-team.sh` line 21 answers it by checking whether
  `.dev-team/autopilot.json` exists. Three projects keep that file committed, so the check is always
  true there. This is why the plan's hook Rule 2 was corrected (see plan-review.md, Correction 1).
- **Automatic checks:** CI (`plugin-audit`) runs only on pull requests and on pushes to `main`, not on
  pushes to this branch.
- **Codex:** version 0.153.2 is installed. `codex review --base main "<what to look for>"` reviews
  this branch.
- **Local tools:** `bats` and `check-jsonschema` were installed with Homebrew on 13 September, so the
  plugin's own tests can run on this machine. `shellcheck` and `jq` were already present.

## What was tried and set aside

- **First analysis run (workflow `wf_5462b6ab-1aa`)** was stopped on purpose a few minutes in, not
  because it failed: the owner's `.dev-team/` suggestion arrived mid-run. Rerun as `wf_bee8e63e-4f4`.
  Both Fable agents answered, so no fallback to Opus was needed.
- **Renaming only `FEATURES.md`** — rejected: it does nothing about `SECURITY.md` or `HANDOFF.md`.
- **Prefixing names at the top level** — rejected: it still clutters every project.
- **A configurable location** — rejected: the owner only finds out after the damage is done.
- **Hook Rule 2 as first planned** (block any edit to a top-level ledger-named file whenever
  `autopilot.json` exists) — rejected on review: it would permanently block people editing their own
  files in projects that commit `autopilot.json`.

## Not yet verified

- Whether Claude Code's before-a-tool-runs hooks fire for a sub-agent's file writes. The plan includes
  a hand test for this.
- The exact input field names Claude Code sends to a Write/Edit hook (`tool_input.file_path`,
  `content`, `new_string`, `edits[]`, `cwd`). The builder must confirm them against Claude Code's
  hooks documentation.

## Task queue

| # | Task | Status |
| --- | --- | --- |
| 1 | Standing rules for this repository (`.claude/CLAUDE.md`) | Done (9830e8e) |
| 2 | Device-wide rules | Already present in `~/.claude/CLAUDE.md` |
| 3 | Deep analysis (Fable) | Done |
| 4 | Deep plan (Fable) + lead review | Done |
| 5 | Build stage 1: WP1 rules text (Opus); WP2 hook, WP3 audit script, WP9 schema (Sonnet) | Next |
| 6 | Build stage 2: WP4–WP6 document edits (Sonnet); WP7 commands (Opus) | Waiting on WP1 |
| 7 | Build stage 3: WP8 README, CHANGELOG, version (Sonnet) | Waiting on stage 2 |
| 8 | Run all checks; Codex review, fix, re-review until clean | Waiting |
| 9 | Hand test: does the hook fire for a sub-agent? | Waiting |
| 10 | Open follow-up issues (see plan-review.md) | Waiting |
| 11 | One pull request to `alpha` | Later — owner's call when |

## What to do next

Start build stage 1 exactly as split in plan-review.md, Correction 4. Builders do not commit; the lead
commits each work package on its own and pushes. Commit WP3 last.

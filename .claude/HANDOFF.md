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
| 5 | Build stage 1: WP1 rules text (Opus) alongside WP2 hook + WP9 schema (Sonnet) | **Done.** Checks rerun by the lead: all pass, bats 39 of 39. Committed separately: 2f1cdf0 (WP1), 1abe635 (WP2 + WP9). The lead's read-through found three small hook faults, now being fixed in stage 2: compact JSON marker not caught, file names matched in capitals only, CI `pip install` may be refused on Ubuntu 24.04 (switching to `pipx`). |
| 6 | Build stage 2: WP4 orchestrator files, WP5a and WP5b skill references, WP6 agents and SKILL.md (all Sonnet); WP7 commands and `/dev-team-move-ledgers` (Opus); the hook fixes (Sonnet) | **Done.** Checks rerun by the lead: audit OK, smoke OK, shellcheck clean, bats 44 of 44, and the mention check OK over all 46 changed files. Committed as six separate commits, one per package. `/dev-team-move-ledgers` was walked against seven real projects read-only, and every required outcome held. |
| 6b | Tidy-up pass (Sonnet): remaining bare file names that are instructions (mostly iterate, migrate, ship and orchestrator files); rename the security layout's `## Findings register` heading to `## Findings` so the existing `#Findings` links work | Next, alongside stage 3 |
| 7 | Build stage 3: WP8 README, CHANGELOG, version (Sonnet), then WP3 self-check script (Sonnet) | Waiting on stage 2 |
| 8 | Run all checks; Codex review, fix, re-review until clean | Waiting |
| 9 | Hand test: does the hook fire for a sub-agent? | Waiting |
| 10 | Follow-up issues | Done: #42 (findings public in public repositories), #43 (`autopilot.json` schema), #44 (Bash guard's "run in progress" test). SIGNula.id's `SECURITY.md` hand-fix belongs to that repository — left for the owner. |
| 11 | One pull request to `alpha` | Later — owner's call when |
| 12 | **New request (13 Sep):** list the owner's standard working-practice features, taken from the instruction block they pasted this session and their personal instructions, and show which the plugin already has. The owner then picks the missing ones to build. | **Mapped and shown to the owner — waiting for their choice.** Tracked in issue [#45](https://github.com/MWBMPartners/dev-team-plugin/issues/45); map committed in ef009c0. Two Fable agents in turn (map, then an independent check; no status changed). 36 features: 8 already in the plugin, 22 partly, 5 missing, 1 opposite (F13, push after each task, against "never auto-push"). Full detail with evidence: `.claude/plans/owner-standard-features/feature-map.md`. Choices put to the owner: F13 as a setting (off or on by default); F10 Codex replacing, or in addition to, the Claude checker; F5 "one after another" for analysis and planning only, keeping debates side by side; F7/F8 cheaper building as the built-in default or a per-project setting. Nothing is built until the owner picks IDs. |

## Baseline before any build change (13 September, commit 9830e8e, run in a separate copy of the branch)

`scripts/audit-model-ids.sh` AUDIT OK · `tests/smoke-structure.sh` SMOKE OK · `shellcheck` clean ·
`bats tests/scripts.bats` 17 of 17 passed. So any failure from here on was introduced by this work.

## Checked while stage 1 runs

- **Every file is assigned.** 45 tracked files mention one of the seven names (`.claude/` not
  counted), and each one falls into exactly one work package's file list. None is left unassigned.
  Largest: `README.md` 44 lines, `skills/dev-team-review/SKILL.md` 24, `conventions.md` 20.
- **The mentions most likely to be project files are not.** The mentions in the ship, docs and ci-medic
  skills and in the small orchestrator references were read one by one. All of them mean the plugin's
  own `PROJECT.md` record, not a project's own file, so no exceptions are needed in stage 2. The stage 2
  briefs still tell builders to leave, and report, any mention that means a project's own file.
- **Codex is signed in** (`codex login status`: "Logged in using ChatGPT"), so the review step can run.

## What to do next

**Current (latest):**

- **All three build stages are committed and pushed.**
  - Stage 2: fc23f11, 7195f7b, 85195f2, 0b03ee4, 5dfb138, 0cc44d1.
  - Stage 3: 5e85c43 (tidy-up pass and the Findings heading), c5f76d9 (README, CHANGELOG, version
    1.5.0 and the self-check script — one commit, because both builders edited the same three files).
  - Checks rerun by the lead: audit-ledger-paths OK, audit-model-ids OK, smoke OK, shellcheck clean,
    bats 47 of 47, workflow YAML parses, README links resolve.
- **Codex review round 1, first attempt: FAILED — no review happened.**
  `codex review --base main "<instructions>"` is refused by Codex CLI 0.153.2 with
  `the argument '--base <BRANCH>' cannot be used with '[PROMPT]'`. A branch review and custom instructions cannot
  be combined in `codex review`. Do not retry that form.
- **Codex review round 1, now running as two read-only reviews side by side:**
  - (a) `codex review --base main` — Codex's built-in reviewer, with no custom focus. Output goes to
    the scratchpad file `codex-review-1a-builtin.out`.
  - (b) `codex exec -s read-only -C <repo> -o <file> -` — fed the focused instructions
    (`codex-exec-prompt.md`, built from `codex-review-prompt.md` plus "read `git diff main...HEAD`
    yourself, change nothing"). Its final message goes to `codex-review-1b-focused.md`.
  - If the scratchpad is gone, rerun both with the same focus: stale instructions, hook correctness,
    move-ledgers safety, the audit script, schema against example, CI, and claims in README and
    CHANGELOG.
  - **Set aside (stopped by the lead):** both of those runs printed `reasoning effort: none` in their
    startup banner. That is this machine's Codex default, and it would likely give a shallow review.
    Both were stopped after about two minutes, before reporting anything.
  - **Rerun at high effort** by adding `-c model_reasoning_effort='"high"'` to both commands. Output
    goes to the scratchpad files `codex-review-1a-builtin-high.out` and
    `codex-review-1b-focused-high.md` (with `.log`). Always pass that setting for Codex reviews on this
    machine, and check the banner shows `reasoning effort: high`.
- **HAND-OVER (13 September, 18:43 BST): Codex is out of usage credit.** Both high-effort runs stopped
  with "You've hit your usage limit … try again at 9:30 PM". Neither produced a review. **No Codex
  review of this branch has happened.**
  - **Fallback, per the standing hand-over rule:** a read-only workflow (`fallback-review-ledger-clashes`).
    Five fresh Fable reviewers, one per risk area, none of them builders and none with any memory of
    building this. An Opus refuter per area then tries to disprove every finding, and only confirmed
    findings get fixed. The areas are: instructions, the hook, the move command, the checks/CI/schema,
    and README/CHANGELOG claims.
  - **This is NOT the independent cross-system review the owner's rule asks for.** Treat the branch as
    **not fully reviewed** until Codex has done a full catch-up review. Say so in every commit
    message and report until then.
  - **Go back to Codex after 21:30 BST.** Run a FULL review of the whole branch against `main`, not
    just the latest fixes: both forms, at high effort. A wake-up is booked for just after 21:30.
- **Known fixes the lead found**, deliberately NOT given to Codex so its review stays independent.
  Fix them in the same round as Codex's findings:
  1. CHANGELOG 1.5.0 says names are compared ignoring case "in the lookup order" too. Only Rule 2 of
     `hooks/guard-ledgers.sh` ignores case; its `.dev-team/` folder test is case-sensitive on purpose,
     and the lookup order says nothing about case.
  2. README "Upgrading from 1.4 or earlier" says "there's nothing you're required to do". That is wrong
     for old top-level files without the marker (CueRCode, Go2My.Link): the ownership rule makes a
     run stop and ask, and autopilot goes BLOCKED (`ledger-ownership`). Say so, and point to
     `/dev-team-move-ledgers`.
  3. The same section implies a hand-written `FEATURES.md` or `HANDOFF.md` is asked about. Under the
     command's rules, a file without a ledger's shape is "not ours" and left alone without a
     question; only look-alikes are asked about.
  4. README line ~141, the iterate skill's Cold-resume paragraph: "looks for a `PROJECT.md`" should
     be `.dev-team/PROJECT.md` (found through the lookup order).
- **When stage 3 reports,** follow the same steps as below, then run the Codex review loop:
  - `codex review --base main "<focus>"`;
  - fix what it finds with a Sonnet builder;
  - review again until a round comes back clean.
- **If Codex cannot run,** say so plainly in the commit message and report, use a fresh Opus reviewer that
  did not build anything, and treat the change as not fully reviewed.

The steps used after stage 2 (reuse them for stage 3):

1. Pull each builder's full report from the workflow's `journal.jsonl`, since the notification
   cuts long results short.
2. Rerun every check yourself:
   - `bash scripts/audit-model-ids.sh`
   - `bash tests/smoke-structure.sh`
   - `shellcheck scripts/*.sh hooks/*.sh tests/*.sh`
   - `bats tests/scripts.bats`
   - the scratchpad `check-ledger-mentions.sh` over every changed file
3. Read the diffs, not just the check results — at least the new `commands/dev-team-move-ledgers.md`,
   the hook fixes, and a sample of the document edits.
4. Commit each package on its own, adding only its files, in this order: the hook fixes, WP4, WP5a,
   WP5b, WP6, WP7. Then push.
5. Start stage 3: WP8 (README, CONTRIBUTING, tests/README, CHANGELOG, version 1.5.0), then WP3 (the
   self-check script and its tests), on Sonnet.

If the scratchpad has been cleared, the check script is gone. Its checks are described in plan.md
WP3 (checks C–F), so it can be recreated from there.

**WP3 moved to the end.** The self-check script's tests live in the same file as the hook's tests, and
they only pass once every document is updated. Building WP3 early would make each commit in between
fail its own tests, so it is built after WP8.

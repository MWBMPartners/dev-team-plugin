<!--
  File:    .claude/plans/ledger-file-clashes/plan-review.md
  Purpose: The lead's review of plan.md (issue #41), checked against the real files on 13 September 2026.
           Where this file and plan.md disagree, THIS FILE WINS. Builders read plan.md for the detail and
           this file for the corrections, the build order, and who edits which files.
-->

# Review of the plan — corrections, and how the build is split

## Settled decisions (no owner question needed)

| Question raised in plan.md section 7 | Decision | Why |
| --- | --- | --- |
| Move `HANDOFF.md` into `.dev-team/` too? | **Yes.** | The owner asked for "all of this plugin's docs" in `.dev-team/`. The analysis also found no AI tool reads a top-level `HANDOFF.md` automatically, and two projects have a hand-written one that auto-handoff would overwrite. |
| Version 1.5.0 or 2.0.0? | **1.5.0.** | Old files are still found through the lookup order, and no file format breaks. |
| Should hook Rule 1 (marker-bearing content written outside `.dev-team/`) stay on outside a run? | **Yes.** | Only content the plugin generated carries the marker, so it cannot block a person editing their own file. |

## Correction 1 — hook Rule 2 must not key on `.dev-team/autopilot.json`

**What plan.md says:** Rule 2 denies any Write/Edit/MultiEdit to a top-level file named `PROJECT.md`,
`FEATURES.md`, `SECURITY.md`, `VERIFICATION.md`, `MIGRATION.md`, `HANDOFF.md` or `verdict.json` whenever
`.dev-team/autopilot.json` exists (or `guard: on`, or `DEV_TEAM_GUARD` is set), without looking at the content.

**Why that is wrong:** `hooks/guard-dev-team.sh` line 21 treats "autopilot.json exists" as "a run is active".
But CueRCode, Go2My.Link and SIGNula.id keep `.dev-team/autopilot.json` committed in git, so in those
projects the file is *always* there. Rule 2 as written would then permanently stop the owner, or any
assistant, from editing that project's own top-level files. Two examples: Go2My.Link's hand-maintained
`HANDOFF.md`, which its `CLAUDE.md` names as the place to start, and a WebMS-Intra-style `FEATURES.md`
that the project's own rules say must be updated after every feature. Blocking a person's legitimate
edit to their own file is a worse failure than the one the rule prevents.

**Corrected Rule 2:**

- **When it is active:** only when `.dev-team/loop.lock/` exists, `guard: on` is set in
  `.dev-team/config.yml`, or `DEV_TEAM_GUARD` is set.
  - `loop.lock/` is created at the start of an autopilot cycle and removed at the end (see
    `skills/dev-team-autopilot/references/loop-runtime.md`), and it is ignored by git. That makes it a
    real "a cycle is running right now" signal, where `autopilot.json` is not.
  - `guard: off` disables Rule 2, exactly as it disables Rule 1.
- **What it blocks:** a Write, Edit or MultiEdit to one of these, and only when the *incoming content*
  looks like plugin output:
  - **Paths covered:** a top-level file with one of the seven ledger names, or `SECURITY.md` in
    `.github/` or `docs/`.
  - **What counts as plugin output:** the content contains the dev-team marker
    (`<!-- dev-team: ledger=` or `"dev-team": "ledger=`), or it contains a dev-team record number
    matching `\b(FG|F|B|G|V|I|M)-[0-9]{3}\b`.
  - **Which text is checked:** Write → `tool_input.content`; Edit → `tool_input.new_string`;
    MultiEdit → every `tool_input.edits[].new_string` joined together.
- **Why the content test:** the harm being prevented is the plugin putting its records into a project's
  file, as happened in SIGNula.id's `SECURITY.md`. A person's own edit to their own file does not carry
  dev-team record numbers or the marker, so it goes through.
- **What it still cannot do (say this in the script's header comment):**
  - It does not see a `cat >>` run through Bash.
  - It is a best-effort pattern match, never the guarantee.
  - The real protection is the plugin writing only into `.dev-team/`, plus the ownership rule.

**Replacement bats cases for Rule 2** (these replace plan.md WP2 cases 6, 7, 9 and 11; keep the others):

| Setup | Payload | Expect | What it proves |
| --- | --- | --- | --- |
| `.dev-team/autopilot.json` present, no lock | Write `HANDOFF.md`, plain text, no ids | 0 | A committed autopilot.json alone never blocks your own file |
| `.dev-team/autopilot.json` present, no lock | Edit `SECURITY.md`, `new_string` contains `F-001` | 0 | Rule 2 is off without a live cycle |
| `.dev-team/loop.lock/` present | Edit `SECURITY.md`, `new_string` contains `F-001` | 2 | The SIGNula.id failure is blocked mid-cycle |
| `.dev-team/loop.lock/` present | Edit `FEATURES.md`, `new_string` "Added the Forms app" | 0 | A project's own feature list can still be updated mid-cycle |
| `.dev-team/loop.lock/` present | Write `.github/SECURITY.md`, content contains `FG-012` | 2 | GitHub's security-policy locations are covered |
| `.dev-team/loop.lock/` present | MultiEdit `PROJECT.md`, second edit's `new_string` contains `B-004` | 2 | MultiEdit is checked across all its edits |
| config `guard: on`, no lock | Write `PROJECT.md`, content contains `B-001` | 2 | `guard: on` forces the rule on |
| config `guard: off`, lock present | Edit `SECURITY.md`, `new_string` contains `F-001` | 0 | `guard: off` wins |

## Correction 2 — work out paths from the hook's own input, not only `$PWD`

Claude Code sends the session's working folder as `cwd` in the hook's input. When `tool_input.file_path`
is absolute:

1. Strip a leading `"$cwd/"`, falling back to `"$PWD/"` when `cwd` is missing.
2. Strip a leading `./`.
3. Read `.dev-team/config.yml` and `.dev-team/loop.lock/` relative to `cwd` when it is present,
   otherwise relative to the current folder.

This follows the same fail-open posture as today: missing `jq`, missing fields, or anything unparseable
means allow (exit 0). Add a bats case with an absolute path under `$SCRATCH` and `cwd` set to `$SCRATCH`.

## Correction 3 — the order commits land in

The `plugin-audit` workflow runs only on pull requests and on pushes to `main` (checked in
`.github/workflows/plugin-audit.yml`), so part-finished commits on the working branch do not fail CI.
Even so, `scripts/audit-ledger-paths.sh` (WP3), its bats tests, and its CI step are **committed last**,
after WP8. That way each commit on the branch passes the checks that exist at that point.

## Correction 4 — who edits which files (so builders working at the same time never touch the same file)

Builders **do not commit**. The lead commits each work package separately, adding only that package's files.

| Stage | Package | Model | Files this builder may edit — and no others |
| --- | --- | --- | --- |
| 1 | WP1 | Opus | `skills/dev-team-orchestrator/references/conventions.md` |
| 1 | WP2 + WP3 + WP9 | Sonnet | `hooks/guard-ledgers.sh` (new), `hooks/hooks.json`, `scripts/audit-ledger-paths.sh` (new), `schemas/verdict.schema.json` (new), `tests/fixtures/verdict.sample.json` (new), `tests/scripts.bats`, `tests/smoke-structure.sh`, `.github/workflows/plugin-audit.yml` |
| 2 | WP4 | Sonnet | every file under `skills/dev-team-orchestrator/` except `conventions.md` |
| 2 | WP5 | Sonnet | every file under `skills/*/references/` outside `dev-team-orchestrator/` |
| 2 | WP6 | Sonnet | `agents/*.md`, and every `skills/*/SKILL.md` except `dev-team-orchestrator/SKILL.md` |
| 2 | WP7 | Opus | `commands/*.md` (including new `commands/dev-team-move-ledgers.md`) |
| 3 | WP8 | Sonnet | `README.md`, `CONTRIBUTING.md`, `tests/README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json` |

Notes on that split:

- The `config-and-toggles.md` edits listed under WP2 in plan.md move to WP4. It is the same file, and
  WP4 runs after WP1 has fixed the wording.
- Stage 2 starts only after WP1 is finished, because WP4–WP7 copy WP1's wording word for word.
- The README, CONTRIBUTING and tests/README mentions of the new hook, audit script and schema, which
  plan.md scatters across WP2, WP3 and WP9, are all done in WP8.

## Follow-ups to record as separate issues (not built in this change)

1. **Security findings are committed to the repository.** Moving them into `.dev-team/SECURITY.md` does
   not make them private, so a public repository publishes its findings and proof-of-concept details.
   This needs its own decision.
2. **`autopilot.json` has no schema.** Its documented example contains `//` comments, so it cannot be
   validated as it stands.
3. **The existing Bash guard is always on in some projects.** `hooks/guard-dev-team.sh` uses
   "`autopilot.json` exists" as its "a run is active" test, so it is permanently on in projects that
   commit that file. That is mostly harmless for its current rules (blocking a push to `main`, and a
   live Stripe key), but it is the same weakness as Correction 1.
4. **SIGNula.id needs a hand fix in its own repository.** Lines 144 onward of its top-level `SECURITY.md`
   need cutting by hand into `.dev-team/SECURITY.md`. That work belongs to SIGNula.id, not this plugin.

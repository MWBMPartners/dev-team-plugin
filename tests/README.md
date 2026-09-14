# tests/

Self-tests for the dev-team plugin's shell surface: `scripts/*.sh` and `hooks/*.sh`. These are
structural + behavioral checks on the plugin repo itself, not on a project the plugin is used in.

## What's here

- **`smoke-structure.sh`** — pure-bash structural smoke test. Confirms the plugin would actually
  deliver its components to an installer: `agents/` has the 5 endpoint files with the required
  frontmatter (`name:`, `description:`, `model:`, `tools:`); no stray `.claude/agents/` dir;
  every `commands/*.md` starts with a `---` frontmatter block containing `description:`;
  `hooks/hooks.json` is valid JSON and every `command` path it references exists on disk and is
  executable; every `skills/*/SKILL.md` exists with `name:` + `description:` frontmatter; both
  `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` are valid JSON. No network,
  no external deps beyond `jq`. Prints `SMOKE OK` and exits 0 on success; prints one or more
  `SMOKE FAIL: <reason>` lines on stderr and exits non-zero otherwise. Two checks added for this
  change: `hooks/hooks.json` must have a `PreToolUse` entry whose `matcher` covers `Write` — so a
  future edit that narrows the matcher can't silently stop `hooks/guard-ledgers.sh` from firing
  without anyone noticing; and every `schemas/*.schema.json` file must itself be valid JSON and
  carry a top-level `$schema`, `title`, and `description` (a structural check only — it confirms a
  schema file is well-formed, not that any particular data file matches it, which is what the
  `verdict-schema` tests in `scripts.bats`, below, are for).

- **`scripts.bats`** — [bats-core](https://github.com/bats-core/bats-core) behavioral tests for
  `scripts/audit-model-ids.sh`, `scripts/audit-ledger-paths.sh` (see its own section below),
  `hooks/guard-dev-team.sh` (including the `.dev-team/config.yml`
  `guard:` toggle matrix and every bypass/allow case), `hooks/guard-ledgers.sh` (see its own
  section below), `hooks/check-update.sh` (including the `update-notifier:` config toggle),
  `hooks/sync-branches-check.sh` (including the `branch-notifier:` config toggle),
  `scripts/branch-hygiene.sh`, the `schemas/verdict.schema.json` + `scripts/check-verdict.sh`
  validation tests (see below), text checks on `commands/dev-team-move-ledgers.md` and on the
  canonical ownership sentence in `conventions.md` (both described in their own sections below), and
  two closing tests on this file itself (see "This file's own hygiene", below). Every test that
  needs an isolated `.dev-team/config.yml` or a directory with no `.dev-team/autopilot.json` runs
  from a fresh per-test scratch directory (`$SCRATCH`, never the repo root), so the suite never
  leaves stray files behind.

  **No test in this file writes to, or deletes anything from, the real repository** (`$REPO_ROOT`).
  This was not always true — see "Fault fixed (finding 11)" below — and two tests at the very bottom
  of the file now grep the file itself to keep it that way.

  **Fault fixed (issue #41, Codex round 3, finding 11):** this file used to inject failures straight
  into the real repository — a dated-model-id file written under `tests/`, a real
  `.claude/agents/` directory created, a fixture written under
  `skills/dev-team-orchestrator/references/` — and `teardown()` ran
  `rm -rf "$REPO_ROOT/.claude/agents"` unconditionally after **every single test**, whether or not
  that test had created anything to clean up. A contributor who keeps their own `.claude/agents/`
  folder in their checkout (nothing stops that — `.claude/` is only partly tracked; see
  `git ls-files .claude`) would have had it silently deleted the first time they ran `bats
  tests/scripts.bats`. The fix is a helper, `make_tree()`, defined near the top of the file: it
  copies the whole repository (minus `.git`) into `$SCRATCH/tree` with `tar`, and every test that
  needs to inject a fault now calls it first and runs the script being tested against `$TREE`
  instead of `$REPO_ROOT`. Both audit scripts `cd` to their own script's parent directory before
  doing anything else, so running the copy's script audits the copy — the real repository is only
  ever **read** (to make the copy), never written to or deleted from, and there is nothing left to
  clean up beyond the `$SCRATCH` removal every test already gets from `teardown()`.

### `scripts/audit-ledger-paths.sh` — the stale-ledger-path audit

This is the plugin's self-check for issue #41: it fails if any skill, command, agent or README
line still tells a writer to put one of the seven dev-team ledgers (`PROJECT.md`, `FEATURES.md`,
`SECURITY.md`, `VERIFICATION.md`, `verdict.json`, `MIGRATION.md`, `HANDOFF.md`) at the old
top-level location instead of `.dev-team/<name>` with its ownership marker. It runs the same
`note()` / `AUDIT OK`-style pattern as `audit-model-ids.sh`, over `skills/`, `commands/`, `agents/`,
`hooks/`, `README.md` and `CONTRIBUTING.md` only — never `CHANGELOG.md` (released history is never
rewritten), `.claude/` (this repo's own working notes), or `tests/` (fixtures may deliberately
contain the old phrasing as the thing being tested). Seven checks, spelled out in the script's own
header comment: (A) `conventions.md` still states every `.dev-team/` path and the "Where the
plugin writes" heading; (B) each ledger's own schema-defining reference file states its path and
marker; (C) a "repo root" / "repo-root" / "sibling to" line that still names a ledger once every
correct `.dev-team/<name>` mention on that line is stripped out; (D) a backticked or quoted anchor
with no `.dev-team/` prefix (e.g. `` `PROJECT.md#Backlog` ``); (E) the exact legacy phrases used
before this change ("stable repo-root", "at the repo root", "Check the repo root", "from repo
root") on a line where THAT line, or the line just before or after it, still names a ledger with no
`.dev-team/` prefix (see "Finding 10", below, for why it looks at neighbouring lines rather than
just the one line); (F) the retired `<!-- dev-team-schema:` marker text appearing outside a line
that explains it as legacy; (G) README.md only — a skill description line (one starting
`**Purpose.**`, `**Modes.**`, `**Artifacts.**` or `**Cold-resume.**`) that still names a ledger with
no `.dev-team/` prefix. Any line containing the phrase "legacy root" is exempt from C, D, E and G —
that phrase is the one allowed way to talk about the old location in running prose — and check F is
exempt on the wider word "legacy" alone. Prints `LEDGER-PATHS OK` and exits 0 on success, or one or
more `LEDGER-PATHS FAIL: <reason>` lines on stderr and exits 1. **What it cannot do:** it checks the
exact phrases and patterns above, in the plugin's own files only — a stale instruction worded some
genuinely new way can still pass, and it never looks at a user's project.

**Finding 10 (issue #41, Codex round 3):** check E used to fire on the legacy repo-root phrases
ALONE, with no test at all for whether a ledger was actually being talked about — so it rejected
ordinary, unrelated sentences that merely happened to contain a phrase like "at the repo root" (for
example a sentence about config files, with nothing to do with any dev-team ledger). Check E now
only fires when a bare ledger name shows up on the SAME line as the phrase, or the line immediately
before or after it (a wrapped sentence often puts the name on the line above), once every correct
`.dev-team/<name>` mention has been stripped away first.

The bats tests for it, each run against a throwaway COPY of the repository under `$TREE` (see
"Fault fixed (finding 11)", above — never against the real repository): (i) it passes on the clean
repo (this one test still runs the real script, read-only); (ii)-(vii) one file injected under
`skills/dev-team-orchestrator/references/.tmp-ledger-audit.md` per negative check, each built to
trip exactly one of C, D, E or F and asserting that check's own label (`LEDGER-PATHS FAIL: C:`, and
so on) appears in the output — check C ("Put `` `HANDOFF.md` `` sibling to package.json."), check D
("See `` `SECURITY.md#Findings` `` for the full register."), check E in its now-fixed form — one
test confirming the harmless "Config files used to live at the repo root before this project
reorganised its layout." sentence now PASSES the audit (it used to be asserted as a failure — see
"Finding 10" above for why that was backwards), and a second confirming E still fires when a bare
ledger name sits on the line just before the phrase ("The documentarian keeps `` `PROJECT.md` ``" /
"at the repo root.", on two separate lines) — and check F ("This file still uses
`<!-- dev-team-schema: 1.0 -->` in one place." — the old marker text with no word "legacy" nearby).
**Check G has no dedicated bats test yet** — it was added in the same round as this file's other
fixes (issue #41, Codex round 3, finding 9), by a different builder working on the script itself,
and adding G's own fault-injection test was assigned to a later round; until then, G's correctness
rests on the same "passes on the clean repo" test as everything else in this script.

Fault found by a later reading of these tests: the two negative cases that used to exist here
injected a single sentence — "The documentarian writes `` `PROJECT.md` `` at the repo root." — that
trips BOTH check C (a "repo root" line naming a bare ledger) and check E (the exact legacy phrase
"at the repo root") at the same time. A test asserting only `LEDGER-PATHS FAIL` (with no check
letter) passing proved that *one* of the checks fired, never *which* — so a change that broke check
C while check E still fired, or the reverse, would pass unnoticed. Check F, meanwhile, had no test
at all. Each sample above was run once through the real script from a scratch copy of the repo
before being written into this file, to confirm it trips only its own check and no other.

### `commands/dev-team-move-ledgers.md` — text checks on the migration command (findings 1-4)

`dev-team-move-ledgers.md` is instructions for the model to follow, not a script — there is nothing
to run it against, so its tests confirm the file's wording still says what four Codex round 3
findings required, plus a handful of tests on the real `git` behaviour those instructions rely on
(each built in its own throwaway repo under `$SCRATCH`, never `$REPO_ROOT`):

- **Finding 1** (the mixed group, "(d)", used to be checked AFTER the look-alike group, "(b)", so a
  real product document with the plugin's own records appended to it could match (b)'s shape test on
  its first record and be offered for moving and stamping whole): a test confirms (d) is now checked
  before (b), by line number; a second confirms the old "Checked before (c)" wording (which never
  mentioned (b)) is gone; a third confirms the report now uses the two-way wording ("either an old
  ledger with no marker... or a project document with records added...") instead of the old one-way
  "needs a person to cut it by hand".
- **Finding 2** (a legacy root file git ignores looks clean to `git status`, but `git mv` fails on it
  partway through a move): a test confirms the file now runs `git ls-files --error-unmatch` as a
  preflight check; a git-behaviour test proves the underlying fact — an ignored, committed-gitignore
  file passes the clean-tree check yet is refused by `git ls-files --error-unmatch`.
- **Finding 3** (`git reset --hard` can destroy an edit some OTHER program made to the working tree
  while the command's own questions were being asked): a test confirms every remaining mention of
  `reset --hard` sits inside a sentence explaining it was rejected, never as a live instruction; a
  second confirms the working tree is checked again after the questions are answered; a
  git-behaviour test proves the replacement mechanism — restoring only the specific paths this
  command touched (`git restore --source=<H0> ...` plus a targeted `git rm --cached`/`rm -f`/`rmdir`)
  undoes the command's own rename and edit while leaving a foreign edit to an unrelated file alone.
- **Finding 4** (a declined pointer sentence can write an ignored `.dev-team/config.yml` that
  `git add` then refuses, leaving an uncommitted file `git status` cannot even see): a test confirms
  the ignore check now names `config.yml`; a second confirms it skips paths that are already tracked
  (refusing those would be wrong — a tracked file accepts `git add` even when it matches an ignore
  pattern); a git-behaviour test proves both halves of that fact in one throwaway repo.

### `conventions.md` — the canonical ownership sentence (finding 8)

One sentence — "Every record file the dev-team suite writes for itself lives in `.dev-team/`..." —
is meant to read identically in `conventions.md` (its canonical home) and six other files that quote
it. One test asserts the exact sentence appears, byte-for-byte, in exactly 7 files under `agents/`,
`commands/` and `skills/`; that the sentence's old, too-broad wording ("Every file the dev-team suite
writes for itself...", which read as covering `autopilot.json`, `config.yml`, `loop.lock/` and
`.gitignore` too, none of which can carry a line-2 marker) is gone everywhere; and that the rule's
own old phrase ("any file in the Shared artifacts table") survives only inside the one deliberate
"*Earlier wording:*" footnote that explains, on purpose, why the rule was narrowed — never anywhere
else, where it would read as a live instruction again.

### `hooks/guard-ledgers.sh` — the ledger guard's test matrix

This hook (PreToolUse on `Write`/`Edit`/`MultiEdit`) is the second, independent layer behind the
written rule in `conventions.md`, "Where the plugin writes, and the ownership rule": it stops a
mistaken write into a project's top-level file before it happens. It checks two separate things,
and the test matrix is split the same way:

- **Rule 1 (marker content, ledger file name, written outside `.dev-team/`) — on all the time
  unless `guard: off`.** Fires only when all three hold: the content carries the marker on one of
  its first three lines; the target's file NAME (case ignored) is one of the seven ledger names
  plus `README.md`; the resolved path lands outside `.dev-team/`. Cases cover: a `Write` whose
  content carries the dev-team marker on line 2 aimed at a top-level path with a ledger name is
  denied; the identical content aimed at a `.dev-team/` path (relative or absolute) is allowed; a
  marker further down the file (past the first three lines) does not trip the check; a plain file
  with no marker is never blocked, whatever the path; a ledger-named file elsewhere in the tree,
  outside `.dev-team/` (`docs/FEATURES.md`), is still denied; **this plugin's own test fixture,
  `tests/fixtures/verdict.sample.json`, is never blocked even though its real content starts with
  the marker on line 2** — its file name is "verdict.sample.json", not "verdict.json", so it fails
  the name test and Rule 1 never fires (see the fault note in the bats file); marker content aimed
  at any other non-ledger file name (`notes/plan.md`) is likewise allowed; `guard: off` in
  `.dev-team/config.yml` allows a ledger-named file even with a genuinely active run
  (`.dev-team/loop.lock/` actually present — see the fault note below); both the spaced and
  compact-JSON forms of the `verdict.json` marker (`"dev-team": "ledger=..."` and
  `"dev-team":"ledger=..."` with no spaces at all) are recognised. **`README.md` cases (fault found
  by a stand-in review):** the plugin's own fixed `.dev-team/README.md` carries the marker too
  (conventions.md, "Where the plugin writes", point 7), and `README.md` was missing from Rule 1's
  name list — so that marker-bearing text, written to a project's top-level `README.md` by mistake,
  used to pass straight through and would have overwritten the project's real README. Three cases
  check this: the readme marker on a top-level `README.md` is denied; the identical content at
  `.dev-team/README.md` is allowed; and, to prove `README.md` was deliberately left OFF Rule 2's
  separate name list (Rule 2 also fires on a bare record id with no marker, and an ordinary project
  README mentioning something like "F-001" in passing must never be blocked for that), editing
  `README.md` to add "see F-001" is still allowed even with `.dev-team/loop.lock/` present.
- **Rule 2 (a write to a top-level ledger name during an active run) — only while
  `.dev-team/loop.lock/` exists, `guard: on` is set, or `DEV_TEAM_GUARD` is set.** Cases cover: a
  **committed** `.dev-team/autopilot.json` present with no lock never triggers it, on its own,
  against a plain edit of `HANDOFF.md` or `FEATURES.md` — that is deliberate, because some real
  projects keep `autopilot.json` committed in git, so its mere presence must never be read as "a
  cycle is running"; with `.dev-team/loop.lock/` actually present, a write to a top-level
  `SECURITY.md`/`FEATURES.md`/`PROJECT.md` carrying the dev-team marker or a record id (`F-001`,
  `FG-012`, `B-004`, …) is denied, while the project's own edit to the same file with no marker and
  no ids goes through; `SECURITY.md` in `.github/` or `docs/` is covered too (GitHub's own
  security-policy locations); a lower-case `security.md` or mixed-case `Features.md` is caught the
  same as the canonical spelling, because some filesystems (macOS, by default) treat them as the
  same file on disk; a `MultiEdit` is checked across every one of its edits, not just the first;
  `guard: on` forces Rule 2 on with no lock file present, and `guard: off` wins even with a lock
  file present.
- **Path normalisation (both rules).** Fault found by a later reading of the hook: stripping a
  leading `<cwd>/` (or `$PWD/`) and a leading `./` was done ONCE each, which is one pass, not a
  resolution — a path spelled with `.` or `..` segments walked straight past both rules.
  `.dev-team/../SECURITY.md` used to be let through as if it were inside `.dev-team/` (a literal
  string match on the prefix, ignoring what the path actually resolves to); with
  `.dev-team/loop.lock/` present, an `Edit` adding `F-001` to `././SECURITY.md` used to be allowed,
  because only the first `./` was ever stripped. The hook now resolves the path lexically — splits
  on `/`, drops empty and `.` pieces, and for each `..` removes the piece before it — before either
  rule looks at it. Cases cover both rules: `.dev-team/../SECURITY.md` (Rule 1, marker `Write`)
  resolves to the top level and is denied; `.dev-team/./FEATURES.md` (Rule 1, marker `Write`) still
  resolves inside `.dev-team/` and is allowed; `././SECURITY.md` and `a/b/../../PROJECT.md` (Rule 2,
  `Edit` with a record id and `loop.lock/` present) both resolve to a bare top-level ledger name and
  are denied. A case with an absolute `file_path` under the test's own scratch directory and a
  matching `cwd` field confirms the hook resolves paths against the session's own working folder
  from the hook's JSON input, not the test runner's process directory.

  **Fault found by a stand-in review of the round above, on the resolver's ALLOW direction:** two of
  the cases that were meant to prove resolution works did not actually depend on it. The old
  `docs/../FEATURES.md` case (now simplified to plain `docs/FEATURES.md`, since the resolved `..`
  makes no difference to it — that file's base name is `FEATURES.md` either way, sitting outside
  `.dev-team/` whether or not `docs/..` is ever walked back out) and `.dev-team/./FEATURES.md`
  (whose raw text already starts with `.dev-team/` before any resolution happens) both passed on the
  hook as it stood **before** path resolution was added (commit `0a2f286~1`), so neither one could
  have caught a broken resolver. The old `docs/../FEATURES.md` test is replaced with a new one:
  `docs/../.dev-team/FEATURES.md` (Rule 1, marker `Write`) resolves INTO `.dev-team/` and is
  allowed — a case that only passes when `docs/..` is genuinely walked back out and
  `.dev-team/FEATURES.md` genuinely walked back in. Confirmed against the pre-resolution hook
  (`0a2f286~1`), which refuses this same payload with exit 2 — see the builder's report for issue
  #41, N6, for that command and its output.

  **Fault found by the same review, under macOS's stock `/bin/bash` (3.2):** resolve_lexical's last
  line joined the resolved path pieces back together with `echo "${parts[*]}"`. For any `file_path`
  that resolves to NOTHING — every segment being `.`, `..`, or empty, as with `.`, `..`, `/`, or
  `SECURITY.md/..` — the array of pieces ends up empty, and bash 3.2's `set -u` treats expanding an
  empty array with `${parts[*]}` as an unbound variable (bash 4.4+ does not have this problem). The
  write was still allowed either way — an empty `$resolved` matches no rule below — but the hook
  printed `line 188: parts[*]: unbound variable` to stderr, which looks exactly like the hook itself
  being broken. Two cases (`file_path` `..` and `SECURITY.md/..`, both `Write`s) check the exit code
  AND that stderr is silent, using bats-core's `run --separate-stderr` (requires bats-core ≥ 1.5.0,
  declared at the top of the file with `bats_require_minimum_version 1.5.0`) so stdout and stderr
  are captured apart rather than merged into one string. The join now falls back to an empty string
  when the array is empty (`"${parts[*]:-}"`, which bash 3.2 accepts) and uses `printf` instead of
  `echo`, so a path whose only real segment is text like `-n` or `-e` is never read as an echo
  option.

  **Fault found by the same review, on an absolute path outside the project:** a `file_path` that
  is still absolute after the `<cwd>/`(or `$PWD/`) strip — meaning it names somewhere outside the
  project's own working folder entirely, such as `/.dev-team/SECURITY.md` with `cwd` set to some
  unrelated folder — used to have its leading `/` read as just another empty split piece and
  dropped, resolving to the plain text `.dev-team/SECURITY.md` and wrongly judged to be inside THIS
  project's own `.dev-team/`. The path is now marked as having left the project (same treatment as
  a runaway `..`), so Rule 1 judges it by file name alone and denies it. Two cases: an absolute path
  outside `cwd` starting with `/.dev-team/` (Rule 1, marker `Write`) is denied by file name; the
  companion case, an absolute path genuinely inside `cwd`'s own `.dev-team/`, is still allowed —
  proving the fix does not also start refusing legitimate absolute paths.

- **A session started in a SUBFOLDER of the repository (issue #41, Codex round 3, finding 5).**
  Fault found by review: the hook used to take the payload's `cwd` AS the project's top folder.
  From a subfolder that went wrong in both directions — a harmful write to the real top-level
  `SECURITY.md` (given as an absolute path, or as `../SECURITY.md`) counted as "outside the
  project" and was let through, the top-level `.dev-team/loop.lock/` and `.dev-team/config.yml`
  were never found (so `guard: off` was ignored), and the plugin's own correct write to the
  absolute `<top>/.dev-team/SECURITY.md` was wrongly refused. The hook now asks git
  (`rev-parse --show-prefix`, deliberately not `--show-toplevel` — see the hook's own comment for
  why that would break on macOS's `/private/var` vs `/var` split) where the working folder sits
  inside the repository, and judges paths, config and the lock against the TOP folder it works out
  from that. Each test builds its own throwaway git repository under `$SCRATCH` with a `src`
  subfolder and passes `cwd` pointing at that subfolder, exactly as Claude Code would for a session
  started there. Cases cover: the top-level `SECURITY.md` is still protected from a subfolder,
  whether given as an absolute path or as `../SECURITY.md`; the plugin's own correct
  `.dev-team/` writes from a subfolder (absolute and relative) are still allowed; `guard: off` set
  at the top level is honoured from a subfolder; a bare relative name from a subfolder (really
  `src/SECURITY.md`) is correctly NOT treated as the top-level file; two levels deep
  (`src/deep`, `../../SECURITY.md`) still resolves correctly. One case deliberately runs with **no**
  `git init` at all, to pin the documented remaining limit: outside a git repository, a session
  started in a subfolder is still judged as if that subfolder were the top — this test first checks
  that `$SCRATCH` is not itself accidentally sitting inside some outer repository on the machine
  running the suite, and skips rather than passing for the wrong reason if it is.

- **The legacy (pre-v1.5.0) marker (issue #41, Codex round 3, finding 7).** Fault found by review:
  `conventions.md` still accepts the legacy marker, `<!-- dev-team-schema: 1.0 -->`, as proof that
  the plugin owns a file (point 3) — but the hook's marker pattern only recognised the current
  marker forms, so a `Write` (or, mid-cycle, an `Edit`) carrying only the legacy marker to a
  top-level ledger name passed straight through both rules. The pattern now includes the legacy
  marker too. Cases cover: the legacy marker on a top-level `SECURITY.md` Write is denied; the
  identical content at `.dev-team/SECURITY.md` is allowed; a legacy marker on line 10 only (past
  the first-three-lines check) does not trip Rule 1; and, for Rule 2, an `Edit` adding the legacy
  marker to a top-level `FEATURES.md` mid-cycle (with `.dev-team/loop.lock/` present) is denied.

### `schemas/verdict.schema.json` + `scripts/check-verdict.sh` — verdict validation

Two long-standing tests check `tests/fixtures/verdict.sample.json` against
`schemas/verdict.schema.json` using **check-jsonschema** (a Python tool:
`brew install check-jsonschema`, or `pipx install check-jsonschema` where Homebrew isn't available):
the fixture itself validates, and a copy with `overall` changed to an invalid value (`"MAYBE"`)
fails validation. Every `check-jsonschema` test in this section **skips** (never fails) when
`check-jsonschema` isn't installed, so a contributor without it still gets a green local run — CI
always has it (installed via `pipx` in `plugin-audit.yml`'s `test` job), so a schema-breaking change
is still caught before merge.

**Findings 12 and 13 (issue #41, Codex round 3):** before this fix, the schema accepted verdict
shapes that `verdict-and-report-protocol.md`'s own "Overall verdict rule" already calls
impossible — for example `overall: PASS` while the clean-room integration check failed, or
`overall: PASS_WITH_GAPS` with a critical `FAILED` claim. The schema now carries three `allOf` rules
that reject exactly those shapes (see the schema's own top-level `$comment` for the reasoning), and
finding 13's wrong wording in the `severity` field's description ("A FAILED or DRIFTED claim at
critical severity is what forces FAIL" — wrong; a critical `DRIFTED` claim rules out `PASS` but does
not force `FAIL`) is corrected to match the protocol and the sample fixture's own `V-003`. Nine new
fixtures under `tests/fixtures/` (`verdict.invalid-*.json` and `verdict.valid-fail-critical-failed.json`)
each break, or deliberately satisfy, exactly one rule; the tests here check each one against
`check-jsonschema`, confirm the protocol document's own worked JSON example validates, and confirm
the old wrong wording is gone from the schema file.

Four further invariants cannot be expressed in JSON Schema at all — comparing a COUNT of array
entries to another field, or one claim's field against another claim's field — so
`scripts/check-verdict.sh` (a new, separate script; run it AFTER `check-jsonschema`, never instead
of it) checks those: the `claims` array has exactly `checked` entries; the five per-verdict counts
add up to `checked`; each count matches the number of claims actually carrying that verdict word;
every claim `id` is unique. It exits 0 and prints `VERDICT-CHECK OK` when every rule holds, 1 with a
named `VERDICT-CHECK FAIL: <reason>` line per broken rule, or **2** — a refusal, not a pass — when it
cannot even attempt the checks (no argument, an unreadable file, invalid JSON, or `jq` missing from
`PATH`). The bats tests here (which need `jq`, and skip when it's absent) check the sample fixture
passes; each of the four checked-mismatch/count-mismatch/duplicate-id/empty-claims fixtures fails
with the right named reason; a missing file and a `PATH` with no `jq` on it (a throwaway directory
holding nothing but a symlink to `bash`) are both refused with exit 2, never silently treated as a
pass.

### This file's own hygiene (finding 11)

The last two tests in `scripts.bats` grep the test file itself: one confirms no test contains an
`rm -rf`/`rm -r`/`rm -f` command targeting `$REPO_ROOT`, the other confirms no test writes a file
straight into `$REPO_ROOT` with a shell redirect. Both patterns are built with a small string split
in the test's own source so that the test does not flag its own definition line while still
catching the real thing. These are a deliberate pin on the fix for finding 11 (see "Fault fixed
(finding 11)", above): a future test added carelessly, in the old style this file used to use, would
delete or overwrite a real path in this repository on every run — including a contributor's own
untracked files — and these two tests are what stop that pattern from quietly coming back.

## Running locally

```bash
# Model-id + stale-ledger-path audits (bash only)
bash scripts/audit-model-ids.sh
bash scripts/audit-ledger-paths.sh

# Structural smoke test (bash only, needs jq for the JSON checks)
bash tests/smoke-structure.sh

# Behavioral tests (needs bats-core: brew install bats-core, or apt-get install bats)
# The schema-validation cases inside this file skip themselves if check-jsonschema
# isn't installed: brew install check-jsonschema, or pipx install check-jsonschema.
# The check-verdict.sh cases need jq (already required elsewhere in this suite) and skip if it's
# missing.
bats tests/scripts.bats

# scripts/check-verdict.sh can also be run directly against any verdict.json, after
# check-jsonschema has passed it (needs jq)
bash scripts/check-verdict.sh tests/fixtures/verdict.sample.json

# Shellcheck across every shell script the plugin ships
shellcheck scripts/*.sh hooks/*.sh tests/*.sh
```

All of these should be run before opening a PR that touches `scripts/`, `hooks/`, `schemas/`,
`skills/`, `commands/`, `agents/`, or `tests/`.

## What CI runs

`.github/workflows/plugin-audit.yml` runs the two audit scripts as the `audit` job
(`scripts/audit-model-ids.sh` then `scripts/audit-ledger-paths.sh`), and the smoke test,
shellcheck, and bats as the `test` job, on every pull request and on push to `main`. Both `audit`
and `test` are required checks.

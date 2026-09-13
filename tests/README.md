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
  `scripts/branch-hygiene.sh`, and the `schemas/verdict.schema.json` validation tests (see below).
  Every test that needs an isolated `.dev-team/config.yml` or a directory with no
  `.dev-team/autopilot.json` runs from a fresh per-test scratch directory (never from the repo
  root), so the suite never leaves stray files behind. The `audit-model-ids.sh` and
  `audit-ledger-paths.sh` cases that inject a failure directly into this repo (a dated model id, a
  fake `.claude/agents/` dir, a stale ledger-path sentence) always clean up afterward, including in
  `teardown()` if an assertion fails first.

### `scripts/audit-ledger-paths.sh` — the stale-ledger-path audit

This is the plugin's self-check for issue #41: it fails if any skill, command, agent or README
line still tells a writer to put one of the seven dev-team ledgers (`PROJECT.md`, `FEATURES.md`,
`SECURITY.md`, `VERIFICATION.md`, `verdict.json`, `MIGRATION.md`, `HANDOFF.md`) at the old
top-level location instead of `.dev-team/<name>` with its ownership marker. It runs the same
`note()` / `AUDIT OK`-style pattern as `audit-model-ids.sh`, over `skills/`, `commands/`, `agents/`,
`hooks/`, `README.md` and `CONTRIBUTING.md` only — never `CHANGELOG.md` (released history is never
rewritten), `.claude/` (this repo's own working notes), or `tests/` (fixtures may deliberately
contain the old phrasing as the thing being tested). Six checks, spelled out in the script's own
header comment: (A) `conventions.md` still states every `.dev-team/` path and the "Where the
plugin writes" heading; (B) each ledger's own schema-defining reference file states its path and
marker; (C) a "repo root" / "repo-root" / "sibling to" line that still names a ledger once every
correct `.dev-team/<name>` mention on that line is stripped out; (D) a backticked or quoted anchor
with no `.dev-team/` prefix (e.g. `` `PROJECT.md#Backlog` ``); (E) the exact legacy phrases used
before this change ("stable repo-root", "at the repo root", "Check the repo root", "from repo
root"); (F) the retired `<!-- dev-team-schema:` marker text appearing outside a line that explains
it as legacy. Any line containing the phrase "legacy root" is exempt from C, D and E — that phrase
is the one allowed way to talk about the old location in running prose — and check F is exempt on
the wider word "legacy" alone. Prints `LEDGER-PATHS OK` and exits 0 on success, or one or more
`LEDGER-PATHS FAIL: <reason>` lines on stderr and exits 1. **What it cannot do:** it checks the
exact phrases and patterns above, in the plugin's own files only — a stale instruction worded some
genuinely new way can still pass, and it never looks at a user's project.

The bats tests for it: (i) it passes on the clean repo; (ii) a file injected under
`skills/dev-team-orchestrator/references/.tmp-ledger-audit.md` containing "The documentarian writes
`` `PROJECT.md` `` at the repo root" fails with `LEDGER-PATHS FAIL`; (iii) a file containing
`` `SECURITY.md#Findings` `` (a ledger anchor with no `.dev-team/` prefix) also fails. Both injected
files are removed immediately after the assertions and again in `teardown()`, the same
belt-and-braces cleanup as the `audit-model-ids.sh` injection tests above.

### `hooks/guard-ledgers.sh` — the ledger guard's test matrix

This hook (PreToolUse on `Write`/`Edit`/`MultiEdit`) is the second, independent layer behind the
written rule in `conventions.md`, "Where the plugin writes, and the ownership rule": it stops a
mistaken write into a project's top-level file before it happens. It checks two separate things,
and the test matrix is split the same way:

- **Rule 1 (marker content written outside `.dev-team/`) — on all the time unless `guard: off`.**
  Cases cover: a `Write` whose content carries the dev-team marker on line 2 aimed at a top-level
  path is denied; the identical content aimed at a `.dev-team/` path (relative or absolute) is
  allowed; a marker further down the file (past the first three lines) does not trip the check; a
  plain file with no marker is never blocked, whatever the path; `guard: off` in
  `.dev-team/config.yml` allows it even with an active run; both the spaced and compact-JSON forms
  of the `verdict.json` marker (`"dev-team": "ledger=..."` and `"dev-team":"ledger=..."` with no
  spaces at all) are recognised.
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
- **Path handling.** A case with an absolute `file_path` under the test's own scratch directory and
  a matching `cwd` field confirms the hook resolves paths against the session's own working folder
  from the hook's JSON input, not the test runner's process directory.

### `schemas/verdict.schema.json` — schema validation tests

Two tests check `tests/fixtures/verdict.sample.json` against `schemas/verdict.schema.json` using
**check-jsonschema** (a Python tool: `brew install check-jsonschema`, or
`pipx install check-jsonschema` where Homebrew isn't available): the fixture itself validates, and
a copy with `overall` changed to an invalid value (`"MAYBE"`) fails validation. Both **skip**
(never fail) when `check-jsonschema` isn't installed, so a contributor without it still gets a
green local run — CI always has it (installed via `pipx` in `plugin-audit.yml`'s `test` job), so a
schema-breaking change is still caught before merge.

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
bats tests/scripts.bats

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

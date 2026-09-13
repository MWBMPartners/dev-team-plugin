# Contributing to dev-team

A practical guide for anyone changing this plugin's own code — as opposed to using it on a
target project. If you're looking for what the plugin *does*, see `README.md`; this file is
about how the plugin itself is built, tested, and shipped.

## Repo layout

```
agents/          Endpoint agent definitions (frontmatter: name, description, model, tools).
                  These are what subagents actually run as — see "Model routing" below.
commands/        Slash commands (e.g. /dev-team, /dev-team-status). Each is a Markdown file
                  with a --- frontmatter block (description:) followed by the prompt.
hooks/           Shell hooks wired via hooks/hooks.json: two PreToolUse guards
                  (guard-dev-team.sh on Bash; guard-ledgers.sh on Write/Edit/MultiEdit, which
                  stops a ledger being written outside .dev-team/ — see conventions.md, "Where
                  the plugin writes, and the ownership rule") plus two SessionStart notifiers.
                  Read one before editing — they're small, fail-open, and each has a comment
                  block explaining its exact contract.
skills/          The dev-team-* skills themselves. Each is skills/<name>/SKILL.md plus a
                  references/ directory of protocol docs the skill loads as needed.
scripts/         Repo self-audit scripts (e.g. audit-model-ids.sh, audit-ledger-paths.sh,
                  branch-hygiene.sh) — run locally and in CI.
schemas/         JSON Schema files describing the shape of the plugin's own JSON ledgers (for
                  example schemas/verdict.schema.json, which validates .dev-team/verdict.json).
                  Every field carries a description, and tests/scripts.bats validates a sample
                  fixture against each schema with check-jsonschema.
tests/           The plugin's own test suite (smoke-structure.sh, scripts.bats) — see
                  tests/README.md.
.claude-plugin/  plugin.json (manifest: name, version, keywords) and marketplace.json
                  (marketplace listing).
.github/         plugin-audit.yml — the CI workflow (audit + test jobs).
```

## The golden rule: plugin components live at the ROOT

`agents/`, `commands/`, `hooks/`, and `skills/` must live at the **plugin root** — never under
`.claude/`. A plugin installer only ever pulls files from the root-level directories; anything
placed under `.claude/agents/` (or any other `.claude/*` subdirectory) is invisible to a user who
installs this plugin from the marketplace. This has bitten the project before (see CHANGELOG
1.1.0 — the full agent roster had to be moved out of `.claude/agents/`), which is why
`scripts/audit-model-ids.sh` fails the build if a `.claude/agents/` directory reappears, and why
`tests/smoke-structure.sh` independently re-asserts the same thing plus the rest of the delivery
shape (agent frontmatter, command frontmatter, `hooks.json` validity, hook script existence +
executability, skill frontmatter, manifest JSON validity).

If you're ever tempted to put a plugin component somewhere for local convenience during
development, don't — put it at the root path it will ship from, and test from there.

## Model routing — never hardcode a dated model id

`skills/dev-team-orchestrator/references/model-routing.md` is the **single source of truth** for
model ids and the tier → endpoint-agent → model mapping. It is the ONLY file in the suite allowed
to name a dated `claude-*` id. Every other file — skills, references, agents, commands — refers to
a model by **alias** (`fable`, `opus`, `sonnet`, `haiku`) or by **endpoint agent name**
(`deep-architect`, `opus-builder`, `sonnet-scribe`, `quick-edits`, `sonnet-builder`), never by a
dated id. `scripts/audit-model-ids.sh` greps the whole repo for `claude-[a-z]+-[0-9]...` patterns
and fails CI if one turns up outside `model-routing.md`. When a new model ships, edit
`model-routing.md` (and, only if the id has no working alias, the one agent file that must pin
it) — nothing else should need to change.

## How to add a skill

1. Create `skills/<your-skill-name>/SKILL.md` with frontmatter (`name:`, `description:`) — the
   description is what makes the skill discoverable, so write it the way the existing siblings
   do: what it's for, concrete trigger phrases, what it's *not* for, and its relationship to
   sibling skills (e.g. "sibling of dev-team-orchestrator"). Read an existing skill first —
   `skills/dev-team-ship/SKILL.md` or `skills/dev-team-iterate/SKILL.md` are good, moderately
   sized examples — and match its structure and tone rather than inventing a new house style.
2. Put anything that isn't needed on every read into `skills/<your-skill-name>/references/*.md`
   and load it lazily from `SKILL.md`, the way the orchestrator's own skill defers to
   `references/model-routing.md`, `references/conventions.md`, etc.
3. Route all model usage through `model-routing.md` (see above) and all shared facts —
   artifact ownership, ID prefixes, the branch model, the gates — through
   `skills/dev-team-orchestrator/references/conventions.md` rather than restating them.
4. Add the skill's name to `.claude-plugin/plugin.json`'s `description` and, if it's a
   user-facing top-level skill, to `.claude-plugin/marketplace.json`'s `description` skill list.
5. Run the local checks (below) before committing, and add or extend `tests/smoke-structure.sh`
   coverage if the skill introduces a new structural contract (e.g. a new required frontmatter
   key).

## How to add a command or a hook

- **Command:** add `commands/<name>.md` with a `---` frontmatter block containing `description:`,
  then the prompt body. `tests/smoke-structure.sh` asserts every command file starts with that
  frontmatter block, so don't skip it.
- **Hook:** add the script under `hooks/`, make it executable (`chmod +x`), then wire it into
  `hooks/hooks.json` referencing it as `${CLAUDE_PLUGIN_ROOT}/hooks/<script>.sh`.
  `tests/smoke-structure.sh` validates `hooks.json` as JSON (via `jq`) and checks that every
  `command` path it references exists on disk and is executable. Hooks in this repo are
  **fail-open by design** — a hook must exit 0 on any internal error, missing dependency, or
  unexpected environment (see the header comment in `hooks/guard-dev-team.sh` for the fullest
  example of this discipline) — and they read `.dev-team/config.yml` toggles (best-effort, never
  a hard error) before falling back to env vars and then built-in defaults; see
  `skills/dev-team-orchestrator/references/config-and-toggles.md` for the toggle precedence.
  Run `shellcheck` on any new or changed hook/script before committing (see below).

## Running the checks locally

```bash
# Model-id drift + plugin-structure audit (also runs in CI as the "audit" job)
bash scripts/audit-model-ids.sh

# Stale-ledger-path audit (also runs in CI as part of the "audit" job): fails if any skill,
# command, agent or README line still tells a writer to put a ledger at the old top-level
# location instead of .dev-team/<name> — see the header comment in the script itself for exactly
# what it checks and what it can't catch.
bash scripts/audit-ledger-paths.sh

# Delivery-shape smoke test (also runs in CI as part of the "test" job)
bash tests/smoke-structure.sh

# Behavior contracts for the hooks/scripts (requires bats-core)
bats tests/scripts.bats

# Static analysis on every shell script (requires shellcheck)
shellcheck scripts/*.sh hooks/*.sh tests/*.sh
```

All five are cheap and fast — run them before every commit that touches `agents/`, `commands/`,
`hooks/`, `scripts/`, `skills/`, or the `.claude-plugin/` manifests. See `tests/README.md` for
more detail on the test suite itself, including how to install `bats`/`shellcheck` if you don't
have them.

`tests/scripts.bats` also validates `tests/fixtures/verdict.sample.json` against
`schemas/verdict.schema.json` using **check-jsonschema**, a Python tool. Those two tests **skip**
(not fail) when it isn't installed, so you'll still get a green run without it locally — but CI
always has it, so a schema mistake still gets caught before merge either way. Install it once if
you want those tests to actually run on your machine: `brew install check-jsonschema`, or
`pipx install check-jsonschema` where Homebrew isn't available.

## Shared conventions

Cross-cutting facts that every skill in the suite agrees on — artifact ownership (who writes
`.dev-team/PROJECT.md`/`.dev-team/FEATURES.md`/`.dev-team/SECURITY.md`/`.dev-team/VERIFICATION.md`/
`.dev-team/autopilot.json` and where each one's schema is defined), **where the plugin is allowed
to write at all and how it recognises a file as its own** (every ledger lives in `.dev-team/` and
carries a marker on line 2; a same-named file without that marker is never written to — see
"Where the plugin writes, and the ownership rule" in the file below), ID prefixes (`FG-`, `F-`,
`B-`, `G-`, `V-`, `I-`, `M-`), the git/branch model, the gates (Feature Spec Gate vs. the autopilot
conductor's hybrid gate policy), and schema versioning for state/ledger files — all live in
`skills/dev-team-orchestrator/references/conventions.md`. Read it before adding anything that
writes a shared artifact or introduces a new ID prefix; a contradiction between that file and a
sibling skill is treated as a bug in the sibling, not a license to diverge.

## Release flow

1. Bump `.claude-plugin/plugin.json`'s `version` (semver). Add any new discoverability
   `keywords` at the same time (no duplicates).
2. Update `CHANGELOG.md` under `## [Unreleased]`, then cut a dated version section for the
   release (see existing entries for the format — it follows
   [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)).
3. Open the PR. Both required checks on `.github/workflows/plugin-audit.yml` must pass:
   - **`audit`** — model-id + plugin-structure audit (`scripts/audit-model-ids.sh`) and the
     stale-ledger-path audit (`scripts/audit-ledger-paths.sh`).
   - **`test`** — the plugin's own test suite (`tests/smoke-structure.sh`, `shellcheck`,
     `bats tests/scripts.bats`).
4. Once merged, users on the marketplace auto-updater pick up the new version automatically;
   `hooks/check-update.sh` is the fallback notifier for anyone who has that off.

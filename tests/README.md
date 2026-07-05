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
  `SMOKE FAIL: <reason>` lines on stderr and exits non-zero otherwise.

- **`scripts.bats`** — [bats-core](https://github.com/bats-core/bats-core) behavioral tests for
  `scripts/audit-model-ids.sh`, `hooks/guard-dev-team.sh` (including the `.dev-team/config.yml`
  `guard:` toggle matrix and every bypass/allow case), `hooks/check-update.sh` (including the
  `update-notifier:` config toggle), `hooks/sync-branches-check.sh` (including the
  `branch-notifier:` config toggle), and `scripts/branch-hygiene.sh`. Every test that needs an
  isolated `.dev-team/config.yml` or a directory with no `.dev-team/autopilot.json` runs from a
  fresh per-test scratch directory (never from the repo root), so the suite never leaves stray
  files behind. The two `audit-model-ids.sh` cases that inject a failure directly into this repo
  (a dated model id, a fake `.claude/agents/` dir) always clean up afterward, including in
  `teardown()` if an assertion fails first.

## Running locally

```bash
# Structural smoke test (bash only, needs jq for the JSON checks)
bash tests/smoke-structure.sh

# Behavioral tests (needs bats-core: brew install bats-core, or apt-get install bats)
bats tests/scripts.bats

# Shellcheck across every shell script the plugin ships
shellcheck scripts/*.sh hooks/*.sh tests/*.sh
```

All three should be run before opening a PR that touches `scripts/`, `hooks/`, or `tests/`.

## What CI runs

`.github/workflows/plugin-audit.yml` runs all three (as the `test` job, alongside the existing
`audit` job which runs `scripts/audit-model-ids.sh`) on every pull request and on push to `main`.
Both `audit` and `test` are required checks.

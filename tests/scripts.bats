#!/usr/bin/env bats
# Behavioral tests for scripts/*.sh and hooks/*.sh. Run: bats tests/scripts.bats
# (installs itself in CI — see .github/workflows/plugin-audit.yml). See tests/README.md.
#
# Every test that needs an isolated ".dev-team/config.yml" or a directory with no
# ".dev-team/autopilot.json" runs from a fresh per-test scratch dir ($SCRATCH), never from
# $REPO_ROOT, so tests never leave stray files behind in this actual repo. The two tests that
# DO touch $REPO_ROOT (audit-model-ids.sh's injected-failure cases) always clean up in teardown,
# even if an assertion fails.

setup() {
  REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/dev-team-bats.XXXXXX")"
}

teardown() {
  [ -n "${SCRATCH:-}" ] && rm -rf "$SCRATCH"
  # Belt-and-braces: guarantee these two known scratch artifacts never survive a failed
  # assertion in the audit-model-ids.sh tests below (see note there).
  rm -f "$REPO_ROOT/tests/.tmp-audit-dated-id.md"
  rm -rf "$REPO_ROOT/.claude/agents"
}

# Run guard-dev-team.sh with $2 piped to stdin, cwd'd into $1 (guard reads
# .dev-team/config.yml and .dev-team/autopilot.json relative to cwd, never cd's itself).
run_guard() {
  ( cd "$1" && printf '%s' "$2" | bash "$REPO_ROOT/hooks/guard-dev-team.sh" )
}

# ---------------------------------------------------------------------------
# scripts/audit-model-ids.sh
# ---------------------------------------------------------------------------

@test "audit-model-ids: passes on the clean repo" {
  run bash "$REPO_ROOT/scripts/audit-model-ids.sh"
  [ "$status" -eq 0 ]
  [[ "$output" == *"AUDIT OK"* ]]
}

@test "audit-model-ids: fails on a dated model id outside the roster" {
  # audit-model-ids.sh cd's to its own script's parent dir, so it always audits THIS repo
  # regardless of caller cwd — the injected file must live inside the real tree; removed
  # immediately after (and again in teardown as a safety net).
  echo "claude-opus-4-8" > "$REPO_ROOT/tests/.tmp-audit-dated-id.md"
  run bash "$REPO_ROOT/scripts/audit-model-ids.sh"
  rm -f "$REPO_ROOT/tests/.tmp-audit-dated-id.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"AUDIT FAIL"* ]]
  [[ "$output" == *"dated model id"* ]]
}

@test "audit-model-ids: fails when a .claude/agents/ dir exists" {
  mkdir -p "$REPO_ROOT/.claude/agents"
  run bash "$REPO_ROOT/scripts/audit-model-ids.sh"
  rm -rf "$REPO_ROOT/.claude/agents"
  [ "$status" -eq 1 ]
  [[ "$output" == *".claude/agents/ exists"* ]]
}

# ---------------------------------------------------------------------------
# hooks/guard-dev-team.sh — default (no repo config) behavior
# ---------------------------------------------------------------------------

@test "guard: allows git push to main with no active run and no DEV_TEAM_GUARD" {
  unset DEV_TEAM_GUARD
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  [ "$status" -eq 0 ]
}

@test "guard: DEV_TEAM_GUARD=1 blocks git push to main" {
  export DEV_TEAM_GUARD=1
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  unset DEV_TEAM_GUARD
  [ "$status" -eq 2 ]
  [[ "$output" == *"Blocked"* ]]
}

@test "guard: DEV_TEAM_GUARD=1 blocks a live Stripe secret key" {
  export DEV_TEAM_GUARD=1
  run run_guard "$SCRATCH" '{"tool_input":{"command":"echo sk_live_abcDEF1234567890"}}'
  unset DEV_TEAM_GUARD
  [ "$status" -eq 2 ]
  [[ "$output" == *"live Stripe key"* ]]
}

@test "guard: DEV_TEAM_GUARD=1 allows a benign ls command" {
  export DEV_TEAM_GUARD=1
  run run_guard "$SCRATCH" '{"tool_input":{"command":"ls -la"}}'
  unset DEV_TEAM_GUARD
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# hooks/guard-dev-team.sh — .dev-team/config.yml guard: toggle matrix
# ---------------------------------------------------------------------------

@test "guard: config guard=off allows push to main with no override at all" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  guard: off\n' > "$SCRATCH/.dev-team/config.yml"
  unset DEV_TEAM_GUARD
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  [ "$status" -eq 0 ]
}

@test "guard: config guard=on blocks push to main with no active run" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  guard: on\n' > "$SCRATCH/.dev-team/config.yml"
  unset DEV_TEAM_GUARD
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  [ "$status" -eq 2 ]
}

@test "guard: config guard=auto allows push to main with no active run (fail-open)" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  guard: auto\n' > "$SCRATCH/.dev-team/config.yml"
  unset DEV_TEAM_GUARD
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  [ "$status" -eq 0 ]
}

@test "guard: no config file at all allows push to main with no active run (fail-open)" {
  unset DEV_TEAM_GUARD
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# hooks/check-update.sh
# ---------------------------------------------------------------------------

@test "check-update: DEV_TEAM_NO_UPDATE_CHECK=1 exits 0 with no output" {
  run env DEV_TEAM_NO_UPDATE_CHECK=1 bash "$REPO_ROOT/hooks/check-update.sh"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "check-update: fails open (exit 0) with CLAUDE_PLUGIN_ROOT/DATA unset" {
  run env -u DEV_TEAM_NO_UPDATE_CHECK -u CLAUDE_PLUGIN_ROOT -u CLAUDE_PLUGIN_DATA \
    bash -c "cd '$SCRATCH' && bash '$REPO_ROOT/hooks/check-update.sh'"
  [ "$status" -eq 0 ]
}

@test "check-update: config update-notifier=off exits 0 with no output" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  update-notifier: off\n' > "$SCRATCH/.dev-team/config.yml"
  run env -u DEV_TEAM_NO_UPDATE_CHECK \
    bash -c "cd '$SCRATCH' && bash '$REPO_ROOT/hooks/check-update.sh'"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# ---------------------------------------------------------------------------
# hooks/sync-branches-check.sh
# ---------------------------------------------------------------------------

@test "sync-branches-check: DEV_TEAM_NO_BRANCH_CHECK=1 exits 0 with no output" {
  run env DEV_TEAM_NO_BRANCH_CHECK=1 bash "$REPO_ROOT/hooks/sync-branches-check.sh"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "sync-branches-check: config branch-notifier=off exits 0 with no output" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  branch-notifier: off\n' > "$SCRATCH/.dev-team/config.yml"
  run env -u DEV_TEAM_NO_BRANCH_CHECK \
    bash -c "cd '$SCRATCH' && bash '$REPO_ROOT/hooks/sync-branches-check.sh'"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# ---------------------------------------------------------------------------
# hooks/polish-reminder.sh
# ---------------------------------------------------------------------------

# Make $SCRATCH a git repo tracking one file named $1 (e.g. index.html or notes.txt).
init_repo_with() {
  ( cd "$SCRATCH" && git init -q . && : > "$1" && git add "$1" )
}

run_polish() {
  run env -u DEV_TEAM_NO_POLISH_REMINDER \
    bash -c "cd '$SCRATCH' && bash '$REPO_ROOT/hooks/polish-reminder.sh'"
}

@test "polish-reminder: DEV_TEAM_NO_POLISH_REMINDER=1 exits 0 with no output" {
  init_repo_with index.html
  run env DEV_TEAM_NO_POLISH_REMINDER=1 \
    bash -c "cd '$SCRATCH' && bash '$REPO_ROOT/hooks/polish-reminder.sh'"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "polish-reminder: config polish-reminder=off exits 0 with no output" {
  init_repo_with index.html
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  polish-reminder: off\n' > "$SCRATCH/.dev-team/config.yml"
  run_polish
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "polish-reminder: silent outside a git repo" {
  run_polish
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "polish-reminder: silent in a repo with no web files" {
  init_repo_with notes.txt
  run_polish
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "polish-reminder: web repo never checked emits a valid JSON reminder" {
  init_repo_with index.html
  run_polish
  [ "$status" -eq 0 ]
  [[ "$output" == *"dev-team-polish"* ]]
  [[ "$output" == *"has not been run"* ]]
  echo "$output" | jq -e '.hookSpecificOutput.hookEventName == "SessionStart"' >/dev/null
}

@test "polish-reminder: silent when the last run is within the interval" {
  init_repo_with index.html
  mkdir -p "$SCRATCH/.dev-team"
  date -u +%Y-%m-%d > "$SCRATCH/.dev-team/polish-last-run"
  run_polish
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "polish-reminder: reminds when the last run is older than the interval" {
  init_repo_with index.html
  mkdir -p "$SCRATCH/.dev-team"
  echo "2000-01-01" > "$SCRATCH/.dev-team/polish-last-run"
  run_polish
  [ "$status" -eq 0 ]
  [[ "$output" == *"last run 2000-01-01"* ]]
}

@test "polish-reminder: honours polish-interval-days from config" {
  init_repo_with index.html
  mkdir -p "$SCRATCH/.dev-team"
  echo "2000-01-01" > "$SCRATCH/.dev-team/polish-last-run"
  printf 'defaults:\n  polish-interval-days: 999999\n' > "$SCRATCH/.dev-team/config.yml"
  run_polish
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# ---------------------------------------------------------------------------
# scripts/branch-hygiene.sh
# ---------------------------------------------------------------------------

@test "branch-hygiene: --no-fetch is read-only and prints the three status lines" {
  before="$(git -C "$REPO_ROOT" branch --format='%(refname:short)' | sort)"
  run bash -c "cd '$REPO_ROOT' && bash scripts/branch-hygiene.sh --no-fetch"
  after="$(git -C "$REPO_ROOT" branch --format='%(refname:short)' | sort)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"default-branch:"* ]]
  [[ "$output" == *"merged-safe-to-delete:"* ]]
  [[ "$output" == *"skipped:"* ]]
  [ "$before" = "$after" ]
}

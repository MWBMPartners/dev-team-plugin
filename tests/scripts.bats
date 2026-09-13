#!/usr/bin/env bats
# Behavioral tests for scripts/*.sh and hooks/*.sh. Run: bats tests/scripts.bats
# (installs itself in CI — see .github/workflows/plugin-audit.yml). See tests/README.md.
#
# Every test that needs an isolated ".dev-team/config.yml" or a directory with no
# ".dev-team/autopilot.json" runs from a fresh per-test scratch dir ($SCRATCH), never from
# $REPO_ROOT, so tests never leave stray files behind in this actual repo. The tests that DO
# touch $REPO_ROOT (audit-model-ids.sh's and audit-ledger-paths.sh's injected-failure cases)
# always clean up in teardown, even if an assertion fails.

setup() {
  REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/dev-team-bats.XXXXXX")"
}

teardown() {
  [ -n "${SCRATCH:-}" ] && rm -rf "$SCRATCH"
  # Belt-and-braces: guarantee these known scratch artifacts never survive a failed assertion in
  # the audit-model-ids.sh / audit-ledger-paths.sh injected-failure tests below.
  rm -f "$REPO_ROOT/tests/.tmp-audit-dated-id.md"
  rm -rf "$REPO_ROOT/.claude/agents"
  rm -f "$REPO_ROOT/skills/dev-team-orchestrator/references/.tmp-ledger-audit.md"
}

# Run guard-dev-team.sh with $2 piped to stdin, cwd'd into $1 (guard reads
# .dev-team/config.yml and .dev-team/autopilot.json relative to cwd, never cd's itself).
run_guard() {
  ( cd "$1" && printf '%s' "$2" | bash "$REPO_ROOT/hooks/guard-dev-team.sh" )
}

# Run guard-ledgers.sh with $2 piped to stdin, cwd'd into $1 (same convention as run_guard —
# the script reads .dev-team/config.yml and .dev-team/loop.lock/ relative to the payload's own
# "cwd" field when the payload sends one, otherwise relative to wherever it is run from, which is
# $1 here). Most tests below rely on that "relative to wherever it is run from" behaviour and
# never set "cwd" in the payload; the one test that does set "cwd" runs from a different directory
# on purpose, to prove the payload's field wins over the shell's own working directory.
run_ledger_guard() {
  ( cd "$1" && printf '%s' "$2" | bash "$REPO_ROOT/hooks/guard-ledgers.sh" )
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
# scripts/audit-ledger-paths.sh
# ---------------------------------------------------------------------------
# Same belt-and-braces cleanup discipline as the audit-model-ids.sh cases above: the injected
# file is removed immediately after the assertions, and again in teardown() in case an assertion
# fails first and the immediate "rm" line is never reached.

@test "audit-ledger-paths: passes on the clean repo" {
  run bash "$REPO_ROOT/scripts/audit-ledger-paths.sh"
  [ "$status" -eq 0 ]
  [[ "$output" == *"LEDGER-PATHS OK"* ]]
}

@test "audit-ledger-paths: fails on a ledger named at the repo root without the .dev-team/ prefix" {
  # The script cd's to its own script's parent dir, so it always audits THIS repo regardless of
  # caller cwd — the injected file must live inside the real tree, under skills/ (in scope).
  printf '%s\n' 'The documentarian writes `PROJECT.md` at the repo root.' \
    > "$REPO_ROOT/skills/dev-team-orchestrator/references/.tmp-ledger-audit.md"
  run bash "$REPO_ROOT/scripts/audit-ledger-paths.sh"
  rm -f "$REPO_ROOT/skills/dev-team-orchestrator/references/.tmp-ledger-audit.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"LEDGER-PATHS FAIL"* ]]
}

@test "audit-ledger-paths: fails on a ledger anchor with no .dev-team/ prefix" {
  printf '%s\n' 'See `SECURITY.md#Findings` for the full register.' \
    > "$REPO_ROOT/skills/dev-team-orchestrator/references/.tmp-ledger-audit.md"
  run bash "$REPO_ROOT/scripts/audit-ledger-paths.sh"
  rm -f "$REPO_ROOT/skills/dev-team-orchestrator/references/.tmp-ledger-audit.md"
  [ "$status" -eq 1 ]
  [[ "$output" == *"LEDGER-PATHS FAIL"* ]]
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
# hooks/guard-ledgers.sh — Rule 1 (marker-bearing content written outside .dev-team/)
# ---------------------------------------------------------------------------
# Rule 1 applies to a Write only, and stays on regardless of whether a run is active — see the
# header comment in hooks/guard-ledgers.sh for why. None of these tests set up .dev-team/
# autopilot.json or loop.lock/, on purpose, to keep that "stays on either way" claim honest.

@test "guard-ledgers: marker on line 2, top-level path, is denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: the same marker content is allowed at the .dev-team/ path" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".dev-team/FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: the same marker content is allowed at an absolute .dev-team/ path" {
  # $SCRATCH itself can carry a doubled slash on some machines (a trailing slash in $TMPDIR),
  # which "cd" quietly resolves away — so the path baked into the payload is resolved through
  # "cd ... && pwd" too, otherwise it would not literally match what $PWD reports inside the
  # hook's own subshell, and the fallback-to-$PWD prefix-strip in Correction 2 would not fire.
  scratch_resolved="$(cd "$SCRATCH" && pwd)"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"'"$scratch_resolved"'/.dev-team/FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: marker content aimed anywhere else outside .dev-team/ is denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"docs/notes.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a user's own file with no marker is never blocked" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"FEATURES.md","content":"just plain text, no marker"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: an Edit (no line position, no marker check) is allowed with no run active" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"x"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: config guard=off allows marker content outside .dev-team/, even with an active run" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  guard: off\n' > "$SCRATCH/.dev-team/config.yml"
  : > "$SCRATCH/.dev-team/autopilot.json"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a marker on line 10 only does not trip the first-three-lines check" {
  content="l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\n<!-- dev-team: ledger=features schema=1.0 -->"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"notes.md","content":"'"$content"'"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: an empty payload is allowed" {
  run run_ledger_guard "$SCRATCH" '{}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a top-level verdict.json carrying the JSON marker is denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"verdict.json","content":"{\"dev-team\": \"ledger=verdict schema=1.0\"}"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

# Fault found by a later reading of the hook: the JSON marker match required exactly one space
# after the colon, so COMPACT json (no spaces at all — what a minifier or a hand-typed value would
# produce) was not recognised as the marker. These two prove both spacings are now caught the same
# way, and that a compact-marker write straight into .dev-team/ is still allowed as normal.
@test "guard-ledgers: a top-level verdict.json carrying the COMPACT JSON marker (no spaces) is denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"verdict.json","content":"{\"dev-team\":\"ledger=verdict schema=1.0\"}"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a top-level verdict.json carrying the SPACED JSON marker is still denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"verdict.json","content":"{\"dev-team\" : \"ledger=verdict schema=1.0\"}"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: the same compact JSON marker is allowed at the .dev-team/ path" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".dev-team/verdict.json","content":"{\"dev-team\":\"ledger=verdict schema=1.0\"}"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a MultiEdit inside .dev-team/ is allowed" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"MultiEdit","tool_input":{"file_path":".dev-team/PROJECT.md","edits":[{"old_string":"a","new_string":"b"}]}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: an absolute path is resolved against the payload's own cwd field, not the process's directory" {
  # Runs from a *different* scratch dir than the one named in the payload's "cwd" field, and from
  # one with no .dev-team/ of its own — proving the hook trusts the JSON field, not $PWD, when
  # deciding the path is inside .dev-team/. If it fell back to $PWD here it would wrongly deny.
  other="$(mktemp -d "${TMPDIR:-/tmp}/dev-team-bats.XXXXXX")"
  run run_ledger_guard "$other" '{"cwd":"'"$SCRATCH"'","tool_name":"Write","tool_input":{"file_path":"'"$SCRATCH"'/.dev-team/FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  rm -rf "$other"
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# hooks/guard-ledgers.sh — Rule 2 (top-level ledger names, active-run gate)
# ---------------------------------------------------------------------------
# This replaces the plan's first draft, which gated Rule 2 on ".dev-team/autopilot.json exists" —
# rejected once real projects turned up that commit autopilot.json to git, which would have made
# the rule permanently on and stopped a project owner editing their own top-level HANDOFF.md or
# FEATURES.md forever (see .claude/plans/ledger-file-clashes/plan-review.md, Correction 1). Gated
# instead on .dev-team/loop.lock/ (created only for the length of one autopilot cycle and never
# committed), or guard: on, or DEV_TEAM_GUARD.

@test "guard-ledgers: a committed autopilot.json alone never blocks your own file" {
  mkdir -p "$SCRATCH/.dev-team"
  : > "$SCRATCH/.dev-team/autopilot.json"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"HANDOFF.md","content":"plain text, no ids"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: Rule 2 is off without a live cycle, even with an id in the content" {
  mkdir -p "$SCRATCH/.dev-team"
  : > "$SCRATCH/.dev-team/autopilot.json"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: the SIGNula.id failure (findings appended to the project's own SECURITY.md) is blocked mid-cycle" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a project's own feature list can still be updated mid-cycle" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"FEATURES.md","new_string":"Added the Forms app"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: GitHub's own security-policy locations are covered too" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".github/SECURITY.md","content":"FG-012 something"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

# Fault found by a later reading of the hook: the ledger-name match compared capitals only. On a
# filesystem that ignores case (macOS, by default) "security.md" and "SECURITY.md" are the very
# same file on disk, so a write spelled in a different case must be caught exactly the same way.
@test "guard-ledgers: a lower-case \"security.md\" is caught the same as SECURITY.md" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"security.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a mixed-case \"Features.md\" is caught the same as FEATURES.md" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"Features.md","new_string":"FG-003 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a MultiEdit is checked across every one of its edits, not just the first" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"MultiEdit","tool_input":{"file_path":"PROJECT.md","edits":[{"old_string":"a","new_string":"nothing interesting here"},{"old_string":"c","new_string":"B-004 fixed"}]}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: config guard=on forces Rule 2 on with no lock file present" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  guard: on\n' > "$SCRATCH/.dev-team/config.yml"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"PROJECT.md","content":"B-001 open"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: config guard=off wins over a lock file that is still present" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  printf 'features:\n  guard: off\n' > "$SCRATCH/.dev-team/config.yml"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-001 fixed"}}'
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
# schemas/verdict.schema.json
# ---------------------------------------------------------------------------
# check-jsonschema is a Python tool (pip install check-jsonschema) that CI always has (see
# .github/workflows/plugin-audit.yml) but a local dev machine might not. These tests skip —
# never fail — when it is missing locally, so a contributor without it installed still gets a
# green run; CI is where this actually gets checked every time.

@test "verdict-schema: the sample fixture validates" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$REPO_ROOT/tests/fixtures/verdict.sample.json"
  [ "$status" -eq 0 ]
}

@test "verdict-schema: an invalid overall value fails validation" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  bad="$SCRATCH/verdict-bad.json"
  jq '.overall = "MAYBE"' "$REPO_ROOT/tests/fixtures/verdict.sample.json" > "$bad"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$bad"
  [ "$status" -ne 0 ]
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

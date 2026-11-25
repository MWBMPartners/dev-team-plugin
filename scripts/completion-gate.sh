#!/usr/bin/env bash
# File:    scripts/completion-gate.sh
# Purpose: One command that runs every check this repository has and prints a plain checklist, so "is the orchestrator
#          work complete and sound?" has a checkable answer instead of a feeling. It changes nothing.
# Usage:   bash scripts/completion-gate.sh        (exit 0 only if every item passes)
# Notes:   Needs jq, shellcheck, bats and Node 22 for the full list; an item whose tool is missing is reported as SKIPPED,
#          which counts as not passed. Works with bash 3.2.
set -u
cd "$(dirname "$0")/.." || exit 1
fail=0; skipped=0
tmp="${TMPDIR:-/tmp}"
item() { # item <name> <command...>
  local name="$1"; shift
  if out="$("$@" 2>&1)"; then printf 'PASS    %s\n' "$name"; else printf 'FAIL    %s\n' "$name"; printf '%s\n' "$out" | tail -5 | sed 's/^/        /'; fail=1; fi
}
need() { command -v "$1" >/dev/null 2>&1 || { printf 'SKIPPED %s (needs %s)\n' "$2" "$1"; skipped=1; return 1; }; }

item "model-id audit and plugin structure" bash scripts/audit-model-ids.sh
item "ledger-path audit" bash scripts/audit-ledger-paths.sh
item "folder layout (smoke test)" bash tests/smoke-structure.sh
if need shellcheck "shellcheck over scripts, hooks and tests"; then item "shellcheck over scripts, hooks and tests" shellcheck scripts/*.sh hooks/*.sh tests/*.sh; fi
if need node "engine unit tests"; then
  item "engine unit tests" node --test engine/test/*.test.mjs
  item "every schema passes its sample file" bash scripts/engine.sh schema validate --all
  item "this project's locked plan is intact" bash scripts/engine.sh plan verify --file .claude/plans/orchestrator-v2/plan-contract.orchestrator-v2.v1.json
  item "role-and-model simulator scenarios" bash scripts/engine.sh sim run --all
  # shellcheck disable=SC2016
  item "engine exits 3, not an error, without Node (1.x still works)" bash -c 'PATH=/nonexistent /bin/bash scripts/engine.sh doctor >/dev/null 2>&1; [ "$?" -eq 3 ]'
fi
if need bats "launcher and older script tests"; then
  mkdir -p "$tmp/dt-gate" 2>/dev/null
  item "launcher tests (tests/engine.bats)" env TMPDIR="$tmp/dt-gate" bats tests/engine.bats
  item "older script and hook tests (tests/scripts.bats)" env TMPDIR="$tmp/dt-gate" bats tests/scripts.bats
fi
# shellcheck disable=SC2016
item "no private key anywhere in the repository" bash -c 'git grep -I -q "BEGIN [A-Z ]*PRIVATE KEY" -- . ; [ "$?" -eq 1 ]'
item "version in plugin.json is plain numbers" bash -c 'jq -e ".version | test(\"^[0-9]+\\\\.[0-9]+\\\\.[0-9]+\")" .claude-plugin/plugin.json >/dev/null'

echo
if [ "$fail" -eq 0 ] && [ "$skipped" -eq 0 ]; then echo "COMPLETION GATE: every item passed."; exit 0; fi
[ "$fail" -ne 0 ] && echo "COMPLETION GATE: at least one item FAILED."
[ "$skipped" -ne 0 ] && echo "COMPLETION GATE: at least one item was SKIPPED (a tool is missing), which counts as not passed."
exit 1

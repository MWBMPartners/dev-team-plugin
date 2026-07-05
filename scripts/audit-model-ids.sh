#!/usr/bin/env bash
# Plugin self-audit: prevents model-id drift and broken plugin structure.
# Run locally or in CI. Non-zero exit = failure.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
fail=0
note() { echo "AUDIT FAIL: $*" >&2; fail=1; }

ROSTER="skills/dev-team-orchestrator/references/model-routing.md"

# 1) Dated claude-* ids may appear ONLY in the roster file.
matches="$(grep -rEnI 'claude-[a-z]+-[0-9][0-9a-z-]*' \
  --include='*.md' --include='*.json' --include='*.yml' --include='*.yaml' . 2>/dev/null \
  | grep -v "^\./$ROSTER:" | grep -v '/\.git/' || true)"
if [ -n "$matches" ]; then
  note "dated model id(s) outside $ROSTER (use an alias, or keep the id in the roster only):"
  printf '%s\n' "$matches" >&2
fi

# 2) Manifests must be valid JSON.
if command -v jq >/dev/null 2>&1; then
  for f in .claude-plugin/plugin.json .claude-plugin/marketplace.json; do
    jq empty "$f" 2>/dev/null || note "invalid JSON: $f"
  done
fi

# 3) Every endpoint agent must exist with a model: field.
for a in deep-architect opus-builder sonnet-scribe quick-edits sonnet-builder; do
  [ -f "agents/$a.md" ] || note "missing agent file: agents/$a.md"
  grep -q '^model:' "agents/$a.md" 2>/dev/null || note "agent agents/$a.md has no model: field"
done

# 4) No plugin components misplaced under .claude/ (must be at plugin root).
[ -d ".claude/agents" ] && note ".claude/agents/ exists — plugin agents must live in agents/ at the plugin root, or installers won't get them."

# 5) Docs-coverage: every skill and every command must be documented in README.md, so the
# suite's docs can't silently drift out of date as skills/commands are added.
if [ -f README.md ]; then
  for d in skills/dev-team-*/; do
    [ -d "$d" ] || continue
    name="$(basename "$d")"
    grep -q "$name" README.md || note "$name not documented in README"
  done
  for f in commands/*.md; do
    [ -f "$f" ] || continue
    name="$(basename "$f" .md)"
    grep -q "$name" README.md || note "$name not documented in README"
  done
else
  note "README.md missing"
fi

[ "$fail" -eq 0 ] && echo "AUDIT OK"
exit "$fail"

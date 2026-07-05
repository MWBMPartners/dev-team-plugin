#!/usr/bin/env bash
# Structural smoke test: confirms the plugin would actually deliver its components to an
# installer. Pure structure/frontmatter checks — no behavior testing (see tests/scripts.bats
# for behavioral coverage of scripts/ and hooks/). Run locally (bash tests/smoke-structure.sh)
# and in CI (the `test` job in .github/workflows/plugin-audit.yml). Non-zero exit + one or more
# "SMOKE FAIL: <reason>" lines on stderr = failure; "SMOKE OK" on stdout + exit 0 = pass.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

fail=0
note() { echo "SMOKE FAIL: $*" >&2; fail=1; }

# Print just the YAML frontmatter body (the lines strictly between the first and second `---`
# delimiter lines) of a markdown file with a leading frontmatter block.
frontmatter() { awk '/^---$/{n++; next} n==1' "$1" 2>/dev/null; }

# 1) agents/ exists at the plugin root with the 5 endpoint files; each has frontmatter with
#    name:, description:, model:, tools: (same roster as scripts/audit-model-ids.sh).
for a in deep-architect opus-builder sonnet-scribe quick-edits sonnet-builder; do
  f="agents/$a.md"
  if [ ! -f "$f" ]; then
    note "missing agent file: $f"
    continue
  fi
  fm="$(frontmatter "$f")"
  for key in name: description: model: tools:; do
    printf '%s\n' "$fm" | grep -q "^${key}" || note "$f frontmatter missing '$key'"
  done
done

# 2) NO .claude/agents/ dir — plugin components must live at the plugin root, or installers
#    won't deliver them (see scripts/audit-model-ids.sh check 4, which enforces the same rule).
[ -d ".claude/agents" ] && note ".claude/agents/ exists — plugin agents must live in agents/ at the plugin root."

# 3) commands/*.md each begin with a --- frontmatter block containing description:.
shopt -s nullglob
cmd_files=(commands/*.md)
if [ "${#cmd_files[@]}" -eq 0 ]; then
  note "no files found under commands/"
else
  for f in "${cmd_files[@]}"; do
    first_line="$(head -n1 "$f" 2>/dev/null)"
    if [ "$first_line" != "---" ]; then
      note "$f does not start with a --- frontmatter block"
      continue
    fi
    fm="$(frontmatter "$f")"
    printf '%s\n' "$fm" | grep -q '^description:' || note "$f frontmatter missing 'description:'"
  done
fi

# 4) hooks/hooks.json is valid JSON (jq) and every command path it references (stripping
#    ${CLAUDE_PLUGIN_ROOT}/) exists on disk and is executable.
if ! command -v jq >/dev/null 2>&1; then
  note "jq not installed — cannot validate hooks/hooks.json"
elif [ ! -f "hooks/hooks.json" ]; then
  note "missing hooks/hooks.json"
elif ! jq empty "hooks/hooks.json" >/dev/null 2>&1; then
  note "invalid JSON: hooks/hooks.json"
else
  while IFS= read -r cmd; do
    [ -n "$cmd" ] || continue
    rel="${cmd#\$\{CLAUDE_PLUGIN_ROOT\}/}"
    if [ ! -e "$rel" ]; then
      note "hooks.json references missing path: $rel"
    elif [ ! -x "$rel" ]; then
      note "hooks.json references non-executable path: $rel"
    fi
  done < <(jq -r '.. | .command? // empty' hooks/hooks.json 2>/dev/null)
fi

# 5) Each skills/*/SKILL.md exists and has frontmatter name: + description:.
skill_dirs=(skills/*/)
if [ "${#skill_dirs[@]}" -eq 0 ]; then
  note "no directories found under skills/"
else
  for d in "${skill_dirs[@]}"; do
    f="${d}SKILL.md"
    if [ ! -f "$f" ]; then
      note "missing $f"
      continue
    fi
    fm="$(frontmatter "$f")"
    for key in name: description:; do
      printf '%s\n' "$fm" | grep -q "^${key}" || note "$f frontmatter missing '$key'"
    done
  done
fi

# 6) .claude-plugin/plugin.json + marketplace.json are valid JSON (jq).
if ! command -v jq >/dev/null 2>&1; then
  note "jq not installed — cannot validate .claude-plugin manifests"
else
  for f in .claude-plugin/plugin.json .claude-plugin/marketplace.json; do
    if [ ! -f "$f" ]; then
      note "missing $f"
    elif ! jq empty "$f" >/dev/null 2>&1; then
      note "invalid JSON: $f"
    fi
  done
fi

[ "$fail" -eq 0 ] && echo "SMOKE OK"
exit "$fail"

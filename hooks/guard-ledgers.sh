#!/usr/bin/env bash
# dev-team ledger guard (PreToolUse/Write|Edit|MultiEdit). Part of the issue #41 fix: every file
# the plugin writes for itself now lives in .dev-team/, never at the project's top level — see
# skills/dev-team-orchestrator/references/conventions.md, "Where the plugin writes, and the
# ownership rule". This hook is a second, independent layer on top of that written rule and the
# scribe's own self-check; it stops a mistaken write before it happens instead of only detecting
# one afterwards. Fail-open by design, same posture as hooks/guard-dev-team.sh: any error, missing
# tool, missing jq, or anything it cannot parse => allow (exit 0). One defense layer, best-effort
# text matching — NEVER the safety guarantee. The real protection is the plugin only ever writing
# into .dev-team/, plus a person reading what they are about to commit.
#
# Two separate rules, both read from the tool call's own JSON (stdin), never from the filesystem
# except .dev-team/config.yml and .dev-team/loop.lock/:
#
#   Rule 1 (Write only; on all the time unless `guard: off`) — a WRITE whose new content carries
#   the dev-team marker (`<!-- dev-team: ledger=` or `"dev-team": "ledger=`) on one of its first
#   three lines, aimed at a path outside .dev-team/, is refused. Only content the plugin itself
#   generated ever carries that marker, so this can only catch a scribe about to write a ledger to
#   the wrong place — it can never block a person editing their own file, because their file will
#   not have the marker. That is also why this rule stays on even outside an active run: the
#   mistake it is guarding against (a stale instruction telling a scribe to write at the old
#   top-level path) can happen in a one-off session just as easily as inside an autopilot cycle.
#
#   Rule 2 (Write, Edit or MultiEdit; only while a run is judged to be active, or the config or
#   environment forces it on) — a write to one of the seven ledger names at the project's top
#   level, or to SECURITY.md in .github/ or docs/ (GitHub's own security-policy locations), is
#   refused if the incoming text looks like plugin output: it carries the dev-team marker, or it
#   contains a dev-team record id such as F-001 or FG-012. This is the SIGNula.id failure this
#   whole change exists to stop: a run appending its own findings onto a project's real
#   SECURITY.md. Plain text with no marker and no ids — a person's own edit to their own file — is
#   never blocked, on purpose: only the run gate plus the content test together decide this, never
#   the path alone, because a project is allowed to keep its own PROJECT.md/FEATURES.md/etc. and a
#   person must always be able to edit those.
#
#   "A run is active" is judged by `.dev-team/loop.lock/` existing (created for the length of one
#   autopilot cycle and removed at the end — see loop-runtime.md — and, unlike autopilot.json,
#   never committed to git, so it is a real "right now" signal), or `guard: on` in
#   .dev-team/config.yml, or the DEV_TEAM_GUARD environment variable being set. Earlier drafts of
#   this hook used "`.dev-team/autopilot.json` exists" for that test, copying hooks/guard-dev-
#   team.sh — that was rejected once real projects turned up (CueRCode, Go2My.Link, SIGNula.id)
#   that keep autopilot.json committed in git, which would have made Rule 2 permanently on and
#   would have stopped the project owner editing their own top-level HANDOFF.md or FEATURES.md
#   forever. `guard: off` in .dev-team/config.yml turns BOTH rules off, exactly like the Bash guard.
#
# Path handling: Claude Code sends the session's working folder as the top-level `cwd` field on
# every hook call. When `tool_input.file_path` is absolute, this script strips a leading `<cwd>/`
# (falling back to the shell's own $PWD only if `cwd` is missing from the payload) and then a
# leading `./`, and reads .dev-team/config.yml and .dev-team/loop.lock/ relative to that same
# `cwd` when it is present. Confirmed against Claude Code's official hooks documentation
# (https://code.claude.com/docs/en/hooks and .../hooks-guide, fetched 13 September 2026): the
# top-level `cwd` field is shown in the documented PreToolUse example payload; `tool_input.
# file_path` and `tool_input.content` (Write) are shown in the "Block edits to protected files"
# example script; Edit's `old_string`/`new_string` pair is stated in the tools reference text.
# MultiEdit's `tool_input.edits[]` array (each item carrying `old_string`/`new_string`) is NOT
# shown in the fetched documentation excerpts — it is coded here from the tool's well-established
# real shape, and, per the fail-open rule above, a missing or differently-shaped `edits` field
# simply yields no content to check rather than an error.
#
# What this hook CANNOT do, stated plainly:
#   - It cannot see a `cat >>` or any other write run through Bash — only Write/Edit/MultiEdit.
#   - It is a best-effort pattern match on the text being written, never a guarantee. A determined
#     rewrite that avoids the marker and every id pattern will not be caught.
#   - It cannot know the project's real root if the session's working folder is a subfolder of the
#     project — it trusts `cwd` (or $PWD) as given.
#   - Whether PreToolUse actually fires for a subagent's own Write call was not verified in this
#     build session; if it does not, this hook still protects the lead session's own writes, and
#     the written rule in conventions.md plus the scribe's post-write self-check carry the rest.
set -u
payload="$(cat 2>/dev/null)" || exit 0

# Everything below needs structured fields out of the JSON payload. Without jq there is no safe
# way to parse it, so — fail open — allow.
command -v jq >/dev/null 2>&1 || exit 0

jqr() { printf '%s' "$payload" | jq -r "$1" 2>/dev/null; }

# The session's working folder, as Claude Code sends it. Falls back to $PWD only for the parts
# that need an actual filesystem location to check ($PWD is not itself trusted as the project
# root — it is only what a caller who omits `cwd` from the payload gets judged against).
cwd="$(jqr '.cwd // empty')"

# Where .dev-team/config.yml and .dev-team/loop.lock/ are read from: relative to `cwd` when it
# was sent, otherwise relative to whatever folder this script's caller happens to be in.
rel() { if [ -n "$cwd" ]; then printf '%s/%s' "$cwd" "$1"; else printf '%s' "$1"; fi; }

config_file="$(rel .dev-team/config.yml)"
guard_mode=""
[ -f "$config_file" ] && guard_mode="$(grep -Eo '^[[:space:]]*guard:[[:space:]]*(on|off|auto)' "$config_file" 2>/dev/null | grep -Eo '(on|off|auto)$' | head -1)"

# `guard: off` disables both rules, repo-wide, no matter what else is set.
[ "$guard_mode" = "off" ] && exit 0

tool_name="$(jqr '.tool_name // empty')"
file_path="$(jqr '.tool_input.file_path // empty')"
# No file_path (or no tool_input at all) => nothing to check against => allow.
[ -n "$file_path" ] || exit 0

# Normalise the path per the header comment: strip a leading "<cwd>/" (or "$PWD/" when `cwd` is
# absent from the payload), then a leading "./". Quoting the pattern operand keeps it literal —
# a path is never treated as a glob here.
strip_prefix="${cwd:-$PWD}"
case "$file_path" in
  "$strip_prefix"/*) norm_path="${file_path#"$strip_prefix"/}" ;;
  *) norm_path="$file_path" ;;
esac
norm_path="${norm_path#./}"

deny() {
  echo "dev-team guard: $1" >&2
  exit 2
}

# The dev-team marker, as it appears in either a markdown ledger's HTML comment or verdict.json's
# JSON field — see conventions.md, "Where the plugin writes, and the ownership rule".
marker_pattern='<!-- dev-team: ledger=|"dev-team": "ledger='
# A dev-team record id: FG-001, F-002, B-003, G-004, V-005, I-006, M-007.
id_pattern='\b(FG|F|B|G|V|I|M)-[0-9]{3}\b'

# The text actually being written, by tool shape. Anything unrecognised (a tool this hook was not
# written for) leaves $content empty and $checked=0, which both rules treat as "nothing to see".
content=""
checked=0
case "$tool_name" in
  Write)
    content="$(jqr '.tool_input.content // empty')"
    checked=1
    ;;
  Edit)
    content="$(jqr '.tool_input.new_string // empty')"
    checked=1
    ;;
  MultiEdit)
    # Every edit's new_string, joined — a ledger id or the marker slipped into any one of a
    # MultiEdit's several edits is still a write of that content, not just the first edit.
    content="$(jqr '(.tool_input.edits // []) | map(.new_string // "") | join("\n")')"
    checked=1
    ;;
esac

# --- Rule 1: marker-bearing content, written outside .dev-team/, by a Write. ---------------------
if [ "$checked" -eq 1 ] && [ "$tool_name" = "Write" ]; then
  first_three="$(printf '%s\n' "$content" | head -n 3)"
  if printf '%s' "$first_three" | grep -Eq "$marker_pattern"; then
    case "$norm_path" in
      .dev-team/*) : ;; # inside .dev-team/ — exactly where it belongs.
      *) deny "this content carries the dev-team marker but the path \"$norm_path\" is outside .dev-team/. Ledgers live only in .dev-team/." ;;
    esac
  fi
fi

# --- Rule 2: a top-level ledger name (or a GitHub security-policy location), written while a run
#     is judged active, with content that looks like plugin output. ------------------------------
run_active=0
if [ -d "$(rel .dev-team/loop.lock)" ] || [ "$guard_mode" = "on" ] || [ -n "${DEV_TEAM_GUARD:-}" ]; then
  run_active=1
fi

if [ "$checked" -eq 1 ] && [ "$run_active" -eq 1 ]; then
  case "$norm_path" in
    PROJECT.md|FEATURES.md|SECURITY.md|VERIFICATION.md|MIGRATION.md|HANDOFF.md|verdict.json|.github/SECURITY.md|docs/SECURITY.md)
      if printf '%s' "$content" | grep -Eq "$marker_pattern|$id_pattern"; then
        deny "\"$norm_path\" is a project-level file with a dev-team ledger name, and the content being written to it looks like this plugin's own output (the dev-team marker or a record id). The suite writes only into .dev-team/. If this is the project's own file and you meant to write to it, do it yourself, or turn the guard off (guard: off in .dev-team/config.yml)."
      fi
      ;;
  esac
fi

exit 0

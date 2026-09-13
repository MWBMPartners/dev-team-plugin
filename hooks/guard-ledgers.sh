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
#   Rule 1 (Write only; on all the time unless `guard: off`) — a WRITE is refused when ALL three of
#   these hold: (a) the new content carries the dev-team marker (`<!-- dev-team: ledger=` or
#   `"dev-team": "ledger=`) on one of its first three lines; (b) the target's FILE NAME, with case
#   ignored, is one of the seven ledger names (PROJECT.md, FEATURES.md, SECURITY.md,
#   VERIFICATION.md, MIGRATION.md, HANDOFF.md, verdict.json); (c) the path, once resolved (see
#   "Path handling" below), is outside .dev-team/. So yes, this CAN block a person — but only in
#   one narrow shape: a file that is both named exactly like one of the plugin's ledgers AND
#   already starts with the plugin's own marker text. No project's own file looks like that unless
#   someone has copied a plugin ledger's content into it by hand, which is itself almost certainly
#   a mistake worth stopping to ask about. That is also why this rule stays on even outside an
#   active run: the mistake it is guarding against (a stale instruction telling a scribe to write
#   at the old top-level path) can happen in a one-off session just as easily as inside an
#   autopilot cycle. The refusal message says how to proceed either way: move the file under
#   .dev-team/, or, if it genuinely is the project's own file, set `guard: off` in
#   .dev-team/config.yml.
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
# Four faults found by later readings of this file, all now fixed:
#   - The JSON half of the marker match used to require exactly one space after each colon, so
#     compact JSON — `{"dev-team":"ledger=verdict schema=1.0"}`, with no spaces at all — was not
#     recognised as the marker even though it is exactly the same valid content. It now accepts
#     any amount of whitespace (including none) around each colon.
#   - Rule 2's ledger-name match used to compare capitals only. On a filesystem that ignores case
#     (macOS, by default) "security.md" IS "SECURITY.md" — the same file on disk — so matching
#     capitals only let a write spelled in lower case walk past the rule while still landing on the
#     real file the rule exists to protect. Rule 2 now compares the name with case ignored. Rule
#     1's separate ".dev-team/" folder test (just below) is left case-sensitive on purpose: refusing
#     a write to something that merely looks like ".DEV-TEAM/" is the safe direction to be wrong
#     in, whereas loosening it could let a write past the folder check entirely.
#   - Rule 1 used to fire on ANY path outside .dev-team/ that carried the marker on its first three
#     lines, with no check on the file's name. That refused this very plugin's own test fixture,
#     tests/fixtures/verdict.sample.json — whose whole purpose is to hold real marker-bearing
#     sample content for the schema tests to check against, and which is nobody's ledger. A rule
#     that blocks the plugin's own repository from writing its own fixtures contradicts the "can
#     never block a person" claim this comment used to make. Rule 1 now also requires the file
#     NAME to be one of the seven ledger names before it fires, so a fixture, a sample, or any
#     other file that merely happens to quote the marker inside marker-unrelated content is left
#     alone.
#   - Path handling used to strip a leading "<cwd>/" once and then a leading "./" once, which is
#     one pass, not a resolution. A path built from "." and ".." segments — ".dev-team/../
#     SECURITY.md", or "././SECURITY.md" — walks straight past a single strip: the first still
#     starts with ".dev-team/" as far as a literal string match is concerned even though it
#     actually names a file one level up, and the second still starts with "./" after only one
#     strip. Both rules now resolve the path lexically first (see "Path handling" below), so a
#     write that only LOOKS like it targets .dev-team/, or only looks like a distinct top-level
#     ledger name, is judged by where it actually lands.
#
# Path handling: Claude Code sends the session's working folder as the top-level `cwd` field on
# every hook call. When `tool_input.file_path` is absolute, this script strips a leading `<cwd>/`
# (falling back to the shell's own $PWD only if `cwd` is missing from the payload). What is left is
# then resolved LEXICALLY, in pure bash: split on "/", drop every empty and "." piece, and for each
# ".." remove the piece before it. This is text-only, on purpose — it does not touch the real
# filesystem (no `realpath`, no `cd`), because the file being written often does not exist yet, and
# `realpath`'s exact behaviour differs between macOS and Linux. If a ".." would remove a piece that
# is not there (the path tries to climb above where it started), the path is treated as having left
# the project: it counts as outside .dev-team/ for Rule 1, and it is not matched against any of
# Rule 2's top-level names — but Rule 1 still checks such a path by its file name, since a marker-
# bearing ledger-named file written anywhere outside the project is exactly as wrong as one written
# inside it at the wrong spot. .dev-team/config.yml and .dev-team/loop.lock/ are read relative to
# `cwd` when it is present, unresolved — those two paths are always written by this plugin itself
# with no user-supplied segments, so there is nothing for them to walk past. Confirmed against
# Claude Code's official hooks documentation
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

# Strip a leading "<cwd>/" (or "$PWD/" when `cwd` is absent from the payload). Quoting the pattern
# operand keeps it literal — a path is never treated as a glob here. What is left, $norm_path, is
# the path as the caller wrote it — still carrying any "." or ".." segments — kept around only for
# the messages below, so a refusal quotes back what the caller actually typed.
strip_prefix="${cwd:-$PWD}"
case "$file_path" in
  "$strip_prefix"/*) norm_path="${file_path#"$strip_prefix"/}" ;;
  *) norm_path="$file_path" ;;
esac

# Resolve $norm_path lexically — see the "Path handling" header comment for why this has to be a
# pure text operation and cannot call out to `realpath`. Sets two globals: $resolved (the path with
# every "." and "sibling .." pair collapsed away) and $escaped (1 if a ".." ever tried to remove a
# piece that was not there, meaning the path climbed above where it started and has left the
# project; 0 otherwise). Bash's own field-splitting on IFS='/' turns "a//b" into "a", "", "b" — the
# empty piece is one of the two kinds this function is told to drop, so a doubled slash is handled
# for free. Written to avoid bash 4+-only features (no `${arr[-1]}` negative indexing) because
# macOS ships bash 3.2.
resolve_lexical() {
  local input="$1" seg
  local -a segs=() parts=()
  local old_ifs="$IFS"
  IFS='/'
  read -ra segs <<< "$input"
  IFS="$old_ifs"
  escaped=0
  for seg in "${segs[@]}"; do
    case "$seg" in
      ''|'.') continue ;;
      '..')
        if [ "${#parts[@]}" -gt 0 ]; then
          # Drop the last kept piece by slicing it off — plain array slicing, not a negative
          # index, so this still works under bash 3.2.
          parts=("${parts[@]:0:$((${#parts[@]} - 1))}")
        else
          # Nothing left to remove: this ".." would step above the directory the path started
          # in. Once true, stays true for the rest of this path — see the header comment.
          escaped=1
        fi
        ;;
      *) parts+=("$seg") ;;
    esac
  done
  resolved="$(IFS='/'; echo "${parts[*]}")"
}
resolve_lexical "$norm_path"

deny() {
  echo "dev-team guard: $1" >&2
  exit 2
}

# The dev-team marker, as it appears in either a markdown ledger's HTML comment or verdict.json's
# JSON field — see conventions.md, "Where the plugin writes, and the ownership rule".
#
# The JSON half of this pattern used to require exactly one space after each colon (matching only
# `"dev-team": "ledger=`), because that is the one spacing the scribe always writes. That missed
# COMPACT json, e.g. `{"dev-team":"ledger=verdict schema=1.0"}` with no spaces at all — the same
# valid JSON, just written without the scribe's usual formatting (a person copying the value by
# hand, or a minifier, would produce exactly this). `[[:space:]]*` around each colon now accepts
# zero or more spaces (or tabs) on either side, so both the spaced and compact forms are caught.
# The markdown half is left exactly as written on purpose — the scribe only ever writes it one way
# (`<!-- dev-team: ledger=`), so there is no compact variant to worry about there.
marker_pattern='<!-- dev-team: ledger=|"dev-team"[[:space:]]*:[[:space:]]*"ledger='
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

# Is $resolved inside .dev-team/? An escaped path (one that climbed above the project) can never
# count as inside it, whatever its text happens to look like afterwards — see resolve_lexical's
# header comment. This test is deliberately case-SENSITIVE: a folder name really can differ only by
# case on a case-sensitive filesystem (most Linux CI runners), and refusing a write to something
# that merely looks like ".DEV-TEAM/" is the safe direction to be wrong in, since the cost of a
# wrongly-refused write is just "try the real path", not a ledger going to the wrong place.
in_devteam=0
if [ "$escaped" -eq 0 ]; then
  case "$resolved" in
    .dev-team/*) in_devteam=1 ;;
  esac
fi

# --- Rule 1: a Write whose content carries the marker AND whose file name is one of the seven
#     ledger names AND whose resolved path lands outside .dev-team/. All three together — not the
#     marker alone — because a fixture or sample file can legitimately quote the marker without
#     being a ledger, and this plugin ships exactly one such file (tests/fixtures/verdict.sample.
#     json), which must never be refused. See the header comment for the fault this fixes. --------
if [ "$checked" -eq 1 ] && [ "$tool_name" = "Write" ]; then
  first_three="$(printf '%s\n' "$content" | head -n 3)"
  if printf '%s' "$first_three" | grep -Eq "$marker_pattern"; then
    base_name="${resolved##*/}"
    base_lc="$(printf '%s' "$base_name" | tr '[:upper:]' '[:lower:]')"
    case "$base_lc" in
      project.md|features.md|security.md|verification.md|migration.md|handoff.md|verdict.json)
        if [ "$in_devteam" -eq 0 ]; then
          deny "this content carries the dev-team marker and \"$base_name\" is one of this plugin's ledger names, but the path \"$norm_path\" resolves outside .dev-team/. Write it under .dev-team/ instead — or, if this really is your own project's file, set \"guard: off\" in .dev-team/config.yml."
        fi
        ;;
    esac
  fi
fi

# --- Rule 2: a top-level ledger name (or a GitHub security-policy location), written while a run
#     is judged active, with content that looks like plugin output. ------------------------------
run_active=0
if [ -d "$(rel .dev-team/loop.lock)" ] || [ "$guard_mode" = "on" ] || [ -n "${DEV_TEAM_GUARD:-}" ]; then
  run_active=1
fi

if [ "$checked" -eq 1 ] && [ "$run_active" -eq 1 ] && [ "$escaped" -eq 0 ]; then
  # Compare the full resolved path with case ignored, because a filesystem that ignores case
  # (macOS, by default) treats "security.md" and "SECURITY.md" as the very same file on disk —
  # write to one and you have written to the other. Matching capitals only would let a write
  # spelled with different capitals walk straight past this rule while still landing on the real
  # file it is meant to protect. This is a separate variable, used only here — Rule 1's
  # ".dev-team/" folder test just above stays case-SENSITIVE on purpose: a folder name really can
  # differ only by case on a case-sensitive filesystem (most Linux CI runners), and refusing a
  # write that merely looks like ".DEV-TEAM/" or "Dev-Team/" is the safe direction to be wrong in,
  # since the cost of a wrongly-refused write is just "try the real path", not a ledger going to
  # the wrong place. An escaped path (see resolve_lexical) is skipped here entirely: it has left
  # the project, so it cannot be "the project's own top-level file" this rule exists to protect —
  # Rule 1 above still judges it by file name regardless.
  resolved_lc="$(printf '%s' "$resolved" | tr '[:upper:]' '[:lower:]')"
  case "$resolved_lc" in
    project.md|features.md|security.md|verification.md|migration.md|handoff.md|verdict.json|.github/security.md|docs/security.md)
      if printf '%s' "$content" | grep -Eq "$marker_pattern|$id_pattern"; then
        deny "\"$norm_path\" is a project-level file with a dev-team ledger name, and the content being written to it looks like this plugin's own output (the dev-team marker or a record id). The suite writes only into .dev-team/. If this is the project's own file and you meant to write to it, do it yourself, or turn the guard off (guard: off in .dev-team/config.yml)."
      fi
      ;;
  esac
fi

exit 0

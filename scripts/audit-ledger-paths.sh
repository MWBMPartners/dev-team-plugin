#!/usr/bin/env bash
#
# scripts/audit-ledger-paths.sh
#
# Plugin self-audit: catches the plugin's OWN documentation still pointing a writer at the old
# top-level location for one of the seven dev-team ledgers (PROJECT.md, FEATURES.md, SECURITY.md,
# VERIFICATION.md + verdict.json, MIGRATION.md, HANDOFF.md), instead of the current .dev-team/<name>
# path and its ownership marker. This exists because a leftover sentence in a skill, command or
# agent file is exactly how a scribe would end up writing "PROJECT.md at the repo root" again after
# the rest of the suite has already moved to .dev-team/ — see conventions.md, "Where the plugin
# writes, and the ownership rule", point 9 (this script is its third enforcement layer, after the
# written rule itself and the hooks/guard-ledgers.sh hook).
#
# What each check catches, and why it matters:
#
#   A (positive) conventions.md — the one canonical home for this rule — must still state the
#     .dev-team/ path for all seven ledger files and still carry the "Where the plugin writes"
#     heading. Every sibling file copies its wording from here, so if this file drifts, everything
#     that quotes it drifts too, silently.
#
#   B (positive) each ledger's own schema-defining reference file (the file a builder actually
#     reads before writing that ledger) must name both its .dev-team/ path and its marker string.
#     conventions.md can be perfectly correct while the one file a builder opens in practice still
#     says the old thing — this check is what catches that gap.
#
#   C (negative) a line using "repo root", "repo-root" or "sibling to" that STILL names a ledger
#     after every correct ".dev-team/<name>" mention has been removed from that same line. A line
#     that only talks ABOUT the old location in passing (with the correct path named alongside it)
#     is fine; a line that names a ledger with no .dev-team/ prefix anywhere near it is the shape a
#     half-finished find-and-replace leaves behind.
#
#   D (negative) a backticked or quoted anchor such as `PROJECT.md#Backlog` with no .dev-team/
#     prefix. Anchors get typed quickly by hand and are exactly the kind of reference that is easy
#     to leave stale when a path changes everywhere else in a sentence.
#
#   E (negative) the exact legacy phrases this project used before v1.5.0 ("stable repo-root", "at
#     the repo root", "Check the repo root", "from repo root") on a line where that line, or the
#     line just before or after it, still names a ledger with no .dev-team/ prefix. Why the
#     neighbouring lines: check C already covers a phrase and a bare name on the same line, and a
#     wrapped sentence often puts the name on the line above or below. Earlier version: E flagged
#     the phrase on its own, which rejected unrelated sentences such as one about config files
#     living at the repo root. What it cannot do: a bare name two or more lines away passes.
#
#   F (negative) the pre-v1.5.0 marker text "<!-- dev-team-schema:" appearing anywhere that is not
#     explaining the back-compat rule for it. The marker form itself is still legitimately mentioned
#     in a few places (conventions.md's own back-compat rule, the ownership-classifier in
#     dev-team-move-ledgers.md) — this check only objects to a bare reappearance with no
#     explanation, which would mean a file is being treated as current when it is describing the
#     retired form.
#
#   G (negative) README.md only: a skill description line (one starting **Purpose.**, **Modes.**,
#     **Artifacts.** or **Cold-resume.**) that still names a ledger with no .dev-team/ prefix once
#     every .dev-team/<name> mention is removed. Those lines tell a reader where each skill reads
#     and writes, so a bare name there is a live instruction, not an explanation. Limited to these
#     lines on purpose: a broader verb-based check was tried and flagged about a dozen harmless
#     lines elsewhere, and a name already qualified earlier in the very same line (a common style in
#     this README) is not the same fault. What it cannot do: a stale bare name in any other README
#     paragraph passes, and it does not look one line back the way check E does.
#
# What this script CANNOT do: it checks for the exact phrases and patterns listed above, and only in
# the plugin's OWN files — skills/, commands/, agents/, hooks/, README.md, CONTRIBUTING.md — never a
# user's project. A stale instruction worded some genuinely new way (a paraphrase, a typo, a path
# built up by string concatenation instead of typed literally) can still pass. This is one of four
# enforcement layers described in conventions.md point 9; the written rule itself is the real
# protection and this is a backstop, not a guarantee.
#
# "Legacy root" is the one allowed way to talk about the old location in running prose (see
# conventions.md, point 9): any line containing that phrase is exempt from checks C, D and E. Check
# F uses the wider word "legacy" alone, because the back-compat rule for the old marker form has to
# say "<!-- dev-team-schema:" out loud to explain it, and does not always also say "root" nearby.
#
# Excluded on purpose: CHANGELOG.md (released history is never rewritten to match today's wording),
# .claude/ (this repo's own working notes, not shipped plugin content), tests/ (test fixtures may
# deliberately contain the old phrases as part of what they are testing).
#
# Run locally or in CI. Prints "LEDGER-PATHS OK" and exits 0 on success; prints one or more
# "LEDGER-PATHS FAIL: <reason>" lines on stderr and exits 1 otherwise.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
fail=0
note() { echo "LEDGER-PATHS FAIL: $*" >&2; fail=1; }

CONVENTIONS="skills/dev-team-orchestrator/references/conventions.md"

# The files/directories this script is allowed to look at — the plugin's own instructions, not a
# user's project and not this repo's own working notes or test fixtures (see the exclusions above).
SCOPE=(skills commands agents hooks README.md CONTRIBUTING.md)

# ---------------------------------------------------------------------------
# A) conventions.md states every .dev-team/ ledger path and the ownership-rule heading.
# ---------------------------------------------------------------------------
if [ -f "$CONVENTIONS" ]; then
  for needle in \
    '.dev-team/PROJECT.md' '.dev-team/FEATURES.md' '.dev-team/SECURITY.md' \
    '.dev-team/VERIFICATION.md' '.dev-team/verdict.json' '.dev-team/MIGRATION.md' \
    '.dev-team/HANDOFF.md' '## Where the plugin writes, and the ownership rule'; do
    grep -qF "$needle" "$CONVENTIONS" || note "A: $CONVENTIONS is missing '$needle'"
  done
else
  note "A: $CONVENTIONS not found"
fi

# ---------------------------------------------------------------------------
# B) each ledger's own schema-defining reference file names its .dev-team/ path and its marker.
# ---------------------------------------------------------------------------
check_b() {
  local file="$1"
  shift
  if [ ! -f "$file" ]; then
    note "B: $file not found"
    return
  fi
  local needle
  for needle in "$@"; do
    grep -qF "$needle" "$file" || note "B: $file is missing '$needle'"
  done
}

check_b "skills/dev-team-orchestrator/references/documentarian-protocol.md" \
  '.dev-team/PROJECT.md' 'ledger=project'
check_b "skills/dev-team-featurefind/references/gap-scoring-rubric.md" \
  '.dev-team/FEATURES.md' 'ledger=features'
check_b "skills/dev-team-security/references/threat-model-and-surface-protocol.md" \
  '.dev-team/SECURITY.md' 'ledger=security'
check_b "skills/dev-team-review/references/verdict-and-report-protocol.md" \
  '.dev-team/VERIFICATION.md' '.dev-team/verdict.json' 'ledger=verification' 'ledger=verdict'
check_b "skills/dev-team-migrate/references/migration-plan-protocol.md" \
  '.dev-team/MIGRATION.md' 'ledger=migration'
check_b "skills/dev-team-orchestrator/references/handoff-template.md" \
  '.dev-team/HANDOFF.md' 'ledger=handoff'

# ---------------------------------------------------------------------------
# Shared helper for the four negative checks (C, D, E, F): run a grep pattern across the scope,
# split each hit into path / line number / line content (grep -rn's own "path:lineno:content"
# format — only the first two colons are meaningful, so the rest of the line is left intact even
# when it contains colons of its own), skip the line if it matches the given exemption pattern, and
# otherwise report it through $1 (the note prefix).
# ---------------------------------------------------------------------------
scan_negative() {
  local label="$1" pattern="$2" exempt="$3" message="$4"
  local hit path rest lineno content
  while IFS= read -r hit; do
    [ -n "$hit" ] || continue
    path="${hit%%:*}"
    rest="${hit#*:}"
    lineno="${rest%%:*}"
    content="${rest#*:}"
    printf '%s' "$content" | grep -qiE "$exempt" && continue
    note "$label: $path:$lineno $message: $content"
  done < <(grep -rnE "$pattern" "${SCOPE[@]}" 2>/dev/null)
}

# ---------------------------------------------------------------------------
# C) "repo root" / "repo-root" / "sibling to" lines that still name a ledger once every correct
#    .dev-team/<name> mention on that same line has been stripped out.
# ---------------------------------------------------------------------------
LEDGER_NAME_RE='(PROJECT|FEATURES|SECURITY|VERIFICATION|MIGRATION|HANDOFF)\.md|verdict\.json'
while IFS= read -r hit; do
  [ -n "$hit" ] || continue
  path="${hit%%:*}"
  rest="${hit#*:}"
  lineno="${rest%%:*}"
  content="${rest#*:}"
  printf '%s' "$content" | grep -qi 'legacy root' && continue
  stripped="$(printf '%s' "$content" | sed -E 's#\.dev-team/(PROJECT|FEATURES|SECURITY|VERIFICATION|MIGRATION|HANDOFF)\.md##g; s#\.dev-team/verdict\.json##g')"
  if printf '%s' "$stripped" | grep -qE "$LEDGER_NAME_RE"; then
    note "C: $path:$lineno names a ledger without a .dev-team/ prefix nearby: $content"
  fi
done < <(grep -rniE 'repo root|repo-root|sibling to' "${SCOPE[@]}" 2>/dev/null)

# ---------------------------------------------------------------------------
# D) a backticked or quoted ledger anchor with no .dev-team/ prefix, e.g. `PROJECT.md#Backlog`.
# ---------------------------------------------------------------------------
scan_negative "D" \
  '[`"](PROJECT|FEATURES|SECURITY|VERIFICATION|MIGRATION|HANDOFF)\.md#' \
  'legacy root' \
  "has a ledger anchor without the .dev-team/ prefix"

# ---------------------------------------------------------------------------
# E) the exact legacy phrases this project used, before v1.5.0, to describe the old location.
# ---------------------------------------------------------------------------
while IFS= read -r hit; do
  [ -n "$hit" ] || continue
  path="${hit%%:*}"
  rest="${hit#*:}"
  lineno="${rest%%:*}"
  content="${rest#*:}"
  printf '%s' "$content" | grep -qi 'legacy root' && continue
  start=$((lineno > 1 ? lineno - 1 : 1))
  window="$(sed -n "${start},$((lineno + 1))p" "$path" | sed -E 's#\.dev-team/(PROJECT|FEATURES|SECURITY|VERIFICATION|MIGRATION|HANDOFF)\.md##g; s#\.dev-team/verdict\.json##g')"
  if printf '%s' "$window" | grep -qE "$LEDGER_NAME_RE"; then
    note "E: $path:$lineno still uses a legacy repo-root phrase next to a bare ledger name: $content"
  fi
done < <(grep -rnE 'stable repo-root|at the repo root|Check the repo root|from repo root' "${SCOPE[@]}" 2>/dev/null)

# ---------------------------------------------------------------------------
# F) the pre-v1.5.0 "<!-- dev-team-schema:" marker text, outside a line that explains it as legacy.
# ---------------------------------------------------------------------------
scan_negative "F" \
  '<!-- dev-team-schema:' \
  'legacy' \
  "uses the old dev-team-schema marker outside a legacy explanation"

# ---------------------------------------------------------------------------
# G) README.md only: a skill description line (**Purpose.**/**Modes.**/**Artifacts.**/
#    **Cold-resume.**) that still names a ledger with no .dev-team/ prefix once every correct
#    .dev-team/<name> mention on that same line has been stripped out. See the header comment
#    above for why this is narrower than checks C/D/E.
# ---------------------------------------------------------------------------
while IFS= read -r hit; do
  [ -n "$hit" ] || continue
  lineno="${hit%%:*}"
  content="${hit#*:}"
  printf '%s' "$content" | grep -qi 'legacy root' && continue
  stripped="$(printf '%s' "$content" | sed -E 's#\.dev-team/(PROJECT|FEATURES|SECURITY|VERIFICATION|MIGRATION|HANDOFF)\.md##g; s#\.dev-team/verdict\.json##g')"
  if printf '%s' "$stripped" | grep -qE "$LEDGER_NAME_RE"; then
    note "G: README.md:$lineno a skill description names a ledger without the .dev-team/ prefix: $content"
  fi
done < <(grep -nE '^\*\*(Purpose|Modes|Artifacts|Cold-resume)\.\*\*' README.md 2>/dev/null)

[ "$fail" -eq 0 ] && echo "LEDGER-PATHS OK"
exit "$fail"

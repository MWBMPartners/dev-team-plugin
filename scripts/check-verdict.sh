#!/usr/bin/env bash
#
# scripts/check-verdict.sh
#
# Checks the parts of .dev-team/verdict.json's shape that JSON Schema cannot express, as a
# companion to schemas/verdict.schema.json (see that file's top-level "$comment" and its
# "checked"/"claims" field descriptions, which point back here). A JSON Schema "if/then" rule can
# compare one field's value against another field's value, but it cannot count how many array
# entries match a condition and compare that count to a different field, and it cannot compare one
# array item's field against another item's field (which is what "every claim id is unique" needs).
# Those are exactly the invariants a verdict.json must hold for its own counts to mean what they
# say — see skills/dev-team-review/references/verdict-and-report-protocol.md, "Overall verdict
# rule", and the schema's own field descriptions for "checked" and "claims".
#
# Usage:
#   scripts/check-verdict.sh <path-to-verdict.json>
#
# What it checks, in order (each is its own jq -e call, so a failure names exactly which rule
# broke):
#   1. The "claims" array has exactly "checked" entries — nothing was counted but never listed, or
#      listed but never counted.
#   2. The five per-verdict counts (verified + failed + drifted + hollow + unverifiable) add up to
#      "checked" — nothing was silently double-counted or dropped between the tally and the total.
#   3. Each of the five counts matches the number of claims in the "claims" array carrying that
#      exact verdict word — the headline number and the detail list must agree.
#   4. Every claim "id" is unique — a duplicated id would mean two rows in VERIFICATION.md's
#      per-claim table collapse into one entry here, silently losing one claim's result.
#
# What this script deliberately does NOT do: it does not check the file's shape (required fields,
# enum values, types) — that is schemas/verdict.schema.json's job, run first with check-jsonschema.
# This script assumes a file that already passed that schema; run against a file that has not, its
# jq queries may simply find nothing to compare and report a rule as failing for the wrong reason.
# It also does not check "regressions" or "improvement_findings" against anything, and does not
# require every id in "regressions" to also appear in "claims" — the protocol does not clearly
# require that, and adding it here would be a silent design decision, not an enforcement of an
# existing rule.
#
# Exit codes: 0 = every rule held ("VERDICT-CHECK OK" on stdout). 1 = the file is readable, valid
# JSON, but fails one or more rules ("VERDICT-CHECK FAIL: <rule text>" lines on stderr, one per
# failed rule). 2 = this script could not even attempt the checks — no argument, the file cannot be
# read, the file is not valid JSON, or the "jq" tool is not on PATH. Exit 2 is a refusal, not a
# pass: a checker that cannot run must never be silently treated as "nothing wrong was found".
set -uo pipefail

note() { echo "VERDICT-CHECK FAIL: $*" >&2; }

if [ "$#" -lt 1 ]; then
  note "usage: scripts/check-verdict.sh <path-to-verdict.json>"
  exit 2
fi

file="$1"

if ! command -v jq >/dev/null 2>&1; then
  note "the 'jq' tool is not on PATH — cannot check verdict.json without it"
  exit 2
fi

if [ ! -r "$file" ]; then
  note "cannot read '$file'"
  exit 2
fi

if ! jq empty "$file" >/dev/null 2>&1; then
  # Invalid JSON means none of the four checks below can even run, so this is the same
  # kind of "could not attempt the checks" case as a missing file or missing jq, not a
  # checked-and-failed verdict. Round-3 verification found this line exiting 1 instead,
  # which contradicted the exit-code table above (line 41 already listed "not valid
  # JSON" under exit 2) — a caller that treats 1 as "checked, and it failed" would read
  # a truncated verdict.json as a real failed review. Fixed by matching the header
  # instead of changing the header to match the code, since exit 2 is the correct
  # meaning: nothing was checked.
  note "'$file' is not valid JSON"
  exit 2
fi

fail=0

# 1) claims list length equals "checked".
if ! jq -e '(.claims | length) == .checked' "$file" >/dev/null 2>&1; then
  note "claims list length does not equal checked"
  fail=1
fi

# 2) the five counts add up to "checked".
if ! jq -e '(.verified + .failed + .drifted + .hollow + .unverifiable) == .checked' "$file" >/dev/null 2>&1; then
  note "the five counts do not add up to checked"
  fail=1
fi

# 3) each count matches the number of claims carrying that verdict word. Bash 3.2 has no
# associative arrays, so the field/verdict pairs are just walked as plain word pairs.
pairs="verified:VERIFIED failed:FAILED drifted:DRIFTED hollow:HOLLOW unverifiable:UNVERIFIABLE"
for pair in $pairs; do
  field="${pair%%:*}"
  word="${pair#*:}"
  if ! jq -e --arg field "$field" --arg word "$word" \
    '([.claims[] | select(.verdict == $word)] | length) == .[$field]' "$file" >/dev/null 2>&1; then
    note "$field does not match the number of $word claims"
    fail=1
  fi
done

# 4) every claim id is unique.
if ! jq -e '([.claims[].id] | length) == ([.claims[].id] | unique | length)' "$file" >/dev/null 2>&1; then
  note "claim ids are not unique"
  fail=1
fi

[ "$fail" -eq 0 ] && echo "VERDICT-CHECK OK"
exit "$fail"

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
# Exit codes: 0 = every rule held ("VERDICT-CHECK OK" on stdout). 1 = the file is readable, holds
# exactly one JSON object, but fails one or more rules ("VERDICT-CHECK FAIL: <rule text>" lines on
# stderr, one per failed rule). 2 = this script could not even attempt the checks — no argument, the
# file cannot be read, the file is empty or whitespace-only, the file is not valid JSON, the file
# does not hold exactly one JSON value of type object (for example a bare number, a bare array, or
# two JSON values run together in one file), or the "jq" tool is not on PATH. Exit 2 is a refusal,
# not a pass: a checker that cannot run must never be silently treated as "nothing wrong was found".
# A bare scalar such as "42" is, by itself, syntactically valid JSON — but this script's whole job
# is to check a JSON *object*'s fields against each other (see "What it checks" above), so a file
# that parses but is not an object cannot be checked either, and exits 2 for the same reason an
# unreadable file does, not 1 (see the fault note further down, where this is enforced).
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

if ! jq -s -e 'length == 1 and (.[0] | type == "object")' "$file" >/dev/null 2>&1; then
  # Invalid, empty, or multi-value JSON means none of the four checks below can even
  # run, so this is the same kind of "could not attempt the checks" case as a missing
  # file or missing jq, not a checked-and-failed verdict. Round-3 verification found
  # this line exiting 1 instead of 2 for unparseable JSON, which contradicted the
  # exit-code paragraph above — fixed at the time by testing with "jq empty" and
  # exiting 2 when that failed.
  #
  # Round-4's stand-in review (finding N2) found that "jq empty" fixed only the
  # unparseable case and quietly let three other bad inputs straight through to the
  # eight rule checks below: a zero-byte file, a whitespace-only file, and a file
  # holding more than one JSON value back to back (e.g. "{} {}"). jq's "empty" filter
  # only checks that the input parses at all and then discards whatever it parsed to —
  # it does not care how many values it found or what shape the last one was — so all
  # three of those inputs make "jq empty" exit 0. The eight rule checks below then ran
  # against nothing (or against the second of two objects), failed every one of them,
  # and this script exited 1 with eight "VERDICT-CHECK FAIL" lines — read by a caller
  # as "checked, and it failed badly", when the true state was "nothing was checked".
  # An interrupted write that leaves .dev-team/verdict.json empty is exactly the
  # ordinary case this let slip through.
  #
  # Fixed by slurping the whole file into a one-element-or-more JSON array with
  # "jq -s" and requiring that array to have exactly one element, of type object:
  #   - empty or whitespace-only input slurps to an empty array (length 0) — rejected.
  #   - "{} {}" slurps to a two-element array (length 2) — rejected.
  #   - "{not json" still fails to parse at all — jq itself errors — rejected.
  #   - a bare scalar or array such as "42" or "[]" slurps to a one-element array, but
  #     that element's type is not "object" — rejected. This is new: a plain "is it
  #     valid JSON" test has no way to know the caller wanted an object specifically,
  #     only whether what was written parses. Since this script's rules all read
  #     fields off the top level (.checked, .claims, etc.), a file that parses but
  #     is not an object cannot be checked any more than an empty file can, so it is
  #     refused here rather than run through eight rule checks it cannot possibly
  #     satisfy. The exit-code paragraph above was updated to say so, because that
  #     paragraph and this check have to agree, or a caller reading only the header
  #     would expect a bare "42" to reach exit 1 when it now reaches exit 2.
  #   - a genuine single JSON object still slurps to a one-element array of type
  #     object — accepted, and control passes to the eight rule checks as before.
  #
  # What this still cannot do: a file holding one JSON object followed by trailing
  # garbage that jq's streaming parser treats as a second (invalid) value will also be
  # rejected here, which is correct; but this check says nothing about whether that one
  # object is the *right* shape (required fields, enum values) — that is still
  # schemas/verdict.schema.json's job, run first, as the header above says.
  note "'$file' is empty, not valid JSON, or not a single JSON object"
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

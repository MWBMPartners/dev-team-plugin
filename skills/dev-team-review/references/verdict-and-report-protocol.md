# Verdict & Report Protocol

How the verifier results become a trustworthy verdict and a `.dev-team/VERIFICATION.md` report — and how failures hand off to remediation if the user opted in. The report is a **standalone, independent artifact**: it is not written into the `.dev-team/PROJECT.md` whose claims it judges (only that file's Current-status line gets the headline verdict).

The documentarian writes `.dev-team/VERIFICATION.md` and `.dev-team/verdict.json`. Every file the dev-team suite writes for itself lives in `.dev-team/` and carries the dev-team marker on line 2; a file at that path without the marker is never written to — the run stops and asks. See `dev-team-orchestrator/references/conventions.md`, "Where the plugin writes, and the ownership rule".

## Per-claim verdicts (from the verifiers)

Each claim carries one verdict + the fresh evidence that produced it, plus a **severity** (impact if wrong: critical/high/medium/low) and the verifier's **confidence** (high/medium/low): `VERIFIED`, `FAILED`, `DRIFTED`, `HOLLOW`, `UNVERIFIABLE` (defined in `claim-extraction-and-verification-protocol.md`). Separately, verifiers return **improvement findings** (`I-0XX`) for inefficiencies that work but could be leaner. The documentarian tabulates both; the lead has already engaged with everything that isn't VERIFIED.

## Overall verdict rule

The project's headline verdict is **not an average** — it's gated by the worst that matters:

- **PASS** — every done-criterion, feature-vs-spec, and security `fixed-verified` claim is VERIFIED, **and** the integration check passed (the app runs and the primary user task works end-to-end). DRIFTED/UNVERIFIABLE items may exist but none on a critical claim.
- **PASS WITH GAPS** — the integration check passes and no critical claim FAILED, but there are real gaps: HOLLOW tests, DRIFTED records, UNVERIFIABLE criticals, or FAILED non-critical claims. Usable, but the record overstated things.
- **FAIL** — any critical done-criterion / feature / security claim FAILED, **or** the integration check failed (app doesn't run / core task broken). One broken core path is a FAIL even if 95% of claims verified.

"Critical" = anything the goal/definition-of-done depends on, plus every security finding whose recorded status mislabels its real state (a silently-built `proposed`, an unrotated `ROTATE`, a `fixed-verified` that re-attacks successfully). State which rule fired and why.

## `.dev-team/VERIFICATION.md` structure

```markdown
# Verification Report — [project name]
<!-- dev-team: ledger=verification schema=1.0 -->
- **Verified against:** .dev-team/PROJECT.md [+ .dev-team/SECURITY.md] @ commit <hash>   **date:** <date>
- **Depth:** quick | standard | deep
- **OVERALL VERDICT:** PASS | PASS WITH GAPS | FAIL  — [one line: which rule fired]

## Integration check (clean-room)
- Built/ran from a fresh checkout: [command] → [result]. Primary user task ([what]): [worked / broke — evidence/screenshot ref].

## Summary
- Claims checked: N   VERIFIED: a   FAILED: b   DRIFTED: c   HOLLOW: d   UNVERIFIABLE: e
- Improvement findings (inefficiencies): k
- Evidence-less claims in `.dev-team/PROJECT.md` (unverified by construction): [list]

## Prioritized gaps (worst first — this is the fix list)
1. [V-0XX] FAILED · critical — [claim] — [what's actually wrong + repro] — owner: [iterate/security]
2. [V-0YY] DRIFTED · high — [claim] — [record says X, reality is Y]
...

## Per-claim results
| id | type | claim | verdict | sev | conf | regression? | evidence (fresh) |
|----|------|-------|---------|-----|------|-------------|------------------|
| V-001 | criterion | GET /users returns list | VERIFIED | n/a | high | no | `curl ... → 200 [...]` |
| V-002 | feature | bulk-export matches spec | FAILED | high | high | no | spec step 3 (CSV) missing; repro: ... |
| V-003 | fix | F-002 secret removed | DRIFTED | critical | high | no | removed from code but still in git history; not rotated |
| V-004 | metric | coverage 78% | HOLLOW | medium | med | no | re-ran: 78% line, but auth module 0% asserted |

## Improvement findings (inefficiencies — feed the fix phase when improve=on)
| id | area | what's inefficient | evidence | suggested fix |
|----|------|--------------------|----------|---------------|
| I-001 | orders list | N+1 query, ~40 calls/page | query log | batch/eager-load |

## Regression delta (vs prior `.dev-team/VERIFICATION.md`, if any)
- Regressed (was VERIFIED, now failing): [list, high severity]
- Resolved since last report: [list]

## Completeness
- Every claim covered? [yes / these were skipped: ...]
- Claims that never had evidence: [list]
```

Alongside the markdown report, emit a machine-readable **`.dev-team/verdict.json`** so the review can gate CI (exit non-zero on FAIL). Its first field is the same dev-team ownership marker every ledger carries, just as a JSON top-level string field because JSON has no comment syntax to put it on a line 2 of its own; its full shape — every field, what it means, and who reads it — is described in `schemas/verdict.schema.json`:

```json
{
  "dev-team": "ledger=verdict schema=1.0",
  "overall": "PASS_WITH_GAPS",
  "checked": 4,
  "verified": 1,
  "failed": 1,
  "drifted": 1,
  "hollow": 1,
  "unverifiable": 0,
  "integration": "pass",
  "regressions": ["V-002"],
  "improvement_findings": 1,
  "claims": [
    {"id": "V-001", "verdict": "VERIFIED", "severity": "n/a", "confidence": "high"},
    {"id": "V-002", "verdict": "FAILED", "severity": "high", "confidence": "high"},
    {"id": "V-003", "verdict": "DRIFTED", "severity": "critical", "confidence": "high"},
    {"id": "V-004", "verdict": "HOLLOW", "severity": "medium", "confidence": "medium"}
  ]
}
```

This example is deliberately real, valid JSON with real enum values rather than a `PASS | PASS_WITH_GAPS | FAIL`-style placeholder, so a builder can copy it as a starting fixture and it will pass `schemas/verdict.schema.json` as it stands — see that file's `required` list and `additionalProperties: false` for exactly which fields a real `verdict.json` must and must not carry.

Propose wiring `dev-team-review --depth quick` (or a saved invocation) into CI as a gate that fails the build on a FAIL verdict — the verification analogue of the security skill's CI hardening.

## Reporting to the user

Lead-style and short: the overall verdict first, then the integration result, then the prioritized gap list (what's broken / drifted / can't-verify), then where the full report lives (`.dev-team/VERIFICATION.md`). Don't recite the VERIFIED items — point to the file.

## Fix phase (default `remediate=fix`)

By default the run does **not** stop at the report — it corrects what it found by activating dev-team cycles on a `review-fix/<date>` branch, worst-first by severity:

1. **Route each item to the right sibling skill:**
   - FAILED/DRIFTED build, feature, or metric claims → `dev-team-iterate` (or `dev-team-orchestrator` for larger rework).
   - FAILED/DRIFTED security claims → `dev-team-security` (re-attack + fix). A review→security handoff must project the regression into `.dev-team/SECURITY.md`'s findings register (re-open the finding: `fixed-verified` → `open`, attach the fresh failing PoC and the V↔F id mapping). `.dev-team/SECURITY.md`'s register is the source of truth dev-team-security reads on resume; a verdict left only in `.dev-team/VERIFICATION.md` will not be picked up.
   - HOLLOW tests → a focused cycle to write tests that actually exercise the criterion.
   - **Improvement findings (inefficiencies)** → a `dev-team-iterate` run with `focus=efficiency` (only when `improve=on`, the default) — make it faster / leaner / less redundant **even though nothing is broken**.
2. **Modes:** `fix` (default) applies on the branch; `propose` lists fixes + owners and stops; `report` stops at the report. `improve=off` fixes only what's broken and leaves inefficiencies as recommendations.
3. **Each fix runs with that skill's own gates and invariants** (tests stay green, no regressions, the feature spec gate for any feature work, security PoCs re-run).
4. **Re-verify after every fix** — a remediated item isn't resolved until a fresh verification pass turns it VERIFIED. Update `.dev-team/VERIFICATION.md`, `.dev-team/verdict.json`, and the overall verdict.
5. **Hand the branch back** for the user to review and merge; never auto-merge to `main`.

Never mark anything resolved on the builder's say-so — the whole point of this skill is that resolution requires independent re-verification.

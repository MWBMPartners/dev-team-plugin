# Gap Scoring Rubric & Ledger Schema

How a candidate feature-gap becomes a **scored, classified, prioritized** ledger entry — measured against *this product's aim*, not against the competitor's. The whole point is to produce a short, honest, ranked list the user and the conductor can act on, not a padded backlog.

## Score each gap on six axes

| Axis | Question | Scale |
|---|---|---|
| **importance** | Within *our aim*, how much does this help the core user task or close a production-readiness expectation? | High / Med / Low |
| **prevalence** | How many comparables have it? (The table-stakes signal.) | n / N comparables |
| **scope-fit** | Does it serve the confirmed aim? | in-scope / out-of-scope |
| **differentiation** | Parity (catch up) or standout (pull ahead)? | parity / differentiator |
| **effort** | Rough build size. | S / M / L |
| **risk** | Chance it complicates the product or destabilizes existing flows. | Low / Med / High |

**importance is the headline and it is judged against the aim — never against the competitor.** A feature 6/6 comparables ship is *table-stakes-prevalent*, but if it doesn't serve our core task it's still Low importance (or out of scope). Conversely a feature only one adjacent tool has can be High if it directly advances our core task. **Score conservatively — when in doubt, score lower and lean out-of-scope.** Inflated importance is what turns a discovery pass into a build-everything mandate; don't.

**scope-fit is judged against the existing code, not just the aim sentence.** The architecture, data model, current/partial features, and integrations are the strongest evidence of what's in-scope: a gap the codebase is already built toward — a scaffolded module, a data model that already carries the entities, an integration already wired — is in-scope, and that same evidence usually makes it **lower effort** (the seams exist). A gap that needs a foreign subsystem the product isn't oriented around is out-of-scope (or, if genuinely aligned with the aim, flagged **high-effort / high-risk**). Cite the concrete code signal in `purpose-fit` so the call is checkable, not a vibe.

## Classify each gap

- **Table-stakes** — high prevalence + in-scope + users expect it; its absence reads as "unfinished." These are production-readiness gaps and rank at the top of the in-scope list.
- **Differentiator** — in-scope + would pull the product ahead, not just reach parity. High value when it serves the aim; rank by importance.
- **Nice-to-have** — in-scope but Low importance. Listed, ranked low.
- **Out of scope** — exists in comparables but doesn't serve our aim. Goes in its own section **with the reason**, never promoted into buildable work. This section is a feature of the report, not a failure — it shows the user what you deliberately *didn't* recommend and why.

## Compute a priority

Within the in-scope set, rank by **importance first**, then favor lower effort and lower risk to break ties (a High-importance / S-effort / Low-risk table-stakes gap is the obvious first pick). Don't over-engineer this into a formula — the ranking exists to tell the user "do these first," and the rationale matters more than a number.

## Ledger item schema

```markdown
- **id:** FG-001
  **feature:** [short name]
  **what:** [one line — the capability, in user terms]
  **class:** table-stakes | differentiator | nice-to-have | out-of-scope
  **importance:** High | Med | Low        ← within OUR aim, scored conservatively
  **prevalence:** [n/N comparables, list them]
  **seen-in:** [comparable → source URL, with evidence strength docs|pricing|third-party]
  **effort:** S | M | L      **risk:** Low | Med | High
  **purpose-fit:** [one line tying it to the confirmed aim — or, for out-of-scope, why it doesn't fit]
  **confidence:** high | low   ← low if only third-party/marketing evidence
  **spec-seed:** [2–4 lines roughing how it might work in OUR product — a starting point for
                 the Feature Spec Gate, NOT an approved spec; building still requires the gate]
```

`spec-seed` is a courtesy to the next step (it gives the Feature Spec Gate something to react to), but it is explicitly *not* an approved spec — featurefind proposes, the building skills' gate decides.

## FEATURES.md structure

The documentarian writes this at the repo root (sibling to `PROJECT.md` / `SECURITY.md`):

```markdown
# Feature Gap Ledger

## Aim  (the yardstick every gap is measured against)
[confirmed 1–2 sentence product aim]  ·  **category:** [...]

## Run record
- **last-run:** <date>   ·   **scope-setting:** strict|balanced|loose   ·   **depth:** ...

## Comparables researched
- [Name] — [direct | adjacent | leader] — [one-line positioning] — [primary source]
- ...
- **Coverage:** domains swept — [onboarding, core workflow, integrations, admin, …].
  Not covered / not public — [explicit gaps].

## In-scope gaps  (ranked — the buildable candidates)
1. FG-001 [class] — [feature] — importance High — [one line]   (full schema item below or inline)
2. ...

## Out-of-scope (surfaced, NOT recommended)
- [feature] — seen in [comparables] — **why excluded:** [doesn't serve the aim because …]

## Snapshot caveat
Competitor features as of <date>, from public sources; marketing claims may overstate. Re-run to refresh.
```

On a re-run, update the run record, refresh the comparable inventories (the market moved), re-diff against the now-current feature set (the product moved), and re-rank — delta, not cold rebuild. If `PROJECT.md` exists, sync the top in-scope gaps into its **Proposed-Features ledger** so `dev-team-iterate` / `dev-team-autopilot` can pick them up under the Feature Spec Gate.

## The boundary, restated

featurefind ends at the ledger. **Nothing here is approved to build — featurefind proposes and scores; it never builds.** What happens next depends on who acts: **standalone**, every in-scope gap is a *candidate* the user takes through the Feature Spec Gate (approving *which* features and *exactly how each works*) before any code. **Under the `dev-team-autopilot` conductor**, the gate is the conductor's autonomy test — candidates it can justify as clearly in-scope + net-positive are built autonomously (and surfaced for your review/revert), while out-of-scope, ambiguous, or risky ones are queued for your approval. Either way, keeping discovery separate from the build decision is what lets this skill hunt aggressively for gaps while building stays disciplined.

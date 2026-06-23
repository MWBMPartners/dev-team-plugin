# Research & Comparable Protocol

This is the front end of `dev-team-featurefind`: discover the products this app competes with or resembles, enumerate their features **with evidence**, and feed a clean candidate set to scoring. The discipline that makes it trustworthy is **citation-per-feature** (the discovery analogue of the suite's evidence-not-claims rule) and the **validator's refute pass** (the false-positive gate).

## Step 1 — Establish the comparable set

A *comparable* is a product that serves a similar core task, in three flavors — cover all three:

- **Direct competitors** — products a user would pick *instead of* this one.
- **Adjacent tools** — solve an overlapping problem from a different angle; often the source of differentiator ideas.
- **Category leaders** — the products that define what users *expect* in this category; the main source of table-stakes.

How to build the set:

1. If the user passed `competitors=...`, start there — they know their market. If they named a `category`, use it.
2. Otherwise, infer the category from the scout's product frame and have a researcher find the set via the web (search the category, "alternatives to X" pages, review-aggregator category pages, "best [category] tools" roundups). Treat roundups as *leads to the products*, not as feature evidence.
3. Aim for ~4–6 comparables by default (`count` tunes it). Breadth across the three flavors beats five near-identical direct competitors. Record the set and *why each was chosen* for the coverage list.

## Step 2 — Enumerate features (one researcher per slice)

Slice the work so researchers don't overlap: **one comparable each**, or for a large set, **one feature domain across all comparables** (e.g. "onboarding & auth across all six"). Spawn them in parallel (Opus 4.8, web-enabled), each with the brief below.

Pull features from the **strongest sources first**: the vendor's own product/docs/features pages and changelogs/release notes (authoritative), then pricing pages (reveal gated/tiered features), then third-party reviews (weaker — corroborate before trusting). For each feature, capture:

- **What it does** — one line, in user terms.
- **Source** — a URL (or doc title) that supports the claim, plus **evidence strength**: `docs` (vendor product docs/changelog) > `pricing` (vendor pricing/features page) > `third-party` (review/listicle/marketing). Weak evidence is allowed but flagged.
- **Domain** — onboarding, core workflow, collaboration, integrations, data/import-export, admin/permissions, notifications, search, mobile, accessibility, analytics/reporting, billing/packaging, API/extensibility, etc. (Domains double as the completeness checklist.)

### Researcher brief (paste into each, on top of `task-brief-template.md`)

```
## Role
You are a competitive-research analyst for an existing product. You investigate
[comparable / feature-domain]. You do NOT evaluate our product or propose what we
should build — you only report what THIS comparable does, with evidence.

## Task
Enumerate [comparable]'s feature set across [domains], focusing on features in the
same problem space as: [paste the app's inferred aim + its current surfaces].

## Evidence rule (hard)
Every feature you list MUST carry a source (URL/doc) and an evidence-strength tag
(docs > pricing > third-party). A feature you cannot source is dropped, not guessed.
Prefer the vendor's own product docs and changelog over listicles and ad copy.

## Report back
A feature inventory: [{feature, one-line description, domain, source, strength}].
Note the comparable's apparent positioning in one line (who it's for) — it helps
scope-fit judgement later. Flag anything you could only find in marketing copy.
```

## Step 3 — Hand off to gap analysis

Return the union of comparable inventories to the synthesizer for diffing against the **current feature set** (the scout's inventory) and scoring per `gap-scoring-rubric.md`. The synthesizer dedups features that several comparables share (and records the **prevalence** — how many comparables have it — which is the table-stakes signal).

## Step 4 — Validator refute pass (the false-positive gate)

Before any candidate becomes a ledger entry, a validator (Opus 4.8, skeptic) tries to **refute** each one. Default to dropping/down-scoping when unconfirmed.

```
## Role
You are an adversarial validator. For each candidate feature-gap, your job is to
make the case that it should NOT be on our buildable list. Default: refuted.

## For each candidate, check:
1. CITATION HOLDS — open/re-read the cited source. Does it actually show the
   comparable has this feature? Misread / marketing-implied / hallucinated → DROP.
2. ACTUALLY ABSENT — does OUR app already do this, possibly under a different name
   or on a different surface? Cross-check the current-feature inventory. Already
   present → DROP (not a gap). For candidates you would KEEP as gaps, confirm
   absence against LIVE CODE (not only the scout's inventory) — if the inventory
   was derived from a reused Codebase Map, a feature added since the map was
   written would otherwise be falsely reported as a gap.
3. IN SCOPE — does this serve the confirmed product aim AND fit the existing code?
   Check the architecture / data model / scaffolding (the scout's scope evidence),
   not just the aim sentence: a feature the codebase is already built toward is
   in-scope; one that belongs to a different product's purpose or needs a foreign
   subsystem the code isn't oriented around → move to OUT-OF-SCOPE with the reason
   (cite the code signal); do not score it as buildable. (Honor the `scope` arg:
   strict drops aggressively; loose keeps more but still tags them.)

## Report back
Per candidate: KEEP (in-scope gap) / OUT-OF-SCOPE (reason) / DROP (false positive,
reason). For KEEPs, confirm the evidence strength carried through.
```

Real-but-weakly-evidenced features (only third-party sources) are kept but tagged low-confidence, not dropped — the user can confirm.

## Web-research caveats (state these in the report)

- **Point-in-time.** Competitor features change; the ledger is a snapshot dated to this run. Note it.
- **Marketing ≠ reality.** A features page may list aspirational or enterprise-gated capabilities. Tag evidence strength so the user can weight it.
- **Coverage is bounded by what's public.** Closed/enterprise products expose little; absence of evidence isn't evidence of absence. Say what you couldn't see.
- **No scraping behind logins or paywalls**, and don't fabricate access — if a source isn't reachable, mark the feature low-confidence rather than inventing detail.

The completeness critic (end of run) checks the comparable set and domain checklist for obvious omissions; whatever it finds is another research round before the ledger is declared done.

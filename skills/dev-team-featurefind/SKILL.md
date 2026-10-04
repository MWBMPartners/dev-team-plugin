---
name: dev-team-featurefind
description: Research similar/competitor products and find the features your implementation is MISSING, then score each gap by how important it is to add within the project's aim — producing a scored feature-gap ledger (.dev-team/FEATURES.md) for you and the dev-team conductor to act on. Run as a team lead delegating to a team of opus-builder subagents (Opus tier): scouts read your current feature set, market researchers map comparables with citations, a skeptic validates every claimed gap, and a documentarian writes the ledger. Use this skill whenever the user asks "what features am I missing", "what should I add", "how do I compare to competitor X", wants a "competitive analysis", "feature gap analysis", "feature ideas", to "benchmark against similar products", or mentions "featurefind". Also use it as the discovery front-end before a feature-building push. Sibling of dev-team-orchestrator/iterate/security. Do NOT use it to BUILD features (that goes through dev-team-orchestrator/autopilot and the Feature Spec Gate), for a general "improve my app" request (use dev-team-iterate), for a factual product question like "what does X support" (just answer it), for market research unrelated to a codebase, or for one-off questions.
---

# Dev Team Feature Find

You are the **product lead doing competitive discovery** for a codebase the user owns. Your job: figure out what this product *is*, find the products it competes with or resembles, and surface **the features it's missing** — then score each gap by how much it matters *within this product's aim*. You do not build anything. You hand back a **scored feature-gap ledger** the user (and the `dev-team-autopilot` conductor) can turn into approved feature work.

This is the **discovery variant** of `dev-team-orchestrator`. It **reuses that skill's machinery wholesale** — the team model, brief format, evidence-not-claims, the skeptic/validator gate, the completeness critic, the documentarian. It changes only the front end (competitive research instead of a spec) and the output (a scored gap ledger instead of shipped code).

> **Read `dev-team-orchestrator/SKILL.md` first** — locate it via your `available_skills` registry (it lives under `~/.claude/skills/` for a user install or `.claude/skills/` for a project install). Delegation, team sizing, parallelism, the validator gate, and the documentarian all apply unchanged. This file documents only the discovery-specific deltas.

## The cardinal rule: scope is the filter, not the firehose

A competitor has a hundred features. Most of them are **not** gaps in your product — they serve a different aim. The single most valuable thing this skill does is **separate the features that genuinely belong in *this* product from the ones that would just bloat it.** Every gap is measured against the product's confirmed aim (purpose-fit) **and the existing code** — the architecture, data model, integrations, and any partial/scaffolded work are the strongest evidence of what this product actually is and where it's built toward, far richer than a one-line aim. A gap the codebase already leans toward is in-scope; one that needs a whole foreign subsystem the code isn't oriented around is not. Out-of-scope features are surfaced *as out-of-scope*, not promoted. A feature-gap list that's really a "clone every competitor" list is a failure — it manufactures work, the exact anti-pattern the suite forbids. **When in doubt, a feature is out of scope.**

## Your team

Same lead-delegates-to-`opus-builder` model as the orchestrator, with research-specific roles (model routing: `skills/dev-team-orchestrator/references/model-routing.md`):

- **Scouts** — the `opus-builder` agent (Opus tier), read-only. Map the **current implementation's feature set**: what the app actually does today, surface by surface. If a prior `dev-team-iterate` run wrote a **Codebase Map** to `.dev-team/PROJECT.md`, don't blindly reuse it — first run `dev-team-iterate`'s Step-0 freshness check (`references/audit-and-backlog-protocol.md` Step 0) before trusting it (see the freshness rule under Phase 0).
- **Market researchers** — the `opus-builder` agent (Opus tier), with web access (`WebSearch`/`WebFetch`). Each owns a slice — one comparable product, or one feature domain across several products — and returns its feature inventory **with a source citation per feature**. Reasoning alone hallucinates competitor features; citations are this skill's evidence-not-claims rule.
- **Synthesizer / scorer** — the `opus-builder` agent (Opus tier). Diffs competitor features against the current feature set, dedups, and scores each candidate gap with the rubric in `references/gap-scoring-rubric.md`.
- **Validator (skeptic)** — the `opus-builder` agent (Opus tier). The false-positive gate. For each candidate gap it tries to **refute**: does the citation actually support "competitor has this"? Is the feature genuinely *absent* from our app (not just named differently)? Is it *in scope* for our aim? Defaults to dropping/down-scoping when unconfirmed. See `references/research-and-comparable-protocol.md`. This gate stays on the Opus/frontier tier — never routed cheaper (model-routing.md, invariant 1).
- **Completeness critic** — the `opus-builder` agent (Opus tier), end of run. Asks "which obvious comparable or feature category did we never look at?" against the coverage list; gaps it finds become another research round.
- **Documentarian** — the `sonnet-scribe` agent (Sonnet tier). Owns **`.dev-team/FEATURES.md`**, the feature-gap ledger (external memory for this and future runs), and syncs the top in-scope gaps into `.dev-team/PROJECT.md`'s Proposed-Features ledger if it exists (found through the lookup order).

## The operating loop

```
PHASE 0: FRAME (scout current feature set + infer aim/category; reuse Codebase Map only after the freshness check)
   → SCOPE GATE (confirm aim + comparable set + scope boundary with the user; light, one stop)
   → [ research, per comparable / feature-domain slice, in parallel:
        DISCOVER comparables → ENUMERATE their features (each with a citation) ]
   → GAP ANALYSIS (diff competitor features vs current implementation → candidate missing features)
   → SCORE each candidate within the aim (importance · prevalence · scope-fit · differentiation · effort · risk)
   → VALIDATE (skeptic refutes: citation holds? actually absent? in scope?) → drop false / present / out-of-scope
   → COMPLETENESS CRITIC (missed comparables / categories?) → another round if it finds gaps
   → WRITE the scored ledger to .dev-team/FEATURES.md → REPORT (top in-scope gaps, table-stakes vs differentiators, what's out of scope and why)
```

### Phase 0 — Frame the product

**At the start of the run, before any agent is spawned:** take the instruction snapshot
(`dev-team-orchestrator/references/conventions.md`, "Repository instructions and normative
documents", step 1) — or, when this run resumes a recorded, unfinished one (the suite's Cold-resume
contract, same file), check and reuse that run's recorded snapshot instead, stopping with a plain
message if the check fails and never taking a new one in its place (a run recorded before 1.6.0 has
none: see step 1) — and settle `handoff-file` once ("Auto-handoff", same file); pass the snapshot in
every brief and the `handoff-file` value in every documentarian brief. Under the autopilot
conductor, use the conductor's snapshot and value instead of taking your own.

You're always in an existing repo, so **scout first**. Spawn scout(s) to establish, as first-class outputs:

- **What the app does today** — its surfaces and the features it already ships. This is the baseline you diff against; getting it wrong invents gaps that aren't gaps.
- **Scope evidence from the code** — the architecture and data model (what the product is *about*), existing integrations and dependencies (the world it lives in), and especially any *partial, scaffolded, or feature-flagged* work, TODOs, or roadmap notes (where it's *headed*). This is the primary input to scope-fit: it tells you which competitor features the product is naturally built toward (in-scope, and often low-effort because the seams already exist) versus which would require a foreign subsystem it isn't oriented around (out-of-scope, or high-effort/high-risk if genuinely aligned). Capture concrete signals (file/module names, entities, integration points), not impressions.
- **The inferred aim** — 1–2 sentences: *"[App] is a [category] that helps [who] do [core task]."* — synthesized from the code above, not guessed. (Reuse the inferred purpose from `.dev-team/PROJECT.md` if `dev-team-iterate` already wrote one.)
- **The category and likely comparables** — what class of product this is, and an initial list of direct competitors, adjacent tools, and category leaders to research.

If `.dev-team/PROJECT.md` exists (found through the lookup order) and has a **Codebase Map**, do **not** blindly reuse it — first run `dev-team-iterate`'s Step-0 freshness check (`references/audit-and-backlog-protocol.md` Step 0): the drift check `git diff --stat <map-commit>..HEAD` from the **Run record**'s map-commit, a 2–3 claim spot-check against live code (focus on the surfaces the gap analysis will diff competitor features against), and a delta-scout of the drifted areas. Reuse the map for **unchanged** areas; re-confirm the current feature inventory against live code for **changed** areas; full re-scout on huge drift or a failed/non-git check.

### The Scope Gate (one light stop)

Before spending a research wave, confirm the frame with the user — this is cheap and prevents researching the wrong category or chasing out-of-scope features:

- The **inferred aim** — ask them to correct it.
- The **comparable set** — the products you'll research. The user often knows competitors you won't find; let them add/remove.
- The **scope boundary** — what this product is deliberately *not* trying to be (so the validator can exclude features cleanly).

Take their edits, then run the rest autonomously to the ledger. (If invoked by the `dev-team-autopilot` conductor, the conductor supplies the confirmed aim and scope, and this gate is skipped — see "Running inside the conductor.")

### Research — discover comparables and enumerate features

Follow `references/research-and-comparable-protocol.md`. In short: spawn market researchers as the `opus-builder` agent (Opus tier, web-enabled), each owning a slice — a single comparable product, or one feature domain across the set. Each returns a **feature inventory with a citation per claimed feature** (a docs page, a pricing/features page, a changelog — prefer the vendor's own product docs over third-party listicles). Parallelize across non-overlapping slices. Target ~4–6 comparables by default (`count` arg tunes it); breadth across the category beats exhaustive depth on one competitor.

**Citation discipline is the evidence rule here.** "Competitor X has feature Y" with no source is an unconfirmed claim, not a finding — the validator will drop it. Marketing copy is weaker evidence than product docs; note which you have.

### Gap analysis & scoring

The synthesizer diffs the union of comparable features against the current feature set → **candidate gaps** (features one or more comparables have that our app lacks). It then scores each with the rubric in `references/gap-scoring-rubric.md` and classifies it:

- **Table-stakes** — category-standard; users expect it; its absence is a production-readiness gap. (High prevalence across comparables is the signal.)
- **Differentiator** — would set the product apart, not just reach parity.
- **Nice-to-have** — real but low impact within the aim.
- **Out of scope** — exists in comparables but doesn't serve *this* product's aim. Surfaced explicitly, never promoted into buildable work.

Each gap gets a composite **importance score** (within the aim) plus `effort` and `risk`, so the ledger is *prioritized*, not just a list.

### Validate — the skeptic gate (false-positive control)

Before anything lands in the ledger as a real gap, the validator tries to **refute** it, three ways:

1. **Citation holds?** Re-check the source actually supports "comparable has this." Hallucinated or misread features are dropped.
2. **Actually absent?** Confirm our app doesn't already do this under a different name/surface (the scout's feature inventory is the reference). A "gap" we already fill is dropped.
3. **In scope?** Measure against the confirmed aim **and the existing code** — a gap the current architecture / data model / scaffolding naturally hosts or is already built toward is in-scope; one that needs a foreign subsystem the code isn't oriented around is out-of-scope. Out-of-scope features are moved to the out-of-scope section with the reason (cite the code signal), not scored as buildable.

Unconfirmed → dropped or down-scoped. This is what keeps the ledger honest and short. (Mirrors the security skeptic and the iterate audit's conservative scoring.)

### Completeness critic & loop-until-covered

Before declaring the ledger done, run the completeness critic against the coverage list: which obvious comparable did we skip? Which feature category (onboarding, collaboration, integrations, admin, mobile, accessibility, pricing/packaging-driven features…) did no researcher touch? Anything it surfaces becomes another research round. Coverage is *shown* by the comparable + category list, not assumed.

### Output — the ledger & report

The documentarian writes **`.dev-team/FEATURES.md`** (schema in `references/gap-scoring-rubric.md`): the confirmed aim, the comparable set with sources, and the scored gap register (in-scope gaps ranked by importance, plus the out-of-scope section with reasons). It also **syncs the top in-scope gaps into `.dev-team/PROJECT.md`'s Proposed-Features ledger** when it exists (found through the lookup order), so `dev-team-iterate` / `dev-team-autopilot` can pick them up.

Then report to the user like a product lead: the handful of gaps that matter most and why, table-stakes vs differentiators, what you deliberately left out of scope, and the explicit reminder that **building any of these is gated** — the user's Feature Spec Gate standalone, or the conductor's autonomy test under autopilot — featurefind proposes; it never builds.

A later `dev-team-featurefind` run reads `.dev-team/FEATURES.md`, reuses the comparable set, and refreshes the ledger (the product and the market both moved) — delta, not cold restart.

## Running inside the conductor

`dev-team-autopilot` calls featurefind as its **discovery mode**. When it does:

- The conductor supplies the **confirmed aim and scope boundary** from its mission state — skip the Scope Gate (the user already approved the mission).
- Under autopilot, the Codebase Map may be produced by the same DISCOVER phase (`dev-team-iterate`'s audit runs just before featurefind) rather than a strictly prior run — treat a same-phase map as fresh.
- Write/refresh `.dev-team/FEATURES.md` and sync in-scope gaps to the Proposed-Features ledger as usual; the conductor reads those to plan its feature phase.
- Surface nothing for direct user approval here — the conductor owns the Feature Spec Gate under its hybrid gate policy. featurefind's job inside the loop is purely to keep the scored gap ledger current.

## Arguments

Optional run arguments (defaults in brackets):

- `competitors=<list>` — seed the comparable set explicitly (e.g. `competitors=Linear,Jira,Height`); else discover them [discover].
- `category=<name>` — override the inferred product category that drives the search [inferred].
- `count=N` — target number of comparables to research [~5].
- `scope=strict|balanced|loose` — how aggressively the validator excludes out-of-scope features [balanced]. `strict` keeps only clear purpose-fits; `loose` surfaces more adjacent ideas (still marked).
- `focus=table-stakes|differentiators|all` — bias the hunt toward closing parity gaps, toward standout features, or both [all].
- `depth=quick|standard|deep` — `quick`: top comparables, headline features. `standard`: full comparable set + category sweep + validate. `deep`: + changelog/recent-release mining and a second validation pass on high-importance gaps. [standard]
- `issues=off|sync|auto` — reflect this run's gap-ledger items in the repo's issue tracker. `sync` exports at the normal sync points; `auto` continuously reflects each item as it is finalized (per-task cadence). Both are dedup-safe and confirm-first on the first sync per repo. Platform is auto-detected from the git remote — GitHub via `gh`, GitLab via `glab`; a plain-git repo with no platform simply skips issue sync. See `skills/dev-team-orchestrator/references/issue-sync-protocol.md`. [off]

## What carries over from dev-team-orchestrator (unchanged)

- **Team sizing & parallelism** — parallelize non-overlapping research slices; one researcher per comparable/domain.
- **Brief discipline** — `references/task-brief-template.md`; full briefs, and **evidence-not-claims becomes citation-per-feature**.
- **The skeptic/validator gate** — same false-positive discipline as `dev-team-security`'s validator.
- **Completeness critic** — same end-of-run "what did we miss" pass.
- **Documentarian** — `references/documentarian-protocol.md`; the `sonnet-scribe` agent owns the ledger doc (`.dev-team/FEATURES.md` here).
- **Composing other skills** — route any product/market skill the user has to the researchers.

## References (read at the matching step)

- `references/research-and-comparable-protocol.md` — how to discover comparables, enumerate their features, the citation/evidence discipline, the validator's refute checklist, and the web-research caveats. Read before the research wave; paste the researcher + validator briefs into those agents.
- `references/gap-scoring-rubric.md` — the scoring rubric (importance within the aim), the table-stakes/differentiator/out-of-scope classification, and the `.dev-team/FEATURES.md` ledger schema. Read before scoring.

Reused from `dev-team-orchestrator/references/`: `task-brief-template.md`, `documentarian-protocol.md`.

The suite's **shared contracts** — artifact ownership & schemas, ID prefixes, the branch model, the flattening rule, gates, and safety — live in `dev-team-orchestrator/references/conventions.md`; read it once.

## Anti-patterns (in addition to the orchestrator's)

- **Cloning the competitor.** The deliverable is the *in-scope* gaps, not every feature a rival ships. Out-of-scope features are surfaced as out-of-scope, never promoted. When in doubt, out of scope.
- **Features without citations.** "Competitor X has Y" with no source is a hallucination risk — it's unconfirmed until the validator confirms the citation. No source, no gap.
- **Inventing gaps we already fill.** Confirm against the scout's feature inventory that the app doesn't already do it under another name. A renamed feature is not a gap.
- **Scoring by prevalence alone.** "Everyone has it" makes something table-stakes, but importance is judged against *our aim* — a popular feature that doesn't serve the core task is still low-importance (or out of scope).
- **Building anything.** This skill proposes and scores; every feature is still gated before it's built — the user's Feature Spec Gate (standalone) or the conductor's autonomy test (under autopilot). featurefind never writes production code.
- **Treating marketing copy as proof.** Prefer vendor product docs/changelogs over listicles and ad copy; note evidence strength when it's weak.
- **Manufacturing a long list to look thorough.** A short, sharp, honest ledger ("three gaps that matter, the rest is out of scope") beats a padded one. Conservative scoring is the rule, same as the iterate audit.

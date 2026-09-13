---
name: dev-team-docs
description: Systematically generate AND maintain a codebase's documentation — README, CHANGELOG, API/reference docs, docstrings/inline comments, usage guides, and architecture/onboarding docs — as a team lead delegating to a team of `sonnet-scribe` drafters (Sonnet tier, cheap) whose every claim is then checked by an `opus-builder` verifier (Opus tier) that traces it back to the real source before it ships. The whole point of this skill: accuracy over volume — never document an API, flag, endpoint, or behavior that isn't actually in the code. Runs three modes: `generate` (write docs from scratch where none or too little exist), `maintain` (update existing docs to match the current code), and `audit` (read-only: find and report doc drift/staleness without writing changes). Use when the user wants to "write/update the docs", "generate API docs", "document this codebase", "keep the README current", "add docstrings", "update the CHANGELOG", or produce an "onboarding/architecture doc". Sibling of dev-team-orchestrator/iterate/featurefind. Do NOT use to build product features (dev-team-orchestrator/iterate), for a competitive/what's-missing feature analysis (dev-team-featurefind), or to just answer a one-off question about the code (answer directly instead).
---

# Dev Team Docs

You are the **documentation lead** for a codebase the user owns. Your job is to make its
documentation **exist, be complete for the requested scope, and be true** — every claim a
doc makes about the code is traced back to the code itself before it ships. You do not write
production code and you do not invent facts; you delegate drafting to a cheap tier and spend
the expensive tier exclusively on **proving the draft is accurate**.

This is the **documentation variant** of `dev-team-orchestrator`. It **reuses that skill's
machinery wholesale** — the team model, brief format, evidence-not-claims, the checker
pattern, debate protocol, the documentarian. It changes the front end (a doc-surface scope
instead of a feature spec) and adds one hard rule the rest of the suite states in general
terms and this skill makes literal: **a documented claim with no traced source is not a
documented claim, it's a guess.**

> **Read `dev-team-orchestrator/SKILL.md` first** — locate it via your `available_skills`
> registry (it lives under `~/.claude/skills/` for a user install or `.claude/skills/` for a
> project install). Delegation, team sizing, parallelism, contracts, the checker pattern, and
> the documentarian all apply unchanged. This file documents only the docs-specific deltas.

## The core idea: write cheap, verify expensive

Docs are cheap-tier work — `sonnet-scribe` (Sonnet tier) drafts them, per
`model-routing.md`'s "Documentation / state" row, in every cost posture. What makes this
skill trustworthy despite that is the other half: an `opus-builder` checker (Opus tier)
**verifies every doc claim against the actual source** before any draft ships — this is the
suite's evidence-not-claims discipline (`conventions.md`), applied literally to prose instead
of to test output. A doc claim is anything a reader could rely on: a function signature, a
CLI flag, a config key, an endpoint and its response shape, a default value, an error
condition, a stated behavior, a runnable example. Every one of those gets traced to a real
`file:line`, and runnable examples get **actually run**, not just written. Unverifiable
claims are flagged, softened to "unknown"/"planned", or dropped — never shipped as fact.

**Accuracy over volume.** A short, true doc beats a comprehensive, half-invented one. Never
document an API, flag, endpoint, or behavior that isn't in the code — including describing a
TODO/roadmap item as if it already ships. When in doubt, verify harder or say less.

## Your team

Model routing: `skills/dev-team-orchestrator/references/model-routing.md`.

- **Scouts** — the `opus-builder` agent (Opus tier), read-only. Map the doc surface in scope:
  what documentation already exists (and where), the real code/API/config it should describe,
  and the project's **existing doc style** (heading conventions, docstring format, tone,
  README anatomy already in use) so new docs match rather than clash. This is the "expensive
  reasoning once" pass (model-routing.md, invariant 2) — the scout gathers exact signatures,
  flags, and endpoints so the drafter never has to guess or recall from training data.
- **Drafters** — the `sonnet-scribe` agent (Sonnet tier). Write or update the actual doc
  content per `references/doc-standards.md`, using **only** facts the scout handed them —
  never invented from memory of "typical" conventions. Cheap tier is correct here because a
  dense scout brief turns drafting into execution, not reasoning (invariant 2).
- **Accuracy checker** — the `opus-builder` agent (Opus tier). This is the skill's teeth: it
  independently re-derives every claim in the draft from the real source and either confirms
  it, fixes a small drift itself, or escalates. Follows
  `references/accuracy-verification-protocol.md`. Verification stays on the Opus/frontier
  tier — never routed cheaper (model-routing.md, invariant 1), and the checker is never the
  same agent thread that drafted the doc (conventions.md: "whoever verifies a thing is never
  whoever built it").
- **`deep-architect`** (Reasoning tier) — only for a genuinely hard doc-architecture decision:
  choosing a docs-generation strategy for a large/polyglot repo, restructuring a sprawling
  docs site, or deciding how a monorepo's packages share vs. duplicate reference docs. Use
  `debate-protocol.md` if the choice is contested. Most runs never need this role.
- **Documentarian** — the same `sonnet-scribe` agent, wearing its usual hat
  (`documentarian-protocol.md`): if `.dev-team/PROJECT.md` exists (found through the lookup
  order, from any prior `dev-team-*` run), it records what documentation now exists / what an audit found in
  **Current status** and, for a real judgment call, the decision log. `dev-team-docs` writes
  documentation files, not a new ledger — same posture as `dev-team-ship`.

## Picking the mode

- **`generate`** — the requested scope has no docs, or only a placeholder/stub. Write from
  scratch per `references/doc-standards.md`.
- **`maintain`** — docs already exist for the scope. Update them so they match the current
  code — the common, ongoing case ("keep the README current").
- **`audit`** — read-only. Find and report doc drift/staleness **without writing any
  changes** — for "check the docs", "how stale are our docs", or as a cheap first look before
  committing to a `maintain` pass.
- Infer when not stated: no doc file/section exists for a scope area → `generate` for that
  area; it exists and the code has moved since → `maintain`; the user only wants to know
  where things stand → `audit`. If genuinely mixed (some areas missing, some drifted), run
  `generate` for the missing areas and `maintain` for the existing ones in the same pass.
- **`.dev-team/` is never in scope.** That folder is the dev-team plugin's own working
  folder — its ledgers, run state, and config — not project documentation. Never treat a file
  inside `.dev-team/` as something this skill generates, maintains, or audits, even if a
  requested scope would otherwise seem to cover it.

## Cold-resume

Before fresh work, check for a prior `dev-team-docs` pass to resume from instead of
re-scouting cold (the suite's general Cold-resume contract, `conventions.md`) — this skill
owns no dedicated ledger file, so the check is: does `.dev-team/PROJECT.md` (if it exists,
found through the lookup order) carry a
Current-status note or decision-log entry from a prior docs pass, and what commit was it as
of? If so, `git diff --stat <that-commit>..HEAD` over the scoped doc-area's source tells you
whether to treat the prior draft as still-accurate (skip straight to a light re-verify) or
drifted (re-scout the changed slice only). No such record, a failed spot-check, or a dirty/
non-git tree → do a full scout for the requested scope.

## GENERATE mode

1. **Cold-resume + scope.** Confirm `mode`/`scope` with the user if ambiguous. Scout (read-
   only): the real code/API/config for the scope, plus any doc-style precedent elsewhere in
   the repo to match.
2. **Draft** (`sonnet-scribe`), per doc-area, from the scout's facts only — follow the
   relevant anatomy in `references/doc-standards.md` and match existing style where any
   precedent exists.
3. **Accuracy-verify** (`opus-builder` checker) — trace every claim to `file:line`, run every
   runnable example, per `references/accuracy-verification-protocol.md`. Triage
   CLEAN / FLAGGED-AND-FIXED / NEEDS-LEAD-REVIEW.
4. **Fix** — the checker corrects small, unambiguous drift itself; anything genuinely
   unverifiable, contentious, or requiring an intent call escalates to you. Never assert an
   unverifiable claim — mark it "unknown"/"planned" or drop it.
5. **Commit** — one commit per doc-area on the run branch (see Git isolation).
6. Repeat per doc-area until `scope` is fully covered, then **report**.

## MAINTAIN mode

Same loop, but the scout does a **delta scout**: `git diff` since the doc was last verified
(cold-resume) to find what changed in the code, plus a scan for net-new undocumented
additions. The drafter updates only what drifted — not a wholesale rewrite (noisy diffs help
no one). The checker, however, **re-verifies the whole doc-area**, not just the diff — stale
claims elsewhere in the same doc don't announce themselves. Commit per doc-area, same as
generate.

## AUDIT mode

Read-only — mirrors `dev-team-review`'s posture, scoped to docs:

1. **Scout**: the full existing doc surface in scope, and the code it claims to describe.
2. **Accuracy-verify**: the checker traces **every** claim (a full sweep, not just recently-
   touched ones) per `references/accuracy-verification-protocol.md` and produces a drift
   report: doc area, the claim, what the doc says vs. what the code actually does, drift type
   (stale / wrong / aspirational-as-current / broken link or reference / undocumented-
   entirely), and a severity (misleads a user vs. cosmetic).
3. **No draft, no fix, no commit.** Report the drift findings to the user; suggest a follow-up
   `mode=maintain` run to fix them.
4. **Document**: the `sonnet-scribe` documentarian records the audit result (counts by
   severity, headline findings) in `.dev-team/PROJECT.md`'s Current status if it exists
   (found through the lookup order) — no new ledger file is created. Audit mode moves and commits
   nothing, so if the only `PROJECT.md` is a marked legacy root file, record nothing into it and
   report the move as pending instead — "`PROJECT.md` is still at the top level of the project —
   run `/dev-team-move-ledgers` to move it into `.dev-team/`." (`conventions.md`, "Where the plugin
   writes, and the ownership rule", point 5, read-only commands and phases).
5. Optionally, `issues=sync` (or `auto`) exports the drift findings to the repo's issue tracker — GitHub or GitLab, auto-detected from the git remote (see Arguments).

## Definition of done

- [ ] Every doc-area in `scope` exists (generate) or is updated (maintain) to match the
      current code, in the project's existing doc style.
- [ ] Every claim in every touched doc — signature, flag, endpoint, default, error, behavior —
      has been traced to real source (`file:line`) by the accuracy checker; nothing shipped on
      the drafter's word alone.
- [ ] Every runnable example in a touched doc was **actually run**, not just written, wherever
      that's feasible; anything genuinely unrunnable is flagged as such, not silently assumed.
- [ ] No unresolved NEEDS-LEAD-REVIEW inaccuracy remains for the scope covered.
- [ ] Nothing in scope was silently skipped — a doc-area you didn't get to is stated as not
      done, not omitted quietly.
- [ ] Docs are committed per doc-area on the run branch and handed back for review (or, in
      `audit`, a drift report is delivered with no files changed).

## Git isolation

- One run = one branch: `docs/<date>` (suffix `-2` on collision), matching the suite's branch
  model. `audit` mode makes no commits at all (nothing to isolate).
- **One commit per doc-area** (README, API, docstrings, CHANGELOG, guides, architecture are
  separate commits) — a bad doc-area reverts independently of the others.
- Never merge to `main` yourself — hand the branch back for review, same as every sibling
  skill.
- A dirty working tree or non-git repo is surfaced to the user before proceeding, and it forces
  a full re-scout rather than trusting any cold-resume state.

## Arguments

Optional run arguments (defaults in brackets):

- `mode=generate|maintain|audit` — write from scratch, update to match current code, or
  read-only drift report [infer per "Picking the mode"].
- `scope=readme|api|reference|docstrings|changelog|guides|architecture|all` — which doc
  area(s) to work on; accepts a comma list (e.g. `scope=readme,changelog`) [all].
- `dry-run=on|off` — produce the full doc-area plan and the drafter/checker briefs you WOULD
  issue, but spawn no drafters or checkers and make no file or git changes; report the plan
  for approval. Precedence: this argument > `features.dry-run` in `.dev-team/config.yml` >
  built-in default [off]. Plain language ("just show me the plan", "dry run first") also sets
  it. See `dev-team-orchestrator/references/conventions.md` ("Dry-run / plan-preview"). (Not
  meaningful for `mode=audit`, which is already read-only.)
- `models=economy|balanced|max` — cost posture for the **scout** tier (`opus-builder` vs.
  `sonnet-builder`, per model-routing.md's cost-posture table); drafting stays on
  `sonnet-scribe` and verification stays on `opus-builder` regardless of posture — invariant 1
  holds here exactly as everywhere else in the suite. [balanced]
- `issues=off|sync|auto` — reflect `audit` mode's drift findings (or, in `generate`/`maintain`, any
  NEEDS-LEAD-REVIEW item left unresolved by choice) in the repo's issue tracker. `sync` exports at the
  normal sync points; `auto` continuously reflects each item as it is finalized (per-task cadence). Both
  are dedup-safe and confirm-first on the first sync per repo. Platform is auto-detected from the git
  remote — GitHub via `gh`, GitLab via `glab`; a plain-git repo with no platform simply skips issue
  sync. See `skills/dev-team-orchestrator/references/issue-sync-protocol.md`. [off]
- `branch=<name>` — override the default `docs/<date>` branch name.

## What carries over from dev-team-orchestrator (unchanged)

- **Team sizing & parallelism** — parallelize non-overlapping doc-areas; a drafter/checker
  pair per area, not per file.
- **Brief discipline** — `references/task-brief-template.md`; give the drafter a
  self-contained execution spec (invariant 2) — exact signatures/flags/endpoints, not
  "document the API."
- **Checker triage shape** — CLEAN / FLAGGED-AND-FIXED / NEEDS-LEAD-REVIEW, the same buckets
  as `checker-protocol.md`; the doc-specific "what to check" is
  `accuracy-verification-protocol.md` instead.
- **Documentarian** — `documentarian-protocol.md`; the `sonnet-scribe` agent records state in
  `.dev-team/PROJECT.md` when it exists (found through the lookup order) — `dev-team-docs`
  introduces no new ledger.
- **Debate mode** — `debate-protocol.md` for a contested doc-architecture decision.
- **Failed/stuck agents** — diagnose, re-brief, two strikes then re-scope.
- **Composing other skills** — if the user has a style/writing skill, route drafting through
  it and have the checker verify conformance alongside accuracy.

## References

- `references/doc-standards.md` — what good docs look like per type (README anatomy, API/
  reference conventions, docstring standards, CHANGELOG per Keep a Changelog, usage guides,
  architecture/onboarding docs), and the house rule: match the project's existing style, stay
  concise and current. Read before drafting.
- `references/accuracy-verification-protocol.md` — how the checker verifies every doc claim
  against the source: tracing symbols/flags/endpoints/behaviors to `file:line`, running
  examples, catching aspirational/stale/renamed claims, the claim-ledger format, and the
  triage buckets. This is the skill's teeth — read before the first accuracy-verify pass and
  paste it into the checker's brief.

Reused from `dev-team-orchestrator/references/`: `task-brief-template.md`,
`checker-protocol.md` (pattern only — the doc-specific checklist lives in
`accuracy-verification-protocol.md`), `documentarian-protocol.md`, `debate-protocol.md` (for a
contested doc-architecture call).

The suite's **shared contracts** — artifact ownership & schemas, ID prefixes, the branch
model, the flattening rule, gates, and safety — live in
`dev-team-orchestrator/references/conventions.md`; read it once.

## Anti-patterns (in addition to the orchestrator's)

- **Hallucinated or aspirational docs.** Describing a TODO/roadmap item, a half-built
  feature-flagged path, or a "typical" convention from training data as if it's current,
  shipped behavior. If it's not traceable to real source right now, it doesn't go in as fact.
- **Volume over accuracy.** A doc that covers more surface but has unverified claims is worse
  than a shorter, fully-verified one. Never pad scope to look thorough at the cost of truth.
- **Docs that drift from code with no verify.** Shipping a draft straight from the drafter
  without an independent accuracy-verify pass — "it's just docs" is exactly the reasoning
  evidence-not-claims exists to forbid.
- **The checker trusting the drafter's word.** Independently re-deriving every claim from
  source is the whole point; skimming the draft and nodding along is not verification.
- **Gold-plating.** Padding docstrings onto trivial one-line accessors, restating the obvious,
  or writing a comprehensive guide nobody asked for in scope. Concise and true beats exhaustive
  and stale.
- **Full-file rewrites in `maintain` mode** when only a slice drifted — needlessly noisy diffs
  make the real change harder to review.
- **Calling an example "documented" without running it.** A code block that was never executed
  is a claim, not a verified fact — run it or flag it as unverifiable.
- **Auto-merging to `main`.** Docs changes go on `docs/<date>` and are handed back for review
  like every sibling skill.

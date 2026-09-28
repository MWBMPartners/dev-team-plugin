---
name: dev-team-review
description: Run an independent verification / QA pass over work done by the other dev-team skills, as a team lead delegating to a team of opus-builder subagents (Opus tier). It reads the .dev-team/PROJECT.md (and .dev-team/SECURITY.md) those skills wrote, extracts every claim — done-criteria, completed stages, shipped features and their specs, fixed security findings, decisions, the Codebase Map, the trajectory metrics — and spawns independent, adversarial verifier agents to PROVE each one actually works as intended, with fresh evidence. Defaults to read-only reporting; can optionally hand failures back for remediation. Use when the user wants to "verify", "QA", "review", "double-check", or "confirm everything works" after a dev-team-orchestrator / dev-team-iterate / dev-team-security run. Do NOT use to build features or for one-off questions; for verifying/QAing Stripe or payments code specifically, use dev-team-stripe (review mode).
---

# Dev Team Review

You are the **independent verification lead**. Another team (dev-team-orchestrator / iterate / security) did the work and recorded what they did in `.dev-team/PROJECT.md` (and `.dev-team/SECURITY.md`). Your job is to **prove, with fresh evidence, that every one of those claims is actually true** — that the project works as intended — and to surface anything that doesn't, is unverifiable, or doesn't match what was recorded.

You are the antidote to optimistic "it works." You **default to NOT verified** and trust nothing until you've re-checked it yourself.

This is the **verification variant** of `dev-team-orchestrator`. It **reuses that skill's machinery** — the team model, brief format, checker discipline, documentarian, evidence-not-claims, rollback commits (only if remediating). It changes the front end (you read `.dev-team/PROJECT.md`'s claims instead of a spec) and the work (independent adversarial **verification** instead of building).

> **Read `dev-team-orchestrator/SKILL.md` first** — locate it via your `available_skills` registry (it lives under `~/.claude/skills/` for a user install or `.claude/skills/` for a project install). Delegation, team sizing, parallelism, the checker, and the documentarian all apply. This file documents the verification-specific deltas.

## Principles (what makes this trustworthy)

- **Independence.** Verifiers must be different agents from whoever built the thing — which a separate `dev-team-review` invocation gives you for free. Never let a builder grade its own work.
- **Default to unverified.** A claim is FAILED/UNVERIFIABLE until evidence forces VERIFIED. Optimism is the enemy.
- **Evidence, not claims.** Every VERIFIED carries *fresh* pasted proof you generated now — a test run, a build log, the app's actual output, a screenshot — not a quote of what `.dev-team/PROJECT.md` said.
- **Catch over-claiming and drift.** A primary output: claims in `.dev-team/PROJECT.md` with no evidence, or that don't match the code/reality. "Said done, isn't" is exactly what this skill exists to find.
- **Verify read-only, then fix.** The verification phase changes nothing — it only gathers fresh evidence. The **fix phase that follows (default-on)** corrects what it found — bugs *and* inefficiencies, improving even what isn't broken — by activating the right dev-team cycle on a branch, then **re-verifies**. Set `remediate=report` for report-only.

## Your team

- **Verifier agents** — the `opus-builder` agent (Opus tier), adversarial and independent. Take a group of claims and **try to prove each false**; a claim survives only with fresh evidence. They also flag **inefficiencies** noticed in passing (works, but slow / wasteful / redundant) as *improvement findings*, not just claim failures. Follow `references/claim-extraction-and-verification-protocol.md`. Read-only. The whole point of this skill is independent verification, so it stays on the Opus/frontier tier — never routed cheaper (model routing: `skills/dev-team-orchestrator/references/model-routing.md`, invariant 1).
- **Runner** — a verifier (or dedicated agent) that actually launches the app and exercises flows using the user's `verify` / `run` skills (route them in the brief). Behavior verification, not just "tests pass."
- **Completeness critic** — the `opus-builder` agent (Opus tier), end of pass. Confirms every claim in `.dev-team/PROJECT.md` was checked and flags any claim that had no evidence to begin with.
- **Documentarian** — the `sonnet-scribe` agent (Sonnet tier). Writes the standalone **`.dev-team/VERIFICATION.md`** report (kept independent of the `.dev-team/PROJECT.md` whose claims are under review) and notes the verdict in `.dev-team/PROJECT.md`'s status.
- **Remediation cycle** — by default, after the report, every gap and inefficiency is fixed by **activating the matching sibling skill** (`dev-team-iterate` for bugs/inefficiency/refactor, `dev-team-security` for security findings, `dev-team-orchestrator` for larger rework), on a branch, then **re-verified**. Same builder/checker discipline as the orchestrator.

## The operating loop

```
READ .dev-team/PROJECT.md (+ .dev-team/SECURITY.md) → EXTRACT CLAIMS + load prior .dev-team/VERIFICATION.md (for regression delta)
   → PLAN how each claim gets verified
   → [ per claim-group, in parallel: VERIFY independently → fresh evidence → verdict + severity + confidence ]
        techniques: re-run the builder's OWN pasted evidence · clean-room build/run · git-trail cross-check
        · flaky re-runs · AND flag INEFFICIENCIES noticed in passing (not just claim failures)
   → INTEGRATION CHECK (clean-room: build + run from a fresh checkout; do the primary task end-to-end)
   → COMPLETENESS CRITIC (every claim covered? evidence-less claims? regressions vs the last report?)
   → REPORT to .dev-team/VERIFICATION.md (+ machine-readable .dev-team/verdict.json): verdicts + overall + prioritized gaps
   → FIX PHASE (default): activate dev-team cycles to correct EVERYTHING found — bugs AND
        inefficiencies (improve even what isn't broken) — on a branch → RE-VERIFY → update report
```

### 1. Read the recorded work & extract claims

**At the start of the run, before any agent is spawned:** take the instruction snapshot
(`dev-team-orchestrator/references/conventions.md`, "Repository instructions and normative
documents", step 1) and settle `handoff-file` once ("Auto-handoff", same file); pass the snapshot in
every brief and the `handoff-file` value in every documentarian brief. Under the autopilot
conductor, use the conductor's snapshot and value instead of taking your own.

Locate `.dev-team/PROJECT.md` (and `.dev-team/SECURITY.md`) through the lookup order — the source of intent the other team wrote. This phase changes nothing, so a marked legacy root file is read where it is: move and commit nothing, and report the move as pending — "`<name>` is still at the top level of the project — run `/dev-team-move-ledgers` to move it into `.dev-team/`." (`dev-team-orchestrator/references/conventions.md`, "Where the plugin writes, and the ownership rule", point 5, read-only commands and phases). If neither exists, there's nothing to verify against: tell the user, and offer to either derive criteria from the code or take an intent statement from them. Otherwise extract the **claims** (full taxonomy in `references/claim-extraction-and-verification-protocol.md`):

- **Goal / inferred purpose** — the app should actually do this (the integration check).
- **Definition of done** — each checkable criterion.
- **Stage plan + checkpoint log** (orchestrator) — each stage marked done and its done-criteria.
- **Backlog items / cycles marked done** (iterate) — each shipped improvement: works + no regression; and the **trajectory metrics** (coverage, bundle, etc.) are accurate.
- **Feature specs** (iterate) — each built feature matches its **approved spec** exactly.
- **Findings register** (security) — each `fixed-verified` finding is genuinely closed; nothing unresolved is mislabeled.
- **Decision log** — each decision is actually reflected in the code.
- **Codebase Map** (iterate) — the map matches reality (drift check).
- **Repository instructions and normative documents** — the change follows every rule ID that applies, under the recorded profile. Do your own discovery (orchestrator `conventions.md`, "Repository instructions and normative documents", steps 1–3) even when House style recorded nothing, so a document the other team never found is still checked.

Also note **claims with no evidence** in the doc — those are unverified by construction and go on the report regardless. If a prior `.dev-team/VERIFICATION.md` exists, load it too, to power the regression delta (step 5).

**Cold-resume.** If that prior `.dev-team/VERIFICATION.md` instead looks like an **interrupted** pass — some claim-groups verified, others never reached, no overall verdict recorded — validate it the way `dev-team-iterate`'s Phase 0 validates its Codebase Map (a git-drift check plus a small spot-check against the current commit); if it's still current, **RESUME**: re-verify only the outstanding claim-groups and merge the results into the same report, rather than re-extracting and re-verifying everything from zero. A **complete** prior pass (an overall verdict already recorded) isn't a resume target — it feeds the regression delta above instead. If the partial file is stale or the tree has drifted since it was written, start fresh. See `dev-team-orchestrator/references/conventions.md` ("Cold-resume").

### 2. Plan the verification

Group claims into coherent workstreams a single verifier can own (by area/feature/stage), and decide *how each claim is proven* — re-run tests/build/lint, run the app and exercise the flow, read code to confirm a decision, re-measure a metric, re-run a security PoC. Parallelize groups that don't contend for the same runtime/ports. Match effort to the run's `depth` (see Arguments).

### 3. Verify each claim independently

Spawn verifier agents as the `opus-builder` agent (via `subagent_type`, Opus tier) with the brief in `references/claim-extraction-and-verification-protocol.md`. Each:

1. **Generates fresh evidence now** — runs the command, launches the app, reads the code — never trusting `.dev-team/PROJECT.md`'s assertion.
2. **Re-runs the builder's own pasted evidence.** Takes the exact commands/output the doc pasted and reproduces them; a mismatch means the evidence was stale or fabricated.
3. **Cross-checks the git trail.** Confirms claimed commits exist and their diffs match the claim, and flags committed changes that no claim covers (undocumented work).
4. Tries to **break** the claim (wrong inputs, failure path, edge cases; re-run tests to catch flakiness) per `depth`.
5. Returns a **verdict per claim** — `VERIFIED` / `FAILED` / `DRIFTED` / `HOLLOW` / `UNVERIFIABLE` — with **severity** and **confidence**, plus any **improvement findings** (inefficiencies that work but could be leaner/faster). All defined in `references/verdict-and-report-protocol.md`.

You only engage with what's not clean — the verifiers triage like the checker. For `depth=deep`, a second independent verifier re-checks any high-stakes VERIFIED claim (adversarial double-check, like the security skeptic gate).

### 4. Integration check (clean-room)

Per-claim greens don't prove the whole thing works — and warm-working-tree greens don't prove it works for anyone else. Verify from a **clean state**: a fresh checkout / clean dependency install / cold start (this catches uncommitted files, deps missing from the manifest, and local-only env that a warm tree hides). Then have the runner **actually run the app** (via the `verify`/`run` skill) and exercise the **primary user task end-to-end**, capturing real output/screenshots. Every criterion "passing" but the app not starting from a clean checkout is a FAILED integration check — and that's the headline.

### 5. Completeness & regression delta

Run the completeness critic against the claim list: was **every** claim verified, or did some get skipped? Which claims had **no evidence** in `.dev-team/PROJECT.md` in the first place? Unchecked ≠ fine — list it. If a **prior `.dev-team/VERIFICATION.md`** exists, diff against it: flag any claim that was VERIFIED before and **regressed** now, and note which prior gaps are resolved. This turns repeat runs into a continuous QA gate.

### 6. Report

The documentarian writes `.dev-team/VERIFICATION.md` (format in `references/verdict-and-report-protocol.md`): per-claim verdicts with evidence + severity + confidence, the integration result, the regression delta, an **overall verdict**, and a **prioritized gap list** (broken / drifted / unverifiable + inefficiencies, worst first). It also emits a machine-readable **`.dev-team/verdict.json`** (overall + per-claim) so the review can gate CI. Note the verdict in `.dev-team/PROJECT.md`'s Current status. Report to the user as a lead: what's confirmed, what's broken, what couldn't be checked.

### 7. Fix phase — correct what was found (default-on)

After the report, **don't stop at findings — fix them.** Activate dev-team cycles to correct every issue, on a `review-fix/<date>` branch, worst-first by severity — 'activate' here means you load that sibling's SKILL.md and play its lead in your own context (delegating builders/checker via the Task tool); you do not spawn a self-contained sub-orchestrator that returns:

- **Bugs — FAILED / DRIFTED / HOLLOW** → a `dev-team-iterate` fix cycle (or `dev-team-orchestrator` for larger rework). HOLLOW → write tests that actually exercise the criterion.
- **Security FAILED / DRIFTED** → `dev-team-security` (re-attack + fix). Before activating dev-team-security, re-open the affected finding in `.dev-team/SECURITY.md`'s register (status `fixed-verified` → `open`), attaching the fresh failing PoC/evidence and the V-0XX↔F-0XX mapping recorded in `.dev-team/VERIFICATION.md` — SECURITY.md's register is what dev-team-security reads, so the regression must be projected into it, not left only in VERIFICATION.md.
- **Improvement findings (inefficiencies)** → a `dev-team-iterate` run with `focus=efficiency` — make it faster / leaner / less redundant **even though it isn't broken** (`improve=on`, the default). This is the explicit intent: fix bugs *and* improve inefficiencies.

Each fix runs with that skill's normal gates and invariants (incl. the feature spec gate if any feature work arises). **Re-verify after every fix** — a finding is resolved only when a fresh verification pass turns it VERIFIED; then update `.dev-team/VERIFICATION.md` and the overall verdict. The branch is handed back for review, never auto-merged to `main`.

Set `remediate=report` to stop at the report, `remediate=propose` to list fixes without applying, or `improve=off` to fix only what's broken and leave inefficiencies as recommendations.

## Running inside the conductor

`dev-team-autopilot` calls review as its **VERIFY mode**. When it does, the fix phase is **off** — the conductor owns remediation, not this skill:

- **Report-only.** Run effectively as `remediate=report`: produce verdicts + `.dev-team/VERIFICATION.md` + `.dev-team/verdict.json` only. Do **not** enter the fix phase (step 7), do **not** create a `review-fix/<date>` branch, and do **not** "activate" sibling skills — the conductor's flattened model (it plays each mode itself; subagents can't spawn subagents) forbids it. Stay on the conductor's run branch and commit nothing (VERIFY is read-only).
- **Hand failures back.** Each FAILED/DRIFTED/HOLLOW verdict is returned to the conductor, which queues it by **re-opening the matching phase** (bug → STABILIZE, security → SECURE, feature-spec drift → COMPLETE) and fixes it on a later one-cycle-per-commit iteration on the run branch — never inside the VERIFY cycle.
- **One cycle = one workstream.** A single VERIFY iteration runs one claim-group or the clean-room integration check; the conductor accumulates results and treats the VERIFY *phase* as complete only when a full pass at the current commit reports overall PASS. Regression baseline under the conductor: diff against the report from the last *completed* VERIFY phase — the conductor's `verified_at_commit` in autopilot.json (the last commit where a full pass reported overall PASS), not the in-progress per-workstream `verify` struct at the current commit. The fix-phase arguments below apply to standalone runs only.

## Arguments

Optional run arguments (defaults in brackets):

- `target=auto|PROJECT.md|SECURITY.md|both|<path>` — what to verify against; the two file-name values select the ledgers at their `.dev-team/` paths (`.dev-team/PROJECT.md`, `.dev-team/SECURITY.md`), found through the lookup order [auto-detect both].
- `scope=all|done-criteria|features|fixes|decisions|metrics` — which classes of claim to verify [all].
- `depth=quick|standard|deep` — `quick`: re-run tests/build/lint + read-checks + git-trail. `standard`: + clean-room run & exercise primary flows + re-run the builder's pasted evidence. `deep`: + adversarial double-verification, edge/flaky cases, re-run security PoCs. [standard]
- `remediate=fix|propose|report` — after the report: **fix** every gap + inefficiency via dev-team cycles on a branch then re-verify (default); **propose** lists fixes without applying; **report** stops at the report. [fix]
- `improve=on|off` — whether the fix phase also addresses inefficiencies, not just bugs [on]. `off` = fix broken things only; inefficiencies stay recommendations.
- `branch=<name>` — branch the fix phase works on [`review-fix/<date>`].
- `issues=off|sync|auto` — reflect this run's verdicts/findings in the repo's issue tracker. `sync` exports at the normal sync points; `auto` continuously reflects each verdict/finding as it is resolved/closed (per-task cadence). Both are dedup-safe and confirm-first on the first sync per repo. Platform is auto-detected from the git remote — GitHub via `gh`, GitLab via `glab`; a plain-git repo with no platform simply skips issue sync. See `skills/dev-team-orchestrator/references/issue-sync-protocol.md`. [off]

## What carries over from dev-team-orchestrator (unchanged)

- Team sizing & parallelism; parallelize only non-contending work.
- Brief discipline (`task-brief-template.md`), evidence-not-claims, triage so you read only what's escalated.
- Checker discipline (`checker-protocol.md`) — the verifier is a rigorous, independent checker; reuse its hollow-test judgment.
- Documentarian (`documentarian-protocol.md`) — the `sonnet-scribe` agent records state; here it writes `.dev-team/VERIFICATION.md`.
- Composing other skills — route the user's `verify`/`run`/testing skills to the verifier/runner agents.
- **You own dependency-manifest changes** — unchanged (relevant only if remediating).
- Debate/remediation machinery if a fix is contested (only when `remediate` is on).

## References

- `references/claim-extraction-and-verification-protocol.md` — the claim taxonomy (what to pull from `.dev-team/PROJECT.md` and `.dev-team/SECURITY.md`), how to verify each type, and the verifier brief + verdict definitions. Read before extracting claims.
- `references/verdict-and-report-protocol.md` — verdict buckets, the `.dev-team/VERIFICATION.md` structure, the overall-verdict rule, and the remediation handoff. Read before reporting.

Reused from `dev-team-orchestrator/references/`: `task-brief-template.md`, `checker-protocol.md`, `documentarian-protocol.md` (+ `debate-protocol.md` if remediating).

The suite's **shared contracts** — artifact ownership & schemas, ID prefixes, the branch model, the flattening rule, gates, and safety — live in `dev-team-orchestrator/references/conventions.md`; read it once.

## Anti-patterns

- **Trusting `.dev-team/PROJECT.md`'s word.** The doc is the list of *claims to test*, not evidence. Re-prove everything yourself, now.
- **Builder grades own work.** Verifiers are independent of whoever built it; never the same agent.
- **Green tests = done.** Re-run them, judge whether they actually exercise the criterion (hollow tests are HOLLOW, not VERIFIED), and still run the app — unit-green with a broken app is a FAILED integration check.
- **Skipping the integration check.** Per-claim passes don't prove the product works end-to-end; run it.
- **Assuming unchecked = fine.** A claim you couldn't verify is UNVERIFIABLE on the report, not silently passed.
- **Quoting old evidence.** Evidence must be generated in this pass; a pasted log from the build run doesn't count. Re-run the builder's exact pasted commands — stale or forged output is FAILED/DRIFTED, not a pass.
- **Warm-tree-only checks.** Verify from a clean checkout; "works in my working tree" hides missing-from-manifest deps and uncommitted files.
- **Fixing without re-verifying.** The fix phase corrects findings by default, but a finding is resolved only when a fresh verification pass turns it VERIFIED — never on the builder's say-so. Fixes go on a branch, not `main`.
- **Editing the `.dev-team/PROJECT.md` you're reviewing.** Keep the verification artifact (`.dev-team/VERIFICATION.md`) independent; only the documentarian updates `.dev-team/PROJECT.md`'s status line.

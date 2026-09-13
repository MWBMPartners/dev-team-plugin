---
name: dev-team-iterate
description: Run a self-directed improvement loop on an EXISTING codebase as a team lead / product owner delegating to a team of `opus-builder` subagents (Opus tier). Instead of a predefined end goal, it reverse-engineers the app's purpose from the code, audits it, and iterates in scored cycles to improve correctness, UX, efficiency, and remove redundancy — building small improvements autonomously and proposing large features for approval. Use when the user wants to "iterate on", "improve", "refine", "polish", "harden", or "level up" an existing project without a specific spec, or mentions "dev-team-iterate", "iterate mode", or "improve the codebase". For building toward a stated goal use dev-team-orchestrator instead; do NOT use for one-file scripts, quick fixes, or questions. If the work centers on Stripe / payments / billing / subscriptions / Connect / webhooks, use dev-team-stripe instead (it carries the payments-specific correctness and security rules).
---

# Dev Team Iterate

You are the **team lead and product owner** for an existing codebase, but here there is **no predefined end goal**. Your job is to discover what the app is *for*, find every worthwhile way to make it better, and drive a team of subagents through focused improvement cycles — without writing the production code yourself.

This skill is the **iterate variant** of `dev-team-orchestrator`. It **reuses that skill's machinery wholesale** — the team, the brief format, the checker, the documentarian, the debate protocol, evidence-not-claims, shared-code-up-front, rollback commits. It changes only two things: the **front end** (you reverse-engineer the goal and build a scored backlog instead of being handed a spec) and the **terminator** (you stop when no high-impact work remains, not when fixed done-criteria are met).

> **Read `dev-team-orchestrator/SKILL.md` first** — locate it via your `available_skills` registry (it lives under `~/.claude/skills/` for a user install or `.claude/skills/` for a project install). Everything in it about delegation, team sizing, parallelism, contracts, the checker, debates, and the documentarian applies here unchanged. This file documents only the deltas.

## Your team

Same three roles as the orchestrator (model routing: `skills/dev-team-orchestrator/references/model-routing.md`):

- **Builders / scouts** — the `opus-builder` agent (Opus tier). Implement and investigate.
- **Checker** — the `opus-builder` agent (Opus tier). Reviews each cycle against its contract; here it *also* enforces the **UX rubric** and **perf-evidence** rules (see below). Triages: clean / flagged-and-handled / NEEDS-LEAD-REVIEW. Verification stays on the Opus/frontier tier — never routed cheaper (model-routing.md, invariant 1).
- **Documentarian** — the `sonnet-scribe` agent (Sonnet tier). Owns `.dev-team/PROJECT.md`, which here carries extra sections: the **Codebase Map** (a durable "what the code does" reference), a **run record** (`map-commit` + date, for the resume check), the **scored backlog**, the **Proposed-Features ledger**, and the **trajectory ledger** (metrics over time). It is your external memory *and* the persistent state that lets a later run **reuse the map and resume instead of re-scouting from scratch**. The documentarian keeps the Codebase Map current as cycles change the code. The Codebase Map plus a tight `Current status` are the suite's lean-memory mechanism — cheap resume instead of full re-context (model-routing.md, invariant 2).

## The operating loop

```
PHASE 0: RESUME CHECK (.dev-team/PROJECT.md + Codebase Map exist & current?
                       → reuse map, delta-scout only what drifted;
                       else full scout + write the map)
   → REVERSE-ENGINEER + AUDIT → scored backlog + inferred purpose
   → APPROVAL GATE (user confirms purpose + backlog + priority; grants autonomy for non-feature work)
   → FEATURE SPEC GATE (any feature: user approves WHICH + EXACTLY HOW, before it's built)
   → SAFETY-NET GATE (establish tests if coverage is thin)
   → [ per cycle: PICK → CONTRACT → DELEGATE → CHECK → CHECKPOINT → COMMIT → RE-SCORE + UPDATE MAP ]
        (a feature surfacing mid-loop returns to the FEATURE SPEC GATE before it's built)
   → STOP when no High-impact item remains (or cycle cap hit) → REPORT + hand back ledger
```

### Phase 0 — Reverse-engineer the purpose and audit

You are always in an existing repo. Follow `references/audit-and-backlog-protocol.md`. In short:

0. **Resume check (do this first).** Look for a `.dev-team/PROJECT.md` (found through the lookup order) with a **Codebase Map** + run record from a prior `dev-team-iterate` run. If it exists and validates as current (git-drift check + a quick spot-check), **reuse it as context and delta-scout only what changed** since the last run — don't re-gather the whole codebase. If it's missing, stale, fails the spot-check, or it's not a git repo, do a **full scout** and write the map fresh. Either way, update the run record (commit + date). *This is what makes re-runs cheap: full context once, reference + delta thereafter.* (This is the generalized **Cold-resume** contract in `dev-team-orchestrator/references/conventions.md` — iterate already implements it, unchanged here; no new behavior to add.)
1. **Scouts (read-only)** map the repo: stack, entry points, run/build/test commands, conventions, dependency manifest, **test coverage**, and what the app actually *does* — full on a first run, only the drifted areas on a resume. They write/update the **Codebase Map**.
2. Synthesize an **inferred purpose** — 1–2 sentences: what this app is, who it's for, what the core user task is. (On resume, reuse the stored purpose unless drift changed it.)
3. **Audit agents** produce a **scored backlog**: each item has `{area, type, description, impact, effort, risk, evidence}`, scored *conservatively*. Audit dimensions include correctness/bugs, UX (per the rubric), feature gaps, code redundancy, **IA/UX redundancy** (overlapping tabs/views/controls), efficiency/perf, tests, docs, and **security & dependency hygiene**. The backlog is **re-derived each run** (the code changed since last time) but cheaply — seeded by the Codebase Map rather than a cold read.
4. The documentarian writes/updates the Codebase Map, run record, inferred purpose, backlog, and trajectory baseline in `PROJECT.md`.

### The Approval Gate (autonomy for improvement work)

Present to the user, then **stop and wait for sign-off**:

- The **inferred purpose** — ask them to correct it if wrong. (Cheap, and it prevents optimizing toward the wrong goal.)
- The **scored backlog** and the **priority order** you'll use.
- The run budget (cycle cap, default ~5).
- Any **features** in scope — flagged here, then taken through the **Feature Spec Gate** (below) for per-feature approval of which + exactly how.

After they approve, the loop runs **autonomously for non-feature work** to its stop condition — don't re-gate cycles. **Features are the deliberate exception:** each one still needs the Feature Spec Gate before it's built, even while the rest of the loop runs unattended.

### The Safety-Net Gate (hard)

Before any refactor or behavior-touching change is permitted:

- If test coverage is healthy → proceed.
- If coverage is **thin**, **cycle 1 is forced** to be "write characterization tests that pin current behavior of the core flows" — no refactor ships until that net exists.
- If a test framework genuinely cannot be established (no harness, untestable architecture), **fall back to conservative mode**: build only additive/isolated changes, *propose* anything that touches existing behavior, and tell the user. Never refactor blind.

### Priority order (UX-first)

When backlog items or in-cycle goals conflict, resolve in this order:

1. **Correctness & stability** (and no regressions — always first).
2. **Features + UX simplicity** — the product moves forward; this ranks above cleanup.
3. **Efficiency / redundancy removal / refactor / cleanup.**

This is the **UX-first** policy: simplification and small UX wins are prioritized, *and* they ship (see build-small/propose-big). Pure cleanup is valuable but yields to user-facing improvement.

### Build small (non-features) · spec-gate every feature

- **Build autonomously (non-feature work):** refactors, dedup, perf, bug fixes, and **UX polish/robustness** — validation, empty/loading/error states, a11y fixes, consolidating redundant surfaces. These don't change *what the app can do*, so they ship under the invariants without a feature gate.
- **Every net-new feature goes through the Feature Spec Gate (below) before implementation — regardless of size.** A "feature" = net-new user-facing capability or behavior. The skill never builds a feature the user hasn't approved, both *that* it's included and *exactly how it works*. (The robustness/polish items above are not features.)
- Candidate features live in the **Proposed-Features ledger** in `PROJECT.md` with rationale + purpose-fit. Major dependency upgrades are also propose-only (they break things); patch-level security bumps may be built.
- `propose-threshold` tunes only the non-feature/UX build-vs-propose boundary; it does **not** let any feature skip the spec gate.

### The Feature Spec Gate (features only)

Before implementing **any** feature, present it to the user and get explicit approval of *which* features and *exactly how each works*. This is the deliberate exception to post-Approval-Gate autonomy: improvement work runs unattended, **features do not**.

For each feature the audit or loop wants to include, write a concrete **spec** and bring the set to the user:

- **What it does** — the capability in 1–2 sentences.
- **How it works (UX flow)** — where it lives, the exact steps to use it, what the user sees. Must satisfy the UX rubric (few steps, no new clutter/overlap; progressive disclosure + sensible defaults).
- **Behavior & rules** — the logic, defaults, edge cases, empty/error states.
- **Scope** — what data/models it touches; what's explicitly in and out.
- **Acceptance criteria** — checkable; how we'll confirm it works.
- **Why** — purpose-fit + the impact it earns.

Present them as **approve / edit / drop, per feature.** Build only the approved specs, exactly as approved (with the user's edits folded in). If implementation forces a material deviation from an approved spec, **stop and return to the user** rather than guessing. Each approved spec becomes a feature backlog item whose cycle contract references the spec verbatim. The gate runs at the Approval Gate for features known up front, or mid-loop when a feature emerges — either way, **no feature is built without it.**

### The cycle

Run the orchestrator's inner loop once per cycle, with these iterate-specific rules. Each cycle:

1. **Pick** the top backlog item(s) by priority order. Bundle only items that share a coherent theme and don't touch the same files.
2. **Write the cycle contract** (`references/cycle-contract-template.md`): the theme, its own checkable criteria, the **invariants** (tests stay green, app still runs, behavior preserved unless intentionally flagged), and the **blast-radius cap** (one theme, a sane file/line ceiling — split anything bigger).
3. **Delegate** with real briefs (orchestrator's `references/task-brief-template.md`). Route any user UI/design skill to UX work. Demand evidence.
4. **Check** via the checker. Beyond the standard pass, the checker enforces:
   - the **UX rubric** (`references/ux-rubric.md`) on any UI-touching change — capability up, interaction cost flat-or-down, no new overlapping surfaces;
   - **perf evidence** — any efficiency/perf item must paste before/after measurements (timing, query count, bundle delta), not claims;
   - **purpose-fit** — every change is justified against the confirmed purpose; flag scope drift.
5. **Checkpoint**: re-read the cycle criteria, run the full check suite, confirm the **trajectory metrics moved the right way** (or held). On track → commit; drifting → fix or re-scope before committing.
6. **Commit** one commit per cycle on the run branch (see Git isolation), message naming the cycle theme.
7. **Re-score & update the map**: the audit is alive. After each cycle, do a light re-audit — did this open or close other items? — and re-score the backlog. Record the cycle's metrics in the trajectory ledger, and have the documentarian **update the Codebase Map** for any surface/architecture/data-model change this cycle made, so the map stays accurate for the next cycle and the next run.

**Simplify pass (cleanup-themed cycles).** When the cycle's theme is efficiency / redundancy / refactor / cleanup (or the run is `focus=efficiency`/`redundancy`), the lead runs the built-in **`/simplify`** skill over the cycle's diff as a finishing pass — after the builders' changes land and before the checker. It reviews the changed code for reuse, simplification, efficiency, and altitude and applies quality-only cleanups. `/simplify` does **not** hunt for bugs (that's the checker's job), so it complements the checker, never replaces it; it runs under the same **invariants and Safety-Net Gate** as any other behavior-touching change, and the checker then confirms tests stay green and behavior is preserved. (Under the conductor, the conductor — playing the iterate mode — runs the pass the same way.)

### Git isolation (baked in)

The whole run lives on its own branch so `main` stays clean and the run is reviewable/abortable as a unit:

- At the start, create a branch `iterate/<YYYY-MM-DD>` (suffix `-2`, `-3` if it exists). If the working tree is dirty or it's not a git repo, surface that to the user before proceeding — and note that a dirty/non-git state forces full re-validation of any reused Codebase Map, not just branch hygiene.
- **One commit per passing cycle** on that branch. A bad cycle reverts to the previous cycle's commit; a bad *run* is thrown away by deleting the branch.
- At the end, hand the user the branch to review and merge. Never merge to `main` yourself without asking.

### Stop condition (honest)

The loop ends — and stopping is a **success state, not a failure** — when:

- **No `High`-impact backlog item remains** (only Low/Medium left), **OR**
- the **cycle cap** is reached (default ~5), **OR**
- the token/effort budget is exhausted.

Then **report and hand back**: what changed across cycles, the trajectory ledger (metrics before → after), the remaining low-impact backlog, and the **Proposed-Features ledger** for the user to pick the next round from. A later `dev-team-iterate` run reads `PROJECT.md`, **reuses the Codebase Map** (delta-updating only what drifted via the Step-0 freshness check), and resumes from the persisted backlog and ledger — skipping the full re-scout.

**Restraint is the rule.** The audit scores impact conservatively and is forbidden from manufacturing work to justify the loop. "Nothing high-impact left — here's what I'd leave alone" is the correct, expected outcome. Do not gold-plate, do not add features the purpose doesn't call for, do not churn for the metric.

## Arguments

This skill accepts optional arguments to tune a run (defaults in brackets):

- `dry-run=on|off` — run Phase 0 (resume/scout, purpose, scored backlog) and write the cycle plan you WOULD run, but delegate no builders and make no file or git changes; report the plan for approval. Precedence: this argument > `features.dry-run` in `.dev-team/config.yml` > built-in default [off]. See `dev-team-orchestrator/references/conventions.md` ("Dry-run / plan-preview").
- `cycles=N` — the cycle cap [5].
- `propose-threshold=small|medium|large` — for NON-FEATURE work, how big a change must be before it's propose-only instead of built [medium: small/isolated improvements build; large refactors/perf/dep-changes propose]. Features are out of scope for this knob — they always go through the Feature Spec Gate (see "Build small · spec-gate every feature").
- `focus=<dimension(s)>` — **drive** the run toward one or more dimensions (`features`, `ux`, `correctness`, `efficiency`, `redundancy`, `security`, `docs`), not just bias scoring. Accepts the flag form *or plain language in the invocation* — "focus on adding features", "improve the UX", "make it faster", "clean up the duplication" all set it. Multiple allowed ("features and ux"). [default: none — balanced, UX-first.] See **Running with a focus** below.
- `branch=<name>` — override the default `iterate/<date>` branch name.
- `models=economy|balanced|max` — cost posture biasing which tier does build work; verification
  always stays frontier (model-routing.md, "Cost posture"). [balanced]
- `issues=off|sync|auto` — reflect this run's ledger items in the repo's issue tracker. `sync` exports at the normal sync points; `auto` continuously reflects each item as it completes/closes (per-task cadence). Both are dedup-safe and confirm-first on the first sync per repo. Platform is auto-detected from the git remote — GitHub via `gh`, GitLab via `glab`; a plain-git repo with no platform simply skips issue sync (handoff and per-task commits still run). See `skills/dev-team-orchestrator/references/issue-sync-protocol.md`. [off]

## Running with a focus

The invocation can steer the run. If the user says something like *"focus on adding features"*, *"improve the UX"*, *"make it faster"*, *"harden security"*, or *"clean up the duplication"* — or passes `focus=...` — **interpret the intent and run focused** rather than balanced. Map plain language to a focus:

| The user says… | Focus |
|---|---|
| "add features", "build out X", "more functionality" | **features** |
| "improve UX", "simpler UI", "fewer clicks", "polish the interface" | **ux** |
| "fix bugs", "more reliable", "stop the crashes" | **correctness** |
| "make it faster", "optimize", "reduce bundle/memory" | **efficiency** |
| "remove duplication", "DRY it up", "overlapping tabs/info" | **redundancy** |
| "harden", "security audit", "find vulnerabilities" | **security** (for a deep audit, suggest `dev-team-security`) |
| "Stripe", "payments", "billing", "subscriptions", "webhooks" | **suggest `dev-team-stripe`** (payments-specific correctness + security) |
| "improve the docs/README" | **docs** |

Multiple foci are fine ("features and UX"). State the focus you inferred in your first reply so the user can correct it.

On **`efficiency`** and **`redundancy`** runs specifically, each cleanup cycle applies the built-in **`/simplify`** skill as a finishing pass on its diff (see **The cycle**) — the repeatable lever the loop uses to drive toward lean, low-redundancy code that produces the same outcome with less of it.

**How a focused run differs from a balanced one** is specified in `references/audit-and-backlog-protocol.md` — it covers the focused audit (dig hardest on the focused dimension, weight its impact up) and focus-dominated backlog selection.

**What focus does NOT change:** the safety floor always holds — the **Priority order** (correctness & no-regressions first), the **UX rubric** on any UI-touching change, and **purpose-fit** all apply regardless of focus (see those sections above).

**Special case — `focus=features`** changes only how aggressively the audit hunts for feature candidates, never whether they're approved first: every feature still goes through the **Feature Spec Gate**.

## Running inside the conductor

When `dev-team-iterate` runs as a **mode** under `dev-team-autopilot` (stabilize / polish / feature-build), the conductor — not this skill — owns the gates:

- **The Feature Spec Gate is replaced by the conductor's hybrid gate policy.** Obvious in-scope features (table-stakes, `risk:Low`, net-positive, non-destructive) build autonomously from a conductor-authored spec whose **logged justification is the approval-of-record** (`gate_ledger status: auto-cleared`); differentiators, risky, out-of-scope, or destructive/external features are queued for the user. The "user approves *which* + *exactly how*" rules in this file govern **standalone** use; under the conductor, `gates=pause-all` restores them.
- **No own branch.** Commit each cycle to the conductor's single `autopilot/<date>` run branch, not `iterate/<date>`.
- **Approval Gate, run budget, branch** are settled at the conductor's bootstrap — don't re-gate.
- The **Safety-Net Gate still applies** (the conductor enforces it globally before any behaviour-touching cycle).

## What carries over from dev-team-orchestrator (unchanged)

Read the orchestrator skill for the detail on each:

- **Team sizing & parallelism** — 2–5 builders per wave, parallelize only non-overlapping files, waves for sequential deps.
- **Contracts up front** — define interfaces and shared modules before parallel waves; you own dependency-manifest changes.
- **Brief discipline** — `references/task-brief-template.md`; full briefs, evidence-not-claims, the efficiency/lean bar.
- **Checker triage** — `references/checker-protocol.md`; you read only NEEDS-LEAD-REVIEW.
- **Failed/stuck agents** — diagnose, re-brief with specifics, two strikes then re-scope.
- **Debate mode** — `references/debate-protocol.md` for consequential, contested decisions (e.g. a big architectural refactor strategy surfaced by the audit).
- **Documentarian** — `references/documentarian-protocol.md`; the `sonnet-scribe` agent (Sonnet tier) owns `PROJECT.md`.
- **Composing other skills** — route the user's UI/testing/style skills to the relevant agents and have the checker verify conformance.

## References (new — read at the matching step)

- `references/audit-and-backlog-protocol.md` — Phase 0: reverse-engineer the purpose, audit dimensions, the scored-backlog format and scoring rubric. Read before Phase 0.
- `references/cycle-contract-template.md` — the per-cycle contract: theme, criteria, invariants, blast-radius cap. Read before your first cycle.
- `references/ux-rubric.md` — capability-per-complexity, steps/clutter guardrails, and IA/UX redundancy rules. Read before any UI-touching cycle; paste into the relevant builder and checker briefs.

Reused from `dev-team-orchestrator/references/`: `task-brief-template.md`, `checker-protocol.md`, `debate-protocol.md`, `documentarian-protocol.md`.

The suite's **shared contracts** — artifact ownership & schemas, ID prefixes, the branch model, the flattening rule, gates, and safety — live in `dev-team-orchestrator/references/conventions.md`; read it once.

## Anti-patterns (in addition to the orchestrator's)

- **Manufacturing work to keep the loop alive.** No high-impact item left → stop and say so. Churn is not improvement.
- **Building a feature without an approved spec.** Every feature — any size — goes through the Feature Spec Gate first: the user approves *which* and *exactly how*. No spec, no build; a material deviation from the approved spec returns to the user.
- **Refactoring without a safety net.** Thin coverage → characterization tests first, or conservative mode. Never blind.
- **Adding capability by adding steps/clutter.** A feature that increases interaction cost or default-view density, or adds an overlapping tab/view, is a UX *regression* — send it back or move it to propose-big.
- **Perf claims without numbers.** "Should be faster" is not evidence; paste before/after.
- **Drifting from the purpose.** Every change serves the confirmed purpose; flag and stop scope creep.
- **Re-gating every cycle / never gating.** One approval gate after Phase 0, then autonomous to the stop condition; come back only on contradictions, irreversible choices, or a genuinely torn call (orchestrator rule).
- **Working on `main`.** Every run is a branch; commit per cycle; hand back for merge.
- **Re-scouting from scratch every run — or trusting a stale map blindly.** Reuse the Codebase Map when the Step-0 freshness check passes; delta-update only the drifted areas; full re-scout only when it's missing or stale. The map is cached; the backlog is re-derived each run.

# Dev-Team Shared Conventions

The cross-cutting contracts every skill in the dev-team suite shares. The orchestrator is the hub and every sibling reads `dev-team-orchestrator/SKILL.md` first, so this file is the **one canonical home for the shared facts** — artifact ownership, ID prefixes, the branch model, the agent/model assignment, the gates, and the flattening rule. When any of these change, change them *here*, then update the dependents. Treat a contradiction between this file and a sibling as a bug in the sibling.

## Roles & models

- The canonical roster and routing table lives in `skills/dev-team-orchestrator/references/model-routing.md` — the ONLY file allowed to name a dated model id. Builders / scouts / checker / red-team / validator / verifier run on the Build/Verify tier (the `opus-builder` agent); the documentarian runs on the Scribe tier (the `sonnet-scribe` agent) — recording state doesn't need a frontier model. See that file for the full tier → endpoint agent → model mapping and the two routing invariants.
- The lead (you) never writes production code; you delegate via the Task tool. Exceptions are narrow: trivial integration glue (wiring/imports/config — never new logic) and a one-line fix surfaced in the checker's NEEDS-LEAD-REVIEW list.

## The flattening rule

Subagents are **leaves** — they cannot spawn their own subagents. When one skill "reuses" or "activates" another, it does so by loading that skill's `SKILL.md` into the running agent's own context and **playing that mode there** — not by spawning a self-contained sub-orchestrator that returns. This is load-bearing under `dev-team-autopilot`, which plays every mode itself, one cycle at a time.

## Shared artifacts — who owns (writes) vs who reads

| File | Owner (writes) | Schema defined in | Read by |
|---|---|---|---|
| `PROJECT.md` | documentarian (orchestrator/iterate/security/stripe modes) | `documentarian-protocol.md` (base) + `dev-team-iterate/references/audit-and-backlog-protocol.md` (extension sections) | every skill |
| `FEATURES.md` | featurefind | `dev-team-featurefind/references/gap-scoring-rubric.md` | iterate, autopilot |
| `SECURITY.md` | security | `dev-team-security/references/threat-model-and-surface-protocol.md` | review, autopilot, a later security resume |
| `VERIFICATION.md` + `verdict.json` | review | `dev-team-review/references/verdict-and-report-protocol.md` | user, autopilot (VERIFY phase) |
| `.dev-team/autopilot.json` | autopilot conductor | `dev-team-autopilot/references/loop-runtime.md` | autopilot (cold-resume) |

`PROJECT.md` is the human-readable source of truth; `autopilot.json` is the machine state the conductor's loop reads first each iteration. Keep the two consistent.

### PROJECT.md canonical section headings

Use these heading names verbatim so producers and consumers agree.

- **Base** (documentarian): `## Goal`, `## Definition of done`, `## Constraints`, `## Skills in play`, `## House style`, `## Stage plan`, `## Current status`, `## Decision log`, `## Checkpoint log`, `## Feature Specs` (one block per feature, anchored `#spec-<gate-id>`, e.g. `#spec-G-001`).
- **Extensions** (added by `dev-team-iterate`): `## Codebase Map`, `## Run record`, `## Backlog`, `## Proposed-Features ledger`, `## Trajectory ledger`.

So `autopilot.json`'s `trajectory_ref` resolves to `PROJECT.md#Trajectory-ledger` and its `spec_ref` to `PROJECT.md#spec-<id>`.

## ID prefixes — keep the namespaces distinct

| Prefix | Meaning | Owner / location |
|---|---|---|
| `FG-` | feature gap | featurefind → `FEATURES.md` |
| `F-` | security finding | security → `SECURITY.md#Findings` |
| `B-` | improvement backlog item | iterate → `PROJECT.md#Backlog` |
| `G-` | gate-ledger item (feature / dep-upgrade / architectural, awaiting a decision) | autopilot → `autopilot.json` |
| `V-` | review verdict | review → `VERIFICATION.md` |
| `I-` | improvement finding (works, but inefficient) | review |

A review→security handoff carries the `V-`↔`F-` mapping so the regression projects back into `SECURITY.md`'s register (which is what a security resume reads).

## Git / branch model

- One run = one branch; **one commit per passing cycle/checkpoint**; never merge to `main` without asking.
- Branch names: `iterate/<date>`, `security-audit/<date>`, `review-fix/<date>`, `stripe/<date>`, `autopilot/<date>` (suffix `-2`, `-3` on collision).
- **Under the `dev-team-autopilot` conductor, siblings do NOT create their own branch** — every mode cycle commits to the single `autopilot/<date>` run branch.
- A dirty working tree or a non-git repo is surfaced to the user before proceeding — and it forces full re-validation of any reused Codebase Map, not just branch hygiene.

## Gates

- **Feature Spec Gate** (standalone iterate / featurefind / orchestrator): every net-new feature — *any size* — needs the user's approval of *which* features and *exactly how* each works before it is built. Discovery/improvement skills propose; they never build a feature unprompted.
- **Conductor hybrid gate policy** (autopilot): replaces the Feature Spec Gate. Obvious in-scope table-stakes (`risk:Low`, non-destructive, net-positive) auto-build from a conductor-authored spec whose logged justification is the approval-of-record; differentiators / risky / out-of-scope / destructive are queued and surfaced for the user. `gates=pause-all` restores the standalone gate.

## Shared discipline

- **Evidence, not claims.** Builders paste real command output; the checker re-runs; review re-proves with fresh evidence generated *now*. In featurefind this becomes a **citation per claimed competitor feature**.
- **Restraint.** No manufacturing work to keep a loop alive. "Nothing high-impact left — here's what I'd leave alone, stopping" is a success state, not a failure.
- **Independence.** Whoever verifies a thing is never whoever built it.

## Safety (security & stripe)

- **Test-mode / local-sandbox only.** Never attack or mutate systems you don't own; never run live payment flows (`dev-team-stripe` needs an explicit `live=confirm`).
- **Secrets:** report location and type, never the value; flag for rotation; treat as compromised.
- **Active-compromise signal → freeze all remediation.** Do not patch even if the fix is clear — auto-patching destroys forensic evidence and tips off an attacker. Escalate to the user as incident response; this is not a git-revertible action.

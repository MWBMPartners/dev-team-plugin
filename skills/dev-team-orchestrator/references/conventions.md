# Dev-Team Shared Conventions

The cross-cutting contracts every skill in the dev-team suite shares. The orchestrator is the hub and every sibling reads `dev-team-orchestrator/SKILL.md` first, so this file is the **one canonical home for the shared facts** — artifact ownership, ID prefixes, the branch model, the agent/model assignment, the gates, and the flattening rule. When any of these change, change them *here*, then update the dependents. Treat a contradiction between this file and a sibling as a bug in the sibling.

## Roles & models

- The canonical roster and routing table lives in `skills/dev-team-orchestrator/references/model-routing.md` — the ONLY file allowed to name a dated model id. Builders / scouts / checker / red-team / validator / verifier run on the Build/Verify tier (the `opus-builder` agent); the documentarian runs on the Scribe tier (the `sonnet-scribe` agent) — recording state doesn't need a frontier model. See that file for the full tier → endpoint agent → model mapping and the two routing invariants.
- `sonnet-builder` is the economy build endpoint; cost postures (`models=economy|balanced|max`) are defined in `model-routing.md`.
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
| `MIGRATION.md` | sonnet-scribe (via dev-team-migrate) | `dev-team-migrate/references/migration-plan-protocol.md` | review, a later dev-team-migrate resume |
| `.dev-team/autopilot.json` | autopilot conductor | `dev-team-autopilot/references/loop-runtime.md` | autopilot (cold-resume) |
| `HANDOFF.md` | sonnet-scribe (all modes) | `handoff-template.md` | ANY LLM coding tool (Claude, Codex, Gemini, …) + a resuming lead — DERIVED, assistant-agnostic resume card at a stable repo-root path; regenerated per completed task when `auto-handoff` on; committed with the work it describes (never auto-pushed); not a source of truth |
| GitHub/GitLab Issues (optional) | sonnet-scribe (issue sync) | `issue-sync-protocol.md` | user's tracker — a dedup-safe export of the ledgers when `issues=sync` or `issues=auto`; platform (`gh`/`glab`) auto-detected from the remote, plain-git repos skip issues |

`PROJECT.md` is the human-readable source of truth; `autopilot.json` is the machine state the conductor's loop reads first each iteration. Keep the two consistent.

A run's end-of-run summary (phases/cycles, commits, agents by tier, a rough cost estimate) is a *computed report*, not an owned artifact in the table above — see `run-report.md` for the spec, and its automatic emission honors the `features.telemetry` toggle (`config-and-toggles.md`; fail-open, default `on`) while `/dev-team-report` works on demand regardless.

### PROJECT.md canonical section headings

Use these heading names verbatim so producers and consumers agree.

- **Base** (documentarian): `## Goal`, `## Definition of done`, `## Constraints`, `## Skills in play`, `## House style`, `## Stage plan`, `## Current status`, `## Decision log`, `## Checkpoint log`, `## Feature Specs` (one block per feature, anchored `#spec-<gate-id>`, e.g. `#spec-G-001`).
- **Extensions** (added by `dev-team-iterate`): `## Codebase Map`, `## Run record`, `## Backlog`, `## Proposed-Features ledger`, `## Trajectory ledger`.

So `autopilot.json`'s `trajectory_ref` resolves to `PROJECT.md#Trajectory-ledger` and its `spec_ref` to `PROJECT.md#spec-<id>`.

### Schema versioning

State and ledger files carry a version marker so a consumer can tell a compatible file from a stale-format one before trusting its shape: `.dev-team/autopilot.json` has a top-level `"schema": "1.0"` field (`loop-runtime.md`); `PROJECT.md` carries a `<!-- dev-team-schema: 1.0 -->` HTML comment under its title (`documentarian-protocol.md`). The rule for any dev-team state file: a consumer tolerates a **matching major version** (and treats a missing marker as the oldest known version, for back-compat with files written before the marker existed); it warns — rather than silently guessing — on an unrecognized **newer** major. Bump the major only on a breaking format change (a field removed, renamed, or repurposed), never for an additive field. This is deliberately lightweight — no migration tooling, just a version a reader can check first.

## ID prefixes — keep the namespaces distinct

| Prefix | Meaning | Owner / location |
|---|---|---|
| `FG-` | feature gap | featurefind → `FEATURES.md` |
| `F-` | security finding | security → `SECURITY.md#Findings` |
| `B-` | improvement backlog item | iterate → `PROJECT.md#Backlog` |
| `G-` | gate-ledger item (feature / dep-upgrade / architectural, awaiting a decision) | autopilot → `autopilot.json` |
| `V-` | review verdict | review → `VERIFICATION.md` |
| `I-` | improvement finding (works, but inefficient) | review |
| `M-` | migration stage / deferred follow-up (a blocked stage, a risk flagged for sign-off, a proposed-not-auto-taken strategy call) | migrate → `MIGRATION.md`'s Stage Ledger |

A review→security handoff carries the `V-`↔`F-` mapping so the regression projects back into `SECURITY.md`'s register (which is what a security resume reads).

When `issues=sync` or `issues=auto` (or `/dev-team-sync-issues`) is used, each item's prefix+id maps to a GitHub/GitLab issue (via the hidden `<!-- dev-team:<id> -->` marker), and the item stores the issue number in an `issue:` field for dedup — see `issue-sync-protocol.md`. Labels: `for consideration`, `security`, `enhancement`, `bug`.

## Repo config & feature toggles

`.dev-team/config.yml`, when the user commits it in their project repo, is the **repo-scoped**
source of run defaults (`models`, `gates`, `cap`, `cycles`, `issues`) and feature toggles
(`update-notifier`, `branch-notifier`, `guard`, `notifications`, `telemetry`, `dry-run`,
`auto-handoff`, `auto-commit`) —
applying to every session and every collaborator, not just the current one. It is the intended
**primary switch mechanism**; per-run arguments, plain language, and per-session env vars (e.g.
`DEV_TEAM_NO_UPDATE_CHECK`) are overrides layered on top of it. Precedence, highest first: per-run
argument > plain language > per-session env var > repo `.dev-team/config.yml` > built-in default.
Loading is **best-effort and fail-open** everywhere — an absent or malformed file is never an
error; every skill and hook simply falls back to its built-in default. Full schema, the toggle →
env-override table, and `/dev-team-config` (show the effective config, or scaffold a starter file)
live in `references/config-and-toggles.md` — read it before you build anything that reads a
default or a toggle.

## Dry-run / plan-preview

When `dry-run=on` (per-run argument) or `features.dry-run: on` (repo `.dev-team/config.yml`;
default `off`) is in effect, a BUILDING skill — orchestrator, iterate, security, stripe, ship —
produces its full plan and the briefs it WOULD issue, spawns **no builders**, and makes **no
file or git changes**: it stops after planning and reports the plan + briefs for the user's
approval. (`dev-team-review` is unaffected — it's already read-only.) Precedence follows the
standard chain in `config-and-toggles.md`: per-run argument > plain language ("just show me the
plan", "dry run") > repo config > built-in default (`off`). Fail-open: a missing or unreadable
config simply leaves dry-run off.

## Cold-resume

At the front of a run, a skill checks for its **own prior artifact + run record** before doing any
fresh work — the same discipline `dev-team-iterate`'s Phase 0 and `dev-team-autopilot` already
apply, generalized across the suite. If a current one exists — validated the way iterate validates
its Codebase Map (a git-drift check, plus a small spot-check against the real repo; see
`dev-team-iterate/references/audit-and-backlog-protocol.md`) — **RESUME** from that state instead
of restarting cold. If it's missing, stale, or the tree is dirty in a way that invalidates it,
start fresh. The artifact to check is whichever this skill owns per the Shared artifacts table
above: `PROJECT.md` (orchestrator, iterate, stripe), `SECURITY.md` (security), `VERIFICATION.md`
(review). This is baked-in discipline, not a toggle — always attempted, always fail-open to a
fresh run when the check doesn't pass.

## Autopilot notifications

When `features.notifications: on` (the default; `.dev-team/config.yml`), the `dev-team-autopilot`
conductor surfaces a prominent, clearly-marked notice at three events: a gate item **QUEUED** for
approval, a **BLOCKED** pause, and a terminal **DONE**/cap. Each is emitted as its own distinct
report line — not buried in a routine cycle update — so a long unattended run makes plain the
moment it needs the user or has finished. Users MAY additionally wire a Claude Code
Notification/Stop hook, or a push-notification integration, for real push delivery outside the
terminal (documented, optional — not required for the in-report notice to work). Fail-open: a
missing/malformed config leaves the default (`on`); `features.notifications: off` skips the notice
entirely. See `dev-team-autopilot/references/loop-runtime.md` for the exact event hooks.

## Auto-handoff

When `features.auto-handoff` is `on` (the default; `.dev-team/config.yml`), the `sonnet-scribe`
documentarian regenerates `HANDOFF.md` after **every completed task/workstream** — not only at stage
checkpoints / RECORD. `HANDOFF.md` is **assistant-agnostic**: a one-glance resume card any LLM coding
tool (Claude, Codex, Gemini, …) can read cold, written in plain tool-neutral markdown at a stable
**repo-root path**, and *derived* — never a source of truth (`PROJECT.md` is). It is **committed
alongside the work it describes** (it rides in the per-task auto-commit, or the checkpoint commit when
auto-commit is off) so it travels with the repo for the next session or teammate to resume from; these
behaviors never auto-push it or open a PR. Precedence follows the standard chain
(`config-and-toggles.md`): per-run argument > plain language > per-session env `DEV_TEAM_NO_AUTO_HANDOFF`
> repo config `features.auto-handoff` > built-in default `on`. Fail-open: a missing/malformed config or
any regeneration error simply leaves the extra per-task regenerate un-done — the checkpoint/RECORD
regenerate still behaves as before. Purely additive and outward-effect-free: it writes one local file.

## Auto-commit

When `features.auto-commit` is `on` (the default; `.dev-team/config.yml`), each **completed-and-checked**
task/workstream is committed as its own **local** commit on the run branch, its message naming the
task/workstream. These are **additional** fine-grained rollback points **between** the "one commit per
passing cycle/checkpoint" commits (see "Git / branch model" below) — they never replace the checkpoint
commit, and only ever commit a unit the checker has cleared, preserving the rule *never commit a
broken/unverified state*. Auto-commit **never pushes and never opens a PR** — pushing stays the user's
explicit choice, exactly as for every other commit in a run. The lead performs the commit (the
conductor under `dev-team-autopilot`); it does **not** write machine state mid-cycle —
`autopilot.json` is still read-first / written-last at RECORD, where `last_commit` is refreshed to the
run branch's current HEAD. Precedence: per-run argument > plain language > per-session env
`DEV_TEAM_NO_AUTO_COMMIT` > repo config `features.auto-commit` > built-in default `on`. Fail-open.

## Git / branch model

- One run = one branch; **one commit per passing cycle/checkpoint**; never merge to `main` without asking. With `auto-commit` on (the default), each completed-and-checked task/workstream also lands its own additional local commit *between* checkpoint commits — see "Auto-commit" above (never replaces the checkpoint commit, never pushes, only integrated+checked units).
- Branch names: `iterate/<date>`, `security-audit/<date>`, `review-fix/<date>`, `stripe/<date>`, `autopilot/<date>` (suffix `-2`, `-3` on collision).
- **Under the `dev-team-autopilot` conductor, siblings do NOT create their own branch** — every mode cycle commits to the single `autopilot/<date>` run branch.
- A dirty working tree or a non-git repo is surfaced to the user before proceeding — and it forces full re-validation of any reused Codebase Map, not just branch hygiene.

### PR base, no-stack & single-PR policy

By default, every run branches FROM and targets the **default branch** (`main`) — this extends the
"one run = one branch" rule above with *which* branch that is. **Never stack a PR on another
feature branch**: stacking creates a merge-race hazard (the base branch can move, get rebased, or
be force-pushed out from under the dependent PR, and reviews/CI end up run against a moving
target). Stack only when `.dev-team/config.yml` sets `git.stack-prs: true` **and** the user
explicitly asks for it for that run — both conditions, not either.

**Single-PR policy** (`git.single-pr`, default **on**) is the companion rule: where no-stack
prevents *stacked* PRs, single-PR prevents *duplicate* PRs — a second PR for a line of work that
already has one open. Together they keep **one open PR per line of work**, the safest merge posture
(no parallel PRs racing to merge the same change). When a run is surfaced as a PR — or a
follow-up / cold-resume run continues an earlier one — the lead:

1. **Reuses the run branch.** A follow-up run for the same line of work continues on the *same* run
   branch as the prior run (adopting it when an open PR still points at it) instead of cutting a
   fresh `<mode>/<date>` branch, so new commits flow into the existing PR rather than a new one.
2. **Checks before creating.** Before opening a PR, check whether an open PR already exists for this
   branch → base (`gh pr list --head <branch> --base <base> --state open`; GitLab: `glab mr list
   --source-branch <branch>`). If one exists, **do not open a second** — push the branch (the
   existing PR updates itself) and report that PR's URL. Only ever reuse a PR whose **head is this
   run branch** — never push onto an unrelated PR, or one the user doesn't own.
3. **Platform-agnostic & fail-open.** GitHub (`gh`) or GitLab (`glab`), auto-detected from the git
   remote (same detection as issue sync); if the CLI is absent/unauthed or the check fails, fall
   back to today's behavior — hand the branch back for the user to open the PR.

Single-PR does **not** make the suite auto-open PRs — every skill still hands the branch back for
review, and nothing merges to the base without asking. It only ensures that *when* a PR is created
or updated, it converges on the one existing PR instead of spawning duplicates. Turn it off with
`git.single-pr: false` (then each run may surface its own PR). See
`references/config-and-toggles.md` for the `git:` block (`stack-prs`, `single-pr`, `default-branch`).

## Gates

- **Feature Spec Gate** (standalone iterate / featurefind / orchestrator): every net-new feature — *any size* — needs the user's approval of *which* features and *exactly how* each works before it is built. Discovery/improvement skills propose; they never build a feature unprompted.
- **Conductor hybrid gate policy** (autopilot): replaces the Feature Spec Gate. Obvious in-scope table-stakes (`risk:Low`, non-destructive, net-positive) auto-build from a conductor-authored spec whose logged justification is the approval-of-record; differentiators / risky / out-of-scope / destructive are queued and surfaced for the user. `gates=pause-all` restores the standalone gate.

## Shared discipline

- **Evidence, not claims.** Builders paste real command output; the checker re-runs; review re-proves with fresh evidence generated *now*. In featurefind this becomes a **citation per claimed competitor feature**.
- **Restraint.** No manufacturing work to keep a loop alive. "Nothing high-impact left — here's what I'd leave alone, stopping" is a success state, not a failure.
- **Independence.** Whoever verifies a thing is never whoever built it.

## Self-tests

The plugin tests itself: `tests/smoke-structure.sh` (structure a marketplace installer relies on) and `tests/scripts.bats` (behavior contracts for the hooks/scripts) run in CI as the `test` job alongside the existing `audit` job (`.github/workflows/plugin-audit.yml`) — see `tests/README.md` and `CONTRIBUTING.md` for how to run them locally before you touch `hooks/`, `scripts/`, or the manifests.

## Safety (security & stripe)

- **Test-mode / local-sandbox only.** Never attack or mutate systems you don't own; never run live payment flows (`dev-team-stripe` needs an explicit `live=confirm`).
- **Destructive/irreversible ops on systems the user DOES own also require confirmation.** Production databases, live datastores, and deployed environments are not exempt just because the user owns them: any destructive or irreversible operation against one requires the user's explicit confirmation and a verified backup/rollback in hand before proceeding. `git revert` undoes code, not data.
- **Secrets:** report location and type, never the value; flag for rotation; treat as compromised.
- **Active-compromise signal → freeze all remediation.** Do not patch even if the fix is clear — auto-patching destroys forensic evidence and tips off an attacker. Escalate to the user as incident response; this is not a git-revertible action.

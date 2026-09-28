---
name: dev-team-migrate
description: Run safe LARGE-SCALE migrations — framework/language/dependency major upgrades, schema migrations, API/interface ports — as a team lead delegating to a team of `opus-builder` subagents (Opus tier). The teeth are migration-specific: pin current behavior with a characterization-test net BEFORE touching anything, then move in a staged, reversible cutover — one coherent slice per commit, every stage independently green (its own criteria plus the full characterization net) and independently revertible, no big-bang. Runs in two modes: `plan` (assess the migration surface and dependency order, choose a strategy, define the staged cutover plan with its risk sizing, and GATE it with the user before any code moves) and `execute` (build the characterization net, then migrate stage-by-stage against the approved plan with compatibility shims where old and new must coexist, ending in a final cutover-and-cleanup stage that removes every shim and dead old-path). Use when the user wants to "migrate from X to Y", "upgrade to <major version>", "port to <framework>", "React 17→18", "Python 2→3", "migrate the database schema", "swap <libA> for <libB>", or mentions "migration", "cutover", "expand-contract", or "big rewrite". Sibling of dev-team-orchestrator. Do NOT use for a normal feature build (dev-team-orchestrator), general cleanup/polish with no migration target (dev-team-iterate), or Stripe-specific work (dev-team-stripe).
---

# Dev Team Migrate

You are the **migration lead**. The codebase already works on `from=<x>`; your job is to get it
fully and safely onto `to=<y>` without ever losing what already worked — delegating to a team of
`opus-builder` subagents (Opus tier; model routing:
`skills/dev-team-orchestrator/references/model-routing.md`), never migrating the code yourself.
Migrations fail in one of two ways: silently (behavior quietly changes and nobody notices until
production) or catastrophically (a big-bang cutover with no way back). This skill exists to make
both of those structurally impossible.

This is the **migration variant** of `dev-team-orchestrator`. It **reuses that skill's machinery
wholesale** — the team, brief format, checker, documentarian, debate protocol, evidence-not-claims,
rollback commits. It changes the front end (a migration plan instead of a feature spec) and adds
two migration-specific safety mechanisms: a **characterization-test net that must exist before any
change**, and a **staged, independently-reversible cutover discipline**.

> **Read `dev-team-orchestrator/SKILL.md` first** — locate it via your `available_skills` registry
> (it lives under `~/.claude/skills/` for a user install or `.claude/skills/` for a project
> install). Delegation, team sizing, parallelism, contracts, the checker, the debate protocol, and
> the documentarian all apply unchanged. This file documents only the migration-specific deltas.

## Non-negotiable migration rules (read before running)

These are the reason this skill exists — every plan/execute pass enforces them:

1. **Characterization tests before anything else.** You cannot safely change behavior you haven't
   pinned. Before any migration code moves, a test net that captures *what the code actually does
   now* (not what it should do) must exist and pass against the untouched `from=` state. If a
   genuine net can't be built, fall back to conservative/parallel-run — never migrate blind. Full
   protocol: `references/characterization-and-cutover-protocol.md`.
2. **Staged, reversible cutover — one coherent slice per commit.** Never one giant diff. Each stage
   migrates one bounded slice, is verified green on **its own criteria AND the full
   characterization net**, and is independently revertible with a single `git revert` (or a
   documented flag-flip for a parallel-run stage) — without needing to also unwind any other stage.
3. **No big-bang.** The default strategies are `incremental` (migrate in place, slice by slice) and
   `parallel-run` (old and new coexist, compared, before cutover). `strategy=big-bang` is strongly
   discouraged and only ever runs after the **Migration Plan Gate** surfaces it as an explicit,
   named risk and the user signs off — it is never the default and never silently accepted.
4. **Behavior preserved and verified at every stage, not just at the end.** The checker re-runs the
   *entire* characterization net after every stage, not only the new stage's own tests — behavior
   that silently moved elsewhere is still a regression.
5. **No half-migrated state left mid-run.** A compatibility shim (adapter, feature flag,
   expand-contract, dual-write) is fine *only* if it names the later stage that removes it. The
   final **cutover + cleanup** stage is mandatory: every shim and every dead old-path is removed,
   and the characterization net is run one last time fully switched over.
6. **Execution-environment gate for data-mutating steps (data-loss safety, non-negotiable).** The
   reversibility discipline above (rules 2 and 5) is **code-level** — `git revert` undoes a commit,
   not a data mutation. Any stage that actually touches data (Stage-0 characterization writes,
   backfill, dual-write, or a contract/DROP step) defaults to running against a **DISPOSABLE**
   datastore — a restored snapshot, fixtures, or a dedicated test instance — never the live/production
   store, by default. Targeting a **LIVE/production** datastore requires the user's explicit,
   informed confirmation (mirroring `dev-team-stripe`'s test-mode-default + `live=confirm`; see
   `db-target` under Arguments). The Migration Plan records, per stage, which datastore each
   data-touching stage runs against — this is not left implicit. Any **DB-DESTRUCTIVE** step
   (contract/DROP, dual-write cleanup) additionally requires a **verified backup/snapshot** taken and
   confirmed **before** the stage runs, live target or not — state plainly to the user: `git revert`
   undoes code, it does not undo data. Full detail:
   `references/characterization-and-cutover-protocol.md` (Parts 1 and 4).

## Your team

Same shape as the orchestrator, specialized for migration work:

- **Scouts** — the `opus-builder` agent (Opus tier), read-only. Inventory the current
  implementation, every caller/consumer of what's migrating, the dependency/coupling graph, current
  test coverage in the migration zone, and any prior migration attempt left in the repo's history. Also apply "Repository instructions and normative documents" (orchestrator conventions.md): report the repository's instruction files and any normative documents, with their rule-ID scheme and profiles.
- **`deep-architect`** (Reasoning tier) — for the genuinely hard call: choosing the cutover
  strategy when it's contested (incremental vs. parallel-run, or the big-bang risk trade), breaking
  a circular dependency order, or designing a data-model transformation with no obvious safe path.
  Spawn one per option via the orchestrator's debate protocol (`references/debate-protocol.md`)
  when 2–4 plausible strategies exist; a clear-cut choice you just make yourself.
- **Builders** — the `opus-builder` agent (Opus tier). Write the characterization tests first, then
  execute each stage's slice (and its compatibility shim, if any), via the orchestrator's
  `task-brief-template.md`.
- **Checker / verifier** — the `opus-builder` agent (Opus tier). Verifies each stage's own
  acceptance criteria **and re-runs the full characterization net** (not just this stage's slice) to
  confirm behavior is preserved, confirms the stage is independently revertible, and — at the
  cutover stage — confirms no shim or dead old-path code remains. Verification stays on the
  Opus/frontier tier — never routed cheaper (model-routing.md, invariant 1).
- **Documentarian** — the `sonnet-scribe` agent (Sonnet tier). Owns `.dev-team/MIGRATION.md` — this skill's
  own external memory, following the same schema-versioning and "Current status stays overwritten"
  discipline as `.dev-team/PROJECT.md`/`.dev-team/SECURITY.md` (`dev-team-orchestrator/references/documentarian-protocol.md`,
  `references/conventions.md`'s "Schema versioning"): the **Migration Plan**, the **Stage Ledger**,
  and the **compatibility-shims-in-play** table. See `references/migration-plan-protocol.md` for the
  full schema.

## Picking the mode

**At the start of the run, before any agent is spawned:** take the instruction snapshot
(`dev-team-orchestrator/references/conventions.md`, "Repository instructions and normative
documents", step 1) and settle `handoff-file` once ("Auto-handoff", same file); pass the snapshot in
every brief and the `handoff-file` value in every documentarian brief. Under the autopilot
conductor, use the conductor's snapshot and value instead of taking your own.

- **`plan`** — no approved Migration Plan exists yet for this `from=`/`to=` pair in this repo (or
  the user is asking "how would we migrate X to Y", "what's the plan", "assess the migration").
  Assesses the surface, chooses a strategy, defines the staged plan, and **stops for approval** —
  no code moves.
- **`execute`** — a Migration Plan already exists and is **approved** (from this session's `plan`
  step, or a prior run's `.dev-team/MIGRATION.md` that the Cold-resume check validates as still current — see
  below). Runs the characterization-net gate, then the staged cutover, stage by stage.
- **Infer** when not given explicitly: no valid, approved `.dev-team/MIGRATION.md` in the repo → `plan`. A
  valid approved plan exists and the user says "go ahead" / "execute it" / "start migrating" →
  `execute`. If genuinely ambiguous (a plan exists but looks stale, or the user's intent is unclear),
  ask rather than guessing which mode to run.
- **Cold-resume** (this skill's variant of the suite's shared contract —
  `dev-team-orchestrator/references/conventions.md`, "Cold-resume"): at the start of *either* mode,
  look for a current `.dev-team/MIGRATION.md` (found through the lookup order) from a prior run in this repo. Validate it the same way
  `dev-team-iterate` validates its Codebase Map — a git-drift check plus a small spot-check against
  the real repo. If it's current, **resume** from its Migration Plan and Stage Ledger instead of
  re-assessing from scratch. If it's missing, stale, or the tree is dirty in a way that invalidates
  it, start fresh (full `plan` mode) rather than trusting it blind.

## PLAN mode — the Migration Plan Gate

Follow `references/migration-plan-protocol.md` end to end:

1. **Resume check** (above), then **scout** the migration surface: what's in scope, every
   caller/consumer, the dependency/coupling graph, current test coverage in the zone.
2. **Map dependency order** — what has to move before what (a topological order over the coupling
   graph), so no stage migrates something whose dependents can't yet tolerate the change (or names
   a shim that lets them).
3. **Choose a strategy** — `incremental`, `parallel-run`, or (only with an explicit called-out risk)
   `big-bang`. Use the debate protocol via `deep-architect` if genuinely contested.
4. **Define the stages** — each with its slice, approach, done-criteria, characterization coverage,
   named rollback, and a risk rating. Stage 0 is always **build the characterization net**.
5. **Size the risk** — overall and per stage; anything High-risk gets extra scrutiny (a smaller
   slice, a parallel-run sub-strategy, or an explicit rollback rehearsal) before it's allowed to run.
6. The documentarian writes the **Migration Plan** and the initial **Stage Ledger** into
   `.dev-team/MIGRATION.md`.
7. **Stop.** Present the plan — strategy + reasoning, the staged breakdown, the risk sizing, and (if
   `strategy=big-bang`) the specific called-out risk — to the user and wait for explicit approval.
   **This is a hard gate, not a toggle** — distinct from `dry-run` (which, inside an *already
   approved* `execute` run, only skips spawning builders for one invocation's worth of stage briefs).
   No stage of `execute` mode runs against an unapproved or materially-changed plan.

## EXECUTE mode — staged, reversible cutover

Requires an **approved** Migration Plan. If none exists, or the Cold-resume check finds it stale /
materially drifted from the repo, `execute` mode falls back to running `plan` first — it never
builds against a plan that hasn't been approved or has gone stale since approval.

Follow `references/characterization-and-cutover-protocol.md` end to end:

1. **CHARACTERIZATION-NET GATE (hard, before touching anything else).** Stage 0: build the test net
   that pins the `from=` state's actual current behavior — from the existing suite where it's
   healthy, or new characterization/golden-master/contract tests where coverage is thin. If a
   genuine net can't be built, fall back to conservative mode (smallest possible additive steps,
   default to `parallel-run` so divergence is caught empirically) and tell the user why. The net
   itself is committed and checkpointed like any other stage before Stage 1 begins.
2. **Per stage:** migrate one coherent slice → **verify** (the stage's own criteria **and** a full
   re-run of the characterization net, with pasted evidence) → **commit** (its own commit; must be
   independently revertible) → update the Stage Ledger → next stage.
3. **Compatibility shims** wherever old and new must coexist mid-migration (adapter/facade, feature
   flag, expand-contract for schema work, dual-write/shadow-read for parallel-run) — each one
   recorded with the later stage that removes it.
4. **Final cutover + cleanup stage.** Only after every prior stage's characterization net is fully
   green on the new state: remove every shim, migration-only flag, and dead old-path; re-run the
   full characterization net one last time; confirm no half-migrated state remains anywhere.

## Definition of done

- [ ] An **approved** Migration Plan is on record (strategy + reasoning, staged breakdown, risk
      sizing) in `.dev-team/MIGRATION.md`.
- [ ] A characterization-test net exists and demonstrably pins the pre-migration behavior (or the
      conservative/parallel-run fallback is explicitly documented and in effect).
- [ ] The codebase is **fully** on the `to=` target — no half-migrated state anywhere.
- [ ] **Every stage** is independently green (own criteria + full characterization net, evidence
      pasted) **and** independently revertible, each its own commit in the Stage Ledger.
- [ ] Every compatibility shim, migration-only flag, and dead old-path from the old implementation
      is removed in the final cutover stage.
- [ ] The full characterization net (and the project's normal test suite) is green end to end, post
      cleanup — no unresolved regression.

## Git isolation

- One run = one branch: `migrate/<date>` (suffix `-2` on collision), branching FROM and targeting
  the default branch — never stacked on another feature branch (`conventions.md`'s no-stack policy)
  unless the repo's `.dev-team/config.yml` explicitly opts in.
- **One commit per stage**, including Stage 0 (the characterization net) — never bundle two stages
  into one commit; that's exactly what breaks independent revertibility.
- A bad stage reverts to the **prior stage's commit**, not a hand-untangled partial state — this is
  the entire point of one-coherent-slice-per-commit.
- Hand the branch to the user to review and merge; never merge to `main` yourself without asking.
- If the working tree is dirty or it's not a git repo, surface that before proceeding — same as
  every sibling skill, and it forces full re-validation of any reused Migration Plan, not just
  branch hygiene.

## Arguments

Optional run arguments (defaults in brackets):

- `mode=plan|execute` — pick the mode [infer: no valid approved plan yet → `plan`; a valid approved
  plan exists and the invocation clearly means "go" → `execute`; ask if genuinely ambiguous].
- `from=<x>` — the current state (framework/language/version/schema/library) being migrated away
  from.
- `to=<y>` — the target state being migrated to.
- `strategy=incremental|parallel-run|big-bang` — the cutover strategy [`incremental`; `big-bang` is
  strongly discouraged and only runs after the Migration Plan Gate surfaces its risk explicitly and
  the user signs off — never the default, never silently accepted].
- `dry-run=on|off` — inside `execute` mode, produce the per-stage builder briefs you WOULD issue for
  the (already-approved) stages, spawn no builders, and make no file or git changes; report the
  plan for approval. (`mode=plan` already stops for approval by design — this flag adds nothing
  there.) Precedence: this argument > `features.dry-run` in `.dev-team/config.yml` > built-in
  default [off]. Plain language ("just show me the plan", "dry run first") also sets it. See
  `dev-team-orchestrator/references/conventions.md` ("Dry-run / plan-preview").
- `models=economy|balanced|max` — cost posture biasing which tier does build/scout work;
  verification always stays frontier (model-routing.md, "Cost posture"). [balanced]
- `issues=off|sync|auto` — reflect this run's open Stage Ledger follow-ups (a deferred stage, a risk
  flagged for sign-off, a proposed-not-auto-taken strategy call) in the repo's issue tracker. `sync`
  exports at the normal sync points; `auto` continuously reflects each follow-up as it is finalized
  (per-task cadence). Both are dedup-safe and confirm-first on the first sync per repo. Platform is
  auto-detected from the git remote — GitHub via `gh`, GitLab via `glab`; a plain-git repo with no
  platform simply skips issue sync. Mechanics in
  `dev-team-orchestrator/references/issue-sync-protocol.md`. [off]
- `cap=N` — safety backstop: max number of stages to execute in this invocation before stopping to
  checkpoint and report (protects against a plan that turns out to need far more stages than
  estimated); not a substitute for finishing the approved plan across multiple invocations [default:
  the approved plan's full stage count — i.e. run the whole plan in one invocation; set it lower to
  checkpoint more often on a large migration].
- `db-target=disposable|live` — which datastore data-mutating stages (characterization writes,
  backfill, dual-write, contract/DROP) run against [`disposable` — a restored snapshot, fixtures, or
  a dedicated test instance; `live` requires the explicit, informed user confirmation described in
  Non-negotiable migration rule 6 above, the datastore analog of `dev-team-stripe`'s `live=confirm`].
- `branch=<name>` — override the default `migrate/<date>` branch name.

## What carries over from dev-team-orchestrator (unchanged)

- Team sizing & parallelism — parallelize only non-overlapping stages/files; a stage with a
  sequential dependency on another waits for it.
- Brief discipline (`task-brief-template.md`), evidence-not-claims, the lean/efficiency bar.
- Checker triage (`checker-protocol.md`) — runs on `opus-builder`; verification stays on the
  Opus/frontier tier, never routed cheaper (model-routing.md, invariant 1).
- Documentarian discipline (`documentarian-protocol.md`) — schema versioning, "Current status" kept
  overwritten not appended, light ledger retention — applied here to `.dev-team/MIGRATION.md` instead of
  `.dev-team/PROJECT.md`.
- Failed/stuck agents: diagnose, re-brief, two strikes then re-scope.
- Debate mode (`debate-protocol.md`) for the strategy choice, dependency-order conflicts, or a
  contested data-model transformation.
- **You own dependency/manifest changes** and the migration's shared contracts (the new interface a
  migrated module must expose) — define them up front so parallel stages don't drift.

## References

- `references/migration-plan-protocol.md` — Phase for `mode=plan`: assess the migration surface, map
  dependency order, choose a strategy, define the staged plan with done-criteria and risk sizing, and
  the `MIGRATION.md` schema (Migration Plan + Stage Ledger). Read before your first plan.
- `references/characterization-and-cutover-protocol.md` — the skill's teeth: building the
  characterization-test net, the staged-cutover discipline (one slice, green, revertible,
  committed), compatibility-shim patterns, rollback, and the final cutover + cleanup stage. Read
  before your first `execute` run.

Reused from `dev-team-orchestrator/references/`: `task-brief-template.md`, `checker-protocol.md`,
`debate-protocol.md`, `documentarian-protocol.md`, `issue-sync-protocol.md`.

The suite's **shared contracts** — artifact ownership & schemas, ID prefixes, the branch model, the
flattening rule, gates, and safety — live in
`dev-team-orchestrator/references/conventions.md`; read it once. (`.dev-team/MIGRATION.md` follows that file's
schema-versioning and Cold-resume discipline as this skill's own owned artifact.)

## Anti-patterns (in addition to the orchestrator's)

- **Big-bang by default (or by drift).** `strategy=big-bang` is never the default and never applied
  without the Migration Plan Gate calling it out and the user explicitly signing off.
- **Migrating without a characterization net.** No net (or an honest, documented
  conservative/parallel-run fallback) means no proof behavior was preserved — that's not a
  migration, it's a gamble.
- **A stage that isn't independently green or independently revertible.** If reverting it requires
  also unwinding another stage, the slices weren't cut right — split them.
- **Verifying only the new stage's own tests.** A stage is not done until the *full*
  characterization net re-runs clean — behavior can silently relocate instead of being preserved.
- **Leaving both paths half-wired.** A compatibility shim with no scheduled removal stage is exactly
  the half-migrated state this skill exists to prevent.
- **Skipping the Migration Plan Gate on a risky migration.** Schema changes, framework majors, and
  anything touching money/auth/data integrity always go through `plan` mode first — no exceptions
  for "it's probably fine."
- **Treating `dry-run` as the plan gate.** They are different things: `dry-run` previews one
  invocation's builder briefs inside an already-approved `execute` run; the Migration Plan Gate is
  the hard, one-time approval of the strategy and staged plan itself.
- **Bundling multiple stages into one commit.** Defeats the entire point of staged, independently
  revertible cutover — one coherent slice per commit, always.
- **Letting scope drift mid-`execute` without returning to `plan`.** If the real dependency order or
  risk profile turns out materially different from the approved plan, stop and re-gate rather than
  improvising past it.
- **Declaring done before the cutover + cleanup stage.** Fully migrated means the old path, its
  shims, and its flags are gone — not just that the new path also works.

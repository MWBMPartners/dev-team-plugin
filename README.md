# dev-team

A Claude Code plugin that lets you run software work as a **team lead / product owner** instead of coding alone: you delegate every piece of implementation to a tiered team of Claude subagents (a frontier reasoner, an Opus builder/verifier, a Sonnet documentarian, a Haiku mechanic) through a stage-by-stage *delegate → check → checkpoint* loop. Nine skills cover the whole lifecycle — building, iterating, security, verification, competitive feature discovery, Stripe, shipping/CI, and PR CI-medic — plus an autopilot conductor that drives them all to production autonomously. An optional **taste-first** profile can put the highest-taste model in the orchestrator seat and offload token-hungry bulk work to GPT-5.5/Codex.

---

## Install

The plugin ships from the private **MWBMPartners** marketplace:

```text
/plugin marketplace add MWBMPartners/dev-team-plugin
/plugin install dev-team@dev-team
```

Once installed, the [hooks](#hooks--environment-switches) auto-activate (they are fail-open and scoped — see below), and the [`/dev-team`](#commands) router is your entry point.

### Updating

The plugin has a layered update story:

- **Layer 1 — marketplace auto-update (primary).** Enable auto-update for `dev-team` from the `/plugin` UI toggle, or declare it in your settings via `extraKnownMarketplaces` with `autoUpdate: true`. This rides on Claude Code's own auto-updater.
  - `DISABLE_AUTOUPDATER` turns off Claude Code's auto-update entirely (including marketplace plugin auto-update).
  - `FORCE_AUTOUPDATE_PLUGINS` keeps plugin auto-updates running even when `DISABLE_AUTOUPDATER` is set.
- **Layer 2 — SessionStart notifier (fallback).** [`hooks/check-update.sh`][check-update] compares your installed version against the remote `plugin.json` at most once per 24h and, if a newer version exists, prints a one-line notice to run the update. It never updates anything itself, and fails open/silent if `gh`/`jq` are missing or the network call fails. Disable with `DEV_TEAM_NO_UPDATE_CHECK`.
- **Manual.** Run [`/dev-team-update`](#commands) to check and get the exact commands, or update by hand:

  ```text
  /plugin marketplace update dev-team
  /plugin update dev-team
  ```

---

## Which skill when

| You want to… | Skill | Notes |
|---|---|---|
| Build a non-trivial app / feature / service / refactor / migration | [dev-team-orchestrator](#dev-team-orchestrator) | Single bounded build. Delegates all coding. |
| Improve / polish / harden an **existing** codebase with no fixed spec | [dev-team-iterate](#dev-team-iterate) | Reverse-engineers purpose, iterates in scored cycles. |
| Security audit / pentest / find & fix vulnerabilities | [dev-team-security](#dev-team-security) | Adversarial red-team + remediation. |
| Verify / QA / double-check a prior dev-team run's claims | [dev-team-review](#dev-team-review) | Independent, adversarial verification. |
| Find the features you're **missing** vs. competitors | [dev-team-featurefind](#dev-team-featurefind) | Scored feature-gap ledger. |
| Build / audit **Stripe** / payments / billing / Connect / webhooks | [dev-team-stripe](#dev-team-stripe) | Takes precedence over security/review/iterate for payments. |
| Stand up or audit CI, branch protection, secret scanning, releases | [dev-team-ship](#dev-team-ship) | The delivery pipeline, not the product. |
| Watch open PRs and fix failing CI checks | [dev-team-ci-medic](#dev-team-ci-medic) | Via [`/dev-team-watch-prs`](#commands); loopable. |
| Drive a product **all the way to production**, autonomously | [dev-team-autopilot](#dev-team-autopilot) | Conductor of all the above; fire via `/loop`. |

Most skills also accept **plain-language equivalents** — e.g. "keep costs down" sets `models=economy`, "make it faster" sets `focus=efficiency`, "improve the UX" sets `focus=ux`. The [`/dev-team`](#commands) router picks the right skill from free text.

---

## Skills

All skills run as a team lead delegating to Opus-tier subagents (`opus-builder`), with a `sonnet-scribe` documentarian owning the state files and — for hard reasoning — the `deep-architect` (Fable) tier. See [Model routing & tiers](#model-routing--tiers).

### dev-team-orchestrator

**Purpose.** Run a single bounded software project as a team lead who delegates *all* implementation to a tiered team of subagents, via a stage-by-stage delegate–check–checkpoint loop.

**When to use.** Whenever the user asks to build, create, or ship a non-trivial piece of software — an app, feature, service, refactor, migration, or multi-file project — or mentions an "orchestrator", "agent team", "team lead mode", "delegate to agents", or "parallel agents". Not for one-file scripts, quick fixes, or questions. For an unattended long-running drive to production, use [dev-team-autopilot](#dev-team-autopilot).

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `models=economy\|balanced\|max` | `balanced` | Run-level cost-posture knob (documented in [model-routing.md][model-routing], not in this skill's own SKILL.md). Biases the tier→agent mapping for the whole run. Also triggerable by plain language ("keep costs down" → economy). Verification always stays on `opus-builder` in every posture (Invariant 1). |

**Modes.** None — no `mode=` subcommands. It runs one loop: UNDERSTAND → SCOPE INTO STAGES → [per stage: PLAN → DELEGATE → CHECK → CHECKPOINT → DECIDE] → VERIFY → done. It offers an optional *taste-first* orchestration profile (see [orchestration-profiles.md][orchestration-profiles]) and three lead-chosen check-in policies (Autonomous / Milestone check-ins / Decision check-ins) — judgment calls, not invocation flags.

**Artifacts.** [`PROJECT.md`](#artifacts-glossary) (external memory / source of truth), plus a git commit at each passing stage checkpoint (message naming the stage) as a rollback point.

### dev-team-iterate

**Purpose.** Run a self-directed improvement loop on an **existing** codebase, reverse-engineering the app's purpose (instead of a predefined goal), auditing it, and iterating in scored cycles to improve correctness, UX, efficiency, and remove redundancy — building small improvements autonomously and proposing large features for approval.

**When to use.** When the user wants to "iterate on", "improve", "refine", "polish", "harden", or "level up" an existing project without a spec, or mentions "iterate mode". Not for building toward a stated goal (use the orchestrator), one-file scripts, quick fixes, or questions. For Stripe/payments work use [dev-team-stripe](#dev-team-stripe).

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `cycles=N` | `5` | The cycle cap for the run. |
| `propose-threshold=small\|medium\|large` | `medium` | For **non-feature** work, how big a change must be before it's propose-only instead of built. At `medium`, small/isolated improvements build; large refactors/perf/dep-changes propose. Features always go through the Feature Spec Gate regardless of size. |
| `focus=<dimension(s)>` | `none` (balanced, UX-first) | Drive the run toward one or more dimensions: features, ux, correctness, efficiency, redundancy, security, docs. Accepts flag form or plain language ("make it faster", "clean up the duplication"). Multiple allowed. |
| `branch=<name>` | `iterate/<date>` | Override the default run branch used for git isolation. |
| `models=economy\|balanced\|max` | `balanced` | Cost posture biasing which tier does build work; verification always stays frontier (per [model-routing.md][model-routing]). |

**Artifacts.** [`PROJECT.md`](#artifacts-glossary), extended with the Codebase Map, a run record (map-commit + date, for the resume check), the scored backlog, the Proposed-Features ledger, and the trajectory ledger (metrics over time).

### dev-team-security

**Purpose.** Run an advanced, adversarial security audit and remediation loop on a codebase you own or are authorized to test.

**When to use.** When the user wants to "security audit", "pentest", "harden", "find vulnerabilities", "attack/hack my own code", or "fix all security issues". Not for attacking systems the user doesn't own, one-file scripts, or questions. For Stripe/payments, use [dev-team-stripe](#dev-team-stripe).

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `severity-floor=critical\|high\|medium\|low` | `high` | Lowest severity to fix this run; below it is documented only. Default fixes Critical+High, documents the rest. |
| `scope=full\|<surface-list>` | `full` | Audit the whole vulnerability-class checklist, or a named subset (e.g. `scope=authz,injection,secrets`). |
| `rounds=N` | until-dry, cap 4 | Max red-team rounds before stopping. |
| `fix=auto\|propose-only` | auto for clear vulns, propose for risky/architectural | Whether confirmed vulns are fixed autonomously or only reported with proposed fixes. |
| `tools=auto\|off` | `auto` | Run the SCA/SAST/secret/container scanners in Phase 0 (auto: whatever the stack supports), or reason-only (off). |
| `report-only` | off | Audit, validate, and report findings without applying any fix (implies `fix=propose-only`). |
| `branch=<name>` | `security-audit/<date>` | Override the default branch name (suffix `-2` if it already exists). |

**Modes.** No `mode=` argument; the mode-like toggles are `fix=auto\|propose-only` and the `report-only` flag.

**Artifacts.** [`SECURITY.md`](#artifacts-glossary) (threat model, attack-surface map, coverage ledger, findings register with CWE / CVSS v3.1 / status / fix / verification evidence); a `security-audit/<date>` branch with one commit per fixed-and-verified finding, handed to the user for review (never auto-merged); isolated non-destructive PoC/repro artifacts in a sandbox dir; a new security regression test per fixed finding.

### dev-team-review

**Purpose.** Run an independent verification / QA pass over work done by the other dev-team skills — reading `PROJECT.md` (and `SECURITY.md`), extracting every claim, and spawning independent adversarial verifier agents to prove each one actually works with fresh evidence.

**When to use.** When the user wants to "verify", "QA", "review", "double-check", or "confirm everything works" after an orchestrator / iterate / security run. Not to build features or for one-off questions; for Stripe/payments verification use [dev-team-stripe](#dev-team-stripe) (review mode).

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `target=auto\|PROJECT.md\|SECURITY.md\|both\|<path>` | `auto` (detect both) | What to verify against. |
| `scope=all\|done-criteria\|features\|fixes\|decisions\|metrics` | `all` | Which classes of claim to verify. |
| `depth=quick\|standard\|deep` | `standard` | quick: re-run tests/build/lint + read-checks + git-trail. standard: + clean-room run & exercise primary flows + re-run the builder's pasted evidence. deep: + adversarial double-verification, edge/flaky cases, re-run security PoCs. |
| `remediate=fix\|propose\|report` | `fix` | After the report: fix = fix every gap + inefficiency via dev-team cycles on a branch then re-verify; propose = list fixes without applying; report = stop at the report. |
| `improve=on\|off` | `on` | Whether the fix phase also addresses inefficiencies, not just bugs. |
| `branch=<name>` | `review-fix/<date>` | Branch the fix phase works on. |

**Modes.** No user-facing mode switch, but two contexts: (1) **standalone** — full pipeline including the default-on fix phase; (2) invoked by [dev-team-autopilot](#dev-team-autopilot) as its VERIFY mode — effectively forced `remediate=report`: produces verdicts + `VERIFICATION.md` + `verdict.json` only, never enters the fix phase, creates no branch, and hands FAILED/DRIFTED/HOLLOW verdicts back to the conductor.

**Artifacts.** [`VERIFICATION.md`](#artifacts-glossary) (per-claim verdicts + evidence + severity + confidence, integration result, regression delta, overall verdict, prioritized gap list); `verdict.json` (machine-readable, for CI gating); a status-line update on `PROJECT.md` (not owned/rewritten); a `review-fix/<branch>` only if the fix phase runs (never merged to main).

### dev-team-featurefind

**Purpose.** Research similar/competitor products, find the features your implementation is **missing**, and score each gap by importance within the project's aim — producing a scored feature-gap ledger (`FEATURES.md`).

**When to use.** When the user asks "what features am I missing", "what should I add", "how do I compare to competitor X", wants a "competitive analysis" / "feature gap analysis" / "feature ideas", or mentions "featurefind"; also as the discovery front-end before a feature-building push. Not for building features, generic "improve my app" requests, factual product questions, or unrelated market research.

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `competitors=<list>` | `discover` | Seed the comparable set explicitly (e.g. `competitors=Linear,Jira,Height`); else discover them. |
| `category=<name>` | `inferred` | Override the inferred product category that drives the search. |
| `count=N` | ~5 | Target number of comparables to research. |
| `scope=strict\|balanced\|loose` | `balanced` | How aggressively the validator excludes out-of-scope features. strict keeps only clear purpose-fits; loose surfaces more adjacent ideas (still marked). |
| `focus=table-stakes\|differentiators\|all` | `all` | Bias the hunt toward closing parity gaps, toward standout features, or both. |
| `depth=quick\|standard\|deep` | `standard` | quick: top comparables, headline features only. standard: full comparable set + category sweep + validate. deep: + changelog/recent-release mining and a second validation pass on high-importance gaps. |

**Modes.** No named run modes. Two contexts: (1) **standalone** — a one-time Scope Gate confirms the inferred aim, comparable set, and scope boundary with the user before researching; (2) invoked by [dev-team-autopilot](#dev-team-autopilot) as its discovery mode — the Scope Gate is skipped, findings written straight to `FEATURES.md`/`PROJECT.md`, and the conductor owns the approval gate.

**Artifacts.** [`FEATURES.md`](#artifacts-glossary) (confirmed aim, comparable set with sources, scored gap register — in-scope gaps ranked by importance plus an out-of-scope section with reasons). When `PROJECT.md` is present, the documentarian syncs the top in-scope gaps into its Proposed-Features ledger.

### dev-team-stripe

**Purpose.** Build or review Stripe integration pathways with Stripe-specific correctness and security expertise, all in **test mode** by default.

**When to use.** When the user wants to build, integrate, audit, harden, or verify anything involving Stripe / payments / subscriptions / Connect / webhooks. Takes precedence over security/review/iterate whenever the work involves Stripe/payments. Not for non-Stripe work, one-off questions, or a generic post-run QA pass over a prior run's claims (that's [dev-team-review](#dev-team-review)).

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `mode=build\|review` | infer from the request; ask if ambiguous | Pick the mode. |
| `surface=checkout\|payment-element\|payment-intents\|billing\|connect\|webhooks\|ios-native\|android-native\|auto` | `auto` (detect from repo) | The Stripe surface in scope. |
| `severity-floor=critical\|high\|medium\|low` | `high` | (review) lowest severity to fix this run. |
| `live=confirm` | absent → test mode only | Explicit, one-time acknowledgement required before **any** live-mode action. |
| `branch=<name>` | `stripe/<date>` | Work branch. |

**Modes.** `mode=build\|review`. **BUILD** implements payment flows (Checkout, Payment Element, PaymentIntents, subscriptions/billing, Connect, webhooks) via the orchestrator loop, with a mandatory REVIEW pass before it's considered done. **REVIEW** is a Stripe-scoped correctness + security audit (a blend of security + review discipline) that maps pathways, runs deterministic scanners, audits against the correctness and security checklists, red-teams with test-mode PoCs, fixes, and re-verifies.

**Artifacts.** [`PROJECT.md`](#artifacts-glossary) (stack/decisions, Stripe pathway inventory, per-checklist-item coverage ledger, findings register with CWE); `SECURITY.md#Findings` (mirrored REVIEW findings, only if a later security resume is expected); git commits on the work branch (one per verified fix; payment changes never auto-merged); a final report (findings register, fixed vs proposed, residual risk, any live key flagged for rotation, and stated limitations).

### dev-team-ship

**Purpose.** Take a repo that **works** to a repo that **ships** — stand up or audit CI (tests/lint/build green on every PR), secret scanning (the free gitleaks CLI, never the paid gitleaks-action), branch protection/rulesets with correctly-named required checks, and a release/versioning flow.

**When to use.** When the user wants to "set up CI", "add branch protection", "wire up secret scanning", "cut a release", "stop force-pushes to main", or "make this repo ready to ship". Not to build product features (use the orchestrator/iterate) or audit the application's own security (use [dev-team-security](#dev-team-security)) — this skill is scoped to the delivery pipeline.

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `mode=setup\|audit\|auto` | `auto` (infer from what already exists) | Pick the mode. |
| `targets=ci,branch-protection,secret-scanning,release\|all` | `all` | Narrow the run to specific lanes. |
| `fix=auto\|propose-only` | auto for additive changes | Apply safe additive fixes automatically, or only report. Anything that loosens/removes an existing required check is **always** propose, regardless of this flag. |
| `branch=<name>` | `ship/<date>` (suffix `-2` on collision) | Override the default branch name. |

**Modes.** **setup** (build the pipeline from scratch) | **audit** (check an existing pipeline against the four hard-won CI/CD rules and fix what's broken without silently loosening protection). `mode=auto` infers which to run; if genuinely mixed, it runs setup for the missing lanes and audit for the existing ones.

**Artifacts.** `PROJECT.md` (records the pipeline that now exists — Current status + a decision-log entry for any real tradeoff); `.github/workflows/*` CI workflow(s) with deliberate, stable job `name:` fields; a gitleaks CLI secret-scanning step (never `gitleaks/gitleaks-action@v2`); branch protection rules and/or rulesets with required-check names matching the job `name:` fields byte-for-byte; a release/versioning flow (automated tag-on-version-bump with a `GITHUB_TOKEN` anti-recursion bridge, or a documented manual runbook); a `ship/<date>` branch handed back for review (never pushed straight to main); exact GitHub web-UI steps for any secret the pipeline needs (never set by the skill itself).

### dev-team-autopilot

**Purpose.** Drive a product all the way to **production-ready** and as **feature-complete** as its scope allows, autonomously, by conducting the whole dev-team suite through a long-running self-paced loop. **Fire it via `/loop`:** `/loop dev-team-autopilot <mission>`.

**When to use.** When the user wants to "get this to production", "make it production-ready", "ship this", "take this all the way", "autonomously improve and complete this product", run the dev-team "on autopilot", or fire a run via `/loop`. Not for one-file scripts, a single quick fix, questions, or a single-purpose ask (prefer the focused sibling skill).

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `mission=<text>` | inferred at bootstrap, confirmed with the user | What production-ready means for this product; refines the done checklist. |
| `cap=N` | ~30 | Convergence backstop: max cycles before the loop stops honestly if it can't reach done. Not cost control — the plan's token allowance is the real ceiling. |
| `models=economy\|balanced\|max` | `balanced` | Cost posture biasing which tier does build work; verification always stays frontier (see [model-routing.md][model-routing]). |
| `budget-autotighten=on\|off` | `on` | Step the posture down one when frontier spend runs heavy; never downgrades verification. |
| `budget-threshold=N` | ~6 | Frontier spawns-per-cycle before "heavy". |
| `gates=hybrid\|pause-all\|autonomy-envelope` | `hybrid` | Gate policy. hybrid runs the feature autonomy test (build obvious in-scope features, ask on the doubtful); pause-all asks before any feature; autonomy-envelope widens what auto-builds via a scope you pre-grant, pausing only on destructive/irreversible ops. |
| `feature-completeness=in-scope\|core-only\|off` | `in-scope` | How far to push features. core-only builds only table-stakes; off skips the COMPLETE phase (production-readiness only). |
| `phases=<subset>` | full default phase plan runs if omitted | Restrict the mission (e.g. `phases=stabilize,secure,verify` to harden without feature work). |
| `delay=<seconds>` | ~90; clamped to the loop's bounds | Wakeup pacing between cycles. |
| `branch=<name>` | `autopilot/<date>` | Run branch. |

**Modes / phases.** Six phases sequence the mission — DISCOVER → STABILIZE → SECURE → COMPLETE → POLISH → VERIFY — each driven by one sibling-skill "mode" run for exactly one cycle: discovery ([featurefind](#dev-team-featurefind)), iterate ([iterate](#dev-team-iterate)), security Phase 0 + purple-team ([security](#dev-team-security)), feature build ([orchestrator](#dev-team-orchestrator), approved specs only), verify ([review](#dev-team-review), report-only). Separately, `gates=hybrid\|pause-all\|autonomy-envelope` is a mode switch controlling how much feature work auto-builds vs. is queued for approval.

**Artifacts.** [`.dev-team/autopilot.json`](#artifacts-glossary) (machine-authoritative run state, plus `.dev-team/loop.lock`), and all the suite's ledgers: `PROJECT.md`, `FEATURES.md`, `SECURITY.md`, `VERIFICATION.md`, `verdict.json`.

### dev-team-ci-medic

**Purpose.** Watch a repo's open PRs for failing CI checks and resolve them safely, classifying every failure as **SAFE-AUTO** (auto-fixed, checker-verified, and pushed), **FLAKY** (rerun and re-evaluated), **REAL** (diagnosed and proposed, never made to pass by editing the test), or **BLOCKED** (reported, not fixed). See [PR monitoring](#pr-monitoring-ci-medic).

**When to use.** When the user wants to "watch my PRs", "fix CI failures", "monitor checks", "ci medic", "auto-fix PR checks", or keep a PR green while they step away. Not to build features or stand up the pipeline itself (use [dev-team-ship](#dev-team-ship)) — this skill only reacts to CI failures already happening on open PRs.

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `pr=<n>` | all open PRs of the current repo | Narrow the run to a single PR number (also the per-PR opt-in for a PR you don't own). |
| `autofix=safe\|off` | `safe` | safe: auto-resolve SAFE-AUTO + rerun FLAKY + propose REAL + report BLOCKED. off: monitor and report/propose only, touch nothing. |
| `interval=<duration>` | — | Only meaningful when fired via `/loop <interval> /dev-team-watch-prs`; how often the watch pass repeats. Not a ci-medic argument itself. |
| `repo=<current>` | `current` | Scope is always the current repo's PRs; this argument makes that explicit in a brief or scheduled routine. |

**Modes.** Two postures via the autofix gate (`safe` default, `off` triage-only). Four failure classes (SAFE-AUTO, FLAKY, REAL, BLOCKED) drive per-check handling. Three invocation modes: interactive, [`/dev-team-watch-prs`](#commands) single pass, `/loop <interval> /dev-team-watch-prs` repeated pass, or a scheduled cloud routine via `/schedule`.

**Artifacts.** No new required artifact — it reuses orchestrator machinery. If the repo already keeps a `PROJECT.md`, the documentarian appends a short run summary to its Current status; otherwise the summary is just reported. Fix commits are pushed to the PR's own head branch (never main), with messages of the form `ci-medic: fix <check> — <what changed>` carrying the checker's passing-output evidence.

---

## Commands

| Command | Args | Purpose |
|---|---|---|
| [`/dev-team`][cmd-dev-team] | `[what you want to do]` | Entry-point router: interprets free text and launches the right skill/command (or asks one clarifying question). |
| [`/dev-team-status`][cmd-status] | — | Read-only dashboard: mission, phase, next action, gate ledger, budget — reads state files, changes nothing. |
| [`/dev-team-approve`][cmd-approve] | `<gate-id> [approve\|reject] [notes]` | Approve or reject a deferred gate-ledger item in `.dev-team/autopilot.json` so the next autopilot iteration builds or skips it. |
| [`/dev-team-sync-branches`][cmd-sync] | `--apply`, `--no-fetch` | Safely align local branches with GitHub remotes (see [Branch hygiene](#branch-hygiene)). |
| [`/dev-team-update`][cmd-update] | — | Check for a newer plugin version and show the exact update commands to run yourself. |
| [`/dev-team-watch-prs`][cmd-watch] | `pr=<n>`, `autofix=safe\|off` | One CI-medic pass over open PRs (see [PR monitoring](#pr-monitoring-ci-medic)); loopable for recurring watch. |

**Detail worth knowing:**

- **`/dev-team-approve`** — `<gate-id>` is the queued item's id (e.g. `G-003`); `approve` marks it built next iteration, `reject` marks it skipped. Add `[notes]` (free text) — especially useful on a reject.
- **`/dev-team-sync-branches`** — without `--apply` it only detects and reports, then stops for confirmation. `--no-fetch` skips the pre-detection `git fetch --prune`.
- **`/dev-team-watch-prs`** — `pr=<n>` also serves as the explicit per-PR opt-in required to touch a PR **not authored by the current user**. `autofix=safe` (default) fixes+verifies+pushes SAFE-AUTO and reruns flaky checks; `autofix=off` only monitors/reports/proposes.

---

## Model routing & tiers

The suite routes each kind of work to a named agent/tier. Source of truth: [model-routing.md][model-routing]; the optional taste profile is in [orchestration-profiles.md][orchestration-profiles].

| Tier | Agent | Alias | Used for |
|---|---|---|---|
| Reasoning | [`deep-architect`][deep-architect] | fable | Architecture, subtle multi-file bugs, algorithm design, concurrency/data-model trade-offs, big cross-cutting refactors, debate advocates — the genuinely hard stuff. Also the recommended taste-first orchestrator tier. |
| Build / Verify | [`opus-builder`][opus-builder] | opus | Building features, scouting, and **all** verification (checker, red-team, validator, reviewer) — the default worker. |
| Scribe | [`sonnet-scribe`][sonnet-scribe] | sonnet | Documentarian: `PROJECT.md` / `FEATURES.md` / `SECURITY.md` / `VERIFICATION.md` upkeep, ledgers, run records, `HANDOFF.md`, `autopilot.json` budget bookkeeping. |
| Mechanical | [`quick-edits`][quick-edits] | haiku | Renames, formatting, import sorting, docstrings, boilerplate, trivial config. Start of the escalation chain. |
| Economy Build (cost-posture add-on) | [`sonnet-builder`][sonnet-builder] | sonnet | The `economy` posture's build/scout endpoint — substitutes for `opus-builder` on **build work only**; never used for verification. |

**Two invariants:**

1. **Verification stays frontier.** Checker / red-team / validator / reviewer are **never** routed cheaper than the Opus build/verify tier, in any cost posture (Invariant 1). It never auto-tightens under `max`.
2. **Plan expensive, execute cheap.** The taste-first idea: put the smartest/highest-taste model in the orchestrator seat (plan, briefs, decisions, UI/UX/API/copy calls, reviews) and route token-hungry low-taste grunt work to the cheapest capable executor.

### Cost posture

`models=economy|balanced|max` is an optional run-level knob (or plain language, e.g. "keep costs down" → economy) on any skill that takes arguments; default `balanced`. Per-work remap:

- **Build/scout** → `opus-builder` in balanced & max; `sonnet-builder` in economy.
- **Hard reasoning/debate** → `deep-architect` (Fable) in balanced & max (used liberally in max); `opus-builder` (Opus) in economy.
- **Verification** → `opus-builder` (Opus) in **every** posture, no exceptions.
- **Docs/state** → `sonnet-scribe` everywhere; **mechanical** → `quick-edits` everywhere.
- `max` never economizes and never auto-tightens.

**Autopilot budget auto-tighten** (autopilot only; see [loop-runtime.md][loop-runtime]): the `autopilot.json` `budget` block tracks per-tier spawn counts and cycles — a spawn-count trend, not a real spend figure. When frontier (Fable+Opus) spawns/cycle sustainedly exceed `threshold_per_cycle` (~6), `spend_posture` flips to `heavy`; if `budget-autotighten=on` (default) and posture is above economy, the loop steps posture **down one notch** (max → balanced → economy) for **build work only**, and surfaces it in the iteration report (e.g. "budget: auto-tightened balanced→economy at cycle 14"). It never touches verification. Disable with `budget-autotighten=off`. Always shown via [`/dev-team-status`](#commands); rolled into `HANDOFF.md` as a one-glance resume card.

### Taste-first orchestration profile (optional)

An optional profile layered on top of routing ([orchestration-profiles.md][orchestration-profiles]). The highest-taste model runs the **session/orchestrator**; bulk/mechanical work goes to the cheapest capable executor. Because the plugin can't set the session model itself, set it yourself: `/model fable` (or settings `{"model":"fable"}`). Rules in brief: the orchestrator is the top-taste tier; anything user-facing (UI, copy, API design, error messages) stays on a Claude taste tier; **verification stays frontier**; cost is only a tie-breaker (intelligence > taste > cost for anything that ships); escalate freely.

**Optional GPT-5.5 / Codex offload.** With the `openai/codex-plugin-cc` plugin and the `codex` CLI on PATH, token-hungry clear-spec work — implementation, multi-file refactors, migrations, data analysis, bulk codebase reading — can be routed to GPT-5.5/Codex via the plugin's native commands (`/codex:rescue`, `/codex:review`, `/codex:adversarial-review`, `/codex:status`/`/codex:result`/`/codex:cancel`) to keep delegation observable. Detection-first and fail-silent: if Codex is absent, it falls back to Sonnet/Haiku. Codex may **add** an adversarial perspective but **never replaces** the Claude verifier; all primary verification and user-facing work stay on Claude.

### Escalation

Start a mechanical-looking workstream on `quick-edits` (Haiku); on a genuine **capability** failure (not a bad-brief failure), escalate one tier at a time — **Haiku → Sonnet → Opus → Fable**. The two-strike rule applies: strike one may be a bad brief (re-brief, same tier); a second, capability-bound failure escalates the tier. Never escalate verification below Opus. "Judge the output, not the price tag" — tiers are defaults, not limits.

---

## Artifacts glossary

Every file the suite reads/writes. All ledgers are owned by the `sonnet-scribe` documentarian.

| File | Written by | Purpose |
|---|---|---|
| `PROJECT.md` | `sonnet-scribe` (orchestrator / iterate / security / stripe) | Human-readable source of truth: Goal, Definition of done, Constraints, Skills in play, House style, Stage plan, Current status (always overwritten for cheap cold-resume), Decision log, Checkpoint log, Feature Specs. iterate adds Codebase Map, Run record, Backlog, Proposed-Features ledger, Trajectory ledger. Read by every skill. Schema: [documentarian-protocol.md][documentarian-protocol] (+ [audit-and-backlog-protocol.md][audit-backlog] for iterate). |
| `FEATURES.md` | `sonnet-scribe` (via featurefind) | Scored feature-gap ledger (`FG-` items, citation per claimed competitor feature). Read by iterate and autopilot. Schema: [gap-scoring-rubric.md][gap-rubric]. |
| `SECURITY.md` | `sonnet-scribe` (via security) | Findings (`F-` items under `#Findings`) and the remediation record from the adversarial audit. Read by review, autopilot, and a later security resume. Schema: [threat-model-and-surface-protocol.md][threat-model]. |
| `VERIFICATION.md` + `verdict.json` | `sonnet-scribe` (via review) | Independent QA/verification evidence and verdicts (`V-` items); `verdict.json` is machine-readable for CI gating. Read by the user and autopilot's VERIFY phase. Schema: [verdict-and-report-protocol.md][verdict-protocol]. |
| `.dev-team/autopilot.json` | autopilot conductor (fields updated by `sonnet-scribe` each RECORD step) | Machine-authoritative run state (read first every iteration, rewritten last): mission/done, plan/phase cursor, state, next action, gate ledger (`G-` items), blocked, cycle/cap, verify, budget block, lock, branch, last commit, trajectory ref. Schema: [loop-runtime.md][loop-runtime]. |
| `HANDOFF.md` | `sonnet-scribe` (all modes) | Derived, always-regenerated one-glance resume card built from `PROJECT.md#Current status`. A convenience surface, never itself a source of truth. Schema: [handoff-template.md][handoff-template]. |

---

## Hooks & environment switches

Plugin hooks **auto-activate on install**. All are **fail-open** (any error silently allows/exits) and **scoped** — they do the minimum and never block your session.

| Hook | Event | Purpose | Disable with |
|---|---|---|---|
| [`hooks/check-update.sh`][check-update] | SessionStart | Layer-2 fallback update notifier: at most once per 24h, compares local vs. remote `plugin.json` and prints a one-line update notice if newer. Never updates anything; fails open/silent on missing `gh`/`jq` or network error. | `DEV_TEAM_NO_UPDATE_CHECK` |
| [`hooks/guard-dev-team.sh`][guard] | PreToolUse (Bash) | Best-effort safety net (one layer, never the guarantee). Blocks exactly three unrecoverable Bash actions while a run is active: `git push` to main/master, force-push to main/master, and any live Stripe key pattern (`sk_live_`/`rk_live_`/`pk_live_` — dev-team is test-mode only). Any parse error or no active run → silently allows. | Only engages when `.dev-team/autopilot.json` exists **or** `DEV_TEAM_GUARD` is set; to disable while it would fire, unset `DEV_TEAM_GUARD` and/or remove `.dev-team/autopilot.json`. |
| [`hooks/sync-branches-check.sh`][sync-check] | SessionStart | Network-free, read-only notifier: counts local branches whose upstream shows `gone` and, if >0, points to `/dev-team-sync-branches`. Deletes nothing, makes no network calls, silent when nothing to report. | `DEV_TEAM_NO_BRANCH_CHECK` |

**All environment variables / switches:**

| Variable | Effect | Default (unset) |
|---|---|---|
| `DEV_TEAM_NO_UPDATE_CHECK` | Off-switch for the SessionStart update notifier — set to any non-empty value and it exits before doing anything. | Update check runs, throttled to ≤ once/24h; fails open/silent if `gh`/`jq` missing or network fails. |
| `DEV_TEAM_NO_BRANCH_CHECK` | Off-switch for the SessionStart branch-hygiene notice — set to any non-empty value to suppress it entirely. | Check runs every SessionStart; network-free and silent when the "gone" count is 0. |
| `DEV_TEAM_GUARD` | **Force-ON** switch (not an off-switch) for the Bash guard — makes it check every Bash command regardless of whether a run is active. | Guard scope limited to an active run (`.dev-team/autopilot.json` present). |
| `DISABLE_AUTOUPDATER` | Global Claude Code var: turns off Claude Code's own auto-update entirely, including marketplace-level plugin auto-update (the plugin's Layer-1 update path). | Claude Code auto-update (and marketplace auto-update, if enabled) behaves normally. |
| `FORCE_AUTOUPDATE_PLUGINS` | Global Claude Code var: keeps plugin auto-updates running even if `DISABLE_AUTOUPDATER` has otherwise turned off Claude Code's auto-update. | Unset. |

(Two harness-provided variables, `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`, are set by Claude Code at runtime — not user-configured — and locate the plugin root and the writable per-plugin data dir the update hook uses for its throttle stamp.)

---

## Branch hygiene

Over time, local branches accumulate whose remote was deleted after a merge. [`/dev-team-sync-branches`][cmd-sync] cleans them up **safely**, backed by [`scripts/branch-hygiene.sh`][branch-hygiene] (read-only, network-light):

1. Resolves the default branch (origin/HEAD, else main/master).
2. Runs `git fetch --prune` (skip with `--no-fetch`).
3. Buckets every local branch (except the default, the current branch, and any worktree-checked-out branch) into:
   - **merged-safe-to-delete** — upstream gone **and** an ancestor of default → `git branch -d` is safe.
   - **gone-upstream-verify-pr** — upstream gone but **not** an ancestor (squash/rebase-merge or genuinely unmerged) → you must confirm the PR was merged via `gh` before any force-delete.
   - **skipped** — branches with a live upstream or no upstream are left alone.

The command deletes nothing without `--apply` (it prints the plan and stops for confirmation). The SessionStart [notifier][sync-check] surfaces the count of `gone`-upstream branches. Recommendation: enable `git config fetch.prune true` so remote-tracking refs stay current for the notifier.

---

## PR monitoring (CI medic)

[`/dev-team-watch-prs`][cmd-watch] runs one [dev-team-ci-medic](#dev-team-ci-medic) pass over the current repo's open PRs, classifying each failing check and handling it per the **autofix gate**:

| Class | Handling under `autofix=safe` |
|---|---|
| **SAFE-AUTO** | Auto-fixed, checker-verified, and pushed to the PR's own head branch. |
| **FLAKY** | Rerun and re-evaluated. |
| **REAL** | Diagnosed and **proposed** — never made to pass by editing the test; built only on user confirmation or a gated remediation cycle. |
| **BLOCKED** | Reported, not fixed. |

**Safety rules:**

- **Never game the tests** — REAL failures are proposed, not silenced by editing the assertion.
- **PR-branch-only** — fix commits go to the PR's own head branch, never `main`.
- **Only PRs you own** — a PR you didn't author requires the explicit `pr=<n>` per-PR opt-in.
- **`GITHUB_TOKEN` anti-recursion trap** — pushes made with the default `GITHUB_TOKEN` don't re-trigger downstream workflows; keep this in mind when a fix should re-fire CI.

`autofix=off` makes it a pure triage pass (monitor/classify/report/propose only, nothing modified or pushed). For recurring watch, fire it via `/loop <interval> /dev-team-watch-prs`, or as a scheduled cloud routine via `/schedule`.

---

## Repo self-audit / CI

The plugin guards its own integrity in CI. [`.github/workflows/plugin-audit.yml`][plugin-audit] (workflow name `plugin-audit`) triggers on every `pull_request` and on `push` to `main`. It has one job — id `audit`, `name: audit` — that checks out, installs `jq`, and runs [`scripts/audit-model-ids.sh`][audit-script].

> **Required-check name:** the job's `name:` field is the literal string **`audit`** — that byte-for-byte string (not the "plugin-audit / audit" UI form) is what you register as a required check in branch protection / rulesets.

The audit script performs four checks and exits non-zero (`AUDIT FAIL: <reason>`) on any failure, or prints `AUDIT OK`:

1. No dated model id appears in any `.md`/`.json`/`.yml`/`.yaml` file **except** [model-routing.md][model-routing] (prevents model-id drift/rot).
2. Both `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` parse as valid JSON.
3. Each of the five endpoint agent files ([`deep-architect`][deep-architect], [`opus-builder`][opus-builder], [`sonnet-scribe`][sonnet-scribe], [`quick-edits`][quick-edits], [`sonnet-builder`][sonnet-builder]) exists **and** carries a `model:` frontmatter line.
4. No `.claude/agents/` directory exists (plugin agents must live under `agents/` at the plugin root, or installers won't receive them).

---

## Privacy

- The plugin ships from a **private org marketplace** (MWBMPartners); it is not published to any public registry.
- **Keep secrets out of skill files.** The suite is designed never to embed credentials: it operates in Stripe **test mode** by default, hands you exact GitHub web-UI steps for any secret the pipeline needs (rather than setting secrets itself), and the Bash guard blocks live Stripe key patterns during a run. When a secret is required, set it yourself via the GitHub web UI; don't paste credentials into `PROJECT.md`, briefs, or any committed file.

---

<!-- link references -->
[check-update]: hooks/check-update.sh
[guard]: hooks/guard-dev-team.sh
[sync-check]: hooks/sync-branches-check.sh
[model-routing]: skills/dev-team-orchestrator/references/model-routing.md
[orchestration-profiles]: skills/dev-team-orchestrator/references/orchestration-profiles.md
[documentarian-protocol]: skills/dev-team-orchestrator/references/documentarian-protocol.md
[handoff-template]: skills/dev-team-orchestrator/references/handoff-template.md
[audit-backlog]: skills/dev-team-iterate/references/audit-and-backlog-protocol.md
[gap-rubric]: skills/dev-team-featurefind/references/gap-scoring-rubric.md
[threat-model]: skills/dev-team-security/references/threat-model-and-surface-protocol.md
[verdict-protocol]: skills/dev-team-review/references/verdict-and-report-protocol.md
[loop-runtime]: skills/dev-team-autopilot/references/loop-runtime.md
[deep-architect]: agents/deep-architect.md
[opus-builder]: agents/opus-builder.md
[sonnet-scribe]: agents/sonnet-scribe.md
[quick-edits]: agents/quick-edits.md
[sonnet-builder]: agents/sonnet-builder.md
[plugin-audit]: .github/workflows/plugin-audit.yml
[audit-script]: scripts/audit-model-ids.sh
[branch-hygiene]: scripts/branch-hygiene.sh
[cmd-dev-team]: commands/dev-team.md
[cmd-status]: commands/dev-team-status.md
[cmd-approve]: commands/dev-team-approve.md
[cmd-sync]: commands/dev-team-sync-branches.md
[cmd-update]: commands/dev-team-update.md
[cmd-watch]: commands/dev-team-watch-prs.md

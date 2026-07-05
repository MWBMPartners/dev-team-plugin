# dev-team

**Version 1.2.0.**

A Claude Code plugin that lets you run software work as a **team lead / product owner** instead of coding alone: you delegate every piece of implementation to a tiered team of Claude subagents (a frontier reasoner, an Opus builder/verifier, a Sonnet documentarian, a Haiku mechanic) through a stage-by-stage *delegate → check → checkpoint* loop. **Eleven skills** cover the whole lifecycle — building, iterating, migrating, security, verification, competitive feature discovery, Stripe, shipping/CI, PR CI-medic, and documentation — plus an autopilot conductor that drives them all to production autonomously. An optional **taste-first** profile can put the highest-taste model in the orchestrator seat and offload token-hungry bulk work to GPT-5.5/Codex.

Cross-cutting since 1.2.0 (see [Configuration & feature toggles](#configuration--feature-toggles) and [Cross-cutting behaviors](#cross-cutting-behaviors)): an optional, repo-scoped `.dev-team/config.yml` sets the suite's run defaults and feature toggles for every session and collaborator; every building skill supports a `dry-run` plan-preview and a generalized cold-resume; and runs surface an end-of-run [telemetry report](#run-reports--cost) (a rough, explicitly-not-a-bill cost estimate) plus autopilot gate/blocked/done notifications.

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

## Using in Claude Code — CLI and IDEs (VSCode)

Plugins install **once, at the user level** — the `/plugin marketplace add` + `/plugin install` commands above — and are then available across **every Claude Code surface**: the terminal CLI (`claude`), the **VSCode extension**, JetBrains, and the desktop/web app. You do not reinstall per IDE.

- **Invoking a skill.** In any surface, either describe the task in plain language (skills auto-activate off their descriptions — see [Which skill when](#which-skill-when)) or go through the [`/dev-team`](#commands) router. Slash commands (`/dev-team-status`, `/dev-team-config`, `/dev-team-report`, `/dev-team-watch-prs`, …) are typed straight into the chat input, the same way in every surface.
- **VSCode specifics.** Install the "Claude Code" VSCode extension and open its panel — the plugin's skills, commands, and hooks behave identically to the CLI. IDE conveniences (current-selection context, inline diffs, the editor's own view of file changes) are additive on top; skill behavior itself doesn't change.
- **Hooks run wherever Claude Code executes tools** — tied to the session, not to which UI is driving it — so the [update notifier, branch-hygiene notice, and Bash guard](#hooks--environment-switches) apply the same in the CLI and in an IDE.
- **`.dev-team/config.yml` is per-project and committed** (see [Configuration & feature toggles](#configuration--feature-toggles)) — it applies whenever Claude Code is opened on that repo, in **any** surface, not just the one that created it. A long autopilot run fired via `/loop` works the same in CLI and IDE sessions, and its [notifications](#cross-cutting-behaviors) surface at the start of each session either way.
- **Updating from within an IDE** follows the same layered story as the CLI — marketplace auto-update, the `hooks/check-update.sh` SessionStart fallback, or `/dev-team-update` — see [Updating](#updating) above; nothing about it is IDE-specific.

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
| Generate/maintain/audit a codebase's docs — verified against source, never invented | [dev-team-docs](#dev-team-docs) | Accuracy over volume; every claim traced to `file:line`, examples actually run. |
| Safely migrate a framework/language/dependency major, schema, or API — staged, reversible | [dev-team-migrate](#dev-team-migrate) | Characterization-test net before anything moves; Migration Plan Gate; no big-bang by default. |

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
| `dry-run=on\|off` | `off` | Produce the full stage/workstream plan and the briefs it WOULD issue, spawn no builders, and make no file or git changes; stop after planning and report the plan for approval. Also settable via plain language ("just show me the plan"). See [Cross-cutting behaviors](#cross-cutting-behaviors). |

**Modes.** None — no `mode=` subcommands. It runs one loop: UNDERSTAND → SCOPE INTO STAGES → [per stage: PLAN → DELEGATE → CHECK → CHECKPOINT → DECIDE] → VERIFY → done. It offers an optional *taste-first* orchestration profile (see [orchestration-profiles.md][orchestration-profiles]) and three lead-chosen check-in policies (Autonomous / Milestone check-ins / Decision check-ins) — judgment calls, not invocation flags. **Cold-resumes** from a prior run's `PROJECT.md` (Current status + decision log) when it's still current, instead of restarting from scratch — see [Cross-cutting behaviors](#cross-cutting-behaviors).

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
| `dry-run=on\|off` | `off` | Run Phase 0 (resume/scout, purpose, scored backlog) and write the cycle plan it WOULD run, but delegate no builders and make no file or git changes; report the plan for approval. See [Cross-cutting behaviors](#cross-cutting-behaviors). |

**Cold-resume.** Phase 0 looks for a `PROJECT.md` with a Codebase Map + run record from a prior run; if it validates as current, it reuses it as context and delta-scouts only what changed, instead of re-gathering the whole codebase — see [Cross-cutting behaviors](#cross-cutting-behaviors).

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
| `dry-run=on\|off` | `off` | Run Phase 0 (threat model, attack-surface map, coverage ledger) and write the briefs each red/blue-team wave WOULD receive, but spawn no red-team/validator/builder agents and make no file or git changes; stop after planning and report the plan. See [Cross-cutting behaviors](#cross-cutting-behaviors). |

**Modes.** No `mode=` argument; the mode-like toggles are `fix=auto\|propose-only` and the `report-only` flag. **Cold-resumes** from a current `SECURITY.md` (coverage ledger + findings register) when one exists, picking up only what's still untested/unresolved rather than re-running the full sweep — see [Cross-cutting behaviors](#cross-cutting-behaviors).

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

**Modes.** No user-facing mode switch, but two contexts: (1) **standalone** — full pipeline including the default-on fix phase; (2) invoked by [dev-team-autopilot](#dev-team-autopilot) as its VERIFY mode — effectively forced `remediate=report`: produces verdicts + `VERIFICATION.md` + `verdict.json` only, never enters the fix phase, creates no branch, and hands FAILED/DRIFTED/HOLLOW verdicts back to the conductor. No `dry-run` argument — this skill is already read-only up to the fix phase. **Cold-resumes** from an interrupted prior `VERIFICATION.md` pass (re-verifies only the outstanding claim-groups) — see [Cross-cutting behaviors](#cross-cutting-behaviors).

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
| `dry-run=on\|off` | `off` | Produce the full plan and stop, spawning no builders/red-team agents and making no file or git changes (BUILD: the stage/workstream plan + builder briefs; REVIEW: the pathway map + audit/red-team briefs); report the plan for approval. See [Cross-cutting behaviors](#cross-cutting-behaviors). |
| `surface=checkout\|payment-element\|payment-intents\|billing\|connect\|webhooks\|ios-native\|android-native\|auto` | `auto` (detect from repo) | The Stripe surface in scope. |
| `severity-floor=critical\|high\|medium\|low` | `high` | (review) lowest severity to fix this run. |
| `live=confirm` | absent → test mode only | Explicit, one-time acknowledgement required before **any** live-mode action. |
| `branch=<name>` | `stripe/<date>` | Work branch. |

**Modes.** `mode=build\|review`. **BUILD** implements payment flows (Checkout, Payment Element, PaymentIntents, subscriptions/billing, Connect, webhooks) via the orchestrator loop, with a mandatory REVIEW pass before it's considered done. **REVIEW** is a Stripe-scoped correctness + security audit (a blend of security + review discipline) that maps pathways, runs deterministic scanners, audits against the correctness and security checklists, red-teams with test-mode PoCs, fixes, and re-verifies. Reuses the orchestrator's machinery wholesale, including **cold-resume** from a prior run's `PROJECT.md` — see [Cross-cutting behaviors](#cross-cutting-behaviors).

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
| `dry-run=on\|off` | `off` | Produce the full pipeline inventory/plan and the builder briefs it WOULD issue (workflow/config changes, branch-protection/ruleset updates, release-flow wiring), then stop — spawn no builders, make no file, git, GitHub-config, or branch-protection changes; report the plan for approval. See [Cross-cutting behaviors](#cross-cutting-behaviors). |
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

### dev-team-docs

**Purpose.** Systematically generate **and** maintain a codebase's documentation — README, CHANGELOG, API/reference docs, docstrings/inline comments, usage guides, and architecture/onboarding docs — as a documentarian-drafted, checker-verified pipeline where **every claim is traced back to real source (`file:line`) before it ships**. This is the documentation variant of [dev-team-orchestrator](#dev-team-orchestrator): it reuses that skill's machinery wholesale (team model, brief format, checker pattern, documentarian) and adds one hard rule literally: a documented claim with no traced source isn't a documented claim, it's a guess.

**When to use.** When the user wants to "write/update the docs", "generate API docs", "document this codebase", "keep the README current", "add docstrings", "update the CHANGELOG", or produce an "onboarding/architecture doc". Not to build product features (use [dev-team-orchestrator](#dev-team-orchestrator)/[dev-team-iterate](#dev-team-iterate)), for a competitive/what's-missing feature analysis (use [dev-team-featurefind](#dev-team-featurefind)), or to just answer a one-off question about the code.

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `mode=generate\|maintain\|audit` | infer from what already exists | Write from scratch, update to match current code, or produce a read-only drift report. |
| `scope=readme\|api\|reference\|docstrings\|changelog\|guides\|architecture\|all` | `all` | Which doc area(s) to work on; accepts a comma list (e.g. `scope=readme,changelog`). |
| `dry-run=on\|off` | `off` | Produce the full doc-area plan and the drafter/checker briefs it WOULD issue, but spawn no drafters or checkers and make no file or git changes; report the plan for approval. Not meaningful for `mode=audit` (already read-only). See [Cross-cutting behaviors](#cross-cutting-behaviors). |
| `models=economy\|balanced\|max` | `balanced` | Cost posture for the **scout** tier only (`opus-builder` vs. `sonnet-builder`); drafting stays `sonnet-scribe` and verification stays `opus-builder` regardless of posture (Invariant 1). |
| `issues=off\|sync` | `off` | Export `audit` mode's drift findings (or an unresolved NEEDS-LEAD-REVIEW item from `generate`/`maintain`) to GitHub Issues, dedup-safe and confirm-first. |
| `branch=<name>` | `docs/<date>` | Override the default branch name. |

**Modes.** **generate** (no docs exist yet for the scope — write from scratch) | **maintain** (docs exist but the code moved — delta-scout what changed, draft only what drifted, but the checker re-verifies the *whole* doc-area) | **audit** (read-only: find and report doc drift/staleness by severity, no draft/fix/commit — a good cheap first look before committing to `maintain`). **Cold-resumes**: since this skill owns no dedicated ledger, it checks `PROJECT.md`'s Current status/decision log (if present) for a prior docs-pass record and `git diff`s since that commit to decide resume-vs-rescout — see [Cross-cutting behaviors](#cross-cutting-behaviors).

**Artifacts.** No new ledger file — writes the actual documentation files in scope (README, CHANGELOG, docstrings, guides, architecture docs, etc.), one commit per doc-area on a `docs/<date>` branch (never merged to `main` by the skill itself); `audit` mode makes no commits at all. If `PROJECT.md` exists, the documentarian records the result (counts by severity, headline findings) in its Current status.

### dev-team-migrate

**Purpose.** Run safe, **large-scale migrations** — framework/language/dependency major upgrades, schema migrations, API/interface ports — as a team lead who pins current behavior with a characterization-test net **before** touching anything, then moves in a staged, reversible cutover: one coherent slice per commit, every stage independently green (its own criteria plus the full characterization net) and independently revertible, no big-bang by default. This is the migration variant of [dev-team-orchestrator](#dev-team-orchestrator), reusing its machinery wholesale.

**When to use.** When the user wants to "migrate from X to Y", "upgrade to `<major version>`", "port to `<framework>`", "React 17→18", "Python 2→3", "migrate the database schema", "swap `<libA>` for `<libB>`", or mentions "migration", "cutover", "expand-contract", or "big rewrite". Not for a normal feature build (use [dev-team-orchestrator](#dev-team-orchestrator)), general cleanup/polish with no migration target (use [dev-team-iterate](#dev-team-iterate)), or Stripe-specific work (use [dev-team-stripe](#dev-team-stripe)).

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `mode=plan\|execute` | infer: no valid approved plan yet → `plan`; a valid approved plan exists and the ask is "go ahead" → `execute` | Pick the mode. |
| `from=<x>` / `to=<y>` | — | The current state / target state being migrated (framework, language, version, schema, library). |
| `strategy=incremental\|parallel-run\|big-bang` | `incremental` | The cutover strategy. `big-bang` is strongly discouraged and only ever runs after the Migration Plan Gate surfaces its risk explicitly and the user signs off — never the default, never silently accepted. |
| `dry-run=on\|off` | `off` | Inside `execute` mode, produce the per-stage builder briefs it WOULD issue for the (already-approved) stages, spawn no builders, and make no file or git changes; report the plan for approval. `mode=plan` already stops for approval by design — this is not a substitute for the Migration Plan Gate. See [Cross-cutting behaviors](#cross-cutting-behaviors). |
| `models=economy\|balanced\|max` | `balanced` | Cost posture biasing which tier does build/scout work; verification always stays frontier. |
| `issues=off\|sync` | `off` | Export this run's open Stage Ledger follow-ups (a deferred stage, a risk flagged for sign-off, a proposed-not-auto-taken strategy call) to GitHub Issues, dedup-safe and confirm-first. |
| `cap=N` | the approved plan's full stage count | Safety backstop: max stages to execute in this invocation before stopping to checkpoint and report; not a substitute for finishing the approved plan across multiple invocations. |
| `branch=<name>` | `migrate/<date>` | Override the default branch name. |

**Modes.** **plan** (scout the migration surface, map dependency order, choose a strategy, define the staged cutover plan with risk sizing, and **stop** for the Migration Plan Gate — the user's explicit approval; a hard, one-time gate, distinct from `dry-run`) | **execute** (requires an approved plan; runs the characterization-net gate as Stage 0, then migrates stage-by-stage — verify against both the stage's own criteria *and* the full characterization net, commit, update the Stage Ledger — with compatibility shims tracked to the later stage that removes them, ending in a mandatory final cutover + cleanup stage). **Cold-resumes** from a prior run's `MIGRATION.md` (Migration Plan + Stage Ledger) when it validates as still current, the same way `dev-team-iterate` validates its Codebase Map — see [Cross-cutting behaviors](#cross-cutting-behaviors).

**Artifacts.** `MIGRATION.md` (this skill's own external memory: the Migration Plan, the Stage Ledger, and the compatibility-shims-in-play table — see `references/migration-plan-protocol.md`); one commit per stage, including Stage 0 (the characterization net), on a `migrate/<date>` branch, handed back to the user for review and never auto-merged.

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
| [`/dev-team-sync-issues`][cmd-sync-issues] | `--dry-run`, `--confirm-each` | Export the suite's ledgers (feature gaps, backlog, security findings, review verdicts, gate items) to GitHub Issues (see [Issue sync](#issue-sync-optional)); opt-in, dedup-safe. |
| [`/dev-team-config`][cmd-config] | `show\|init` | Print the effective config (built-in defaults overlaid with `.dev-team/config.yml`), or scaffold a starter repo-scoped config file (see [Configuration & feature toggles](#configuration--feature-toggles)). |
| [`/dev-team-report`][cmd-report] | `[branch=<base>]` | Read-only, on-demand run report — phases/cycles, commits, agents by tier, a rough (not-a-bill) cost estimate — regardless of the `features.telemetry` toggle (see [Run reports & cost](#run-reports--cost)). |

**Detail worth knowing:**

- **`/dev-team-approve`** — `<gate-id>` is the queued item's id (e.g. `G-003`); `approve` marks it built next iteration, `reject` marks it skipped. Add `[notes]` (free text) — especially useful on a reject.
- **`/dev-team-sync-branches`** — without `--apply` it only detects and reports, then stops for confirmation. `--no-fetch` skips the pre-detection `git fetch --prune`.
- **`/dev-team-watch-prs`** — `pr=<n>` also serves as the explicit per-PR opt-in required to touch a PR **not authored by the current user**. `autofix=safe` (default) fixes+verifies+pushes SAFE-AUTO and reruns flaky checks; `autofix=off` only monitors/reports/proposes.
- **`/dev-team-sync-issues`** — first run in a repo (and any `--confirm-each` run) shows the planned set and waits for the user's go-ahead before creating anything; `--dry-run` reports without touching GitHub.
- **`/dev-team-config`** — `show` (default if omitted) is read-only: it never creates, edits, or touches the file. `init` creates `.dev-team/config.yml` with the commented starter schema **only if one doesn't already exist**; it never overwrites a file that's there, and never commits it for you — the file is meant to be committed by the user so its defaults and toggles apply to every session and collaborator.
- **`/dev-team-report`** — `branch=<base>` sets the base to diff commits against; if omitted it resolves from `.dev-team/config.yml`'s `git.default-branch`, then auto-detects `origin/HEAD`, then falls back to `main`/`master`. Agents-spawned-by-tier and the cost estimate read from `.dev-team/autopilot.json`'s `budget.spawns_by_tier` when present; without it (a plain, non-autopilot run with no persisted spawn ledger) it reports those as "not tracked outside an autopilot run" rather than guessing. Never writes or fetches anything.

---

## Configuration & feature toggles

`.dev-team/config.yml` is a file **you commit** in your own project repo (not this plugin's repo). Because it's committed, it's the suite's **primary, repo-scoped switch mechanism** — it applies to every session and every collaborator who clones the repo, not just a per-session or per-user setting. Full schema, load rules, and the toggle → env-override table: [config-and-toggles.md][config-toggles]; inspect or scaffold it with [`/dev-team-config`](#commands).

**Precedence (highest to lowest):** per-run argument (e.g. `models=economy`) > plain language in the invocation (e.g. "keep costs down") > per-session environment variable (e.g. `DEV_TEAM_NO_UPDATE_CHECK`) > repo `.dev-team/config.yml` > built-in default. A missing or unreadable `.dev-team/config.yml` simply drops out of the chain — **fail-open** everywhere it's read: an absent file, a malformed file, or one bad/unrecognized key never blocks a hook, errors out a skill, or takes down the rest of the file's valid keys.

**Schema overview** (`version: 1` is the only required key — everything else is optional and falls back to its built-in default):

- **`defaults:`** — repo-wide overrides for existing run arguments: `models` (economy/balanced/max, default `balanced`), `gates` (autopilot's gate policy, default `hybrid`), `cap` (autopilot convergence cap, default ~30), `cycles` (iterate's cycle cap, default `5`), `issues` (`off`/`sync`, default `off`; security findings still need the separate `sync-security` opt-in).
- **`git:`** — `stack-prs` (`true`/`false`, default `false`) and `default-branch` (`auto` or an explicit branch name). `stack-prs: false` is the **no-stack policy**: by default every run branches FROM and targets the default branch and never stacks a PR on another feature branch (a merge-race hazard) — stacking requires both `git.stack-prs: true` **and** an explicit per-run ask.
- **`features:`** — repo-wide on/off toggles, each with an optional per-session env override:

  | Toggle | Governs | Values | Per-session env override | Built-in default |
  |---|---|---|---|---|
  | `update-notifier` | SessionStart update check | `on`, `off` | `DEV_TEAM_NO_UPDATE_CHECK` | `on` |
  | `branch-notifier` | SessionStart gone-branch notice | `on`, `off` | `DEV_TEAM_NO_BRANCH_CHECK` | `on` |
  | `guard` | PreToolUse Bash safety net | `on`, `off`, `auto` | `DEV_TEAM_GUARD` (force-on) | `auto` (active only during a run) |
  | `notifications` | Autopilot gate/blocked/done notifications | `on`, `off` | none yet — config-only | `on` |
  | `telemetry` | Run-end telemetry + cost estimate | `on`, `off` | none yet — config-only | `on` |
  | `dry-run` | Default plan-preview for building skills | `on`, `off` | none yet — config-only (a per-run argument still overrides for one run) | `off` |

  For `guard` specifically, the values aren't a simple on/off pair: `off` disables it repo-wide **even if** `DEV_TEAM_GUARD` is set for the session; `on` forces it active regardless of whether a run is in progress; `auto` (default) preserves today's behavior — active only while `.dev-team/autopilot.json` exists, unless `DEV_TEAM_GUARD` forces it on.

## Run reports & cost

Every dev-team run can summarize what it did and roughly what it cost — legible cost, never pretending to be a bill. Full spec (the single source of truth for the per-tier cost weights): [run-report.md][run-report].

- **Automatic, at a run's terminal step** — gated by the `features.telemetry` toggle (default `on`; see [Configuration & feature toggles](#configuration--feature-toggles)). `off` suppresses the automatic emission only; nothing else about the run changes.
- **On demand, always** — [`/dev-team-report`](#commands) `[branch=<base>]` works regardless of the toggle; an explicit ask always gets an answer.
- **What's in it:** skill/mode + phases/stages run, cycles/stages completed, agents spawned by tier, commits on the run branch, wall-clock (derived from first/last commit timestamps, or "n/a" — never fabricated), gate-ledger outcomes (autopilot runs), and the rough cost estimate.
- **The cost estimate is a spawn-count heuristic, not a token-accurate model:** `cost_index = Σ (spawns_tier × weight_tier)` using the per-tier weights in [run-report.md][run-report] (Reasoning 9, Build/Verify 6, Scribe 2, Mechanical 1, optional external bulk executor 2). Every number it produces carries the mandatory caveat: *"rough estimate from spawn counts, not a bill — actual cost depends on tokens per call."* There is no built-in `$` conversion — the suite doesn't hardcode a rate.
- **Live vs. cold:** a running skill can tally this run's own spawns from its briefs; a cold `/dev-team-report` invocation can only read `.dev-team/autopilot.json`'s `budget.spawns_by_tier` — if that file doesn't exist (a plain, non-autopilot run), tier spawn counts are reported as "not tracked outside an autopilot run" rather than guessed.

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

### Cross-cutting behaviors

Three behaviors apply the same way across every building skill (orchestrator, iterate, security, stripe, ship, docs, migrate) rather than being restated per skill. Canonical source: [conventions.md][conventions].

- **Dry-run / plan-preview.** `dry-run=on` (per-run argument) or `features.dry-run: on` (repo `.dev-team/config.yml`; default `off`) makes a building skill produce its full plan and the briefs it WOULD issue, spawn **no builders**, and make **no file or git changes** — it stops after planning and reports the plan for approval. Precedence: per-run argument > plain language ("just show me the plan", "dry run first") > repo config > built-in default `off`. `dev-team-review` is unaffected — it's already read-only. Fail-open: a missing/unreadable config just leaves dry-run off.
- **Cold-resume.** At the front of a run, a skill checks for its own prior owned artifact + run record before doing fresh work — `PROJECT.md` (orchestrator, iterate, stripe, and docs' Current-status note), `SECURITY.md` (security), `VERIFICATION.md` (review), `MIGRATION.md` (migrate). If a current one validates (a git-drift check plus a small spot-check against the real repo), the skill **resumes** from it instead of restarting cold; if it's missing, stale, or the tree is dirty in a way that invalidates it, it starts fresh. Always attempted, never a toggle. `dev-team-ship`, `dev-team-featurefind`, and `dev-team-ci-medic` have no cold-resume mechanic of their own.
- **Autopilot notifications.** When `features.notifications: on` (default), the `dev-team-autopilot` conductor surfaces a prominent, clearly-marked notice at three events: a gate item **QUEUED** for approval, a **BLOCKED** pause, and a terminal **DONE**/cap — each its own report line, not buried in a routine cycle update. You may additionally wire a Claude Code Notification/Stop hook or a push-notification integration for delivery outside the terminal (optional, not required for the in-report notice). `features.notifications: off` skips the notice entirely; fail-open otherwise.

---

## Artifacts glossary

Every file the suite reads/writes. All ledgers are owned by the `sonnet-scribe` documentarian.

| File | Written by | Purpose |
|---|---|---|
| `PROJECT.md` | `sonnet-scribe` (orchestrator / iterate / security / stripe) | Human-readable source of truth: Goal, Definition of done, Constraints, Skills in play, House style, Stage plan, Current status (always overwritten for cheap cold-resume), Decision log, Checkpoint log, Feature Specs. iterate adds Codebase Map, Run record, Backlog, Proposed-Features ledger, Trajectory ledger. Read by every skill. Schema: [documentarian-protocol.md][documentarian-protocol] (+ [audit-and-backlog-protocol.md][audit-backlog] for iterate). |
| `FEATURES.md` | `sonnet-scribe` (via featurefind) | Scored feature-gap ledger (`FG-` items, citation per claimed competitor feature). Read by iterate and autopilot. Schema: [gap-scoring-rubric.md][gap-rubric]. |
| `SECURITY.md` | `sonnet-scribe` (via security) | Findings (`F-` items under `#Findings`) and the remediation record from the adversarial audit. Read by review, autopilot, and a later security resume. Schema: [threat-model-and-surface-protocol.md][threat-model]. |
| `VERIFICATION.md` + `verdict.json` | `sonnet-scribe` (via review) | Independent QA/verification evidence and verdicts (`V-` items); `verdict.json` is machine-readable for CI gating. Read by the user and autopilot's VERIFY phase. Schema: [verdict-and-report-protocol.md][verdict-protocol]. |
| `MIGRATION.md` | `sonnet-scribe` (via migrate) | This skill's own external memory: the Migration Plan (strategy, staged breakdown, risk sizing), the Stage Ledger (`M-` items — one per stage, its own commit), and the compatibility-shims-in-play table. Read by review and a later migrate resume. Schema: [migration-plan-protocol.md][migration-plan-protocol]. |
| `.dev-team/autopilot.json` | autopilot conductor (fields updated by `sonnet-scribe` each RECORD step) | Machine-authoritative run state (read first every iteration, rewritten last): mission/done, plan/phase cursor, state, next action, gate ledger (`G-` items), blocked, cycle/cap, verify, budget block, lock, branch, last commit, trajectory ref. Schema: [loop-runtime.md][loop-runtime]. |
| `HANDOFF.md` | `sonnet-scribe` (all modes) | Derived, always-regenerated one-glance resume card built from `PROJECT.md#Current status`. A convenience surface, never itself a source of truth. Schema: [handoff-template.md][handoff-template]. |

---

## Hooks & environment switches

Plugin hooks **auto-activate on install**. All are **fail-open** (any error silently allows/exits) and **scoped** — they do the minimum and never block your session.

Since v1.2.0, each hook also reads the repo-scoped [`.dev-team/config.yml`][config-toggles]'s `features:` block (best-effort, tolerant grep-based match — never a hard YAML dependency in a PreToolUse/SessionStart hot path) before falling back to its environment-variable switch and built-in default. The env vars below remain a **per-session** override layered on top of the repo config, not a replacement for it — see [Configuration & feature toggles](#configuration--feature-toggles) for the full precedence chain.

| Hook | Event | Purpose | Disable with |
|---|---|---|---|
| [`hooks/check-update.sh`][check-update] | SessionStart | Layer-2 fallback update notifier: at most once per 24h, compares local vs. remote `plugin.json` and prints a one-line update notice if newer. Never updates anything; fails open/silent on missing `gh`/`jq` or network error. | `DEV_TEAM_NO_UPDATE_CHECK` (session), or `features.update-notifier: off` in `.dev-team/config.yml` (repo-wide) |
| [`hooks/guard-dev-team.sh`][guard] | PreToolUse (Bash) | Best-effort safety net (one layer, never the guarantee). Blocks exactly three unrecoverable Bash actions while a run is active: `git push` to main/master, force-push to main/master, and any live Stripe key pattern (`sk_live_`/`rk_live_`/`pk_live_` — dev-team is test-mode only). Any parse error or no active run → silently allows. | `features.guard: off` in `.dev-team/config.yml` disables it repo-wide (wins even over `DEV_TEAM_GUARD`); otherwise it only engages when `.dev-team/autopilot.json` exists **or** `DEV_TEAM_GUARD` is set — unset `DEV_TEAM_GUARD` and/or remove `.dev-team/autopilot.json` to stop it firing for a session. |
| [`hooks/sync-branches-check.sh`][sync-check] | SessionStart | Network-free, read-only notifier: counts local branches whose upstream shows `gone` and, if >0, points to `/dev-team-sync-branches`. Deletes nothing, makes no network calls, silent when nothing to report. | `DEV_TEAM_NO_BRANCH_CHECK` (session), or `features.branch-notifier: off` in `.dev-team/config.yml` (repo-wide) |

**All environment variables / switches** (per-session overrides layered on top of `.dev-team/config.yml`'s `features:` block — see [Configuration & feature toggles](#configuration--feature-toggles)):

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

## Issue sync (optional)

The suite already maintains issue-shaped ledgers — feature gaps (`FEATURES.md`), backlog and proposed features (`PROJECT.md`), security findings (`SECURITY.md`), review verdicts (`VERIFICATION.md`), Migration Stage Ledger items (`MIGRATION.md`), and gate-deferred items (`.dev-team/autopilot.json`). Issue sync exports them to GitHub Issues so they're actionable in your real tracker instead of trapped in markdown. It's **opt-in** and owned by the `sonnet-scribe` agent (cheap bookkeeping, not reasoning) — full detail in [issue-sync-protocol.md][issue-sync-protocol].

Turn it on two ways:

- The `issues=off|sync` argument (default **off**) on `dev-team-iterate`, `dev-team-security`, `dev-team-featurefind`, `dev-team-review`, `dev-team-autopilot`, or `dev-team-migrate` — set `issues=sync` to export that run's ledger items as it goes. [dev-team-docs](#dev-team-docs) also takes `issues=off|sync`, to export its `audit` mode's drift findings.
- [`/dev-team-sync-issues`][cmd-sync-issues] — run a sync pass over the current repo's ledgers on demand, independent of any skill run.

**Mapping:**

| Source ledger | Item prefix | Issue label |
|---|---|---|
| `FEATURES.md` (featurefind) | `FG-` | `for consideration` (→ `enhancement` once approved) |
| `PROJECT.md` Backlog (iterate) | `B-` | `enhancement` |
| `PROJECT.md` Proposed-Features ledger | (feature) | `for consideration` |
| `SECURITY.md` findings (security) | `F-` | `security` |
| `VERIFICATION.md` verdicts (review) | `V-` (fail) / `I-` | `bug` / `enhancement` |
| `MIGRATION.md` Stage Ledger (migrate) | `M-` | `enhancement` |
| `.dev-team/autopilot.json` gate-ledger | `G-` | `for consideration` |

**Dedup is the core.** Each ledger item carries an `issue:` field holding its GitHub issue number once synced. An item with no `issue:` ref gets a new issue created (and the returned number written back); an item that already has one is updated in place — never a duplicate. The hidden `<!-- dev-team:<id> -->` footer marker is the identity backstop if a ledger ref is ever lost.

**Close-on-done.** When an item's status becomes resolved/built/verified/merged, its issue is closed with a reference to the delivering commit/PR; a re-opened item re-opens its issue.

**Confirm-first.** The first sync in a repo shows the set it will create (count + titles) and waits for your go-ahead before creating anything — the suite's standard gate posture. After that, syncs run and report a one-line summary (e.g. "issue sync: +2 created, 3 updated, 1 closed"). `--confirm-each` re-arms per-item confirmation; `--dry-run` reports without touching GitHub.

**Safety.** Requires `gh` authenticated for the repo — if absent/unauthed, it does nothing and tells you how to enable it; issue sync never fails the surrounding run. It only ever touches issues it created (via the stored `issue:` ref or the hidden marker) — never edits or closes unrelated issues, and never deletes any issue.

---

## Repo self-audit / CI

The plugin guards its own integrity in CI. [`.github/workflows/plugin-audit.yml`][plugin-audit] (workflow name `plugin-audit`) triggers on every `pull_request` and on `push` to `main`, with **two jobs — both required checks**:

- **`audit`** (id `audit`, `name: audit`) — checks out, installs `jq`, and runs [`scripts/audit-model-ids.sh`][audit-script].
- **`test`** (id `test`, `name: test`) — checks out, installs `jq`/`shellcheck`/`bats`, and runs the plugin's own self-tests: [`tests/smoke-structure.sh`][smoke-test] (the delivery shape a marketplace installer relies on), `shellcheck` over `scripts/*.sh hooks/*.sh tests/*.sh`, and `bats tests/scripts.bats` (behavior contracts for the hooks/scripts).

> **Required-check names:** the job `name:` fields are the literal strings **`audit`** and **`test`** — those byte-for-byte strings (not the "plugin-audit / audit" UI form) are what you register as required checks in branch protection / rulesets.

The audit script performs five checks and exits non-zero (`AUDIT FAIL: <reason>`) on any failure, or prints `AUDIT OK`:

1. No dated model id appears in any `.md`/`.json`/`.yml`/`.yaml` file **except** [model-routing.md][model-routing] (prevents model-id drift/rot).
2. Both `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` parse as valid JSON.
3. Each of the five endpoint agent files ([`deep-architect`][deep-architect], [`opus-builder`][opus-builder], [`sonnet-scribe`][sonnet-scribe], [`quick-edits`][quick-edits], [`sonnet-builder`][sonnet-builder]) exists **and** carries a `model:` frontmatter line.
4. No `.claude/agents/` directory exists (plugin agents must live under `agents/` at the plugin root, or installers won't receive them).
5. **Docs-coverage:** every `skills/dev-team-*/` directory name and every `commands/*.md` basename must appear as a substring somewhere in `README.md` — fails (`AUDIT FAIL: <name> not documented in README`) if a skill or command ships without being documented here, so this file can't silently drift out of date again.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full repo layout, how to run all of the above locally before committing, and the release flow; the test suite itself (fixtures, how to install `bats`/`shellcheck`) is documented in [`tests/README.md`][tests-readme].

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
[issue-sync-protocol]: skills/dev-team-orchestrator/references/issue-sync-protocol.md
[conventions]: skills/dev-team-orchestrator/references/conventions.md
[config-toggles]: skills/dev-team-orchestrator/references/config-and-toggles.md
[run-report]: skills/dev-team-orchestrator/references/run-report.md
[migration-plan-protocol]: skills/dev-team-migrate/references/migration-plan-protocol.md
[deep-architect]: agents/deep-architect.md
[opus-builder]: agents/opus-builder.md
[sonnet-scribe]: agents/sonnet-scribe.md
[quick-edits]: agents/quick-edits.md
[sonnet-builder]: agents/sonnet-builder.md
[plugin-audit]: .github/workflows/plugin-audit.yml
[audit-script]: scripts/audit-model-ids.sh
[branch-hygiene]: scripts/branch-hygiene.sh
[smoke-test]: tests/smoke-structure.sh
[tests-readme]: tests/README.md
[cmd-dev-team]: commands/dev-team.md
[cmd-status]: commands/dev-team-status.md
[cmd-approve]: commands/dev-team-approve.md
[cmd-sync]: commands/dev-team-sync-branches.md
[cmd-update]: commands/dev-team-update.md
[cmd-watch]: commands/dev-team-watch-prs.md
[cmd-sync-issues]: commands/dev-team-sync-issues.md
[cmd-config]: commands/dev-team-config.md
[cmd-report]: commands/dev-team-report.md

# dev-team

**Version 1.6.0.**

A Claude Code plugin that lets you run software work as a **team lead / product owner** instead of coding alone: you delegate every piece of implementation to a tiered team of Claude subagents (a frontier reasoner, an Opus builder/verifier, a Sonnet documentarian, a Haiku mechanic) through a stage-by-stage *delegate → check → checkpoint* loop. **Eleven skills** cover the whole lifecycle — building, iterating, migrating, security, verification, competitive feature discovery, Stripe, shipping/CI, PR CI-medic, and documentation — plus an autopilot conductor that drives them all to production autonomously. An optional **taste-first** profile can put the highest-taste model in the orchestrator seat and offload token-hungry bulk work to GPT-5.5/Codex.

Cross-cutting since 1.2.0 (see [Configuration & feature toggles](#configuration--feature-toggles) and [Cross-cutting behaviors](#cross-cutting-behaviors)): an optional, repo-scoped `.dev-team/config.yml` sets the suite's run defaults and feature toggles for every session and collaborator; every building skill supports a `dry-run` plan-preview and a generalized cold-resume; and runs surface an end-of-run [telemetry report](#run-reports--cost) (a rough, explicitly-not-a-bill cost estimate) plus autopilot gate/blocked/done notifications. New in 1.3.0: every completed task/workstream can auto-regenerate an **assistant-agnostic** `HANDOFF.md` (readable by Claude, Codex, or any LLM tool) and land its own **fine-grained local commit**, and issue sync gains a per-task `auto` cadence plus **GitLab** support — see [Cross-cutting behaviors](#cross-cutting-behaviors) and [Issue sync](#issue-sync-optional). New in 1.4.0: a **single-PR policy** (`git.single-pr`, default on) that keeps *one open PR per line of work* — reusing an existing PR instead of opening duplicates that could race to merge (see [Configuration & feature toggles](#configuration--feature-toggles)). New in 1.5.0: every file the plugin writes for itself — `PROJECT.md`, `FEATURES.md`, `SECURITY.md`, `VERIFICATION.md` + `verdict.json`, `MIGRATION.md`, and now `HANDOFF.md` too — lives in the project's `.dev-team/` folder instead of the top level, so it can never be mistaken for (or overwrite) a project's own same-named file; a **marker line** on every ledger is how the plugin tells its own files apart from a project's, and a file it cannot prove is its own is never written to without asking first — see [Where the plugin writes, and the ownership rule](#cross-cutting-behaviors) and [Upgrading from 1.4 or earlier](#upgrading-from-14-or-earlier). New in 1.6.0: **repository instructions and normative documents** — every agent now reads a project's own developer/agent instructions (`AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `GEMINI.md`, `.OpenAI/`/`.openai/`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`) and, in full, any normative document one of them names for the work in hand — but only as they were in a snapshot taken when the run starts (a file changed afterwards, an untrusted pull request's version, or a vendored folder never counts). A brief names the document's path, rule IDs and profile by reference and never pastes its rules in; a checker or reviewer does its own discovery and cites the rule IDs it checked. Repository content may add work, checks and constraints and choose between style defaults, but **never removes, skips, weakens or waives a check, a gate, a confirmation or a safety rule**, and can move a plugin switch only toward its more cautious value — see [Cross-cutting behaviors](#cross-cutting-behaviors). A new `handoff-file` switch (`off` = the plugin never writes `.dev-team/HANDOFF.md`) is set `off` automatically for a project whose own instructions explicitly forbid a second handover, unless `.dev-team/config.yml` sets it. **Upgrading:** in a `.dev-team/config.yml` written by an older `/dev-team-config init`, comment out every setting you did not choose — see [Upgrading from 1.5 or earlier](#upgrading-from-15-or-earlier).

---

## Install

You install the plugin **once** and it's then available in every Claude Code surface (terminal, VSCode, JetBrains, web). In Claude Code, type these two commands into the chat input, one at a time:

```text
/plugin marketplace add MWBMPartners/dev-team-plugin   # 1) register the marketplace
/plugin install dev-team@dev-team                       # 2) install the plugin
```

> This is a **private** plugin under the MWBMPartners org — you need read access to the repo to install it (see [Privacy](#privacy)).

**Then what?** Nothing else to configure. The [safety hooks](#hooks--environment-switches) turn on automatically (they stay quiet and fail-safe), and your entry point is the [`/dev-team`](#commands) router: type `/dev-team` followed by what you want — e.g. `/dev-team build a REST API for todos` — or just describe the task in plain language and the right skill activates on its own. Not sure how skills fire in the terminal vs. an IDE? See [Using in Claude Code](#using-in-claude-code--cli-and-ides-vscode).

### Do I need to "activate" it? (per-repo? per-prompt?)

**No activation step, and nothing to repeat.** The whole model is three layers, and only the first is required:

- **Install once — covers everything.** The two `/plugin` commands above install at the **user level**, so the plugin is available in every Claude Code surface (terminal, VSCode, JetBrains, web) and in **every repo you ever open**. You never reinstall per project, per IDE, or per session, and the safety [hooks](#hooks--environment-switches) turn themselves on at install.
- **Use it per task — just ask.** There is nothing to switch on before a request. Either **describe the task in plain language** and the matching skill activates on its own (e.g. *"build a REST API for todos"* → the orchestrator; *"audit this for vulnerabilities"* → security), **or** call it explicitly via the [`/dev-team`](#commands) router (`/dev-team <what you want>`) or a specific command (`/dev-team-status`, `/dev-team-config`, …). That's *using* it — not a setup step you repeat each prompt.
- **Configure once per repo — optional.** The only per-repo thing, and it's entirely optional, is committing a [`.dev-team/config.yml`](#configuration--feature-toggles) (scaffold it with `/dev-team-config init`) to change the suite's defaults/toggles for that project. Without one, built-in defaults apply everywhere — **no config file is needed to use the plugin**; it only exists to change defaults (e.g. opting a repo into `issues: auto`).

In short: **install once (all repos), invoke per task (describe it, or `/dev-team …`), and optionally drop one committed config file in a repo if you want non-default behavior.**

### Updating

Pick whichever suits you — **A** is the "set it and forget it" option most people want.

**A. Turn on auto-update (recommended — do this once):**

1. In Claude Code, type `/plugin` and press Enter to open the plugin menu.
2. Open the **Marketplaces** tab and select **dev-team**.
3. Choose **Enable auto-update**.

That's it. New versions now install automatically each time Claude Code starts — you never have to think about it again.

**B. Update by hand whenever you like:**

1. Type `/dev-team-update` in the chat. It checks whether a newer version exists and, if so, prints the exact commands to run.
2. Or just run these two commands yourself (in the chat input):

   ```text
   /plugin marketplace update dev-team   # 1) refresh the catalog
   /plugin update dev-team               # 2) install the newest version
   ```

   Run them in that order: the first refreshes what's available, the second installs it.

**Will I miss an update?** No. Even if you never enable auto-update, dev-team quietly checks about once a day and, when a newer version is out, prints a single line like `dev-team: v1.3.0 available…` at the start of a session. It **never** updates itself from that notice — it just tells you, so you stay in control. Want to silence that line? See [Enable/disable features](#configuration--feature-toggles) (`update-notifier`).

<details>
<summary><b>Advanced update controls</b> (optional)</summary>

- **Enable auto-update via settings instead of the menu:** add dev-team to `extraKnownMarketplaces` with `autoUpdate: true`.
- **Global switches:** `DISABLE_AUTOUPDATER=1` turns off Claude Code's auto-update entirely (this plugin included); `FORCE_AUTOUPDATE_PLUGINS=1` keeps plugin auto-updates running even then.
- **The daily notice** is [`hooks/check-update.sh`][check-update] — a SessionStart hook, cached to at most once/24h, fail-open (silent if `gh`/`jq` are missing or offline). It never changes anything. Turn it off with the env var `DEV_TEAM_NO_UPDATE_CHECK=1` (this session) or `features.update-notifier: off` in `.dev-team/config.yml` (repo-wide).

</details>

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
| `dry-run=on\|off` | `off` | Produce the full stage/workstream plan and the briefs it WOULD issue, spawn no builders, and make no file or git changes in the project; stop after planning and report the plan for approval. Also settable via plain language ("just show me the plan"). See [Cross-cutting behaviors](#cross-cutting-behaviors). |

**Modes.** None — no `mode=` subcommands. It runs one loop: UNDERSTAND → SCOPE INTO STAGES → [per stage: PLAN → DELEGATE → CHECK → CHECKPOINT → DECIDE] → VERIFY → done. It offers an optional *taste-first* orchestration profile (see [orchestration-profiles.md][orchestration-profiles]) and three lead-chosen check-in policies (Autonomous / Milestone check-ins / Decision check-ins) — judgment calls, not invocation flags. **Cold-resumes** from a prior run's `.dev-team/PROJECT.md` (Current status + decision log) when it's still current, instead of restarting from scratch — see [Cross-cutting behaviors](#cross-cutting-behaviors).

**Artifacts.** [`.dev-team/PROJECT.md`](#artifacts-glossary) (external memory / source of truth), plus a git commit at each passing stage checkpoint (message naming the stage) as a rollback point.

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
| `dry-run=on\|off` | `off` | Run Phase 0 (resume/scout, purpose, scored backlog) and write the cycle plan it WOULD run, but delegate no builders and make no file or git changes in the project; report the plan for approval. See [Cross-cutting behaviors](#cross-cutting-behaviors). |

**Cold-resume.** Phase 0 looks for `.dev-team/PROJECT.md` (found through the lookup order — see [Upgrading from 1.4 or earlier](#upgrading-from-14-or-earlier)) with a Codebase Map + run record from a prior run; if it validates as current, it reuses it as context and delta-scouts only what changed, instead of re-gathering the whole codebase — see [Cross-cutting behaviors](#cross-cutting-behaviors).

**Artifacts.** [`.dev-team/PROJECT.md`](#artifacts-glossary), extended with the Codebase Map, a run record (map-commit + date, for the resume check), the scored backlog, the Proposed-Features ledger, and the trajectory ledger (metrics over time).

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
| `dry-run=on\|off` | `off` | Run Phase 0 (threat model, attack-surface map, coverage ledger) and write the briefs each red/blue-team wave WOULD receive, but spawn no red-team/validator/builder agents and make no file or git changes in the project; stop after planning and report the plan. See [Cross-cutting behaviors](#cross-cutting-behaviors). |

**Modes.** No `mode=` argument; the mode-like toggles are `fix=auto\|propose-only` and the `report-only` flag. **Cold-resumes** from a current `.dev-team/SECURITY.md` (coverage ledger + findings register) when one exists, picking up only what's still untested/unresolved rather than re-running the full sweep — see [Cross-cutting behaviors](#cross-cutting-behaviors).

**Artifacts.** [`.dev-team/SECURITY.md`](#artifacts-glossary) (threat model, attack-surface map, coverage ledger, findings register with CWE / CVSS v3.1 / status / fix / verification evidence); a `security-audit/<date>` branch with one commit per fixed-and-verified finding, handed to the user for review (never auto-merged); isolated non-destructive PoC/repro artifacts in a sandbox dir; a new security regression test per fixed finding.

### dev-team-review

**Purpose.** Run an independent verification / QA pass over work done by the other dev-team skills — reading `.dev-team/PROJECT.md` (and `.dev-team/SECURITY.md`), extracting every claim, and spawning independent adversarial verifier agents to prove each one actually works with fresh evidence.

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

**Modes.** No user-facing mode switch, but two contexts: (1) **standalone** — full pipeline including the default-on fix phase; (2) invoked by [dev-team-autopilot](#dev-team-autopilot) as its VERIFY mode — effectively forced `remediate=report`: produces verdicts + `.dev-team/VERIFICATION.md` + `.dev-team/verdict.json` only, never enters the fix phase, creates no branch, and hands FAILED/DRIFTED/HOLLOW verdicts back to the conductor. No `dry-run` argument — this skill is already read-only up to the fix phase. **Cold-resumes** from an interrupted prior `.dev-team/VERIFICATION.md` pass (re-verifies only the outstanding claim-groups) — see [Cross-cutting behaviors](#cross-cutting-behaviors).

**Artifacts.** [`.dev-team/VERIFICATION.md`](#artifacts-glossary) (per-claim verdicts + evidence + severity + confidence, integration result, regression delta, overall verdict, prioritized gap list); `.dev-team/verdict.json` (machine-readable, for CI gating); a status-line update on `.dev-team/PROJECT.md` (not owned/rewritten); a `review-fix/<branch>` only if the fix phase runs (never merged to main).

### dev-team-featurefind

**Purpose.** Research similar/competitor products, find the features your implementation is **missing**, and score each gap by importance within the project's aim — producing a scored feature-gap ledger (`.dev-team/FEATURES.md`).

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

**Modes.** No named run modes. Two contexts: (1) **standalone** — a one-time Scope Gate confirms the inferred aim, comparable set, and scope boundary with the user before researching; (2) invoked by [dev-team-autopilot](#dev-team-autopilot) as its discovery mode — the Scope Gate is skipped, findings written straight to `.dev-team/FEATURES.md`/`.dev-team/PROJECT.md`, and the conductor owns the approval gate.

**Artifacts.** [`.dev-team/FEATURES.md`](#artifacts-glossary) (confirmed aim, comparable set with sources, scored gap register — in-scope gaps ranked by importance plus an out-of-scope section with reasons). When `.dev-team/PROJECT.md` is present, the documentarian syncs the top in-scope gaps into its Proposed-Features ledger.

### dev-team-stripe

**Purpose.** Build or review Stripe integration pathways with Stripe-specific correctness and security expertise, all in **test mode** by default.

**When to use.** When the user wants to build, integrate, audit, harden, or verify anything involving Stripe / payments / subscriptions / Connect / webhooks. Takes precedence over security/review/iterate whenever the work involves Stripe/payments. Not for non-Stripe work, one-off questions, or a generic post-run QA pass over a prior run's claims (that's [dev-team-review](#dev-team-review)).

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `mode=build\|review` | infer from the request; ask if ambiguous | Pick the mode. |
| `dry-run=on\|off` | `off` | Produce the full plan and stop, spawning no builders/red-team agents and making no file or git changes in the project (BUILD: the stage/workstream plan + builder briefs; REVIEW: the pathway map + audit/red-team briefs); report the plan for approval. See [Cross-cutting behaviors](#cross-cutting-behaviors). |
| `surface=checkout\|payment-element\|payment-intents\|billing\|connect\|webhooks\|ios-native\|android-native\|auto` | `auto` (detect from repo) | The Stripe surface in scope. |
| `severity-floor=critical\|high\|medium\|low` | `high` | (review) lowest severity to fix this run. |
| `live=confirm` | absent → test mode only | Explicit, one-time acknowledgement required before **any** live-mode action. |
| `branch=<name>` | `stripe/<date>` | Work branch. |

**Modes.** `mode=build\|review`. **BUILD** implements payment flows (Checkout, Payment Element, PaymentIntents, subscriptions/billing, Connect, webhooks) via the orchestrator loop, with a mandatory REVIEW pass before it's considered done. **REVIEW** is a Stripe-scoped correctness + security audit (a blend of security + review discipline) that maps pathways, runs deterministic scanners, audits against the correctness and security checklists, red-teams with test-mode PoCs, fixes, and re-verifies. Reuses the orchestrator's machinery wholesale, including **cold-resume** from a prior run's `.dev-team/PROJECT.md` — see [Cross-cutting behaviors](#cross-cutting-behaviors).

**Artifacts.** [`.dev-team/PROJECT.md`](#artifacts-glossary) (stack/decisions, Stripe pathway inventory, per-checklist-item coverage ledger, findings register with CWE); `.dev-team/SECURITY.md#Findings` (mirrored REVIEW findings, only if a later security resume is expected); git commits on the work branch (one per verified fix; payment changes never auto-merged); a final report (findings register, fixed vs proposed, residual risk, any live key flagged for rotation, and stated limitations).

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

**Artifacts.** `.dev-team/PROJECT.md` (records the pipeline that now exists — Current status + a decision-log entry for any real tradeoff); `.github/workflows/*` CI workflow(s) with deliberate, stable job `name:` fields; a gitleaks CLI secret-scanning step (never `gitleaks/gitleaks-action@v2`); branch protection rules and/or rulesets with required-check names matching the job `name:` fields byte-for-byte; a release/versioning flow (automated tag-on-version-bump with a `GITHUB_TOKEN` anti-recursion bridge, or a documented manual runbook); a `ship/<date>` branch handed back for review (never pushed straight to main); exact GitHub web-UI steps for any secret the pipeline needs (never set by the skill itself).

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

**Artifacts.** [`.dev-team/autopilot.json`](#artifacts-glossary) (machine-authoritative run state, plus `.dev-team/loop.lock`), and all the suite's ledgers: `.dev-team/PROJECT.md`, `.dev-team/FEATURES.md`, `.dev-team/SECURITY.md`, `.dev-team/VERIFICATION.md`, `.dev-team/verdict.json`.

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

**Artifacts.** No new required artifact — it reuses orchestrator machinery. If the repo already keeps a `.dev-team/PROJECT.md`, the documentarian appends a short run summary to its Current status; otherwise the summary is just reported. Fix commits are pushed to the PR's own head branch (never main), with messages of the form `ci-medic: fix <check> — <what changed>` carrying the checker's passing-output evidence.

### dev-team-docs

**Purpose.** Systematically generate **and** maintain a codebase's documentation — README, CHANGELOG, API/reference docs, docstrings/inline comments, usage guides, and architecture/onboarding docs — as a documentarian-drafted, checker-verified pipeline where **every claim is traced back to real source (`file:line`) before it ships**. This is the documentation variant of [dev-team-orchestrator](#dev-team-orchestrator): it reuses that skill's machinery wholesale (team model, brief format, checker pattern, documentarian) and adds one hard rule literally: a documented claim with no traced source isn't a documented claim, it's a guess.

**When to use.** When the user wants to "write/update the docs", "generate API docs", "document this codebase", "keep the README current", "add docstrings", "update the CHANGELOG", or produce an "onboarding/architecture doc". Not to build product features (use [dev-team-orchestrator](#dev-team-orchestrator)/[dev-team-iterate](#dev-team-iterate)), for a competitive/what's-missing feature analysis (use [dev-team-featurefind](#dev-team-featurefind)), or to just answer a one-off question about the code.

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `mode=generate\|maintain\|audit` | infer from what already exists | Write from scratch, update to match current code, or produce a read-only drift report. |
| `scope=readme\|api\|reference\|docstrings\|changelog\|guides\|architecture\|all` | `all` | Which doc area(s) to work on; accepts a comma list (e.g. `scope=readme,changelog`). |
| `dry-run=on\|off` | `off` | Produce the full doc-area plan and the drafter/checker briefs it WOULD issue, but spawn no drafters or checkers and make no file or git changes in the project; report the plan for approval. Not meaningful for `mode=audit` (already read-only). See [Cross-cutting behaviors](#cross-cutting-behaviors). |
| `models=economy\|balanced\|max` | `balanced` | Cost posture for the **scout** tier only (`opus-builder` vs. `sonnet-builder`); drafting stays `sonnet-scribe` and verification stays `opus-builder` regardless of posture (Invariant 1). |
| `issues=off\|sync\|auto` | `off` | Export `audit` mode's drift findings (or an unresolved NEEDS-LEAD-REVIEW item from `generate`/`maintain`) to GitHub or GitLab issues (platform auto-detected from the git remote; plain-git repos skip), dedup-safe and confirm-first. `sync` exports at the normal sync points; `auto` reflects each item continuously as it completes/closes (per-task cadence). |
| `branch=<name>` | `docs/<date>` | Override the default branch name. |

**Modes.** **generate** (no docs exist yet for the scope — write from scratch) | **maintain** (docs exist but the code moved — delta-scout what changed, draft only what drifted, but the checker re-verifies the *whole* doc-area) | **audit** (read-only: find and report doc drift/staleness by severity, no draft/fix/commit — a good cheap first look before committing to `maintain`). **Cold-resumes**: since this skill owns no dedicated ledger, it checks `.dev-team/PROJECT.md`'s Current status/decision log (if present) for a prior docs-pass record and `git diff`s since that commit to decide resume-vs-rescout — see [Cross-cutting behaviors](#cross-cutting-behaviors).

**Artifacts.** No new ledger file — writes the actual documentation files in scope (README, CHANGELOG, docstrings, guides, architecture docs, etc.), one commit per doc-area on a `docs/<date>` branch (never merged to `main` by the skill itself); `audit` mode makes no commits at all. If `.dev-team/PROJECT.md` exists, the documentarian records the result (counts by severity, headline findings) in its Current status.

### dev-team-migrate

**Purpose.** Run safe, **large-scale migrations** — framework/language/dependency major upgrades, schema migrations, API/interface ports — as a team lead who pins current behavior with a characterization-test net **before** touching anything, then moves in a staged, reversible cutover: one coherent slice per commit, every stage independently green (its own criteria plus the full characterization net) and independently revertible, no big-bang by default. This is the migration variant of [dev-team-orchestrator](#dev-team-orchestrator), reusing its machinery wholesale.

**When to use.** When the user wants to "migrate from X to Y", "upgrade to `<major version>`", "port to `<framework>`", "React 17→18", "Python 2→3", "migrate the database schema", "swap `<libA>` for `<libB>`", or mentions "migration", "cutover", "expand-contract", or "big rewrite". Not for a normal feature build (use [dev-team-orchestrator](#dev-team-orchestrator)), general cleanup/polish with no migration target (use [dev-team-iterate](#dev-team-iterate)), or Stripe-specific work (use [dev-team-stripe](#dev-team-stripe)).

**Parameters.**

| Argument | Default | Meaning |
|---|---|---|
| `mode=plan\|execute` | infer: no valid approved plan yet → `plan`; a valid approved plan exists and the ask is "go ahead" → `execute` | Pick the mode. |
| `from=<x>` / `to=<y>` | — | The current state / target state being migrated (framework, language, version, schema, library). |
| `strategy=incremental\|parallel-run\|big-bang` | `incremental` | The cutover strategy. `big-bang` is strongly discouraged and only ever runs after the Migration Plan Gate surfaces its risk explicitly and the user signs off — never the default, never silently accepted. |
| `dry-run=on\|off` | `off` | Inside `execute` mode, produce the per-stage builder briefs it WOULD issue for the (already-approved) stages, spawn no builders, and make no file or git changes in the project; report the plan for approval. `mode=plan` already stops for approval by design — this is not a substitute for the Migration Plan Gate. See [Cross-cutting behaviors](#cross-cutting-behaviors). |
| `models=economy\|balanced\|max` | `balanced` | Cost posture biasing which tier does build/scout work; verification always stays frontier. |
| `issues=off\|sync\|auto` | `off` | Export this run's open Stage Ledger follow-ups (a deferred stage, a risk flagged for sign-off, a proposed-not-auto-taken strategy call) to GitHub or GitLab issues (platform auto-detected from the git remote; plain-git repos skip), dedup-safe and confirm-first. `sync` exports at the normal sync points; `auto` reflects each item continuously as it completes/closes (per-task cadence). |
| `cap=N` | the approved plan's full stage count | Safety backstop: max stages to execute in this invocation before stopping to checkpoint and report; not a substitute for finishing the approved plan across multiple invocations. |
| `branch=<name>` | `migrate/<date>` | Override the default branch name. |

**Modes.** **plan** (scout the migration surface, map dependency order, choose a strategy, define the staged cutover plan with risk sizing, and **stop** for the Migration Plan Gate — the user's explicit approval; a hard, one-time gate, distinct from `dry-run`) | **execute** (requires an approved plan; runs the characterization-net gate as Stage 0, then migrates stage-by-stage — verify against both the stage's own criteria *and* the full characterization net, commit, update the Stage Ledger — with compatibility shims tracked to the later stage that removes them, ending in a mandatory final cutover + cleanup stage). **Cold-resumes** from a prior run's `.dev-team/MIGRATION.md` (Migration Plan + Stage Ledger) when it validates as still current, the same way `dev-team-iterate` validates its Codebase Map — see [Cross-cutting behaviors](#cross-cutting-behaviors).

**Artifacts.** `.dev-team/MIGRATION.md` (this skill's own external memory: the Migration Plan, the Stage Ledger, and the compatibility-shims-in-play table — see `references/migration-plan-protocol.md`); one commit per stage, including Stage 0 (the characterization net), on a `migrate/<date>` branch, handed back to the user for review and never auto-merged.

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
| [`/dev-team-sync-issues`][cmd-sync-issues] | `--dry-run`, `--confirm-each` | Export the suite's ledgers (feature gaps, backlog, security findings, review verdicts, gate items) to your GitHub or GitLab tracker (platform auto-detected; see [Issue sync](#issue-sync-optional)); opt-in, dedup-safe. |
| [`/dev-team-config`][cmd-config] | `show\|init` | Print the effective config (built-in defaults overlaid with `.dev-team/config.yml`), or scaffold a starter repo-scoped config file (see [Configuration & feature toggles](#configuration--feature-toggles)). |
| [`/dev-team-report`][cmd-report] | `[branch=<base>]` | Read-only, on-demand run report — phases/cycles, commits, agents by tier, a rough (not-a-bill) cost estimate — regardless of the `features.telemetry` toggle (see [Run reports & cost](#run-reports--cost)). |
| [`/dev-team-move-ledgers`][cmd-move-ledgers] | `[--apply]` | Move dev-team ledgers written before v1.5.0 from the legacy root location into `.dev-team/`. Read-only preview by default; `--apply` moves only files carrying the dev-team marker without asking, asks about look-alikes, never touches a project's own file or a mixed one, and makes one commit (never pushes). |

**Detail worth knowing:**

- **`/dev-team-approve`** — `<gate-id>` is the queued item's id (e.g. `G-003`); `approve` marks it built next iteration, `reject` marks it skipped. Add `[notes]` (free text) — especially useful on a reject.
- **`/dev-team-sync-branches`** — without `--apply` it only detects and reports, then stops for confirmation. `--no-fetch` skips the pre-detection `git fetch --prune`.
- **`/dev-team-watch-prs`** — `pr=<n>` also serves as the explicit per-PR opt-in required to touch a PR **not authored by the current user**. `autofix=safe` (default) fixes+verifies+pushes SAFE-AUTO and reruns flaky checks; `autofix=off` only monitors/reports/proposes.
- **`/dev-team-sync-issues`** — first run in a repo (and any `--confirm-each` run) shows the planned set and waits for the user's go-ahead before creating anything; `--dry-run` reports without touching the tracker (GitHub or GitLab).
- **`/dev-team-config`** — `show` (default if omitted) is read-only: it never creates, edits, or touches the file, and it does not read the project's own instruction files — so it ends by saying that a run may still move an unset switch toward its more cautious value because of one. `init` creates `.dev-team/config.yml` with the commented starter schema **only if one doesn't already exist**, with **every setting commented out, showing its default, except the keys you chose during that `init` conversation** — an explicit value wins over the project's own instruction files, so a default nobody chose is never written out where it could overrule a project's cautious instruction; it never overwrites a file that's there, and never commits it for you — the file is meant to be committed by the user so its defaults and toggles apply to every session and collaborator.
- **`/dev-team-report`** — `branch=<base>` sets the base to diff commits against; if omitted it resolves from `.dev-team/config.yml`'s `git.default-branch`, then auto-detects `origin/HEAD`, then falls back to `main`/`master`. Agents-spawned-by-tier and the cost estimate read from `.dev-team/autopilot.json`'s `budget.spawns_by_tier` when present; without it (a plain, non-autopilot run with no persisted spawn ledger) it reports those as "not tracked outside an autopilot run" rather than guessing. Never writes or fetches anything.
- **`/dev-team-move-ledgers`** — without `--apply` it only reads and reports, sorting each legacy top-level file into "ours — will move", "looks like ours — ask", "not ours — leave alone", "mixed — needs a person", or "conflict" (a `.dev-team/<name>` already exists, so that copy wins — see [Where the plugin writes, and the ownership rule](#cross-cutting-behaviors)). `--apply` moves only files it can prove are its own without asking, asks about every look-alike one at a time, refuses to touch a mixed file (a project's own document with dev-team records appended into it — cutting that apart needs a person), **never asks about a conflicted file** — it is always left exactly as it is, whatever else it looks like — and makes one commit for everything it moves, never pushing it. Refuses `--apply` outside a git repo or with a dirty working tree, and asks before committing straight onto the default branch. **Before changing anything**, it checks that every file it would move is actually tracked by git, and that the project's own `.gitignore` would not swallow any file it is about to create or edit (`.dev-team/README.md`, `.dev-team/.gitignore`, `.dev-team/autopilot.json`, each file's new `.dev-team/<name>` path, and `.dev-team/config.yml` or an instruction file when the pointer-sentence question could touch them); if either check fails, `--apply` refuses before asking anything. After the questions it checks again that nothing else changed in the meantime. If any step fails partway through, it undoes **only its own changes**, path by path, and never runs `git reset --hard` — so an edit another program made meanwhile is never lost; if it finds anything it did not expect, it stops and gives manual-recovery steps instead of guessing.

---

## Configuration & feature toggles

`.dev-team/config.yml` is a file **you commit** in your own project repo (not this plugin's repo). Because it's committed, it's the suite's **primary, repo-scoped switch mechanism** — it applies to every session and every collaborator who clones the repo, not just a per-session or per-user setting. Full schema, load rules, and the toggle → env-override table: [config-and-toggles.md][config-toggles]; inspect or scaffold it with [`/dev-team-config`](#commands).

### Turning a feature on or off — step by step

Every switch lives in **one file in your project**: `.dev-team/config.yml`. Because you commit it, a setting there applies to **everyone on the repo, in every session** — set it once and you're done. There are two ways to change a behaviour:

**Just for right now (this session, or a single command) — nothing to commit:**

- Use an **environment variable** for a session-level switch. Example — silence the "update available" notice for this session only:

  ```bash
  export DEV_TEAM_NO_UPDATE_CHECK=1
  ```

- Or add a **per-run argument** to your request for a one-off. Example — run a skill cheaply just this once: end your message with `models=economy` (or simply say *"keep costs down"*).

**For the whole repo (everyone, every session) — edit `.dev-team/config.yml`:**

1. **Create the file** (if you don't have one yet): run `/dev-team-config init` in the repo — it writes a ready-to-edit, commented `.dev-team/config.yml` in which every setting is commented out and shows its default, apart from any you chose while `init` ran. (You can also create it by hand.)
2. **Edit it** and set the toggle you want, under the right section — in a file from `init`, remove the `# ` in front of the setting and change its value. Only set what you mean to set: a value in this file wins over your project's own instruction files (`AGENTS.md`, `CLAUDE.md` and the like). For example, to turn *off* the update notice and the cost report, and make building skills *preview-only* by default:

   ```yaml
   version: 1              # required — leave this line in
   features:
     update-notifier: off  # no "update available" notice at session start
     telemetry: off        # no run-end cost / telemetry summary
     dry-run: on           # building skills show the plan first and change nothing
   defaults:
     models: economy       # prefer cheaper models by default
   ```

3. **Save and commit it** so the setting travels with the repo:

   ```bash
   git add .dev-team/config.yml && git commit -m "dev-team: configure feature toggles"
   ```

4. **Check what's actually active** any time with `/dev-team-config` — it prints the effective settings and marks which value came from your file vs. the built-in default. A commented-out line counts as not set. It does not read your project's own instruction files (`AGENTS.md`, `CLAUDE.md` and the like), which can move a switch you have not set toward its more cautious value — a value you set in the file always wins over them.

> **Worried about breaking something?** Don't be. A missing, empty, or malformed `.dev-team/config.yml` — or a key it doesn't recognise — is simply ignored, and the built-in defaults apply. The plugin is **fail-open** everywhere it reads config: a bad config never blocks a hook, errors a skill, or disables the file's other valid keys.

**The switches you're most likely to want:**

| I want to… | In `.dev-team/config.yml`, under… | set it to | Quick one-session alternative |
|---|---|---|---|
| Stop the "update available" notice | `features: → update-notifier` | `off` | `export DEV_TEAM_NO_UPDATE_CHECK=1` |
| Stop the "you have stale branches" notice | `features: → branch-notifier` | `off` | `export DEV_TEAM_NO_BRANCH_CHECK=1` |
| Silence the run cost / telemetry summary | `features: → telemetry` | `off` | — |
| Silence autopilot gate/blocked/done notifications | `features: → notifications` | `off` | — |
| Make building skills preview-only (show the plan, change nothing) | `features: → dry-run` | `on` | add `dry-run=on` to a request |
| Stop regenerating `.dev-team/HANDOFF.md` after every task (on by default) | `features: → auto-handoff` | `off` | `export DEV_TEAM_NO_AUTO_HANDOFF=1` |
| Never write `.dev-team/HANDOFF.md` at all — for a project that keeps its own single handover (on by default; a project whose instructions explicitly forbid a second handover gets `off` without this line) | `features: → handoff-file` | `off` | add `handoff-file=off` to a request |
| Stop the per-task local commits (on by default; never pushes either way) | `features: → auto-commit` | `off` | `export DEV_TEAM_NO_AUTO_COMMIT=1` |
| Reflect work in GitHub/GitLab issues as it's done (off by default) | `defaults: → issues` | `auto` (or `sync`) | add `issues=auto` to a request |
| Default to cheaper models | `defaults: → models` | `economy` | say "keep costs down" / add `models=economy` |
| Force both guard hooks on at all times (the Bash safety net and the ledger guard's Rule 2) | `features: → guard` | `on` | `export DEV_TEAM_GUARD=1` |
| Skip the `.dev-team/` pointer-sentence offer without answering it each run | `features: → pointer-sentence` | `declined` | — |
| Never stack PRs (the safe default) / allow it | `git: → stack-prs` | `false` / `true` | — |
| Converge on one open PR per line of work (reuse existing PR, not a duplicate) | `git: → single-pr` | `true` (default) / `false` | — |

Each row is one setting; you can set as many as you like in the same file. The `features: → update-notifier` notation means the `update-notifier:` line goes *underneath* a `features:` line (see the YAML example above). When both a config value and a per-session override exist, the [precedence rules](#full-reference) decide which wins.

### Full reference

**Precedence (highest to lowest):** per-run argument (e.g. `models=economy`) > plain language in the invocation (e.g. "keep costs down") > per-session environment variable (e.g. `DEV_TEAM_NO_UPDATE_CHECK`) > an explicit value in repo `.dev-team/config.yml` > a repository instruction file (`AGENTS.md`, `CLAUDE.md` and the like), which can only move a switch toward its more cautious value and cannot touch the switches the hooks read (`guard`, `update-notifier`, `branch-notifier`) > built-in default. The more cautious value for each switch is listed in [`config-and-toggles.md`][config-toggles], "Repository instruction files and these switches". A missing or unreadable `.dev-team/config.yml` simply drops out of the chain — **fail-open** everywhere it's read: an absent file, a malformed file, or one bad/unrecognized key never blocks a hook, errors out a skill, or takes down the rest of the file's valid keys.

**Schema overview** (`version: 1` is the only required key — everything else is optional and falls back to its built-in default):

- **`defaults:`** — repo-wide overrides for existing run arguments: `models` (economy/balanced/max, default `balanced`), `gates` (autopilot's gate policy, default `hybrid`), `cap` (autopilot convergence cap, default ~30), `cycles` (iterate's cycle cap, default `5`), `issues` (`off`/`sync`/`auto`, default `off`; `sync` exports at the normal sync points, `auto` reflects each item continuously as it completes/closes (per-task cadence); security findings still need the separate `sync-security` opt-in; platform is GitHub (`gh`) or GitLab (`glab`), auto-detected from the git remote, and a plain-git repo with no platform simply skips issues).
- **`git:`** — `stack-prs` (`true`/`false`, default `false`), `single-pr` (`true`/`false`, default `true`), and `default-branch` (`auto` or an explicit branch name). `stack-prs: false` is the **no-stack policy**: by default every run branches FROM and targets the default branch and never stacks a PR on another feature branch (a merge-race hazard) — stacking requires both `git.stack-prs: true` **and** an explicit per-run ask. `single-pr: true` is the **single-PR policy**: when a run's branch already has an open PR, the suite reuses (pushes to) that PR instead of opening a duplicate — **one open PR per line of work** — so parallel PRs don't race to merge the same change (it never auto-opens or auto-merges a PR; the branch is still handed back for review). See [conventions.md][conventions] ("PR base, no-stack & single-PR policy").
- **`features:`** — repo-wide on/off toggles, each with an optional per-session env override:

  | Toggle | Governs | Values | Per-session env override | Built-in default |
  |---|---|---|---|---|
  | `update-notifier` | SessionStart update check | `on`, `off` | `DEV_TEAM_NO_UPDATE_CHECK` | `on` |
  | `branch-notifier` | SessionStart gone-branch notice | `on`, `off` | `DEV_TEAM_NO_BRANCH_CHECK` | `on` |
  | `guard` | `hooks/guard-dev-team.sh` (Bash safety net) **and** `hooks/guard-ledgers.sh` (Write/Edit/MultiEdit ledger guard — see [Hooks & environment switches](#hooks--environment-switches)) | `on`, `off`, `auto` | `DEV_TEAM_GUARD` (force-ON — makes **both** hooks check every call regardless of whether a run is active) | `auto` (each hook judges "is a run active" its own way — see below) |
  | `notifications` | Autopilot gate/blocked/done notifications | `on`, `off` | none yet — config-only | `on` |
  | `telemetry` | Run-end telemetry + cost estimate | `on`, `off` | none yet — config-only | `on` |
  | `dry-run` | Default plan-preview for building skills | `on`, `off` | none yet — config-only (a per-run argument still overrides for one run) | `off` |
  | `auto-handoff` | Regenerate the assistant-agnostic `.dev-team/HANDOFF.md` after every completed task/workstream | `on`, `off` | `DEV_TEAM_NO_AUTO_HANDOFF` | `on` |
  | `handoff-file` | Whether `.dev-team/HANDOFF.md` exists at all (v1.6.0). `off` = the plugin writes no `.dev-team/HANDOFF.md` at all — not per task, not at checkpoints or RECORD, not at the end of an autopilot cycle — and resumes from `.dev-team/PROJECT.md` (and `autopilot.json`) instead. While unset (the starter file leaves every setting commented out), a project whose own instructions explicitly forbid a second handover gets `off` automatically; a value set here wins over that | `on`, `off` (also `true`/`yes`, `false`/`no`, any capitals; anything else is reported and counts as `off`) | none — config-only (a per-run `handoff-file=on|off` still overrides for one run) | `on` |
  | `auto-commit` | Local per-task commit of each completed-and-checked workstream (never pushes, never opens a PR) | `on`, `off` | `DEV_TEAM_NO_AUTO_COMMIT` | `on` |
  | `pointer-sentence` | Whether an interactive run offers to add the `.dev-team/` pointer sentence to `CLAUDE.md` / `.claude/CLAUDE.md` / `AGENTS.md` / `GEMINI.md` (v1.5.0) | `ask`, `declined` | none — config-only | `ask` (not yet asked) |

  For `guard` specifically, the values aren't a simple on/off pair, and — since v1.5.0 — one toggle governs **two** hooks that each judge "is a run active" a different way. `hooks/guard-dev-team.sh`: `off` disables it repo-wide **even if** `DEV_TEAM_GUARD` is set; `on` forces it active regardless of whether a run is in progress; `auto` (default) preserves today's behavior — active only while `.dev-team/autopilot.json` exists, unless `DEV_TEAM_GUARD` forces it on. `hooks/guard-ledgers.sh` splits by rule: Rule 1 (a write to one of the seven ledger names *plus* `README.md`, whose content carries the marker, once the path's `.`/`..` parts are worked out, outside `.dev-team/`) stays **on** in `auto` mode regardless of whether a run is active — only `off` disables it, because the mistake it guards against (a stale instruction writing a ledger, or the plugin's own marked `.dev-team/README.md`, to the legacy root) can happen in a one-off session just as easily as inside a run. `README.md` is on Rule 1's list only — Rule 2's list stays at the seven ledger names — because the plugin writes a marked README into `.dev-team/`, and leaving it off Rule 1 would let a mistaken write overwrite a project's own top-level `README.md` unchecked; an absolute path that resolves to somewhere outside the project is likewise treated as outside `.dev-team/`. Rule 2 (a top-level ledger file whose incoming text looks like plugin output) is active only while `.dev-team/loop.lock/` exists, `guard: on` is set, or `DEV_TEAM_GUARD` is set, and **never** merely because `.dev-team/autopilot.json` exists — some real projects keep that file committed, which would otherwise make Rule 2 permanently on and stop the project owner ever editing their own top-level `HANDOFF.md` or `FEATURES.md` again. When a session starts in a subfolder of the repository, Rule 2 guards that subfolder's own top-level ledger names too (never `<subfolder>/.github/` or `<subfolder>/docs/`) — because every skill writes `.dev-team/<name>` relative to the folder the session starts in, so a subfolder session's "old top-level place" can be that subfolder, and guarding both is safe whichever one is meant. `guard: off` turns **both hooks entirely off**, and wins over a session's `DEV_TEAM_GUARD` either way; `DEV_TEAM_GUARD` forces **both hooks** on. Full reasoning: [`config-and-toggles.md`][config-toggles].

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
| Scribe | [`sonnet-scribe`][sonnet-scribe] | sonnet | Documentarian: `.dev-team/PROJECT.md` / `.dev-team/FEATURES.md` / `.dev-team/SECURITY.md` / `.dev-team/VERIFICATION.md` upkeep, ledgers, run records, `.dev-team/HANDOFF.md`, `.dev-team/autopilot.json` budget bookkeeping. |
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

**Autopilot budget auto-tighten** (autopilot only; see [loop-runtime.md][loop-runtime]): the `autopilot.json` `budget` block tracks per-tier spawn counts and cycles — a spawn-count trend, not a real spend figure. When frontier (Fable+Opus) spawns/cycle sustainedly exceed `threshold_per_cycle` (~6), `spend_posture` flips to `heavy`; if `budget-autotighten=on` (default) and posture is above economy, the loop steps posture **down one notch** (max → balanced → economy) for **build work only**, and surfaces it in the iteration report (e.g. "budget: auto-tightened balanced→economy at cycle 14"). It never touches verification. Disable with `budget-autotighten=off`. Always shown via [`/dev-team-status`](#commands); rolled into `.dev-team/HANDOFF.md` as a one-glance resume card.

### Taste-first orchestration profile (optional)

An optional profile layered on top of routing ([orchestration-profiles.md][orchestration-profiles]). The highest-taste model runs the **session/orchestrator**; bulk/mechanical work goes to the cheapest capable executor. Because the plugin can't set the session model itself, set it yourself: `/model fable` (or settings `{"model":"fable"}`). Rules in brief: the orchestrator is the top-taste tier; anything user-facing (UI, copy, API design, error messages) stays on a Claude taste tier; **verification stays frontier**; cost is only a tie-breaker (intelligence > taste > cost for anything that ships); escalate freely.

**Optional GPT-5.5 / Codex offload.** With the `openai/codex-plugin-cc` plugin and the `codex` CLI on PATH, token-hungry clear-spec work — implementation, multi-file refactors, migrations, data analysis, bulk codebase reading — can be routed to GPT-5.5/Codex via the plugin's native commands (`/codex:rescue`, `/codex:review`, `/codex:adversarial-review`, `/codex:status`/`/codex:result`/`/codex:cancel`) to keep delegation observable. Detection-first and fail-silent: if Codex is absent, it falls back to Sonnet/Haiku. Codex may **add** an adversarial perspective but **never replaces** the Claude verifier; all primary verification and user-facing work stay on Claude.

### Escalation

Start a mechanical-looking workstream on `quick-edits` (Haiku); on a genuine **capability** failure (not a bad-brief failure), escalate one tier at a time — **Haiku → Sonnet → Opus → Fable**. The two-strike rule applies: strike one may be a bad brief (re-brief, same tier); a second, capability-bound failure escalates the tier. Never escalate verification below Opus. "Judge the output, not the price tag" — tiers are defaults, not limits.

### Cross-cutting behaviors

Seven behaviors apply the same way across the suite rather than being restated per skill: the first to every agent, in every skill; the other six to every building skill (orchestrator, iterate, security, stripe, ship, docs, migrate). Canonical source: [conventions.md][conventions].

- **Repository instructions and normative documents.** Every agent reads a project's own developer/agent instructions (`AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `GEMINI.md`, `.OpenAI/`/`.openai/`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`) at the repository root and in the folders a task touches, and reads, from the snapshot copies, any normative document one of them names for the kind of work in hand — in full, or, when one is too large to read whole, by its scope, definitions and profile sections plus every section holding a rule ID that applies (every section relevant to the task, if it has no rule IDs), listing which sections were read. **Trusted sources only — a snapshot taken when the run starts:** the checkout you start the run on is treated as your own. Before any agent is spawned (and, under autopilot, before its run branch is created), the lead copies every instruction file and normative document it finds there, and `.dev-team/config.yml`, into a new, uniquely named run folder outside the project, `~/.dev-team/runs/<run-id>/snapshot/` — the copies in its `files/` folder, each at its path in the project, and beside that folder a manifest naming the repository, the run id and a SHA-256 checksum per file, so a project file can never collide with the plugin's own records — and a dry run writes only there. Those copies are the instructions for the whole run, your uncommitted edits included; agents read the copies, and a project file that later differs, or an instruction file that did not exist at the start, is data, even when the host tool has already loaded it. If the folder cannot be written or read, or does not match, the run stops (unattended: `BLOCKED`) rather than fall back to the project's files; the folder is kept afterwards. Resuming a recorded, unfinished run reuses that run's snapshot after checking it — a missing or changed snapshot stops the run with a plain message, never a new snapshot — and only a new run takes a new one. Someone else's pull request is handled only by a skill that checks it out itself (ci-medic): it copies that pull request's instruction files from its base commit's own tree into `snapshot/pr/<n>/files/`, with their own manifest beside that folder, never from the checked-out text, and the run's settings stay your own. **What this cannot do:** if you start a run on someone else's code, the plugin reads their instructions as yours — start from your own branch. Rules written as instructions cannot stop an agent that has been manipulated from rewriting files it can reach, the run folder included. Keeping the snapshot outside the project stops git operations (a checkout, a commit, a pull request's changes) from changing it, but not a command the run executes — the project's own scripts included — and the checksum catches accidental damage only; none of this is an enforcement boundary. The only enforcement the plugin itself provides is its two guard hooks, and both fail open: the Bash guard acts only during an autopilot run, with `guard: on`, or with `DEV_TEAM_GUARD` set; it reads a Bash command's text with the shell's quotes and backslashes taken away, and refuses a push that names `main`/`master`, a push that names no branch when git's own settings show it would go to `main`/`master`, and a live Stripe key — a branch held in a variable, a push run from a script, and a push that names no branch whose destination it cannot tell (after a `cd` in the same command, outside a git repository) all go through; the ledger guard sees only Write, Edit and MultiEdit, not Bash, and refuses plugin record content written to the wrong place. Both read the live `.dev-team/config.yml`, where `guard: off` turns them off. Server-side branch protection is the real protection for pushes. Content the repository does not author (vendored code, dependency caches, build output, submodules) and links that leave the repository never count either. The rule covers repository content only: your own `~/.claude/CLAUDE.md`, `CLAUDE.local.md` and skills are your words. Where instruction files at different levels differ, the one nearest the files being changed applies. The lead decides which profile of a normative document applies and records it; a brief names the document's path, rule IDs and profile **by reference, not by copy**. Repository-required tests are run, with commands only from the user, the plugin's usual build, test and lint steps for the project's toolchain, or a snapshotted instruction file — never from a normative document alone, or from a file that changed during the run. A checker or reviewer does its own discovery, cites the rule IDs it checked, and treats a breach as a real finding; a named document that cannot be found is stated plainly. Two same-level repository sources that contradict each other are put to the user; in an unattended run the affected item is marked `BLOCKED`. Full rule: [conventions.md][conventions], "Repository instructions and normative documents". **The suite's safety rules are never overridden by repository content.** Which way repository content may move things:
  - Repository content (instruction files and normative documents) may **add** work, checks and constraints, and may **choose between style and format defaults** (documentation length, where notes live, naming, formatting); where it does, follow it and say so in the report.
  - It may **never remove, skip, weaken or waive** any of these: any check or verification step (the checker, independence between builder and verifier, evidence requirements, the model-tier rules); any gate or approval (the Feature Spec Gate, the gate policy, the autonomy envelope, `live=confirm`); any confirmation; anything a skill calls non-negotiable (for example the security, ci-medic and stripe skills' non-negotiable rules), or anything under "Safety (security & stripe)"; the rules on pushing, merging, force-pushing, pull requests and branches (never committing straight onto the default branch without asking); ledger and file ownership; privacy (for example keeping security findings private); the handling of secrets.
  - A repository instruction may move a plugin switch **only toward its more cautious value** (for example `handoff-file: off`, `gates: pause-all`, `issues: off`). Loosening a switch needs `.dev-team/config.yml` or the user in the run, and an explicit value in `.dev-team/config.yml` wins over an instruction file, because it is the user's own setting.
  - Per-run arguments (`autofix`, `depth`, `remediate`, `sync-security`, `pr=`, `--apply` and the like) come from the user only, never from repository content.
  - Instruction files cannot affect the switches the hook scripts read — `guard`, `update-notifier` and `branch-notifier` — at all: the hooks read those only from `.dev-team/config.yml` and their per-session environment variables.
  - **If it is unclear which side something falls on, treat it as a safety rule and ask** (in an unattended run, mark the item BLOCKED).
  - An instruction that would need one of these removed, skipped, weakened or waived is not followed; that part of the work stops and is reported.
- **Dry-run / plan-preview.** `dry-run=on` (per-run argument) or `features.dry-run: on` (repo `.dev-team/config.yml`; default `off`) makes a building skill produce its full plan and the briefs it WOULD issue, spawn **no builders**, and make **no file or git changes** in the project — it stops after planning and reports the plan for approval. The one thing it writes is its instruction snapshot, into the run folder outside the project. Precedence: per-run argument > plain language ("just show me the plan", "dry run first") > repo config > built-in default `off`. `dev-team-review` is unaffected — it's already read-only. Fail-open: a missing/unreadable config just leaves dry-run off.
- **Cold-resume.** At the front of a run, a skill checks for its own prior owned artifact + run record before doing fresh work — `.dev-team/PROJECT.md` (orchestrator, iterate, stripe, and docs' Current-status note), `.dev-team/SECURITY.md` (security), `.dev-team/VERIFICATION.md` (review), `.dev-team/MIGRATION.md` (migrate), `.dev-team/FEATURES.md` (a later featurefind run). If a current one validates (a git-drift check plus a small spot-check against the real repo), the skill **resumes** from it instead of restarting cold; if it's missing, stale, or the tree is dirty in a way that invalidates it, it starts fresh. A resume reuses the resumed run's instruction snapshot after checking it, and never takes a new one; a run recorded before 1.6.0 has none (see [conventions.md][conventions], step 1); only a new run does. Always attempted, never a toggle. `dev-team-ship` and `dev-team-ci-medic` have no cold-resume mechanic of their own.
- **Where the plugin writes, and the ownership rule.** Every one of the files above lives in the project's `.dev-team/` folder, never at the top level, in `docs/`, or in `.github/` — a project can have its own `FEATURES.md` or public `SECURITY.md`, and before this rule existed the plugin once appended its findings onto a real project's security policy. Each ledger carries a marker on line 2 (`verdict.json` carries one as a JSON field) that is the plugin's *only* proof a file is its own. Before writing one of its record files (the six markdown ledgers, `verdict.json`, or `.dev-team/README.md`), a skill reads the target first: file absent → create it with the marker; marker present → write it; **no marker → write nothing, and ask a person** rather than guess (an unattended autopilot cycle goes `BLOCKED` instead of guessing). A file written before this rule existed is still found automatically through a lookup order (`.dev-team/<name>` first, then the old top-level `<name>`), and `/dev-team-move-ledgers` moves a whole project's worth of them at once — see [Upgrading from 1.4 or earlier](#upgrading-from-14-or-earlier). Full rule, and what it cannot do: [conventions.md][conventions], "Where the plugin writes, and the ownership rule".
- **Autopilot notifications.** When `features.notifications: on` (default), the `dev-team-autopilot` conductor surfaces a prominent, clearly-marked notice at three events: a gate item **QUEUED** for approval, a **BLOCKED** pause, and a terminal **DONE**/cap — each its own report line, not buried in a routine cycle update. You may additionally wire a Claude Code Notification/Stop hook or a push-notification integration for delivery outside the terminal (optional, not required for the in-report notice). `features.notifications: off` skips the notice entirely; fail-open otherwise.
- **Auto-handoff.** `auto-handoff=on` (feature toggle, default `on`) regenerates `.dev-team/HANDOFF.md` after **every** completed task/workstream — not only at stage checkpoints / RECORD. The card is **assistant-agnostic**: any LLM coding tool (Claude, Codex, Gemini, …) can read it cold, at the fixed path `.dev-team/HANDOFF.md`. It's committed alongside the work it describes so it travels with the repo for the next session or teammate (these behaviors never auto-push it). Owned by `sonnet-scribe`. Precedence: per-run argument > plain language > per-session env `DEV_TEAM_NO_AUTO_HANDOFF` > repo `.dev-team/config.yml` (`features.auto-handoff`) > built-in default `on`. Fail-open. A second switch, `handoff-file` (default `on`), decides whether the file exists at all: `handoff-file=off` means no `.dev-team/HANDOFF.md` is ever written — not per task, not at checkpoints or RECORD — and resume uses `.dev-team/PROJECT.md` (and `autopilot.json`). `off` wins over `auto-handoff`, even a per-run `auto-handoff=on`. A project whose own instructions explicitly forbid a second handover gets `handoff-file: off` automatically, unless `.dev-team/config.yml` sets a value; an instruction that only says where the project's notes live does not turn it off — an attended run asks once and records the answer in `.dev-team/config.yml`, an unattended run keeps the default and says so. The lead settles the value once per run and hands it to the scribe in its documentarian brief; the scribe never writes into the handover or session-notes file the project's own instructions name. `off`, `false` and `no` (any capitals) mean off, `on`, `true` and `yes` mean on, and any other value is reported and treated as `off`.
- **Auto-commit.** `auto-commit=on` (feature toggle, default `on`) makes each **completed-and-checked** task/workstream its own **local** commit whose message names the task — additional fine-grained rollback points *between* the existing per-checkpoint / per-cycle commits, never replacing the checkpoint commit, and only for integrated+verified units (preserving *never commit a broken/unverified state*). It **never pushes** and **never opens a PR** — pushing stays your explicit choice. Precedence: per-run argument > plain language > per-session env `DEV_TEAM_NO_AUTO_COMMIT` > repo `.dev-team/config.yml` (`features.auto-commit`) > built-in default `on`. Fail-open.

---

## Artifacts glossary

Every file the suite reads/writes. All ledgers are owned by the `sonnet-scribe` documentarian.

Every one of the seven ledgers below lives in the project's `.dev-team/` folder (never at the top
level, in `docs/`, or in `.github/`) and carries the dev-team marker on line 2 (a JSON field for
`verdict.json`) — see [Where the plugin writes, and the ownership rule](#cross-cutting-behaviors).
A file written before v1.5.0, still at the project's top level, is found automatically through a
lookup order and never confused with a project's own same-named file — see
[Upgrading from 1.4 or earlier](#upgrading-from-14-or-earlier).

| File | Written by | Purpose |
|---|---|---|
| `.dev-team/PROJECT.md` | `sonnet-scribe` (orchestrator / iterate / security / stripe) | Human-readable source of truth: Goal, Definition of done, Constraints, Skills in play, House style, Stage plan, Current status (always overwritten for cheap cold-resume), Decision log, Checkpoint log, Feature Specs. iterate adds Codebase Map, Run record, Backlog, Proposed-Features ledger, Trajectory ledger. Read by every skill. Schema: [documentarian-protocol.md][documentarian-protocol] (+ [audit-and-backlog-protocol.md][audit-backlog] for iterate). |
| `.dev-team/FEATURES.md` | `sonnet-scribe` (via featurefind) | Scored feature-gap ledger (`FG-` items, citation per claimed competitor feature). Read by iterate and autopilot. Schema: [gap-scoring-rubric.md][gap-rubric]. |
| `.dev-team/SECURITY.md` | `sonnet-scribe` (via security) | Findings (`F-` items under `#Findings`) and the remediation record from the adversarial audit. Read by review, autopilot, and a later security resume. Schema: [threat-model-and-surface-protocol.md][threat-model]. |
| `.dev-team/VERIFICATION.md` + `.dev-team/verdict.json` | `sonnet-scribe` (via review) | Independent QA/verification evidence and verdicts (`V-` items); `verdict.json` is machine-readable for CI gating. Read by the user and autopilot's VERIFY phase. Schema: [verdict-and-report-protocol.md][verdict-protocol] for the markdown report, [verdict.schema.json][verdict-schema] for `verdict.json`'s own JSON shape. |
| `.dev-team/MIGRATION.md` | `sonnet-scribe` (via migrate) | This skill's own external memory: the Migration Plan (strategy, staged breakdown, risk sizing), the Stage Ledger (`M-` items — one per stage, its own commit), and the compatibility-shims-in-play table. Read by review and a later migrate resume. Schema: [migration-plan-protocol.md][migration-plan-protocol]. |
| `.dev-team/autopilot.json` | autopilot conductor (fields updated by `sonnet-scribe` each RECORD step) | Machine-authoritative run state (read first every iteration, rewritten last): mission/done, plan/phase cursor, state, next action, gate ledger (`G-` items), blocked, cycle/cap, verify, budget block, lock, branch, last commit, trajectory ref, and where the run's instruction snapshot is kept (its run id and folder path, written once, by the conductor, at bootstrap). Schema: [loop-runtime.md][loop-runtime]. |
| `.dev-team/HANDOFF.md` | `sonnet-scribe` (all modes) | Derived, always-regenerated **assistant-agnostic** resume card at the fixed path `.dev-team/HANDOFF.md`, readable cold by any LLM coding tool (Claude, Codex, Gemini, …); built from `.dev-team/PROJECT.md#Current status` and regenerated after every completed task/workstream when `auto-handoff` is on, and never written at all when `handoff-file` is `off` (see [Cross-cutting behaviors](#cross-cutting-behaviors)). Committed alongside the work it describes; a convenience surface, never itself a source of truth. Schema: [handoff-template.md][handoff-template]. |
| `.dev-team/README.md` + `.dev-team/.gitignore` | any skill, created once if absent, never overwritten | A short explanation of the folder for anyone browsing the repo, and a `.gitignore` that keeps `loop.lock/` (which only means "a cycle is running right now") out of commits. See [conventions.md][conventions], "The first write into `.dev-team/`". |

---

## Hooks & environment switches

Plugin hooks **auto-activate on install**. All are **fail-open** (any error silently allows/exits) and **scoped** — they do the minimum and never block your session.

Since v1.2.0, each hook also reads the repo-scoped [`.dev-team/config.yml`][config-toggles]'s `features:` block (best-effort, tolerant grep-based match — never a hard YAML dependency in a PreToolUse/SessionStart hot path) before falling back to its environment-variable switch and built-in default. The env vars below remain a **per-session** override layered on top of the repo config, not a replacement for it — see [Configuration & feature toggles](#configuration--feature-toggles) for the full precedence chain.

| Hook | Event | Purpose | Disable with |
|---|---|---|---|
| [`hooks/check-update.sh`][check-update] | SessionStart | Layer-2 fallback update notifier: at most once per 24h, compares local vs. remote `plugin.json` and prints a one-line update notice if newer. Never updates anything; fails open/silent on missing `gh`/`jq` or network error. | `DEV_TEAM_NO_UPDATE_CHECK` (session), or `features.update-notifier: off` in `.dev-team/config.yml` (repo-wide) |
| [`hooks/guard-dev-team.sh`][guard] | PreToolUse (Bash) | Best-effort safety net (one layer, never the guarantee). While it is active (next column), it reads each Bash command's text the way the shell reads the ordinary spellings of a word — quotes and backslashes taken away, bash's escapes inside `$'…'` worked out, and a command string given to `sh -c`/`bash -c` (after any options and a `--`) or to `eval` read as well — and refuses three things: a `git push` that names `main` or `master` (as a plain word, in a refspec such as `HEAD:main`, in a brace list such as `{main,x}`, in single or double quotes, behind a backslash, or spelled with escapes such as `$'\x6d\x61\x69\x6e'`), a force-push included, and one written out in the command's text for a shell to read from its standard input (`echo 'git push origin main' | sh`, `sh <<< 'git push origin main'`); a `git push` that names no branch (`git push`, `git push origin`, `git push origin HEAD`, git's "matching" refspec `git push origin :`, `--all`, `--mirror`) when the repository's own git settings — the current branch, the branch it tracks, `push.default`, `remote.<name>.push`, a remote set up as a mirror (`remote.<name>.mirror`, which pushes every branch), and the command's own `-C`/`-c` options — show it would push to `main` or `master`, and likewise a branch named with no destination (`git push origin feature`) that `remote.<name>.push` or `push.default=upstream` would send to `main` or `master`; and any live Stripe key pattern (`sk_live_`/`rk_live_`/`pk_live_` — dev-team is test-mode only). It also refuses, on purpose, two commands it cannot finish checking — one with more than 10 `git push` commands, and one whose checking takes longer than 20 seconds — with a message asking for the command to be split, because letting them through would let a longer command switch the guard off; otherwise its time grows in step with the command's length (measured: a 10,000-line heredoc or a 129 KB `git commit -m` in about half a second with macOS's bash 3.2 and awk, and in about a fifth of a second on Linux). **What it cannot see:** it does not run the shell, so anything the shell only works out while the command runs goes through — a branch or command held in a variable or a default value (`${X:-main}`), or made by another command (`$(…)`), by arithmetic, by a glob, or by braces that build a word from parts; a script, an alias, a git alias, or a command put together by another program (`xargs`, `env -S`); a command string nested more than three levels deep; a push that names no branch where it cannot tell the destination (an earlier `cd`/`pushd` in the same command, `env -C <dir>`/`env --chdir=<dir>` in front of git, a `GIT_*` variable set in it, a folder that is not a git repository, a detached HEAD) goes through; it knows no protected branch other than `main` and `master`; and without `jq` it only scans the raw hook input as plain text. The other way round, because it reads the command text through quotes, it also refuses a command that only mentions a push to main, such as `git commit -m 'fix: push to main'` or `echo 'git push origin main'`. Any parse error → silently allows. Server-side branch protection is the real protection for pushes. | `features.guard: off` in `.dev-team/config.yml` disables it repo-wide (wins even over `DEV_TEAM_GUARD`); otherwise it only engages when `.dev-team/autopilot.json` exists **or** `DEV_TEAM_GUARD` is set — unset `DEV_TEAM_GUARD` and/or remove `.dev-team/autopilot.json` to stop it firing for a session. |
| [`hooks/guard-ledgers.sh`][guard-ledgers] | PreToolUse (Write, Edit, MultiEdit) | Best-effort safety net for the `.dev-team/` rule above, two separate checks, both judging the path with any `.`/`..` parts worked out first (`.dev-team/../SECURITY.md` starts with `.dev-team/` as plain text but names the top-level file — this hook resolves that before deciding). Rule 1 (always on unless `guard: off`): refuses a `Write` only when **all three** hold — the new content carries the dev-team marker on one of its first three lines, the target's file name (ignoring capitals) is one of the seven ledger names *plus* `README.md`, and the resolved path lands outside `.dev-team/`. `README.md` is on this list because the plugin also writes a marked `.dev-team/README.md`; without it, a mistaken write of that fixed text could overwrite a project's own top-level `README.md`. That is one narrow shape — for example a person pasting a copy of a ledger into `docs/FEATURES.md`, or a folder README written to the wrong path — not a blanket claim that it can never touch a person's own file; to proceed, write the file under `.dev-team/` instead, or set `guard: off`. Rule 2 (only while `.dev-team/loop.lock/` exists — i.e. an autopilot cycle is running right now — `guard: on` is set, or `DEV_TEAM_GUARD` is set): refuses a `Write`, `Edit` or `MultiEdit` to one of the seven ledger names at the project's top level, or to `SECURITY.md` in `.github/`/`docs/` — and, when the session started in a subfolder of the repository, to that subfolder's own top-level ledger names as well (never `<subfolder>/.github/` or `<subfolder>/docs/`, since GitHub never reads a security policy from either), because every skill writes `.dev-team/<name>` relative to the folder the session starts in, so that subfolder can be the "old top-level place" a stale instruction means — but **only** when the incoming text carries the marker or a dev-team record id (`FG-012`, `F-001`, or one running to four digits or more such as `F-1000`, …) — a committed `.dev-team/autopilot.json` alone never triggers it, so a project that keeps that file in git can still edit its own top-level files freely. Neither rule sees a write made through `cat >>` or similar in Bash. | `features.guard: off` in `.dev-team/config.yml` disables both rules repo-wide (wins even over `DEV_TEAM_GUARD`) |
| [`hooks/sync-branches-check.sh`][sync-check] | SessionStart | Network-free, read-only notifier: counts local branches whose upstream shows `gone` and, if >0, points to `/dev-team-sync-branches`. Deletes nothing, makes no network calls, silent when nothing to report. | `DEV_TEAM_NO_BRANCH_CHECK` (session), or `features.branch-notifier: off` in `.dev-team/config.yml` (repo-wide) |

**All environment variables / switches** (per-session overrides layered on top of `.dev-team/config.yml`'s `features:` block — see [Configuration & feature toggles](#configuration--feature-toggles)):

| Variable | Effect | Default (unset) |
|---|---|---|
| `DEV_TEAM_NO_UPDATE_CHECK` | Off-switch for the SessionStart update notifier — set to any non-empty value and it exits before doing anything. | Update check runs, throttled to ≤ once/24h; fails open/silent if `gh`/`jq` missing or network fails. |
| `DEV_TEAM_NO_BRANCH_CHECK` | Off-switch for the SessionStart branch-hygiene notice — set to any non-empty value to suppress it entirely. | Check runs every SessionStart; network-free and silent when the "gone" count is 0. |
| `DEV_TEAM_GUARD` | **Force-ON** switch (not an off-switch) for **both** guard hooks — makes `hooks/guard-dev-team.sh` check every Bash command, and makes `hooks/guard-ledgers.sh`'s Rule 2 active, regardless of whether a run is active (that hook's Rule 1 is already on regardless — see [Hooks & environment switches](#hooks--environment-switches)). | `hooks/guard-dev-team.sh` scope limited to an active run (`.dev-team/autopilot.json` present); `hooks/guard-ledgers.sh`'s Rule 2 limited to while `.dev-team/loop.lock/` exists, its Rule 1 on regardless. |
| `DEV_TEAM_GUARD_TIME_LIMIT` | Makes the Bash guard's time limit **shorter**: a whole number from 1 to 19 seconds. Any other value is ignored, so it can never make the limit longer. The tests use it to prove that a command whose checking runs past the limit is refused. | 20 seconds. |
| `DEV_TEAM_NO_AUTO_HANDOFF` | Off-switch for auto-handoff — set to any non-empty value and completed tasks stop triggering the extra `.dev-team/HANDOFF.md` regenerate for this session (the checkpoint/RECORD regenerate still happens; to write no `.dev-team/HANDOFF.md` at all, use `handoff-file: off`). | Auto-handoff runs: `.dev-team/HANDOFF.md` is regenerated after every completed task/workstream. |
| `DEV_TEAM_NO_AUTO_COMMIT` | Off-switch for auto-commit — set to any non-empty value and completed-and-checked tasks stop getting their own local per-task commit this session (checkpoint/cycle commits still happen). | Auto-commit runs: each completed-and-checked task/workstream lands its own local commit (never pushed). |
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

The suite already maintains issue-shaped ledgers — feature gaps (`.dev-team/FEATURES.md`), backlog and proposed features (`.dev-team/PROJECT.md`), security findings (`.dev-team/SECURITY.md`), review verdicts (`.dev-team/VERIFICATION.md`), Migration Stage Ledger items (`.dev-team/MIGRATION.md`), and gate-deferred items (`.dev-team/autopilot.json`). Issue sync exports them to your project's tracker — **GitHub (via `gh`) or GitLab (via `glab`), auto-detected from the git remote** — so they're actionable in your real tracker instead of trapped in markdown. A plain-git repo with no detected platform simply skips issue sync (auto-handoff and auto-commit still work). It's **opt-in** and owned by the `sonnet-scribe` agent (cheap bookkeeping, not reasoning) — full detail in [issue-sync-protocol.md][issue-sync-protocol].

Turn it on two ways:

- The `issues=off|sync|auto` argument (default **off**) on `dev-team-iterate`, `dev-team-security`, `dev-team-featurefind`, `dev-team-review`, `dev-team-autopilot`, or `dev-team-migrate` — `issues=sync` exports that run's ledger items at the normal sync points; `issues=auto` continuously reflects each item in the tracker as it completes/closes (per-task cadence). Both stay **confirm-first on the first sync per repo** and dedup-safe (and security findings still need the separate `sync-security` opt-in). [dev-team-docs](#dev-team-docs) also takes `issues=off|sync|auto`, to export its `audit` mode's drift findings.
- [`/dev-team-sync-issues`][cmd-sync-issues] — run a sync pass over the current repo's ledgers on demand, independent of any skill run.

**Mapping:**

| Source ledger | Item prefix | Issue label |
|---|---|---|
| `.dev-team/FEATURES.md` (featurefind) | `FG-` | `for consideration` (→ `enhancement` once approved) |
| `.dev-team/PROJECT.md` Backlog (iterate) | `B-` | `enhancement` |
| `.dev-team/PROJECT.md` Proposed-Features ledger | (feature) | `for consideration` |
| `.dev-team/SECURITY.md` findings (security) | `F-` | `security` |
| `.dev-team/VERIFICATION.md` verdicts (review) | `V-` (fail) / `I-` | `bug` / `enhancement` |
| `.dev-team/MIGRATION.md` Stage Ledger (migrate) | `M-` | `enhancement` |
| `.dev-team/autopilot.json` gate-ledger | `G-` | `for consideration` |

**Dedup is the core.** Each ledger item carries an `issue:` field holding its GitHub/GitLab issue number once synced. An item with no `issue:` ref gets a new issue created (and the returned number written back); an item that already has one is updated in place — never a duplicate. The hidden `<!-- dev-team:<id> -->` footer marker is the identity backstop if a ledger ref is ever lost.

**Close-on-done.** When an item's status becomes resolved/built/verified/merged, its issue is closed with a reference to the delivering commit/PR; a re-opened item re-opens its issue.

**Confirm-first.** The first sync in a repo shows the set it will create (count + titles) and waits for your go-ahead before creating anything — the suite's standard gate posture. After that, syncs run and report a one-line summary (e.g. "issue sync: +2 created, 3 updated, 1 closed"). `--confirm-each` re-arms per-item confirmation; `--dry-run` reports without touching the tracker (GitHub or GitLab).

**Safety.** Requires the detected platform's CLI authenticated for the repo — `gh` for GitHub or `glab` for GitLab, auto-detected from the git remote; if that CLI is absent/unauthed, or the repo is plain-git with no platform, it does nothing and tells you how to enable it; issue sync never fails the surrounding run. It only ever touches issues it created (via the stored `issue:` ref or the hidden marker) — never edits or closes unrelated issues, and never deletes any issue.

---

## Repo self-audit / CI

The plugin guards its own integrity in CI. [`.github/workflows/plugin-audit.yml`][plugin-audit] (workflow name `plugin-audit`) triggers on every `pull_request` and on `push` to `main`, with **two jobs — both required checks**:

- **`audit`** (id `audit`, `name: audit`) — checks out, installs `jq`, and runs [`scripts/audit-model-ids.sh`][audit-script] followed by [`scripts/audit-ledger-paths.sh`][ledger-audit-script].
- **`test`** (id `test`, `name: test`) — checks out, installs `jq`/`shellcheck`/`bats`, and runs the plugin's own self-tests: [`tests/smoke-structure.sh`][smoke-test] (the delivery shape a marketplace installer relies on), `shellcheck` over `scripts/*.sh hooks/*.sh tests/*.sh`, and `bats tests/scripts.bats` (behavior contracts for the hooks/scripts).

> **Required-check names:** the job `name:` fields are the literal strings **`audit`** and **`test`** — those byte-for-byte strings (not the "plugin-audit / audit" UI form) are what you register as required checks in branch protection / rulesets.

The model-id audit script performs five checks and exits non-zero (`AUDIT FAIL: <reason>`) on any failure, or prints `AUDIT OK`:

1. No dated model id appears in any `.md`/`.json`/`.yml`/`.yaml` file **except** [model-routing.md][model-routing] (prevents model-id drift/rot).
2. Both `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` parse as valid JSON.
3. Each of the five endpoint agent files ([`deep-architect`][deep-architect], [`opus-builder`][opus-builder], [`sonnet-scribe`][sonnet-scribe], [`quick-edits`][quick-edits], [`sonnet-builder`][sonnet-builder]) exists **and** carries a `model:` frontmatter line.
4. No `.claude/agents/` directory exists (plugin agents must live under `agents/` at the plugin root, or installers won't receive them).
5. **Docs-coverage:** every `skills/dev-team-*/` directory name and every `commands/*.md` basename must appear as a substring somewhere in `README.md` — fails (`AUDIT FAIL: <name> not documented in README`) if a skill or command ships without being documented here, so this file can't silently drift out of date again.

The ledger-path audit script ([`scripts/audit-ledger-paths.sh`][ledger-audit-script], added for issue #41) exits non-zero (`LEDGER-PATHS FAIL: <reason>`) if any skill, command, agent or README line still tells a writer to put a ledger at the old top-level location instead of `.dev-team/<name>` with its ownership marker — checking `conventions.md` and every ledger's schema-defining reference file for the correct path (positive checks), and the rest of `skills/`, `commands/`, `agents/`, `hooks/`, `README.md` and `CONTRIBUTING.md` for leftover "repo root" phrasing, a ledger anchor with no `.dev-team/` prefix, or the retired marker form (negative checks) — or prints `LEDGER-PATHS OK`. It checks the plugin's own files only, never a user's project, and only the exact phrases it's told to look for — see the script's own header comment for the full list and what it can't catch. Details and its bats coverage: [`tests/README.md`][tests-readme].

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full repo layout, how to run all of the above locally before committing, and the release flow; the test suite itself (fixtures, how to install `bats`/`shellcheck`) is documented in [`tests/README.md`][tests-readme].

---

## Upgrading from 1.5 or earlier

**Check your `.dev-team/config.yml`.** In versions 1.2 to 1.5, `/dev-team-config init` wrote every
setting out explicitly, at its default. From 1.6.0 on, a value set explicitly in that file wins over
your project's own instruction files (`AGENTS.md`, `CLAUDE.md` and the like), which can otherwise
only move a setting toward its more cautious value — so an old, fully written-out file silently
overrules a cautious instruction (a `CLAUDE.md` that asks for a dry run first loses to
`dry-run: off`). **Comment out (put `# ` in front of) every setting you did not choose on
purpose.** `/dev-team-config` points this out when a file looks like an old fully written-out one.
Files created by `/dev-team-config init` from 1.6.0 on start with every setting commented out.

## Upgrading from 1.4 or earlier

Before v1.5.0 the suite wrote its ledgers (`PROJECT.md`, `FEATURES.md`, `SECURITY.md`,
`VERIFICATION.md` + `verdict.json`, `MIGRATION.md`, `HANDOFF.md`) at the **top level of your
project** — the legacy root location. From v1.5.0 on, every new write goes to `.dev-team/<name>`
instead; the file names themselves don't change, only the folder.

**What happens automatically the next time a run writes ledgers, depends on what it finds:**

- **A legacy top-level file that already carries the dev-team marker** is moved into `.dev-team/`
  and committed **on its own, before any other work** — the first commit on the run's own branch,
  made once that branch exists or has been adopted, never straight onto the default branch without
  asking (see [conventions.md][conventions], "Files from before v1.5.0 — the lookup order"). The one
  exception is `HANDOFF.md` while `handoff-file` is `off`: it stays where it is and is reported,
  because moving it would create the `.dev-team/HANDOFF.md` that `off` rules out
  (`/dev-team-move-ledgers` holds it back too).
- **A legacy top-level file with no marker** makes an **interactive** run stop and ask whether it's
  a pre-1.5.0 dev-team file or your own document — it's never guessed at either way. An
  **unattended autopilot cycle** that hits the same file goes `BLOCKED` (reason `ledger-ownership`)
  instead of asking, since nobody is there to answer.
- **A read-only command or phase moves nothing.** `/dev-team-status`, `/dev-team-report`,
  `/dev-team-approve`, the review skill's verification phase, and docs audit mode each promise to
  change nothing (or one named field), so a marked legacy file is read where it is and the move is
  reported as pending: "`<name>` is still at the top level of the project — run
  `/dev-team-move-ledgers` to move it into `.dev-team/`."

**So there's something worth doing, even though nothing breaks if you don't:** run
`/dev-team-move-ledgers` once — without arguments to preview, then again with `--apply` to move
everything over in one deliberate, reviewable commit, rather than leaving it to whichever run
happens to touch a given file next. Do this **before your first 1.5.0 run**, and above all
**before any unattended autopilot run** — discovering a `BLOCKED` cycle mid-run over a
marker-less legacy file is a worse time to find this out than up front.

**To move everything over deliberately, run `/dev-team-move-ledgers`.** With no arguments it only
reads and reports — a safe, read-only preview of what it would do. Add `--apply` to actually move
things: it `git mv`s each top-level file it can *prove* is the plugin's own (the dev-team marker on
line 2, or the equivalent field in `verdict.json`) into `.dev-team/` and, if it was still carrying
the old marker form, rewrites that to the current one — then makes one commit for the whole move
(never pushed — that stays your choice).

**A file the plugin cannot prove is its own is never moved or touched automatically.** If a
top-level file happens to have the *shape* of one of the plugin's ledgers but no marker — most
hand-written `FEATURES.md` or `HANDOFF.md` files won't, but some will (a heading like "In-scope
gaps", a `NEXT:` line) — the command asks you, one file at a time, whether it's a pre-1.5.0
dev-team file (in which case it's **moved into `.dev-team/` first, and only then stamped** with
the marker, on its own commit) or your own document (in which case nothing is written to it,
ever). **A file with none of that shape is left alone without any question, whatever it's
named** — the command only asks about look-alikes; it never decides by name alone.

**A "mixed" file needs a person.** If a project's own document has had dev-team records appended
into it by an earlier run — the exact failure this whole change exists to stop, seen for real in
one project's public `SECURITY.md` — the command refuses to cut it apart itself and instead tells
you the line where the plugin's part probably starts, so you can separate it by hand into
`.dev-team/<name>`. Getting that boundary wrong either publishes findings as if they were policy,
or deletes part of the policy, and neither would be noticed until much later — which is exactly
why it's a person's call, not the plugin's.

---

## Privacy

- The plugin ships from a **private org marketplace** (MWBMPartners); it is not published to any public registry.
- **Keep secrets out of skill files.** The suite is designed never to embed credentials: it operates in Stripe **test mode** by default, hands you exact GitHub web-UI steps for any secret the pipeline needs (rather than setting secrets itself), and the Bash guard, while it is active, refuses a Bash command whose text contains a live Stripe key pattern. When a secret is required, set it yourself via the GitHub web UI; don't paste credentials into `.dev-team/PROJECT.md`, briefs, or any committed file.

---

<!-- link references -->
[check-update]: hooks/check-update.sh
[guard]: hooks/guard-dev-team.sh
[guard-ledgers]: hooks/guard-ledgers.sh
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
[ledger-audit-script]: scripts/audit-ledger-paths.sh
[branch-hygiene]: scripts/branch-hygiene.sh
[smoke-test]: tests/smoke-structure.sh
[tests-readme]: tests/README.md
[verdict-schema]: schemas/verdict.schema.json
[cmd-dev-team]: commands/dev-team.md
[cmd-status]: commands/dev-team-status.md
[cmd-approve]: commands/dev-team-approve.md
[cmd-sync]: commands/dev-team-sync-branches.md
[cmd-update]: commands/dev-team-update.md
[cmd-watch]: commands/dev-team-watch-prs.md
[cmd-sync-issues]: commands/dev-team-sync-issues.md
[cmd-config]: commands/dev-team-config.md
[cmd-report]: commands/dev-team-report.md
[cmd-move-ledgers]: commands/dev-team-move-ledgers.md

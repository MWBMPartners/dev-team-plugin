---
name: dev-team-orchestrator
description: Run software projects as a team lead / product owner who delegates all implementation to a tiered team of Claude subagents instead of coding alone. Use this skill whenever the user asks to build, create, or ship a non-trivial piece of software — an app, feature, service, refactor, migration, or multi-file project — or whenever they mention an "orchestrator", "agent team", "team lead mode", "delegate to agents", or "parallel agents". Also use it when a task is large enough that splitting it across parallel workers would be faster or higher quality than working solo. Do NOT use for one-file scripts, quick fixes, or questions. This skill is for a single bounded build, feature, or component; for an unattended, long-running drive all the way to production-ready and feature-complete — a self-paced /loop run — use dev-team-autopilot instead.
---

# Dev Team Orchestrator

You are no longer an individual contributor. For this project you are the **team lead and product owner**. You own the goal, the plan, the decisions, and the final quality bar — but you do not write the production code yourself. Your team does. Your team is made of subagents you spawn with the Task tool, drawn from the dev-team model roster — mostly the `opus-builder` agent (Opus tier); see `skills/dev-team-orchestrator/references/model-routing.md` for the full tier → agent → model mapping. These subagents are leaves — they cannot spawn their own subagents; when one skill reuses or activates another, it does so by loading that skill's instructions into the running agent's own context and playing that mode here, not by spawning a self-contained sub-orchestrator that returns.

Think of it the way a good engineering lead does: your leverage comes from clear briefs, sharp reviews, and good decisions — not from typing. Every hour you spend implementing is an hour you're not steering.

Optionally run the *taste-first* profile — top-taste orchestrator (Fable/Opus) + cheap grunt work, with optional GPT-5.5/Codex offload — see `references/orchestration-profiles.md`.

## Your team

You spawn three kinds of agents with the Task tool:

- **Builders / scouts** — the `opus-builder` agent (Opus tier). They implement and investigate.
- **Checker** — the `opus-builder` agent (Opus tier). Reviews the team's code against acceptance criteria and conventions, and **triages**: it tells you what's clean, what it fixed/flagged, and — critically — the short list of *contentious or challenging* spots that need your judgment. You do not read every diff; you read what the checker escalates. Verification stays on the Opus/frontier tier — never routed cheaper (model-routing.md, invariant 1).
- **Documentarian** — the `sonnet-scribe` agent (Sonnet tier). Owns `.dev-team/PROJECT.md`, which is your **external memory**, not just a log: it holds the goal, the plan, every decision, and — kept current — where the project stands right now (current stage, what's done, what's next, open threads). This role runs on the Sonnet tier deliberately to save tokens; recording state doesn't need a frontier model. Because your own context fills up over a long project, treat `.dev-team/PROJECT.md` as the source of truth: a fresh orchestrator should be able to read it cold and know exactly where to resume. Keep it current, and rehydrate from it at stage boundaries rather than trusting memory. Every record file the dev-team suite writes for itself lives in `.dev-team/` and carries the dev-team marker on line 2 (`verdict.json` carries it as a field); a record file at that path without the marker is never written to — the run stops and asks. See `dev-team-orchestrator/references/conventions.md`, "Where the plugin writes, and the ownership rule".

## The operating loop

The whole skill is one loop. You first scope the work into **stages**, then run each stage through delegate → check → checkpoint until the project's definition of done is met:

```
UNDERSTAND → SCOPE INTO STAGES → [ per stage: PLAN → DELEGATE → CHECK → CHECKPOINT → DECIDE ] → VERIFY → done?
```

### 1. Understand the goal

Before spawning anyone, establish (the **documentarian** writes this into `.dev-team/PROJECT.md`):

- **Cold-resume check** — first, look for a current `.dev-team/PROJECT.md` from a prior `dev-team-orchestrator` run in this repo, found through the lookup order in `references/conventions.md`'s "Where the plugin writes, and the ownership rule" (point 5), which never reads a file without the dev-team marker as the ledger (a run record and a `## Current status` that's still valid — validated the way `dev-team-iterate`'s Phase 0 validates its Codebase Map: a git-drift check plus a small spot-check). If it's current, **RESUME** from it — read Current status, the stage plan, and the decision log, and continue from the recorded next action instead of restarting from scratch. If it's missing, stale, or the tree is dirty in a way that invalidates it, start fresh. See `references/conventions.md` ("Cold-resume").
- **Repository instructions and normative documents** — straight after the cold-resume check, apply `references/conventions.md`, "Repository instructions and normative documents": discover the repository's own developer/agent instruction files at its root and in the folders the task touches, from its trusted base only (never from a fork's pull-request content, a vendored or dependency folder, or a link that leaves the repository), and read in full, from the repository, any normative document one of them names for the kind of work in hand. Where such a document assigns different responsibilities to different projects or profiles, decide which profile this repository is. Record the paths, the rule IDs that apply and the profile in `.dev-team/PROJECT.md`'s House style so every later brief can name them by reference rather than re-discovering them. The repository decides how the project's work is done and wins over a plugin default; it never overrides the suite's safety rules.
- **Repo config** — load `.dev-team/config.yml` (if present) for run defaults and toggles (precedence in `references/config-and-toggles.md`).
- **Pointer sentence** — in an interactive run, when one of `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md` and `GEMINI.md` exists and does not already contain it, and `.dev-team/config.yml` does not record an earlier decline, offer once — never add silently — this sentence, word for word, to each of those files that lacks it: "Dev-team plugin state and the current handover live in `.dev-team/` — read `.dev-team/HANDOFF.md` first." This applies whether or not `.dev-team/` already exists, because `/dev-team-config init` can create the folder without offering it. If the user declines, set `pointer-sentence: declined` under `features:` in `.dev-team/config.yml` and tell them, so they are not asked every run. None of those files present → say so in the report and do nothing. See `references/conventions.md`, "Where the plugin writes, and the ownership rule" (point 8).
- **The end goal** in one or two sentences, as the user stated it.
- **Definition of done** — concrete, checkable criteria. "Tests pass", "app runs with `npm run dev` and shows X", "endpoint returns Y". If you can't check it, it isn't done.
- **Constraints** — language, framework, style, things the user said to avoid.
- **Skills in play** — survey your `available_skills` list and note which ones apply to this goal (e.g. a UI/design skill, a testing skill, a docs skill). These encode the user's preferences and house style; you'll route them to the right agents. See "Composing other skills" below.
- **Open questions** — anything genuinely ambiguous.

### 2. Scope the scale and split into stages

Judge the size of the task honestly, then break the path to the final product into **stages** — ordered milestones, each delivering something checkable and building on the last. A stage is bigger than a single agent's task; it's "the app has working auth" or "the data pipeline ingests and validates", not "edit one file".

- Small task → 1–2 stages. Large project → several, sequenced by dependency.
- Each stage states its own goal and its own done-criteria (a subset of the project's).
- The documentarian records the stage plan in `.dev-team/PROJECT.md` so progress is trackable.

You run the inner loop (plan → delegate → check → checkpoint) **once per stage**, and only move to the next stage when the current one's checkpoint passes.

**Match the ceremony to the stage.** Not every stage warrants a full wave + checker + checkpoint. You decide: a trivial stage (add a config file, wire one route) might be a single builder and a quick look; a substantial stage gets the full loop. Don't spin up three agents and a formal checkpoint to do five minutes of work — and don't skip the checker on anything with real logic or risk. This calibration is your judgment call as lead.

### 3. Choose your check-in policy

You decide, per project, how hands-on to be with the user. Pick one at the start and say it out loud in your first reply:

- **Autonomous**: small/clear goal, low stakes → run to completion, report at the end.
- **Milestone check-ins**: medium projects → report after planning, after first integration, and at the end.
- **Decision check-ins**: ambiguous requirements or irreversible/expensive choices → bring the user into key decisions (often after a debate, see below).

Regardless of policy, always come back to the user when: requirements turn out to be contradictory, scope would change materially, something destructive/irreversible is needed, or two debate rounds still leave you genuinely torn.

### 4. Plan the stage and size the team

Within the current stage, break the work into **workstreams** — units one agent can own end-to-end. Then choose team size yourself:

| Situation | Team shape |
|---|---|
| Small but real stage (single feature, a few files) | 1 builder + the checker |
| Independent components (frontend / backend / tests / docs) | 1 agent per component, in parallel + checker |
| Sequential dependencies | Waves: spawn wave 1, check, then wave 2 |
| Big architectural unknowns | Debate first (see Decision Protocol), then build |
| Existing/unfamiliar codebase | Scout agent(s) first — see below — then builders |

**Working in an existing repo? Scout the conventions before building.** Greenfield projects you can just start. But in an existing codebase, agents will reinvent or clash with house style unless someone establishes it first. Send a scout (it modifies nothing) to report, as a first-class output: the test framework and how tests are run, the lint/format config, the directory layout, the dependency manifest, the existing patterns for the kind of thing you're about to build, and — same standing as the rest — the repository's own instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `GEMINI.md`, `.OpenAI/`/`.openai/`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`) and any normative document one of them points to for this kind of work — paths, what each covers, its rule-ID scheme and profiles — read in full from the repository's trusted base. Capture that in `.dev-team/PROJECT.md` and paste the relevant slice — including the normative document's path, the specific rule IDs that apply and the profile you decided on, never the rules themselves copied in — into every builder brief, alongside any user skills (see "Composing other skills"). The repo's own conventions, its own instructions and normative documents, and the user's skills together define "house style"; all of it goes into briefs, and where the repo's own instructions disagree with a plugin default, the repo wins — but never over the suite's safety rules (`references/conventions.md`, "Repository instructions and normative documents").

Rules of thumb:
- Parallelize only work that **doesn't touch the same files**. Two agents editing one file = merge pain you will own.
- **When parallel work spans an interface** (one agent writes an API, schema, or type that another consumes), define that contract yourself *first* — the exact signatures, fields, or shape — and paste it verbatim into both briefs as fixed. Otherwise the two sides drift and won't fit at integration. Defining a contract is not "doing the work"; it's the lead's job.
- **You own dependency changes.** Never let two parallel agents both edit the dependency manifest (`package.json`, `requirements.txt`, `go.mod`, etc.) or run installs — they'll race and clobber each other's locks. Decide the dependencies yourself, make the manifest change (or have one designated agent do it) before the wave, and tell other agents in their briefs: "do not add dependencies or edit the manifest; if you need one, flag it." 
- **Factor shared code out before the wave, not after.** Parallel agents naturally duplicate — each reinvents the same helper, validator, or type. Before delegating, identify the shared utilities/modules the workstreams will all need, decide where they live, and either build them in an early wave or name them in each brief ("use the existing `formatCurrency` in `utils/money.ts`; do not write your own"). Shared code defined up front is the main lever against duplication across agents — same idea as the interface contract.
- 2–5 builders per wave is the sweet spot. More than 6 concurrent usually means your workstreams are sliced too thin.
- Every wave of building is followed by a checker pass before the next wave starts.

### 5. Delegate with real briefs

Agents are talented but have **zero context** beyond what you give them and the repository files your brief names. A lazy brief produces lazy work. Every builder Task must follow the brief format in `references/task-brief-template.md` — read that file the first time you delegate in a project. In short, every brief contains: role, project context, the specific task, constraints, acceptance criteria, what files to touch (and not touch), and what to report back. Project context includes any repository instructions and normative documents that apply — named **by path, rule ID and profile only**; the agent reads the document itself. Never paste a normative document's rules into a brief — a pasted copy is a copy that can drift from the original (`references/conventions.md`, "Repository instructions and normative documents").

Spawn builders and scouts as the `opus-builder` agent (via `subagent_type`). Spawn all agents of a wave **in the same turn** so they run in parallel.

**Demand evidence, not claims.** Agents are optimistic — "tests pass" often means "I expect they'd pass." Every builder brief must require the agent to actually run its code and **paste the real command output** (test run, build log, a sample of the program's output) into its report, not just assert success. A report with no pasted evidence is treated as unverified, and the checker re-runs it anyway.

**Set the efficiency bar in every brief.** Tell agents to write *lean, reusable* code: reuse existing functions instead of duplicating them, factor repeated logic into small well-named modules, delete dead code, and prefer the simplest construction that fully solves the problem. The target is the least code that achieves the best outcome — but be explicit that this means *no duplication and no gold-plating*, **not** code-golf: clarity, correctness, and readability always win over shaving characters. A dense one-liner nobody can maintain is a failure, not an efficiency. Have agents reuse the shared modules you defined (above) rather than rolling their own.

### 6. Check via the checker agent — you only review what's escalated

You do **not** read every diff. After a build wave, spawn the **checker** (the `opus-builder` agent) with the brief format in `references/checker-protocol.md` (read it before your first check). The checker:

1. Reads the code the wave produced and verifies each acceptance criterion.
2. Runs what can be run (tests, build, lint) and reports results.
3. **Judges test quality, not just green/red.** Passing tests prove nothing if they test nothing — a weak or tautological test that passes is a way "done" gets gamed. The checker confirms the tests actually exercise the acceptance criterion (real assertions, meaningful inputs, the failure path), and flags hollow tests.
4. Fixes or flags the routine stuff itself.
5. Returns a triaged report: **clean** items, **flagged-and-handled** items, and a short **NEEDS-LEAD-REVIEW** list — only the contentious or challenging spots where a judgment call, a tradeoff, or a risk genuinely needs you.

You then engage directly **only** with the NEEDS-LEAD-REVIEW list. For each, decide: accept, send back with specific feedback (spawn a rework agent with the original brief + your notes + current state), or reframe the brief. If the checker reports nothing escalated and criteria pass, accept the wave without reading the diffs yourself.

As each task/workstream is accepted (integrated + checked), two behaviors fire when enabled in `.dev-team/config.yml` (both default ON, fail-open; precedence and env off-switches in `references/config-and-toggles.md`, full contracts in `references/conventions.md`): **auto-commit** — you make an ADDITIONAL local commit naming that task/workstream (never push, never PR) as a fine-grained rollback point between checkpoint commits, only ever on a checker-cleared state; and **auto-handoff** — `sonnet-scribe` regenerates the assistant-agnostic `.dev-team/HANDOFF.md` (per `references/handoff-template.md`), which rides in that commit. Skip auto-commit for the session with `DEV_TEAM_NO_AUTO_COMMIT`, auto-handoff with `DEV_TEAM_NO_AUTO_HANDOFF`.

Give feedback the way a good lead does: specific, about the work, with the reason. "The API layer duplicates validation that already lives in `models.py` — remove it there and import instead" beats "clean this up".

### 6a. When an agent comes back failed or stuck

A failed return is information, usually about the brief. Don't just re-run the same brief and hope. Instead:

1. **Diagnose the root cause** — read what the agent produced and what it reported. Did it lack context? Was the task ambiguous? Did it hit a real technical blocker? Was the brief asking for the wrong thing?
2. **Re-brief with concrete implementation guidance** — rewrite the brief to remove whatever caused the failure: add the missing context, spell out *how* to implement the tricky part (the approach, the specific API to use, an example), tighten the acceptance criteria. Vague-in produces failed-out; the fix is specificity.
3. **Two strikes, then escalate.** If a second, clearer attempt still fails, stop throwing agents at it. The problem is likely the plan, not the agent: re-scope the workstream (split it, sequence it differently, or cut it), or bring it to the user per your check-in policy. Repeatedly re-spawning on a broken brief just burns tokens.

### 7. Stage checkpoint

When a stage's waves are integrated and checked, run the **checkpoint**: re-read the stage's done-criteria, run the full check suite, and ask the real question — *is progress matching the plan?* Then:

- **On track** → documentarian records the stage outcome; **commit the work** (a single commit at the passing checkpoint, message naming the stage). This gives a known-good rollback point and writes the plan-vs-actual trail into git as well as `.dev-team/PROJECT.md`. The per-task **auto-commit** commits (above) are ADDITIONAL points BETWEEN these checkpoint commits — they never replace the checkpoint commit. Branch FROM and target the default branch (`main`) for the run — never stack it on another feature branch — unless `.dev-team/config.yml` sets `git.stack-prs: true` (see conventions.md's "PR base / no-stack policy"). Then advance to the next stage.
- **Drifting** (scope grew, an assumption broke, a criterion can't be met as planned) → revise the stage plan, and if it materially changes the project, take it to the user per your check-in policy. Don't commit a drifting/half-broken state as a checkpoint; fix or re-scope first, then commit.

If a later wave goes wrong, the last checkpoint commit is your clean restore point — return to it rather than trying to hand-untangle a bad merge.

The documentarian logs every checkpoint result in `.dev-team/PROJECT.md` so the plan-vs-actual trail is always visible.

### 8. Decision Protocol (debate mode)

For consequential decisions with several plausible options — architecture, framework, data model, build-vs-buy, big refactor strategy — don't guess and don't average. Run a structured debate:

1. Identify 2–4 genuinely distinct options.
2. Spawn one `deep-architect` agent (Reasoning tier) **per option**, in parallel. Each agent's job is to be that option's strongest honest advocate, using the format in `references/debate-protocol.md` (read it before your first debate).
3. Judge the cases against the project's actual criteria (definition of done, constraints, team/runtime realities) — not against which advocate wrote most persuasively.
4. Have the documentarian record the decision and reason in `.dev-team/PROJECT.md`. Future agents get this context in their briefs so the decision sticks.
5. If your check-in policy says so, or the debate is a near-tie on something expensive to reverse, present the options and your recommendation to the user instead of deciding alone.

Use debates sparingly — they cost a wave of agents. Reversible or low-stakes choices you just make yourself, like any lead would.

### 9. Verify and report

The project loop only ends when every project-level done-criterion is demonstrably met — by running it, not by asserting it. At milestones and at the end, report to the user as a lead would: what was built, key decisions (and why), what was verified and how, and anything deferred. Keep it short; point to `.dev-team/PROJECT.md` for the full decision and stage log. At the very end of a run, also emit a short run summary — agents spawned by tier, commits made, and a rough cost estimate, per `references/run-report.md` — honoring the repo's `.dev-team/config.yml` `features.telemetry` toggle (skip only on an explicit `off`; fail-open otherwise).

## Composing other skills

You are not the only skill available. The user may have skills that capture how they like things done — a UI/design skill, a testing convention, an API-style skill, a docs format. Your job as lead is to **route the right skill to the right agent**, the way a lead hands a new hire the team's style guide.

Skills are just files on disk (a `SKILL.md` plus resources), and your agents have file tools — so this works regardless of whether skill auto-loading reaches subagents:

1. **Survey** at project start (step 1): scan `available_skills` and pick the ones relevant to the goal. A frontend-heavy project → the UI skill matters; a data pipeline → probably not.
2. **Match skill to workstream.** Give the UI skill to the agent building the UI, not the backend agent. Don't dump every skill on every agent — that's noise.
3. **Route it in the brief.** In the relevant builder's brief, name the skill and its path and instruct: *"Read the skill at `<path>/SKILL.md` and follow its conventions for this task."* If you know the skill is short and critical, you can also paste its key constraints directly so they can't be missed.
4. **Tell the checker.** When a skill governs a workstream, the checker's brief should say so — "verify the UI conforms to the conventions in `<ui-skill>/SKILL.md`" — so conformance is actually checked, not assumed.
5. **Record it.** The documentarian notes which skills are in play in `.dev-team/PROJECT.md` so the routing survives across stages and a fresh orchestrator inherits it.

Finding a skill's path: skills live in `~/.claude/skills/` (user) or `.claude/skills/` (project). The `available_skills` entries identify them; point agents at the `SKILL.md` inside.

## Arguments

Optional run arguments (defaults in brackets):

- `dry-run=on|off` — produce the full stage/workstream plan and the briefs you WOULD issue, spawn no builders, and make no file or git changes; stop after planning and report the plan for approval. Precedence: this argument > `features.dry-run` in `.dev-team/config.yml` > built-in default [off]. Plain language ("just show me the plan", "dry run first") also sets it. See `references/conventions.md` ("Dry-run / plan-preview").


- **Doing the work yourself.** If you catch yourself writing production code, stop and write a brief. Exceptions: trivial glue during integration (wiring/imports/config to make two agents' outputs connect — never new logic; if integration needs real logic, that's a rework brief, not a lead edit), or a one-line fix surfaced in the checker's NEEDS-LEAD-REVIEW list.
- **Reviewing everything yourself.** The checker triages; you engage with what it escalates. Reading every diff defeats the point.
- **Skipping stages / no checkpoints.** Don't sprint to the final product without checking progress against the plan after each stage.
- **Fire-and-forget delegation.** Spawning builders and pasting output together without a checker pass is not orchestration.
- **Vague briefs.** "Build the backend" is not a brief. If you can't write acceptance criteria, you haven't broken it down enough.
- **Debating everything.** Debates are for consequential, genuinely contested decisions only.
- **Hiding from the user.** Whatever the check-in policy, contradictory requirements and irreversible choices go to the user.
- **Trusting "it works" without evidence.** Builders paste real command output; the checker re-runs. Self-reported success is unverified until shown.
- **Re-running a failed brief unchanged.** A failure means diagnose and re-brief with clearer guidance; after two strikes, re-scope or escalate rather than looping.
- **Letting parallel agents drift across an interface.** Fix the contract first, paste it into both briefs.
- **Burning Opus on bookkeeping.** Decision/stage logging goes to the `sonnet-scribe` documentarian, not a frontier-model agent and not you.
- **Trusting memory over `.dev-team/PROJECT.md`.** On a long project your context drifts; `.dev-team/PROJECT.md` is the source of truth. Rehydrate from it, don't reconstruct from memory.
- **Ignoring the user's other skills.** If a UI/testing/style skill exists, route it to the relevant agent and check conformance — don't let agents invent a style the user already specified.
- **Building on an existing repo blind.** Scout the conventions (test framework, lint config, layout, patterns) before delegating, and feed them into briefs.
- **Parallel agents editing the dependency manifest.** You own dependency decisions; agents flag needs, they don't independently install.
- **No rollback points.** Commit at each passing checkpoint so a bad later wave can be reverted to a known-good state.
- **Trusting green tests blindly.** The checker judges whether tests actually exercise the criterion; passing hollow tests is not "done."
- **Duplication across agents.** If two agents wrote the same helper, factor it out — define shared modules up front to prevent it.
- **Code-golf in the name of efficiency.** Lean means no duplication and no gold-plating, not unreadable density. Clarity and correctness outrank line count.
- **Pasting a normative document's rules into a brief instead of naming it.** Name the document's path and the specific rule IDs that apply; the agent reads the document itself, from the repository, in full. A pasted copy is a copy that can drift from the original the moment it changes (`references/conventions.md`, "Repository instructions and normative documents").

## References

- `references/conventions.md` — the suite's **shared contracts**: artifact ownership & schemas, ID prefixes, the branch model, the flattening rule, gates, and safety. The canonical home for cross-skill facts; read it once.
- `references/config-and-toggles.md` — the `.dev-team/config.yml` repo-scoped schema, precedence rules, the feature-toggle → env-override table, and fail-open loading. Read before relying on any run default or toggle.
- `references/task-brief-template.md` — brief format for builder/scout agents. Read before your first delegation.
- `references/checker-protocol.md` — brief and triage format for the checker agent (what to escalate vs. handle). Read before your first check.
- `references/debate-protocol.md` — prompts and judging rubric for debate mode. Read before your first debate.
- `references/documentarian-protocol.md` — `PROJECT.md` structure and the `sonnet-scribe` documentarian's brief. Read when you first set up the project.
- `references/orchestration-profiles.md` — optional taste-first profile: top-taste orchestrator (Fable/Opus) + cheap grunt work, with optional GPT-5.5/Codex offload. Read if you want more taste per token than the default roster.
- `references/run-report.md` — the run-report spec: what a run summary contains, the rough cost-estimate method and its caveat, and the `features.telemetry` toggle. Read before the final "Verify and report" step.

<!--
  File:    .claude/plans/owner-standard-features/feature-map.md
  Purpose: The owner's standard working-practice features (from the instruction block pasted on 13 September 2026,
           plus their personal ~/.claude/CLAUDE.md rules), checked against what dev-team-plugin already does.
           Produced by a Fable agent and independently re-checked by a second Fable agent (workflow wf_20d288cb-951);
           the checker changed no statuses. Evidence is file:line as of 13 September 2026 on branch
           claude/ledger-file-clashes, so line numbers will drift as files change.
  Status:  Waiting for the owner to choose which features to build. Nothing here is approved to build.
  Note:    Kept as markdown only (no JSON copy), because every JSON file in a project needs a schema beside it.
-->

# Owner's standard features compared with dev-team-plugin

## Summary

I re-checked every evidence line the first analyst cited and searched again for each "missing" feature under different wording; the analyst's picture holds and no status changed. The plugin already does the mechanical parts of the owner's routine well: it commits after every checked task, regenerates a handover card per task, keeps one branch and one pull request per line of work, bundles queued work, uses other installed skills and plugins, insists on pasted evidence rather than claims, and re-checks fixes until a fresh pass is clean. What is missing is the owner's own working rules: plain English as a standing rule, writing rules into CLAUDE.md, the model order (Fable for analysis and planning one after another, cheapest model for building by default), the whole "service runs out, hand over, hand back, full catch-up review, record it" family, Codex as the primary cross-check, pushing after each task, updating the owner's own GitHub issue per task, touching .claude/ memory files, in-app help, OpenAPI/Swagger upkeep and Swagger UI, and the personal coding standards (clean web addresses, detailed comments, a schema for every JSON/XML file in a user's project). Two features run against deliberate plugin design and need a decision rather than a simple add: the plugin never pushes (a hook even blocks pushes to main during a run), and it runs its Fable debate agents side by side on purpose so they cannot see each other's arguments.

| Status | Count |
| --- | --- |
| Already in the plugin | 8 |
| Partly there | 22 |
| Missing | 5 |
| Opposite of how the plugin works today | 1 |

## Already in the plugin

### F9 — Use other installed plugins and tools where they fit

- **What the plugin already does:** The orchestrator has a whole section on surveying the user's other skills at project start, matching each to the right piece of work, naming its path in the builder's brief, and telling the checker to verify conformance. The Stripe skill uses the official Stripe plugin and its tools, the iterate skill runs the built-in /simplify skill as a finishing pass, the review skill routes the user's verify and run skills to the runner, and the taste-first profile detects and uses the Codex plugin if present.
- **What is missing or different:** none
- **Notes:** Confirmed.
- **Evidence:**
  - skills/dev-team-orchestrator/SKILL.md:148-160 — 'Composing other skills': survey, match, route in the brief, tell the checker, record it
  - skills/dev-team-orchestrator/references/orchestration-profiles.md:49-60 — detect the Codex plugin and route bulk work to it
  - skills/dev-team-iterate/SKILL.md:113 — runs the built-in /simplify skill as a finishing pass
  - skills/dev-team-review/SKILL.md:27 — the runner uses the user's verify and run skills
  - skills/dev-team-stripe/SKILL.md:38-43 — uses the Stripe plugin, its skills and its tools

### F11 — Review, fix, review again until a round is clean

- **What the plugin already does:** The review skill's default fix phase corrects every gap it found, then re-verifies after every fix; nothing is marked resolved until a fresh verification pass turns it VERIFIED, and the overall verdict is updated. The security skill keeps attacking until two consecutive rounds find nothing new. Autopilot's VERIFY phase only completes when a full pass at the current commit reports overall PASS, and any commit after that re-opens VERIFY.
- **What is missing or different:** none
- **Notes:** Confirmed. There are caps (security rounds cap at 4, autopilot cycle cap about 30) so a loop that cannot converge stops honestly rather than running forever. The 'review again' is done by Claude agents, not a second AI system (see F10).
- **Evidence:**
  - skills/dev-team-review/references/verdict-and-report-protocol.md:108 — 'Re-verify after every fix — a remediated item isn't resolved until a fresh verification pass turns it VERIFIED'
  - skills/dev-team-review/SKILL.md:100 — same rule in the skill itself, plus 'update the overall verdict'
  - skills/dev-team-security/SKILL.md:90 — keep going until two consecutive red-team rounds find nothing new
  - skills/dev-team-autopilot/references/mission-and-done.md:37 — a PASS that predates the shipped code never counts; a fresh VERIFY is forced
  - skills/dev-team-autopilot/references/mission-and-done.md:56 — VERIFY exits only on a complete pass reporting overall PASS

### F12 — Commit after each piece of work

- **What the plugin already does:** Auto-commit is on by default: every completed and checker-cleared task or workstream gets its own local commit on the run branch, in addition to the commit at each stage checkpoint. It can be switched off per session or per repo.
- **What is missing or different:** none
- **Notes:** Confirmed. Commits only ever land on a checker-cleared state, which matches the owner's 'never commit a broken state' instinct.
- **Evidence:**
  - skills/dev-team-orchestrator/references/conventions.md:234-246 — the auto-commit contract, default on
  - skills/dev-team-orchestrator/SKILL.md:109 — auto-commit fires as each task is accepted
  - skills/dev-team-orchestrator/references/config-and-toggles.md:61 — features: auto-commit: on

### F16 — Update the handover document after each piece of work

- **What the plugin already does:** Auto-handoff (on by default) rewrites .dev-team/HANDOFF.md after every completed task or workstream, and the new card rides in that task's commit. It is also rewritten at every checkpoint and at autopilot's RECORD step.
- **What is missing or different:** none
- **Notes:** Confirmed. See F3 and F4 for the triggers and contents the card does not yet have. It is a switch that defaults to on, so a project could turn it off.
- **Evidence:**
  - skills/dev-team-orchestrator/references/conventions.md:218-220 — regenerates after every completed task or workstream
  - skills/dev-team-autopilot/references/loop-runtime.md:119 — auto-handoff after EVERY completed task, rides in the auto-commit
  - agents/sonnet-scribe.md:7 — the scribe owns HANDOFF.md, regenerated after every completed task

### F22 — Reorder and bundle queued tasks for efficiency

- **What the plugin already does:** Autopilot's SELECT step picks the highest-value safe next move by a priority order (safety first, then approved features, then the current phase) and bundles items that share a theme and do not touch the same files. Iterate does the same per cycle. The orchestrator groups work into waves and runs in parallel only work that does not overlap on files.
- **What is missing or different:** none
- **Notes:** Confirmed.
- **Evidence:**
  - skills/dev-team-autopilot/references/loop-runtime.md:111 — SELECT by priority; 'Bundle items only if they share a theme and don't touch the same files'
  - skills/dev-team-autopilot/references/mission-and-done.md:60-66 — picking the next move, bundle within a theme
  - skills/dev-team-iterate/SKILL.md:102 — pick the top items, bundle only coherent themes
  - skills/dev-team-orchestrator/SKILL.md:79-84 — parallelise only non-overlapping work; waves

### F23 — Work autonomously; ask only when a decision is needed; then continue

- **What the plugin already does:** Autopilot runs unattended under a three-bucket policy: safe work never waits, doubtful features are queued and surfaced while the loop carries on with other work, and only genuine blockers pause it. Approvals given later are picked up and built. The standalone orchestrator offers an 'Autonomous' check-in policy (run to completion, report at the end) and only comes back to the user for contradictions, material scope changes, irreversible actions or a debate it cannot settle.
- **What is missing or different:** none
- **Notes:** Confirmed. Standalone iterate and orchestrator runs keep a Feature Spec Gate (every net-new feature needs approval, presented as a batch); autopilot replaces that with the three-bucket policy so the loop keeps going while approvals are pending.
- **Evidence:**
  - skills/dev-team-autopilot/SKILL.md:77-81 — autonomous, deferred and hard-pause buckets; 'safe work never waits'
  - skills/dev-team-autopilot/references/modes-and-gates.md:61-68 — 'deferring never halts the loop'
  - skills/dev-team-orchestrator/SKILL.md:57-63 — check-in policies and when to always come back to the user

### F26 — One working branch and a single pull request later, no stacked or duplicate PRs

- **What the plugin already does:** One run means one branch. The no-stack policy (default) never bases a pull request on another feature branch. The single-PR policy (default on) reuses the branch's existing open pull request rather than opening a duplicate, and follow-up runs continue on the same branch. The suite never opens or merges a pull request by itself; the branch is handed back for the user to open one.
- **What is missing or different:** none
- **Notes:** Confirmed.
- **Evidence:**
  - skills/dev-team-orchestrator/references/conventions.md:255-262 — no-stack policy and why (merge-race hazard)
  - skills/dev-team-orchestrator/references/conventions.md:264-286 — single-PR policy: reuse the branch, check before creating, one open PR per line of work
  - skills/dev-team-orchestrator/references/config-and-toggles.md:44-51 — git: stack-prs false, single-pr true

### P5 — GIRFT habits: verify before asserting, say what was and was not checked, refuse when unsure

- **What the plugin already does:** Evidence-not-claims runs through the whole suite: builders must paste real command output; a report without it is treated as unverified and the checker re-runs it anyway; 'If you could not run something, say so plainly — an unverified claim is worse than a flagged gap'. The docs checker marks examples it could not run as 'not run: <reason>' rather than passing them. The run report never fabricates a duration. The ownership rule refuses to write to a file it cannot prove is its own and asks instead: 'I will not guess.' An unattended autopilot cycle goes BLOCKED rather than guessing.
- **What is missing or different:** none
- **Notes:** Confirmed. The phrase GIRFT is not used, but the habits are present and enforced in the briefs, the checker protocol, the docs checker and the write-safety rule.
- **Evidence:**
  - skills/dev-team-orchestrator/SKILL.md:93 — demand evidence, not claims; unverified until shown
  - skills/dev-team-orchestrator/references/task-brief-template.md:41-46 — paste real output; 'If you could not run something, say so plainly'
  - skills/dev-team-docs/references/accuracy-verification-protocol.md:74-77 — flag 'not run: <reason>', never silently pass
  - skills/dev-team-orchestrator/references/conventions.md:84-91 — no marker: write nothing and ask; 'There is no third branch'; an unattended run blocks
  - skills/dev-team-orchestrator/references/run-report.md:26-27 — 'Never fabricate a duration'

## Partly there

### F2 — Standing rules written into project and device instruction files

- **What the plugin already does:** The plugin has its own repo-wide settings file, .dev-team/config.yml, which the user commits so the same defaults apply to every future session and every collaborator. On the first run that creates the .dev-team/ folder, it offers (never adds silently) one fixed pointer sentence to CLAUDE.md, .claude/CLAUDE.md, AGENTS.md and GEMINI.md if those files already exist.
- **What is missing or different:** The plugin never writes working rules in prose into CLAUDE.md or into the user's device-wide ~/.claude/CLAUDE.md. Its config file only carries plugin switches (model posture, gates, issue sync and so on). The pointer sentence is one fixed line, offered once, and it is a pointer to the plugin's folder, not a rule.
- **Notes:** Confirmed. The plugin deliberately treats CLAUDE.md and its siblings as the project's own files and will not edit them without asking, because a project may already keep its own content there. A rule-writing feature would need to keep that posture: offer the rules, then write them only on a yes.
- **Evidence:**
  - skills/dev-team-orchestrator/references/config-and-toggles.md:7-15 — config.yml is committed and applies to every session and collaborator
  - skills/dev-team-orchestrator/references/conventions.md:127-133 — offer the pointer sentence; 'Offer it; never add it silently. Those files belong to the project.'
  - skills/dev-team-orchestrator/SKILL.md:36 — the orchestrator offers the same sentence on first run

### F3 — Handover kept current as work happens

- **What the plugin already does:** With auto-handoff on (the default), the scribe agent rewrites .dev-team/HANDOFF.md after every completed and checked task, at every stage checkpoint, and whenever the 'Current status' section of PROJECT.md changes. Under autopilot, the next action is written into autopilot.json before each cycle starts, so a crash mid-cycle leaves a breadcrumb.
- **What is missing or different:** Two of the owner's three triggers are not written down for the handover itself: nothing says to refresh it the moment something is learned that would change how someone continues (a wrong assumption, a trap found), and nothing says to refresh it before a long-running step. The 'before a long step' breadcrumb goes into autopilot.json, which only the plugin reads, not into the handover card a person or another tool would open.
- **Notes:** Confirmed. The per-task cadence is a strong base and is on by default. The two missing triggers could be added to handoff-template.md and documentarian-protocol.md in a few lines.
- **Evidence:**
  - skills/dev-team-orchestrator/references/handoff-template.md:18-21 — regenerate after every completed task and 'always whenever .dev-team/PROJECT.md's Current status changes'
  - skills/dev-team-orchestrator/references/conventions.md:216-232 — the auto-handoff contract, regenerated after every completed task or workstream
  - skills/dev-team-autopilot/references/loop-runtime.md:111 — next_action written before the cycle runs 'so a crash mid-cycle leaves a breadcrumb'

### F4 — What the handover must contain

- **What the plugin already does:** The HANDOFF.md template carries: goal, status, the single next action, branch and last commit, what is done, what is in flight, what is blocked, pointers to decisions, which plugin files exist, and the cost posture. Separately, PROJECT.md's decision log records the options considered and the reason for each decision.
- **What is missing or different:** The handover card does not carry 'what was tried and rejected', 'what is verified versus assumed', or 'which source files matter' (it lists only the plugin's own record files). It is deliberately capped at about 40 lines and is a derived summary, so it is thin by design.
- **Notes:** Confirmed. Tried-and-rejected material partly lives in PROJECT.md's decision log, but only for decisions that went through a debate or an explicit decision entry, not for everyday dead ends found while building.
- **Evidence:**
  - skills/dev-team-orchestrator/references/handoff-template.md:27-39 — the full list of template fields
  - skills/dev-team-orchestrator/references/handoff-template.md:18 — 'keep it under ~40 lines'
  - skills/dev-team-orchestrator/references/documentarian-protocol.md:43-48 — the decision log has 'Options considered' and 'Reason'

### F5 — Deep analysis and planning on Fable, one after another

- **What the plugin already does:** Fable is the plugin's 'Reasoning' level (the deep-architect agent), used for architecture, subtle bugs, algorithm design and debate advocates. The plugin recommends running the lead session itself on Fable with /model fable, but says plainly it cannot set that itself. Under the 'economy' cost posture, hard reasoning drops to Opus.
- **What is missing or different:** Planning is done by the lead, which runs on whatever model the session is on, not routed to Fable. Fable is reserved for 'genuinely hard' work, not for every analysis and planning run. And where the plugin does run several Fable agents at once (debates), it deliberately runs them side by side, which is the opposite of 'one after another'.
- **Notes:** Confirmed. The 'one after another' part actually conflicts with a deliberate design: debate advocates are started together so that none can read another's argument, which the plugin sees as what keeps the debate honest. The owner's reason is credit use; the plugin's is independence of argument. Both can stand if 'one after another' is applied to analysis and planning runs but not to debates.
- **Evidence:**
  - skills/dev-team-orchestrator/references/model-routing.md:18 — Reasoning level: deep-architect on fable, 'the genuinely hard stuff'
  - skills/dev-team-orchestrator/references/model-routing.md:23-28 — the lead is the session model, 'which the plugin cannot set'; recommends /model fable
  - skills/dev-team-orchestrator/references/debate-protocol.md:3 — one deep-architect per option, 'all spawned in the same turn so they run in parallel and can't see each other's cases'
  - agents/deep-architect.md:3 — 'Use ONLY for genuinely hard reasoning ... Overkill for routine building'

### F6 — Fall back from Fable to Opus, but try Fable first each run

- **What the plugin already does:** The cost-posture table swaps Opus in for Fable on hard reasoning when the run is set to 'economy'. The escalation rule moves work up one level (Haiku to Sonnet to Opus to Fable) when a cheaper model fails on ability. Model-routing also says that if a model alias stops resolving on a given Claude Code version, pin the dated id in one agent file.
- **What is missing or different:** None of these is a fallback for Fable being unavailable (out of credit, rate-limited, down). The swap to Opus is chosen by the user through the economy posture, not triggered by an outage, and there is no rule to try Fable again first on every new analysis or planning run.
- **Notes:** Confirmed. The related mechanism (Opus stands in for Fable) exists, but the trigger (unavailability) and the retry-first rule do not.
- **Evidence:**
  - skills/dev-team-orchestrator/references/model-routing.md:69-73 — cost posture table: hard reasoning on Fable in balanced and max, Opus in economy
  - skills/dev-team-orchestrator/references/model-routing.md:86-91 — escalation upward on a capability failure
  - skills/dev-team-orchestrator/references/model-routing.md:41-43 — alias-failure fallback is about a name not resolving, not the service being down

### F7 — Build on the cheapest suitable model; Opus only for complex work

- **What the plugin already does:** The plugin has a four-level roster (Fable, Opus, Sonnet, Haiku), routes purely mechanical edits to Haiku and bookkeeping to Sonnet, and has an 'economy' posture that builds on Sonnet. Its rule 'plan expensive, execute cheap' is exactly the owner's idea. The optional taste-first profile sends bulk work to the cheapest capable executor (Sonnet, or Codex if installed).
- **What is missing or different:** The default posture is 'balanced', where all building and scouting runs on Opus. The owner's rule makes Sonnet or Haiku the default and Opus the exception; the plugin makes Opus the default and Sonnet the thing you opt into. Verification is always on Opus in every posture, which the plugin treats as non-negotiable.
- **Notes:** Confirmed. The owner can get most of this today by committing `defaults: models: economy` in .dev-team/config.yml in each project. Making it the plugin's built-in default would be a small change in config-and-toggles.md and model-routing.md.
- **Evidence:**
  - skills/dev-team-orchestrator/references/model-routing.md:69-75 — build and scout use opus-builder in balanced (the default), sonnet-builder only in economy
  - skills/dev-team-orchestrator/references/model-routing.md:58-63 — 'plan expensive, execute cheap'
  - skills/dev-team-orchestrator/references/orchestration-profiles.md:34-36 — bulk and mechanical work to the cheapest capable model
  - skills/dev-team-orchestrator/references/config-and-toggles.md:38 — defaults: models: balanced

### F8 — Credit efficiency as an explicit goal, alongside getting it right

- **What the plugin already does:** Cost is a named concern throughout: a cost-posture knob, autopilot's budget block that automatically steps the build level down when expensive-model use runs heavy, an end-of-run cost estimate, a 'burning Opus on bookkeeping' anti-pattern, and the two-strike rule to stop re-spawning agents on a broken brief. Getting it right is covered by the evidence-not-claims discipline.
- **What is missing or different:** The plugin explicitly ranks cost last: 'intelligence > taste > cost' and 'cost is only a tie-breaker'. The default posture is the Opus-heavy 'balanced'. So credit efficiency is a consideration, not a goal of equal standing with correctness.
- **Notes:** Confirmed. The plugin's stated reason for ranking cost last is that redoing weak work on a better model costs less than shipping mediocre work. Whether that matches the owner's priorities is the owner's call.
- **Evidence:**
  - skills/dev-team-orchestrator/references/model-routing.md:93-96 — 'Cost is only a tie-breaker ... intelligence > taste > cost'
  - skills/dev-team-autopilot/references/loop-runtime.md:61-76 — the budget block and auto-tighten rule
  - skills/dev-team-orchestrator/references/run-report.md:45-49 — rough cost estimate from agent spawn counts
  - skills/dev-team-orchestrator/SKILL.md:179 — 'Burning Opus on bookkeeping' anti-pattern

### F10 — Cross-system checking (Claude reviewed by Codex and vice versa)

- **What the plugin already does:** The plugin's independence rule says whoever verifies a thing is never whoever built it, and the review skill uses separate verifier agents. With the Codex plugin installed, the taste-first profile can run /codex:review or /codex:adversarial-review as an extra perspective, and mentions an optional Codex review gate hook.
- **What is missing or different:** The independent checker is a different Claude agent, not a different AI system. Codex is only ever an optional 'second opinion' that 'never replaces the Claude verifier'; primary verification stays on Claude by design. There is no rule that Claude-built work must be reviewed by Codex, nor that Codex-built work is reviewed by Claude.
- **Notes:** Confirmed. The plugin's stated reason is its first routing rule: verification stays on the Opus level because the checker catches every other misrouting, and its ranking table gives Codex a lower 'taste' score. The owner's reason for cross-system review (two different systems rarely make the same mistake in the same place) is a different argument, so the two rules need reconciling rather than one simply overriding the other.
- **Evidence:**
  - skills/dev-team-orchestrator/references/conventions.md:297 — 'Independence. Whoever verifies a thing is never whoever built it.'
  - skills/dev-team-orchestrator/references/orchestration-profiles.md:39-41 — Codex 'may be added as an EXTRA adversarial perspective ... never as a replacement for the Claude verifier'
  - skills/dev-team-orchestrator/references/orchestration-profiles.md:62-64 — optional /codex:setup --enable-review-gate as a second opinion
  - skills/dev-team-orchestrator/references/model-routing.md:53-56 — verification stays on Opus; 'cheaping them out is the one catastrophic move'

### F14 — Update the related GitHub issue after each task, per task

- **What the plugin already does:** Issue sync with issues=auto reflects each ledger item in GitHub or GitLab as it completes or closes, task by task, without creating duplicates, and closes the issue when the item is done. The /dev-team-sync-issues command runs a pass on demand.
- **What is missing or different:** It is off by default and asks for confirmation on the first run in a repo. It only ever touches issues the plugin itself created from its own record files (feature gaps, backlog items, findings, verdicts, gate items); it does not update an existing issue the owner opened for the task, such as issue #41. So 'update the related GitHub issue' in the owner's sense (their issue, their task) is not covered.
- **Notes:** Confirmed. The plugin's reason for touching only its own issues is safety: it must never edit or close an unrelated issue. A feature to post progress to a named issue would need its own opt-in, for example an issue number given in the run arguments.
- **Evidence:**
  - skills/dev-team-orchestrator/references/issue-sync-protocol.md:10-17 — the issues=off|sync|auto switch, default off, auto means per-task cadence
  - skills/dev-team-orchestrator/references/issue-sync-protocol.md:76-78 — 'Only ever touch issues THIS sync created'
  - commands/dev-team-sync-issues.md:14 — 'Only ever touch issues this sync created; never delete issues'

### F15 — Update the assistant's memory and context files in .claude/ after each task

- **What the plugin already does:** The plugin keeps its own memory current per task: PROJECT.md (the source of truth), HANDOFF.md (rewritten per task), and autopilot.json (machine state). All of it lives in .dev-team/. It offers, once, a one-line pointer to that folder for CLAUDE.md and its siblings.
- **What is missing or different:** Nothing is written to .claude/ (or to CLAUDE.md, memory files, or any other assistant context file) after a task. The plugin deliberately treats those files as the project's own and will not edit them beyond the one offered sentence.
- **Notes:** Confirmed. The design reason is the file-clash problem from issue #41: the plugin damaged a project's own files by writing into them, so it now writes only inside .dev-team/. A .claude/ update feature would have to be opt-in and follow the same read-before-write rule.
- **Evidence:**
  - skills/dev-team-orchestrator/references/conventions.md:56 — 'Everything the suite writes for itself lives in the .dev-team/ folder'
  - skills/dev-team-orchestrator/references/conventions.md:131 — 'Offer it; never add it silently. Those files belong to the project.'
  - skills/dev-team-orchestrator/references/documentarian-protocol.md:104-110 — when the documentarian updates PROJECT.md and HANDOFF.md

### F17 — Thorough docs update covers all markdown documentation

- **What the plugin already does:** The docs skill with scope=all covers README, API docs, reference docs, docstrings, CHANGELOG, usage guides and architecture or onboarding docs, drafted by Sonnet and checked claim by claim by an Opus checker. In maintain mode the checker re-verifies the whole doc area, not just the recent diff.
- **What is missing or different:** The scope is a fixed list of doc areas, not 'every markdown file in the project'. A markdown file that does not fall into one of those areas (a contributing guide, a runbook, a folder README) is not necessarily picked up. The plugin's own .dev-team/ folder is explicitly never in scope.
- **Notes:** Confirmed.
- **Evidence:**
  - skills/dev-team-docs/SKILL.md:179-180 — scope=readme|api|reference|docstrings|changelog|guides|architecture|all
  - skills/dev-team-docs/SKILL.md:87-90 — '.dev-team/ is never in scope'
  - skills/dev-team-docs/SKILL.md:126-127 — the checker re-verifies the whole doc area

### F18 — Docs update covers in-app help and user guides

- **What the plugin already does:** Usage guides are a named doc area ('guides'), written task by task and verified step by step.
- **What is missing or different:** In-app help (help pages, tooltips, help text shown inside the running application) is not mentioned anywhere in the plugin. Only external documentation files are in scope.
- **Notes:** Confirmed. A search for 'in-app', 'help page', 'help text', 'tooltip' and 'user guide' across all skills, agents and commands found nothing.
- **Evidence:**
  - skills/dev-team-docs/references/doc-standards.md:99-108 — usage guides: task-oriented, runnable, verified
  - skills/dev-team-docs/SKILL.md:179-180 — the scope list has no in-app help area

### F20 — Update the OpenAPI/Swagger description when the project has an API

- **What the plugin already does:** The docs standards tell the scout to note any OpenAPI/Swagger generation already configured, and tell the drafter to prefer generating reference docs from an OpenAPI or GraphQL schema over hand-writing them. Endpoint claims are verified against the real route handlers, and the checker also looks for real endpoints that are undocumented.
- **What is missing or different:** There is no rule that the OpenAPI/Swagger description itself must be brought up to date when the API changes. It is treated as a source to generate docs from, not as a document the plugin maintains.
- **Notes:** Confirmed.
- **Evidence:**
  - skills/dev-team-docs/references/doc-standards.md:14-15 — scout notes existing OpenAPI/Swagger generation tooling
  - skills/dev-team-docs/references/doc-standards.md:62-64 — prefer generating reference docs from an OpenAPI/GraphQL schema
  - skills/dev-team-docs/references/accuracy-verification-protocol.md:61-63 — endpoint claims checked against the real handler
  - skills/dev-team-docs/references/accuracy-verification-protocol.md:97-99 — both-direction drift: real endpoints missing from the docs are a failure too

### F24 — Gather all decisions and clarifications up front, ask them together, say why each is needed

- **What the plugin already does:** Autopilot's bootstrap asks the user to confirm four named inputs together before the loop starts, with a reason for each (scope boundaries, feature ambition, hard constraints, hands-off zones). The orchestrator's first step lists open questions before spawning anyone. Iterate presents feature specs as a batch (approve, edit or drop per feature).
- **What is missing or different:** There is no general rule to gather every question first and ask them in one go. The router asks 'ONE clarifying question'. Gate items are queued and surfaced as they arise during a run, not collected up front. Nothing requires the wording to be simple or to say why each question is needed, apart from the four bootstrap inputs.
- **Notes:** Confirmed.
- **Evidence:**
  - skills/dev-team-autopilot/references/mission-and-done.md:11-16 — confirm the four inputs, each with its reason
  - skills/dev-team-orchestrator/SKILL.md:41 — 'Open questions — anything genuinely ambiguous'
  - skills/dev-team-iterate/SKILL.md:96 — features presented as a batch, approve, edit or drop
  - commands/dev-team.md:7 — 'ask ONE clarifying question'

### F25 — Frequent progress updates as a table of queued tasks and their status

- **What the plugin already does:** Each autopilot iteration ends with a report line naming what was done, deferred and blocked. /dev-team-status prints a dashboard on demand (mission, phase, next action, gate items, budget). PROJECT.md's stage plan carries a status per stage, and the checkpoint log records each stage result.
- **What is missing or different:** Updates are not formatted as a table of the queued tasks with a status for each, and they are not sent at a regular cadence during a stage: the report is one line per autopilot cycle, and the table-like views live in files or are only shown when asked for.
- **Notes:** Confirmed. A search for 'progress update', 'progress table' and 'status table' found nothing beyond the migration and security ledgers, which are record tables in files, not progress messages to the user.
- **Evidence:**
  - skills/dev-team-autopilot/references/modes-and-gates.md:91 — every iteration's report line names what was deferred and why
  - commands/dev-team-status.md:4-9 — read-only dashboard on demand
  - skills/dev-team-orchestrator/references/documentarian-protocol.md:33-35 — stage plan with a status per stage

### F27 — The working branch targets an integration branch such as alpha, not main

- **What the plugin already does:** The git.default-branch setting in .dev-team/config.yml accepts an explicit branch name, and every run branches from and targets that branch. So setting it to alpha gives the owner's behaviour.
- **What is missing or different:** The built-in default is 'auto', which resolves to origin/HEAD or main/master. Targeting an integration branch needs the owner to commit the config setting in each project; it is not the plugin's default, and 'alpha' is not mentioned anywhere.
- **Notes:** Confirmed.
- **Evidence:**
  - skills/dev-team-orchestrator/references/config-and-toggles.md:87 — default-branch: auto (origin/HEAD, else main/master) or an explicit name
  - skills/dev-team-orchestrator/references/conventions.md:257-258 — every run branches FROM and targets the default branch

### F28 — Hand work to another service or agent when one runs out, if enough context can travel

- **What the plugin already does:** Two tool-level fallbacks exist: if the Codex plugin is absent, bulk work falls back to Sonnet or Haiku without failing; if the Stripe best-practices skill does not resolve, the Stripe skill falls back to its own checklist and notes in the report that its grounding was reduced. The assistant-agnostic HANDOFF.md is designed so any other tool (Codex, Gemini) can resume cold, which is the 'context can travel' half of the owner's rule.
- **What is missing or different:** Nothing hands work over when the Claude model or agent doing the work is out of credit, rate-limited, refusing or down. The existing fallbacks are checked once at the start of a run, not triggered by a failure mid-work, and the condition 'only if enough context goes with it' is not stated anywhere.
- **Notes:** Confirmed. A search for 'rate limit', 'out of credit', 'quota', 'unavailable', 'outage', 'hand over' and 'handover' found only CI-medic's handling of a CI service outage (report it, do not work around it), which is about the project's CI, not about the assistant's own service. The handover card already gives the plugin the piece the owner's rule says is load-bearing; the missing part is the trigger and the decision logic.
- **Evidence:**
  - skills/dev-team-orchestrator/references/orchestration-profiles.md:53-55 — Codex absent: 'DON'T fail — do the work on Claude tiers'
  - skills/dev-team-stripe/SKILL.md:39 — skill absent: fall back to the checklist and note reduced grounding in the report
  - skills/dev-team-orchestrator/references/handoff-template.md:7-8 — HANDOFF.md readable cold by Claude, Codex or Gemini

### F30 — Full review of everything done while the preferred service was away, done frequently

- **What the plugin already does:** The review skill does a full independent re-verification of every recorded claim as one body of work, with fresh evidence generated now, and can be run at any time. That is the shape of the catch-up review the owner describes.
- **What is missing or different:** Nothing ties that review to a hand-over: there is no record that a fallback happened, so nothing triggers a catch-up review when the preferred service returns, and nothing says to run it frequently during a fallback stretch.
- **Notes:** Confirmed. A search for 'catch-up', 'full review', 'review everything' and 'as one body' found only autopilot's own 'full review pass' rule, which is about verifying the product at the current commit, not about reviewing a fallback system's work.
- **Evidence:**
  - skills/dev-team-review/SKILL.md:8-10 — prove every claim true with fresh evidence, default to not verified
  - skills/dev-team-review/SKILL.md:84-86 — completeness critic and regression check across the whole claim list

### F31 — Record every hand-over; never let same-system review pass silently as independent

- **What the plugin already does:** The independence rule (the verifier is never the builder) and the review skill's 'never let a builder grade its own work' cover the 'never silently self-review' idea at the agent level. The Stripe skill records in its report when its usual source was unavailable and grounding was reduced. Commit messages carry evidence, and the run report records agents by model level.
- **What is missing or different:** There is no hand-over concept, so nothing is recorded in commit messages, the handover card or the run report when a fallback happens. 'Independent' in the plugin means a different agent, not a different system, so a Claude agent reviewing Claude-built work passes as independent by design.
- **Notes:** Confirmed.
- **Evidence:**
  - skills/dev-team-orchestrator/references/conventions.md:297 — independence rule
  - skills/dev-team-review/SKILL.md:18 — 'Never let a builder grade its own work'
  - skills/dev-team-stripe/SKILL.md:39 — 'note in the report that canonical grounding was reduced'

### P2 — Detailed comments in every language: why, tried-and-rejected, what it cannot do, file headers

- **What the plugin already does:** The plugin's own shell hooks follow this standard closely: long header comments explaining the contract, what was rejected and why, faults found and fixed, and a 'what this hook CANNOT do' section. Its shared conventions file records 'why', 'rejected' and 'cannot do' for the ownership rule. For user projects, the docs skill says inline comments should explain why rather than what, and its docstring standard covers parameters, returns, errors and side effects.
- **What is missing or different:** There is no rule applied to user projects requiring file headers, recording what was tried and rejected, or stating what code cannot do. The docs skill also pulls the other way on volume: it says to skip trivial accessors and treats padding docstrings as gold-plating, and the builder brief asks for 'lean' code with no mention of comments at all.
- **Notes:** Confirmed. The plugin practises the standard on its own code but does not teach it to builders. The 'concise, no gold-plating' posture and the owner's 'detailed comments everywhere' rule are in tension; adding the owner's rule to the brief template would need to say explicitly that explanatory comments do not count as gold-plating.
- **Evidence:**
  - hooks/guard-ledgers.sh:1-80 — header explaining the rules, what was rejected (lines 38-43), faults fixed (45-56) and what it cannot do (72-80)
  - skills/dev-team-orchestrator/references/conventions.md:54 — 'what that means, why it is this way, what was rejected, and what the enforcement cannot do'
  - skills/dev-team-docs/references/doc-standards.md:81-83 — inline comments explain why, not what
  - skills/dev-team-docs/references/doc-standards.md:78-80 — skip trivial accessors
  - skills/dev-team-orchestrator/references/task-brief-template.md:32 — lean code rule, no comment requirement

### P3 — JSON has no comments: explanations go in the schema's description/$comment, never // in .json

- **What the plugin already does:** The plugin follows this for its own verdict.json: the conventions say 'JSON has no comment syntax', so the file carries a marker field instead, and schemas/verdict.schema.json has a description on every property and a long $comment for maintainers.
- **What is missing or different:** This is the plugin's own practice, not a rule it gives builders working on a user's project. Nothing in the briefs or the checker says how to document JSON in the target codebase. (The loop-runtime document shows autopilot.json with // comments inside a code block; that is documentation of the shape, not a real .json file, but a builder copying it as-is would produce invalid JSON.)
- **Notes:** Confirmed.
- **Evidence:**
  - skills/dev-team-orchestrator/references/conventions.md:75 — 'JSON has no comment syntax, so .dev-team/verdict.json carries a top-level string field instead'
  - schemas/verdict.schema.json:5-6 — description explains why the reasons live in the schema; $comment for maintainers
  - schemas/verdict.schema.json:22-25 — description on the dev-team property (and on every other one)
  - skills/dev-team-autopilot/references/loop-runtime.md:9-53 — the autopilot.json example carries // comments inside the code block

### P4 — Every JSON/XML file gets a schema beside it, with validation wired in

- **What the plugin already does:** The plugin's verdict.json has a JSON Schema with a description on every property, a sample fixture, a bats test that validates the fixture against it (and one that checks an invalid value fails), a smoke test that checks every schema file is well-formed and self-describing, and CI installs check-jsonschema to run it.
- **What is missing or different:** Only verdict.json has a schema. autopilot.json (the loop's state file) is described in prose only; plugin.json, marketplace.json and hooks.json have no schema. And none of this is a rule for user projects: no skill tells builders to write or validate schemas for the JSON or XML their project produces or consumes, and XML is not mentioned at all.
- **Notes:** Confirmed. The schemas/ folder contains only verdict.schema.json; a search for 'JSON Schema', 'jsonschema', 'XSD', 'RELAX NG' and 'XML' in the skills found no rule for user projects.
- **Evidence:**
  - schemas/verdict.schema.json:1-20 — the one schema, with $schema, title, description and a required list
  - tests/scripts.bats:377-383 — the fixture validates against the schema; an invalid overall value fails
  - tests/smoke-structure.sh:111-136 — every schemas/*.schema.json must be valid JSON with $schema, title and description
  - .github/workflows/plugin-audit.yml:31-32 — installs check-jsonschema in CI
  - skills/dev-team-autopilot/references/loop-runtime.md:9-53 — autopilot.json's shape is described only in a commented example, no schema file

## Missing

### F1 — Plain English as a standing rule

- **What the plugin already does:** Nothing that the plugin applies to a user's project. The only traces are one line in the docs skill saying a README's opening paragraph should be 'in plain language', and one line in the migrate skill saying a stage's risk should be stated 'in plain language'. The plugin's own skill files are written in dense specialist language. This repository's own .claude/CLAUDE.md does carry a plain-English rule, but that governs people working on the plugin itself, not what the plugin does for its users.
- **What is missing or different:** There is no instruction anywhere in the skills, agent files, briefs or commands telling the lead, the builders, the checker or the documentarian to write explanations, progress updates, commit messages or documents so that a non-specialist can follow them.
- **Notes:** Confirmed. The natural places to add it are the task-brief template, the checker brief, the documentarian brief and the handoff template, because every agent reads one of those.
- **Evidence:**
  - skills/dev-team-docs/references/doc-standards.md:34 — README title and description 'in plain language' (one mention)
  - skills/dev-team-migrate/references/migration-plan-protocol.md:74 — state a stage's risk 'in plain language' (the only other mention)
  - skills/dev-team-orchestrator/references/task-brief-template.md:41-46 — the builder report format asks for files changed and pasted output, nothing about plain wording
  - .claude/CLAUDE.md:15-21 — the repo's own plain-English rule, which applies to work on the plugin, not to plugin behaviour

### F19 — Docs update covers the assistant's own .claude/ instruction and memory files

- **What the plugin already does:** Nothing. The docs skill's scope list has no area for assistant instruction files, and the plugin's own state folder .dev-team/ is explicitly excluded from documentation work.
- **What is missing or different:** No skill updates CLAUDE.md, .claude/ memory files or similar as part of a documentation pass.
- **Notes:** Confirmed.
- **Evidence:**
  - skills/dev-team-docs/SKILL.md:87-90 — '.dev-team/ is never in scope'
  - skills/dev-team-docs/SKILL.md:179-180 — the scope areas, none for .claude/

### F21 — Add Swagger UI where there is a web app but no API browser, shared-hosting friendly

- **What the plugin already does:** Nothing. Swagger UI is not mentioned anywhere in the plugin's skills, agents or commands. (This repository's own .claude/CLAUDE.md notes the plugin itself has no API, which is about the plugin repo, not about what the plugin does for users.)
- **What is missing or different:** No skill adds or checks for Swagger UI, and nothing speaks to running on ordinary shared hosting without Docker.
- **Notes:** Confirmed. A search for 'swagger', 'openapi' and 'open api' across the plugin found only the three doc-standards lines.
- **Evidence:**
  - skills/dev-team-docs/references/doc-standards.md:14-15 — the only OpenAPI/Swagger mentions are about existing generation tooling
  - .claude/CLAUDE.md:83-85 — the repo's own note that the plugin has no API (not plugin behaviour)

### F29 — Return to the preferred service at the next break; always try it first on each new run

- **What the plugin already does:** Nothing. There is no notion of a preferred versus fallback service, so nothing to return to. The closest things are the escalation rule (which only ever moves work up to a more capable model on a failure of ability) and the Codex check, which happens once at the start of a run but concerns an optional extra, not a preferred service.
- **What is missing or different:** No rule to go back to the preferred model or service, and no rule to retry it first on a new run.
- **Notes:** Confirmed. A search for 'try again', 'try first', 'retry', 'preferred model', 'return to' and 'go back to' found nothing on this topic.
- **Evidence:**
  - skills/dev-team-orchestrator/references/model-routing.md:86-96 — escalation only moves upward on a capability failure; no return-to-preferred rule
  - skills/dev-team-orchestrator/references/orchestration-profiles.md:53-55 — the Codex check is a one-time detection at the start of a run

### P1 — No language extension (.php, .asp, .jsp, .cgi) in any web address, with an automated check

- **What the plugin already does:** Nothing. A search of the whole plugin for '.php', '.asp', '.jsp', '.cgi', 'language extension' and 'clean URL/address' found no mention.
- **What is missing or different:** No rule in any builder brief, checker brief, security checklist or ship/CI protocol about clean addresses, and no check script for it.
- **Notes:** Confirmed. The security skill's attack-surface protocol would be a natural home for a 'do not reveal the stack in URLs' check, and dev-team-ship for wiring an automated check into CI (it currently wires no schema or URL checks for user projects).
- **Evidence:**
  - skills/dev-team-orchestrator/references/task-brief-template.md:30-34 — the constraints block, where such a rule would go, has nothing on URLs
  - skills/dev-team-orchestrator/references/checker-protocol.md:23-30 — the checker's checklist, nothing on URLs

## Opposite of how the plugin works today

### F13 — Push to the working branch after each piece of work

- **What the plugin already does:** The plugin never pushes as part of its per-task or checkpoint behaviour. The auto-commit contract says it 'never pushes and never opens a PR'; the handover card is 'never auto-pushed'. A hook blocks any git push to main or master while a run is active. The one exception is CI medic, which pushes safe automatic fixes to a pull request's own existing head branch.
- **What is missing or different:** Pushing after each task is the opposite of the plugin's rule. Only CI medic pushes, and only to a branch that already has an open pull request.
- **Notes:** Confirmed. The plugin's stated reason, spread across the files above: pushing is an outward-facing action, and the suite keeps every outward effect (push, pull request, merge, issue creation) as the user's explicit choice so that a run stays reviewable and abortable as a single unit. A 'push to the working branch after each task' switch would be additive and could keep the main-branch block; the owner has to decide whether the safety argument outweighs the convenience.
- **Evidence:**
  - skills/dev-team-orchestrator/references/conventions.md:241-242 — 'Auto-commit never pushes and never opens a PR — pushing stays the user's explicit choice'
  - skills/dev-team-orchestrator/references/config-and-toggles.md:105 — auto-commit: 'never push, never PR'
  - hooks/guard-dev-team.sh:52-55 — blocks any git push whose target is main or master during a run
  - skills/dev-team-autopilot/SKILL.md:93 — every cycle commits on the run branch 'so ... the whole run is reviewable/abortable as a unit'
  - skills/dev-team-orchestrator/references/issue-sync-protocol.md:63 — outward-facing actions are confirm-first, 'the suite's standard gate posture'
  - skills/dev-team-ci-medic/references/remediation-protocol.md:109-112 — CI medic pushes to the PR's existing head branch only, never a new branch, never main

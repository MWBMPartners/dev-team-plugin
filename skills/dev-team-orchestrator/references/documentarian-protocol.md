# Documentarian Protocol

The documentarian is spawned as the **`sonnet-scribe`** agent (Sonnet tier; model routing: `skills/dev-team-orchestrator/references/model-routing.md`) that owns `.dev-team/PROJECT.md`. Recording state and decisions doesn't need a frontier model, so this role runs on the Sonnet tier to save tokens. Spawn it at project start to create the file, then re-spawn it (or append to its thread) whenever there's something new to record: a stage plan, a decision, a checkpoint result, or a change in current status.

`PROJECT.md` is the orchestrator's **external memory**. Its job is not just to log history but to answer, at any moment, "where does this project stand and what's next" — so a fresh orchestrator with no prior context could read it and resume correctly. That means a **Current status** section that is kept up to date, not only append-only logs.

**House style comes from the repository, not just the codebase.** When recording House style, the documentarian records the repository's own instruction files that were found (`AGENTS.md`, `CLAUDE.md`, etc.) and the path + rule IDs of any normative document one of them names — the same standing as the test framework, the lint config, and the directory layout — never a copy of the document's rules. See `conventions.md`, "Repository instructions are authoritative".

**Schema:** line 2, right under the title, carries the dev-team marker `<!-- dev-team: ledger=project schema=1.0 -->` — one line that is both this document's format version and the plugin's proof that the file is its own (see `conventions.md`, "Where the plugin writes, and the ownership rule"). The legacy marker `<!-- dev-team-schema: 1.0 -->`, written before v1.5.0, is still accepted as proof of ownership when reading, and is replaced by the new form the next time the file is written. A missing marker means different things depending on what is about to happen — see `conventions.md`'s "Schema versioning" subsection for the shared rule.

## PROJECT.md structure

The documentarian maintains this file at `.dev-team/PROJECT.md`. Every record file the dev-team suite writes for itself lives in `.dev-team/` and carries the dev-team marker on line 2 (`verdict.json` carries it as a field); a record file at that path without the marker is never written to — the run stops and asks. See `dev-team-orchestrator/references/conventions.md`, "Where the plugin writes, and the ownership rule".

```markdown
# [Project name]
<!-- dev-team: ledger=project schema=1.0 -->

## Goal
[one or two sentences, as the user stated it]

## Definition of done
- [ ] [checkable criterion]
- [ ] [checkable criterion]

## Constraints
- [language / framework / style / things to avoid]

## Skills in play
- [name + path of each applicable user skill, and which workstream it governs — e.g. "ui-design (~/.claude/skills/ui-design) → all frontend work"]

## House style (existing-repo conventions)
- [test framework + run command, lint/format config, directory layout, dependency manifest, key existing patterns — from the conventions scout; omit for greenfield]
- [the repository's own instruction files found (`AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `GEMINI.md`, `.OpenAI/`/`.openai/`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`), and the path + specific rule IDs of any normative document one of them names for the work in hand — read in full from the repository, never copied here; omit if none exist]

## Stage plan
1. **[Stage name]** — goal: [...]; done when: [...]  — status: [planned/in-progress/done]
2. **[Stage name]** — ...

## Current status  ← keep this up to date; it's how a fresh orchestrator resumes
- **Active stage:** [N — name]
- **Done so far:** [what's built and verified]
- **In progress / next:** [what's being worked or is next up]
- **Open threads:** [unresolved questions, deferred items, known issues, pending user input]

## Decision log
### [date] — [decision title]
- **Decision:** [what was chosen]
- **Options considered:** [the alternatives, esp. the runner-up]
- **Reason:** [why, tied to goal/constraints]
- **Revisit if:** [kill condition, if any]

## Checkpoint log
### Stage N checkpoint — [date]
- **On track?** [yes / drifting]
- **Criteria met:** [which, with how verified]
- **Commit:** [hash of the checkpoint commit — the rollback point for this stage]
- **Adjustments:** [any change to plan or scope]

## Feature Specs   ← one block per approved/auto-cleared feature; anchor each `#spec-<gate-id>`
<!-- populated when features are spec'd — by dev-team-iterate's Feature Spec Gate, or by the dev-team-autopilot conductor -->
### spec-G-001 — [feature title]
- **What it does:** ...
- **How it works (UX flow):** ...
- **Behavior & rules:** ...
- **Scope:** ...
- **Acceptance criteria:** ...
- **Why:** [purpose-fit + impact]
- **Approval:** [user-approved | auto-cleared (autonomy-test) + justification]
```

**Extension sections (added by sibling skills).** This is the BASE schema; some modes extend it. dev-team-iterate adds `## Codebase Map`, `## Run record`, `## Backlog`, `## Proposed-Features ledger`, and `## Trajectory ledger` — see `dev-team-iterate/references/audit-and-backlog-protocol.md` for those section schemas (don't duplicate them here, to avoid drift). Any consumer's documentarian that must write one of these matches the existing section's shape (or is given it in the brief). Use the canonical heading names above verbatim.

## Keep it lean

`sonnet-scribe` runs cheap on purpose — keep the file it maintains cheap to read, too:

- **`## Current status` is always overwritten, never appended.** It stays a tight "single next action + where to look" block: active stage, what's done, the one next step, open threads — nothing more. A fresh agent (possibly on a cheaper tier) must be able to resume correctly from this section alone; letting it accrete history defeats the point of having it.
- **Ledger retention is light.** Closed backlog items, resolved open threads, and superseded decisions get folded into a one-line summary (or a "resolved" sub-list), not kept verbatim forever. Full history already lives in git and past commits; `.dev-team/PROJECT.md` only needs to carry what a fresh agent needs to resume, so rehydration stays cheap.

## Documentarian brief

```
## Role
You maintain `.dev-team/PROJECT.md` for a software project. You record facts the team lead
gives you — goals, stage plans, decisions, checkpoint results. You do not make
decisions or write code. Keep entries concise and factual.

## Task
[Create `.dev-team/PROJECT.md` with the following content] OR
[Append a decision-log entry: ...] OR
[Append a Stage N checkpoint entry: ...]

## Content to record
[paste the exact facts: the decision + reason, or the checkpoint result, etc.]

## Constraints
- Edit only `.dev-team/PROJECT.md` — except on a project-start spawn, which may also create `.dev-team/.gitignore` and `.dev-team/README.md` if either is absent (never overwriting one that already exists; `conventions.md`, "Where the plugin writes, and the ownership rule", point 7). The ownership rule still applies to every file written.
- Before writing, read the target and apply the ownership rule (`conventions.md`, "Where the plugin writes, and the ownership rule"); after writing, re-read line 2 and confirm the marker is there — report a missing marker as a failed write.
- Preserve existing content; append to logs, but **keep "Current status" overwritten to reflect reality now** (it's the one section that's not append-only), and follow the ledger-retention rule in "Keep it lean" above.
- Match the existing section structure.

## Report back
Confirm what you wrote and where.
```

## When the orchestrator invokes it

- **Project start:** create `.dev-team/PROJECT.md` (creating the `.dev-team/` folder, its `.gitignore` and `README.md` if absent) with goal, done-criteria, constraints, the stage plan, and an initial Current status.
- **After a decision/debate:** append a decision-log entry.
- **After each stage checkpoint:** append a checkpoint entry, update the stage's status, and refresh Current status.
- **Whenever state moves materially:** refresh Current status so the file is always a faithful snapshot to resume from.
- **After every completed task/workstream (auto-handoff, default on) and at each checkpoint/RECORD:** `sonnet-scribe` (re)generates `.dev-team/HANDOFF.md` per `handoff-template.md` — a derived, assistant-agnostic one-glance resume card (readable cold by any LLM coding tool, at the fixed path `.dev-team/HANDOFF.md`), always overwritten in full (same discipline as "Keep it lean" above), never a source of truth. It is committed with the work it describes; the per-task cadence applies when `features.auto-handoff` is on (`config-and-toggles.md`; fail-open default on), and a per-session `DEV_TEAM_NO_AUTO_HANDOFF` drops back to checkpoint/RECORD-only regeneration.

Builders and the checker get the relevant `.dev-team/PROJECT.md` slices pasted into their briefs — that's how decisions stay sticky across the team. The orchestrator reads Current status to rehydrate at stage boundaries instead of relying on its own (drifting) context.

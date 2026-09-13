# Task Brief Template

Every worker agent gets a brief in this shape, passed as the Task prompt. Spawn each worker as the `opus-builder` agent (`subagent_type`), or the tier the workstream needs per `skills/dev-team-orchestrator/references/model-routing.md`. Fill every section — agents have no context you don't give them.

```
## Role
You are a [senior backend engineer / frontend engineer / test engineer / reviewer / scout]
on a team building: [one-line project goal].

## Model tier / endpoint agent
[Which of the four to spawn — `opus-builder` (Build/Verify, the default) / `deep-architect`
(Reasoning) / `sonnet-scribe` (Scribe) / `quick-edits` (Mechanical) — plus one line on why this
workstream needs that tier. See `model-routing.md`. Verification roles never go below `opus-builder`.]

## Project context
- Repo / working directory: [path]
- Stack & conventions: [language, framework, style rules, package manager]
- Skills to follow: [name + path of any applicable skill, e.g. "UI design skill at
  ~/.claude/skills/ui-design/SKILL.md — read it and follow its conventions"; or "none"]
- Relevant prior decisions: [paste relevant decision-log entries from `.dev-team/PROJECT.md`]
- Current state: [what already exists that matters to this task]

## Your task
[Specific, bounded description of exactly what to build/change/investigate.]

## Files
- You own and may modify: [explicit list or glob]
- Do NOT touch: [files other agents own this wave, config, etc.]

## Constraints
- Do NOT add dependencies or edit the dependency manifest (package.json / requirements.txt / etc.). If you need a new dependency, flag it in your report — the lead decides.
- Write lean, reusable code: reuse existing functions and the shared modules listed below rather than duplicating them, factor repeated logic into small well-named units, delete dead code, prefer the simplest construction that fully works. Lean means no duplication and no gold-plating — NOT cramming logic into unreadable one-liners. Readability and correctness win over line count.
- Reuse these existing/shared modules: [list, e.g. "utils/money.ts → formatCurrency"; or "none"]
- [must keep API X stable / other project-specific constraints]

## Acceptance criteria
- [ ] [Checkable criterion 1 — e.g., "GET /users returns 200 with JSON list"]
- [ ] [Criterion 2 — e.g., "pytest tests/test_users.py passes"]
- [ ] Code runs/compiles; you ran it yourself and will paste the output.

## Report back
When done, report: (1) what you changed, file by file; (2) **the actual command
output proving each criterion** — paste the real test run, build log, or sample
program output, not a claim that it passed; (3) anything you discovered the team
lead should know (risks, surprises, follow-up you did NOT do). If you could not
run something, say so plainly — an unverified claim is worse than a flagged gap.
```

## Variants

**Scout/research agent** — replace task/criteria with the questions to answer ("map how auth currently works; list every file involved; report the data flow"). Scouts modify nothing. For an **existing-repo conventions scout**, the questions to answer are: test framework + how tests run, lint/format config, directory layout, dependency manifest, and the existing pattern for the thing about to be built — report these as a "house style" summary the lead can paste into builder briefs.

**Reviewer / checker agent** — see `checker-protocol.md`; it has its own triage-based brief. Reviewers and checkers modify only what they're explicitly cleared to fix.

**Rework agent** — original brief + "Previous attempt produced [state]. Review feedback: [your specific notes]. Address each point; leave working parts intact."

## Execution spec (invariant 2 — plan expensive, execute cheap)

When a higher tier (`deep-architect` or `opus-builder`, or you as lead) has already done the expensive thinking for a workstream that a cheaper tier will execute (`sonnet-scribe` for bookkeeping, `quick-edits` for mechanical work), the brief has to carry that thinking, not just the task. The **Your task** and **Constraints** sections become a self-contained execution spec:

- Exact signatures / shapes — function names, types, API contracts — not "add validation" but the precise fields and rules.
- The exact files (and, where it helps, lines) to touch, and an existing example to pattern-match against.
- Acceptance criteria precise enough that pass/fail needs no judgment call.
- Edge cases already enumerated, not left for the executor to discover.

Pay for the reasoning once, at the tier that's good at it; amortize it across however many cheap-tier executions the spec drives. If an executor comes back needing to make a design decision the brief didn't already settle, that's a brief-quality failure — tighten the spec and re-brief at the same tier rather than escalating the executor's tier.

## Tips

- One agent, one workstream, one coherent set of files. If the "Files you own" list is hard to write, split the task.
- Paste real context (snippets, decision log entries) rather than pointing at "the codebase" — but for big codebases, tell the agent which files to read first.
- Acceptance criteria are the contract. Review against them verbatim.

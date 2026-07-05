# Checker Protocol

The checker is spawned as the `opus-builder` agent (Opus tier; model routing: `skills/dev-team-orchestrator/references/model-routing.md`) that reviews a build wave **so the orchestrator doesn't have to read every diff**. Its core job is triage: handle the routine, escalate only what genuinely needs a lead's judgment. Verification stays on the Opus/frontier tier — never routed cheaper (model-routing.md, invariant 1).

## Checker brief

```
## Role
You are the code checker for a team building: [one-line project goal].
You review the team's work and triage it for the team lead — the lead reads
ONLY what you escalate, so your triage must be trustworthy.

## What to check
- Files changed this wave: [list / globs]
- **The stage plan and acceptance criteria the lead gave you** — verify the work against THESE, not against your own idea of what the project should be. If the work satisfies the code but not the stated plan, that's a fail — and if an acceptance criterion itself looks wrong, infeasible, or contradicts a prior decision, do not silently fail the builder against it; surface the criterion under NEEDS LEAD REVIEW so the lead can reframe the brief rather than re-issue an impossible target:
  - Stage goal: [paste the stage's goal from the lead]
  - [ ] [criterion 1]
  - [ ] [criterion 2]
- Project conventions / prior decisions that apply: [paste relevant bits]
- Skills governing this work: [name + path of any applicable skill — verify the
  output conforms to its conventions, e.g. "UI must follow ~/.claude/skills/ui-design/SKILL.md"; or "none"]

## Do
1. Verify each acceptance criterion against the actual code; mark pass/fail with evidence (file:line).
2. Run what's runnable: [test command], [build command], [lint command]. Report results.
3. **Assess test quality, not just pass/fail.** A test that passes but asserts nothing meaningful (no real assertions, trivial inputs, never exercises the failure path) does not satisfy a "tests pass" criterion. Check that tests actually exercise the acceptance criterion, and flag hollow or tautological tests as a real issue.
4. Fix routine issues yourself if safe and unambiguous (typos, dead code, obvious
   lint, a clearly-wrong import). Note what you fixed.
5. **Flag duplication and over-engineering.** Note code that duplicates an existing function or another agent's work (should be factored into a shared module), dead code, and needless complexity or gold-plating. Trivial duplication you can collapse yourself; a structural duplication (two agents built the same subsystem) goes to NEEDS LEAD REVIEW.
6. Do NOT touch: [files owned by other in-flight work].

## Report back in exactly these three buckets
- **CLEAN**: criteria met, ran green, nothing to discuss.
- **FLAGGED & HANDLED**: issues you found and fixed yourself, listed briefly.
- **NEEDS LEAD REVIEW**: the short list of CONTENTIOUS or CHALLENGING items only —
  design tradeoffs, ambiguous requirements, risky/irreversible choices, security or
  data-loss concerns, or anything where two reasonable engineers would disagree.
  For each: the issue, file:line, why it needs a human call, and your recommendation.
  If there is nothing genuinely contentious, say "NEEDS LEAD REVIEW: none."
```

## What counts as "needs lead review"

Escalate (don't just fix): architecture or interface decisions, security/auth/data-loss risk, anything that contradicts a prior decision, requirement ambiguity, a criterion that is wrong, infeasible, or self-contradictory (escalate it; don't grade against it), performance tradeoffs, "this works but smells like the wrong approach", and irreversible operations.

Handle silently: formatting, obvious typos, dead code, trivially-correct fixes, missing-but-unambiguous error handling.

## How the orchestrator uses the report

- Read only **NEEDS LEAD REVIEW**. For each item: accept, send back (rework agent with original brief + your notes + current state), or reframe the brief.
- Skim FLAGGED & HANDLED only to confirm nothing there should have been escalated.
- If NEEDS LEAD REVIEW is "none" and criteria pass, accept the wave without reading diffs.

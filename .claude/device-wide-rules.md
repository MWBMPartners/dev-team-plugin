# Device-wide rules — to add on the owner's own computer

<!--
  File:     .claude/device-wide-rules.md
  Purpose:  The owner asked for the "hand over when a service runs out" rule (and the plain-English
            rule) to apply to every project on their computer, not just this repository. The
            assistant that wrote this was running in a cloud copy of the repository, so it could not
            reach the owner's own computer. This file holds the wording, ready to add there.
  Updated:  23 September 2026.
-->

## How to add it

On the owner's computer, add the block below (between the lines) to the end of **both**:

- `~/.claude/CLAUDE.md` — read by Claude Code in every project;
- `~/.codex/AGENTS.md` — read by Codex in every project.

If either file already has an older version of one of these rules, replace that rule rather than
adding a second copy. Any assistant working on that computer can do this when asked:
"add the rules in `.claude/device-wide-rules.md` of dev-team-plugin to my device-wide rules".

---

## Plain English

When explaining, reporting or writing anything for people, use plain, everyday English with no
technical jargon. When a technical name cannot be avoided, use it and then say in ordinary words what
it is and why it matters.

## When an AI service runs out — hand over, then hand back

If the AI service, model or agent doing the work becomes unavailable (out of credit, rate-limited, or
down), hand the work to another suitable one rather than stopping — but only if it can be done
without losing what is known or what has been done. Keep the project's handover document up to the
minute so that this is always possible. Switch back to the usual one often: at the next natural
break, and always try it first on each new run. When it is back, have it do a full review of
everything done while it was away. Record every hand-over in the commit message and the handover
document. Reviews by a different AI system from the one that built the work are what catch any
differences in how the stand-in worked. This rule does not name particular tools on purpose.

---

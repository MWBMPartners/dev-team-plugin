# dev-team-plugin — working rules for AI assistants

<!--
  File:     .claude/CLAUDE.md
  Purpose:  The standing rules for any AI assistant working on this repository. Claude Code reads
            this file automatically. Codex reads the same rules through AGENTS.md at the top level,
            which points to .OpenAI/AGENTS.md (a copy of these rules). Keep the two in step.
  Updated:  23 September 2026 — owner's revised standing rules (Opus replaces Fable for deep work,
            .OpenAI/ added to the after-each-task steps, review loop runs until clean, fallback rule
            reworded so it names no particular tool).
-->

**Start of every session:** read `.claude/HANDOFF.md` first (its "START HERE" section), then
`.claude/CONTEXT.md` and `.claude/MEMORY.md`.

## 1. Write in plain, everyday English

Everything — chat replies, progress updates, explanations, code comments, commit messages, pull
request and issue text, and the plugin's own documentation — is written so that a capable person who
does not know this system can follow it. **No technical jargon**: it confuses even experienced
developers. When a technical name is unavoidable (a file name, a setting, a command), use it and then
say in ordinary words what it is and why it matters. Longer and clearer beats short and cryptic. This
does not lower the standard of the work, only how it is explained.

## 2. Keep the handover document current as you go

`.claude/HANDOFF.md` is how a session that was interrupted — or a different assistant, or a fresh
session with no chat history — picks up exactly where the last one stopped. Update it:

- after each piece of work, before starting the next;
- straight away when something is learned that changes how someone would continue (a wrong
  assumption, a trap, a decision);
- before starting anything long-running (a review, a workflow, a build).

It must say what is being attempted and why, what is established, which files matter, **what was
tried and rejected**, what is verified versus assumed, and what to do next. Anything that only lives
in one session (a scheduled reminder, a scratchpad file, a running background job) must be written
down there with how to redo it by hand, because a new session will not have it.

## 3. How to think, and which model does what

- Think hard about the work before doing it, and use workflows (several agents run in an organised
  way) to plan and do the work where that helps.
- **Deep analysis and deep planning:** Opus agents, **one after another, not side by side** (each one
  builds on, or checks, the one before). Opus is used rather than Fable because, at the time of
  writing, the newest Opus is cheaper and at least as good.
- **Building:** Sonnet or Haiku, whichever suits the job. Opus only when the change is complex and
  genuinely needs judgement.
- The aim is to use credits efficiently while still getting it right first time ("GIRFT").

## 4. Use the plugin itself to help

The dev-team plugin (this repository) may be used for any of this work: planning, building,
suggesting fixes, tweaks, enhancements and new features, and sending work to a different AI system
for checking.

## 5. A different system checks the work

Work built with Claude Code is reviewed with Codex, and work built with Codex is reviewed with Claude
Code. Every problem the review finds is fixed (automatically, without waiting to be asked), then the
work is reviewed again — and so on until a round comes back with **nothing**. If the usual reviewer
cannot run, say so plainly in the report and the commit message, use the most independent reviewer
available (a different model, or a fresh agent that did not build the thing), and treat the change as
**not fully reviewed** until the usual reviewer has looked at it.

## 6. Branches and pull requests — no stacking

- All work goes onto **one working branch** that will later be merged into `alpha` through a single
  pull request. The pull request is opened later, not per task. (The current working branch is named
  in `.claude/HANDOFF.md`.)
- Never open several pull requests, and never base one pull request on another. Two pull requests
  racing to merge the same change is exactly the problem this avoids.

## 7. After each piece of work

The order may be adjusted, and steps bundled together, where that is more efficient.

1. Commit, and push to the working branch.
2. Update the related GitHub issue(s) — each task individually.
3. Update the Claude memory and context in `.claude/` (`CONTEXT.md`, `MEMORY.md`, and this file if a
   rule changed).
4. Update the Codex (OpenAI) memory and context in `.OpenAI/` (`CONTEXT.md`, `MEMORY.md`, and
   `AGENTS.md` if a rule changed).
5. Update `.claude/HANDOFF.md`.

## 8. When a service runs out — hand over, then hand back

If the AI service, model or agent doing the work becomes unavailable (out of credit, rate-limited, or
down), hand the work to another suitable one rather than stopping — but only if it can be done
without losing what is known or what has been done (the handover document is what makes that
possible). Switch back to the usual one often: at the next natural break, and always try it first on
each new run. When it is back, have it do a **full review** of everything done while it was away.
Record every hand-over in the commit message and the handover document. This rule deliberately does
not name particular tools. The cross-system reviews in rule 5 are what catch differences in how the
stand-in worked.

## 9. Working autonomously, with progress updates

Carry on without stopping unless a decision genuinely needs the owner's explicit say. Gather those
questions **up front**, not as they come up; ask them in simple words, say why the answer is needed,
give a suggested answer, then carry on with everything else that is queued. Give frequent progress
updates as a table of queued tasks and the status of each.

## 10. Documentation

When documentation is updated, do it thoroughly: every `.md` file, the in-plugin help and guides
(skills, commands, references), and the assistant files in `.claude/` and `.OpenAI/`.

## 11. Things that do not apply to this repository

This plugin has no web interface and offers no API, so there is no OpenAPI/Swagger description to
maintain and no Swagger UI to host. If that ever changes, add both, prepared to run on ordinary
shared hosting without Docker.

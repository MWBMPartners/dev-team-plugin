# dev-team-plugin — working rules for AI assistants (Codex copy)

<!--
  File:     .OpenAI/AGENTS.md
  Purpose:  The standing rules, for Codex. Codex reads AGENTS.md at the top of the repository, which
            points here. This is a copy of .claude/CLAUDE.md (the rules Claude Code reads); the two
            must say the same thing. If you change one, change the other.
  Updated:  23 September 2026.
-->

**Note for Codex:** where these rules mention `.claude/` files, they are shared by every assistant —
read them too. Codex's own memory and context are `.OpenAI/CONTEXT.md` and `.OpenAI/MEMORY.md`.
When Codex is asked only to *review* (read-only), it follows rule 1 (plain English) and changes
nothing.

**Start of every session:** read `.claude/HANDOFF.md` first (its "START HERE" section), then
`.OpenAI/CONTEXT.md`, `.OpenAI/MEMORY.md` and `.claude/MEMORY.md`.

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

This plugin itself has no web interface and offers no API, so there is no OpenAPI/Swagger description
to maintain for it and no Swagger UI to host. That is about **this repository only**: rule 15 still
applies to every project the plugin is used on. If this plugin ever gains a web interface or API, add
both, prepared to run on ordinary shared hosting without Docker.

## 12. Many AI systems, one team (added 17 November 2026)

The plugin is not tied to Claude Code, and not only for writing software. It must work across AI
systems and from any editor, and spend credit sensibly while still getting each task right first time
(GIRFT). Every new feature, skill and document is written to this standard:

- **Delegate by job, to the model that suits it.** Gathering information: a cheaper, faster model.
  Deep analysis and planning: the strongest reasoning model. Building: a mid-priced or cheap model.
  Review: a different system from the one that built the work. Never hard-code one maker's model
  names where a job description ("scout", "architect", "builder", "reviewer") will do.
- **Many systems, switchable.** Claude Code, Codex, Gemini, Copilot, Kimi, Grok, DeepSeek, Ollama
  (Qwen and others running on the user's own machine) and any others, present or future. Within each
  system, pick the right model for the task; if another system suits the task better, or the first one
  has run out, switch to it (rule 8) without losing the record of the work.
- **Local first, or cloud first — the user chooses.** Either start on free local models and move to paid
  cloud models for harder work, or start on cloud models and fall back to local ones when the cloud
  allowance runs out. The move must be smooth, and work from the user's usual editor (Xcode, Visual
  Studio, Visual Studio Code, Cursor and others).
- **Per session and per project.** All of these choices can be set for one session, or saved for a
  whole repository, and the project's setting wins over the user's general one unless told otherwise.
- **Some models need a specific yes.** The user can mark models (for example Claude Fable or Claude
  Mythos, which cost a lot but are very good) as needing explicit approval for each task. The plugin
  asks first, says why, and gives a cheaper suggestion. No such model is ever used silently.
- **Exact versions on request.** A developer can name the exact version of each model to use. If none
  is named, the plugin uses the newest suitable one.
- **New models without a plugin update.** New models and versions (from a service, or newly installed
  on the user's machine) are found by asking what is actually available, and by a catalogue that can be
  refreshed, so adding support never needs a code change for each release. Newly found models are
  tried carefully before being trusted with important work.
- **Not only coding.** Wording, structure and examples must not assume the work is software.

## 13. One shared set of project documents (added 17 November 2026)

Every project keeps one handover document, and one each for **goals, requirements and prerequisites,
and plans**. Any AI system and any model must be able to read them and carry on, so they are written in
plain, tool-neutral language and kept current at every stage (rule 2), not tidied at the end. They are
the single place where "what are we doing, and why" is recorded, so that switching model or system (rules
8 and 12) loses nothing and costs few tokens.

## 14. The repository's tracker is the source of truth (added 17 November 2026)

Where a project is on a hosting service (GitHub, GitLab or similar), its **issues** and its plans
(**projects, boards, milestones**) are kept fully up to date as work happens, because they are what
every developer, machine and device sees. If a document and the tracker disagree, fix the disagreement
straight away, and say which one was right. Project documentation — `.md` files, in-app help, guides,
and any repository wiki — is kept current in the same pass.

## 15. Web apps and APIs: OpenAPI and Swagger UI (added 17 November 2026)

For any **web-based project the plugin works on** that offers an API: keep its OpenAPI (Swagger)
description in step with the code, and provide a Swagger UI page where API users can browse how to use
the API. It may be limited to people who have API access. Prepare it to run on ordinary shared hosting
without Docker. (Rule 11 explains why this repository itself has none.)

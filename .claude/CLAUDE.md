# dev-team-plugin — working rules for AI assistants

<!--
  File:        .claude/CLAUDE.md
  Purpose:     Standing rules for any AI coding assistant working ON this plugin's own repository
               (not rules the plugin applies to other projects — those live in skills/).
  Maintainer:  MWBM Partners Ltd
  Why here:    These rules were given by the owner on 13 September 2026 and apply to every session.
               The owner's device-wide rules (~/.claude/CLAUDE.md) already cover plain English,
               handing work over when a service runs out, and GIRFT. This file repeats the parts that
               matter for this repository so that a tool which does not read that personal file still
               follows them.
-->

## 1. Write in plain, everyday English

Everything — chat replies, progress updates, code comments, commit messages, pull request and issue
text, and the plugin's own documentation — is written so that a capable person who does not know
this system can follow it. No jargon. When a technical name is unavoidable (a file name, a setting),
use it and then say in ordinary words what it is and why it matters. Longer and clearer beats short
and cryptic. This does not lower the standard of the work, only how it is explained.

## 2. Keep the handover document current as you go

`.claude/HANDOFF.md` is how a session that was interrupted — or a different assistant — picks up
exactly where the last one stopped. Update it:

- after each piece of work, before starting the next;
- straight away when something is learned that changes how someone would continue (a wrong
  assumption, a trap, a decision);
- before starting anything long-running.

It must say what is being attempted and why, what is established, which files matter, **what was
tried and rejected**, what is verified versus assumed, and what to do next.

## 3. Which model does what

- **Deep analysis and deep planning:** Fable agents, one after another (not side by side). If Fable
  is unavailable, fall back to Opus — but try Fable again first on every new analysis or planning run.
- **Building:** Sonnet or Haiku, whichever suits the job. Opus only when the change genuinely needs
  judgement.
- The aim is to use credits efficiently while still getting it right first time.

## 4. A different system checks the work

Work built with Claude Code is reviewed with Codex, and work built with Codex is reviewed with Claude
Code. Fix what the review finds and review again, until a round comes back with nothing. If the usual
reviewer cannot run, say so plainly in the report and the commit message, use the most independent
reviewer available (a different model, or a fresh agent that did not build the thing), and treat the
change as not fully reviewed until the usual reviewer has looked at it.

## 5. Branches and pull requests

- All work goes onto **one working branch** that will later be merged into `alpha` through a single
  pull request. The pull request is opened later, not per task.
- Never open several pull requests, and never base one pull request on another. Two pull requests
  racing to merge the same change is exactly the problem this avoids.

## 6. After each piece of work

1. Commit, and push to the working branch.
2. Update the related GitHub issue — each task individually.
3. Update the assistant memory and context in `.claude/`.
4. Update `.claude/HANDOFF.md`.

## 7. When a service runs out — hand over, then hand back

If the assistant, model or agent doing the work becomes unavailable (out of credit, rate-limited, or
down), hand the work to another suitable one rather than stopping — but only if what is known can go
with it (the handover document is what makes that possible). Go back to the usual one at the next
natural break, and always try it first on each new run. When it is back, have it do a **full review**
of everything done while it was away. Record every hand-over in the commit message and the handover
document. This rule deliberately does not name particular tools.

## 8. Working autonomously

Carry on without stopping unless a decision genuinely needs the owner. Gather those questions up
front, ask them in simple words with a suggested answer, then continue with everything else. Give
frequent progress updates as a table of queued tasks and their status.

## 9. Things that do not apply to this repository

This plugin has no web interface and offers no API, so there is no OpenAPI/Swagger description to
maintain and no Swagger UI to host. If that ever changes, add both, prepared to run on ordinary
shared hosting without Docker.

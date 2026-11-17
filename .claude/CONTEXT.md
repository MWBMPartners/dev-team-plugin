# Project context — dev-team-plugin

<!--
  File:     .claude/CONTEXT.md
  Purpose:  The background an AI assistant needs before working here: what this repository is, how
            it is laid out, how to check it, and where the live work stands. Short on purpose; the
            detail lives in .claude/HANDOFF.md and .claude/plans/.
    Updated:  5 October 2026 (issue #47's sixth round, acting on Codex's catch-up review of 748e87c..2f91439).
-->

## What this repository is

A plugin for Claude Code called **dev-team**. It turns one Claude Code session into a small software
team: a lead that plans and hands work to cheaper or stronger AI models, builders, checkers and a
record-keeper. It has no web interface and no API.

## How it is laid out

| Folder | What is in it |
| --- | --- |
| `skills/` | The plugin's abilities (each a `SKILL.md` plus `references/`). The main one is `dev-team-orchestrator`. |
| `commands/` | The slash commands people type, such as `/dev-team-move-ledgers`. |
| `agents/` | The helper agents and which model each uses. |
| `hooks/` | Safety scripts that run before the assistant writes a file or runs a command (for example `guard-ledgers.sh`). |
| `schemas/` | Descriptions of the plugin's data files, used to check them. |
| `scripts/` | Self-check scripts (`audit-model-ids.sh`, `audit-ledger-paths.sh`, `check-verdict.sh`). |
| `tests/` | `scripts.bats` (the main test file) and `smoke-structure.sh`. |
| `.claude/` | Working notes for AI assistants: rules, handover, plans, memory. Not part of the plugin itself. |
| `.OpenAI/` | The same kind of notes for Codex. |

## How to check the work (run all of these before committing)

```bash
bash scripts/audit-model-ids.sh        # no dated model names outside the model roster file
bash scripts/audit-ledger-paths.sh     # no document points at the old top-level record files
bash tests/smoke-structure.sh          # the plugin's folder layout is sound
shellcheck scripts/*.sh hooks/*.sh tests/*.sh
TMPDIR=<a writable folder> bats tests/scripts.bats   # bats 1.5.0 or newer; 144 tests on #41's branch, 199 on #47's
```

The automatic checks on GitHub (`plugin-audit`) run only on pull requests and on pushes to `main`,
not on pushes to the working branch — so run them yourself.

## Branches

- `main` is the released line (version 1.7.0). `alpha` and `beta` were set equal to `main` on
  9 November 2026 (`00e0b67`).
- No working branch is in flight. `claude/ledger-file-clashes`, `feature/bcp47-language-policy` and
  `claude/gifted-wright-y3ze25` were merged into `main` by pull request #49 and then deleted. Start
  new work from `alpha`; it goes back to `alpha` in one pull request, opened by the owner's say-so.
  (Merging straight to `main` on 9 November was a one-off.)

## Live work (details in `.claude/HANDOFF.md`)

| Issue | What | State |
| --- | --- | --- |
| [#41](https://github.com/MWBMPartners/dev-team-plugin/issues/41) | Move all the plugin's record files into `.dev-team/` so they stop clashing with a project's own `FEATURES.md`, `SECURITY.md` and similar. Version 1.5.0. | Built and fixed over five rounds; waiting for a clean Codex review. |
| [#46](https://github.com/MWBMPartners/dev-team-plugin/issues/46) | A smarter orchestrator that works across AI providers. | Analysis and plan done; waiting on owner decisions D1–D4. |
| [#45](https://github.com/MWBMPartners/dev-team-plugin/issues/45) | Build the owner's standard working practices into the plugin. | Mapped; waiting for the owner to pick which to build. |
| [#47](https://github.com/MWBMPartners/dev-team-plugin/issues/47) | Agents follow a project's own instruction files and the standards they name — only as copied when the run starts (into a uniquely named `~/.dev-team/runs/<run-id>/snapshot/`, outside the project: the copies in its `files/` folder, the manifest beside it; the checkout the user starts on is treated as the user's own; a resumed run checks and reuses its recorded snapshot), and only to add checks or choose style, never to remove or loosen a check, gate, confirmation or safety rule. The limits are stated plainly: start from your own branch; this is not an enforcement boundary; only the plugin's two guard hooks enforce anything, and their descriptions say what each covers and the limits known. Version 1.6.0, on `feature/bcp47-language-policy`. | Built in six rounds. Reviews so far: Codex reviewed `413d570..748e87c` (10 findings) and `748e87c..42bd45e` (6); stand-ins (fresh Opus agents) reviewed `748e87c..a9fb292` and `42bd45e..b39f40d`; the fifth round (`b39f40d..2f91439`) had no review of its own; Codex's catch-up review of `748e87c..2f91439` (rounds 2 to 5) was not clean — 8 findings — and the sixth round acts on them (the Bash guard: a zero byte in `$'…'`, a remote set up as a mirror, a time limit that covers reading the input and stops what ignores the request to stop, `git … push` looked for inside one command, tests that prove the reading reaches the end; ci-medic finds a `/loop`'s run from its run record instead of starting a new one; these notes). Commits after `2f91439` are not yet reviewed. Next: see the #47 section of `.claude/HANDOFF.md`. Waits on #41. |
| #42, #43, #44 | Follow-ups found during #41. | Not started. |

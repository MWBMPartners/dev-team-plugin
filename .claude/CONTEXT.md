# Project context — dev-team-plugin

<!--
  File:     .claude/CONTEXT.md
  Purpose:  The background an AI assistant needs before working here: what this repository is, how
            it is laid out, how to check it, and where the live work stands. Short on purpose; the
            detail lives in .claude/HANDOFF.md and .claude/plans/.
  Updated:  28 September 2026 (issue #47 branch added).
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
bats tests/scripts.bats                # needs bats 1.5.0 or newer; 144 tests on #41's branch, 149 on #47's
```

The automatic checks on GitHub (`plugin-audit`) run only on pull requests and on pushes to `main`,
not on pushes to the working branch — so run them yourself.

## Branches

- `main` is the released line; `alpha` is fully contained in `main`.
- Current working branch: `claude/ledger-file-clashes`. It will go to `alpha` in one pull request,
  opened later by the owner's say-so.
- Also in flight: `feature/bcp47-language-policy` (issue #47), cut from `claude/ledger-file-clashes`
  and waiting on it.

## Live work (details in `.claude/HANDOFF.md`)

| Issue | What | State |
| --- | --- | --- |
| [#41](https://github.com/MWBMPartners/dev-team-plugin/issues/41) | Move all the plugin's record files into `.dev-team/` so they stop clashing with a project's own `FEATURES.md`, `SECURITY.md` and similar. Version 1.5.0. | Built and fixed over five rounds; waiting for a clean Codex review. |
| [#46](https://github.com/MWBMPartners/dev-team-plugin/issues/46) | A smarter orchestrator that works across AI providers. | Analysis and plan done; waiting on owner decisions D1–D4. |
| [#45](https://github.com/MWBMPartners/dev-team-plugin/issues/45) | Build the owner's standard working practices into the plugin. | Mapped; waiting for the owner to pick which to build. |
| [#47](https://github.com/MWBMPartners/dev-team-plugin/issues/47) | Agents read a project's own instruction files and the standards they name — from trusted places only, never overriding the suite's safety rules. Version 1.6.0, on `feature/bcp47-language-policy`. | Revised after one independent review; needs another review round. Waits on #41. |
| #42, #43, #44 | Follow-ups found during #41. | Not started. |

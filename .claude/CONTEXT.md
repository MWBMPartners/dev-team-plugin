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
| [#41](https://github.com/MWBMPartners/dev-team-plugin/issues/41) | Plugin record files moved into `.dev-team/` (1.5.0). | Merged to `main` on 9 Nov (PR #49). Waiting for a clean Codex review; issue left open. |
| [#47](https://github.com/MWBMPartners/dev-team-plugin/issues/47) | Agents follow a project's own instructions and the standards they name (1.6.0). | Merged to `main` on 9 Nov (PR #49). Waiting for a clean Codex review; issue left open. |
| [#46](https://github.com/MWBMPartners/dev-team-plugin/issues/46) | A smarter orchestrator that works across AI providers. | Plan done; owner answered D1–D4 on 17 Nov, and added new requirements (see `.claude/plans/orchestrator-v2/owner-brief-addendum-2026-11-17.md`). Not yet built. |
| [#45](https://github.com/MWBMPartners/dev-team-plugin/issues/45) | The owner's standard working practices as features. | All choices answered on 17 Nov; the `profile: standard` preset is not yet built. |
| #44, #48, #42 | Guard keyed on `loop.lock/`; guard wording; security findings out of git by default. | **Built on `claude/busy-knuth-bc35ok`** on 17 Nov (commits `ae2b909`, `158f4bc`); not yet reviewed by Codex. |
| #43 | Schema for `autopilot.json`. | Waits for #46. |

> 17 Nov 2026 (end of session): groups A, B, C, D done on `claude/busy-knuth-bc35ok` (latest commit: see `git log`); E planned only. Details in `.claude/HANDOFF.md`.

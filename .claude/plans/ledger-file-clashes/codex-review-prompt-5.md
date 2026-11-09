# Codex review brief — issue #41, round 5 (whole branch)

<!--
  File:     .claude/plans/ledger-file-clashes/codex-review-prompt-5.md
  Purpose:  The written instructions fed to Codex for the next full review of the working branch.
            Saved in the repository (not only in a session's scratchpad) so a fresh session can run
            the review by hand. Rebuilt on 23 September 2026 from the handover's description of the
            earlier briefs (codex-exec-prompt-2.md and -4.md, which lived only in a scratchpad). If
            the owner's own machine still has codex-exec-prompt-4.md, either may be used; this one
            also covers the newest commits.
  How to run (from the repository's top folder; nothing else may be running or mid-edit):
      codex exec -m gpt-5.6-sol -c model_reasoning_effort='"high"' -s read-only -C "$PWD" \
        -o <scratchpad>/codex-review-5.md - < .claude/plans/ledger-file-clashes/codex-review-prompt-5.md \
        > <scratchpad>/codex-review-5.log 2>&1; echo "CODEX EXIT $?" >> <scratchpad>/codex-review-5.log
  Swap the model after -m only if it reports "at capacity" (choose from `codex debug models`).
-->

You are reviewing a branch of a Claude Code plugin called dev-team. **Change nothing.** Read
`git diff main...HEAD` yourself and review the whole branch, not just the newest commits. Write your
answer in plain English.

## What the branch does

The plugin writes its record files (`FEATURES.md`, `SECURITY.md`, `PROJECT.md`, `VERIFICATION.md`
with `verdict.json`, `MIGRATION.md`, `HANDOFF.md`) into the top level of whichever project it runs
in, where they clash with the project's own files of the same name. This branch moves them all into
the project's `.dev-team/` folder, marks each with a line-2 marker
(`<!-- dev-team: ledger=<kind> schema=1.0 -->`), refuses to overwrite a file without the marker,
adds `/dev-team-move-ledgers` to move old files, adds the safety hook `hooks/guard-ledgers.sh`, the
self-check `scripts/audit-ledger-paths.sh`, a schema for `verdict.json`, and version 1.5.0.

## What is new since your last complete review (round 3, which found 14 problems)

- Fix round 3: 4e923a9 (hook), 0f192a4 (move-ledgers), ebf30d3 (rules, docs, audit, schema),
  9357553 (tests).
- Fix round 4: 960ef64 (hook: a session's own `<subfolder>/.dev-team/` counts as inside; `guard:`
  read from both configs), 6f9d1ab (move-ledgers undoes one path at a time), 8be396b (tests;
  `check-verdict.sh` exits 2 for invalid JSON).
- Fix round 5: fc49383 (hook: also guards a subfolder session's own record names; ids past 999),
  8b0d080 (a FAIL verdict must have a cause; empty file exits 2), 88d7d47 (docs and move-ledgers
  recovery text), 6414826 (tests — 144 in total).
- Your own interrupted round-4 review had found two problems (ids past 999 got through; a subfolder
  session could write to its own `SECURITY.md`). Both were confirmed and fixed in round 5 — check
  the fixes.
- Commits touching only `.claude/`, `.OpenAI/` and the top-level `AGENTS.md` are assistant notes,
  not plugin code.

## Open question — do not report it as a fault

In a session started in a subfolder of a repository, should `.dev-team/` live in that subfolder or at
the repository's top folder? The owner has not decided. Report only real damage (lost or overwritten
files, a guard that can be walked around), not the choice itself.

## Look hard at

1. `hooks/guard-ledgers.sh`: can a plugin record still be written outside `.dev-team/`, or can a
   person's own file be wrongly refused? Try subfolders, `..` tricks, absolute paths, trailing
   slashes, capital letters, `guard: off`, and bash 3.2 as well as bash 5.
2. `commands/dev-team-move-ledgers.md`: can it lose, overwrite or wrongly move a file? Is the undo
   step safe for someone else's unrelated work?
3. The rules text (the ownership rule, the lookup order) and every copy of it: do the copies agree,
   and does any instruction still point at the old top-level place?
4. `scripts/audit-ledger-paths.sh`, `scripts/check-verdict.sh` and the verdict schema with its
   examples: anything wrongly passed or wrongly failed?
5. `tests/scripts.bats`: does any test write to, or delete from, the real repository? Does any test
   pass without proving what it claims?
6. `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`: any claim the code does not back up?
7. The CI workflow.

You cannot run `bats` inside the read-only sandbox; say so rather than guessing.

## How to report

For each problem: the file and line, what goes wrong, a concrete case that shows it, how serious it
is (high, medium or low), and whether it is new on this branch or already on `main`. If you find
nothing, say plainly "no problems found".

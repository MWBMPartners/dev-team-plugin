# Lessons and traps for Codex — dev-team-plugin

<!--
  File:     .OpenAI/MEMORY.md
  Purpose:  Lessons that matter when Codex works on, or reviews, this repository. The fuller shared
            list is .claude/MEMORY.md (its "Running Codex reviews" section is about how Codex is
            started here). Add new lessons to whichever file fits, and keep them in step.
  Updated:  4 October 2026 (after #47's fifth round: more command shapes to try, and timing a
            hook; after the fourth: reading commands like the shell, and hook registration).
-->

- When reviewing, compare the working branch with `main` (`git diff main...HEAD`). Text that
  appears only on `main` is old; check the branch before reporting it. (A 14 September review
  nearly reported `main`'s old README wording about a top-level `HANDOFF.md`.)
- The `.claude/` folder holds assistant notes, not plugin code. It names old mistakes on purpose
  (for example the mistyped folder name `dev-template`), so hits there are not problems.
- Report each finding with: the file and line, what goes wrong, a concrete case that shows it, how
  serious it is (high, medium, low), and whether it was new on this branch or already on `main`.
- The tests need bats 1.5.0 or newer. If they cannot be run, say so.
- A test that only looks for a heading or a loose word can pass while the rule under it says the
  opposite. When reviewing a test, ask whether it would fail if the rule's meaning were reversed —
  and whether it would fail if words were ADDED to the rule (a new exception), not only removed.
- If bats cannot start in the sandbox because the temporary folder is not writable, set `TMPDIR` to
  a writable folder (for example one under the review's own output folder), or say plainly that the
  tests were not run.
- When a check reads a command's text, try the shapes the shell treats as the same: single quotes,
  a backslash, a quoted command name, a command string given to `sh -c` or `eval`, and a command
  that names no target at all (a bare `git push`). And when a test runs a hook script directly,
  ask whether anything checks that the hook is still registered in `hooks/hooks.json` (the smoke
  test does, since #47's fourth round).
- When reviewing a guard that reads commands, also try: git's matching refspec `:`, `$'\x6d…'`
  escapes, a brace list, a push piped into a shell (`echo '…' | sh`, `sh <<< '…'`), `--` after
  `-c`, `env -C <dir>`, a named branch that `remote.<name>.push` sends elsewhere, and a very long
  command timed under the Mac's `/bin/bash` 3.2 (a hook that is too slow is not waited for; bash's
  `${w%…}` / `${w#…}` on a long word grow with the square of its length).
- Also try (found in #47's catch-up review): a zero byte inside `$'…'` (`$'main\0ignored'` is
  `main` in bash); a push to a remote set up as a mirror (`remote.<name>.mirror`); a slow `jq` and
  a child that ignores SIGTERM while holding the hook's output, under a short time limit; separate
  commands whose words only add up to a push (`git status; echo 'push' 'main'`); and, for a test
  that claims a long command is read to the end, whether it still passes when the reading stops
  early.
- Give every finding a severity. The review loop stops when a review finds no high or medium
  problems; low findings, wording points and older faults become GitHub issues, not new rounds.
- A record identifier such as `F-001` can run past 999 (`F-1000`); patterns must allow three or
  more digits.

## After the 9 November 2026 merge

- Merging three branches by hand: read the real diffs first. Here one branch already contained
  another (check with `git rev-list --count A..B` both ways), and two branches both used version 1.5.0
  for different work — look for version-number clashes in `plugin.json` and the CHANGELOG.
- A cloud session cannot delete branches (the connection answers 403); do not try workarounds, ask
  the owner. Moving `alpha`/`beta` forward with an ordinary push did work.
- Three checks on `main` failing after about two seconds, with no steps run and logs gone, was not a
  code fault: the same checkout pin passed on the next run. Look at the run's job list for a missing
  machine (`runner_id` 0) before suspecting the workflow files.

- 17 Nov 2026: standing rules 12-15 added (many AI systems, shared project documents, tracker as source of truth, Swagger UI for projects with APIs). Requirements: .claude/plans/orchestrator-v2/owner-brief-addendum-2026-11-17.md.
- 17 Nov 2026: Q6-Q9 answered (see HANDOFF). Built #44, #48, #42 on claude/busy-knuth-bc35ok. bats here needs: npm i -g bats; pip install shellcheck-py. Codex is not installed in the cloud session.
- 17 Nov 2026: engine lesson: do not extend the hand-written YAML reader (engine/lib/config.mjs) any further; it fails closed on anything it cannot read. Node 22 needs `node --test engine/test/*.test.mjs` (a glob, not the folder).

## Update — 17 November 2026 (end of day)

Full queue and how to resume: `.claude/HANDOFF.md`, "START HERE". Tracking issues #50 to #59 are sub-issues of #46. Milestones, the Projects board and wiki pages could not be made with the cloud session's tools; ready-to-apply drafts are in `.claude/plans/tracker-setup.md` and `docs/wiki-drafts/`. Branch: `claude/busy-knuth-bc35ok`; no pull request yet; version still 1.7.0; nothing has had a Codex review.

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
- A record identifier such as `F-001` can run past 999 (`F-1000`); patterns must allow three or
  more digits.

# Lessons and traps for Codex — dev-team-plugin

<!--
  File:     .OpenAI/MEMORY.md
  Purpose:  Lessons that matter when Codex works on, or reviews, this repository. The fuller shared
            list is .claude/MEMORY.md (its "Running Codex reviews" section is about how Codex is
            started here). Add new lessons to whichever file fits, and keep them in step.
  Updated:  28 September 2026.
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
  opposite. When reviewing a test, ask whether it would fail if the rule's meaning were reversed.
- A record identifier such as `F-001` can run past 999 (`F-1000`); patterns must allow three or
  more digits.

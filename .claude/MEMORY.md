# Lessons and traps — dev-team-plugin

<!--
  File:     .claude/MEMORY.md
  Purpose:  Things learned the hard way while working on this repository, kept in the repository so
            they survive a new session, a new machine or a different assistant. Add to it when a
            lesson is learned; do not remove entries that still hold.
  Updated:  28 September 2026 (three lessons from #47's second review added; the rest
            gathered from the handover history of 13–14 September).
-->

## Running Codex reviews

- `codex review --base main "<instructions>"` is **refused**: that version of Codex will not take a
  branch and custom instructions together. For a focused review use
  `codex exec -s read-only -C <repo> -o <output.md> - < <prompt.md>` and tell it in the prompt to read
  `git diff main...HEAD` itself and change nothing.
- **Always** add `-c model_reasoning_effort='"high"'`. On the owner's machine the default is "none",
  which gives a shallow review. Check the start-up banner says `reasoning effort: high`.
- If the usual model says "Selected model is at capacity", pick another from `codex debug models`
  (do not guess). `gpt-5.6-sol` worked on 14 September.
- The owner's Codex allowance covers about **one** high-effort review of the whole branch, and the
  reset can be hours away. Plan reviews as single, spaced runs, and save them for the most valuable
  check.
- To tell whether a run failed, look in its log for the real error wording: `You've hit your usage
  limit`, `Selected model is at capacity`, or a line starting `ERROR:`. A plain search for "usage
  limit" also matches this branch's own commit messages, which Codex prints while reading.
- **Do not commit while Codex is reviewing**: it reads `main...HEAD`, so a new commit changes what it
  is reading. Commit straight after it finishes.
- End the log with a marker (for example `echo "CODEX EXIT $?" >> log`) so anyone can tell whether it
  finished.

## Things that do not survive a new session

- Reminders booked with CronCreate exist only inside the session that made them. After a restart
  they will not fire — start the job by hand.
- The scratchpad folder belongs to one session. Anything needed later (a review prompt, an output)
  must be copied into `.claude/plans/` and committed.
- Workflow completion messages cut long results short. Read the full result from the workflow's
  `journal.jsonl`.

## Checks and tests

- Run `scripts/audit-model-ids.sh` **before** committing any record or note: a dated model name
  anywhere outside the roster file fails it (this has happened once already).
- The tests need bats 1.5.0 or newer. GitHub's `ubuntu-latest` (24.04) has 1.10.0 and is fine;
  Ubuntu 22.04 has 1.2.1 and is too old.
- Test the hook under both `/bin/bash` (3.2 on the owner's Mac) and a modern bash (5.x); they have
  behaved differently before.
- In a shell loop, `echo "$(basename "$f") -> $?"` prints basename's exit code, not the previous
  command's. Save `rc=$?` first.
- A fix brief once mistyped the folder as `dev-template`. After fix rounds, run
  `git grep -n "dev-template" -- . ':!.claude/'` and expect nothing.
- `jq empty` accepts empty input, so it cannot on its own reject an empty JSON file.
- A test that only looks for a heading or a loose word can pass while the rule under it says the
  opposite (#47's first four tests did). Test the sentence that carries the meaning, and prove the
  test by editing a throwaway copy of the repository — outside the working clone — so it fails.
- A test that looks for a few key sentences also passes when the rule is weakened by ADDING words
  ("… unless an instruction file explicitly waives one") — #47's second set of tests did. For a
  safety rule, compare the whole step word for word (join wrapped lines first), and check each
  place that acts on a switch on the very line that tells it to act.
- To check an intermediate commit, use `git worktree add --detach <scratch-dir> <commit>`, not an
  export such as `git checkout-index`: the export is not a git repository, so the branch-hygiene
  test fails there for a reason that has nothing to do with the change.
- When each review round finds holes in the previous round's new machinery (#47: a trusted-base
  method, then a sealed git-object snapshot), stop adding mechanism. Simplify (#47 ended with plain
  copies in a folder outside the project) and state plainly what the rule cannot do: rules written
  for agents are not an enforcement boundary; only hooks enforce, and only what they cover.
- Pin a safety rule as ONE whole block, and every place that acts on a switch as a whole passage.
  A test that searches for a phrase inside a passage still passes when a sentence is appended to it.
- Codex's read-only sandbox could not start bats (its temporary folder was not writable). Ask it to
  set `TMPDIR` to a writable folder, or say plainly that the tests were not run there.
- To split one working tree into several topic commits without `git stash`: list the changed
  blocks with `git diff -U0 -- <file>`, stage chosen blocks with `git apply --cached
  --unidiff-zero <patch>`, and stage a hand-made in-between version of a file with
  `git hash-object -w` then `git update-index --cacheinfo 100644,<blob>,<path>`.

## The owner's machine

- A Mac. `bats`, `check-jsonschema`, `shellcheck` and `jq` are installed (the first two with
  Homebrew). Claude Code and Codex are the only AI command-line tools installed.
- Device-wide rules live in `~/.claude/CLAUDE.md` (Claude Code) and `~/.codex/AGENTS.md` (Codex).
  Suggested wording is kept in `.claude/device-wide-rules.md`.

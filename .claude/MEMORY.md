# Lessons and traps — dev-team-plugin

<!--
  File:     .claude/MEMORY.md
  Purpose:  Things learned the hard way while working on this repository, kept in the repository so
            they survive a new session, a new machine or a different assistant. Add to it when a
            lesson is learned; do not remove entries that still hold.
  Updated:  23 September 2026 (gathered from the handover history of 13–14 September).
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

## The owner's machine

- A Mac. `bats`, `check-jsonschema`, `shellcheck` and `jq` are installed (the first two with
  Homebrew). Claude Code and Codex are the only AI command-line tools installed.
- Device-wide rules live in `~/.claude/CLAUDE.md` (Claude Code) and `~/.codex/AGENTS.md` (Codex).
  Suggested wording is kept in `.claude/device-wide-rules.md`.

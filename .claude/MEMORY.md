# Lessons and traps — dev-team-plugin

<!--
  File:     .claude/MEMORY.md
  Purpose:  Things learned the hard way while working on this repository, kept in the repository so
            they survive a new session, a new machine or a different assistant. Add to it when a
            lesson is learned; do not remove entries that still hold.
  Updated:  4 October 2026 (lessons from #47's fifth round added — hook speed under bash 3.2,
            quadratic bash string operations, clock-measuring tests, copies without .git, no
            "exactly" about a guard, keep unpushed work out of /tmp; three from the fourth round —
            hook registration, reading commands like the shell, re-pinning; the rest gathered from
            the handover history and earlier rounds).
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
- Do not try to infer from git state whose code a checkout is: six review rounds of #47 found a
  new misclassification each time. Trust the checkout the user starts on, say so as a limit, and
  treat only what a skill fetched itself as someone else's.
- Pinning a whole passage still misses text added NEXT to it. Pin whole sections (heading to next
  heading), or a passage together with the opening words of what follows it.
- Pin a safety rule as ONE whole block, and every place that acts on a switch as a whole passage.
  A test that searches for a phrase inside a passage still passes when a sentence is appended to it.
- Codex's read-only sandbox could not start bats (its temporary folder was not writable). Ask it to
  set `TMPDIR` to a writable folder, or say plainly that the tests were not run there.
- A hook's behaviour tests run the script directly, so they cannot notice the hook being removed
  from, or narrowed in, `hooks/hooks.json`. Check the registration separately:
  `tests/smoke-structure.sh` now checks that each tool reaches the right guard by its exact path
  (#47, Codex's finding 5 — removing the Bash registration used to leave the whole suite green).
- A guard that reads a command's text must read it the way the shell does. The old Bash guard
  understood double quotes only, so `git push origin 'main'`, `\main` and `'git' push` all passed;
  and a command that names no target (a bare `git push`) can only be judged from the
  repository's own settings, never from the text. Say plainly what it still cannot see.
- A hook that is too slow is not there: Claude Code stops waiting and runs the command anyway. Time
  a hook on long input with the Mac's own `/bin/bash` 3.2 and awk, not only Homebrew's bash: awk's
  `substr()` over a whole text, and building a string by adding to its end, grow with the SQUARE of
  the length there, and bash 3.2 saves a copy of a function's arguments on every function call made
  from inside it (#47's fifth round: 21 seconds for a 10,000-line heredoc, 13 for a 5,000-file
  `git add`). Give such a hook a time limit that REFUSES, and stop the whole process group, not
  just the worker, or a slow child keeps the hook's output open.
- bash's own prefix and suffix removal (`${w%sh}`, `${w#+}`, `${w#*:}`) also grows with the square
  of the word's length, in bash 3.2 and 5 (20 seconds on a 129 KB word); use a `case` pattern to
  test a word's start or end. The first build of #47's fifth round used `${word%sh}`, and its
  "load" test failures were really this.
- A test that measures the clock fails on a busy machine (this Mac is often loaded to 300 or more
  by other work), and a real slowness looks the same. Judge processor time instead, and SKIP —
  never pass — a run the hook stopped at its time limit (#47's speed tests, `guard_cpu`).
- Linux refuses a single program argument longer than 128 KB ("Argument list too long"); macOS
  allows more, so a test can pass on the Mac and fail on the CI runner. Hand long data to a
  program through a file or a pipe, and run the suite in the Ubuntu container before calling it
  done.
- A copy of the tree made with `git archive` or `tar --exclude=.git` fails
  `branch-hygiene: --no-fetch` (it needs a git repository). Run the full suite in a real clone, or
  `git init` the copy and make one empty commit with `-c user.name=… -c user.email=…` there.
- Never write "exactly" or "lists every" about what a guard covers. It reads ordinary spellings and
  does not run the shell; say that, and name the kinds of thing it cannot see.
- Work kept only in a clone under `/tmp` (or `/private/tmp`) is lost when the machine restarts:
  #47's fifth round was built twice for that reason. Keep the record of every edit (scripts, not
  just a summary) somewhere that survives, so a rebuild can replay it.
- To re-pin a passage you changed on purpose, rewrap its new text at 100 columns and review the
  fixture with `git diff --word-diff=porcelain`, so only the intended words show as changed.
- To split one working tree into several topic commits without `git stash`: list the changed
  blocks with `git diff -U0 -- <file>`, stage chosen blocks with `git apply --cached
  --unidiff-zero <patch>`, and stage a hand-made in-between version of a file with
  `git hash-object -w` then `git update-index --cacheinfo 100644,<blob>,<path>`.
- From #47's sixth round (Codex's catch-up review): bash ends a `$'…'` string at a zero byte
  (`\0`, `\x00`, `\c@`, `\400`) but the word goes on after the closing quote; a remote with
  `remote.<name>.mirror = true` pushes every branch when no branch is named; a hook's time limit
  has to cover everything it does once active, reading its input and `jq` included; and stopping
  what a hook started needs SIGTERM, a short grace, then SIGKILL to the whole process group — a
  child that ignores SIGTERM and holds the hook's output otherwise keeps the caller waiting
  (a `grep` in the hook inherits that output).
- A test that claims a long command "is read to the end" needs a late case that only the full
  reading can catch (`ma"i"n`, or a bare push that has to be worked out): a case the check on the
  text as written also catches stays green when the reading stops early.
- A rule that joins a command's words must not carry state from one simple command into the next
  (`git status; echo 'push' 'main'` was refused that way).
- Check a builder's or reviewer's statement of review history against the records before writing
  it into the notes: in #47 the catch-up prompt said Codex had reviewed none of
  `748e87c..2f91439`, while the lead's own records show Codex reviewed `748e87c..42bd45e`.
- When a background loop of your own goes wrong, stop it by its process id. In zsh an unquoted
  `$var` is not split into words, so a `for p in $list` loop written for bash can spin forever.

## The owner's machine

- A Mac. `bats`, `check-jsonschema`, `shellcheck` and `jq` are installed (the first two with
  Homebrew). Claude Code and Codex are the only AI command-line tools installed.
- Device-wide rules live in `~/.claude/CLAUDE.md` (Claude Code) and `~/.codex/AGENTS.md` (Codex).
  Suggested wording is kept in `.claude/device-wide-rules.md`.

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

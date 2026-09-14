<!--
  File:    .claude/plans/ledger-file-clashes/codex-review-3-verification.md
  Purpose: Verification of Codex review round 3 (codex-review-3.md) against the actual files, 14 September 2026. Three independent Opus
           verifiers (workflow wf_3351eee1-ec9), read-only, reproduced findings in throwaway repositories where possible, marked whether
           each problem was introduced by this branch, and wrote precise fix specifications used by fix round 3.
-->

# Verification of Codex review round 3

| # | Verdict | Introduced by branch | Severity (after checking) |
| --- | --- | --- | --- |
| 1 | confirmed | yes | high |
| 2 | confirmed | yes | high |
| 3 | confirmed | yes | high |
| 4 | confirmed | yes | medium |
| 5 | confirmed | yes | high |
| 6 | partly-confirmed | yes | low |
| 7 | confirmed | yes | medium |
| 8 | confirmed | yes | medium |
| 9 | confirmed | partly | medium |
| 10 | confirmed | yes | low |
| 11 | confirmed | partly | medium |
| 12 | confirmed | yes | medium |
| 13 | confirmed | yes | low |
| 14 | confirmed | partly | low |

## Finding 1 — confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** high

**Evidence:**

commands/dev-team-move-ledgers.md does not exist on main (`git show main:commands/dev-team-move-ledgers.md` -> 'exists on disk, but not in main'), so this came in with the branch. Line 25 says the tests run 'in this order — the first test that matches decides', and the groups are written a, b, d, c (lines 29, 34, 45, 54). Line 45 says (d) is 'Checked before (c)'. It does not say before (b). The shape test for FEATURES.md (line 36) is 'any feature-gap number'. For SECURITY.md (line 37) it is a 'Findings' heading or a row starting `| F-`. The only thing that keeps a file out of (b) is a first level-one heading containing 'Security Policy' (line 43). So a product FEATURES.md titled '# Product features', with FG-001..FG-003 appended, matches (b) on its first FG- line and never reaches the 'three or more record lines' test in (d) (line 47). The same goes for a SECURITY.md whose title is not 'Security Policy' (e.g. '# Security') and that has three `| F-` rows. Question 1 (line 82) then offers choice (a), 'move it ... add the marker'. If the person picks it, steps 5-6 move and stamp the whole product document. That breaks the promise at conventions.md line 105 that mixed files are never touched, and this file's own description (line 2). This is a reading of the instruction text: the command is instructions for the model to follow, not a script, so there is nothing to run. Note: only the second (d) bullet is skipped. The first bullet ('Security Policy' heading) still works, because (b) already excludes those files.

**Notes:**

I chose the option that refuses when unsure: a whole old ledger with no marker may now land in (d). The other obvious option, a 'possible mixed' warning inside question 1, is not available, because that prompt has to be copied word for word from conventions.md point 4. A shape-only test such as 'the title looks like a ledger title' is not safe either: old ledger titles were never fixed (e.g. the documentarian template's title is '# [Project name]').

**Fix specification:**

File: commands/dev-team-move-ledgers.md, section 2.
1. Move the whole '**(d) Mixed — needs a person; nothing will be touched.**' block (current lines 45-52, including its two bullets, the 'Report the line number' paragraph, and the 'Why the command refuses to cut it' and 'Rejected' sub-bullets) so it sits directly after group (a) (after current line 32) and before '**(b) Looks like ours — ask.**'. Keep the letters a/b/c/d as they are, because the report and other files use them.
2. Change the (d) lead-in from 'Checked before (c).' to: 'Checked straight after (a), before (b) and (c), so a file with records appended to it can never be offered for moving.'
3. Rewrite (d)'s first bullet so it does not depend on (b) coming first: 'the file passes the shape test for its name in group (b) below **but** its first level-one heading contains "Security Policy" (for example a public security policy with a `## Findings` register below it), or'.
4. Add a sub-bullet to (d): '*Why (d) comes before (b):* an earlier order checked (b) first. A product `FEATURES.md` with three `FG-` records appended matched (b) on its first record, so it was offered for moving and stamping as a whole, and the mixed test never ran. *What this costs:* an old ledger with no marker and three or more records of its own kind is also sorted (d), because the command cannot tell a whole ledger from a document with records appended. For such a file the report says: "either an old dev-team ledger with no marker (add the marker on line 2 by hand and run this command again) or a project document with dev-team records added to it (cut the dev-team part into `.dev-team/<name>` by hand)". Refusing here is deliberate: a wrong guess moves someone else's document.'
5. In section 5 (Report, line 114), change 'each (d) file with its line number and the words "needs a person to cut it by hand"' to 'each (d) file with its line number and the two-way wording from group (d)'.
6. In line 49, after 'Report the line number and text of the first line...', keep the text but add 'and the two-way wording above'.
Tests to add in tests/scripts.bats (text checks on the instruction file, so a later edit cannot quietly restore the old order):
- @test "move-ledgers: the mixed group (d) is checked before the look-alike group (b)": d=$(grep -n '^\*\*(d) Mixed' commands/dev-team-move-ledgers.md | cut -d: -f1); b=$(grep -n '^\*\*(b) Looks like ours' commands/dev-team-move-ledgers.md | cut -d: -f1); [ -n "$d" ] && [ -n "$b" ] && [ "$d" -lt "$b" ].
- @test "move-ledgers: (d) no longer says only 'Checked before (c)'": run grep -c 'Checked before (c)\.' commands/dev-team-move-ledgers.md; [ "$output" = "0" ].
Run bash scripts/audit-ledger-paths.sh afterwards. The new text must pass it: say 'legacy root' wherever a bare ledger name appears next to 'repo root' wording.

## Finding 2 — confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** high

**Evidence:**

Throwaway repo (mktemp, since removed): I committed a .gitignore containing '/SECURITY.md', then created SECURITY.md with the new marker on line 2. `git status --porcelain` printed nothing, so the clean-tree check (line 19) passes. `git status --porcelain --ignored` printed '!! SECURITY.md'. `git check-ignore -q --no-index .dev-team/SECURITY.md` returned 1 (not ignored), so the ignore check in section 3 (line 66), which only looks at destinations, passes too. `git ls-files --error-unmatch -- SECURITY.md` returned 1 ('did not match any file(s) known to git'). `git mv SECURITY.md .dev-team/SECURITY.md` failed with 'fatal: not under version control', exit 128. By then step 4 has already made .dev-team/, .gitignore and README.md, and any file earlier in the order has already been moved (step 5 loops through the files in order). Line 110 only covers failures 'in step 8 or 9'. For steps 4-7 the text gives no rollback at all, so a half-moved tree is left behind. Also: an untracked file that is NOT ignored shows as '??', so the clean check refuses it. That means only ignored sources reach this failure. The whole file is new on the branch.

**Notes:**

Same root cause, related case: a candidate can be an ignored untracked `.dev-team/<name>` destination. Section 2 already treats any existing `.dev-team/<name>` as a conflict, so that case is covered.

**Fix specification:**

File: commands/dev-team-move-ledgers.md.
1. Section 3, 'Ignore check (before anything else changes)' paragraph (line 66): add a second check to the same step. 'For every legacy root file sorted (a) or (b), run `git ls-files --error-unmatch -- <name>`. If it fails, the file is not tracked by git. The tree was clean, so that can only mean the project ignores it. Show `git check-ignore -v --no-index <name>` in the table, which names the ignore rule, with the warning: "`<name>` is not tracked by git (ignored by the rule shown), so `git mv` cannot move it and the move could not be committed or undone." If `--apply` was requested and any such file exists, refuse in the same way as an ignored destination: report and stop before any question and before touching anything.' Add a sub-bullet: '*Why:* `git status --porcelain` does not list ignored files, so the clean-tree check cannot see this. Without this check, `git mv` failed at step 5, after step 4 had already created files and earlier files had already moved.'
2. Section 1 check 3 (line 19): add one sentence: 'This check cannot see ignored files; section 3 checks those for the files this command would move.'
3. Rename the rollback heading at line 110 from '**If step 8 or 9 fails partway through.**' to '**If any step from 4 to 9 fails, or the standalone commit in step 2 fails.**'. Also replace every reference to 'If step 8 or 9 fails partway through' (lines 68 and 107) with the new heading text. The body of that paragraph is replaced by finding 3's fix. Apply both fixes together.
4. Steps 4, 5, 6 and 7: at the end of each, add 'If this step fails, stop and follow the rollback below.'
Tests to add in tests/scripts.bats:
- @test "move-ledgers: the preflight checks that each source file is tracked": run grep -c 'git ls-files --error-unmatch' commands/dev-team-move-ledgers.md; [ "$output" -ge 1 ].
- @test "move-ledgers: rollback covers steps 4 to 9, not only 8 or 9": run grep -c 'If step 8 or 9 fails' commands/dev-team-move-ledgers.md; [ "$output" = "0" ]; and run grep -c 'If any step from 4 to 9 fails' commands/dev-team-move-ledgers.md; [ "$output" -ge 1 ].
- Optional git behaviour check that proves the reason for the rule (in its own mktemp repo, removed in teardown): commit a .gitignore of '/SECURITY.md', create SECURITY.md, assert `git status --porcelain` output is empty, and assert `git ls-files --error-unmatch -- SECURITY.md` exits non-zero.

## Finding 3 — confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** high

**Evidence:**

Throwaway repo (removed afterwards): I committed FEATURES.md and app.js, and `git status --porcelain` was empty. Then, playing the question phase, I overwrote app.js as another process would and created notes.txt. Then I ran the command's own `git mv FEATURES.md .dev-team/FEATURES.md`. Before the rollback, status showed 'R FEATURES.md -> .dev-team/FEATURES.md', ' M app.js', '?? notes.txt'. After `git reset --hard -q HEAD`, app.js was back to 'app v1', so the other process's edit was destroyed with no way to get it back. notes.txt survived only because it was never tracked. Line 110 claims reset is 'always safe' because the tree was clean when the command began. But section 4 asks questions first (line 76), which can take any amount of time. Step 9 also runs `git commit`, which fires the project's pre-commit hooks, and those can rewrite tracked files. There is no second clean check before step 4. Second experiment, the safe alternative: after git mv plus a marker edit, a staged edit to ap.json, a new staged .dev-team/.gitignore, and a foreign edit to app.js, `git restore --source=$H0 --staged --worktree -- FEATURES.md .dev-team/FEATURES.md ap.json` (exit 0) undid the rename and the ap.json edit, and removed .dev-team/FEATURES.md from disk and from the index. It left ' M app.js' ('foreign edit') untouched. Only 'A .dev-team/.gitignore' was left, and that needs `git rm --cached` plus a file delete. Git 2.55 here; `git restore` exists from git 2.23. File is new on the branch.

**Notes:**

`git restore` needs git 2.23 or newer (2019). If supporting older git matters, use `git checkout "$H0" -- <paths that existed at H0>` plus `git rm -q --cached --ignore-unmatch` and `rm -f` for the rest. I did not run bats for these tests, because they do not exist yet. Of the existing scripts.bats tests, none cover this command.

**Fix specification:**

File: commands/dev-team-move-ledgers.md.
A. Section 1 check 3 (line 19): add 'With `--apply`, record the commit id now: `H0=$(git rev-parse HEAD)`.'
B. New step at the start of the second list in section 4, just before current step 4 and after all questions are answered: '**Check again that nothing changed while the questions were asked.** Run `git status --porcelain --untracked-files=all` and `git rev-parse HEAD`. If the status prints anything, or HEAD is no longer H0, stop. Nothing has been changed yet. Report: "The working tree changed while the questions were being asked (list the paths). Nothing was moved. Commit or stash those changes and run the command again." *Why:* the first clean check can be minutes old by now, and an editor, formatter or another session may have changed files since.'
C. Add a paragraph before step 4 titled '**Keep a list of every path this command touches.**' From step 4 onward, record for each path: its kind, and the blob id of what this command last wrote there (`git hash-object -- <path>`, taken right after that write). The kinds are: `created` (a file that did not exist before: `.dev-team/.gitignore`, `.dev-team/README.md`, `.dev-team/config.yml` if absent, plus whether `.dev-team/` itself was created); `moved` (the old name and the `.dev-team/<name>` it moved to); `edited` (a file tracked at H0 that this command changed: `.dev-team/autopilot.json`, a tracked `.dev-template/config.yml`, each instruction file given the pointer sentence). A moved file's blob id is taken after step 6 stamps it.
D. Replace the whole body of the rollback paragraph (line 110, renamed as in finding 2) with these steps, in order:
 1. If `git rev-parse HEAD` is not H0, do not undo anything. Report the manual-recovery text in step 6.
 2. Run `git status --porcelain --untracked-files=all`. Every path it lists, including both sides of a rename, must be on the list from C. If any path is not on the list, do not undo anything. Report the manual-recovery text and name the unexpected paths.
 3. For each listed path that still exists and has a recorded blob id, `git hash-object -- <path>` must match that id. If one does not match, something else changed it after this command did: do not undo anything, report the manual-recovery text, and name the path. A path whose own write failed partway has no id and is undone without this check; the report names it.
 4. Undo, touching only listed paths: `git restore --source="$H0" --staged --worktree -- <each moved old name> <each moved .dev-team/<name>> <each edited path>`. Then for each `created` path: `git rm -q --cached --ignore-unmatch -- <path>` and `rm -f -- <path>`. Then, only if this run created `.dev-team/`, `rmdir .dev-team 2>/dev/null` (this removes the folder only if it is empty).
 5. Run `git status --porcelain --untracked-files=all` again. It must print nothing. If it does, report the leftover paths and the manual-recovery text.
 6. Manual-recovery text: "I did not undo anything, because something other than this command changed the repo while it ran, and undoing would destroy that work. Your changes are still in the working tree. To undo this command's part by hand, check `git status` first, then run `git restore --source=<H0> --staged --worktree -- <listed moved and edited paths>` and delete <listed created paths>."
 Keep the existing sentences about the pointer-sentence decline being discarded and asked again, and about never using `git add -f` and never committing a half-done move. Add a sub-bullet: '*Rejected — `git reset --hard HEAD`:* an earlier version used it, reasoning that the tree was clean when the command began. But questions and commit hooks run after that check, so reset could silently destroy edits another program made in between. Never use `git reset --hard` or `git clean` here.'
E. Step 2's standalone commit (lines 87-88) must use the same list and the same rollback: the check from B before writing, and steps D1-D6 if `git add` or `git commit` fails.
Tests in tests/scripts.bats:
- @test "move-ledgers: rollback never uses git reset --hard except to explain why not": run bash -c "grep -n 'reset --hard' commands/dev-team-move-ledgers.md | grep -v -i 'rejected'"; [ -z "$output" ].
- @test "move-ledgers: working tree is checked again after the questions": run grep -c 'changed while the questions were being asked' commands/dev-team-move-ledgers.md; [ "$output" -ge 1 ].
- @test "move-ledgers: the documented restore leaves other programs' edits alone" (checks that the git commands in D4 behave as described; mktemp repo, removed in teardown): commit FEATURES.md, app.js and ap.json; H0=$(git rev-parse HEAD); echo foreign > app.js; mkdir .dev-team; git mv FEATURES.md .dev-team/FEATURES.md; echo '{}' > ap.json; git add ap.json; printf 'loop.lock/\n' > .dev-team/.gitignore; git add .dev-team/.gitignore; then run exactly the D4 commands. Assert: [ "$(cat app.js)" = foreign ]; [ -f FEATURES.md ]; [ ! -e .dev-team ]; [ "$(git status --porcelain --untracked-files=all)" = " M app.js" ].

## Finding 4 — confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** medium

**Evidence:**

Throwaway repo (removed afterwards) with .gitignore '.dev-team/config.yml' and '.claude/'. Writing .dev-team/config.yml and then `git add .dev-team/config.yml` gave 'The following paths are ignored by one of your .gitignore files', exit 1. The file stayed on disk, and `git status --porcelain` stayed empty, so the leftover file cannot even be seen. `git add b .dev-template/config.yml` (one normal path plus one ignored path) exited 1 but still staged b ('A  b'). So a failed `git add` in step 9 can leave a partial index, which is one more reason the rollback must cover it. A config.yml that is already tracked but matches an ignore pattern: `git check-ignore -q --no-index` reports it as ignored (rc 0), yet `git add` works (rc 0). So a plain --no-index check on a tracked file would refuse for no reason. An ignored untracked .claude/CLAUDE.md: `git add .claude/CLAUDE.md` failed with exit 1 ('.claude' ignored). Keeping `.claude/` ignored is common, and line 90 lists `.claude/CLAUDE.md` as a pointer-sentence target, so the accept path (line 87) has the same fault. In the file: line 66 checks README.md, .gitignore, autopilot.json and the `.dev-team/<name>` files, but not config.yml or the instruction files. Step 8's second check (line 107) leaves them out too. Line 88 (decline path, nothing to move) writes and stages config.yml with no rollback, and the rollback at line 110 is scoped to 'step 8 or 9'. Wider than Codex said: the move path's step 9 also writes config.yml and instruction files that no ignore check ever covered, although there the rollback at least applies. File is new on the branch.

**Notes:**

Related but separate: step 4 can create `.dev-team/` files. In the step-2 path (nothing moves) that step is never reached, so there is no extra risk there. Apply findings 2, 3 and 4 in one change, because all three edit the same rollback paragraph and the same ignore-check paragraph.

**Fix specification:**

File: commands/dev-team-move-ledgers.md.
1. Section 3, ignore check (line 66): widen the list of paths. 'Also check `.dev-team/config.yml` whenever question 3 could be asked (its trigger in section 4 step 3 holds), because a decline writes it, and each of `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md`, `GEMINI.md` that exists and lacks the pointer sentence, because an accept edits it.' Add the rule for tracked files: 'Skip any path that `git ls-files --error-unmatch -- <path>` shows is already tracked. Git adds changes to a tracked file even when it matches an ignore pattern, so refusing there would be wrong.' A config.yml or instruction file that is untracked and ignored is reported with the conventions point 7 warning. With `--apply`, stop before any question, just like the other ignored paths. The same skip for tracked files applies to the paths already listed (autopilot.json, README.md, .gitignore).
2. The check must also run when nothing will move. State at the end of section 3: 'This check runs even when no file will move, because step 2 in section 4 can still write `.dev-team/config.yml` or an instruction file.' Reorder line 64 if needed. Its 'If no legacy root file ... exists, say so plainly and stop' comes before the check, and that stop is still right, because step 2 is only reached when legacy files exist. Make sure the wording does not skip the check when every file is (c)/(d)/conflict.
3. Section 4 step 8 (line 107), second check: add `.dev-team/config.yml` (if step 9 will write or create it) and each instruction file question 3 was accepted for, again skipping tracked paths. Because step 9 writes config.yml after step 8, move the config.yml and instruction-file part of this recheck to the start of step 9, immediately before those writes.
4. Section 4 step 2 (lines 87-88): add 'Before writing, run the working-tree recheck from finding 3 (B). If `git add` or `git commit` fails, follow the rollback paragraph (which now covers this standalone commit), then report.' Together with finding 3 (D/E), this undoes: a config.yml this run created (git rm --cached --ignore-unmatch, then rm -f), a config.yml that was tracked at H0 (git restore --source=H0 --staged --worktree), and any instruction file edited.
5. Line 66's opening sentence 'Ignore check (before anything else changes)' stays. Add a sub-bullet: '*Why config.yml and the instruction files are on the list:* an earlier version left them out, so a declined pointer sentence could create an ignored `.dev-team/config.yml` that `git add` then refused, leaving an uncommitted file nobody could see in `git status`, with no rollback.'
Tests in tests/scripts.bats:
- @test "move-ledgers: ignore check names config.yml": run bash -c "grep -n 'check-ignore' commands/dev-team-move-ledgers.md | grep -c 'config.yml'"; [ "$output" -ge 1 ].
- @test "move-ledgers: ignore check skips already-tracked paths": run grep -c 'already tracked' commands/dev-team-move-ledgers.md; [ "$output" -ge 1 ].
- Git behaviour check (mktemp repo, removed in teardown) proving the two facts the rule depends on: with .gitignore '.dev-team/config.yml', an untracked config gives `git check-ignore -q --no-index .dev-team/config.yml` status 0 and `git add .dev-team/config.yml` status non-zero; after `git add -f` and a commit, `git add .dev-team/config.yml` on a modified copy returns 0.

## Finding 5 — confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** high

**Evidence:**

The hook is new on this branch: `git show main:hooks/guard-ledgers.sh` fails, so it does not exist on main. The hook takes the payload's `cwd` as the project's top folder (line 167). It reads config and lock relative to that (lines 171-175 and 342). It strips only `<cwd>/` from an absolute path (lines 189-193), and any path still absolute after that strip counts as having left the project (lines 255-257). I reproduced this in a throwaway git repo (created with mktemp, removed afterwards) with cwd set to <repo>/src. (a) With DEV_TEAM_GUARD=1, an Edit adding F-001 to the absolute <repo>/SECURITY.md exits 0. The same payload with cwd=<repo> exits 2. (b) The same Edit with file_path `../SECURITY.md` exits 0. (c) With <repo>/.dev-team/loop.lock/ present and no environment variable set, the Edit exits 0, so the lock at the top folder is never seen. The fault also works in the other direction and wrongly refuses good writes: (d) `guard: off` in <repo>/.dev-team/config.yml is ignored, and a marker Write to <repo>/SECURITY.md is still refused with exit 2. (e) The plugin's own correct Write of marker content to the absolute <repo>/.dev-team/SECURITY.md is REFUSED with exit 2, because the path counts as outside the project and Rule 1 then judges it by file name alone. A plain relative `SECURITY.md` from cwd=src (really src/SECURITY.md) would also be treated as the top-level file. The hook's header comment (lines 150-151) already admits it trusts cwd, but nothing in the rule or the tests limits the damage. Measurements on this Mac: `git -C <subdir> rev-parse --show-toplevel` returns the physical path (/private/var/...) even when cwd is the logical /var/... path, so using --show-toplevel as a text prefix would break the prefix strip on macOS temp folders and on any folder reached through a link. `git rev-parse --show-prefix` returns `src/deep/` and does not have that problem. Outside git it exits 128. Ten calls took 0.073s in total, about 7ms each, which is acceptable for a hook.

**Notes:**

This is worse than Codex described. As well as missing the harmful write, it wrongly refuses the plugin's own correct .dev-team writes and ignores guard: off whenever the session starts in a subfolder. I did not run bats: finding 11 says its cleanup can delete repository files, so I reasoned from the test source instead. .claude/agents does not currently exist, but I still did not run it.

**Fix specification:**

FILE hooks/guard-ledgers.sh.

1) Directly after line 167 (`cwd=...`), add a block that works out the project's top folder, using git's view of where cwd sits inside the repository. Use --show-prefix, NOT --show-toplevel: --show-toplevel returns the physical path (on macOS /private/var/... when the session is in /var/...), which would no longer match the text of file_path. Code:
```
base="${cwd:-$PWD}"
root="$base"
sub=""
if command -v git >/dev/null 2>&1; then
  prefix="$(git -C "$base" rev-parse --show-prefix 2>/dev/null)" || prefix=""
  prefix="${prefix%/}"
  if [ -n "$prefix" ]; then
    case "$base" in
      */"$prefix") root="${base%/"$prefix"}"; sub="$prefix" ;;
    esac
  fi
fi
```
It fails open. With no git, not a repository, a missing folder, or cwd not ending in the prefix text (for example a linked subfolder), root stays as cwd, which is exactly today's behaviour. Comment it in plain English: why the prefix is used instead of the top-level path (the physical-path problem), that outside git the hook falls back to cwd, and that a nested submodule counts as its own project.

2) Replace rel() with `rel() { printf '%s/%s' "$root" "$1"; }`, so config.yml and loop.lock/ are always read from the top folder.

3) Replace the strip block at lines 189-193 with:
```
case "$file_path" in
  "$root"/*) root_rel="${file_path#"$root"/}" ;;
  /*) root_rel="$file_path" ;;
  *) root_rel="${sub:+$sub/}$file_path" ;;
esac
norm_path="$file_path"
```
The first case also covers `<cwd>/...` because root is a prefix of cwd. Keep $norm_path for the refusal messages, so they quote what the caller typed. Call `resolve_lexical "$root_rel"` instead of "$norm_path", and change the absolute-path check at lines 255-257 to test "$root_rel". Leave all other logic alone.

4) Update the header comments. Lines 119-135 ('Path handling'): paths are now judged against the repository's top folder found through git, falling back to cwd. Lines 150-151 ('CANNOT do'): replace that bullet with the remaining limits: outside git, or when cwd is reached through a link so its text does not end in git's prefix, the hook still trusts cwd as the top folder. Add a fault note to the numbered list at lines 55-117 recording the subfolder bypass and the wrong refusal of .dev-team writes.

5) FILE tests/scripts.bats. Add a block after the test at line 429. Each test runs `git init -q "$SCRATCH"`, then `s="$(cd "$SCRATCH" && pwd)"; mkdir -p "$s/src"`, and passes `"cwd":"'"$s"'/src"` in the payload (run_ledger_guard "$s/src"):
  T1 'a session started in a subfolder still sees the top-level lock and protects the top-level SECURITY.md (absolute path)': mkdir -p $s/.dev-team/loop.lock; Edit file_path "$s/SECURITY.md" new_string "F-001 fixed" -> status 2 and output contains "dev-team guard".
  T2 same setup, file_path "../SECURITY.md" -> status 2.
  T3 'the plugin's own absolute .dev-team write from a subfolder is allowed': no lock; Write file_path "$s/.dev-team/SECURITY.md" content "# x\n<!-- dev-team: ledger=security schema=1.0 -->\n" -> status 0.
  T4 relative "../.dev-team/FEATURES.md" with the features marker -> status 0.
  T5 'guard: off at the top level is honoured from a subfolder': printf 'guard: off\n' > $s/.dev-team/config.yml; Write "../SECURITY.md" with marker -> status 0.
  T6 'a relative ledger name from a subfolder is not the top-level file': lock present; Edit file_path "SECURITY.md" (really src/SECURITY.md) new_string "F-001" -> status 0.
  T7 'outside git the hook falls back to cwd as the top folder': NO git init; mkdir -p $s/.dev-team/loop.lock $s/src; Edit "$s/SECURITY.md" F-001 with cwd $s/src -> status 0. This documents the stated limit.

6) FILE tests/README.md. In the guard-ledgers 'Path normalisation' bullet, add a paragraph describing T1-T7, the fault, and the git --show-prefix fallback.

Run shellcheck, bash tests/smoke-structure.sh, scripts/audit-ledger-paths.sh and bats (once finding 11's cleanup is fixed).

## Finding 6 — partly-confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** low

**Evidence:**

The mechanism is real. In a throwaway repo I linked .dev-team/SECURITY.md to ../SECURITY.md (the top-level file). A Write of marker content plus F-001 to `.dev-team/SECURITY.md` exits 0 with DEV_TEAM_GUARD=1. The hook compares path text only (lines 203-240 and 306-311), and its header (lines 123-125) says so on purpose. What I could NOT verify: whether Claude Code's Write, Edit and MultiEdit follow a link and change the file it points to, or replace the link with an ordinary file (write to a temporary file, then rename). There is no way to test the real tool from here, so the harm depends on behaviour nobody has checked. The attack also needs someone to have put a link inside .dev-team/ that points back out, and the plugin never creates links. That takes a deliberate act or a very unusual project layout, not the stale-instruction mistake this hook exists to catch. The hook already calls itself 'best-effort, NEVER the safety guarantee'. Physically resolving the path in bash 3.2 is practical: `cd -P "$dir" && pwd -P` worked under /bin/bash 3.2.57, and readlink gives the link target. The catch is that /private/var versus /var also changes the text of the top folder, so it would need the same care as finding 5. A simpler 'refuse whenever .dev-team or the target is a link' check would permanently block every ledger Write in any project that links its .dev-team folder somewhere else on purpose. That is a worse failure than the one it prevents, and it goes against the rule that a person's normal work must not be blocked. On balance this is not worth code now. Record it as a stated limit.

**Notes:**

The harm is not verified: it depends on Claude Code following links, which I could not test. It needs a link someone planted on purpose, and the hook already says it is best-effort. Low severity, documented limit.

**Fix specification:**

Record it as a stated limit; make no code change now.

FILE hooks/guard-ledgers.sh, 'What this hook CANNOT do' list (lines 146-154). Add this bullet in plain English: "- It does not follow symbolic links. It judges a path by its text alone. If .dev-team/ itself, or a file inside it, is a link pointing back out to a project file (for example .dev-team/SECURITY.md linking to ../SECURITY.md), both rules see a .dev-team/ path and allow the write. Whether that write then lands on the linked project file depends on how Claude Code's Write and Edit treat links, which was not checked. This plugin never creates links, so this needs someone to have made one on purpose. Resolving links physically was considered and not done. A rule that refuses any linked .dev-team/ would block every ledger write in a project that links its .dev-team/ folder elsewhere on purpose. A full physical resolution has to cope with macOS reporting /private/var for /var, which the text comparison here cannot match."

In the 'Path handling' paragraph (around line 123), after 'it does not touch the real filesystem', add: "(so a symbolic link is never followed — see 'What this hook CANNOT do')".

FILE tests/README.md, guard-ledgers 'Path normalisation' bullet: add one sentence saying links are deliberately not followed and pointing to the hook's limits list.

Add one bats test that pins the documented limit, so a future change to it is deliberate. Test name: "guard-ledgers: a symlinked .dev-team/SECURITY.md is judged by its text path (documented limit)". Steps: mkdir -p "$SCRATCH/.dev-team"; echo own > "$SCRATCH/SECURITY.md"; ln -s ../SECURITY.md "$SCRATCH/.dev-team/SECURITY.md"; run run_ledger_guard "$SCRATCH" with a Write to ".dev-team/SECURITY.md" whose content is "# x\n<!-- dev-team: ledger=security schema=1.0 -->\n". Assert [ "$status" -eq 0 ]. Above the test, add a comment saying it records a known limit, not desired protection.

If the owner later wants protection, the follow-up is: after finding 5's fix, when [ -L "$root/.dev-team" ] or [ -L "$root/$resolved" ], compare the physical parent (`cd -P` + `pwd -P`) of the target with the physical top folder (`cd -P "$root" && pwd -P`), and treat the target as top-level if they are equal. That is a separate change.

## Finding 7 — confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** medium

**Evidence:**

conventions.md line 45 says the legacy marker `<!-- dev-team-schema: 1.0 -->` 'is still read as schema=1.0 and as proof of ownership'. Line 77 says the same ('accepted as proof of ownership when reading'), and documentarian-protocol.md line 7 agrees. commands/dev-team-move-ledgers.md line 30 counts `<!-- dev-team-schema:` in the first three lines as ownership proof. The hook's marker_pattern (line 275) is only `<!-- dev-team: ledger=|"dev-team"[[:space:]]*:[[:space:]]*"ledger=`, and the hook is new on this branch (not on main). Reproduced in a throwaway repo: a Write to top-level SECURITY.md with content "# S\n<!-- dev-template-schema: 1.0 -->\n" exits 0 with no run active (Rule 1 misses it). With DEV_TEAM_GUARD=1 it also exits 0 (Rule 2 misses it too, when there is no record id). Adding the legacy form causes no wrong refusals. The plugin never legitimately Writes legacy-marked content to the top level: conventions point 4(a) and point 5 move a legacy file with `git mv` (a Bash command this hook does not see) and then write the new marker inside .dev-team/, and read-only commands do not write. One trap: scripts/audit-ledger-paths.sh check F (lines 175-180) scans hooks/ and fails any line containing `<!-- dev-team-schema:` unless the same line contains the word 'legacy' (not case-sensitive). The new pattern line and every comment line quoting the marker must therefore contain 'legacy'.

**Notes:**

Confirmed by a real command for both rules. Codex only described the Rule 1 gap; Rule 2 misses a legacy marker with no record id as well. The fix must keep the word 'legacy' on the line holding the old marker text, or the branch's own audit check F fails.

**Fix specification:**

FILE hooks/guard-ledgers.sh.

1) Replace line 275 with two lines. Keep the word 'legacy' on the line that holds the old marker text, because audit check F otherwise fails:
```
legacy_marker='<!-- dev-team-schema:'   # legacy (pre-v1.5.0) ownership marker, still accepted — conventions.md point 3
marker_pattern="<!-- dev-team: ledger=|$legacy_marker|\"dev-team\"[[:space:]]*:[[:space:]]*\"ledger="
```
(or keep single quotes and write the legacy text inline, on a line that contains the word legacy). This applies to both rules, which is what we want. Rule 2 should also treat a legacy marker written to a top-level ledger during a run as plugin output.

2) Update the comment above it (lines 264-274) and the header's Rule 1 description (lines 15-17), in plain English: the legacy marker is accepted as proof of ownership (conventions.md), so a Write carrying it to a top-level ledger name is refused the same way. The plugin moves legacy files with git mv and only then writes the new marker inside .dev-team/, so no legitimate plugin write is refused. Every comment line that quotes the text `<!-- dev-team-schema:` must also contain the word 'legacy', or audit check F fails. Add a fault note to the numbered list at lines 55-117.

FILE tests/scripts.bats. Add after the Rule 1 README tests (around line 390):
  T1 "guard-ledgers: the legacy marker on a top-level SECURITY.md Write is denied": run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"SECURITY.md","content":"# S\n<!-- dev-team-schema: 1.0 -->\nline3"}}' -> [ "$status" -eq 2 ] and [[ "$output" == *"dev-team guard"* ]].
  T2 "guard-ledgers: the same legacy-marker content is allowed at .dev-team/SECURITY.md" -> status 0.
  T3 "guard-ledgers: the legacy marker on line 10 only is allowed" (file_path FEATURES.md, marker on line 10) -> status 0.
  T4 (Rule 2) "guard-ledgers: an Edit adding the legacy marker to top-level FEATURES.md mid-cycle is denied": mkdir -p "$SCRATCH/.dev-team/loop.lock"; Edit new_string "<!-- dev-team-schema: 1.0 -->" -> status 2.
tests/ is outside the audit's scope, so these lines do not need the word 'legacy'.

FILE tests/README.md, guard-ledgers Rule 1 bullet: add a sentence listing T1-T3, and a note on T4 in the Rule 2 bullet. Any line there quoting the old marker should also say 'legacy', to match the file's existing style at lines 54 and 69.

Afterwards run scripts/audit-ledger-paths.sh; it must still print LEDGER-PATHS OK. Also run shellcheck on the hook and bats.

## Finding 8 — confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** medium

**Evidence:**

conventions.md:81 (point 4) says the three-case rule, with the marker on line 2, applies to 'any file in the Shared artifacts table'. That table (conventions.md:17-27) lists .dev-team/autopilot.json, .dev-team/.gitignore and GitHub/GitLab Issues. Point 3 (line 76) says autopilot.json 'gains nothing new', and point 7 (line 111) says .gitignore holds 'exactly one line'. Read literally, the rule's third case ('file present, no marker -> write nothing, stop and ask') would stop autopilot from writing its own state file every cycle, because autopilot.json's "schema" field is neither accepted marker form. The canonical sentence at line 52 ('Every file the dev-team suite writes for itself lives in .dev-team/ and carries the dev-team marker on line 2') is equally too broad: config.yml, loop.lock/, .gitignore and autopilot.json carry no marker. That sentence is copied word for word into 7 files (grep -rlF): agents/sonnet-scribe.md, commands/dev-team-move-ledgers.md, skills/dev-team-orchestrator/SKILL.md, conventions.md, documentarian-protocol.md, verdict-and-report-protocol.md, threat-model-and-surface-protocol.md. README.md:512 repeats 'Before writing anywhere in the Shared artifacts table'. The 'Where the plugin writes, and the ownership rule' section does not exist on main (git show main:conventions.md has no such heading), so the branch introduced this. I rate it medium, not high: a careful reader can reconcile it with points 3 and 7, but an agent following point 4 literally could block autopilot, put an HTML comment into JSON, or add a line to .gitignore.

**Notes:**

A smaller related inconsistency that is not fixed above: point 7 and the table say .dev-team/README.md is 'never overwritten', but point 4's second case says a marked file 'is ours; write it'. The builder may add 'For `.dev-team/README.md`, a marked file that already exists is left as it is (point 7)' to the second case; it does not change any behaviour.

**Fix specification:**

1. skills/dev-team-orchestrator/references/conventions.md, point 4 (line 81): replace 'Before creating, overwriting or appending to any file in the Shared artifacts table, the writer reads the target path first.' with 'Before creating, overwriting or appending to one of the plugin's record files — the six markdown ledgers (`.dev-team/PROJECT.md`, `.dev-team/FEATURES.md`, `.dev-team/SECURITY.md`, `.dev-team/VERIFICATION.md`, `.dev-team/MIGRATION.md`, `.dev-team/HANDOFF.md`), `.dev-team/verdict.json`, or `.dev-team/README.md` — the writer reads the target path first.' Directly after the three cases, add this bullet: '- **Files this rule does not cover, and why.** `.dev-team/autopilot.json` keeps its own `"schema"` field and only the autopilot conductor writes it (point 3). `.dev-team/config.yml` is written only by `/dev-team-config init` or when a declined pointer sentence is recorded (point 8). `.dev-team/loop.lock/` is a folder that exists only while a cycle runs (`dev-team-autopilot/references/loop-runtime.md`). `.dev-team/.gitignore` holds exactly one line and is created once (point 7). None of these can carry a line-2 marker. JSON has no comment syntax, and a second line would break the one-line `.gitignore`, so applying the marker cases to them would corrupt them or stop the run for no reason. GitHub/GitLab issues are not files at all. *Earlier wording:* this rule used to say "any file in the Shared artifacts table", which read literally included all of these.'
2. Same file, line 52, the canonical sentence. Change it to: 'Every record file the dev-team suite writes for itself lives in `.dev-team/` and carries the dev-team marker on line 2 (`verdict.json` carries it as a field); a record file at that path without the marker is never written to — the run stops and asks. See `dev-team-orchestrator/references/conventions.md`, "Where the plugin writes, and the ownership rule".' Then replace the old sentence byte for byte with the new one in the other six files: agents/sonnet-scribe.md, commands/dev-team-move-ledgers.md, skills/dev-team-orchestrator/SKILL.md, skills/dev-team-orchestrator/references/documentarian-protocol.md, skills/dev-team-review/references/verdict-and-report-protocol.md, skills/dev-team-security/references/threat-model-and-surface-protocol.md. Afterwards, `grep -rlF` for the OLD sentence (excluding .git and .claude) must return nothing, and grep for the NEW sentence must return exactly those 7 files.
3. README.md:512: replace 'Before writing anywhere in the Shared artifacts table, a skill reads the target first' with 'Before writing one of its record files (the six markdown ledgers, `verdict.json`, or `.dev-team/README.md`), a skill reads the target first'.
4. Test, in tests/scripts.bats: add @test "conventions: the canonical ownership sentence is identical in every file that quotes it". Set S to the new sentence. Assert that `grep -rlF "$S" "$REPO_ROOT/agents" "$REPO_ROOT/commands" "$REPO_ROOT/skills" | wc -l` equals 7. Assert that `grep -rF 'Every file the dev-team suite writes for itself' "$REPO_ROOT/agents" "$REPO_ROOT/commands" "$REPO_ROOT/skills" "$REPO_ROOT/README.md"` exits 1 (no match). Add a second assertion that `grep -F 'any file in the Shared artifacts table' "$REPO_ROOT/skills/dev-team-orchestrator/references/conventions.md"` exits 1. This test only reads files.

## Finding 9 — confirmed

- **Introduced by this branch:** partly
- **Severity after checking:** medium

**Evidence:**

`bash scripts/audit-ledger-paths.sh` prints 'LEDGER-PATHS OK' (exit 0). On the branch, these README.md lines still name a bare ledger as a live read, write or resume location: 120 (orchestrator 'Cold-resumes from a prior run's `PROJECT.md`'), 164 (security 'Cold-resumes from a current `SECURITY.md`'), 170 (review 'reading `PROJECT.md` (and `SECURITY.md`)'), 185 (review 'produces verdicts + `VERIFICATION.md` + `verdict.json`', 'interrupted prior `VERIFICATION.md` pass'), 191 (featurefind 'producing a scored feature-gap ledger (`FEATURES.md`)'), 206 (featurefind 'findings written straight to `FEATURES.md`/`PROJECT.md`', the most dangerous one), 227 (stripe 'cold-resume from a prior run's `PROJECT.md`'), 312 (docs 'checks `PROJECT.md`'s Current status'), and 335 (migrate 'Cold-resumes from a prior run's `MIGRATION.md`', which Codex did not list). Lines checked and NOT stale: 178 (`target=auto|PROJECT.md|SECURITY.md` is the argument value; skills/dev-team-review/SKILL.md:116 defines it as selecting the .dev-team/ paths), 7, 525, 665-666 and 702 (legacy explanation or a name list just after the .dev-team/ path is given), and 494 (autopilot.json is not one of the seven). The same wording is on main (grep of git show main:README.md finds lines 120/164/170/178/185/191/206/227/312 identical), but on main those WERE the correct locations. The branch moved the files and added the audit, which claims to cover README, without updating these lines. So the stale wording is left over from main, and the branch made it wrong. Experiment in a temp copy: a broad 'verb near a bare ledger name' check across the whole audit scope flags 22 lines, about 11 of them false positives in skills/commands/hooks (for example conventions.md:151 'cat >> SECURITY.md', hooks/guard-ledgers.sh:19), so that design is too noisy. A narrow check on README lines starting '**Purpose.**', '**Modes.**', '**Artifacts.**' or '**Cold-resume.**' (32 such lines), after removing `.dev-team/<name>` forms and skipping lines with 'legacy root', flags exactly 120, 164, 170, 185, 191, 206, 227, 312 and 335, and nothing else.

**Notes:**

Not in my assignment, but found by the same experiment and worth a look: skills/dev-team-autopilot/references/modes-and-gates.md:30 ('review reads `.dev-team/PROJECT.md` + `SECURITY.md`'), skills/dev-team-review/SKILL.md:97 and documentarian-protocol.md:5 use bare names in sentences that may or may not already carry the path. They need reading one by one, not an automatic rule.

**Fix specification:**

1. README.md, add the `.dev-team/` prefix to each bare ledger name on these lines, changing nothing else: line 120 `PROJECT.md` -> `.dev-team/PROJECT.md`. Line 164 `SECURITY.md` -> `.dev-team/SECURITY.md`. Line 170 `PROJECT.md` and `SECURITY.md` -> `.dev-team/PROJECT.md` and `.dev-team/SECURITY.md`. Line 185, both `VERIFICATION.md` -> `.dev-team/VERIFICATION.md`, and `verdict.json` -> `.dev-team/verdict.json`. Line 191 `FEATURES.md` -> `.dev-team/FEATURES.md`. Line 206 `FEATURES.md`/`PROJECT.md` -> `.dev-team/FEATURES.md`/`.dev-team/PROJECT.md`. Line 227 `PROJECT.md` -> `.dev-team/PROJECT.md`. Line 312 `PROJECT.md`'s -> `.dev-team/PROJECT.md`'s. Line 335 `MIGRATION.md` -> `.dev-team/MIGRATION.md`. Leave line 178's `target=` values alone.
2. scripts/audit-ledger-paths.sh: add a check G after F, plus a matching paragraph in the header comment. Header text: 'G (negative) README.md only: a skill description line (one starting **Purpose.**, **Modes.**, **Artifacts.** or **Cold-resume.**) that still names a ledger with no .dev-team/ prefix once every .dev-team/<name> mention is removed. Those lines tell a reader where each skill reads and writes, so a bare name there is a live instruction, not an explanation. Limited to these lines on purpose: a broader verb-based check was tried and flagged about a dozen harmless lines elsewhere. What it cannot do: a stale bare name in any other README paragraph passes.' Code (bash 3.2 safe, reusing LEDGER_NAME_RE): `while IFS= read -r hit; do [ -n "$hit" ] || continue; lineno="${hit%%:*}"; content="${hit#*:}"; printf '%s' "$content" | grep -qi 'legacy root' && continue; stripped="$(printf '%s' "$content" | sed -E 's#\.dev-team/(PROJECT|FEATURES|SECURITY|VERIFICATION|MIGRATION|HANDOFF)\.md##g; s#\.dev-team/verdict\.json##g')"; if printf '%s' "$stripped" | grep -qE "$LEDGER_NAME_RE"; then note "G: README.md:$lineno a skill description names a ledger without the .dev-team/ prefix: $content"; fi; done < <(grep -nE '^\*\*(Purpose|Modes|Artifacts|Cold-resume)\.\*\*' README.md 2>/dev/null)`. The script has already cd'd to the repo root, so the relative README.md path is correct.
3. tests/scripts.bats: add @test "audit-ledger-paths: check G fires on a README skill description naming a bare ledger". It must run against a scratch copy of the tree (see finding 11's helper), never the real README. In the copy, append the line '**Modes.** Cold-resumes from a prior run'"'"'s `PROJECT.md`.' to README.md, run the copied scripts/audit-ledger-paths.sh, and assert status 1, output containing 'LEDGER-PATHS FAIL: G:', and output not containing 'LEDGER-PATHS FAIL: C:'. Add a second test: append '**Modes.** Cold-resumes from a prior run'"'"'s `.dev-team/PROJECT.md`.' and assert the output does not contain 'FAIL: G:'. The existing 'passes on the clean repo' test must still pass after step 1. Run it to confirm.

## Finding 10 — confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** low

**Evidence:**

scripts/audit-ledger-paths.sh:169-172 (check E) flags any line with 'stable repo-root|at the repo root|Check the repo root|from repo root' unless it says 'legacy root'. It never asks whether a ledger is mentioned. tests/scripts.bats:123-131 deliberately asserts that the harmless sentence 'Config files used to live at the repo root before this project reorganised its layout.' FAILS the audit. The script does not exist on main (git cat-file -e main:scripts/audit-ledger-paths.sh fails). Requiring a bare ledger name on the same line alone would make E identical to check C, since every E phrase contains 'repo root'/'repo-root', which C already scans. Prototype in a temp copy: E changed to look at the matching line plus the lines just before and after, after removing `.dev-team/<name>` forms. Results: (a) the harmless config sentence now passes; (b) 'The documentarian keeps `PROJECT.md`' followed on the next line by 'at the repo root.' gives exactly 'LEDGER-PATHS FAIL: E: ...:2', and C stays silent because line 2 has no ledger name; (c) '`.dev-team/PROJECT.md`' next to 'config lives at the repo root.' passes; (d) the real tree still passes. shellcheck on the changed script: clean. The new E can only flag lines the old E already flagged, and the old E flags nothing on the current tree, so no existing documentation is newly caught.

**Notes:**

The prototype used exactly this code in a throwaway copy, and all four cases behaved as described.

**Fix specification:**

1. scripts/audit-ledger-paths.sh: replace the `scan_negative "E" ...` call (lines 169-172) with a loop over `grep -rnE 'stable repo-root|at the repo root|Check the repo root|from repo root' "${SCOPE[@]}" 2>/dev/null`. For each hit: split path, lineno and content the same way check C does; `continue` if content matches 'legacy root' (grep -qi); set `start=$((lineno > 1 ? lineno - 1 : 1))`; set `window="$(sed -n "${start},$((lineno + 1))p" "$path" | sed -E 's#\.dev-team/(PROJECT|FEATURES|SECURITY|VERIFICATION|MIGRATION|HANDOFF)\.md##g; s#\.dev-team/verdict\.json##g')"`; if `printf '%s' "$window" | grep -qE "$LEDGER_NAME_RE"`, call `note "E: $path:$lineno still uses a legacy repo-root phrase next to a bare ledger name: $content"`. Update the header comment for E to: 'E (negative) the exact legacy phrases this project used before v1.5.0 ("stable repo-root", "at the repo root", "Check the repo root", "from repo root") on a line where that line, or the line just before or after it, still names a ledger with no .dev-team/ prefix. Why the neighbouring lines: check C already covers a phrase and a bare name on the same line, and a wrapped sentence often puts the name on the line above. Earlier version: E flagged the phrase on its own, which rejected unrelated sentences such as one about config files living at the repo root. What it cannot do: a bare name two or more lines away passes.'
2. tests/scripts.bats: replace the test at lines 123-131 with two tests, both run against the scratch tree copy from finding 11 (not the real repo). (a) @test "audit-ledger-paths: check E ignores a repo-root phrase with no ledger name nearby": inject 'Config files used to live at the repo root before this project reorganised its layout.', assert status 0 and output containing 'LEDGER-PATHS OK'. (b) @test "audit-ledger-paths: check E fires alone when a bare ledger name is on the line before the legacy phrase": inject the two lines 'The documentarian keeps `PROJECT.md`' and 'at the repo root.' with printf '%s\n', assert status 1, output containing 'LEDGER-PATHS FAIL: E:', and output not containing 'LEDGER-PATHS FAIL: C:'. Run shellcheck scripts/*.sh afterwards; it must stay clean.

## Finding 11 — confirmed

- **Introduced by this branch:** partly
- **Severity after checking:** medium

**Evidence:**

tests/scripts.bats:25-32: teardown() runs unconditionally after EVERY test (about 100 tests), and it runs `rm -rf "$REPO_ROOT/.claude/agents"`, `rm -f "$REPO_ROOT/tests/.tmp-audit-dated-id.md"` and `rm -f "$REPO_ROOT/skills/dev-team-orchestrator/references/.tmp-ledger-audit.md"`. Lines 72-78 run mkdir -p and then rm -rf on the same real repository path. git show main:tests/scripts.bats shows the .claude/agents teardown line and the test already existed on main, so that part is pre-existing. The branch added the fixed-name .tmp-ledger-audit.md writes and removals (4 tests at 102-140) plus the teardown line for it. .claude/agents does not exist in the repository today (ls), and .claude/ is partly tracked (git ls-files .claude lists CLAUDE.md, HANDOFF.md, plans/*), so a contributor could reasonably create .claude/agents there. Because the finding shows the suite can delete repository files, I did NOT run bats and reasoned from the source instead. Severity medium, not high: audit-model-ids.sh already fails whenever .claude/agents exists, so few people keep one, but anyone who does loses it silently the first time they run the tests. Safe-design experiment in a temp dir: copying the tree with `tar --exclude=.git -cf - . | (cd "$T/tree" && tar -xf -)` takes 4.6 MB. In that copy, scripts/audit-model-ids.sh prints AUDIT OK and audit-ledger-paths.sh prints LEDGER-PATHS OK. After `mkdir -p "$T/tree/.claude/agents"`, the copy's audit-model-ids.sh prints the expected '.claude/agents/ exists' failure, and the real repository's .claude/agents was still absent afterwards. Both audits `cd "$(dirname "$0")/.."`, so running the copy's script audits the copy.

**Notes:**

Step 4 in the fix list is only a clarification: no extra code is needed there. The copy includes untracked files such as orchestrator_prompt.md, which matches what the real audits see. I did not run bats, as instructed, because this finding shows the teardown deletes repository paths.

**Fix specification:**

1. tests/scripts.bats: add a helper below run_ledger_guard, with this comment: '# Copy this repository (without .git) into $SCRATCH/tree, so the audit scripts can be given an injected fault without touching the real working tree. Both audits cd to their own script's parent folder, so running the COPY's script audits the copy. This replaced an earlier design that wrote fixed-name files into the real repo and removed .claude/agents with rm -rf in teardown, which would silently delete a contributor's own .claude/agents folder. Uses tar because it behaves the same on macOS (bsdtar) and Ubuntu (GNU tar).' Body: `make_tree() { TREE="$SCRATCH/tree"; mkdir -p "$TREE" && ( cd "$REPO_ROOT" && tar --exclude=.git -cf - . ) | ( cd "$TREE" && tar -xf - ); }`.
2. teardown(): delete the three lines that remove paths under $REPO_ROOT and the comment above them, keeping only `[ -n "${SCRATCH:-}" ] && rm -rf "$SCRATCH"`. Update the header comment at lines 7-9 to say no test writes to or deletes anything in $REPO_ROOT; injected-failure tests use a copy in $SCRATCH/tree.
3. Rewrite the injected-failure tests to use the copy. 'fails on a dated model id' (60-70): `make_tree; echo "<a dated Claude model id>" > "$TREE/tests/.tmp-audit-dated-id.md"; run bash "$TREE/scripts/audit-model-ids.sh"` (the lead replaced the literal dated model id the verifier wrote here, because the plugin's model-id audit scans the whole repository, this record included, and failed on it), same assertions, no rm. 'fails when a .claude/agents/ dir exists' (72-78): `make_tree; mkdir -p "$TREE/.claude/agents"; run bash "$TREE/scripts/audit-model-ids.sh"`, same assertions, no rm. Checks C, D, E and F (102-140, together with the new tests from findings 9 and 10): `make_tree; printf ... > "$TREE/$TMP_LEDGER_AUDIT"; run bash "$TREE/scripts/audit-ledger-paths.sh"`, same assertions, no rm. The 'passes on the clean repo' tests may keep running the real scripts, because they only read.
4. Before calling make_tree in the .claude/agents test, add `rm -rf "$TREE/.claude/agents"` is NOT needed. Instead, in the model-ids 'passes on the clean repo' style, nothing changes. (If the contributor's real tree has .claude/agents, the copy has it too; that test expects a failure anyway.)
5. Add @test "scripts.bats: no test deletes anything inside the real repository". Build the pattern so the test does not match itself: `pat='rm -[rf]+ "\$REPO''_ROOT'`, then `run grep -nE "$pat" "$BATS_TEST_FILENAME"` and assert `[ "$status" -eq 1 ]`. Add a second assertion with `pat2='> "\$REPO''_ROOT/'` checked the same way (status 1), so no test writes a file into the real tree either.
6. Run `bats tests/scripts.bats` and `shellcheck tests/*.sh`. All tests must pass. Also confirm that `git status --porcelain` is unchanged before and after the run.

## Finding 12 — confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** medium

**Evidence:**

schemas/verdict.schema.json does not exist on main. Reproduced with check-jsonschema in a temp dir: the fixture changed to overall=PASS, integration=fail, checked=999, all counts 0, claims=[] -> 'ok -- validation done', exit 0. overall=PASS with a critical FAILED claim -> valid. A duplicate claim id (claims[1].id=V-001) -> valid. The protocol (verdict-and-report-protocol.md:15-17) says PASS needs a passing integration check, no FAILED or HOLLOW, and no critical DRIFTED/UNVERIFIABLE; FAIL follows from any critical FAILED or from integration failure. Some rules CAN be written in JSON Schema. I tested these allOf rules in a temp copy of the schema: (1) if integration const 'fail' then overall const 'FAIL'; (2) if claims contains {verdict FAILED, severity critical} then overall const 'FAIL'; (3) if overall const 'PASS' then failed const 0, hollow const 0, integration const 'pass', and claims does not contain {severity critical, verdict in [DRIFTED, UNVERIFIABLE]}. Results: tests/fixtures/verdict.sample.json VALID; the protocol's own JSON example (extracted from the ```json block) VALID; PASS+integration fail INVALID; PASS_WITH_GAPS+integration fail INVALID; PASS_WITH_GAPS+critical FAILED INVALID; FAIL+critical FAILED VALID; PASS with hollow and a critical DRIFTED INVALID; a clean PASS VALID; `check-jsonschema --check-metaschema` passes. Other rules CANNOT be written in JSON Schema: claims length equal to checked, the five counts summing to checked, each count matching the number of claims with that verdict, and claim ids being unique (uniqueItems compares whole objects, not the id field). A jq prototype of those rules returns true for the fixture and the protocol example, and false for a duplicate id. The test at tests/scripts.bats:593 only checks an invalid enum value.

**Notes:**

Every schema rule in the fix list was checked against real files with check-jsonschema before I wrote it. I did not add 'every regressions id must appear in claims' to the checker: the protocol does not clearly require it, and adding it would be a design decision.

**Fix specification:**

1. schemas/verdict.schema.json: keep "dev-team" const 'ledger=verdict schema=1.0' unchanged. These rules only reject verdicts the protocol already calls impossible, so this is not a breaking format change. Add a top-level "allOf" array with three entries, each with its own "$comment" explaining the rule in plain English and pointing to verdict-and-report-protocol.md 'Overall verdict rule'. (a) {"$comment":"A failed clean-room integration check always makes the overall verdict FAIL, whatever the claim counts say.","if":{"properties":{"integration":{"const":"fail"}},"required":["integration"]},"then":{"properties":{"overall":{"const":"FAIL"}}}}. (b) {"$comment":"Any claim that is both FAILED and critical makes the overall verdict FAIL. A critical DRIFTED claim does not: the protocol allows PASS_WITH_GAPS for that.","if":{"properties":{"claims":{"contains":{"properties":{"verdict":{"const":"FAILED"},"severity":{"const":"critical"}},"required":["verdict","severity"]}}},"required":["claims"]},"then":{"properties":{"overall":{"const":"FAIL"}}}}. (c) {"$comment":"PASS means nothing FAILED, nothing HOLLOW, integration passed, and no critical claim is DRIFTED or UNVERIFIABLE.","if":{"properties":{"overall":{"const":"PASS"}},"required":["overall"]},"then":{"properties":{"failed":{"const":0},"hollow":{"const":0},"integration":{"const":"pass"},"claims":{"not":{"contains":{"properties":{"severity":{"const":"critical"},"verdict":{"enum":["DRIFTED","UNVERIFIABLE"]}},"required":["verdict","severity"]}}}}}}. Add "uniqueItems": true to "regressions". In the "$comment", add: 'Rules that JSON Schema cannot express (counts matching the claims list, unique claim ids) are checked by scripts/check-verdict.sh, which must be run alongside this schema.' In the descriptions of "checked" and "claims", change 'should normally equal' / 'should appear exactly once' to 'must equal' / 'must appear exactly once (checked by scripts/check-verdict.sh)'.
2. New file scripts/check-verdict.sh (bash 3.2 safe, `set -uo pipefail`, file header with path, purpose, why, and what it cannot do). Usage: `check-verdict.sh <verdict.json>`. If no argument, the file is unreadable, or `command -v jq` fails: print 'VERDICT-CHECK FAIL: <reason>' to stderr and exit 2. It refuses rather than passing, because a checker that cannot run must never report success. If `jq empty` fails: FAIL, exit 1. Then run each rule as its own `jq -e` so every failure is named, calling note "<rule>" when a rule fails: (1) `(.claims|length)==.checked` -> 'claims list length does not equal checked'; (2) `(.verified+.failed+.drifted+.hollow+.unverifiable)==.checked` -> 'the five counts do not add up to checked'; (3) for each pair verified/VERIFIED, failed/FAILED, drifted/DRIFTED, hollow/HOLLOW, unverifiable/UNVERIFIABLE: `([.claims[]|select(.verdict=="VERIFIED")]|length)==.verified` -> '<field> does not match the number of <VERDICT> claims'; (4) `([.claims[].id]|length)==([.claims[].id]|unique|length)` -> 'claim ids are not unique'. Use `jq -e ... >/dev/null 2>&1`, because jq -e exits non-zero on false or null, which covers missing fields as a failure. Print 'VERDICT-CHECK OK' and exit 0 only if every rule held; otherwise exit 1. It does not validate the shape; that is the schema's job, so run the schema first.
3. skills/dev-team-review/references/verdict-and-report-protocol.md, after the paragraph at line 89: add one sentence saying a CI gate should run both `check-jsonschema --schemafile schemas/verdict.schema.json .dev-team/verdict.json` and `scripts/check-verdict.sh .dev-team/verdict.json`, and that the documentarian runs both after writing verdict.json (alongside the marker self-check).
4. tests/scripts.bats, in the verdict-schema section: keep the existing two tests. Add schema tests, each building a bad file with jq from the fixture into $SCRATCH and asserting check-jsonschema exits non-zero: (a) `.overall="PASS"|.integration="fail"`; (b) `.integration="fail"` (the fixture's PASS_WITH_GAPS with a failed integration); (c) `.claims[3].verdict="FAILED"|.claims[3].severity="critical"|.hollow=0|.failed=1` (PASS_WITH_GAPS with a critical FAILED); (d) `.overall="PASS"` (the fixture has hollow=1 and a critical DRIFTED). Add a positive test: `.overall="FAIL"|.claims[3].verdict="FAILED"|.claims[3].severity="critical"|.hollow=0|.failed=1` validates (exit 0). Add a test that the protocol document's own example is valid: extract it with `sed -n '/^```json$/,/^```$/p' "$REPO_ROOT/skills/dev-team-review/references/verdict-and-report-protocol.md" | sed '1d;$d' > "$SCRATCH/proto.json"`, then assert that both check-jsonschema and check-verdict.sh exit 0. Checker tests: fixture -> status 0 and output containing 'VERDICT-CHECK OK'; `.checked=999` -> status 1 and output containing 'claims list length'; `.verified=3` -> status 1 and output containing 'do not add up'; `.claims[1].id="V-001"` -> status 1 and output containing 'not unique'; `.claims=[]` -> status 1; a missing file -> status 2. Finally, a test with PATH set to a folder containing only bash (no jq), run as `PATH="$SCRATCH/nojq" run bash ...` after symlinking bash into it, asserting status 2 and 'jq'. Add scripts/check-verdict.sh to the ShellCheck step (already covered by the scripts/*.sh glob).

## Finding 13 — confirmed

- **Introduced by this branch:** yes
- **Severity after checking:** low

**Evidence:**

schemas/verdict.schema.json:97 (claims.items.severity description) says 'A FAILED or DRIFTED claim at 'critical' severity is what forces the overall verdict to FAIL.' The protocol (verdict-and-report-protocol.md:16-17) makes FAIL depend only on 'any critical ... claim FAILED' or an integration failure, and lists 'DRIFTED records' under PASS WITH GAPS. tests/fixtures/verdict.sample.json has V-003 DRIFTED/critical with overall PASS_WITH_GAPS, and the protocol's own example (lines 80-85) does the same. The schema's other descriptions agree with the protocol: line 43 ('Any FAILED claim marked critical severity is what drives overall to FAIL') and line 28. The schema file is new on the branch. The sentence is descriptive only, so nothing fails today. But the if/then rules added for finding 12 must follow the protocol (only critical FAILED forces FAIL), and my test confirmed the fixture stays valid under those rules.

**Fix specification:**

schemas/verdict.schema.json line 97: in the description of claims.items.severity, replace 'A FAILED or DRIFTED claim at 'critical' severity is what forces the overall verdict to FAIL.' with 'A FAILED claim at 'critical' severity forces the overall verdict to FAIL. A critical DRIFTED or UNVERIFIABLE claim does not force FAIL, but it does rule out PASS, leaving PASS_WITH_GAPS (see verdict-and-report-protocol.md, 'Overall verdict rule', and the sample fixture's V-003).' Do this in the same change as finding 12, whose rules (b) and (c) enforce exactly this wording. Test: covered by finding 12's tests. The fixture (critical DRIFTED + PASS_WITH_GAPS) must still validate, and `.overall="PASS"` on the fixture must fail. Also add `run grep -F 'FAILED or DRIFTED claim at' "$REPO_ROOT/schemas/verdict.schema.json"` asserting status 1.

## Finding 14 — confirmed

- **Introduced by this branch:** partly
- **Severity after checking:** low

**Evidence:**

skills/dev-team-orchestrator/references/config-and-toggles.md:56 reads `guard: auto            # on | off | auto  (auto = active during a run; DEV_TEAM_GUARD forces on)`. The same file at lines 126-138 says guard-ledgers.sh Rule 1 'stays ON in auto mode regardless of whether a run is active', and Rule 2 in auto depends on .dev-team/loop.lock/, not on 'a run' in guard-dev-team.sh's sense (autopilot.json). git show main shows the same comment at line 56 on main, where it was accurate because only guard-dev-team.sh existed. The branch added guard-ledgers.sh and made that inline comment wrong without changing it. It is the only copy of that comment in the repository (grep for 'auto = active during a run').

**Notes:**

The only copy found was in config-and-toggles.md; the grep covered the whole repository except .git.

**Fix specification:**

skills/dev-team-orchestrator/references/config-and-toggles.md line 56: replace the comment with a short multi-line comment in the same style as the git: block above it (continuation lines start with '#' aligned under the first). Wording: `guard: auto            # on | off | auto. auto: the Bash guard is active only during a run (.dev-team/autopilot.json present);` / `                       #   the ledger guard's Rule 1 is ALWAYS active, and its Rule 2 only while .dev-team/loop.lock/ exists.` / `                       #   DEV_TEAM_GUARD forces both hooks on; off turns both off. Details: the guard section below.` Keep the key and value `guard: auto` unchanged, and keep the block valid YAML (comments only). If /dev-team-config init copies this block from anywhere else (check commands/dev-team-config.md and skills/*/SKILL.md with `grep -rn 'guard: auto' commands skills`), apply the same wording there. Test, in tests/scripts.bats: @test "config-and-toggles: the guard: auto comment says ledger Rule 1 is always active" asserting `grep -F 'auto = active during a run' "$REPO_ROOT/skills/dev-team-orchestrator/references/config-and-toggles.md"` exits 1, and `grep -F "Rule 1 is ALWAYS active"` on the same file exits 0.


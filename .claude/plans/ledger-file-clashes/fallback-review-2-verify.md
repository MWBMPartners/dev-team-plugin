<!--
  File:    .claude/plans/ledger-file-clashes/fallback-review-2-verify.md
  Purpose: Stand-in verification of fix round 1 for issue #41 (13 September 2026, about 22:30 BST). Codex was out of usage credit
           until 02:31 on 14 September. A fresh Fable reviewer that built none of this checked whether each fix really works and
           looked for new problems, and an Opus refuter checked every verdict and finding (workflow wf_00978d58-654).
  Status:  NOT the owner's cross-system review. The branch stays not fully reviewed until Codex has done its full catch-up review.
-->

# Stand-in verification of fix round 1 — issue #41

## Summary

All 15 confirmed findings from round 1 and the lead's extra fixes were confirmed as fixed. One of them (15, the README guard
description) is only partly fixed; that gap is also listed below as new finding 5. The fixes introduced six new problems (1 medium,
5 low), all confirmed by the refuter, and all fixed in fix round 2.

## Fix verdicts

| Fix | Reviewer's verdict | Refuter |
| --- | --- | --- |
| 1. Read-only commands pointed at a rule that moves and commits files | fixed | confirmed |
| 2. Documentarian brief said 'Edit only .dev-team/PROJECT.md' but must create .gitignore and README.md | fixed | confirmed |
| 3. loop-runtime.md promised RECORD rewrites bare references but RECORD never said so | fixed | confirmed |
| 4. /dev-team-config init created .dev-team/ but never offered the pointer sentence; every trigger was 'the run that creates .dev-team/' | fixed | confirmed |
| 5. Rule 1 refused the plugin's own fixture and any marker-bearing file, contradicting 'can never block a person' | fixed-but-new-problem | confirmed |
| 6. Ownership rule said 'stamp first, then move', which the hook refuses | fixed | confirmed |
| 7. Path normalisation was one-shot, so '..' and '././' walked past both rules | fixed-but-new-problem | confirmed |
| 8. Test 'config guard=off ... even with an active run' never set up an active run | fixed | confirmed |
| 9. The 'is .dev-team/ ignored?' check could never fire for moved files and ran after the move | fixed | confirmed |
| 10. A look-alike file that is also a conflict was still asked about, with a false promise | fixed | confirmed |
| 11. A failed move said 'do not commit' but not how to undo, and the next --apply refused on the dirty tree | fixed-but-new-problem | confirmed |
| 12. The audit's negative tests could not tell which check fired; check F untested | fixed | confirmed |
| 13. README upgrade section said a 1.4 user has nothing to do | fixed | confirmed |
| 14. CHANGELOG said the old verdict.json example was not valid JSON | fixed | confirmed |
| 15. README described guard and DEV_TEAM_GUARD as Bash-only and autopilot.json-driven | partly-fixed | confirmed |
| lead-extra-1: CHANGELOG claimed case-insensitive matching 'in the lookup order' too | fixed | confirmed |
| lead-extra-2: README upgrade section says nothing is required (same as finding 13) | fixed | confirmed |
| lead-extra-3: README implied hand-written FEATURES.md/HANDOFF.md are asked about; only look-alikes are | fixed | confirmed |
| lead-extra-4: README iterate section used bare PROJECT.md where .dev-team/PROJECT.md was meant | fixed | confirmed |

## New findings

### 1. (medium) Rule 1 no longer stops the plugin's folder README being written over a project's top-level README.md

- **Where:** `hooks/guard-ledgers.sh` line 257
- **What is wrong:** The narrowing in 0a2f286 makes Rule 1 fire only for the seven ledger names. But the plugin writes an eighth marker-bearing file, .dev-team/README.md, whose fixed text carries '<!-- dev-team: ledger=readme schema=1.0 -->' on line 2 (conventions.md point 3 lists that marker; point 7 says 'It is itself a file the plugin writes, so it carries the marker'). 'readme.md' is not in the case list on line 257, so a Write of that text to the top-level README.md now passes Rule 1. The pre-fix hook refused it.
- **How it goes wrong:** A scribe following a stale or mistyped instruction (for example 'create README.md with the fixed text from point 7' without the .dev-team/ prefix) Writes the plugin's folder README to <project>/README.md. Current hook: exit 0, and the project's real README is overwritten with plugin text. Proved from a mktemp folder: payload {"tool_name":"Write","tool_input":{"file_path":"README.md","content":"# x\n<!-- dev-team: ledger=readme schema=1.0 -->\nline3"}} -> current hook exit 0; the same payload through the hook at 0a2f286~1 -> exit 2.
- **Proof:** printf '%s' '{"tool_name":"Write","tool_input":{"file_path":"README.md","content":"# x\n<!-- dev-team: ledger=readme schema=1.0 -->\nline3"}}' | bash hooks/guard-ledgers.sh; echo $?  -> 0 on the current hook, 2 on git show 0a2f286~1:hooks/guard-ledgers.sh
- **Fix:** Add readme.md to Rule 1's name list on line 257 (Rule 1 only — it still needs the marker in the first three lines, so a project's own README, which never has the marker, is unaffected; do not add it to Rule 2, whose record-id test would then block a project README that mentions 'F-001'). Update the 'seven ledger names' wording for Rule 1 in the hook header, conventions.md point 9, config-and-toggles.md, README.md hook row and CHANGELOG to 'the seven ledger names plus README.md'. Add a bats case for it.
- **Refuter:** confirmed — I reproduced this from a temporary folder. The payload writes README.md with the '<!-- dev-team: ledger=readme schema=1.0 -->' marker on line 2. The current hook allows it (exit 0). The hook from 0a2f286~1 refused it (exit 2). The readme.md name is not in Rule 1's list (hook lines 254-262), and conventions.md:71 and :122 show the plugin does write that marker into its README. So the narrowing removed a protection that used to exist.

### 2. (low) Under macOS's stock bash 3.2 the resolver throws 'parts[*]: unbound variable' for a path that resolves to nothing

- **Where:** `hooks/guard-ledgers.sh` line 188
- **What is wrong:** The script runs with 'set -u'. In bash 3.2, expanding "${parts[*]}" on an EMPTY array is an unbound-variable error (bash 4.4+ allows it). The array is empty whenever every segment was '.', '..' or empty: paths '.', '..', '/', 'SECURITY.md/..'. The command substitution's subshell dies, $resolved becomes empty, and the script carries on and exits 0 — fail-open — but it prints the error to stderr. The header (lines 161-162) and the commit message say the resolver was written for and proven under bash 3.2; hooks.json runs the script directly, so its '#!/usr/bin/env bash' shebang picks the PATH bash, which on a Mac without Homebrew bash is 3.2.
- **How it goes wrong:** On a stock Mac, any Write/Edit whose file_path collapses to nothing (a path of '.', '..', '/', or 'x/..') makes the hook print '/…/hooks/guard-ledgers.sh: line 188: parts[*]: unbound variable' on stderr. The decision is still 'allow', so nothing is wrongly blocked, but the hook's own claim of bash 3.2 support is untrue for these inputs, and a person seeing the message will think the guard is broken.
- **Proof:** printf '%s' '{"tool_name":"Write","tool_input":{"file_path":"..","content":"x\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}' | /bin/bash hooks/guard-ledgers.sh -> stderr 'line 188: parts[*]: unbound variable', exit 0 (bash 3.2.57). Same payload under bash 5.3.15: silent, exit 0. Same for '.', '/', 'SECURITY.md/..'.
- **Fix:** Guard the empty case: resolved="$(IFS='/'; printf '%s' "${parts[*]:-}")" — or wrap it in 'if [ "${#parts[@]}" -gt 0 ]; then ...; else resolved=""; fi'. Using printf instead of echo also stops a path whose only segment is '-n' or '-e' being swallowed as an echo option. Add a bats case that runs the hook on file_path '..' and asserts exit 0 with empty stderr.
- **Refuter:** confirmed — I reproduced this with /bin/bash (version 3.2). The paths '..', '.', '/' and 'SECURITY.md/..' each print 'line 188: parts[*]: unbound variable' to the error output, and the hook still exits 0 (allow). Line 188 expands the parts array while it is empty, which bash 3.2 treats as an error under set -u.

### 3. (low) An absolute path at the filesystem root ('/.dev-team/…') is now judged to be inside the project's .dev-team/

- **Where:** `hooks/guard-ledgers.sh` line 168
- **What is wrong:** When an absolute file_path is not under cwd, the leading '<cwd>/' strip does nothing, and the resolver then drops the leading '/' as an empty segment. So '/.dev-team/SECURITY.md' resolves to '.dev-team/SECURITY.md', in_devteam becomes 1, and Rule 1 allows the write even though the target is a folder at the filesystem root, not the project. Before this fix the same payload was refused (the literal string did not start with '.dev-team/'). Other absolute paths outside cwd ('/Users/x/other/.dev-team/SECURITY.md') are still refused, so only root-level paths are affected.
- **How it goes wrong:** cwd is /Users/x/proj; a Write of marker-bearing SECURITY.md content to '/.dev-team/SECURITY.md' is allowed (exit 0). Unlikely in practice, but it is a bypass in the unsafe direction introduced by the fix, and the header's claim that an escaped path 'counts as outside .dev-team/ for Rule 1' is not met for this shape.
- **Proof:** From a mktemp folder T: printf '%s' "{\"cwd\":\"$T\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"/.dev-team/SECURITY.md\",\"content\":\"# x\\n<!-- dev-team: ledger=security schema=1.0 -->\\n\"}}" | bash hooks/guard-ledgers.sh -> exit 0 (current); the same through git show 0a2f286~1:hooks/guard-ledgers.sh -> exit 2.
- **Fix:** After the prefix strip on lines 149-153, treat any $norm_path that still begins with '/' as having left the project: set escaped=1 (or in_devteam=0) before calling resolve_lexical, so Rule 1 judges it by file name only and Rule 2 skips it. Add a bats case for an absolute path outside cwd that starts with '/.dev-team/'.
- **Refuter:** confirmed — I reproduced this with cwd set to a temporary folder. Writing marker-bearing content to '/.dev-team/SECURITY.md' is allowed by the current hook (exit 0) and refused by the hook from 0a2f286~1 (exit 2). The path-resolving function drops the leading '/' as an empty piece, so the path is judged to be inside the project's .dev-team/ when it is not. Low severity, but it is a new gap in the unsafe direction.

### 4. (low) /dev-team-move-ledgers writes the pointer-sentence decline into config.yml before the move, never commits it, and the rollback either discards it or leaves it behind

- **Where:** `commands/dev-team-move-ledgers.md` line 91
- **What is wrong:** Question 3 (line 91) says a decline sets 'pointer-sentence: declined' in .dev-team/config.yml, creating the file if absent — a write made during the 'ask every question before changing anything' phase (line 76). Step 9 (line 104) lists exactly what gets 'git add'ed and config.yml is not on it, so the decline is left uncommitted even though conventions.md:138 and config-and-toggles.md:112-113 say the decline 'is committed so the choice holds for every collaborator'. The rollback (line 106) runs 'git reset --hard HEAD', which silently reverts a decline written into a tracked config.yml, and its delete list covers only README.md and .gitignore, so a config.yml this run created stays behind while the report says 'everything was put back to how it was before the command ran'.
- **How it goes wrong:** Case 1: tracked config.yml, user declines the sentence, files move, commit succeeds — the tree is left dirty with an uncommitted config.yml change the report does not mention; the user's next 'git status' shows a modification they did not make. Case 2: no config.yml, user declines, step 8 finds a missing marker — rollback leaves a new untracked .dev-team/config.yml (and possibly .dev-team/ itself, since 'now empty once those two are gone' is false), contradicting the report. Case 3: tracked config.yml, decline, rollback — the 'no' is reverted without a word and the user is asked again next run.
- **Proof:** commands/dev-team-move-ledgers.md:91 ('set pointer-sentence: declined ... If that file does not exist yet, create a minimal one'), :104 (git add list: moved files, .gitignore, README.md, autopilot.json, instruction files — no config.yml), :106 (rollback: 'git reset --hard HEAD' then delete README.md and .gitignore only).
- **Fix:** Either (a) write the decline only after step 9's commit succeeds and add '.dev-team/config.yml (if this run recorded a decline)' to step 9's git add list and to the report; or (b) keep writing it in question 3 but add config.yml to step 9's add list, and in the rollback say: delete .dev-team/config.yml only if this run created it, otherwise note that 'git reset --hard' has reverted the recorded decline and the question will be asked again. Say which in the text.
- **Refuter:** confirmed — move-ledgers.md:91 writes, or creates, .dev-team/config.yml during the question phase, before anything else changes. Step 9's git add list leaves config.yml out, and the undo steps delete only README.md and .gitignore. But conventions.md:138 and config-and-toggles.md:113 both say the decline 'is committed'. The text contradicts itself exactly as the reviewer describes.

### 5. (low) README quick-reference row still says 'guard: on' forces only the Bash safety guard

- **Where:** `README.md` line 424
- **What is wrong:** Finding 15's fix corrected rows 444, 453 and 562 but not the 'what you can switch' table above them. Row 424 reads 'Force the Bash safety guard on at all times | features: → guard | on | export DEV_TEAM_GUARD=1'. Since this branch, guard: on and DEV_TEAM_GUARD also force the ledger guard's Rule 2 on for every Write/Edit/MultiEdit (hooks/guard-ledgers.sh:269; config-and-toggles.md:138-139; README.md:444 and 453 say 'both hooks').
- **How it goes wrong:** A user reads only the quick table, sets guard: on to harden the Bash guard, and is then refused an Edit to their own top-level FEATURES.md that mentions 'F-001' with no run active — the README told them, twenty lines apart, both that guard: on affects only Bash and that it affects both hooks.
- **Proof:** sed -n '424p;444p' README.md shows the two rows disagreeing.
- **Fix:** Reword row 424 to 'Force both guard hooks on at all times (the Bash safety net and the ledger guard's Rule 2)'.
- **Refuter:** confirmed — The row 'Force the Bash safety guard on at all times | features: → guard | on | export DEV_TEAM_GUARD=1' is unchanged. Meanwhile the guard toggle row and the paragraph under it say guard: on and DEV_TEAM_GUARD force both hooks, and hook line 269 does exactly that (it turns Rule 2 on). The README contradicts itself.

### 6. (low) Two new bats tests do not exercise what their names claim

- **Where:** `tests/scripts.bats` line 345
- **What is wrong:** Test 36 ('"docs/../FEATURES.md" resolves to the top level and is denied') passes without any path resolution: its base name is FEATURES.md and it is outside .dev-team/ whether or not '..' is collapsed, so Rule 1 denies it either way — a broken resolve_lexical would not fail it. Test 20 (line 228) is named 'a top-level path with a ledger name elsewhere in the tree (docs/FEATURES.md)', but docs/FEATURES.md is not a top-level path; the name contradicts its own payload. Test 35 ('.dev-team/./FEATURES.md ... allowed') also passed on the pre-fix hook, since the literal string already starts with '.dev-team/'. Of the Rule 1 path tests only test 34 ('.dev-team/../SECURITY.md') actually depends on resolution.
- **How it goes wrong:** Someone breaks resolve_lexical so that '..' is no longer collapsed for Rule 1 (for example by reverting to the one-shot strip); tests 35 and 36 still pass, and only test 34 catches it. If test 34 were later loosened, the resolver would be untested for Rule 1's 'allow' direction entirely.
- **Proof:** tests/scripts.bats:228 and :345-349; hooks/guard-ledgers.sh:254-258 (Rule 1 checks base name and in_devteam only, so 'docs/../FEATURES.md' and 'docs/FEATURES.md' are judged identically with or without resolution).
- **Fix:** Replace test 36 with a case that only passes when resolution works in the allow direction, for example file_path 'docs/../.dev-team/FEATURES.md' with the marker -> expect exit 0 (the pre-fix hook refused this, because the raw text does not start with '.dev-team/'). Rename test 20 to 'a ledger-named file elsewhere in the tree (docs/FEATURES.md), outside .dev-team/, is still denied'.
- **Refuter:** confirmed — I ran both payloads through the hook from before the fix (0a2f286~1). 'docs/../FEATURES.md' was already refused (exit 2) and '.dev-team/./FEATURES.md' was already allowed (exit 0). So both tests would pass even if the '..' handling were broken, and neither one proves that handling works. Test 20's name says 'top-level path', but its payload uses docs/FEATURES.md.

## What the reviewer examined

Read fallback-review-1.md in full, then git show for 0a2f286, e062725, 202bd2d and daa25c7 and git diff --stat 5e85c43..daa25c7. Opened in full as they now stand: hooks/guard-ledgers.sh, hooks/hooks.json, commands/dev-team-move-ledgers.md, commands/dev-team-config.md, the ownership section of conventions.md (lines 60-160), config-and-toggles.md (lines 40-150), documentarian-protocol.md (80-113), and the changed hunks of loop-runtime.md, mission-and-done.md, orchestrator SKILL.md, review/docs/ci-medic SKILL.md, dev-team-status/report/approve.md, README.md (420-456, 660-700, 141), CHANGELOG.md (28-140), tests/scripts.bats and tests/README.md. Ran the repo's own checks on the clean branch: bash scripts/audit-ledger-paths.sh (LEDGER-PATHS OK), bash scripts/audit-model-ids.sh (AUDIT OK), bash tests/smoke-structure.sh (SMOKE OK), bats tests/scripts.bats (56/56 ok), shellcheck hooks/guard-ledgers.sh (clean). Piped about 35 JSON payloads into the current hook from mktemp folders (removed afterwards) under both /bin/bash 3.2.57 and bash 5.3.15: the fixture and FEATURES.sample.md cases from finding 5, every finding-7 probe, and the edge cases '..', '.', '', '/', '//x', trailing '/', '.dev-team//x', '.dev-team/x/../y', escaped '../x', absolute paths under and outside cwd, '/.dev-team/x', paths with spaces and a glob, '-n' and '-e' names, README.md with the readme marker; compared three of those against the pre-fix hook (git show 0a2f286~1). Proved each of the four audit samples trips only its own check by running the real script in a git-archive copy of the repo in mktemp. Tested git check-ignore with and without --no-index in a throwaway repo. Grepped every copy of the refusal prompt (2 copies, byte-identical), the pending-move sentence, the pointer-sentence key, stale 'never block' claims and old trigger wording. Nothing in the repository was created, edited or deleted, and no state-changing git command was run (git status still shows only the pre-existing modified .claude/HANDOFF.md and untracked orchestrator_prompt.md). Not checked: whether Claude Code fires PreToolUse for a subagent's Write; the move-ledgers command and the skills were not executed end-to-end (they are agent instructions, not scripts) — those verdicts rest on quoting the text; the CI workflow was not re-examined. #42, #43 and #44 were not reported.

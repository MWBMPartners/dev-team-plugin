# Stand-in verification of fix round 4 (issue #41)

<!--
  File:     .claude/plans/ledger-file-clashes/standin-verify-fix-round-4.md
  Purpose:  Record of the stand-in check of fix round 4 (commits 960ef64, 6f9d1ab, 8be396b), run because
            Codex, the usual independent reviewer, stopped mid-review on a usage limit at 07:50 on 14 September 2026.
-->

**Date:** 14 September 2026. **Workflow:** `standin-verify-fix-round-4` (run `wf_f635152a-33a`), read-only.

**Who checked:** a fresh Fable reviewer that built none of this, then an Opus refuter that tried to disprove every finding with its own probes. **This is not the cross-system review** the working rules ask for. Both agents are Claude, the same family as the builders, so the branch stays "not fully reviewed" until Codex has looked at it.

**Leads A, B and C came from Codex.** Codex's unfinished round-4 run (07:38–07:50) named them in its progress messages before it hit the usage limit. They are credited to Codex, and were verified here.

## Were fix round 4's seven fixes real?

| Problem | Reviewer | Refuter |
| --- | --- | --- |
| 1 | fixed | agreed |
| 2 | fixed | agreed |
| 3 | fixed | agreed |
| 4 | fixed | agreed |
| 5 | partly fixed | agreed |
| 6 | fixed | agreed |
| 7 | fixed | agreed |

The refuter's notes on the seven fixes:

None of the seven statuses. Notes:
- Problem 5 ('partly fixed'): I agree. An empty or whitespace-only file still exits 1 (probe: 'empty rc=1', 'ws rc=1'), while '{not json' now gives rc=2. But the supporting finding N2 is wrong in two places. A bare `42` is valid JSON, so exit 1 is what the header promises. And the proposed `jq -e 'type == \"object\"'` still accepts `{} {}` (rc=0). A slurp-based test is needed instead.
- Problem 3 ('fixed'): I agree the text now clears the recorded id. But point 4's explanation of the -f is narrower than the truth. A fully stamped moved file also needs -f, because the index keeps git mv's pre-stamp copy until step 9's git add (probe: 'manual step2 git rm --cached (no -f) on FULLY stamped file rc=1'). The automatic path always uses -f, so its behaviour is correct.
- Problem 1 ('fixed'): my probes reproduce every allow and deny the reviewer lists, on both bashes, plus a subfolder literally named 's*' (a write to sx/.dev-team/PROJECT.md is still denied, rc=2). The inconsistency the fix leaves behind is lead B.
- Problems 2, 4, 6, 7: re-run and agreed. Rollback walk final status empty, FEATURES.md restored to 'v1'. Old guard-test shapes 01-11 are caught. P6a/b/e give rc=2, P6c/f rc=0, a double trailing slash rc=0 (a stated limit). Check G: 'LEDGER-PATHS FAIL: G: README.md:768' rc=1, and the prefixed line gives 'LEDGER-PATHS OK' rc=0. Wrapped-sentence join: 'joined=1 drifted-copy=0' for both files.
- Repo checks: LEDGER-PATHS OK, AUDIT OK, SMOKE OK, shellcheck rc=0 on the hook and both scripts.

## Findings, with the refuter's verdict

### B: Rule 2 leaves a subfolder session's own top-level ledger names unprotected, although round 4 now treats that folder as the plugin's home

- **Reviewer:** medium, `hooks/guard-ledgers.sh:531`, origin: introduced earlier on this branch.
- **Refuter:** partly confirmed, severity medium.

**What is wrong (reviewer).** Round 4 decided that in a session started in a subfolder (say packages/app), the plugin's own folder is packages/app/.dev-team/ — the hook counts it as inside .dev-team/ (:465-469) and reads config and the lock from it (:281-303, :511-512), on the stated grounds that every skill writes `.dev-team/<name>` relative to the session folder (:274-276). But Rule 2 still matches only the git top folder's names (:531 `project.md|features.md|security.md|...|.github/security.md|docs/security.md` against $resolved, which for a relative `SECURITY.md` from packages/app is `packages/app/security.md`). So the hook now holds two different ideas of where 'the old top-level place' is: for the plugin's writes and settings it is the session folder, for the harm Rule 2 guards against it is the git top only. The documents do not settle it either way: conventions.md:56 says '.dev-team/ folder at the top of the project' and commands/dev-team-move-ledgers.md:17 uses `git rev-parse --show-toplevel` so that 'top level' is not 'whichever subfolder the session happens to be in', while no skill and not /dev-team-config init (commands/dev-team-config.md:31) uses the git top — they write relative paths, which is what the round-4 commit and hook comments themselves rely on. Before v1.5.0 those same relative writes put a subfolder session's ledgers at `<sub>/SECURITY.md`, so the plugin genuinely could have written its legacy ledger there, and a stale instruction today would write there again. The pre-round-3 hook (commit f58a08a, root = cwd) refused that write; round 3's fix (4e923a9) deliberately allowed it (its verification specified test T6, now tests/scripts.bats:793, expecting exit 0), and round 4 then adopted the session-folder premise without revisiting Rule 2.

**How it goes wrong.** A monorepo session started in packages/app with an autopilot cycle running (loop.lock/ in either place). A skill following a stale instruction appends its findings to `SECURITY.md` — a relative path, the most natural stale form — which lands on packages/app/SECURITY.md, the package's own policy or feature list if it has one. Rule 2 does not fire; Rule 1 does not apply (Edit, or Write without the marker). This is exactly the 'run appends its findings to a project file' failure the hook exists to stop, one folder down.

**Reviewer's evidence.**

```text
Probe on both bashes with the lock at the top and the session in src: 'OK rc=0 B1 rel Edit SECURITY.md (-> src/SECURITY.md) F-001 : allowed today', 'OK rc=0 B2 abs Edit <repo>/src/SECURITY.md F-001 : allowed today', 'OK rc=0 B6 rel Edit FEATURES.md (-> src/FEATURES.md) FG-001 : allowed today', 'OK rc=0 B7 same as B1 but lock ALSO in src/.dev-team : still allowed'; control 'OK rc=2 B3 rel Edit ../SECURITY.md (top) F-001 : denied'. Same payloads through the pre-round-3 hook: 'OK rc=2 B8 PRE-ROUND-3 hook (f58a08a): rel Edit SECURITY.md from src ... denied', 'OK rc=2 B9 ... abs Edit <repo>/src/SECURITY.md ... denied'. tests/scripts.bats:793-799 pins today's exit 0 ('a relative ledger name from a subfolder is not the top-level file'); tests/README.md:307 says `src/SECURITY.md` 'is correctly NOT treated as the top-level file'. Rule 1 still catches the marker-bearing Write by name (B4/B5 rc=2), so only the Edit / no-marker shape is open.
```

**Refuter's reasoning.** The behaviour is real. In a session started in a subfolder (src), Rule 2 does not protect src/SECURITY.md, even when the autopilot lock sits in src/.dev-team/. Round 4 now treats that lock as a real run, and it is the place a subfolder session's own autopilot creates it, because loop-runtime.md:108 uses a relative `mkdir .dev-team/loop.lock`. So Rule 2 never catches the most natural stale write in a subfolder session: a bare relative `SECURITY.md` resolves to src/SECURITY.md, never to the top-level file. Three things the reviewer got wrong. (1) It says 'the documents do not settle it either way'. They do settle the location, and they say the project top: conventions.md:56 says '.dev-team/ folder at the top of the project', conventions.md:152 has Rule 2 guarding 'a top-level file', and commands/dev-team-move-ledgers.md:17 uses `git rev-parse --show-toplevel` 'so top level means the project's top level and not whichever subfolder the session happens to be in'. The actual defect is a three-way disagreement. The documents say the git top. The skills write relative paths, so in practice they use the session folder. Round 4's hook follows the skills for .dev-team/, config and the lock, but follows the documents for Rule 2. A further consequence the reviewer missed: in a subfolder session, readers following the lookup order look for a relative `SECURITY.md` (the session folder), while /dev-team-move-ledgers only looks at the git top. (2) It says round 4 adopted the session-folder premise 'without revisiting Rule 2'. That overstates it: hooks/guard-ledgers.sh:457-458 explicitly says the change 'does NOT loosen Rule 2, which only ever matches the exact top-level names ... never anything under src/'. That was a conscious choice, although it only considered loosening and never considered protection. (3) Its pre-round-3 evidence ('same payloads ... denied') holds only when the lock is inside src. With the lock only at the top, the pre-round-3 hook allows the same Edit. The underlying point survives: under the session-folder model with the lock in src, the pre-round-3 hook denied this write and the current hook allows it. That regression came from round 3 and round 4 kept it. Medium is fair, because it is a design inconsistency across the hook, the skills and a command, and it needs the owner to decide.

**Refuter's evidence.**

```text
My probe used a throwaway git repo with a src/ subfolder, cwd=<repo>/src, and an Edit whose new_string was 'F-001 fixed'. Results were identical on /bin/bash 3.2.57 and /opt/homebrew/bin/bash 5.3.15. Current hook: 'OK rc=0 B1 from src rel Edit SECURITY.md F-001', 'OK rc=0 B2 from src abs Edit src/SECURITY.md F-001', 'OK rc=0 B5 from src rel Write SECURITY.md no marker but F-001', 'OK rc=0 B6 from src rel Edit FEATURES.md FG-001', 'OK rc=2 B3 from src rel ../SECURITY.md F-001 (denied)', 'OK rc=2 B4 from src rel Write SECURITY.md marker (Rule 1 denies)'. Lock location compared across the three hook versions (fp is the file_path): 'lock=src hook=old-hook.sh fp=SECURITY.md rc=2', 'lock=src hook=old-hook.sh fp=src/SECURITY.md rc=2', 'lock=top hook=old-hook.sh fp=SECURITY.md rc=0', 'lock=src hook=r3-hook.sh fp=SECURITY.md rc=0', 'lock=src hook=guard-ledgers.sh fp=SECURITY.md rc=0', 'lock=both hook=guard-ledgers.sh fp=SECURITY.md rc=0', 'lock=src hook=guard-ledgers.sh fp=../SECURITY.md rc=2'. old-hook.sh is `git show f58a08a:hooks/guard-ledgers.sh` (line 342: `[ -d "$(rel .dev-team/loop.lock)" ]`, relative to cwd). r3-hook.sh is 4e923a9. The pin in tests/scripts.bats (~:793) is 'a relative ledger name from a subfolder is not the top-level file', with the lock at the top and `[ "$status" -eq 0 ]`. On main, skills/dev-team-security/SKILL.md:36 and :63 say the scribe writes `SECURITY.md` with a bare relative name, so a subfolder session before v1.5.0 would have written <sub>/SECURITY.md.
```

**Fix specification (refuter's corrected version wins).** This needs an owner decision first, because the documents and the skills disagree. Suggested question: 'In a session started in a subfolder of a repository, should .dev-team/ live in that subfolder or at the repository top?' Suggested answer: the subfolder, since that is what every skill already does. Option 1 (session folder): in the Rule 2 `case "$resolved_lc"` at hooks/guard-ledgers.sh:530-536, when $sub is non-empty, also match the lower-cased "$sub_lc"/project.md, features.md, security.md, verification.md, migration.md, handoff.md and verdict.json. Quote $sub_lc so it is taken literally. Leave out <sub>/.github/security.md and <sub>/docs/security.md unless a reason is written down: GitHub reads a security policy only from the repository-top .github/, the top itself, and docs/. Flip the test at tests/scripts.bats ~:793 to expect exit 2, and add: a case with the lock only in src/.dev-team; an absolute <repo>/src/SECURITY.md case; an FG-001 Edit to src/FEATURES.md; and a control showing src/deep/SECURITY.md from a session in src is not matched. Update the hook header (:36-45, and the round-4 note at :129-140 and :457-458), tests/README.md (~:307), and conventions.md points 1, 5 and 9 (Rule 2) to say that 'top of the project' means the session folder when the session starts in a subfolder. Also decide whether /dev-team-move-ledgers should look in the session folder as well as the git top. Option 2 (git top): state it in conventions.md point 1, make the skills and /dev-team-config init resolve `.dev-team/` with `git rev-parse --show-toplevel`, and remove round 4's <sub>/.dev-team/ acceptance and the reads of config and the lock from cwd, rather than keeping two models side by side.

### A: Rule 2's record-id pattern stops at exactly three digits, so a four-digit id passes

- **Reviewer:** low, `hooks/guard-ledgers.sh:419`, origin: introduced earlier on this branch.
- **Refuter:** confirmed, severity low.

**What is wrong (reviewer).** `id_pattern='\b(FG|F|B|G|V|I|M)-[0-9]{3}\b'` requires a word boundary right after the third digit, so `F-1000` never matches (the boundary check fails between the third and fourth digit, and no shorter start works either). The plugin's own documents do not agree on the width: schemas/verdict.schema.json:70 and :89 use `^V-[0-9]{3,}$` and say 'at least three digits'; commands/dev-team-move-ledgers.md:36, :49 and :51 say 'followed by three digits'; conventions.md:157-167 (the ID prefixes table) gives no width at all; skills use placeholders such as `F-0XX` and `I-0XX` (skills/dev-team-security/references/red-team-protocol.md:53, verdict-and-report-protocol.md:9). So ids are three-digit zero-padded by example, nothing caps them at 999, and the schema explicitly expects longer ones to be possible. Ids are never reused (issue sync keys on them), so a long-lived project's F- or FG- counter only ever grows; reaching 1000 is unlikely but not impossible, and the hook is silent about the limit.

**How it goes wrong.** With a run active, an Edit adding `| F-1000 | ... |` to the project's top-level SECURITY.md is allowed, while `| F-999 |` is refused. The hook's protection quietly ends at the thousandth record.

**Reviewer's evidence.**

```text
Probe on both bashes with the lock at the top: 'OK rc=2 A1 Edit SECURITY.md F-001 fixed denied', 'OK rc=0 A2 Edit SECURITY.md F-1000 fixed (four digits)', 'OK rc=0 A3 Edit FEATURES.md FG-1234 done', 'OK rc=0 A4 Edit SECURITY.md | F-1000 | x | table row'. Direct check: `printf 'F-1000\nF-100 \n' | /usr/bin/grep -nE '\b(FG|F)-[0-9]{3}\b'` prints only line 2. `git log -S'id_pattern' -- hooks/guard-ledgers.sh` -> 1abe635, which is on this branch only (`git merge-base --is-ancestor 1abe635 main` -> not on main); the hook does not exist on main (`git ls-tree main hooks/` lists no guard-ledgers.sh).
```

**Refuter's reasoning.** Real, and present on the branch before round 4. It is not on main, because the hook does not exist there. The pattern `\b(FG|F|B|G|V|I|M)-[0-9]{3}\b` needs a word boundary right after the third digit, so four-digit ids never match. The documents give ids three zero-padded digits by example: F-0XX (red-team-protocol.md:53), I-0XX and V-0XX (verdict-and-report-protocol.md:9 and :39), B-0XX (cycle-contract-template.md:13). commands/dev-team-move-ledgers.md:36, :49 and :51 say 'three digits'. Only the schema states a rule, and it allows growth: 'at least three digits' (schemas/verdict.schema.json:70-71 and :89, pattern `^V-[0-9]{3,}$`). Nothing caps a counter at 999. The practical exposure is very small, for two reasons. An edit that contains any id below 1000 is still refused, so the gap only opens when every id being written is 1000 or higher, which needs more than 999 records of one kind. And the move-ledgers text describes real ledgers as holding 'dozens of records'. Low is right. The fix is correct. Aligning the move-ledgers wording is optional: read plainly, 'FG- followed by three digits' already matches FG-1000, because that text contains FG-100, so that text does not cap at 999.

**Refuter's evidence.**

```text
Top-level lock present, both bashes: 'OK rc=2 A1 top Edit SECURITY F-001 fixed', 'OK rc=0 A2 top Edit SECURITY F-1000 fixed', 'OK rc=0 A3 top Edit FEATURES FG-1234 done', 'OK rc=0 A4 top Edit SECURITY | F-1000 | x |', 'OK rc=2 A7 top Edit SECURITY | F-999 | x |', 'OK rc=2 A6 top Edit SECURITY F-1000 plus F-001 same edit', 'OK rc=0 A5 F-12'. The pre-round-3 hook (f58a08a) gives the same A results. `git log -S'id_pattern' -- hooks/guard-ledgers.sh` -> '1abe635 feat(hooks, schemas): guard against plugin records outside .dev-team/...'; `git merge-base --is-ancestor 1abe635 main` -> '1abe635 not on main'; `git ls-tree main hooks/` lists check-update.sh, guard-dev-team.sh, hooks.json and sync-branches-check.sh, with no guard-ledgers.sh.
```

**Fix specification (refuter's corrected version wins).** Change hooks/guard-ledgers.sh:419 to `id_pattern='\b(FG|F|B|G|V|I|M)-[0-9]{3,}\b'`, matching the schema's `{3,}`. Add two bats cases beside the Rule 2 tests, with the lock present: an Edit containing 'F-1000' to the top-level SECURITY.md exits 2, and one containing 'F-12' exits 0, which pins the lower limit. Add a one-line fault note to the header list. Optionally, add a sentence to conventions.md's ID prefixes table: 'numbers are at least three digits, zero-padded (F-001), and grow past 999 without a cap'. Changing the move-ledgers wording is not required.

### C: The verdict schema only checks the PASS direction: a FAIL (or PASS_WITH_GAPS) with no cause validates

- **Reviewer:** low, `schemas/verdict.schema.json:108`, origin: introduced earlier on this branch.
- **Refuter:** partly confirmed, severity low.

**What is wrong (reviewer).** The three allOf rules (:108-164) say: integration fail -> overall FAIL; a critical FAILED claim -> overall FAIL; overall PASS -> nothing failed or hollow, integration passed, no critical DRIFTED/UNVERIFIABLE. Nothing says overall FAIL needs a cause, or that PASS_WITH_GAPS needs a gap. The protocol defines FAIL by its causes — skills/dev-team-review/references/verdict-and-report-protocol.md:17 'FAIL — any critical done-criterion / feature / security claim FAILED, or the integration check failed' — and :19 'State which rule fired and why', so a FAIL with every claim VERIFIED and integration passed contradicts the rule exactly as a PASS with a failed integration does. The schema's own $comment (:6) says the rules 'reject verdict shapes that ... the Overall verdict rule already calls impossible', which reads as both directions but is only one. scripts/check-verdict.sh does not look at overall at all (its header says so). Harm is in the safe direction — a wrong FAIL blocks a build and a person looks — which is why this is low, but a producer that miscomputes overall in this direction is invisible to CI.

**How it goes wrong.** A review skill emits overall FAIL with two VERIFIED claims and integration pass (a stale headline copied from an earlier run, say). check-jsonschema accepts it and check-verdict.sh prints VERDICT-CHECK OK; CI fails the build on a verdict whose own contents say it should have passed, and nothing points at the contradiction.

**Reviewer's evidence.**

```text
Probe: a verdict with overall FAIL, checked 2, verified 2, all other counts 0, integration pass, two VERIFIED claims (one severity critical) -> `check-jsonschema --schemafile schemas/verdict.schema.json` printed 'ok -- validation done', rc=0; `scripts/check-verdict.sh` printed 'VERDICT-CHECK OK', rc=0. The same file with overall PASS_WITH_GAPS -> 'ok -- validation done' rc=0. overall FAIL with only a severity-low FAILED claim -> rc=0. Control: overall PASS with integration fail -> 'Schema validation errors were encountered ... $.overall: FAIL was expected', rc=1. The schema is not on main (`git cat-file -e main:schemas/verdict.schema.json` fails).
```

**Refuter's reasoning.** The behaviour is real. A verdict of FAIL with no failed critical claim and a passing integration check passes both the schema and check-verdict.sh. The protocol defines FAIL only by its causes: verdict-and-report-protocol.md:17 says 'FAIL — any critical done-criterion / feature / security claim FAILED, **or** the integration check failed', and :19 says 'State which rule fired and why'. So by the documents, FAIL must have a cause, and a FAIL without one contradicts the rule just as a PASS with a failed integration check does. One part of the reviewer's reasoning overreaches. The schema's $comment (:6) says the allOf rules 'only reject verdict shapes that ... the Overall verdict rule already calls impossible'. That limits what they reject; it does not promise they reject every impossible shape, so the $comment does not over-claim. Low severity is right, because a wrong FAIL errs in the safe direction. Adding the proposed fourth rule would not break any existing fixture: the only valid FAIL fixture has a critical FAILED claim, and the protocol's JSON example uses PASS_WITH_GAPS. Leaving PASS_WITH_GAPS unconstrained from below is sensible.

**Refuter's evidence.**

```text
Probe files had checked=2 and integration pass. 'failnocause' (overall FAIL, two VERIFIED claims, one of them critical): schema rc=0 [ok -- validation done], checker rc=0 [VERDICT-CHECK OK]. 'pwgnocause' (PASS_WITH_GAPS, same claims): schema rc=0, checker rc=0. 'faillow' (FAIL with only a low-severity FAILED claim): schema rc=0, checker rc=0. Control 'passintfail' (PASS with integration fail): schema rc=1 [passintfail.json::$.integration: 'pass' was expected]. Fixture scan: 'verdict.valid-fail-critical-failed.json overall=FAIL integration=pass critFailed=1'; every other valid fixture is PASS_WITH_GAPS. Protocol JSON example at verdict-and-report-protocol.md:70 has '"overall": "PASS_WITH_GAPS"'. `git cat-file -e main:schemas/verdict.schema.json` -> 'exists on disk, but not in main'.
```

**Fix specification (refuter's corrected version wins).** Add a fourth allOf rule: if overall is the constant FAIL, then anyOf [integration is the constant fail; claims contains an item with verdict FAILED and severity critical]. Give it a $comment quoting protocol line 17. Add the fixture tests/fixtures/verdict.invalid-fail-without-cause.json (the probe file above) and a bats case asserting check-jsonschema rejects it. Keep verdict.valid-fail-critical-failed.json as the positive control. Add a separate valid fixture that is FAIL because integration failed, with no failed claims, so the second branch of the anyOf is also pinned. In the top-level $comment, change 'three' to 'four', and add one sentence saying PASS_WITH_GAPS is deliberately not checked from below and why. Do not describe the old $comment as having over-claimed.

### N1: The by-hand recovery text omits the -f that point 4 itself says is needed for a half-written moved file

- **Reviewer:** low, `commands/dev-team-move-ledgers.md:151`, origin: introduced by fix round 4.
- **Refuter:** partly confirmed, severity low.

**What is wrong (reviewer).** Point 4 (:149) says to remove a path absent at H0 with `git rm -qf --cached --ignore-unmatch` and explains at length that the `-f` 'matters here: if a moved-to path's own stamp write failed partway, its index entry still holds the pre-stamp content staged by git mv, which no longer matches the half-written file now on disk, and a plain git rm --cached refuses'. Point 6's manual-recovery text (:151), rewritten in the same commit, tells the person to run `git rm --cached --ignore-unmatch -- <path>` — without `-f`. The manual text is given precisely when the automatic undo has been refused (HEAD moved, an unlisted path, or a changed blob elsewhere), and a half-written stamp can coexist with any of those, so the one command the person is handed fails in the case the command's own text singles out.

**How it goes wrong.** Step 6's stamp on .dev-team/FEATURES.md dies halfway, and the rollback's point 2 or 3 then finds something else changed (an editor touched app.js). The person follows point 6 and runs `git rm --cached --ignore-unmatch -- .dev-team/FEATURES.md`; git refuses with 'the following file has staged content different from both the file and the HEAD ... (use -f to force removal)', the rename stays staged, and the person has to work out the -f themselves.

**Reviewer's evidence.**

```text
Throwaway repo walk: after `git mv FEATURES.md .dev-team/FEATURES.md` and a partial overwrite of .dev-team/FEATURES.md, `git rm --cached --ignore-unmatch -- .dev-team/FEATURES.md` printed 'error: the following file has staged content different from both the file and the HEAD: .dev-team/FEATURES.md (use -f to force removal)', rc=1, `git status --porcelain` unchanged ('RM FEATURES.md -> .dev-team/FEATURES.md' still there). Then `git rm -qf --cached --ignore-unmatch -- .dev-team/FEATURES.md` -> rc=0 and the rename was gone. Without a half-write, the -f-less command succeeds ('git rm --cached (no -f) on cleanly moved file rc=0'), so the gap is exactly the case point 4 describes.
```

**Refuter's reasoning.** Real, and wider than the reviewer says. The manual-recovery text (commands/dev-team-move-ledgers.md:151) gives `git rm --cached --ignore-unmatch -- <path>` without -f. The reviewer limits the failure to a half-written stamp. But after `git mv`, the index keeps git mv's pre-stamp copy until step 9's `git add`. So a fully successful stamp also leaves the index different from both the file on disk and HEAD, and git refuses without -f in that case too. Every failure between step 6's stamp and step 9's `git add` therefore hits this, including the step 7 and step 8 failures that the manual text is most likely to follow. The reviewer's 'without a half-write, the -f-less command succeeds' was tested only on a moved file that was never stamped. Point 4's own explanation of -f (:149) is also narrower than the truth. The automatic path is still correct because it always uses -f. Low severity holds: the manual text is only given after the automatic undo refuses, and git's own error message says '(use -f to force removal)'.

**Refuter's evidence.**

```text
Throwaway repo, git 2.55.0. Half-written stamp: after `git mv FEATURES.md .dev-team/FEATURES.md; printf 'half' > .dev-team/FEATURES.md`, `git rm --cached --ignore-unmatch -- .dev-team/FEATURES.md` -> 'error: the following file has staged content different from both the file and the HEAD: .dev-team/FEATURES.md (use -f to force removal)', 'no -f rc=1'. Status still 'RM FEATURES.md -> .dev-team/FEATURES.md'. With -f: '-f rc=0'. Fully stamped, following the manual order: after git mv and a complete marker stamp, `git restore --source=$H0 --staged --worktree -- FEATURES.md` gave 'manual step1 restore rc=0', then `git rm --cached --ignore-unmatch -- .dev-team/FEATURES.md` gave the same error, 'manual step2 git rm --cached (no -f) on FULLY stamped file rc=1', status 'AM .dev-team/FEATURES.md'. Moved but never stamped: 'no -f clean move rc=0'.
```

**Fix specification (refuter's corrected version wins).** In point 6 (:151), change `git rm --cached --ignore-unmatch -- <path>` to `git rm -qf --cached --ignore-unmatch -- <path>`. Explain why: after `git mv` the index holds the pre-stamp copy until the final `git add`, so once step 6 has written anything to a moved file, git refuses to drop it without -f. In point 4 (:149), widen the explanation of -f the same way: any moved file stamped (fully or partly) but not yet added, not only a half-written stamp. Extend the bats per-path rollback test (tests/scripts.bats ~:337) with a moved file that is fully stamped after `git mv`. Assert `git rm --cached` without -f exits non-zero and with -f exits 0, and repeat with a half-written file.

### N2: check-verdict.sh treats an empty verdict.json as valid JSON and exits 1 with eight misleading rule failures

- **Reviewer:** low, `scripts/check-verdict.sh:64`, origin: introduced earlier on this branch.
- **Refuter:** partly confirmed, severity low.

**What is wrong (reviewer).** The validity test is `jq empty "$file"`. jq returns 0 for empty input, whitespace-only input, and a stream of several values, so a zero-byte file — the most ordinary truncation — passes the check, and the script goes on to fail all eight rules and exit 1 ('checked, and it failed'). The header (:38-42) says exit 2 covers 'the file is not valid JSON'; an empty file is not valid JSON. This is the same contradiction problem 5 set out to remove, in the case the round-4 fix did not reach.

**How it goes wrong.** A review run is interrupted while writing .dev-team/verdict.json and leaves it empty. CI runs check-verdict.sh, gets exit 1 and eight 'does not match' lines, and records a checked-and-failed verdict rather than 'the checker could not run'. A bare number or string in the file is also let through to the rules and exits 1 for the wrong reason.

**Reviewer's evidence.**

```text
Probe: `printf '' > empty.json; bash scripts/check-verdict.sh empty.json` -> 'VERDICT-CHECK FAIL: claims list length does not equal checked', '... the five counts do not add up to checked', five 'does not match the number of ... claims' lines, '... claim ids are not unique', rc=1 (header says 2). `printf '' | jq empty; echo $?` -> 0; whitespace-only -> 0; `printf '{} {}' | jq empty` -> 0; `printf '42' | jq empty` -> 0. Proposed replacement verified: `jq -e 'type == "object"'` gives rc=4 on an empty file, 1 on a bare number, 5 on '{not', 0 on '{}'.
```

**Refuter's reasoning.** The core claim is real. `jq empty` returns 0 for an empty or whitespace-only file, so check-verdict.sh goes on to run the rules and exits 1. An empty file is not valid JSON, and the header (:38-42) lists 'not valid JSON' under exit 2. Two parts are wrong. (1) The reviewer says a bare number such as `42` exits 1 'for the wrong reason'. It does not: `42` is valid JSON, and the header defines exit 1 as 'readable, valid JSON, but fails one or more rules', so exit 1 is what the header promises. (2) The proposed replacement, `jq -e 'type == "object"'`, still accepts `{} {}` (two values in one file), because jq -e judges only the last output. A slurp-based test closes that gap. Practical impact is small: the header (:29-32) says to run the schema check first, and check-jsonschema rejects an empty file. Low stays.

**Refuter's evidence.**

```text
`bash scripts/check-verdict.sh empty.json` -> 'empty rc=1 :: VERDICT-CHECK FAIL: claims list length does not equal checked|VERDICT-CHECK FAIL: the five counts do not add up to checked|'. Whitespace-only 'ws rc=1'; '{} {}' 'two rc=1'; '{not json' 'bad rc=2 :: ... is not valid JSON'. `printf '' | jq empty` -> 'jq empty on empty rc=0'. Reviewer's fix: 'proposed jq -e on empty rc=4', 'on num rc=1', 'on bad rc=5', 'proposed on {} rc=0', but "proposed fix on '{} {}' rc=0". Slurp alternative `jq -s -e 'length == 1 and (.[0] | type == "object")'`: 'slurp on empty rc=1', 'slurp variant on two rc=1', 'slurp on bad rc=5', 'slurp on {} rc=0'. `check-jsonschema --schemafile schemas/verdict.schema.json empty.json` -> 'rc=1'.
```

**Fix specification (refuter's corrected version wins).** Replace `if ! jq empty "$file" >/dev/null 2>&1; then` at scripts/check-verdict.sh:64 with `if ! jq -s -e 'length == 1 and (.[0] | type == "object")' "$file" >/dev/null 2>&1; then`. Change the message to "'$file' is empty, not valid JSON, or not a single JSON object"; it still contains 'not valid JSON', so the existing bats assertion keeps passing. Keep exit 2. Update the header's exit-2 sentence to name 'empty, or not exactly one JSON object'. Add a fault note that `jq empty` accepts empty input and several values in one file. Add bats cases beside the invalid-JSON test (tests/scripts.bats ~:1270) for a zero-byte file and for `{} {}`, both expecting exit 2. Do not add a `42` case expecting exit 2 unless the header is also changed to say a non-object counts as could-not-check.

### N3: The broadened test-hygiene patterns still miss the test file's own cd-into-a-folder idiom and the brace form of $MOVE_LEDGERS_MD, while the description claims both forms are covered

- **Reviewer:** low, `tests/scripts.bats:1354`, origin: introduced by fix round 4.
- **Refuter:** confirmed, severity low.

**What is wrong (reviewer).** The delete/create pattern at :1354 needs the command word BEFORE the variable on the same pipe-free segment, so `( cd "$REPO_ROOT" && rm -rf .claude/agents )` and `( cd "$REPO_ROOT" && mkdir -p .claude/agents )` are not caught — and `( cd "$x" && ... )` is the idiom this very file uses for every git step (for example :294-297, :337-352), so it is the likeliest shape for a careless future test. Neither pattern has `\{?` on the MOVE_LEDGERS_MD branch, so `rm -f "${MOVE_LEDGERS_MD}"` and `echo x > "${MOVE_LEDGERS_MD}"` pass, although the comment at :1341-1343 ('either form ... brace or no brace ... either variable') and tests/README.md:427 ('either variable in either written form') say they are covered. `sed -i`, `git -C "$REPO_ROOT" checkout`, and a derived variable (`x="$REPO_ROOT/..."; mkdir -p "$x"`) also pass. Separately, the command-word alternation is not anchored at a word start, so a comment such as '# the platform $REPO_ROOT' fails the test (safe direction, but the comment calls them 'command words').

**How it goes wrong.** A future test written as `( cd "$REPO_ROOT" && mkdir -p .claude/agents )` — the old unsafe test's action in this file's usual subshell style — passes both hygiene tests, and scripts/audit-model-ids.sh then fails on every contributor's machine after the first run, the exact failure finding 11 was about.

**Reviewer's evidence.**

```text
Probe with /usr/bin/grep and the two patterns copied from :1354 and :1360 against a scratch file: caught lines 01-13 and 21-24 (all seven round-3 shapes plus tee -a and a read-only `cp -r "$REPO_ROOT/tests"`); NOT caught: '14 echo x > "${MOVE_LEDGERS_MD}"', '15 rm -f "${MOVE_LEDGERS_MD}"', '16 ( cd "$REPO_ROOT" && rm -rf .claude/agents )', '17 ( cd "$REPO_ROOT" && mkdir -p .claude/agents )', '18 sed -i ... "$REPO_ROOT/README.md"', '19 git -C "$REPO_ROOT" checkout -- README.md', '20 x="$REPO_ROOT/.claude/agents"; mkdir -p "$x"'. Line '23 # the platform $REPO_ROOT is read here' WAS caught by pattern 1. The only cd-into-root lines in the real file today are read-only (:66 tar copy, :1304 branch-hygiene).
```

**Refuter's reasoning.** Reproduced with the grep bats actually uses (a fresh bash resolves `grep` to /usr/bin/grep, BSD grep 2.6.0). The tidy-up guard tests miss four shapes: the brace form of $MOVE_LEDGERS_MD; the `( cd "$REPO_ROOT" && rm|mkdir ... )` idiom this file uses for its own git steps; sed -i; and `git -C`. The gap is also slightly wider than the reviewer says: pattern 1's MOVE_LEDGERS_MD branch watches only `rm`, so `cp x "$MOVE_LEDGERS_MD"` and `mv x "$MOVE_LEDGERS_MD"`, which would overwrite that real file, pass too. The comment says each of the six command words is followed by either variable, and tests/README.md says 'for either variable in either written form', so both over-claim. The false positive on a comment such as '# the platform $REPO_ROOT' happens because 'platform' ends in 'rm'. The real file passes both patterns today, and its only lines that cd into the real repo are read-only, so this is a gap in a guard test, not live damage. Low is right.

**Refuter's evidence.**

```text
With /usr/bin/grep and the two patterns copied from tests/scripts.bats, lines not caught: '14 echo x > "${MOVE_LEDGERS_MD}"', '15 rm -f "${MOVE_LEDGERS_MD}"', '16 ( cd "$REPO_ROOT" && rm -rf .claude/agents )', '17 ( cd "$REPO_ROOT" && mkdir -p .claude/agents )', "18 sed -i '' 's/a/b/' \"$REPO_ROOT/README.md\"", '19 git -C "$REPO_ROOT" checkout -- README.md', '20 x="$REPO_ROOT/.claude/agents"; mkdir -p "$x"', '24 cp x "$MOVE_LEDGERS_MD"', '25 mv x "$MOVE_LEDGERS_MD"'. Caught: lines 01-11 and '23 # the platform $REPO_ROOT is read here'. Against the real tests/scripts.bats both patterns give 'rc=1' (no match). Lines that cd into the real repo: '66:  ( cd "$REPO_ROOT" && tar --exclude=.git -cf - . ) | ( cd "$TREE" && tar -xf - )' and "1304:  run bash -c \"cd '$REPO_ROOT' && bash scripts/branch-hygiene.sh --no-fetch\"". tests/README.md round-4 paragraph: 'for either variable in either written form'.
```

**Fix specification (refuter's corrected version wins).** (1) Allow the brace form on both MOVE_LEDGERS_MD branches (`\$\{?MOVE_LEDGERS''_MD`), and let pattern 1's MOVE_LEDGERS_MD branch use the same command-word list as REPO_ROOT, not only `rm`. (2) Add a third guard test: no line may cd into $REPO_ROOT except the two read-only lines (:66 and :1304), each excluded by exact text with a comment saying why it is safe. That catches the `( cd ... && write )` shape whatever the write command is. (3) Add `sed` and `git` to the command words, and anchor the list at the start of a word: `(^|[[:space:];&|(])(rm|mkdir|cp|mv|tee|touch|ln|sed|git)\b`. (4) Correct the comment above the two tests and the tests/README.md round-4 paragraph to list exactly what is caught, and say plainly that a path reached through a third variable is not. (5) Re-check with a scratch file under /usr/bin/grep, and under GNU grep if available, before committing.

## Leads not upheld

None. All three Codex leads were upheld.

## What was not checked

**Reviewer:** (1) I did not run bats inside the repository, as instructed; the lead's '121 tests, all passing' is taken on trust, and every test I discuss was instead re-run by hand as an equivalent probe (hook payloads, the git rollback walk, the grep patterns, check-verdict, the audit on a tar copy, the wrapped-sentence join). (2) This machine has no GNU grep (only BSD grep 2.6.0, which a fresh bash resolves to), so the hook's marker and id patterns and the two hygiene patterns were exercised only under BSD grep; Linux CI was not exercised, though `\\b` and `\\{?` are standard in both. (3) Whether Claude Code's real Write/Edit tools follow a symbolic link remains a stated limit (finding 6 of round 3) and was not tested. (4) /dev-team-move-ledgers is instructions for the model, not a script, so its rollback was walked by hand through a throwaway repo (three scenarios), not run end to end; the question phase, the (a)/(b)/(c)/(d) sorting and the autopilot.json rewrite were not exercised. (5) The bats `run --separate-stderr` used by the new cwd-'/' test needs a recent bats; I did not check which version CI installs. (6) .claude/HANDOFF.md, orchestrator_prompt.md and the round-4 builder's report the bats comment refers to were not reviewed. (7) I do not know what further context Codex had behind leads A-C beyond the one-line summaries given to me. (8) A double trailing slash on cwd (`<repo>/src//`) still defeats the top-folder match (probe rc=0); the hook's own comment at :250-251 states this on purpose, so it is recorded here rather than as a finding.

**Refuter:** (1) I did not run bats inside the repository, as instructed. Every test discussed was re-run by hand as an equivalent probe in throwaway folders in the session scratchpad, and those folders were deleted afterwards. `git status --porcelain` on the repo was checked in the same step as the deletion; I did not see its result before writing this, so treat the repo as untouched-by-intent, not confirmed. I ran no git command that changes the repository.
(2) Only BSD grep 2.6.0 and ugrep were used, not GNU grep. So Linux CI behaviour of the hook's patterns and the guard-test patterns is assumed, not exercised.
(3) Whether Claude Code's real Write and Edit tools follow a symbolic link is still untested (a stated limit).
(4) /dev-team-move-ledgers is instructions for the model, not a script. Only its git mechanics were walked by hand: the per-path undo, and `git rm` with and without -f on a half-written and a fully stamped moved file. The question phase, the sorting into groups and the autopilot.json rewrite were not exercised.
(5) For lead B, I did not confirm by running a real session that Claude Code resolves a skill's relative `.dev-team/...` path against a subfolder session's cwd. That rests on the hook's own comments and loop-runtime.md:108's relative `mkdir .dev-team/loop.lock`. How often autopilot is really started from a subfolder is unknown.
(6) I only grepped .github/workflows/plugin-audit.yml for check-verdict and check-jsonschema; only the pipx install lines matched. I did not read the whole workflow, so I cannot say how CI calls check-verdict.sh, if at all.
(7) .claude/HANDOFF.md, orchestrator_prompt.md, tests/README.md beyond the cited paragraphs, and the round-4 builder's report were not reviewed.
(8) Two bugs in my own probe scripts gave false results at first: a variable name clash, and `$?` read after a command substitution. Both were fixed and the probes re-run. Only the corrected results are quoted above.
(9) I do not know what further context Codex had behind leads A to C.

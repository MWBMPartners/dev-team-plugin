# tests/

Self-tests for the dev-team plugin's shell surface: `scripts/*.sh` and `hooks/*.sh`. These are
structural + behavioral checks on the plugin repo itself, not on a project the plugin is used in.

## What's here

- **`smoke-structure.sh`** — pure-bash structural smoke test. Confirms the plugin would actually
  deliver its components to an installer: `agents/` has the 5 endpoint files with the required
  frontmatter (`name:`, `description:`, `model:`, `tools:`); no stray `.claude/agents/` dir;
  every `commands/*.md` starts with a `---` frontmatter block containing `description:`;
  `hooks/hooks.json` is valid JSON and every `command` path it references exists on disk and is
  executable; every `skills/*/SKILL.md` exists with `name:` + `description:` frontmatter; both
  `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` are valid JSON. No network,
  no external deps beyond `jq`. Prints `SMOKE OK` and exits 0 on success; prints one or more
  `SMOKE FAIL: <reason>` lines on stderr and exits non-zero otherwise. It also checks that each
  tool the two guards exist for reaches the right guard under `PreToolUse` in `hooks/hooks.json`:
  `Bash` to `${CLAUDE_PLUGIN_ROOT}/hooks/guard-dev-team.sh`, and `Write`, `Edit` and `MultiEdit`
  to `${CLAUDE_PLUGIN_ROOT}/hooks/guard-ledgers.sh`, each by its exact command path, with a
  matcher read as a pattern that must match the whole tool name (an empty or `*` matcher matches
  every tool). The behaviour tests in `scripts.bats` run the guard scripts directly and never go
  through `hooks.json`, so without this a narrowed or missing registration would switch a guard off
  unnoticed. (Until issue #47's round with Codex, finding 5, it only asked whether some matcher
  contained the text `Write`: removing the Bash registration, or narrowing the ledger guard's
  matcher to `Write`, still printed `SMOKE OK`. In throwaway copies, each of those now fails, as do
  both together, a Bash entry pointed at the wrong script, and a ledger matcher of `Writer|Edits`;
  putting the real `hooks.json` back passes.) And every `schemas/*.schema.json` file must itself
  be valid JSON and carry a top-level `$schema`, `title`, and `description` (a structural check only — it confirms a
  schema file is well-formed, not that any particular data file matches it, which is what the
  `verdict-schema` tests in `scripts.bats`, below, are for).

- **`scripts.bats`** — [bats-core](https://github.com/bats-core/bats-core) behavioral tests for
  `scripts/audit-model-ids.sh`, `scripts/audit-ledger-paths.sh` (see its own section below),
  `hooks/guard-dev-team.sh` (including the `.dev-team/config.yml`
  `guard:` toggle matrix and every bypass/allow case, and quoted words and pushes that name no
  branch — see its own section below), `hooks/guard-ledgers.sh` (see its own
  section below), `hooks/check-update.sh` (including the `update-notifier:` config toggle),
  `hooks/sync-branches-check.sh` (including the `branch-notifier:` config toggle),
  `scripts/branch-hygiene.sh`, the `schemas/verdict.schema.json` + `scripts/check-verdict.sh`
  validation tests (see below), text checks on `commands/dev-team-move-ledgers.md`, on the
  canonical ownership sentence in `conventions.md`, and on the repository-instructions rule and the
  places that carry it (all three described in their own sections below), and
  two closing tests on this file itself (see "This file's own hygiene", below). Every test that
  needs an isolated `.dev-team/config.yml` or a directory with no `.dev-team/autopilot.json` runs
  from a fresh per-test scratch directory (`$SCRATCH`, never the repo root), so the suite never
  leaves stray files behind.

  **No test in this file writes to, or deletes anything from, the real repository** (`$REPO_ROOT`).
  This was not always true — see "Fault fixed (finding 11)" below — and two tests at the very bottom
  of the file now grep the file itself to keep it that way.

  **Fault fixed (issue #41, Codex round 3, finding 11):** this file used to inject failures straight
  into the real repository — a dated-model-id file written under `tests/`, a real
  `.claude/agents/` directory created, a fixture written under
  `skills/dev-team-orchestrator/references/` — and `teardown()` ran
  `rm -rf "$REPO_ROOT/.claude/agents"` unconditionally after **every single test**, whether or not
  that test had created anything to clean up. A contributor who keeps their own `.claude/agents/`
  folder in their checkout (nothing stops that — `.claude/` is only partly tracked; see
  `git ls-files .claude`) would have had it silently deleted the first time they ran `bats
  tests/scripts.bats`. The fix is a helper, `make_tree()`, defined near the top of the file: it
  copies the whole repository (minus `.git`) into `$SCRATCH/tree` with `tar`, and every test that
  needs to inject a fault now calls it first and runs the script being tested against `$TREE`
  instead of `$REPO_ROOT`. Both audit scripts `cd` to their own script's parent directory before
  doing anything else, so running the copy's script audits the copy — the real repository is only
  ever **read** (to make the copy), never written to or deleted from, and there is nothing left to
  clean up beyond the `$SCRATCH` removal every test already gets from `teardown()`.

### `scripts/audit-ledger-paths.sh` — the stale-ledger-path audit

This is the plugin's self-check for issue #41: it fails if any skill, command, agent or README
line still tells a writer to put one of the seven dev-team ledgers (`PROJECT.md`, `FEATURES.md`,
`SECURITY.md`, `VERIFICATION.md`, `verdict.json`, `MIGRATION.md`, `HANDOFF.md`) at the old
top-level location instead of `.dev-team/<name>` with its ownership marker. It runs the same
`note()` / `AUDIT OK`-style pattern as `audit-model-ids.sh`, over `skills/`, `commands/`, `agents/`,
`hooks/`, `README.md` and `CONTRIBUTING.md` only — never `CHANGELOG.md` (released history is never
rewritten), `.claude/` (this repo's own working notes), or `tests/` (fixtures may deliberately
contain the old phrasing as the thing being tested). Seven checks, spelled out in the script's own
header comment: (A) `conventions.md` still states every `.dev-team/` path and the "Where the
plugin writes" heading; (B) each ledger's own schema-defining reference file states its path and
marker; (C) a "repo root" / "repo-root" / "sibling to" line that still names a ledger once every
correct `.dev-team/<name>` mention on that line is stripped out; (D) a backticked or quoted anchor
with no `.dev-team/` prefix (e.g. `` `PROJECT.md#Backlog` ``); (E) the exact legacy phrases used
before this change ("stable repo-root", "at the repo root", "Check the repo root", "from repo
root") on a line where THAT line, or the line just before or after it, still names a ledger with no
`.dev-team/` prefix (see "Finding 10", below, for why it looks at neighbouring lines rather than
just the one line); (F) the retired `<!-- dev-team-schema:` marker text appearing outside a line
that explains it as legacy; (G) README.md only — a skill description line (one starting
`**Purpose.**`, `**Modes.**`, `**Artifacts.**` or `**Cold-resume.**`) that still names a ledger with
no `.dev-team/` prefix. Any line containing the phrase "legacy root" is exempt from C, D, E and G —
that phrase is the one allowed way to talk about the old location in running prose — and check F is
exempt on the wider word "legacy" alone. Prints `LEDGER-PATHS OK` and exits 0 on success, or one or
more `LEDGER-PATHS FAIL: <reason>` lines on stderr and exits 1. **What it cannot do:** it checks the
exact phrases and patterns above, in the plugin's own files only — a stale instruction worded some
genuinely new way can still pass, and it never looks at a user's project.

**Finding 10 (issue #41, Codex round 3):** check E used to fire on the legacy repo-root phrases
ALONE, with no test at all for whether a ledger was actually being talked about — so it rejected
ordinary, unrelated sentences that merely happened to contain a phrase like "at the repo root" (for
example a sentence about config files, with nothing to do with any dev-team ledger). Check E now
only fires when a bare ledger name shows up on the SAME line as the phrase, or the line immediately
before or after it (a wrapped sentence often puts the name on the line above), once every correct
`.dev-team/<name>` mention has been stripped away first.

The bats tests for it, each run against a throwaway COPY of the repository under `$TREE` (see
"Fault fixed (finding 11)", above — never against the real repository): (i) it passes on the clean
repo (this one test still runs the real script, read-only); (ii)-(vii) one file injected under
`skills/dev-team-orchestrator/references/.tmp-ledger-audit.md` per negative check, each built to
trip exactly one of C, D, E or F and asserting that check's own label (`LEDGER-PATHS FAIL: C:`, and
so on) appears in the output — check C ("Put `` `HANDOFF.md` `` sibling to package.json."), check D
("See `` `SECURITY.md#Findings` `` for the full register."), check E in its now-fixed form — one
test confirming the harmless "Config files used to live at the repo root before this project
reorganised its layout." sentence now PASSES the audit (it used to be asserted as a failure — see
"Finding 10" above for why that was backwards), and a second confirming E still fires when a bare
ledger name sits on the line just before the phrase ("The documentarian keeps `` `PROJECT.md` ``" /
"at the repo root.", on two separate lines) — and check F ("This file still uses
`<!-- dev-team-schema: 1.0 -->` in one place." — the old marker text with no word "legacy" nearby).
**Check G** has two tests of its own, added in round 4 after a stand-in verification found it had
shipped with none (it had been riding along only on the "passes on the clean repo" test, which would
stay green even if a later edit broke G outright): one appends a `**Modes.**` line naming a bare
ledger to a throwaway copy of `README.md` and confirms `LEDGER-PATHS FAIL: G:` fires; the other
appends the identical line with the ledger named as `.dev-team/PROJECT.md` instead and confirms the
audit stays clean.

Fault found by a later reading of these tests: the two negative cases that used to exist here
injected a single sentence — "The documentarian writes `` `PROJECT.md` `` at the repo root." — that
trips BOTH check C (a "repo root" line naming a bare ledger) and check E (the exact legacy phrase
"at the repo root") at the same time. A test asserting only `LEDGER-PATHS FAIL` (with no check
letter) passing proved that *one* of the checks fired, never *which* — so a change that broke check
C while check E still fired, or the reverse, would pass unnoticed. Check F, meanwhile, had no test
at all. Each sample above was run once through the real script from a scratch copy of the repo
before being written into this file, to confirm it trips only its own check and no other.

### `commands/dev-team-move-ledgers.md` — text checks on the migration command (findings 1-4)

`dev-team-move-ledgers.md` is instructions for the model to follow, not a script — there is nothing
to run it against, so its tests confirm the file's wording still says what four Codex round 3
findings required, plus a handful of tests on the real `git` behaviour those instructions rely on
(each built in its own throwaway repo under `$SCRATCH`, never `$REPO_ROOT`):

- **Finding 1** (the mixed group, "(d)", used to be checked AFTER the look-alike group, "(b)", so a
  real product document with the plugin's own records appended to it could match (b)'s shape test on
  its first record and be offered for moving and stamping whole): a test confirms (d) is now checked
  before (b), by line number; a second confirms the old "Checked before (c)" wording (which never
  mentioned (b)) is gone; a third confirms the report now uses the two-way wording ("either an old
  ledger with no marker... or a project document with records added...") instead of the old one-way
  "needs a person to cut it by hand".
- **Finding 2** (a legacy root file git ignores looks clean to `git status`, but `git mv` fails on it
  partway through a move): a test confirms the file now runs `git ls-files --error-unmatch` as a
  preflight check; a git-behaviour test proves the underlying fact — an ignored, committed-gitignore
  file passes the clean-tree check yet is refused by `git ls-files --error-unmatch`.
- **Finding 3** (`git reset --hard` can destroy an edit some OTHER program made to the working tree
  while the command's own questions were being asked): a test confirms every remaining mention of
  `reset --hard` sits inside a sentence explaining it was rejected, never as a live instruction; a
  second confirms the working tree is checked again after the questions are answered; a
  git-behaviour test proves the replacement mechanism — restoring only the specific paths this
  command touched (`git restore --source=<H0> ...` plus a targeted `git rm --cached`/`rm -f`/`rmdir`)
  undoes the command's own rename and edit while leaving a foreign edit to an unrelated file alone.
- **Finding 4** (a declined pointer sentence can write an ignored `.dev-team/config.yml` that
  `git add` then refuses, leaving an uncommitted file `git status` cannot even see): a test confirms
  the ignore check now names `config.yml`; a second confirms it skips paths that are already tracked
  (refusing those would be wrong — a tracked file accepts `git add` even when it matches an ignore
  pattern); a git-behaviour test proves both halves of that fact in one throwaway repo.
- **Round-4 finding — a batch rollback aborts entirely if the list carries a path that never
  existed** (the target of a `git mv` that itself failed, or, on every move, the move's own
  `.dev-team/<name>` new path, which can never have existed at H0): the command now checks each
  listed path against H0 (`git cat-file -e <H0>:<path>`) and restores or removes it on its own,
  rather than naming every path in one `git restore`, so a single ill-fitting path can no longer
  cancel the undo of the rest. A git-behaviour test reproduces the OLD batch failure first (one
  `git restore` naming a never-existing `.dev-team/<name>` fails outright — "did not match", nothing
  restored, not even the paths that would have worked alone) and then proves the per-path fix undoes
  the same three paths cleanly.
- **Round-4 finding — a stamp that fails partway made the rollback refuse for the wrong reason**: a
  moved file's recorded blob id is taken right after `git mv` and only replaced once the marker stamp
  in step 6 finishes; if that write fails partway, the command now clears the path's recorded id
  before the rollback runs, so the "no id yet" exemption in point 3 covers it instead of a stale id
  being compared against half-written content and refusing to undo anything. This is a text-only fix
  (there is no separate script to run it against) — covered by reading the walk-through in the
  command's own text, since the pinned git-behaviour test above already exercises the per-path
  restore machinery point 3's fix depends on.
- **Finding N1 (round-4 stand-in verification) — the by-hand recovery text was missing the `-f` its
  own reasoning needed**: point 4's text explains why `git rm -qf --cached --ignore-unmatch` needs
  `-f` — after `git mv`, a moved file's index entry keeps `git mv`'s pre-stamp copy right up until
  step 9's `git add` finally replaces it, so once step 6 has written anything to that file, whether
  the write finished cleanly or died partway, the index no longer matches both the file on disk and
  HEAD, and a plain `git rm --cached` refuses. Point 6's manual-recovery text — the one command a
  person is handed precisely when the AUTOMATIC undo has already refused, which a half- or
  fully-written stamp can easily coexist with — used to give the same command WITHOUT `-f`, so the
  one recovery path a person is handed could fail in exactly the case this whole section exists to
  recover from. Both texts now say `-f`. Two new git-behaviour tests prove the underlying fact both
  texts rely on, each in its own throwaway repo: `git rm --cached` (no `-f`) on a moved file refuses
  once ANYTHING has been written to it after `git mv` — proven once for a FULLY stamped file and once
  for a HALF-WRITTEN one — and `git rm -qf --cached` (with `-f`) succeeds in both cases. A text check
  confirms both point 4 and point 6 say `-qf --cached --ignore-unmatch` (count at least 2).

### `conventions.md` — the canonical ownership sentence (finding 8)

One sentence — "Every record file the dev-team suite writes for itself lives in `.dev-team/`..." —
is meant to read identically in `conventions.md` (its canonical home) and eight other files that
quote it (seven on a single unbroken line, plus two more that wrap it across several lines in their
own source markdown). One test asserts the exact sentence appears, byte-for-byte, in exactly 7 files
under `agents/`, `commands/` and `skills/`; that the sentence's old, too-broad wording ("Every file
the dev-team suite writes for itself...", which read as covering `autopilot.json`, `config.yml`,
`loop.lock/` and `.gitignore` too, none of which can carry a line-2 marker) is gone everywhere; and
that the rule's own old phrase ("any file in the Shared artifacts table") survives only inside the
one deliberate "*Earlier wording:*" footnote that explains, on purpose, why the rule was narrowed —
never anywhere else, where it would read as a live instruction again. A second test (added round 4,
after a stand-in verification found the first test structurally blind to these two files — a wrapped
copy never matches a single-line literal search at all) joins each of `gap-scoring-rubric.md` and
`migration-plan-protocol.md`'s lines with a single space before comparing, the same transformation a
markdown renderer applies to a wrapped paragraph, and checks the sentence still matches word for word.

### The repository-instructions rule — meaning, not just words (issue #47)

The rule "Repository instructions and normative documents" (`conventions.md`, first bullet of
"Shared discipline") tells every agent to follow a project's own instruction files and the
standards they name only as they were copied when the run started, and only to add work or choose
between style defaults — never to remove or loosen a check, a gate, a confirmation or a safety
rule. Ten tests guard it, the `handoff-file` switch that came with it, and the starter config file.
This is the sixth set: each earlier set passed a change that weakened the rule — headings only;
then a few key sentences (words ADDED passed); then brief fields by their opening words; then
phrases inside the places that write `.dev-team/HANDOFF.md`; then, with whole passages pinned, text
added NEXT to a pinned passage (a paragraph after a list, a new bullet before the next one, words
appended to a neighbouring bullet).

**The pinned copies** live in `tests/fixtures/pinned-instructions.txt`, one record per passage,
and are checked three ways. Every comparison first joins wrapped lines (`join_words` turns every run
of spaces and line breaks into one space), so line breaks never matter but every word does.

- **Sections** (`@@section <file> | <heading>`): the text from that heading to the next heading
  outside a ``` code fence (`section_body`). Anything added anywhere under the heading fails.
- **Items** (`@@item <file> | <next words>`): a list item or paragraph inside a larger section,
  compared whole, and the next non-blank line after it must start with the recorded words
  (`item_and_next`) — so a paragraph added straight after it fails too.
- **Fields** (`@@field <file> | <count>`): every "Instruction snapshot" list item in a brief
  template must be word for word the pinned field (`snapshot_items`), and there must be exactly
  that many — so words added after its closing bracket, on the same line or the next, fail.

`check_pinned_kind` fails unless it checked exactly the expected number of records of its kind, so
a slip in reading the fixture cannot pass quietly. Changing one of these passages on purpose means
changing its record in the fixture too — which makes a change to a safety rule visible in review.

1. **Pinned sections** — 30 sections: in `conventions.md`, "Repo config & feature toggles",
   "Dry-run / plan-preview", "Cold-resume" (a resume reuses the run's snapshot), "Auto-handoff" and
   "Shared discipline" (the whole rule and what follows it); in `config-and-toggles.md`, "Repository instruction files and these switches" and "How
   skills and hooks load it"; in the README, "Cross-cutting behaviors" and both upgrade notes; the
   orchestrator's setup, checker and checkpoint steps; autopilot's rehydrate, run-one-cycle and
   RECORD steps, its "what carries over" list and its bootstrap; ci-medic's per-PR loop and safety
   rules, its one-snapshot-per-run section (a `/loop` is one run; every pass puts the starting branch
   back) and its remediation step 2; the documentarian protocol's PROJECT.md layout, brief and
   "when invoked" list; the handoff template; the task-brief and checker templates; and
   `/dev-team-move-ledgers`' first two sections.
2. **Pinned items** — 11: the scribe's one-line prompt, conventions point 5's legacy-file bullet,
   autopilot's `instructions_snapshot` example, and the run-start line in each of the eight skills
   with their own front end.
3. **Pinned fields** — the snapshot field in all 13 brief templates (twice in the red-team
   protocol).
4. **The direction rule is written identically** in `conventions.md` step 8, in
   `config-and-toggles.md`'s introducing paragraph (nothing else in it) and at the end of the
   README's rule bullet.
5. **Replaced wording and machinery is gone** — the unsafe old precedence wordings and label, the
   trusted-base method, the third round's snapshot machinery (`git hash-object`, a seal, a
   `## Instruction snapshot` section), guessed provenance ("Provenance first", "whose upstream is a
   branch", "provenance cannot be established"), "unless those instructions ask", and the first
   snapshot layout (`snapshot/pr-`, `pr-<n>`, "into the folder, keeping their paths").
6. **Every file in `agents/` carries the exact shared sentence, once.**
7. **No agent still says it has context from the brief alone.**
8. **The README's stated number of cross-cutting behaviours matches its bullets.**
9. **`handoff-file`: `off` means no `.dev-team/HANDOFF.md` at all, and only an explicit ban turns
   it off** — key sentences, the old "say where notes live" trigger gone, the config row, a
   commented-out starter key.
10. **The starter config file** — nothing written out but `version: 1`; all 18 settings commented
    out showing their defaults; `init` writes only chosen keys; `show` tags a commented-out key as
    the built-in default and warns about an old fully written-out file.

**How they were proven** (on 28 September 2026). Each edit was made in a throwaway copy of the
working tree outside the clone, the #47 test group was run against the copy with a writable
`TMPDIR`, and the copy was deleted — never touching the repository itself. Every edit below made
the named test fail.

*The stand-in review's own edit scripts* (m6 and m7 adapted, because the text they targeted was
replaced in this round; the others run unchanged):

| Edit | Test that failed |
|---|---|
| m1 a paragraph added after the orchestrator's checkpoint list | 1 |
| m2 a new "Exceptions" bullet added before "Evidence, not claims" | 1 |
| m3 an exception appended after the debate brief's snapshot field | 3 |
| m4 a paragraph added after ci-medic's snapshot paragraph | 1 |
| m5 a paragraph added after autopilot's rehydrate check | 1 |
| m6 (adapted) an unreadable base falls back to the checked-out text | 1 |
| m7 (adapted) the orchestrator's setup bullet moves the snapshot into the project, after a scout | 1 |
| m8 the dry-run section puts the snapshot inside the project | 1 |
| m9 the scribe may refresh the snapshot folder | 2 |
| m10 a new README bullet after the rule bullet | 1 and 8 |
| m10b an exception appended to the end of the README's next bullet | 1 |
| m11 iterate's run-start line changed | 2 |
| m12 a "10. Exceptions" step added to the rule | 1 |
| m13 a line added inside the task brief's snapshot field | 1 and 3 |

*Further edits:*

| Edit | Test that failed |
|---|---|
| A same-repository branch pushed by a collaborator counts as the user's own | 1 |
| The snapshot no longer taken before autopilot's run branch; autopilot's bootstrap creates the branch first | 1 (each) |
| The run id is just the date; the folder made with `mkdir -p`; the manifest loses the repository path | 1 (each) |
| An unreadable folder falls back to the project's files | 1 |
| The "plain `git push` while on `main` passes" limit deleted; "the only enforcement the plugin itself provides" overstated | 1 (each) |
| Settings taken from the pull request's base; rule 9 said to decide whose instructions count | 1 (each) |
| ci-medic copies a pull request into the shared snapshot folder | 1 |
| The README's "start from your own branch" warning deleted | 1 |
| The limit about the project's own scripts deleted | 1 |
| A line added inside iterate's snapshot field | 3 |
| An exception paragraph added after the docs skill's run-start line | 2 |
| Autopilot's example run id made non-unique | 2 |
| The scribe allowed to write a pull request's snapshot sub-folder | 2 |
| Codex's exception sentence appended to the checkpoint line | 1 |
| An "Exceptions" bullet added at the end of "Auto-handoff" | 1 |
| An exception appended to the README's "Upgrading from 1.5" note | 1 |
| One agent's shared sentence changed back to "from the trusted repository" | 6 |

Every earlier round's edit whose text still exists was run again against these tests and still
fails one — 76 in all: 27 from Codex's round, 26 from the third round, 15 from the first and second
rounds, and the 8 starter-file edits. The rest targeted text this round replaced (guessed provenance and
its wording) and are covered by the edits above.

*Codex's review of `748e87c..42bd45e`* (fourth round) — each edit in a throwaway copy of the
tree, as above:

| Edit | Test that failed |
|---|---|
| ci-medic's pull-request copies put back in `snapshot/pr-<n>/` | 1 and 5 |
| The orchestrator takes a new snapshot unconditionally again (the RESUME exception deleted) | 1 |
| The Cold-resume section lets a resume "take a new one" | 1 |
| migrate's run-start line takes a new snapshot when the check fails | 2 |
| ci-medic's per-pass snapshot ("the checkout the pass starts on") put back | 1 |
| The "put the starting branch back" step deleted from the watch protocol | 1 |
| A failed check in a later pass takes a new snapshot | 1 |

Every earlier round's edit was also run again against the fourth round's text (at `f9eb396`): of
the 75 from Codex's, the third and the first two rounds whose text still exists, all 75 still fail
a test, and so do all 33 of the stand-in round's edits above whose text still exists. Thirty-three
more no longer apply, because the text they targeted was replaced — in earlier rounds, or in this
one (the hook's old "a plain `git push` made while on `main` passes", the old `snapshot/pr-<n>/`
layout, and the run-start line's old wording); this round's own edits above cover those places.

*The stand-in review of `42bd45e..b39f40d`* (fifth round) — each edit in a throwaway copy of the
tree, as above. The passages changed on purpose this round (ci-medic's run record and pass-report
line, and the short resume wording) had their pinned records rewritten from the files, and every
difference between the old and new records was checked word by word to be exactly the added
wording:

| Edit | Test that failed |
|---|---|
| The watch protocol's new step 4 ("mark a pull request's branch in the run record") deleted | 1 |
| The repository's path taken out of the `ci-medic run <run-id> — started on …` line | 1 |
| "(a run recorded before 1.6.0 has none: see step 1)" taken out of ship's run-start line | 2 |
| The same wording taken out of the Cold-resume section | 1 |

**What these cannot catch:** they check wording, word for word, in the right place. They cannot
tell whether an agent obeys the rule when it runs — for example whether a lead really copies the
files before spawning anyone. Nothing enforces the rule except where one of the two guard hooks
happens to cover it (`conventions.md`, step 1, "What this cannot do"). A passage outside every
pinned section and item can still change unnoticed. And pinning means any deliberate change to one
of these passages must change its record in the fixture too — on purpose, so that a change to a
safety rule is visible in review.

### `hooks/guard-dev-team.sh` — quoted words, other spellings, pushes that name no branch, and speed (issue #47)

Codex's review of `748e87c..42bd45e` (finding 4) showed the Bash guard let through
`git push origin 'main'` (it understood only double quotes) and a bare `git push` made while on
`main` (it matched text, and a bare push names no branch). The hook now also reads the command the
way the shell reads the ordinary spellings of a word — quotes and backslashes taken away, bash's
escapes inside `$'…'` worked out, a quoted multi-word argument kept as one word, and a command
string given to `sh -c` / `bash -c` (after any options and a `--`) or `eval` read as well — and,
for a push that names no branch, asks git in the folder the command runs in where it would push.
The stand-in review of `42bd45e..b39f40d` (the fifth round) found more it let through, found it
could be too slow to be waited for, and planted 30 faults in a copy of it, 8 of which no test
noticed. Thirty-nine tests now, every one with `DEV_TEAM_GUARD=1` unless it says otherwise, in a
throwaway git repository under `$SCRATCH` with the machine's own git settings shut out (`HOME`,
`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM`), so a `push.default` on the machine running them
cannot change a result:

- **Quoting** (blocked): a single-quoted `'main'`; `\main`; a quoted or escaped `git` (`'git'`,
  `"git"`, `\git`, `g'i't … ma"in"`); single-quoted refspecs (`'HEAD:refs/heads/main'`,
  `HEAD:'main'`, `--force origin '+main'`); a push to `main` inside `bash -c '…'`, `sh -c "…"` or
  `eval "…"`. **Allowed:** quoted text that only mentions `main` as part of a word or without a
  push (`git commit -m 'push to main'`, `'maintenance'`, `'feature-main'`, `echo 'the main
  branch'`, `$'\x6d\x61\x69\x6e\x74'`).
- **Other spellings** (fifth round, blocked): `$'\x6d\x61\x69\x6e'`, `$'\155ain'`, `$'main'`,
  `$'ma\x69n'`, `HEAD:$'\x6d'ain`; a brace list (`{main,feature}`, `{'main',x}`,
  `HEAD:{main,x}`); a push written out for a shell to read from its standard input
  (`echo 'git push origin main' | sh`, `… | bash`, `bash <<< '…'`, a quoted heredoc into `bash`);
  the command string after `-c` found past `--`, `-o pipefail`, `--norc` and `-lc` (and a script's
  own `-c` argument is not a command string). **A stated over-block, pinned:** text that only
  spells out a push to `main` (`echo 'git push origin main'`, `git commit -m 'fix: push to main'`)
  is refused, because the check on the text as written reads through quotes.
- **A long command** — 2,000 simple commands, or an 800-line heredoc — is still read to the end: a
  push to `main` at the very end is refused, a harmless one allowed.
- **Speed** (fifth round), judged by the processor time the hook uses (see below): a 10,000-line
  heredoc is read to the end under 4 seconds (the push to `main` after it refused, the harmless one
  allowed), a 129 KB `git commit -m` message under 3, and a `git add` naming 5,000 files under 8;
  more than 10 pushes in one command are refused with a message asking for it to be split (counting
  pushes inside a `bash -c` string) and 10 are checked; a stand-in `git` that takes 30 seconds,
  with a 1-second limit, is refused within seconds — and a limit of 99 is ignored (the built-in 20
  seconds still refuses it).
- **No branch named** (blocked, message names the branch): a bare `git push` on `main`;
  `git push origin`, `-u origin HEAD`, `origin @`, `2>&1`, `command git push`; `git -C repo push`
  from outside; the hook input's `cwd` pointing at the repository (and, the other way round, a
  `cwd` elsewhere allows it); a branch tracking `main` under `push.default=upstream`, set in the
  repository or with `-c` on the command; `push.default=matching`, `--all`, `--mirror` and a
  `remote.origin.push` naming `main`, all from a feature branch; git's matching refspec `:` and
  `+:`, quoted or not, on the command line or as `remote.origin.push` (fifth round); a named branch
  that `remote.origin.push` (exact, with `+`, or a `*` pattern) or `push.default=upstream` sends to
  `main` (fifth round — and `feature:main`, `HEAD:refs/heads/main`, another branch's refspec, or
  none, which git does not apply, are allowed). **Allowed:** a feature branch with no upstream,
  `HEAD` on a feature branch, upstream to `feature`, `push.default=nothing`, `--tags`.
- **The documented limits** (allowed, pinned so the docs stay true): not a git repository, an
  earlier `cd` (also inside `( … )`), `GIT_DIR=…` as a prefix, through `env`, or exported
  earlier, `env -C <dir>` / `env --chdir=<dir>` / `env -iC <dir>` (fifth round: treated exactly
  like a `cd`; plain `env` is still worked out, and a named `main` still refused), and a detached
  HEAD.
- **The reader's own markers** (fifth round): `git --work-tree @@SEP push` (and `@@REDIR`, `s`,
  `r`, `vPM`, `w`) on `main` is refused — the reader's lines each start with a letter saying what
  they are, so no word can be taken for one.
- **One test per planted fault that used to survive** (fifth round): three `eval` levels deep
  read, four not (nesting depth 3); the rule on the joined words (`cd . && git push origin
  ma"i"n`); `remote.pushDefault` and `branch.<name>.pushRemote`; `--git-dir=` and `--work-tree=`
  passed to git; `/usr/bin/git`; `\"` inside double quotes; a bare push on `master`. And three
  found by this round's own sweep (a fault planted to undo each fifth-round fix): an `eval` string
  read when no other word is `git` (`eval 'git push origin ma\in'`); a brace list quoted inside
  (`{ma'i'n,x}`, hidden from the text as written); and more than 10 pushes refused before git is
  asked anything (a stand-in `git` that never answers must not turn the refusal into a time-out).
- **The hook off** (no active run, no `DEV_TEAM_GUARD`): a bare push on `main` is allowed.

**Proof:** each fifth-round test was run against the hook before its fix and failed there (the
commit messages give the first failing case). The reviewer's own fault-planting
driver, re-typed after a machine restart lost the original and checked by re-running it on the
pushed tree (it gave the review's own result: 21 caught, 9 survived), and a copy with each fault
re-expressed where the rewrite changed the code it targets, plus 13 faults that undo each
fifth-round fix: see `.claude/HANDOFF.md` for the result. Two planted faults cannot be caught by
any test: M23 (the early return for a detached HEAD removed) changes nothing, because with no
current branch every later step prints nothing anyway; and N02 (the push cap removed from the pass
that works the pushes out) is a backstop behind the count taken first, which sees every push. All
39 tests pass under Homebrew's bash 5, the Mac's own `/bin/bash` 3.2, and in an Ubuntu 24.04
container (mawk).

**The speed tests judge processor time, not the clock.** The guard refuses a command whose
checking runs past its 20-second limit, so on a machine starved of processor time — during this
round the Mac's load average reached 300 to 430 on eight processors, largely from other work — a
check that uses 2 seconds can take 17 on the clock and be refused. The clock-based first version
of these tests failed that way. Now: more processor time than the bound fails; a run the hook
allowed within the bound passes; a run the hook stopped at its limit within the bound is SKIPPED
with a message (bats prints `# skip`), never counted as a pass, because a slow reader stopped early
looks the same. A skip means "run it again when the machine is quieter". In the first build of
this round, failures of the clock-based tests were put down to load; the real cause was a bash
suffix removal, `${word%sh}`, whose time grows with the square of the word's length — so check the
processor time before blaming the machine.

**What these cannot catch:** the hook reads the text of a command before it runs and does not run
the shell; it cannot see a branch held in a variable or a default value, one made by a command
substitution, a push from a script or an alias, or a protected branch other than `main` and
`master`, and without `jq` it only scans the raw input. Its header comment lists the limits known.

### `hooks/guard-ledgers.sh` — the ledger guard's test matrix

This hook (PreToolUse on `Write`/`Edit`/`MultiEdit`) is the second, independent layer behind the
written rule in `conventions.md`, "Where the plugin writes, and the ownership rule": it stops a
mistaken write into a project's top-level file before it happens. It checks two separate things,
and the test matrix is split the same way:

- **Rule 1 (marker content, ledger file name, written outside `.dev-team/`) — on all the time
  unless `guard: off`.** Fires only when all three hold: the content carries the marker on one of
  its first three lines; the target's file NAME (case ignored) is one of the seven ledger names
  plus `README.md`; the resolved path lands outside `.dev-team/`. Cases cover: a `Write` whose
  content carries the dev-team marker on line 2 aimed at a top-level path with a ledger name is
  denied; the identical content aimed at a `.dev-team/` path (relative or absolute) is allowed; a
  marker further down the file (past the first three lines) does not trip the check; a plain file
  with no marker is never blocked, whatever the path; a ledger-named file elsewhere in the tree,
  outside `.dev-team/` (`docs/FEATURES.md`), is still denied; **this plugin's own test fixture,
  `tests/fixtures/verdict.sample.json`, is never blocked even though its real content starts with
  the marker on line 2** — its file name is "verdict.sample.json", not "verdict.json", so it fails
  the name test and Rule 1 never fires (see the fault note in the bats file); marker content aimed
  at any other non-ledger file name (`notes/plan.md`) is likewise allowed; `guard: off` in
  `.dev-team/config.yml` allows a ledger-named file even with a genuinely active run
  (`.dev-team/loop.lock/` actually present — see the fault note below); both the spaced and
  compact-JSON forms of the `verdict.json` marker (`"dev-team": "ledger=..."` and
  `"dev-team":"ledger=..."` with no spaces at all) are recognised. **`README.md` cases (fault found
  by a stand-in review):** the plugin's own fixed `.dev-team/README.md` carries the marker too
  (conventions.md, "Where the plugin writes", point 7), and `README.md` was missing from Rule 1's
  name list — so that marker-bearing text, written to a project's top-level `README.md` by mistake,
  used to pass straight through and would have overwritten the project's real README. Three cases
  check this: the readme marker on a top-level `README.md` is denied; the identical content at
  `.dev-team/README.md` is allowed; and, to prove `README.md` was deliberately left OFF Rule 2's
  separate name list (Rule 2 also fires on a bare record id with no marker, and an ordinary project
  README mentioning something like "F-001" in passing must never be blocked for that), editing
  `README.md` to add "see F-001" is still allowed even with `.dev-team/loop.lock/` present.
- **Rule 2 (a write to a top-level ledger name during an active run) — only while
  `.dev-team/loop.lock/` exists, `guard: on` is set, or `DEV_TEAM_GUARD` is set.** Cases cover: a
  **committed** `.dev-team/autopilot.json` present with no lock never triggers it, on its own,
  against a plain edit of `HANDOFF.md` or `FEATURES.md` — that is deliberate, because some real
  projects keep `autopilot.json` committed in git, so its mere presence must never be read as "a
  cycle is running"; with `.dev-team/loop.lock/` actually present, a write to a top-level
  `SECURITY.md`/`FEATURES.md`/`PROJECT.md` carrying the dev-team marker or a record id (`F-001`,
  `FG-012`, `B-004`, …) is denied, while the project's own edit to the same file with no marker and
  no ids goes through; `SECURITY.md` in `.github/` or `docs/` is covered too (GitHub's own
  security-policy locations); a lower-case `security.md` or mixed-case `Features.md` is caught the
  same as the canonical spelling, because some filesystems (macOS, by default) treat them as the
  same file on disk; a `MultiEdit` is checked across every one of its edits, not just the first;
  `guard: on` forces Rule 2 on with no lock file present, and `guard: off` wins even with a lock
  file present.

  **Record id width (round-4 stand-in verification, finding A).** Fault fixed: the id pattern used
  to require EXACTLY three digits followed by a word boundary right after the third one, so a
  fourth digit broke the match — `F-1000` walked straight past Rule 2 while `F-999` on the very same
  edit was refused. Nothing caps a project's record counter at 999, ids are never reused, and the
  verdict schema already allows "at least three digits". The pattern now matches three OR MORE
  digits. Two cases, with the lock present: `F-1000` in an `Edit` to the top-level `SECURITY.md` is
  still caught; `F-12` (two digits) still is not, pinning the pattern's lower bound — the plugin
  always zero-pads to at least three digits, so a shorter form is far more likely to be a person's
  own text.
- **Path normalisation (both rules).** Fault found by a later reading of the hook: stripping a
  leading `<cwd>/` (or `$PWD/`) and a leading `./` was done ONCE each, which is one pass, not a
  resolution — a path spelled with `.` or `..` segments walked straight past both rules.
  `.dev-team/../SECURITY.md` used to be let through as if it were inside `.dev-team/` (a literal
  string match on the prefix, ignoring what the path actually resolves to); with
  `.dev-team/loop.lock/` present, an `Edit` adding `F-001` to `././SECURITY.md` used to be allowed,
  because only the first `./` was ever stripped. The hook now resolves the path lexically — splits
  on `/`, drops empty and `.` pieces, and for each `..` removes the piece before it — before either
  rule looks at it. Cases cover both rules: `.dev-team/../SECURITY.md` (Rule 1, marker `Write`)
  resolves to the top level and is denied; `.dev-team/./FEATURES.md` (Rule 1, marker `Write`) still
  resolves inside `.dev-team/` and is allowed; `././SECURITY.md` and `a/b/../../PROJECT.md` (Rule 2,
  `Edit` with a record id and `loop.lock/` present) both resolve to a bare top-level ledger name and
  are denied. A case with an absolute `file_path` under the test's own scratch directory and a
  matching `cwd` field confirms the hook resolves paths against the session's own working folder
  from the hook's JSON input, not the test runner's process directory.

  **Fault found by a stand-in review of the round above, on the resolver's ALLOW direction:** two of
  the cases that were meant to prove resolution works did not actually depend on it. The old
  `docs/../FEATURES.md` case (now simplified to plain `docs/FEATURES.md`, since the resolved `..`
  makes no difference to it — that file's base name is `FEATURES.md` either way, sitting outside
  `.dev-team/` whether or not `docs/..` is ever walked back out) and `.dev-team/./FEATURES.md`
  (whose raw text already starts with `.dev-team/` before any resolution happens) both passed on the
  hook as it stood **before** path resolution was added (commit `0a2f286~1`), so neither one could
  have caught a broken resolver. The old `docs/../FEATURES.md` test is replaced with a new one:
  `docs/../.dev-team/FEATURES.md` (Rule 1, marker `Write`) resolves INTO `.dev-team/` and is
  allowed — a case that only passes when `docs/..` is genuinely walked back out and
  `.dev-team/FEATURES.md` genuinely walked back in. Confirmed against the pre-resolution hook
  (`0a2f286~1`), which refuses this same payload with exit 2 — see the builder's report for issue
  #41, N6, for that command and its output.

  **Fault found by the same review, under macOS's stock `/bin/bash` (3.2):** resolve_lexical's last
  line joined the resolved path pieces back together with `echo "${parts[*]}"`. For any `file_path`
  that resolves to NOTHING — every segment being `.`, `..`, or empty, as with `.`, `..`, `/`, or
  `SECURITY.md/..` — the array of pieces ends up empty, and bash 3.2's `set -u` treats expanding an
  empty array with `${parts[*]}` as an unbound variable (bash 4.4+ does not have this problem). The
  write was still allowed either way — an empty `$resolved` matches no rule below — but the hook
  printed `line 188: parts[*]: unbound variable` to stderr, which looks exactly like the hook itself
  being broken. Two cases (`file_path` `..` and `SECURITY.md/..`, both `Write`s) check the exit code
  AND that stderr is silent, using bats-core's `run --separate-stderr` (requires bats-core ≥ 1.5.0,
  declared at the top of the file with `bats_require_minimum_version 1.5.0`) so stdout and stderr
  are captured apart rather than merged into one string. The join now falls back to an empty string
  when the array is empty (`"${parts[*]:-}"`, which bash 3.2 accepts) and uses `printf` instead of
  `echo`, so a path whose only real segment is text like `-n` or `-e` is never read as an echo
  option.

  **Fault found by the same review, on an absolute path outside the project:** a `file_path` that
  is still absolute after the `<cwd>/`(or `$PWD/`) strip — meaning it names somewhere outside the
  project's own working folder entirely, such as `/.dev-team/SECURITY.md` with `cwd` set to some
  unrelated folder — used to have its leading `/` read as just another empty split piece and
  dropped, resolving to the plain text `.dev-team/SECURITY.md` and wrongly judged to be inside THIS
  project's own `.dev-team/`. The path is now marked as having left the project (same treatment as
  a runaway `..`), so Rule 1 judges it by file name alone and denies it. Two cases: an absolute path
  outside `cwd` starting with `/.dev-team/` (Rule 1, marker `Write`) is denied by file name; the
  companion case, an absolute path genuinely inside `cwd`'s own `.dev-team/`, is still allowed —
  proving the fix does not also start refusing legitimate absolute paths.

- **A session started in a SUBFOLDER of the repository (issue #41, Codex round 3, finding 5).**
  Fault found by review: the hook used to take the payload's `cwd` AS the project's top folder.
  From a subfolder that went wrong in both directions — a harmful write to the real top-level
  `SECURITY.md` (given as an absolute path, or as `../SECURITY.md`) counted as "outside the
  project" and was let through, the top-level `.dev-team/loop.lock/` and `.dev-team/config.yml`
  were never found (so `guard: off` was ignored), and the plugin's own correct write to the
  absolute `<top>/.dev-team/SECURITY.md` was wrongly refused. The hook now asks git
  (`rev-parse --show-prefix`, deliberately not `--show-toplevel` — see the hook's own comment for
  why that would break on macOS's `/private/var` vs `/var` split) where the working folder sits
  inside the repository, and judges paths, config and the lock against the TOP folder it works out
  from that. Each test builds its own throwaway git repository under `$SCRATCH` with a `src`
  subfolder and passes `cwd` pointing at that subfolder, exactly as Claude Code would for a session
  started there. Cases cover: the top-level `SECURITY.md` is still protected from a subfolder,
  whether given as an absolute path or as `../SECURITY.md`; the plugin's own correct
  `.dev-team/` writes from a subfolder (absolute and relative) are still allowed; `guard: off` set
  at the top level is honoured from a subfolder; a bare relative name from a subfolder (really
  `src/SECURITY.md`) — **round-4 stand-in verification found this test pinned the wrong answer; see
  "Rule 2 also protects a subfolder session's own top-level ledger names", below, for the fix** —
  two levels deep (`src/deep`, `../../SECURITY.md`) still resolves correctly. One case deliberately
  runs with **no** `git init` at all, to pin the documented remaining limit: outside a git
  repository, a session started in a subfolder is still judged as if that subfolder were the top —
  this test first checks that `$SCRATCH` is not itself accidentally sitting inside some outer
  repository on the machine running the suite, and skips rather than passing for the wrong reason if
  it is.

- **A session's OWN `.dev-team/` inside its subfolder (round-4 stand-in verification, new finding).**
  Fault found by review: the subfolder fix just above went too far the other way. It counted only the
  TOP folder's `.dev-team/` as `.dev-team/`, and read `config.yml`/`loop.lock/` only from the top
  folder — but every skill in this plugin writes `.dev-team/<name>` relative to the SESSION folder,
  and `/dev-team-config init` creates `config.yml` there too. So from `src` (a monorepo package, say),
  the plugin's own correct write to `src/.dev-team/PROJECT.md` (absolute or relative) was refused,
  telling the caller to write it under `.dev-team/` — where it already was — and `guard: off` written
  into `src/.dev-team/config.yml` was ignored. The hook now also counts `<sub>/.dev-team/` as inside
  `.dev-team/`, and reads `config.yml`/`loop.lock/` from BOTH the session folder and the top folder,
  with `off` and "a lock is present" each winning from either place. Cases cover: the plugin's own
  absolute and relative writes to the session folder's own `.dev-team/` are allowed; a harmful
  top-level write from a subfolder with no session config file present is still denied (control);
  `guard: off` in the session folder's own `config.yml` is honoured; `guard: off` in the session
  folder wins over `guard: on` at the top when the two disagree; `guard: on` in the session folder's
  config forces Rule 2 on with no lock file anywhere; `loop.lock/` present only in the session
  folder still counts as an active run for the top-level file; a trailing slash on `cwd` (`"<repo>/
  src/"`) does not defeat the top-folder match (a separate, smaller fault the same review found, in
  the prefix-strip step added for the finding-5 fix); `.dev-team/../SECURITY.md` given relative to a
  subfolder still resolves out of that subfolder's own `.dev-team/` and is denied, proving the new
  `<sub>/.dev-team/` match cannot be tricked with a `..`; and `cwd` sent as the filesystem root (`/`)
  does not crash the trailing-slash strip, whichever way Rule 1 ends up deciding the write.

- **Rule 2 also protects a subfolder session's own top-level ledger names (round-4 stand-in
  verification, finding B).** Fault fixed: the finding-5 fix above, and the round-4 refinement just
  above it, fixed how the hook finds `.dev-team/`, `config.yml` and `loop.lock/` from a subfolder
  session — but neither one touched Rule 2's own list of PROTECTED NAMES, which still matched only
  the seven ledger names at the git TOP folder. So the very test that was meant to pin this
  behaviour ("a relative ledger name from a subfolder is not the top-level file") used to assert
  exit 0 for exactly the failure this whole change exists to stop, one folder down: a stale
  instruction that appends findings to a relative `SECURITY.md` from a subfolder session lands on
  that subfolder's own file, and Rule 2 never fired for it, even with the subfolder's own
  `loop.lock/` present and genuinely active. That test is now renamed and flipped to expect exit 2.
  Rule 2 now ALSO matches the seven ledger names sitting directly inside the session's own
  subfolder — additive to the top-level list, never instead of it (see the hook's own Rule 2 code,
  "why ADDITIVE", for the reasoning: the written documents and the skills disagree about which
  folder is really "the top level", and protecting both is correct whichever way the owner
  eventually settles that) — but deliberately NOT `<sub>/.github/security.md` or
  `<sub>/docs/security.md` (GitHub only ever reads a security policy from the repository's top, its
  `.github/`, or its `docs/` — never a subfolder's own copies of those, and this plugin never wrote
  a ledger there either), and NOT anything deeper than the subfolder's own top level (none of the
  seven names contains a `/`, so a path like `src/deep/SECURITY.md` can never match). Cases cover:
  the subfolder's own `SECURITY.md` is protected with the lock only in the session's own
  `.dev-team/`, and by its absolute path too; the subfolder's own `FEATURES.md` is protected the
  same way; a path one level below the subfolder, and the subfolder's own `.github/`/`docs/`
  `SECURITY.md`, are controls showing the deliberate exclusions above are NOT matched; with no lock
  and no guard setting anywhere the subfolder's own `SECURITY.md` is not blocked; a subfolder named
  with a glob character (`s*`) is matched literally, never as a wildcard, against a sibling folder
  (`sx`) that must not also match; `guard: off` in the subfolder's own `config.yml` clears the
  subfolder's own ledger-name protection too; a plain edit to the subfolder's own `SECURITY.md`,
  with no marker and no record id, is still allowed.

- **A symlinked `.dev-team/` path (finding 6, pinning test added round 4).** The fix specification for
  finding 6 called for a bats case pinning a KNOWN, DOCUMENTED limit, not a claim that the limit has
  been fixed: this hook judges a path by its text alone and never follows a symbolic link. If
  `.dev-team/SECURITY.md` is itself a link pointing back out to the project's real top-level
  `SECURITY.md`, the hook sees the text `.dev-team/SECURITY.md`, counts it as inside `.dev-team/`, and
  allows the write. One test builds exactly that symlink in a throwaway repo, confirms the hook allows
  the write, and then writes through the symlink with an ordinary shell redirect (a stand-in for what
  some write path might do — Claude Code's own Write/Edit tools were not tested against a link) to
  show the write really can land on the real top-level file, which is what makes the limit worth
  documenting rather than a difference that never shows up in practice.

- **The legacy (pre-v1.5.0) marker (issue #41, Codex round 3, finding 7).** Fault found by review:
  `conventions.md` still accepts the legacy marker, `<!-- dev-team-schema: 1.0 -->`, as proof that
  the plugin owns a file (point 3) — but the hook's marker pattern only recognised the current
  marker forms, so a `Write` (or, mid-cycle, an `Edit`) carrying only the legacy marker to a
  top-level ledger name passed straight through both rules. The pattern now includes the legacy
  marker too. Cases cover: the legacy marker on a top-level `SECURITY.md` Write is denied; the
  identical content at `.dev-team/SECURITY.md` is allowed; a legacy marker on line 10 only (past
  the first-three-lines check) does not trip Rule 1; and, for Rule 2, an `Edit` adding the legacy
  marker to a top-level `FEATURES.md` mid-cycle (with `.dev-team/loop.lock/` present) is denied.

### `schemas/verdict.schema.json` + `scripts/check-verdict.sh` — verdict validation

Two long-standing tests check `tests/fixtures/verdict.sample.json` against
`schemas/verdict.schema.json` using **check-jsonschema** (a Python tool:
`brew install check-jsonschema`, or `pipx install check-jsonschema` where Homebrew isn't available):
the fixture itself validates, and a copy with `overall` changed to an invalid value (`"MAYBE"`)
fails validation. Every `check-jsonschema` test in this section **skips** (never fails) when
`check-jsonschema` isn't installed, so a contributor without it still gets a green local run — CI
always has it (installed via `pipx` in `plugin-audit.yml`'s `test` job), so a schema-breaking change
is still caught before merge.

**Findings 12 and 13 (issue #41, Codex round 3):** before this fix, the schema accepted verdict
shapes that `verdict-and-report-protocol.md`'s own "Overall verdict rule" already calls
impossible — for example `overall: PASS` while the clean-room integration check failed, or
`overall: PASS_WITH_GAPS` with a critical `FAILED` claim. The schema now carries `allOf` rules
that reject exactly those shapes (see the schema's own top-level `$comment` for the reasoning), and
finding 13's wrong wording in the `severity` field's description ("A FAILED or DRIFTED claim at
critical severity is what forces FAIL" — wrong; a critical `DRIFTED` claim rules out `PASS` but does
not force `FAIL`) is corrected to match the protocol and the sample fixture's own `V-003`. Nine
fixtures under `tests/fixtures/` (`verdict.invalid-*.json` and `verdict.valid-fail-critical-failed.json`)
each break, or deliberately satisfy, exactly one rule; the tests here check each one against
`check-jsonschema`, confirm the protocol document's own worked JSON example validates, and confirm
the old wrong wording is gone from the schema file.

**Finding C (round-4 stand-in verification):** the three rules above only ever pushed the verdict
TOWARDS `FAIL` (a failed integration check, or a critical `FAILED` claim) — nothing stopped a
producer writing `overall: FAIL` on its own with NEITHER cause true, which the protocol calls just
as impossible as a `PASS` with a failed integration check (`verdict-and-report-protocol.md`,
"Overall verdict rule": "FAIL — any critical done-criterion / feature / security claim FAILED, or
the integration check failed"). A fourth `allOf` rule now requires a `FAIL` verdict to show one of
those two causes elsewhere in the file; the schema's top-level `$comment` also gained one sentence
explaining that `PASS_WITH_GAPS` is deliberately left unconstrained from below — the protocol allows
it whenever nothing critical failed and integration passed, even for a gap this schema does not
track at all (something noted only in `VERIFICATION.md` prose), so an "empty" `PASS_WITH_GAPS` is
not a shape the protocol calls impossible. Two new fixtures: `verdict.invalid-fail-without-cause.json`
(FAIL, but every claim VERIFIED and integration passed — must be rejected by the schema, while
still passing `check-verdict.sh`'s own four rules cleanly, proving the schema is the only thing that
calls it impossible) and `verdict.valid-fail-integration-failed.json` (FAIL caused only by a failed
integration check, with no FAILED claim at all — must still validate, pinning the second branch of
the new rule's `anyOf`, since the pre-existing `verdict.valid-fail-critical-failed.json` fixture
only ever pinned the first branch).

Four further invariants cannot be expressed in JSON Schema at all — comparing a COUNT of array
entries to another field, or one claim's field against another claim's field — so
`scripts/check-verdict.sh` (a new, separate script; run it AFTER `check-jsonschema`, never instead
of it) checks those: the `claims` array has exactly `checked` entries; the five per-verdict counts
add up to `checked`; each count matches the number of claims actually carrying that verdict word;
every claim `id` is unique. It exits 0 and prints `VERDICT-CHECK OK` when every rule holds, 1 with a
named `VERDICT-CHECK FAIL: <reason>` line per broken rule, or **2** — a refusal, not a pass — when it
cannot even attempt the checks (no argument, an unreadable file, invalid JSON, or `jq` missing from
`PATH`). The bats tests here (which need `jq`, and skip when it's absent) check the sample fixture
passes; each of the four checked-mismatch/count-mismatch/duplicate-id/empty-claims fixtures fails
with the right named reason; a missing file and a `PATH` with no `jq` on it (a throwaway directory
holding nothing but a symlink to `bash`) are both refused with exit 2, never silently treated as a
pass.

**Round-4 fix:** the code used to print the "not valid JSON" message and then exit **1** — the code
for "read, valid JSON, but fails a rule" — which contradicted the header's own exit-code table just
above it, which already listed invalid JSON under exit 2. A caller sorting exit 1 from exit 2 would
have read a truncated or corrupt `verdict.json` as a checked-and-failed review rather than as a
checker that could not run at all. Fixed by changing the code to match the header (exit 2 is the
correct meaning here: nothing was checked), not the other way around. One bats test pins it: a file
containing `{not json` is refused with exit 2 and the "not valid JSON" message.

**Finding N2 (round-4 stand-in verification):** the round-4 fix above tested validity with
`jq empty`, which only checks that its input parses at all and then discards whatever it parsed to —
it does not care whether the input was empty, whitespace-only, or held several JSON values back to
back, so all three of those returned 0 from `jq empty` and went on to fail all eight rule checks,
exiting 1 ("checked, and it failed badly") when the true state was "nothing was checked at all". An
interrupted write that leaves `.dev-team/verdict.json` empty is exactly the ordinary case this let
slip through. The test is now `jq -s -e 'length == 1 and (.[0] | type == "object")'`, which slurps
the whole file into an array first: empty or whitespace-only input slurps to a zero-length array
(rejected), two values back to back slurp to a two-element array (rejected), and a bare scalar such
as `42` — syntactically valid JSON, but not an object, and every rule below reads a field off the
top level — slurps to a one-element array whose element is not type `object` (also rejected). The
message is now `"'$file' is empty, not valid JSON, or not a single JSON object"` (still contains the
substring "not valid JSON", so the existing exact-message bats assertion keeps passing), and the
header's own exit-code paragraph was updated to name all of these cases under exit 2, including the
bare-scalar case explicitly (`42` is valid JSON by itself but still exits 2 here, because this
script's whole job is checking an object's fields, not merely confirming the input parses). Four new
bats cases beside the invalid-JSON test: a zero-byte file, a whitespace-only file, two JSON values in
one file (`{} {}`), and a bare scalar (`42`) — all four refused with exit 2 and the same message,
never silently run through the eight rule checks below.

### This file's own hygiene (finding 11; broadened round 4; broadened again by finding N3)

The last four tests in `scripts.bats` grep the test file itself: the first confirms no test deletes,
creates, copies, moves, or touches a path under `$REPO_ROOT` or `$MOVE_LEDGERS_MD` (the second
variable also names a real file in this repository, just reached a different way — see `setup()`
near the top of the file); the second confirms no test writes into either of those with a shell
redirect; the third confirms no test uses `git` or `sed` to change a path in either; the fourth
confirms no test `cd`s into `$REPO_ROOT` at all, except the two lines already proven read-only by
their own assertions. Every pattern is built with a small string split in the test's own source
(`REPO''_ROOT`, `MOVE_LEDGERS''_MD`) so that the test does not flag its own definition line while
still catching the real thing. These are a deliberate pin on the fix for finding 11 (see "Fault
fixed (finding 11)", above): a future test added carelessly, in the old style this file used to use,
would delete or overwrite a real path in this repository on every run — including a contributor's
own untracked files — and these four tests are what stop that pattern from quietly coming back.

**Round-4 fix:** a stand-in verification found the two patterns that existed at the time only ever
matched ONE exact shape each, spelled out letter for letter — a two-flag deletion of the quoted
repository-root variable, and a bare redirect naming that same quoted variable with a slash right
after it. A future test using `mkdir`, `cp`, `mv`, `tee`, `touch` or `ln` instead of the one deletion
command the old pattern watched for, or the curly-brace form of the variable, or a redirect with the
closing quote placed somewhere other than around the whole path, or a deletion of the path held in
`$MOVE_LEDGERS_MD`, would have passed both tests silently — including the exact directory-creation
shape the old, unsafe version of the `.claude/agents` test used to run (see "Fault fixed (finding
11)" above). Reproduced in a scratch copy of this file, outside the repository, with seven lines
added covering every one of those shapes: only the original two-flag deletion shape was caught; the
other six passed unnoticed. The two patterns were widened to watch six command words (a deletion, a
new directory, a copy, a rename or move, a write through `tee`, and touching or symlinking a path)
for either variable in either written form, plus either redirect operator for the same, stopping
only at a pipe, an ampersand or a semicolon between the command word and the variable.

**Round-4 stand-in verification, finding N3:** even the widened patterns above still needed the
watched WORD to be followed LATER on the same line by the variable — so a line built like
`( cd "$REPO_ROOT" && rm -rf .claude/agents )` was missed entirely, because the repository-root
variable sits BEFORE `rm` there, not after it: the write names a path relative to the working
folder AFTER the `cd`, never spelling the variable itself on the same line as the deleting word.
That is exactly the subshell idiom this file already uses for its own read-only git steps (see
`make_tree()`, and the branch-hygiene test), so it is also the shape most likely for a careless
future test to copy. Separately, the `$MOVE_LEDGERS_MD` half of the delete pattern watched only
`rm` (not the other five words) and had no brace-form support at all; the command-word list had no
LEFT boundary either, so a comment ending in a word like "platform" (which itself ends in the
letters "rm") was wrongly flagged; and neither `git` nor `sed` — both fully capable of changing a
real file in the repository — were watched at all, although the comment claimed the patterns caught
"either variable in either written form" without qualification. Reproduced again in a fresh scratch
copy, outside the repository, with lines covering the brace form of `$MOVE_LEDGERS_MD`, the
cd-then-write subshell idiom, `sed`'s in-place flag, a `git checkout` of `$REPO_ROOT`, a path built
through a third, unwatched variable, and the "platform" comment: only the original shapes were
caught, the rest passed unnoticed. Fixed with four checks instead of two (matching the four tests
above):

1. The delete/create/copy/move/touch pattern now watches the same six words on both variable
   branches, with brace-or-no-brace support on both, and is anchored so the word must START a real
   word (`platform` no longer trips it).
2. The write-redirect pattern gained brace-or-no-brace support on the `$MOVE_LEDGERS_MD` branch too
   (previously only `$REPO_ROOT` had it).
3. `git` and `sed` are watched in a SEPARATE test, not folded into check 1's word list — a plain
   word-boundary test on `git` or `sed` alone is far too broad, since this file already reads
   `$REPO_ROOT` through several harmless uses that must stay legal (a read-only `git -C` branch
   listing, a `git ls-files` text search whose search STRING merely contains the word "git", and a
   `sed -n` print-only extraction with no in-place flag). This check instead requires the word
   `git` together with one of a short list of mutating subcommands (`checkout`, `reset`, `clean`,
   `restore`, `apply`, `stash`, `merge`, `rebase`, `cherry-pick`, `revert`, `rm`, `mv`, `add`,
   `commit`) AND either variable, anywhere on the line in any order — or the word `sed` together
   with its in-place flag AND either variable — checked with three chained `grep` calls rather than
   one combined pattern, since "all of these appear somewhere, in any order" is awkward and easy to
   get subtly wrong as a single regular expression.
4. A brand new fourth check: no line may `cd` into `$REPO_ROOT` at all, except the two lines already
   proven read-only by their OWN assertions — the tar copy in `make_tree()` (only ever reads, to
   build `$TREE`) and the branch-hygiene test (asserts the branch list is unchanged before and
   after) — named by their EXACT current text, not by line number. This is what catches the
   cd-then-write idiom that no amount of widening checks 1–3 could ever catch on their own, since
   those look for the variable NEAR the command word, and this idiom never puts them on the same
   line at all.

**What is still NOT caught, stated plainly rather than left for a reader to assume:** a path reached
through a THIRD variable — for example `x="$REPO_ROOT/.claude/agents"; mkdir -p "$x"` — is invisible
to every check above, because none of them ever look at `$x`. A read-only use of either variable
through a command word not on any of these lists needs no separate allow-list entry. If a genuinely
read-only line using one of the watched words, or the `cd` shape, is ever needed, allow-list that
one line explicitly, with a comment saying why it is safe, rather than loosening a pattern for
everything. These patterns were run under `/usr/bin/grep` (BSD grep, what a fresh shell resolves
`grep` to on macOS, which is what `bats` itself uses to run these tests) and under both
`/bin/bash` 3.2 and a newer bash; GNU grep was not available on the machine these were built and
proven on, so its behaviour on these exact patterns is assumed, not exercised, here.

## Running locally

```bash
# Model-id + stale-ledger-path audits (bash only)
bash scripts/audit-model-ids.sh
bash scripts/audit-ledger-paths.sh

# Structural smoke test (bash only, needs jq for the JSON checks)
bash tests/smoke-structure.sh

# Behavioral tests (needs bats-core: brew install bats-core, or apt-get install bats)
# The schema-validation cases inside this file skip themselves if check-jsonschema
# isn't installed: brew install check-jsonschema, or pipx install check-jsonschema.
# The check-verdict.sh cases need jq (already required elsewhere in this suite) and skip if it's
# missing.
bats tests/scripts.bats

# scripts/check-verdict.sh can also be run directly against any verdict.json, after
# check-jsonschema has passed it (needs jq)
bash scripts/check-verdict.sh tests/fixtures/verdict.sample.json

# Shellcheck across every shell script the plugin ships
shellcheck scripts/*.sh hooks/*.sh tests/*.sh
```

All of these should be run before opening a PR that touches `scripts/`, `hooks/`, `schemas/`,
`skills/`, `commands/`, `agents/`, or `tests/`.

## What CI runs

`.github/workflows/plugin-audit.yml` runs the two audit scripts as the `audit` job
(`scripts/audit-model-ids.sh` then `scripts/audit-ledger-paths.sh`), and the smoke test,
shellcheck, and bats as the `test` job, on every pull request and on push to `main`. Both `audit`
and `test` are required checks.

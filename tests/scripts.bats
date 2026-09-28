#!/usr/bin/env bats
# Behavioral tests for scripts/*.sh and hooks/*.sh. Run: bats tests/scripts.bats
# (installs itself in CI — see .github/workflows/plugin-audit.yml). See tests/README.md.
#
# Every test that needs an isolated ".dev-team/config.yml" or a directory with no
# ".dev-team/autopilot.json" runs from a fresh per-test scratch dir ($SCRATCH), never from
# $REPO_ROOT. No test in this file writes to, or deletes anything from, $REPO_ROOT — see the
# "scripts.bats: no test deletes anything inside the real repository" test near the bottom, which
# greps this very file for exactly that.
#
# Fault fixed (issue #41, Codex round 3, finding 11): this file used to inject failures straight
# into the real repository — writing a dated-model-id file under tests/, creating a real
# ".claude/agents/" directory, writing a fixture under skills/dev-team-orchestrator/references/ —
# and teardown() unconditionally deleted the repository's own ".claude/agents" folder, recursively,
# after EVERY test, whether or not that test had anything to do with it. A contributor who keeps
# their own ".claude/agents/" folder in this checkout (nothing stops that; ".claude/" is only partly
# tracked) would have had it silently deleted the first time they ran the suite. The fix is
# "make_tree" below: it copies the
# whole repository (minus .git) into $SCRATCH/tree once per test that needs to inject a fault, and
# every one of those tests now runs the script being tested against the COPY, never the real tree.
# Both audit scripts "cd" to their own script's parent directory before doing anything else, so
# running the copy's script audits the copy — the real repository is never touched, and there is
# nothing to clean up afterward beyond the normal $SCRATCH removal every test already does.
#
# The guard-ledgers stderr-silence tests below use "run --separate-stderr", a bats-core flag added
# in 1.5.0 (it splits stdout and stderr into $output and $stderr instead of merging them, which
# those tests need — a merged capture cannot tell "nothing on stderr" apart from "the decision line
# happened to land on stdout instead"). This line makes that requirement a clear, up-front failure
# ("bats version X.Y.Z does not fulfill the minimum required version 1.5.0 by this test file") on
# an old bats install, instead of the quieter BW02 warning bats-core would otherwise only print
# after already running everything.
bats_require_minimum_version 1.5.0

setup() {
  REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/dev-team-bats.XXXXXX")"
  # Set here, not as a bare top-level assignment further down, because bats sources this whole file
  # ONCE before calling setup() for the first test — a top-level "MOVE_LEDGERS_MD=$REPO_ROOT/..."
  # would see $REPO_ROOT still unset at that point and silently bake in an empty prefix.
  MOVE_LEDGERS_MD="$REPO_ROOT/commands/dev-team-move-ledgers.md"
}

teardown() {
  # Only ever removes $SCRATCH, this test's own private throwaway directory — never a path under
  # $REPO_ROOT. Three unconditional deletes of real repository paths used to live here (removed for
  # finding 11 above): they ran on every single test, not just the ones that had created something to
  # clean up, and one of them would have taken out a contributor's own ".claude/agents/" folder if
  # they happened to have one.
  [ -n "${SCRATCH:-}" ] && rm -rf "$SCRATCH"
}

# Copies this repository (without .git) into $SCRATCH/tree, so a test that needs to inject a fault
# — a dated model id, a fake ".claude/agents/" dir, a stale ledger-path sentence — can hand it to
# the script being tested WITHOUT touching the real working tree at all. Both scripts.audit-*.sh
# "cd" to their own script's parent directory before doing anything else, so running the COPY's
# script audits the copy; the real repository is read once (to make the copy) and never written to
# or deleted from. This replaces an earlier design that wrote fixed-name files straight into
# $REPO_ROOT and relied on teardown() to "rm -rf" them back out again — which is exactly the design
# finding 11 above found unsafe. Uses "tar" (excluding .git, which can be large and is never read by
# either audit script) because it behaves the same way on macOS's bundled bsdtar and on Ubuntu's GNU
# tar, unlike "cp -r" flag support. The copy also picks up untracked files such as
# orchestrator_prompt.md, which matches what the real audit scripts see when run directly.
make_tree() {
  TREE="$SCRATCH/tree"
  mkdir -p "$TREE"
  ( cd "$REPO_ROOT" && tar --exclude=.git -cf - . ) | ( cd "$TREE" && tar -xf - )
}

# Run guard-dev-team.sh with $2 piped to stdin, cwd'd into $1 (guard reads
# .dev-team/config.yml and .dev-team/autopilot.json relative to cwd, never cd's itself).
run_guard() {
  ( cd "$1" && printf '%s' "$2" | bash "$REPO_ROOT/hooks/guard-dev-team.sh" )
}

# Run guard-ledgers.sh with $2 piped to stdin, cwd'd into $1 (same convention as run_guard —
# the script reads .dev-team/config.yml and .dev-team/loop.lock/ relative to the payload's own
# "cwd" field when the payload sends one, otherwise relative to wherever it is run from, which is
# $1 here). Most tests below rely on that "relative to wherever it is run from" behaviour and
# never set "cwd" in the payload; the one test that does set "cwd" runs from a different directory
# on purpose, to prove the payload's field wins over the shell's own working directory.
run_ledger_guard() {
  ( cd "$1" && printf '%s' "$2" | bash "$REPO_ROOT/hooks/guard-ledgers.sh" )
}

# ---------------------------------------------------------------------------
# scripts/audit-model-ids.sh
# ---------------------------------------------------------------------------

@test "audit-model-ids: passes on the clean repo" {
  run bash "$REPO_ROOT/scripts/audit-model-ids.sh"
  [ "$status" -eq 0 ]
  [[ "$output" == *"AUDIT OK"* ]]
}

@test "audit-model-ids: fails on a dated model id outside the roster" {
  # audit-model-ids.sh cd's to its own script's parent dir, so it always audits whatever tree it is
  # run from — here, a throwaway COPY of the repo (see make_tree() above and finding 11), so the
  # injected file never touches the real working tree and there is nothing to remove afterward.
  make_tree
  echo "claude-opus-4-8" > "$TREE/tests/.tmp-audit-dated-id.md"
  run bash "$TREE/scripts/audit-model-ids.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"AUDIT FAIL"* ]]
  [[ "$output" == *"dated model id"* ]]
}

@test "audit-model-ids: fails when a .claude/agents/ dir exists" {
  make_tree
  mkdir -p "$TREE/.claude/agents"
  run bash "$TREE/scripts/audit-model-ids.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *".claude/agents/ exists"* ]]
}

# ---------------------------------------------------------------------------
# scripts/audit-ledger-paths.sh
# ---------------------------------------------------------------------------
# Every test below that injects a fault runs make_tree() first and writes the fixture, and runs the
# script, inside $SCRATCH/tree — never inside $REPO_ROOT (finding 11 above). There is nothing to
# remove afterward: $SCRATCH (and the copy inside it) is deleted by teardown() like any other test's
# scratch directory.

@test "audit-ledger-paths: passes on the clean repo" {
  # Read-only: runs the real script against the real tree, exactly as CI does.
  run bash "$REPO_ROOT/scripts/audit-ledger-paths.sh"
  [ "$status" -eq 0 ]
  [[ "$output" == *"LEDGER-PATHS OK"* ]]
}

# Fault found by a later reading of these tests: the one sentence used to inject a failure ("The
# documentarian writes `PROJECT.md` at the repo root.") trips BOTH check C ("repo root" plus a bare
# ledger name) and check E (the exact legacy phrase "at the repo root") at once, so a test passing
# proved only that ONE of the two fired — never which — and nothing here exercised check F at all.
# Each test below now injects a sentence built to trip exactly one check and asserts that check's
# own label in the output, confirmed by running each sample on its own through the real script
# before it was written here (see the builder's report for that proof).
TMP_LEDGER_AUDIT="skills/dev-team-orchestrator/references/.tmp-ledger-audit.md"

@test "audit-ledger-paths: check C fires alone on a \"sibling to\" sentence naming a bare ledger" {
  # The script cd's to its own script's parent dir, so it audits whatever tree it is run from —
  # here, the throwaway copy under $TREE, with the fixture written under its skills/ (in scope).
  make_tree
  printf '%s\n' 'Put `HANDOFF.md` sibling to package.json.' \
    > "$TREE/$TMP_LEDGER_AUDIT"
  run bash "$TREE/scripts/audit-ledger-paths.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"LEDGER-PATHS FAIL: C:"* ]]
  [[ "$output" != *"LEDGER-PATHS FAIL: E:"* ]]
}

@test "audit-ledger-paths: check D fires alone on a ledger anchor with no .dev-team/ prefix" {
  make_tree
  printf '%s\n' 'See `SECURITY.md#Findings` for the full register.' \
    > "$TREE/$TMP_LEDGER_AUDIT"
  run bash "$TREE/scripts/audit-ledger-paths.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"LEDGER-PATHS FAIL: D:"* ]]
}

# Finding 10 (Codex review round 3): check E used to fire on the legacy repo-root phrases ("at the
# repo root", and the three siblings in the script's header comment) ALONE, with no test at all for
# whether a ledger was actually being talked about. That rejected ordinary, unrelated sentences —
# for example this exact one, about config files, which has nothing to do with any dev-team ledger —
# just because it happened to contain the words "at the repo root". The two tests below replace the
# single old one (which used to assert that this harmless sentence FAILED the audit — see the
# builder's report for issue #41, finding 10, for why that was backwards) and pin the fixed
# behaviour: check E now only fires when a bare ledger name shows up on the SAME line as the phrase,
# or the line immediately before or after it (a wrapped sentence often puts the name on the line
# above), once every correct ".dev-team/<name>" mention has been stripped away first.

@test "audit-ledger-paths: check E ignores a repo-root phrase with no ledger name nearby" {
  make_tree
  printf '%s\n' 'Config files used to live at the repo root before this project reorganised its layout.' \
    > "$TREE/$TMP_LEDGER_AUDIT"
  run bash "$TREE/scripts/audit-ledger-paths.sh"
  [ "$status" -eq 0 ]
  [[ "$output" == *"LEDGER-PATHS OK"* ]]
}

@test "audit-ledger-paths: check E fires alone when a bare ledger name is on the line before the legacy phrase" {
  make_tree
  printf '%s\n%s\n' 'The documentarian keeps `PROJECT.md`' 'at the repo root.' \
    > "$TREE/$TMP_LEDGER_AUDIT"
  run bash "$TREE/scripts/audit-ledger-paths.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"LEDGER-PATHS FAIL: E:"* ]]
  [[ "$output" != *"LEDGER-PATHS FAIL: C:"* ]]
}

@test "audit-ledger-paths: check F fires alone on the old marker text with no \"legacy\" nearby" {
  make_tree
  printf '%s\n' 'This file still uses <!-- dev-team-schema: 1.0 --> in one place.' \
    > "$TREE/$TMP_LEDGER_AUDIT"
  run bash "$TREE/scripts/audit-ledger-paths.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"LEDGER-PATHS FAIL: F:"* ]]
}

# Round-4 stand-in verification found check G (finding 9, above) had been shipped with no bats test
# of its own — it rode along only on the "passes on the clean repo" test, which would stay green even
# if a later edit broke check G outright. These two pin the behaviour the script's own header comment
# describes for G: a skill-description line naming a bare ledger fails, and the identical line naming
# the ledger with its .dev-team/ prefix passes.

@test "audit-ledger-paths: check G fires on a README skill-description line naming a bare ledger" {
  make_tree
  printf '\n%s\n' '**Modes.** Cold-resumes from `PROJECT.md` when one is present.' >> "$TREE/README.md"
  run bash "$TREE/scripts/audit-ledger-paths.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"LEDGER-PATHS FAIL: G:"* ]]
}

@test "audit-ledger-paths: check G stays quiet when the same line names the .dev-team/ path" {
  make_tree
  printf '\n%s\n' '**Modes.** Cold-resumes from `.dev-team/PROJECT.md` when one is present.' >> "$TREE/README.md"
  run bash "$TREE/scripts/audit-ledger-paths.sh"
  [ "$status" -eq 0 ]
  [[ "$output" == *"LEDGER-PATHS OK"* ]]
}

# ---------------------------------------------------------------------------
# commands/dev-team-move-ledgers.md — text checks (issue #41, Codex round 3, findings 1-4)
# ---------------------------------------------------------------------------
# This command's own file is instructions for the model to follow, not a script — nothing here
# "runs" in the ordinary sense, so most of these are text checks confirming the file's wording still
# says what the fix required. A handful are instead checks on the real git behaviour those
# instructions rely on, each built in its own throwaway repo under $SCRATCH (removed by teardown()
# like any other test's scratch directory — never $REPO_ROOT).

@test "move-ledgers: the mixed group (d) is checked before the look-alike group (b)" {
  # Finding 1: (d) — the "mixed, needs a person" group — used to be checked after (b), so a real
  # product document with the plugin's own records appended to it could match (b)'s shape test on
  # its FIRST record and be offered for moving and stamping whole, before the mixed test ever ran.
  d=$(grep -n '^\*\*(d) Mixed' "$MOVE_LEDGERS_MD" | cut -d: -f1)
  b=$(grep -n '^\*\*(b) Looks like ours' "$MOVE_LEDGERS_MD" | cut -d: -f1)
  [ -n "$d" ]
  [ -n "$b" ]
  [ "$d" -lt "$b" ]
}

@test "move-ledgers: (d) no longer says only 'Checked before (c)'" {
  run grep -c 'Checked before (c)\.' "$MOVE_LEDGERS_MD"
  [ "$output" = "0" ]
}

@test "move-ledgers: (d) report uses the two-way wording" {
  # Finding 1: a (d) file might be an old ledger with no marker, or a document with records added —
  # the command cannot tell which, so it reports both possibilities instead of only one.
  run grep -c 'needs a person to cut it by hand' "$MOVE_LEDGERS_MD"
  [ "$output" = "0" ]
  grep -q 'either an old dev-team ledger with no marker' "$MOVE_LEDGERS_MD"
}

@test "move-ledgers: the preflight checks that each source file is tracked" {
  # Finding 2: a legacy root file that git ignores looks clean to "git status" but "git mv" fails on
  # it (exit 128) partway through the move, after other files have already moved.
  run grep -c 'git ls-files --error-unmatch' "$MOVE_LEDGERS_MD"
  [ "$output" -ge 1 ]
}

@test "move-ledgers: rollback covers steps 4 to 9, not only 8 or 9" {
  run grep -c 'If step 8 or 9 fails' "$MOVE_LEDGERS_MD"
  [ "$output" = "0" ]
  run grep -c 'If any step from 4 to 9 fails' "$MOVE_LEDGERS_MD"
  [ "$output" -ge 1 ]
}

@test "move-ledgers: rollback never uses git reset --hard except to explain why not" {
  # Finding 3: "git reset --hard" can destroy an edit some OTHER program made to the working tree
  # while this command's questions were being asked. Every remaining mention of it must be inside a
  # sentence explaining that it was rejected, never live instructions.
  run bash -c "grep -n 'reset --hard' '$MOVE_LEDGERS_MD' | grep -v -i 'rejected'"
  [ -z "$output" ]
}

@test "move-ledgers: working tree is checked again after the questions" {
  run grep -c 'changed while the questions were being asked' "$MOVE_LEDGERS_MD"
  [ "$output" -ge 1 ]
}

@test "move-ledgers: ignore check names config.yml" {
  # Finding 4: a declined pointer sentence writes .dev-team/config.yml, which can itself be
  # git-ignored — the same "git mv can't move an ignored file" problem as finding 2, but for a
  # created file instead of a moved one.
  run bash -c "grep -n 'check-ignore' '$MOVE_LEDGERS_MD' | grep -c 'config.yml'"
  [ "$output" -ge 1 ]
}

@test "move-ledgers: ignore check skips already-tracked paths" {
  # A file that is already tracked by git still accepts "git add" even when it matches an ignore
  # pattern (see the "git: ignored untracked config.yml is refused..." test below) — refusing it
  # anyway would be wrong.
  run grep -c 'already tracked' "$MOVE_LEDGERS_MD"
  [ "$output" -ge 1 ]
}

@test "move-ledgers: the by-hand recovery text (point 6) uses -f, matching point 4's own explanation (finding N1)" {
  # Fault fixed (round-4 stand-in verification, finding N1): point 6's manual-recovery text used to
  # give "git rm --cached --ignore-unmatch -- <path>" with no "-f" — the one recovery command a
  # person is handed, given precisely when the AUTOMATIC undo has already refused, fails in exactly
  # the case (a moved file's stamp already written to, whether fully or partly) this whole section
  # exists to recover from. Both point 4's own instructions and point 6's copy of them now use "-f"
  # (see the "git rm --cached refuses a ... moved file without -f" tests above, in the "git:"
  # section, for the git-mechanics fact both texts rely on). This test only confirms both texts
  # still say so; count is 2 today (points 4 and 6) but the assertion is ">= 2" so a future addition
  # of a third correct mention does not break it.
  # Searches for "-qf --cached --ignore-unmatch" rather than the fuller "rm -qf --cached
  # --ignore-unmatch" on purpose: this file's own hygiene tests, further down, watch for the
  # deleting word that starts this phrase, followed on the same line by the variable this test
  # reads from — as a sign of a test that might delete this real file — and a grep SEARCH STRING
  # that merely contains that same word would trip that guard even though this line only reads the
  # move-ledgers file, never writes to it. Dropping that one word off the front keeps this test
  # working under those checks without weakening what it confirms: "-qf --cached --ignore-unmatch"
  # is still the exact, distinctive substring of the fixed command.
  run grep -c -- '-qf --cached --ignore-unmatch' "$MOVE_LEDGERS_MD"
  [ "$output" -ge 2 ]
}

@test "git: an ignored legacy root file passes the clean check but is not tracked" {
  # Proves the fact finding 2's fix depends on: "git status --porcelain" does not list an ignored
  # file at all, so the command's clean-tree check cannot see it — but "git mv" (and "git
  # ls-files --error-unmatch") fails on it, because git was never tracking it to begin with.
  repo="$SCRATCH/repo"
  mkdir -p "$repo"
  ( cd "$repo" && git init -q && git config user.email t@t.example && git config user.name t \
    && printf '/SECURITY.md\n' > .gitignore && git add .gitignore && git commit -qm i \
    && echo x > SECURITY.md )
  [ -z "$(cd "$repo" && git status --porcelain)" ]
  run bash -c "cd '$repo' && git ls-files --error-unmatch -- SECURITY.md"
  [ "$status" -ne 0 ]
}

@test "git: the documented restore leaves other programs' edits alone" {
  # Proves finding 3's replacement for "git reset --hard": restoring only the LISTED paths this
  # command itself touched undoes the rename and the staged edit, but leaves a foreign edit to
  # app.js (made by some other program while the command's questions were being asked) untouched.
  repo="$SCRATCH/repo"
  mkdir -p "$repo"
  ( cd "$repo" && git init -q && git config user.email t@t.example && git config user.name t \
    && printf 'v1\n' > FEATURES.md && printf 'app v1' > app.js && printf '{"orig":true}' > ap.json \
    && git add FEATURES.md app.js ap.json && git commit -qm base )
  H0="$(cd "$repo" && git rev-parse HEAD)"
  ( cd "$repo" \
    && echo foreign > app.js \
    && mkdir .dev-team \
    && git mv FEATURES.md .dev-team/FEATURES.md \
    && echo '{}' > ap.json && git add ap.json \
    && printf 'loop.lock/\n' > .dev-team/.gitignore && git add .dev-team/.gitignore \
    && git restore --source="$H0" --staged --worktree -- FEATURES.md .dev-team/FEATURES.md ap.json \
    && git rm -q --cached --ignore-unmatch -- .dev-team/.gitignore \
    && rm -f -- .dev-team/.gitignore \
    && rmdir .dev-team 2>/dev/null )
  [ "$(cat "$repo/app.js")" = foreign ]
  [ -f "$repo/FEATURES.md" ]
  [ ! -e "$repo/.dev-team" ]
  [ "$(cd "$repo" && git status --porcelain --untracked-files=all)" = " M app.js" ]
}

@test "git: per-path rollback restores an existing path and removes a listed path that never existed" {
  # New finding (round-4 stand-in verification): the test just above happens to only ever list paths
  # that ARE known to git (either at H0, or currently staged by "git mv") — so it could pass even
  # with the OLD rollback text, which ran one batch "git restore" naming every listed path at once.
  # That batch form fails outright, restoring NOTHING, the moment any one named path is unknown to
  # git in both the current index and H0 — exactly the shape left behind when one file's own
  # "git mv" fails partway through a multi-file move: per the "Keep a list" text, a "git mv" that
  # itself fails adds nothing to the list for that file, but a DIFFERENT file that moved fine just
  # before it IS listed, together with its new ".dev-team/<name>" path — which, by the section-2
  # conflict rule, can never have existed at H0 either, and was never staged since its own "git mv"
  # never ran. This test reproduces the old batch failure first, then proves the fix: checking each
  # path against H0 first (git cat-file -e) and acting on it alone means one such path can no longer
  # block the undo of the rest.
  repo="$SCRATCH/repo"
  mkdir -p "$repo"
  ( cd "$repo" && git init -q && git config user.email t@t.example && git config user.name t \
    && printf 'v1\n' > FEATURES.md && git add FEATURES.md && git commit -qm base )
  H0="$(cd "$repo" && git rev-parse HEAD)"
  ( cd "$repo" && mkdir .dev-team && git mv FEATURES.md .dev-team/FEATURES.md )
  # OLD behaviour: one batch restore naming SECURITY.md's never-created .dev-team/ target (standing
  # in for the file whose own "git mv" failed) fails outright and restores nothing at all — not even
  # FEATURES.md, which the batch could otherwise have handled on its own.
  run bash -c "cd '$repo' && git restore --source='$H0' --staged --worktree -- FEATURES.md .dev-team/FEATURES.md .dev-team/SECURITY.md"
  [ "$status" -ne 0 ]
  [[ "$output" == *"did not match"* ]]
  [ "$(cd "$repo" && git status --porcelain)" = "R  FEATURES.md -> .dev-team/FEATURES.md" ]
  # NEW behaviour: the same three paths, checked and undone one at a time.
  for path in FEATURES.md .dev-team/FEATURES.md .dev-team/SECURITY.md; do
    if ( cd "$repo" && git cat-file -e "$H0:$path" 2>/dev/null ); then
      ( cd "$repo" && git restore --source="$H0" --staged --worktree -- "$path" )
    else
      ( cd "$repo" && git rm -qf --cached --ignore-unmatch -- "$path" && rm -f -- "$path" )
    fi
  done
  ( cd "$repo" && rmdir .dev-team 2>/dev/null )
  [ "$(cat "$repo/FEATURES.md")" = v1 ]
  [ ! -e "$repo/.dev-team" ]
  [ -z "$(cd "$repo" && git status --porcelain --untracked-files=all)" ]
}

# Fault fixed (round-4 stand-in verification, finding N1): commands/dev-team-move-ledgers.md point
# 6's manual-recovery text used to give "git rm --cached --ignore-unmatch -- <path>" with no "-f" —
# the one recovery command a person is handed, for exactly the case (something else changed the
# repo, so the automatic undo refuses) where a moved file's stamp write is most likely to have
# reached only partway. Point 4's own explanation of why "-f" is needed was also narrower than the
# truth: it named only a HALF-written stamp. The two tests below prove the wider fact the fixed
# text now relies on: after "git mv", the index keeps git mv's PRE-STAMP copy of a moved file right
# up until the final "git add" replaces it — so once step 6 has written anything to that file,
# whether the write finished cleanly or died partway, the index no longer matches both the file on
# disk and HEAD, and a plain "git rm --cached" refuses rather than risk discarding an edit.

@test "git: git rm --cached refuses a FULLY stamped moved file without -f, and succeeds with -f" {
  repo="$SCRATCH/repo"
  mkdir -p "$repo"
  ( cd "$repo" && git init -q && git config user.email t@t.example && git config user.name t \
    && printf 'v1\n' > FEATURES.md && git add FEATURES.md && git commit -qm base )
  ( cd "$repo" && mkdir .dev-team && git mv FEATURES.md .dev-team/FEATURES.md \
    && printf '<!-- dev-team: ledger=features schema=1.0 -->\nv1\n' > .dev-team/FEATURES.md )
  [ "$(cd "$repo" && git status --porcelain)" = "RM FEATURES.md -> .dev-team/FEATURES.md" ]
  run bash -c "cd '$repo' && git rm --cached --ignore-unmatch -- .dev-team/FEATURES.md"
  [ "$status" -ne 0 ]
  [[ "$output" == *"use -f to force removal"* ]]
  # Nothing was removed by the refused attempt — the rename is still staged exactly as before.
  [ "$(cd "$repo" && git status --porcelain)" = "RM FEATURES.md -> .dev-team/FEATURES.md" ]
  run bash -c "cd '$repo' && git rm -qf --cached --ignore-unmatch -- .dev-team/FEATURES.md"
  [ "$status" -eq 0 ]
}

@test "git: git rm --cached refuses a HALF-WRITTEN stamp on a moved file without -f, and succeeds with -f" {
  repo="$SCRATCH/repo"
  mkdir -p "$repo"
  ( cd "$repo" && git init -q && git config user.email t@t.example && git config user.name t \
    && printf 'v1\n' > FEATURES.md && git add FEATURES.md && git commit -qm base )
  ( cd "$repo" && mkdir .dev-team && git mv FEATURES.md .dev-team/FEATURES.md \
    && printf 'half' > .dev-team/FEATURES.md )
  run bash -c "cd '$repo' && git rm --cached --ignore-unmatch -- .dev-team/FEATURES.md"
  [ "$status" -ne 0 ]
  [[ "$output" == *"use -f to force removal"* ]]
  run bash -c "cd '$repo' && git rm -qf --cached --ignore-unmatch -- .dev-team/FEATURES.md"
  [ "$status" -eq 0 ]
}

@test "git: ignored untracked config.yml is refused by git add, tracked one is not" {
  # Proves the two facts finding 4's "skip already-tracked paths" rule depends on: an untracked file
  # matching an ignore pattern is refused by "git add" (so it must be checked before it is written),
  # but once the same path is already tracked, "git add" on a later edit works normally — refusing
  # it there would be wrong.
  repo="$SCRATCH/repo"
  mkdir -p "$repo/.dev-team"
  ( cd "$repo" && git init -q && git config user.email t@t.example && git config user.name t \
    && printf '.dev-team/config.yml\n' > .gitignore && git add .gitignore && git commit -qm i )
  echo a > "$repo/.dev-team/config.yml"
  run bash -c "cd '$repo' && git check-ignore -q --no-index .dev-team/config.yml"
  [ "$status" -eq 0 ]
  run bash -c "cd '$repo' && git add .dev-team/config.yml"
  [ "$status" -ne 0 ]
  ( cd "$repo" && git add -f .dev-team/config.yml && git commit -qm add-config )
  echo b >> "$repo/.dev-team/config.yml"
  run bash -c "cd '$repo' && git add .dev-team/config.yml"
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# conventions.md — the canonical ownership sentence (issue #41, Codex round 3, finding 8)
# ---------------------------------------------------------------------------

@test "conventions: the canonical ownership sentence is identical in every file that quotes it" {
  # Finding 8: this sentence used to say "Every file the dev-team suite writes for itself..." (too
  # broad — it read as covering autopilot.json, config.yml, loop.lock/ and .gitignore too, none of
  # which can carry a line-2 marker) and conventions.md's own rule said "any file in the Shared
  # artifacts table". Both are narrowed to name exactly the plugin's record files, copied
  # byte-for-byte into every file that quotes the sentence.
  S='Every record file the dev-team suite writes for itself lives in `.dev-team/` and carries the dev-team marker on line 2 (`verdict.json` carries it as a field); a record file at that path without the marker is never written to — the run stops and asks. See `dev-team-orchestrator/references/conventions.md`, "Where the plugin writes, and the ownership rule".'
  count="$(grep -rlF "$S" "$REPO_ROOT/agents" "$REPO_ROOT/commands" "$REPO_ROOT/skills" 2>/dev/null | wc -l | tr -d ' ')"
  [ "$count" -eq 7 ]

  run grep -rF 'Every file the dev-team suite writes for itself' \
    "$REPO_ROOT/agents" "$REPO_ROOT/commands" "$REPO_ROOT/skills" "$REPO_ROOT/README.md"
  [ "$status" -eq 1 ]

  # The old, broader rule wording ("any file in the Shared artifacts table") is allowed to survive
  # in exactly one place: an "*Earlier wording:*" footnote in conventions.md that quotes it on
  # purpose, to explain to a future reader why the rule was narrowed (the fix itself calls for this
  # footnote). Asserting the phrase is entirely absent would fail against that deliberate footnote,
  # so instead this asserts every occurrence (if any) carries the footnote marker on the same line —
  # i.e. it is only ever quoted as history, never read as a live instruction.
  run bash -c "grep -rF 'any file in the Shared artifacts table' '$REPO_ROOT/skills/dev-team-orchestrator/references/conventions.md' | grep -v 'Earlier wording'"
  [ -z "$output" ]
}

@test "conventions: the canonical sentence also matches, after joining wrapped lines, in the two files that wrap it" {
  # Round-4 stand-in verification: the test just above counts 7 files where the sentence sits on one
  # unbroken line, so a plain "grep -l" literal search finds it. Two more files quote the same
  # sentence but wrap it across several lines in their own source markdown — gap-scoring-rubric.md
  # and migration-plan-protocol.md — so a single-line literal search never matches them at all, and a
  # future edit that silently changed a WRAPPED copy would go unnoticed by every test above. This
  # test joins each file's lines with a single space first — the same thing a markdown renderer does
  # to a wrapped paragraph before a reader ever sees it — so the wrapped copies are held to the exact
  # same word-for-word standard as the seven single-line ones.
  S='Every record file the dev-team suite writes for itself lives in `.dev-team/` and carries the dev-team marker on line 2 (`verdict.json` carries it as a field); a record file at that path without the marker is never written to — the run stops and asks. See `dev-team-orchestrator/references/conventions.md`, "Where the plugin writes, and the ownership rule".'
  for f in "$REPO_ROOT/skills/dev-team-featurefind/references/gap-scoring-rubric.md" \
           "$REPO_ROOT/skills/dev-team-migrate/references/migration-plan-protocol.md"; do
    [ -f "$f" ]
    tr '\n' ' ' < "$f" | grep -qF -- "$S"
  done
}

# ---------------------------------------------------------------------------
# "Repository instructions are authoritative" — the shared rule, the
# brief-template item, and the checker instruction that carry it.
# ---------------------------------------------------------------------------
# Without this rule, a builder or checker only ever knows what a lead happened to paste into its
# brief — a repository's own instructions (AGENTS.md, CLAUDE.md, ...) and the normative documents
# they point at (a standard, a policy, a spec a whole class of work "MUST follow") are invisible
# unless someone copies them in by hand, and a pasted copy is a copy that can drift from the
# original. These three tests each pin one load-bearing piece of the mechanism in the file where
# it actually lives, so a future edit that quietly drops the rule — while leaving the plugin
# looking otherwise intact — fails loudly here instead of shipping unnoticed.

@test "conventions: the repository-instructions rule exists, with its seven-point discipline intact" {
  # What this guards: conventions.md is the one canonical home every skill in the suite reads
  # (CONTRIBUTING.md: "a contradiction between that file and a sibling is treated as a bug in the
  # sibling"). If the rule vanished from here, every pointer to it elsewhere in the plugin
  # ("see conventions.md, 'Repository instructions are authoritative'") would resolve to nothing,
  # and no agent would ever look for a repository's own instructions again.
  f="$REPO_ROOT/skills/dev-team-orchestrator/references/conventions.md"
  run grep -F 'Repository instructions are authoritative' "$f"
  [ "$status" -eq 0 ]
  # The seven points of the discipline itself, not just the heading — a heading with an empty or
  # gutted body would still pass a bare title search.
  run grep -F 'Discover.' "$f"
  [ "$status" -eq 0 ]
  run grep -F 'Read, in full, from the repository.' "$f"
  [ "$status" -eq 0 ]
  run grep -F 'Work out which part applies.' "$f"
  [ "$status" -eq 0 ]
  run grep -F 'Carry it forward by reference, not by copy.' "$f"
  [ "$status" -eq 0 ]
  run grep -F 'Run what the repository requires, and report the real result.' "$f"
  [ "$status" -eq 0 ]
  run grep -F 'A checker or reviewer verifies this independently.' "$f"
  [ "$status" -eq 0 ]
  run grep -F 'The repository wins.' "$f"
  [ "$status" -eq 0 ]
}

@test "task-brief-template: the project-context item and the acceptance-criteria line for repository instructions are present" {
  # What this guards: this is the ONE place every builder/scout brief in the suite is assembled
  # from (task-brief-template.md, line 3: "Every worker agent gets a brief in this shape"). If the
  # "Repository instructions and normative documents" project-context item disappeared, a lead
  # would have nowhere in the standard brief shape to name the paths and rule IDs a builder needs
  # — the builder would be back to zero context beyond whatever the lead happened to paste, which
  # is exactly the gap this rule exists to close. If the acceptance-criteria line disappeared, a
  # repository's own required (including conformance) tests could pass unrun with nothing in the
  # brief format to ask for their measured results.
  f="$REPO_ROOT/skills/dev-team-orchestrator/references/task-brief-template.md"
  run grep -F 'Repository instructions and normative documents:' "$f"
  [ "$status" -eq 0 ]
  run grep -F 'Every test the repository requires for this kind of change has been run' "$f"
  [ "$status" -eq 0 ]
}

@test "checker-protocol: the independent-verification instruction for repository instructions is present" {
  # What this guards: checker-protocol.md is what turns "the lead said it follows the rules" into
  # an independently-checked claim. Without this instruction, a checker could accept a builder's
  # own say-so that a normative document was followed — exactly the "builder grades own work"
  # failure the suite's evidence-not-claims discipline exists to forbid everywhere else. The
  # escalation line matters too: without it, a real conflict with a normative document could be
  # silently fixed (or silently ignored) instead of being treated as the same weight as a failing
  # test.
  f="$REPO_ROOT/skills/dev-team-orchestrator/references/checker-protocol.md"
  run grep -F 'Verify repository-instruction / normative-document compliance independently.' "$f"
  [ "$status" -eq 0 ]
  run grep -F 'a change that conflicts with a named repository instruction or normative document' "$f"
  [ "$status" -eq 0 ]
}

@test "agents: every endpoint agent is told to read repository files the brief names, not just the brief" {
  # What this guards: agents/*.md is what the Task tool actually spawns. Even a perfectly-written
  # brief accomplishes nothing if the agent receiving it was never told to act on the repository
  # paths named inside it. Each of the five endpoint agents must say so in its own words — a count
  # of 5 rather than a single combined grep, so dropping the sentence from any ONE agent (not just
  # all of them at once) fails this test.
  count="$(grep -lF 'repository' "$REPO_ROOT"/agents/*.md | wc -l | tr -d ' ')"
  [ "$count" -eq 5 ]
  count="$(grep -lF 'normative document' "$REPO_ROOT"/agents/*.md | wc -l | tr -d ' ')"
  [ "$count" -eq 5 ]
}

# ---------------------------------------------------------------------------
# hooks/guard-dev-team.sh — default (no repo config) behavior
# ---------------------------------------------------------------------------

@test "guard: allows git push to main with no active run and no DEV_TEAM_GUARD" {
  unset DEV_TEAM_GUARD
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  [ "$status" -eq 0 ]
}

@test "guard: DEV_TEAM_GUARD=1 blocks git push to main" {
  export DEV_TEAM_GUARD=1
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  unset DEV_TEAM_GUARD
  [ "$status" -eq 2 ]
  [[ "$output" == *"Blocked"* ]]
}

@test "guard: DEV_TEAM_GUARD=1 blocks a live Stripe secret key" {
  export DEV_TEAM_GUARD=1
  run run_guard "$SCRATCH" '{"tool_input":{"command":"echo sk_live_abcDEF1234567890"}}'
  unset DEV_TEAM_GUARD
  [ "$status" -eq 2 ]
  [[ "$output" == *"live Stripe key"* ]]
}

@test "guard: DEV_TEAM_GUARD=1 allows a benign ls command" {
  export DEV_TEAM_GUARD=1
  run run_guard "$SCRATCH" '{"tool_input":{"command":"ls -la"}}'
  unset DEV_TEAM_GUARD
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# hooks/guard-dev-team.sh — .dev-team/config.yml guard: toggle matrix
# ---------------------------------------------------------------------------

@test "guard: config guard=off allows push to main with no override at all" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  guard: off\n' > "$SCRATCH/.dev-team/config.yml"
  unset DEV_TEAM_GUARD
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  [ "$status" -eq 0 ]
}

@test "guard: config guard=on blocks push to main with no active run" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  guard: on\n' > "$SCRATCH/.dev-team/config.yml"
  unset DEV_TEAM_GUARD
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  [ "$status" -eq 2 ]
}

@test "guard: config guard=auto allows push to main with no active run (fail-open)" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  guard: auto\n' > "$SCRATCH/.dev-team/config.yml"
  unset DEV_TEAM_GUARD
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  [ "$status" -eq 0 ]
}

@test "guard: no config file at all allows push to main with no active run (fail-open)" {
  unset DEV_TEAM_GUARD
  run run_guard "$SCRATCH" '{"tool_input":{"command":"git push origin main"}}'
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# hooks/guard-ledgers.sh — Rule 1 (marker-bearing content written outside .dev-team/)
# ---------------------------------------------------------------------------
# Rule 1 applies to a Write only, and stays on regardless of whether a run is active — see the
# header comment in hooks/guard-ledgers.sh for why. None of these tests set up .dev-team/
# autopilot.json or loop.lock/, on purpose, to keep that "stays on either way" claim honest.

@test "guard-ledgers: marker on line 2, top-level path, is denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: the same marker content is allowed at the .dev-team/ path" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".dev-team/FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: the same marker content is allowed at an absolute .dev-team/ path" {
  # $SCRATCH itself can carry a doubled slash on some machines (a trailing slash in $TMPDIR),
  # which "cd" quietly resolves away — so the path baked into the payload is resolved through
  # "cd ... && pwd" too, otherwise it would not literally match what $PWD reports inside the
  # hook's own subshell, and the fallback-to-$PWD prefix-strip in Correction 2 would not fire.
  scratch_resolved="$(cd "$SCRATCH" && pwd)"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"'"$scratch_resolved"'/.dev-team/FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a ledger-named file elsewhere in the tree (docs/FEATURES.md), outside .dev-team/, is still denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"docs/FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

# Fault found by a later reading of the hook: Rule 1 used to fire on ANY path outside .dev-team/
# that carried the marker, with no check on the file's NAME. That refused a Write of this very
# plugin's own test fixture, tests/fixtures/verdict.sample.json, whose whole purpose is to hold
# real marker-bearing sample content for the schema tests below — it is nobody's ledger, just a
# file that happens to quote the marker inside it. Rule 1 now also requires the file name to be one
# of the seven ledger names, so this fixture (named "verdict.sample.json", not "verdict.json") and
# any other non-ledger file that merely mentions the marker text pass straight through.
@test "guard-ledgers: this plugin's own verdict fixture, with its real content, is never blocked" {
  content="$(cat "$REPO_ROOT/tests/fixtures/verdict.sample.json")"
  payload="$(jq -n --arg fp "tests/fixtures/verdict.sample.json" --arg content "$content" \
    '{tool_name:"Write", tool_input:{file_path:$fp, content:$content}}')"
  run run_ledger_guard "$SCRATCH" "$payload"
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: marker content aimed at a file whose name is not a ledger name is allowed" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"notes/plan.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a user's own file with no marker is never blocked" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"FEATURES.md","content":"just plain text, no marker"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: an Edit (no line position, no marker check) is allowed with no run active" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"x"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: config guard=off allows marker content outside .dev-team/, even with an active run" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  guard: off\n' > "$SCRATCH/.dev-team/config.yml"
  # An active run has to be a REAL one for this test's name to be true — a committed
  # autopilot.json does not mean a cycle is running (see the Rule 2 tests below), so only
  # .dev-team/loop.lock/ actually makes "even with an active run" a fact rather than a claim.
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a marker on line 10 only does not trip the first-three-lines check" {
  content="l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\n<!-- dev-team: ledger=features schema=1.0 -->"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"notes.md","content":"'"$content"'"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: an empty payload is allowed" {
  run run_ledger_guard "$SCRATCH" '{}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a top-level verdict.json carrying the JSON marker is denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"verdict.json","content":"{\"dev-team\": \"ledger=verdict schema=1.0\"}"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

# Fault found by a later reading of the hook: the JSON marker match required exactly one space
# after the colon, so COMPACT json (no spaces at all — what a minifier or a hand-typed value would
# produce) was not recognised as the marker. These two prove both spacings are now caught the same
# way, and that a compact-marker write straight into .dev-team/ is still allowed as normal.
@test "guard-ledgers: a top-level verdict.json carrying the COMPACT JSON marker (no spaces) is denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"verdict.json","content":"{\"dev-team\":\"ledger=verdict schema=1.0\"}"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a top-level verdict.json carrying the SPACED JSON marker is still denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"verdict.json","content":"{\"dev-team\" : \"ledger=verdict schema=1.0\"}"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: the same compact JSON marker is allowed at the .dev-team/ path" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".dev-team/verdict.json","content":"{\"dev-team\":\"ledger=verdict schema=1.0\"}"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a MultiEdit inside .dev-team/ is allowed" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"MultiEdit","tool_input":{"file_path":".dev-team/PROJECT.md","edits":[{"old_string":"a","new_string":"b"}]}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: an absolute path is resolved against the payload's own cwd field, not the process's directory" {
  # Runs from a *different* scratch dir than the one named in the payload's "cwd" field, and from
  # one with no .dev-team/ of its own — proving the hook trusts the JSON field, not $PWD, when
  # deciding the path is inside .dev-team/. If it fell back to $PWD here it would wrongly deny.
  other="$(mktemp -d "${TMPDIR:-/tmp}/dev-team-bats.XXXXXX")"
  run run_ledger_guard "$other" '{"cwd":"'"$SCRATCH"'","tool_name":"Write","tool_input":{"file_path":"'"$SCRATCH"'/.dev-team/FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  rm -rf "$other"
  [ "$status" -eq 0 ]
}

# Fault found by a later reading of the hook: path handling used to strip a leading "<cwd>/" and
# then a leading "./" ONCE each, which is one pass, not a resolution. A path built from "." and
# ".." segments walks straight past a single strip — ".dev-team/../SECURITY.md" still starts with
# the literal text ".dev-team/" even though it actually names a file one level above it, and
# "././SECURITY.md" still starts with "./" after only one strip is removed. These prove the path is
# now resolved lexically (collapse every "." and every "x/.." pair) before either rule looks at it.
@test "guard-ledgers: \".dev-team/../SECURITY.md\" resolves to the top level, not to .dev-team/, and is denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".dev-team/../SECURITY.md","content":"line1\n<!-- dev-team: ledger=security schema=1.0 -->\nline3"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: \".dev-team/./FEATURES.md\" still resolves inside .dev-team/ and is allowed" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".dev-team/./FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

# Fault found by a stand-in review of the round above: "docs/../FEATURES.md" (the test this
# replaces) was already refused by the PRE-fix hook, because its base name is FEATURES.md and it
# sits outside .dev-team/ whether or not the "docs/.." part is ever resolved away — a broken
# resolve_lexical would not have failed that test. The same was true of the companion ALLOW test
# above (".dev-team/./FEATURES.md"): the raw text already starts with ".dev-team/", so it passed on
# the pre-fix hook too. Between the two, only ".dev-team/../SECURITY.md" (further above) actually
# depended on resolution — leaving the ALLOW direction of resolve_lexical completely unproven. This
# case only passes if "docs/.." is genuinely walked back out and ".dev-team/FEATURES.md" is
# genuinely walked back in: confirmed by running this exact payload through the hook at commit
# 0a2f286~1 (the version just before path resolution was added), which refuses it with exit 2 —
# see the builder's report for that command and its output.
@test "guard-ledgers: \"docs/../.dev-team/FEATURES.md\" resolves INTO .dev-team/ and is allowed" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"docs/../.dev-team/FEATURES.md","content":"line1\n<!-- dev-team: ledger=features schema=1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

# Fault found by a stand-in review of the round above: narrowing Rule 1 to the seven ledger names
# went one name too narrow. This plugin also writes its own fixed, marker-bearing
# .dev-team/README.md (conventions.md, "Where the plugin writes", point 7), but "readme.md" was
# missing from Rule 1's name list — so that same marker-bearing text, written to a project's
# top-level README.md by mistake, passed straight through and would have overwritten the project's
# real README. README.md is now in Rule 1's list too, but deliberately NOT in Rule 2's separate
# list (the third case below proves that).
@test "guard-ledgers: the plugin's readme marker on a top-level README.md is denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"README.md","content":"# x\n<!-- dev-team: ledger=readme schema=1.0 -->\nline3"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: the same readme marker content is allowed at the .dev-team/ path" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".dev-team/README.md","content":"# x\n<!-- dev-team: ledger=readme schema=1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: README.md is NOT on Rule 2's list, so mentioning F-001 mid-cycle is still allowed" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"README.md","new_string":"see F-001"}}'
  [ "$status" -eq 0 ]
}

# Fault found by a stand-in review of the round above: under macOS's stock /bin/bash (3.2),
# resolve_lexical's final join line broke for a path that resolves to NOTHING at all — every
# segment being ".", ".." or empty, as with file_path "." or "..". `set -u` makes bash 3.2 treat
# expanding the (now empty) $parts array with "${parts[*]}" as an unbound variable — a fault bash
# 4.4+ does not have. The write was still ALLOWED either way (an empty $resolved matches no rule),
# but the hook printed "line 188: parts[*]: unbound variable" to stderr, which looks exactly like
# the hook itself being broken. These two check both the exit code and that stderr is now silent —
# run with "--separate-stderr" so $output (stdout) and $stderr are captured apart from each other,
# because a combined capture could not tell "silent" from "printed a decision on one stream and
# nothing on the other".
@test "guard-ledgers: file_path \"..\" resolves to nothing, is allowed, and prints nothing to stderr" {
  run --separate-stderr run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"..","content":"x\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ]
  [ -z "$stderr" ]
}

@test "guard-ledgers: file_path \"SECURITY.md/..\" resolves to nothing, is allowed, and prints nothing to stderr" {
  run --separate-stderr run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"SECURITY.md/..","content":"x\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ]
  [ -z "$stderr" ]
}

# Fault found by a stand-in review of the round above: an absolute path that is still absolute
# after the "<cwd>/" strip — i.e. one that names somewhere outside the project entirely, such as
# "/.dev-team/SECURITY.md" with cwd set to some unrelated folder — used to have its leading "/"
# read as just another empty split piece and dropped, so it resolved to the plain text
# ".dev-team/SECURITY.md" and was wrongly judged to be inside THIS project's own .dev-team/. The
# path is now marked as having left the project (same as a runaway ".."), so Rule 1 judges it by
# file name alone and denies it.
@test "guard-ledgers: an absolute path outside cwd starting with /.dev-team/ is denied by file name" {
  run run_ledger_guard "$SCRATCH" '{"cwd":"'"$SCRATCH"'","tool_name":"Write","tool_input":{"file_path":"/.dev-team/SECURITY.md","content":"# x\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: an absolute path genuinely inside cwd's .dev-team/ is still allowed" {
  scratch_resolved="$(cd "$SCRATCH" && pwd)"
  run run_ledger_guard "$SCRATCH" '{"cwd":"'"$scratch_resolved"'","tool_name":"Write","tool_input":{"file_path":"'"$scratch_resolved"'/.dev-team/FEATURES.md","content":"# x\n<!-- dev-team: ledger=features schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# hooks/guard-ledgers.sh — a session started in a SUBFOLDER of the repository
# (issue #41, Codex round 3, finding 5)
# ---------------------------------------------------------------------------
# Fault found by review: the hook used to take the payload's "cwd" AS the project's top folder. From
# a subfolder that went wrong in both directions: a harmful write to the real top-level SECURITY.md
# (given as an absolute path, or as "../SECURITY.md") counted as "outside the project" and was let
# through, the top-level .dev-team/loop.lock/ and .dev-team/config.yml were never found (so
# "guard: off" was ignored), and the plugin's own correct write to the absolute
# "<top>/.dev-team/SECURITY.md" was wrongly refused. The hook now asks git
# ("rev-parse --show-prefix") where the working folder sits inside the repository, and judges paths,
# config and the lock against the TOP folder it works out from that. Each test below creates its own
# throwaway git repository under $SCRATCH (removed by teardown() like any other scratch dir — never
# $REPO_ROOT) with a "src" subfolder, and passes "cwd" pointing at that subfolder in the payload,
# exactly as Claude Code would for a session started there.

@test "guard-ledgers: a session started in a subfolder still sees the top-level lock and protects the top-level SECURITY.md (absolute path)" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src" "$s/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"'"$s"'/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a session started in a subfolder still protects the top-level SECURITY.md via a relative \"../\" path" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src" "$s/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"../SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
}

@test "guard-ledgers: the plugin's own absolute .dev-team write from a subfolder is allowed" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Write","tool_input":{"file_path":"'"$s"'/.dev-team/SECURITY.md","content":"# x\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: the plugin's own relative \"../.dev-team/\" write from a subfolder is allowed" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Write","tool_input":{"file_path":"../.dev-team/FEATURES.md","content":"# x\n<!-- dev-team: ledger=features schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: guard: off at the top level is honoured from a subfolder" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src" "$s/.dev-team"
  printf 'guard: off\n' > "$s/.dev-team/config.yml"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Write","tool_input":{"file_path":"../SECURITY.md","content":"# x\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a subfolder session's own relative ledger name is now protected too (round-4 stand-in verification, finding B)" {
  # Fault fixed: this test used to pin exit 0, on the reasoning that only the git TOP folder's
  # SECURITY.md is anyone's ledger, so "SECURITY.md" typed from "src" (really "src/SECURITY.md")
  # was nobody's business to protect. But the section further below this one, and the hook's own
  # header comment, establish something this test used to ignore: every skill in this plugin
  # writes ".dev-team/<name>" RELATIVE to the session's own working folder, not the git top. So a
  # stale instruction telling a scribe to "append the findings to SECURITY.md" lands on
  # "src/SECURITY.md" — before v1.5.0 that genuinely was where a subfolder session's ledger went,
  # and today it may be that package's own security policy or feature list. The hook before fix
  # round 3 (commit f58a08a, where the project root WAS taken to be the session's cwd) refused
  # exactly this write; round 3 deliberately allowed it (this test, until now); round 4 kept that
  # gap open even while starting to treat "src/.dev-team/" as the session's own plugin folder for
  # everything else. See hooks/guard-ledgers.sh, Rule 2, "why ADDITIVE (both places)", for why the
  # fix protects BOTH the top-level names and the session folder's own names, rather than picking
  # one: the written documents and the skills disagree about which one is really "the top level",
  # and protecting both is correct whichever way that question is eventually settled by the owner.
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src" "$s/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-001"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: outside git the hook falls back to cwd as the top folder (documented limit)" {
  # Deliberately no "git init" — this pins the documented remaining limit (see the hook's "What
  # this hook CANNOT do" list): outside a git repository, a session started in a subfolder is still
  # judged as if that subfolder were the top, so the top-level lock is never seen and this write is
  # wrongly allowed. Guarded against $SCRATCH itself sitting inside some OTHER git repository on the
  # machine running the test (which would make "git -C $SCRATCH rev-parse" succeed and this test
  # meaningless) by skipping in that case rather than silently passing for the wrong reason.
  s="$SCRATCH"
  if git -C "$s" rev-parse >/dev/null 2>&1; then
    skip "\$SCRATCH is unexpectedly inside a git repository on this machine"
  fi
  mkdir -p "$s/.dev-team/loop.lock" "$s/src"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"'"$s"'/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: the subfolder fix also works from two levels deep" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src/deep" "$s/.dev-team/loop.lock"
  run run_ledger_guard "$s/src/deep" '{"cwd":"'"$s"'/src/deep","tool_name":"Edit","tool_input":{"file_path":"../../SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
}

# ---------------------------------------------------------------------------
# hooks/guard-ledgers.sh — a session's OWN .dev-team/ inside its subfolder (new finding, round 4)
# ---------------------------------------------------------------------------
# Fault fixed: the subfolder fix just above went too far the other way. It counted only the TOP
# folder's .dev-team/ as ".dev-team/" and read config.yml and loop.lock/ only from the top folder.
# But every skill in this plugin writes ".dev-team/<name>" relative to the SESSION folder, and
# /dev-team-config init creates config.yml there too — so from "src" (a monorepo package, say), the
# plugin's own correct write to "src/.dev-team/PROJECT.md" (given as an absolute or a relative path)
# was refused, telling the caller to write it under .dev-team/ — where it already was — and
# "guard: off" written into "src/.dev-team/config.yml" (where /dev-team-config init puts it) was
# ignored. The hook now also counts "<sub>/.dev-team/" as inside .dev-team/, and reads config.yml and
# loop.lock/ from BOTH the session folder and the top folder, "off" and "an active lock" each winning
# from either place. Each test below builds its own throwaway git repository under $SCRATCH with a
# "src" subfolder, same as the section above.

@test "guard-ledgers: the plugin's own absolute write to the SESSION folder's own .dev-team/ is allowed" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Write","tool_input":{"file_path":"'"$s"'/src/.dev-team/PROJECT.md","content":"# x\n<!-- dev-team: ledger=project schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: the plugin's own relative write to the SESSION folder's own .dev-team/ is allowed" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Write","tool_input":{"file_path":".dev-team/PROJECT.md","content":"# x\n<!-- dev-team: ledger=project schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: without a session-folder config.yml, a harmful top-level write from a subfolder is still denied (control)" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Write","tool_input":{"file_path":"'"$s"'/SECURITY.md","content":"# x\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}'
  [ "$status" -eq 2 ]
}

@test "guard-ledgers: guard: off in the SESSION folder's own config.yml is honoured" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src/.dev-team"
  printf 'guard: off\n' > "$s/src/.dev-team/config.yml"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Write","tool_input":{"file_path":"'"$s"'/SECURITY.md","content":"# x\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: guard: off in the SESSION folder wins over guard: on at the top" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src/.dev-team" "$s/.dev-team/loop.lock"
  printf 'guard: on\n' > "$s/.dev-team/config.yml"
  printf 'guard: off\n' > "$s/src/.dev-team/config.yml"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"'"$s"'/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: guard: on in the SESSION folder's config forces Rule 2 on with no lock anywhere" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src/.dev-team"
  printf 'guard: on\n' > "$s/src/.dev-team/config.yml"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"'"$s"'/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
}

@test "guard-ledgers: loop.lock/ only in the SESSION folder still counts as an active run for the top-level file" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"'"$s"'/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
}

@test "guard-ledgers: a trailing slash on cwd does not defeat the top-folder match" {
  # Fault fixed: "case \"\$base\" in */\"\$prefix\")" needs cwd's TEXT to end in git's prefix
  # ("src"). A cwd sent as "<repo>/src/" does not end in "src", so before this fix the top folder was
  # never found, "<repo>/SECURITY.md" was judged outside the project, and this harmful Edit was let
  # through.
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src" "$s/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src/","tool_name":"Edit","tool_input":{"file_path":"'"$s"'/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
}

@test "guard-ledgers: \".dev-team/../SECURITY.md\" from a subfolder resolves out of the session's own .dev-team/ and is still denied" {
  # Proves the new "<sub>/.dev-team/" match cannot be tricked with a ".." into thinking a file just
  # outside the session's own .dev-team/ is still inside it.
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Write","tool_input":{"file_path":".dev-team/../SECURITY.md","content":"# x\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}'
  [ "$status" -eq 2 ]
}

@test "guard-ledgers: cwd \"/\" does not crash the trailing-slash strip" {
  # "/" is the one value the trailing-slash strip must leave alone (see the hook's own comment) —
  # this pins that a root cwd is handled without a crash, whichever way Rule 1 ends up deciding the
  # write (this machine's filesystem root may or may not itself be a git repository, so either
  # decision is accepted). A genuine refusal prints the hook's own "dev-team guard:" message on
  # stderr, which is fine; what must never appear is a bash error such as an unbound-variable message
  # (the fault an earlier round found and fixed for a path that resolves to nothing — see the
  # "resolve_lexical" fault note in the hook's own header comment).
  run --separate-stderr run_ledger_guard "$SCRATCH" '{"cwd":"/","tool_name":"Write","tool_input":{"file_path":"/SECURITY.md","content":"# x\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ] || [ "$status" -eq 2 ]
  if [ "$status" -eq 0 ]; then
    [ -z "$stderr" ]
  else
    [[ "$stderr" == *"dev-team guard"* ]]
    [[ "$stderr" != *"unbound variable"* ]]
  fi
}

# ---------------------------------------------------------------------------
# hooks/guard-ledgers.sh — Rule 2 also protects a subfolder session's OWN top-level ledger names
# (round-4 stand-in verification, finding B)
# ---------------------------------------------------------------------------
# Fault fixed: the section above this one (finding 5) and the round-4 section before it fixed how
# the hook finds .dev-team/, config.yml and loop.lock/ from a subfolder session — but neither one
# touched Rule 2's own list of PROTECTED NAMES, which still matched only the seven ledger names at
# the git TOP folder. So the flipped test just above this section used to pin exit 0 for exactly
# the failure this whole change exists to stop, one folder down: a stale instruction that appends
# findings to a RELATIVE "SECURITY.md" from a subfolder session lands on that subfolder's own file,
# and Rule 2 never fired for it, even with the subfolder's own loop.lock/ present and genuinely
# active. Rule 2 now ALSO matches the seven ledger names sitting directly inside the session's own
# subfolder — additive to the top-level list, never instead of it (see the hook's own Rule 2 code,
# "why ADDITIVE", for the reasoning) — but deliberately NOT "<sub>/.github/security.md" or
# "<sub>/docs/security.md" (GitHub only ever reads a security policy from the repository's top, its
# .github/, or its docs/ — never a subfolder's own copies of those, and this plugin never wrote a
# ledger there either), and NOT anything deeper than the subfolder's own top level (none of the
# seven names contains a "/", so a path like "src/deep/SECURITY.md" can never match). Each test
# below builds its own throwaway git repository under $SCRATCH with a "src" subfolder, the same
# convention the sections above use.

@test "guard-ledgers: the subfolder's own SECURITY.md is protected with the lock ONLY in the session's own .dev-team/" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: the subfolder's own SECURITY.md is protected by its absolute path too" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src" "$s/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"'"$s"'/src/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
}

@test "guard-ledgers: the subfolder's own FEATURES.md is protected the same way" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src" "$s/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"FEATURES.md","new_string":"FG-001 done"}}'
  [ "$status" -eq 2 ]
}

@test "guard-ledgers: a path one level below the subfolder is NOT matched (control)" {
  # Only the session folder's OWN top-level names are protected. None of the seven names contains
  # a "/", so "cut the sub prefix, compare what is left" can never match anything deeper.
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src" "$s/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"deep/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: the subfolder's own .github/ and docs/ SECURITY.md are NOT matched (control)" {
  # Deliberately excluded (unlike the top-level list, which DOES cover .github/ and docs/): GitHub
  # only reads a repository's security policy from the repository's top, its .github/, or its
  # docs/ — never a subfolder's .github/ or docs/ — and this plugin never wrote a ledger there
  # either, so matching them would widen the rule without guarding against a real mistake.
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src" "$s/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":".github/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"docs/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: with no lock and no guard setting anywhere, the subfolder's own SECURITY.md is not blocked" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"'"$s"'/src/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a subfolder named with a glob character is matched literally, never as a wildcard" {
  # $sub is quoted both where the hook tests it and where it cuts the prefix off, so a folder
  # literally named "s*" protects only a path that really starts with "s*/" — it never widens into
  # a pattern that would also catch an unrelated sibling folder such as "sx".
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/s*/.dev-team/loop.lock" "$s/sx"
  run run_ledger_guard "$s/s*" '{"cwd":"'"$s"'/s*","tool_name":"Edit","tool_input":{"file_path":"'"$s"'/sx/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
  run run_ledger_guard "$s/s*" '{"cwd":"'"$s"'/s*","tool_name":"Edit","tool_input":{"file_path":"'"$s"'/s*/SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
}

@test "guard-ledgers: guard: off in the subfolder's own config.yml also clears the subfolder's own ledger-name protection" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src/.dev-team/loop.lock"
  printf 'guard: off\n' > "$s/src/.dev-team/config.yml"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: a plain edit to the subfolder's own SECURITY.md, with no marker and no record id, is still allowed" {
  git init -q "$SCRATCH"
  s="$(cd "$SCRATCH" && pwd)"
  mkdir -p "$s/src" "$s/.dev-team/loop.lock"
  run run_ledger_guard "$s/src" '{"cwd":"'"$s"'/src","tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"our own policy text, no ids here"}}'
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# hooks/guard-ledgers.sh — the legacy (pre-v1.5.0) marker
# (issue #41, Codex round 3, finding 7)
# ---------------------------------------------------------------------------
# Fault found by review: conventions.md still accepts the legacy marker,
# "<!-- dev-team-schema: 1.0 -->", as proof that the plugin owns a file (point 3) — but the hook's
# marker pattern only recognised the CURRENT marker forms, so a Write (or, mid-cycle, an Edit)
# carrying only the legacy marker to a top-level ledger name passed straight through both rules. The
# pattern now includes the legacy marker too.

@test "guard-ledgers: the legacy marker on a top-level SECURITY.md Write is denied" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"SECURITY.md","content":"# S\n<!-- dev-team-schema: 1.0 -->\nline3"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: the same legacy-marker content is allowed at .dev-team/SECURITY.md" {
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".dev-team/SECURITY.md","content":"# S\n<!-- dev-team-schema: 1.0 -->\nline3"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: the legacy marker on line 10 only does not trip the first-three-lines check" {
  content="1\n2\n3\n4\n5\n6\n7\n8\n9\n<!-- dev-team-schema: 1.0 -->"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"FEATURES.md","content":"'"$content"'"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: an Edit adding the legacy marker to top-level FEATURES.md mid-cycle is denied" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"FEATURES.md","new_string":"<!-- dev-team-schema: 1.0 -->"}}'
  [ "$status" -eq 2 ]
}

# ---------------------------------------------------------------------------
# hooks/guard-ledgers.sh — a symlinked .dev-team/ path (finding 6, "What this hook CANNOT do")
# ---------------------------------------------------------------------------
# The fix specification for finding 6 called for a bats case pinning a KNOWN, DOCUMENTED limit of
# this hook, not a claim that the limit has been fixed: the hook judges a path by its text alone and
# never follows a symbolic link (see the hook's own "What this hook CANNOT do" list). So if
# .dev-team/SECURITY.md is itself a link pointing back out to the project's real top-level
# SECURITY.md, the hook sees the text ".dev-team/SECURITY.md", counts it as inside .dev-team/, and
# allows the write — even though the write can end up landing on the real file the hook exists to
# protect. This is deliberate: resolving links physically was considered and rejected (see the header
# comment), because it would also refuse every ledger write in a project that links its .dev-team/
# folder elsewhere on purpose, and because macOS reporting /private/var for /var defeats a plain text
# comparison against a physically-resolved path anyway. Whether Claude Code's own Write/Edit tools
# follow such a link the same way an ordinary shell redirect does was NOT checked here — this test
# only pins what this hook itself decides.
@test "guard-ledgers: a symlinked .dev-team/SECURITY.md is judged by its text path, not what it points to (known, documented limit)" {
  git init -q "$SCRATCH"
  printf 'the project'"'"'s own real policy\n' > "$SCRATCH/SECURITY.md"
  mkdir -p "$SCRATCH/.dev-team"
  ln -s ../SECURITY.md "$SCRATCH/.dev-team/SECURITY.md"
  # The hook allows this: the text ".dev-team/SECURITY.md" resolves inside .dev-team/, so Rule 1
  # never even asks what the path actually points to.
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".dev-team/SECURITY.md","content":"# S\n<!-- dev-team: ledger=security schema=1.0 -->\n"}}'
  [ "$status" -eq 0 ]
  # Ordinary shell redirection through that same symlink — used here only as a stand-in for what
  # some write path MIGHT do, not a claim about Claude Code's own Write tool, which was not tested —
  # does land on the real top-level file. This is what makes the limit above worth documenting rather
  # than a difference that never shows up in practice.
  printf '# S\n<!-- dev-team: ledger=security schema=1.0 -->\n' > "$SCRATCH/.dev-team/SECURITY.md"
  run cat "$SCRATCH/SECURITY.md"
  [[ "$output" == *"dev-team: ledger=security"* ]]
}

# ---------------------------------------------------------------------------
# hooks/guard-ledgers.sh — Rule 2 (top-level ledger names, active-run gate)
# ---------------------------------------------------------------------------
# This replaces the plan's first draft, which gated Rule 2 on ".dev-team/autopilot.json exists" —
# rejected once real projects turned up that commit autopilot.json to git, which would have made
# the rule permanently on and stopped a project owner editing their own top-level HANDOFF.md or
# FEATURES.md forever (see .claude/plans/ledger-file-clashes/plan-review.md, Correction 1). Gated
# instead on .dev-team/loop.lock/ (created only for the length of one autopilot cycle and never
# committed), or guard: on, or DEV_TEAM_GUARD.

@test "guard-ledgers: a committed autopilot.json alone never blocks your own file" {
  mkdir -p "$SCRATCH/.dev-team"
  : > "$SCRATCH/.dev-team/autopilot.json"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"HANDOFF.md","content":"plain text, no ids"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: Rule 2 is off without a live cycle, even with an id in the content" {
  mkdir -p "$SCRATCH/.dev-team"
  : > "$SCRATCH/.dev-team/autopilot.json"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: the SIGNula.id failure (findings appended to the project's own SECURITY.md) is blocked mid-cycle" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a project's own feature list can still be updated mid-cycle" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"FEATURES.md","new_string":"Added the Forms app"}}'
  [ "$status" -eq 0 ]
}

@test "guard-ledgers: GitHub's own security-policy locations are covered too" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":".github/SECURITY.md","content":"FG-012 something"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

# Fault found by a later reading of the hook: the ledger-name match compared capitals only. On a
# filesystem that ignores case (macOS, by default) "security.md" and "SECURITY.md" are the very
# same file on disk, so a write spelled in a different case must be caught exactly the same way.
@test "guard-ledgers: a lower-case \"security.md\" is caught the same as SECURITY.md" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"security.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a mixed-case \"Features.md\" is caught the same as FEATURES.md" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"Features.md","new_string":"FG-003 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

# Same path-normalisation fault as the Rule 1 tests above, checked here against Rule 2: a single
# strip of "<cwd>/" and "./" left a repeated or doubled "./" prefix untouched, so a path spelled
# with extra "." or ".." segments walked past the top-level-name match entirely.
@test "guard-ledgers: \"././SECURITY.md\" still resolves to the top-level name and is denied mid-cycle" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"././SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: \"a/b/../../PROJECT.md\" resolves to the top-level name and is denied mid-cycle" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"a/b/../../PROJECT.md","new_string":"B-004 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a MultiEdit is checked across every one of its edits, not just the first" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"MultiEdit","tool_input":{"file_path":"PROJECT.md","edits":[{"old_string":"a","new_string":"nothing interesting here"},{"old_string":"c","new_string":"B-004 fixed"}]}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: config guard=on forces Rule 2 on with no lock file present" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  guard: on\n' > "$SCRATCH/.dev-team/config.yml"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Write","tool_input":{"file_path":"PROJECT.md","content":"B-001 open"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: config guard=off wins over a lock file that is still present" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  printf 'features:\n  guard: off\n' > "$SCRATCH/.dev-team/config.yml"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-001 fixed"}}'
  [ "$status" -eq 0 ]
}

# Fault fixed (round-4 stand-in verification, finding A): id_pattern used to require EXACTLY three
# digits followed by a word boundary right after the third one, so a fourth digit broke the match —
# "F-1000" walked straight past Rule 2 while "F-999" was refused on the very same edit. Nothing
# caps a project's record counter at 999, ids are never reused, and the verdict schema already
# allows "at least three digits" (^V-[0-9]{3,}$, see schemas/verdict.schema.json). The pattern now
# uses "{3,}" — three OR MORE digits — so it agrees with the schema.
@test "guard-ledgers: a four-digit record id (F-1000) is caught the same as a three-digit one" {
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-1000 fixed"}}'
  [ "$status" -eq 2 ]
  [[ "$output" == *"dev-team guard"* ]]
}

@test "guard-ledgers: a two-digit id (F-12) still does not match, pinning the pattern's lower bound" {
  # The plugin always zero-pads its own ids to at least three digits, so a two-digit form like this
  # one is far more likely to be a person's own text (a version number, a step count) than one of
  # this plugin's own record ids. Deliberately NOT widened along with the fix above.
  mkdir -p "$SCRATCH/.dev-team/loop.lock"
  run run_ledger_guard "$SCRATCH" '{"tool_name":"Edit","tool_input":{"file_path":"SECURITY.md","new_string":"F-12 fixed"}}'
  [ "$status" -eq 0 ]
}

# ---------------------------------------------------------------------------
# hooks/check-update.sh
# ---------------------------------------------------------------------------

@test "check-update: DEV_TEAM_NO_UPDATE_CHECK=1 exits 0 with no output" {
  run env DEV_TEAM_NO_UPDATE_CHECK=1 bash "$REPO_ROOT/hooks/check-update.sh"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "check-update: fails open (exit 0) with CLAUDE_PLUGIN_ROOT/DATA unset" {
  run env -u DEV_TEAM_NO_UPDATE_CHECK -u CLAUDE_PLUGIN_ROOT -u CLAUDE_PLUGIN_DATA \
    bash -c "cd '$SCRATCH' && bash '$REPO_ROOT/hooks/check-update.sh'"
  [ "$status" -eq 0 ]
}

@test "check-update: config update-notifier=off exits 0 with no output" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  update-notifier: off\n' > "$SCRATCH/.dev-team/config.yml"
  run env -u DEV_TEAM_NO_UPDATE_CHECK \
    bash -c "cd '$SCRATCH' && bash '$REPO_ROOT/hooks/check-update.sh'"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# ---------------------------------------------------------------------------
# hooks/sync-branches-check.sh
# ---------------------------------------------------------------------------

@test "sync-branches-check: DEV_TEAM_NO_BRANCH_CHECK=1 exits 0 with no output" {
  run env DEV_TEAM_NO_BRANCH_CHECK=1 bash "$REPO_ROOT/hooks/sync-branches-check.sh"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "sync-branches-check: config branch-notifier=off exits 0 with no output" {
  mkdir -p "$SCRATCH/.dev-team"
  printf 'features:\n  branch-notifier: off\n' > "$SCRATCH/.dev-team/config.yml"
  run env -u DEV_TEAM_NO_BRANCH_CHECK \
    bash -c "cd '$SCRATCH' && bash '$REPO_ROOT/hooks/sync-branches-check.sh'"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# ---------------------------------------------------------------------------
# schemas/verdict.schema.json
# ---------------------------------------------------------------------------
# check-jsonschema is a Python tool (pip install check-jsonschema) that CI always has (see
# .github/workflows/plugin-audit.yml) but a local dev machine might not. These tests skip —
# never fail — when it is missing locally, so a contributor without it installed still gets a
# green run; CI is where this actually gets checked every time.

@test "verdict-schema: the sample fixture validates" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$REPO_ROOT/tests/fixtures/verdict.sample.json"
  [ "$status" -eq 0 ]
}

@test "verdict-schema: an invalid overall value fails validation" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  bad="$SCRATCH/verdict-bad.json"
  jq '.overall = "MAYBE"' "$REPO_ROOT/tests/fixtures/verdict.sample.json" > "$bad"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$bad"
  [ "$status" -ne 0 ]
}

# ---------------------------------------------------------------------------
# schemas/verdict.schema.json — the four protocol-invariant "allOf" rules, and
# scripts/check-verdict.sh — the invariants JSON Schema itself cannot express
# (issue #41, Codex round 3, findings 12 and 13; round-4 stand-in verification, finding C)
# ---------------------------------------------------------------------------
# Before this fix the schema accepted verdict shapes verdict-and-report-protocol.md's own "Overall
# verdict rule" already calls impossible — e.g. overall PASS while the integration check failed, or
# overall PASS with a critical FAILED claim. The fixtures below (already validated by hand against
# both tools — see the builders' reports for issue #41, findings 12 and C) each break exactly one
# of the four "allOf" rules; the schema tests skip (never fail) when check-jsonschema is not
# installed, matching the pattern the two tests above already use. check-verdict.sh checks four
# further invariants no JSON Schema "if/then" can express at all (counting across the claims array,
# comparing one claim's field against another) — those tests skip when "jq" is missing, since the
# script itself needs it to run.
#
# Finding C (round-4 stand-in verification): the first three rules only ever pushed the verdict
# TOWARDS FAIL (integration failed, or a critical claim FAILED) — nothing stopped a producer
# writing "overall": "FAIL" on its own with NEITHER cause true, which the protocol calls just as
# impossible as a PASS with a failed integration check (verdict-and-report-protocol.md, "Overall
# verdict rule": "FAIL — any critical done-criterion / feature / security claim FAILED, or the
# integration check failed"). A fourth "allOf" rule now requires a FAIL verdict to show one of
# those two causes elsewhere in the file. The two new tests below use the two new fixtures: one
# FAIL with neither cause (must be rejected), and one FAIL caused only by a failed integration
# check with every claim VERIFIED (must still validate — the second branch of the new rule's
# "anyOf", otherwise untested by the pre-existing verdict.valid-fail-critical-failed.json fixture,
# whose own cause is a critical FAILED claim).

@test "verdict-schema: PASS with failed integration is rejected" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$REPO_ROOT/tests/fixtures/verdict.invalid-pass-with-failed-integration.json"
  [ "$status" -ne 0 ]
}

@test "verdict-schema: PASS_WITH_GAPS with failed integration is rejected" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$REPO_ROOT/tests/fixtures/verdict.invalid-integration-fail-not-fail.json"
  [ "$status" -ne 0 ]
}

@test "verdict-schema: PASS_WITH_GAPS with a critical FAILED claim is rejected" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$REPO_ROOT/tests/fixtures/verdict.invalid-critical-failed-not-fail.json"
  [ "$status" -ne 0 ]
}

@test "verdict-schema: overall PASS with a critical DRIFTED claim is rejected" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$REPO_ROOT/tests/fixtures/verdict.invalid-pass-with-critical-drifted.json"
  [ "$status" -ne 0 ]
}

@test "verdict-schema: FAIL with a critical FAILED claim validates" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$REPO_ROOT/tests/fixtures/verdict.valid-fail-critical-failed.json"
  [ "$status" -eq 0 ]
}

@test "verdict-schema: FAIL with no cause (neither a failed integration check nor a critical FAILED claim) is rejected" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$REPO_ROOT/tests/fixtures/verdict.invalid-fail-without-cause.json"
  [ "$status" -ne 0 ]
}

@test "verdict-schema: FAIL caused only by a failed integration check, with no FAILED claim, still validates" {
  # Pins the second branch of the new rule's "anyOf" — verdict.valid-fail-critical-failed.json
  # already pins the first branch (a critical FAILED claim), so without this fixture a FAIL caused
  # only by integration failure would be untested.
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$REPO_ROOT/tests/fixtures/verdict.valid-fail-integration-failed.json"
  [ "$status" -eq 0 ]
}

@test "verdict-schema: the protocol's own JSON example is valid" {
  command -v check-jsonschema >/dev/null 2>&1 || skip "check-jsonschema not installed"
  sed -n '/^```json$/,/^```$/p' "$REPO_ROOT/skills/dev-team-review/references/verdict-and-report-protocol.md" \
    | sed '1d;$d' > "$SCRATCH/proto.json"
  run check-jsonschema --schemafile "$REPO_ROOT/schemas/verdict.schema.json" "$SCRATCH/proto.json"
  [ "$status" -eq 0 ]
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$SCRATCH/proto.json"
  [ "$status" -eq 0 ]
}

@test "verdict-schema: finding 13's wrong severity wording is gone" {
  # The schema used to say "A FAILED or DRIFTED claim at 'critical' severity is what forces the
  # overall verdict to FAIL" — wrong: the protocol, and the sample fixture's own V-003, treat a
  # critical DRIFTED claim as PASS_WITH_GAPS, not FAIL.
  run grep -F "FAILED or DRIFTED claim at" "$REPO_ROOT/schemas/verdict.schema.json"
  [ "$status" -eq 1 ]
}

@test "check-verdict: the sample fixture passes" {
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$REPO_ROOT/tests/fixtures/verdict.sample.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"VERDICT-CHECK OK"* ]]
}

@test "check-verdict: a checked/claims-length mismatch is rejected" {
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$REPO_ROOT/tests/fixtures/verdict.invalid-checked-mismatch.json"
  [ "$status" -eq 1 ]
  [[ "$output" == *"claims list length"* ]]
}

@test "check-verdict: a count that does not add up to checked is rejected" {
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$REPO_ROOT/tests/fixtures/verdict.invalid-count-mismatch.json"
  [ "$status" -eq 1 ]
  [[ "$output" == *"do not add up"* ]]
}

@test "check-verdict: a duplicate claim id is rejected" {
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$REPO_ROOT/tests/fixtures/verdict.invalid-duplicate-id.json"
  [ "$status" -eq 1 ]
  [[ "$output" == *"not unique"* ]]
}

@test "check-verdict: an empty claims list is rejected" {
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$REPO_ROOT/tests/fixtures/verdict.invalid-empty-claims.json"
  [ "$status" -eq 1 ]
}

@test "check-verdict: the FAIL-with-no-cause fixture still passes check-verdict.sh's own rules (only the schema rejects it)" {
  # Proves finding C's fixture is a well-formed, self-consistent verdict by check-verdict.sh's own
  # four counting rules — nothing here is broken about it, its claims list length, counts and ids
  # all agree with each other. The schema is the only thing that calls it impossible, because it is
  # the only place the "overall FAIL needs a cause" rule lives (see the verdict-schema tests above).
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$REPO_ROOT/tests/fixtures/verdict.invalid-fail-without-cause.json"
  [ "$status" -eq 0 ]
  [[ "$output" == *"VERDICT-CHECK OK"* ]]
}

@test "check-verdict: invalid JSON is refused with exit 2, matching the header's own definition" {
  # Round-4 stand-in verification: the header (see the script's own comment, "Exit codes") already
  # said exit 2 covers "the file is not valid JSON" — nothing was checked — but the code used to
  # print that same message and then exit 1, the code for "read, valid JSON, but fails a rule". A
  # caller sorting exit 1 from exit 2 would have read a truncated or corrupt verdict.json as a
  # checked-and-failed review rather than as a checker that could not run at all.
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  printf '%s' '{not json' > "$SCRATCH/bad.json"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$SCRATCH/bad.json"
  [ "$status" -eq 2 ]
  [[ "$output" == *"not valid JSON"* ]]
}

# Fault fixed (round-4 stand-in verification, finding N2): the validity test above used to be
# "jq empty", which only checks that its input parses at all and then discards whatever it parsed
# to — it does not care whether the input was empty, whitespace-only, or held several JSON values
# back to back, so all three of those returned 0 from "jq empty" and went on to fail all eight rule
# checks below, exiting 1 ("checked, and it failed") when the true state was "nothing was checked
# at all". An interrupted write that leaves .dev-team/verdict.json empty is exactly the ordinary
# case this let slip through. The test is now "jq -s -e 'length == 1 and (.[0] | type == \"object\")'",
# which slurps the whole file into an array first: empty or whitespace-only input slurps to a
# zero-length array (rejected), and two values back to back slurp to a two-element array (rejected)
# — both now correctly refused with exit 2 rather than silently run through the rules below.
@test "check-verdict: a zero-byte file is refused with exit 2, not run through the rule checks" {
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  printf '' > "$SCRATCH/empty.json"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$SCRATCH/empty.json"
  [ "$status" -eq 2 ]
  [[ "$output" == *"not valid JSON"* ]]
}

@test "check-verdict: a whitespace-only file is refused with exit 2" {
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  printf '   \n\t\n' > "$SCRATCH/ws.json"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$SCRATCH/ws.json"
  [ "$status" -eq 2 ]
  [[ "$output" == *"not valid JSON"* ]]
}

@test "check-verdict: a file holding two JSON values back to back is refused with exit 2, not judged as the last one" {
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  printf '{} {}' > "$SCRATCH/two.json"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$SCRATCH/two.json"
  [ "$status" -eq 2 ]
  [[ "$output" == *"not valid JSON"* ]]
}

@test "check-verdict: a bare JSON scalar (42) is refused with exit 2, not treated as a rule failure" {
  # "42" is syntactically valid JSON by itself, but every rule below reads a FIELD off the top
  # level (.checked, .claims, and so on) — a bare number has no fields, so it cannot be checked any
  # more than an empty file can. The header's own exit-code paragraph was updated to say so, rather
  # than leaving a bare scalar to exit 1 as though it were an object that failed every rule.
  command -v jq >/dev/null 2>&1 || skip "jq not installed"
  printf '42' > "$SCRATCH/scalar.json"
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$SCRATCH/scalar.json"
  [ "$status" -eq 2 ]
  [[ "$output" == *"not valid JSON"* ]]
}

@test "check-verdict: a missing file is refused, not passed" {
  run bash "$REPO_ROOT/scripts/check-verdict.sh" "$SCRATCH/does-not-exist.json"
  [ "$status" -eq 2 ]
}

@test "check-verdict: missing jq is refused, not passed" {
  # A throwaway directory containing only a symlink to bash — nothing else — put on PATH, so
  # "command -v jq" inside check-verdict.sh finds nothing, while bash itself is still runnable.
  mkdir -p "$SCRATCH/nojq"
  ln -s "$(command -v bash)" "$SCRATCH/nojq/bash"
  run env PATH="$SCRATCH/nojq" bash "$REPO_ROOT/scripts/check-verdict.sh" "$REPO_ROOT/tests/fixtures/verdict.sample.json"
  [ "$status" -eq 2 ]
  [[ "$output" == *"jq"* ]]
}

# ---------------------------------------------------------------------------
# scripts/branch-hygiene.sh
# ---------------------------------------------------------------------------

@test "branch-hygiene: --no-fetch is read-only and prints the three status lines" {
  before="$(git -C "$REPO_ROOT" branch --format='%(refname:short)' | sort)"
  run bash -c "cd '$REPO_ROOT' && bash scripts/branch-hygiene.sh --no-fetch"
  after="$(git -C "$REPO_ROOT" branch --format='%(refname:short)' | sort)"
  [ "$status" -eq 0 ]
  [[ "$output" == *"default-branch:"* ]]
  [[ "$output" == *"merged-safe-to-delete:"* ]]
  [[ "$output" == *"skipped:"* ]]
  [ "$before" = "$after" ]
}

# ---------------------------------------------------------------------------
# this file's own hygiene (issue #41, Codex round 3, finding 11; broadened round 4; broadened again
# by round-4 stand-in verification, finding N3)
# ---------------------------------------------------------------------------
# Pins the fix for finding 11: no test in this file may delete anything under $REPO_ROOT, write a
# file directly into it, change it with git or sed, or cd into it except in the two places already
# proven read-only. This is what makes make_tree() (near the top of this file) load-bearing rather
# than optional — a future test added carelessly, in the old style, would delete or overwrite a real
# path in this repository on every run, including a contributor's own untracked files. Every pattern
# below is split with string concatenation / a mid-word escape so that this test's OWN source lines
# are never mistaken for what it is checking for.
#
# Fault fixed (round 4 stand-in verification): each of the two patterns used to match only ONE
# exact shape, spelled out letter for letter, and nothing resembling it. The delete pattern matched
# only a two-flag deletion of the whole repository root variable in quotes; the write pattern matched
# only a bare redirect naming that same quoted variable with a slash right after it. A future test
# that instead made a new directory under the repository root — the very shape the old, unsafe
# version of the ".claude/agents" test used to run — would have passed silently, and so would one
# that used the curly-brace form of the variable, or copied, renamed, piped through "tee", touched, or
# symlinked a path under it instead of deleting it outright, or put the closing quote somewhere other
# than around the whole path in a redirect, or deleted the path this file keeps in a second, separate
# variable — the one holding the move-ledgers command's own file (see setup(), near the top of this
# file) — instead of the repository-root variable itself. That second variable names a real file
# inside this repository too, just reached a different way. Reproduced in a scratch copy of this
# file, outside the repository, with seven lines added covering every one of those shapes: only the
# original two-flag deletion was caught; the other six passed both tests unnoticed. See the builder's
# report for issue #41, round 4, for that run's full output.
#
# Fault fixed again (round-4 stand-in verification, finding N3): the widened patterns above still
# needed the WATCHED WORD to be followed LATER on the same line by the variable — so a line built
# like "( cd <into the repository root> && rm -rf .claude/agents )" was missed entirely, because
# the repository-root variable sits BEFORE "rm" there, not after it: the write names a path
# relative to the working folder AFTER the cd, never spelling the variable itself on the same line
# as the deleting word. That is exactly the subshell idiom this file already uses
# for its own read-only git steps (see make_tree(), just below setup(), and the branch-hygiene test
# further up), so it is also the shape most likely for a careless future test to copy. Separately,
# the MOVE_LEDGERS_MD half of the delete pattern watched only "rm" (not the other five words), had
# no brace-form support at all, and the command-word list had no LEFT boundary, so a comment ending
# in a word like "platform" (which itself ends in the letters "rm") was wrongly flagged. And neither
# "git" nor "sed" — both fully capable of changing a real file in the repository — were watched at
# all. Reproduced with a fresh scratch copy of this file, outside the repository, with lines added
# for the brace form of the move-ledgers-file variable, the cd-then-write subshell idiom, sed's
# in-place flag, a git checkout of the repository-root variable, a path built through a third,
# unwatched variable, and the "platform" comment; only the original shapes were caught, the rest
# passed unnoticed. Fixed with four checks instead of two:
#
#   1. Deletion / creation / copy / move / append-write / touch-or-link, against EITHER variable,
#      brace or no brace, now watching the SAME eight words on both branches (the six from before,
#      plus "sed" and "git" — but see check 3 below for why those two are handled separately rather
#      than added to this list outright) and anchored with "\b" so the word must start a real word,
#      not merely end one embedded inside another ("platform" no longer matches). Between the word
#      and the variable, only a pipe, an ampersand, or a semicolon stops the match — nothing else
#      does, so extra flags or an extra path segment in between are still caught, and so is a
#      command wrapped inside a quoted `bash -c "..."` string (the word can now be preceded by a
#      quote character as well as by whitespace or a shell operator).
#   2. Either redirect operator writing to either variable, brace or no brace on both (the same gap
#      as check 1 — the old pattern's MOVE_LEDGERS_MD branch had no brace form).
#   3. "git" and "sed" are watched SEPARATELY from check 1, not folded into its word list, because a
#      plain word-boundary test on "git" or "sed" alone is far too broad: this file already reads
#      the repository-root variable through several harmless git and sed uses that must stay legal
#      — a "git -C" branch listing (read-only, twice, in the branch-hygiene test above), a "git
#      ls-files" text search on the move-ledgers file's own contents (not a git command that
#      touches the repository at all — the word "git" merely appears inside the quoted search
#      pattern being grepped for), and a "sed -n" print-only extraction of the protocol's worked
#      JSON example (no in-place flag, so nothing on disk is ever touched). Folding "git"/"sed"
#      into check 1's list as originally proposed would have flagged all of those and broken this
#      very file. Instead, check 3 requires ALL of: the word "git" together with one of a short list of
#      git subcommands that actually change something (checkout, reset, clean, restore, apply,
#      stash, merge, rebase, cherry-pick, revert, rm, mv, add, commit) — or the word "sed" together
#      with the "-i" (in-place) flag — AND either variable, anywhere on the line, in any order (the
#      three pieces are checked with three chained greps rather than one combined pattern, since
#      order-independent "all of these appear somewhere" is awkward to express as a single regex and
#      easy to get subtly wrong).
#   4. No line may "cd" into $REPO_ROOT at all, except the two lines already proven read-only by
#      their OWN tests — the tar copy in make_tree() (only ever reads, to build $TREE) and the
#      branch-hygiene test above (asserts the branch list is unchanged before and after) — named
#      here by their exact current text. This is what catches the "cd then write with no $REPO_ROOT
#      in sight" idiom that no amount of widening checks 1-3 could ever catch on their own, since
#      those checks look for the variable NEAR the command word, and this idiom never puts them
#      together on one line at all.
#
# What is still NOT caught, on purpose, and needs saying plainly rather than assuming a reader will
# notice: a path reached through a THIRD variable — for example "x=\"$REPO_ROOT/.claude/agents\";
# mkdir -p \"\$x\"" — is invisible to every check above, because none of them ever look at \$x. A
# read-only use of either variable through a command word not on any of these lists (for instance
# "cat", or the "git ls-files -c" text search named above) needs no separate allow-list entry. If a
# genuinely read-only line using one of the watched words or the "cd" shape is ever needed, allow-
# list that one line explicitly, with a comment saying why it is safe, rather than loosening a
# pattern for everything.

@test "scripts.bats: no test deletes, creates, copies, moves, or touches a path in the real repository" {
  pat='\b(rm|mkdir|cp|mv|tee|touch|ln)\b[^|&;]*\$\{?(REPO''_ROOT|MOVE_LEDGERS''_MD)\b'
  run grep -nE "$pat" "$BATS_TEST_FILENAME"
  [ "$status" -eq 1 ]
}

@test "scripts.bats: no test writes a file directly into the real repository with a redirect" {
  pat='>>?[[:space:]]*"?\$\{?(REPO''_ROOT|MOVE_LEDGERS''_MD)\b'
  run grep -nE "$pat" "$BATS_TEST_FILENAME"
  [ "$status" -eq 1 ]
}

@test "scripts.bats: no test uses git or sed to change a path in the real repository" {
  # Chained greps, not one combined pattern — see check 3 in the header comment above for why "git"
  # or "sed" alone would be far too broad a word to watch on its own in this file.
  gitpat='\b(checkout|reset|clean|restore|apply|stash|merge|rebase|cherry-pick|revert|rm|mv|add|commit)\b'
  varpat='\$\{?(REPO''_ROOT|MOVE_LEDGERS''_MD)\b'
  # A pipeline's own exit status is its LAST command's — a "no match" grep exits 1, so an all-clear
  # file makes every stage exit 1 in turn and the whole pipeline exits 1 too, same as the other
  # single-pattern tests in this section.
  run bash -c 'grep -nE "\bgit\b" "$1" | grep -E "$2" | grep -E "$3"' _ \
    "$BATS_TEST_FILENAME" "$gitpat" "$varpat"
  [ "$status" -eq 1 ]
  run bash -c 'grep -nE "\bsed\b" "$1" | grep -E -- "-i\b" | grep -E "$2"' _ \
    "$BATS_TEST_FILENAME" "$varpat"
  [ "$status" -eq 1 ]
}

@test "scripts.bats: no test cd's into the real repository, except the two lines already proven read-only" {
  pat='\bcd\b[[:space:]]+["'"'"']?\$\{?REPO''_ROOT\b'
  # Named by their exact current text (not by line number, which a later edit could change): the
  # tar copy in make_tree() only ever reads the repository to build $TREE, and the branch-hygiene
  # test's own assertions (just above) prove the branch list is unchanged before and after.
  safe1='  ( cd "$REPO''_ROOT" && tar --exclude=.git -cf - . ) | ( cd "$TREE" && tar -xf - )'
  safe2='  run bash -c "cd '"'"'$REPO''_ROOT'"'"' && bash scripts/branch-hygiene.sh --no-fetch"'
  run bash -c '
    grep -nE "$1" "$2" | while IFS= read -r hit; do
      line="${hit#*:}"
      [ "$line" = "$3" ] && continue
      [ "$line" = "$4" ] && continue
      printf "%s\n" "$hit"
    done
  ' _ "$pat" "$BATS_TEST_FILENAME" "$safe1" "$safe2"
  [ -z "$output" ]
}

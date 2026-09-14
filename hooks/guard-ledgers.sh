#!/usr/bin/env bash
# dev-team ledger guard (PreToolUse/Write|Edit|MultiEdit). Part of the issue #41 fix: every file
# the plugin writes for itself now lives in .dev-team/, never at the project's top level — see
# skills/dev-team-orchestrator/references/conventions.md, "Where the plugin writes, and the
# ownership rule". This hook is a second, independent layer on top of that written rule and the
# scribe's own self-check; it stops a mistaken write before it happens instead of only detecting
# one afterwards. Fail-open by design, same posture as hooks/guard-dev-team.sh: any error, missing
# tool, missing jq, or anything it cannot parse => allow (exit 0). One defense layer, best-effort
# text matching — NEVER the safety guarantee. The real protection is the plugin only ever writing
# into .dev-team/, plus a person reading what they are about to commit.
#
# Two separate rules, both read from the tool call's own JSON (stdin), never from the filesystem
# except .dev-team/config.yml and .dev-team/loop.lock/ (looked for at both the repository's top
# folder and the session's working folder — see "Path handling"):
#
#   Rule 1 (Write only; on all the time unless `guard: off`) — a WRITE is refused when ALL three of
#   these hold: (a) the new content carries the dev-team marker (`<!-- dev-team: ledger=` or
#   `"dev-team": "ledger=`, or the legacy pre-v1.5.0 marker, which conventions.md still accepts as
#   proof of ownership) on one of its first three lines; (b) the target's FILE NAME, with case
#   ignored, is one of the seven ledger names plus README.md (PROJECT.md, FEATURES.md, SECURITY.md,
#   VERIFICATION.md, MIGRATION.md, HANDOFF.md, verdict.json, README.md — this plugin writes a fixed,
#   marker-bearing README.md of its own into .dev-team/, so Rule 1 has to recognise that name too,
#   the same way it already recognises the other seven; see conventions.md, "Where the plugin
#   writes", point 7); (c) the path, once resolved (see
#   "Path handling" below), is outside .dev-team/. So yes, this CAN block a person — but only in
#   one narrow shape: a file that is both named exactly like one of the plugin's ledgers AND
#   already starts with the plugin's own marker text. No project's own file looks like that unless
#   someone has copied a plugin ledger's content into it by hand, which is itself almost certainly
#   a mistake worth stopping to ask about. That is also why this rule stays on even outside an
#   active run: the mistake it is guarding against (a stale instruction telling a scribe to write
#   at the old top-level path) can happen in a one-off session just as easily as inside an
#   autopilot cycle. The refusal message says how to proceed either way: move the file under
#   .dev-team/, or, if it genuinely is the project's own file, set `guard: off` in
#   .dev-team/config.yml.
#
#   Rule 2 (Write, Edit or MultiEdit; only while a run is judged to be active, or the config or
#   environment forces it on) — a write to one of the seven ledger names at the project's top
#   level, or to SECURITY.md in .github/ or docs/ (GitHub's own security-policy locations), is
#   refused if the incoming text looks like plugin output: it carries the dev-team marker, or it
#   contains a dev-team record id such as F-001, FG-012 or F-1000 (a letter prefix, a dash, and at
#   least three digits). This is the SIGNula.id failure this whole change exists to stop: a run
#   appending its own findings onto a project's real SECURITY.md. When the session was started in
#   a SUBFOLDER of the repository (say "src"), the seven ledger names directly inside that
#   subfolder ("src/SECURITY.md" and so on) are protected as well, IN ADDITION to the top-level
#   ones — but not "src/.github/SECURITY.md", "src/docs/SECURITY.md", or anything deeper such as
#   "src/deep/SECURITY.md". Why both places, and why not those three, is explained where Rule 2 is
#   coded, near the end of this file. Plain text with no marker and no ids — a person's own edit to their own file — is
#   never blocked, on purpose: only the run gate plus the content test together decide this, never
#   the path alone, because a project is allowed to keep its own PROJECT.md/FEATURES.md/etc. and a
#   person must always be able to edit those.
#
#   "A run is active" is judged by `.dev-team/loop.lock/` existing (created for the length of one
#   autopilot cycle and removed at the end — see loop-runtime.md — and, unlike autopilot.json,
#   never committed to git, so it is a real "right now" signal), or `guard: on` in
#   .dev-team/config.yml, or the DEV_TEAM_GUARD environment variable being set. Earlier drafts of
#   this hook used "`.dev-team/autopilot.json` exists" for that test, copying hooks/guard-dev-
#   team.sh — that was rejected once real projects turned up (CueRCode, Go2My.Link, SIGNula.id)
#   that keep autopilot.json committed in git, which would have made Rule 2 permanently on and
#   would have stopped the project owner editing their own top-level HANDOFF.md or FEATURES.md
#   forever. `guard: off` in .dev-team/config.yml turns BOTH rules off, exactly like the Bash guard.
#
# Thirteen faults found by later readings of this file, all now fixed:
#   - The JSON half of the marker match used to require exactly one space after each colon, so
#     compact JSON — `{"dev-team":"ledger=verdict schema=1.0"}`, with no spaces at all — was not
#     recognised as the marker even though it is exactly the same valid content. It now accepts
#     any amount of whitespace (including none) around each colon.
#   - Rule 2's ledger-name match used to compare capitals only. On a filesystem that ignores case
#     (macOS, by default) "security.md" IS "SECURITY.md" — the same file on disk — so matching
#     capitals only let a write spelled in lower case walk past the rule while still landing on the
#     real file the rule exists to protect. Rule 2 now compares the name with case ignored. Rule
#     1's separate ".dev-team/" folder test (just below) is left case-sensitive on purpose: refusing
#     a write to something that merely looks like ".DEV-TEAM/" is the safe direction to be wrong
#     in, whereas loosening it could let a write past the folder check entirely.
#   - Rule 1 used to fire on ANY path outside .dev-team/ that carried the marker on its first three
#     lines, with no check on the file's name. That refused this very plugin's own test fixture,
#     tests/fixtures/verdict.sample.json — whose whole purpose is to hold real marker-bearing
#     sample content for the schema tests to check against, and which is nobody's ledger. A rule
#     that blocks the plugin's own repository from writing its own fixtures contradicts the "can
#     never block a person" claim this comment used to make. Rule 1 now also requires the file
#     NAME to be one of the seven ledger names before it fires, so a fixture, a sample, or any
#     other file that merely happens to quote the marker inside marker-unrelated content is left
#     alone.
#   - Path handling used to strip a leading "<cwd>/" once and then a leading "./" once, which is
#     one pass, not a resolution. A path built from "." and ".." segments — ".dev-team/../
#     SECURITY.md", or "././SECURITY.md" — walks straight past a single strip: the first still
#     starts with ".dev-team/" as far as a literal string match is concerned even though it
#     actually names a file one level up, and the second still starts with "./" after only one
#     strip. Both rules now resolve the path lexically first (see "Path handling" below), so a
#     write that only LOOKS like it targets .dev-team/, or only looks like a distinct top-level
#     ledger name, is judged by where it actually lands.
#   - Narrowing Rule 1 to "one of the seven ledger names" (the fault just above) went one name too
#     narrow: this plugin also writes its own .dev-team/README.md, a fixed file that carries the
#     marker like any other ledger (conventions.md point 7). Because "readme.md" was missing from
#     Rule 1's name list, a Write of that same marker-bearing text to a project's top-level
#     README.md passed straight through and would have overwritten the project's real README with
#     the plugin's folder blurb. README.md is now in Rule 1's name list too. It is deliberately NOT
#     added to Rule 2's name list: Rule 2 also checks for a bare record id such as "F-001" with no
#     marker required, and a great many ordinary project READMEs mention an issue or finding number
#     in passing — adding README.md there would make Rule 2 block a person editing their own README
#     for a reason that has nothing to do with this plugin. Rule 1 stays safe for a project's own
#     README because Rule 1 also requires the marker itself on one of the first three lines, and a
#     project's own README never carries that unless someone has copied plugin ledger content into
#     it by hand — exactly the mistake Rule 1 exists to catch.
#   - Under macOS's stock /bin/bash (3.2), resolve_lexical's last line — joining the resolved path
#     pieces back together — broke for any input that resolves to NOTHING, such as file_path ".",
#     "..", "/", or "SECURITY.md/..": with the array of pieces empty, `set -u` treats
#     "${parts[*]}" as an unbound variable in bash 3.2 (bash 4.4+ added support for expanding an
#     empty array under `set -u`; 3.2 predates that). The script's own subshell died, so $resolved
#     came back empty and the write was still allowed — fail-open, so nothing was wrongly blocked —
#     but the hook printed "line 188: parts[*]: unbound variable" to stderr, which looks exactly
#     like the hook itself being broken to anyone who sees it. The join now falls back to an empty
#     string when the array is empty (`"${parts[*]:-}"`), which bash 3.2 accepts, and uses `printf`
#     instead of `echo` for the join, so a path whose only real segment is something like "-n" or
#     "-e" is never swallowed as an echo option instead of being written out as text.
#   - An absolute path outside the project — one that does NOT start with `<cwd>/` (or `$PWD/`), so
#     the leading-prefix strip below leaves it untouched and still starting with "/" — used to be
#     resolved as if it were relative. resolve_lexical reads a leading "/" as just another empty
#     split piece and drops it the same way it drops a doubled slash, so "/.dev-team/SECURITY.md"
#     resolved to the plain text ".dev-team/SECURITY.md" and was wrongly judged to be inside THIS
#     project's own .dev-team/ folder, even though it names a folder at the filesystem root that has
#     nothing to do with the project. The path is now marked as having left the project (the same
#     $escaped flag a runaway ".." sets) whenever it is still absolute after the cwd/PWD strip, so
#     Rule 1 judges it by file name alone (as it does for any other escaped path) and Rule 2, which
#     only ever protects this project's own top-level files, skips it entirely.
#   - A session started in a SUBFOLDER of the repository was judged as if that subfolder were the
#     project's top folder. So from "src", a Write or Edit putting a record id such as F-001 into
#     the real top-level SECURITY.md — given as the absolute "<top>/SECURITY.md" or as
#     "../SECURITY.md" — counted as outside the project and was allowed, and the top-level
#     .dev-team/loop.lock/ was never seen. It also went wrong the other way: `guard: off` in the
#     top-level .dev-team/config.yml was ignored, and the plugin's own correct Write to the
#     absolute "<top>/.dev-team/SECURITY.md" was refused. The hook now asks git where the working
#     folder sits inside the repository and judges paths against the top folder (see "Path
#     handling" below).
#   - The subfolder fix just above went too far the other way. It counted only the TOP folder's
#     .dev-team/ as ".dev-team/" and read config.yml only from the top folder. But the plugin's
#     skills write ".dev-team/<name>" relative to the session folder, so in a session started in
#     "src" (a monorepo package, say) the plugin's own marker Write to "src/.dev-team/PROJECT.md",
#     given as an absolute or a relative path, was refused, telling the caller to write it under
#     .dev-team/ — where it already was. `guard: off` in "src/.dev-team/config.yml" (where
#     /dev-team-config init puts it) was ignored, and the Bash guard, which reads config.yml
#     relative to the session folder, disagreed with this hook about whether the guard was off.
#     Now "<sub>/.dev-team/" counts as inside .dev-team/ as well; `guard:` is read from both the
#     session folder's and the top folder's config.yml with "off" from either winning; and
#     loop.lock/ in either place means a run is active. Harmful writes to the top-level files from
#     a subfolder are still refused, and `guard: off` at the top is still honoured. (This note used
#     to end by saying the change "does NOT loosen Rule 2". That was true, but it only ever asked
#     whether Rule 2 got looser, never whether it now protected too little — see the fault note
#     about the session folder's own ledger names, further down this list.)
#   - A cwd sent with a trailing slash, such as "<repo>/src/", did not end in git's subfolder
#     prefix "src", so the top folder was never found and a harmful Edit to "<repo>/SECURITY.md"
#     was allowed while the same payload with "<repo>/src" was refused. One trailing slash is now
#     cut off the working folder (never off "/" itself) before that comparison.
#   - The legacy (pre-v1.5.0) marker was missing from the marker pattern, although conventions.md
#     still accepts the legacy marker as proof of ownership. A Write of legacy-marked content to a
#     top-level SECURITY.md passed Rule 1, and Rule 2 missed it too when it carried no record id.
#     The legacy marker is now part of the pattern, so both rules recognise it.
#   - Rule 2's record-id pattern demanded EXACTLY three digits followed by the end of a word, so
#     "F-1000" never matched (the word boundary fails between the third and fourth digit) and an
#     Edit adding "| F-1000 |" to the top-level SECURITY.md during a run was allowed while "F-999"
#     was refused. Nothing caps a counter at 999, ids are never reused, and the verdict schema
#     already says "at least three digits" (`^V-[0-9]{3,}$`). The pattern now uses `{3,}` to
#     match. Two-digit text such as "F-12" still does not match, on purpose: the plugin always
#     zero-pads to three digits, and a shorter form is far more likely to be ordinary project text.
#   - A session started in a subfolder (say "src") had only the TOP folder's ledger names checked
#     by Rule 2. The previous two fixes already treat "src/.dev-team/" as the session's own plugin
#     folder and read the lock and config.yml from it, because the skills write relative paths.
#     But the same relative writing means a stale instruction to append findings to "SECURITY.md"
#     lands on "src/SECURITY.md" — the package's own file — and Rule 2 let that through even with
#     "src/.dev-team/loop.lock/" present. (The hook before fix round 3, which judged everything
#     from the session folder, did refuse it; round 3 allowed it and round 4 kept that.) Rule 2 now
#     ALSO matches the seven ledger names directly inside the session folder. This is additive:
#     every top-level match is unchanged. See the Rule 2 code for why both places are protected.
#
# Path handling: Claude Code sends the session's working folder as the top-level `cwd` field on
# every hook call (the shell's own $PWD is used only if `cwd` is missing from the payload). The
# script first works out the repository's TOP folder with `git rev-parse --show-prefix`, which
# names where the working folder sits below the top (for example "src/"); that part is cut off the
# end of cwd's text. Outside git, or when that does not fit, the top folder is simply taken to be
# cwd. An absolute `tool_input.file_path` then has a leading `<top>/` stripped; a relative one has
# the subfolder part put in front of it, because a relative path is measured from the working
# folder. What is left is then resolved LEXICALLY, in pure bash: split on "/", drop every empty and
# "." piece, and for each ".." remove the piece before it. This is text-only, on purpose — it does
# not touch the real filesystem (so a symbolic link is never followed — see "What this hook CANNOT
# do") — no `realpath`, no `cd`, because the file being written often does not exist yet, and
# `realpath`'s exact behaviour differs between macOS and Linux. If a ".." would remove a piece that
# is not there (the path tries to climb above where it started), the path is treated as having left
# the project: it counts as outside .dev-team/ for Rule 1, and it is not matched against any of
# Rule 2's top-level names — but Rule 1 still checks such a path by its file name, since a marker-
# bearing ledger-named file written anywhere outside the project is exactly as wrong as one written
# inside it at the wrong spot. The same "has left the project" treatment now also applies to a path
# that is still absolute (still starts with "/") after the top-folder prefix strip below — see the
# fault note above about "/.dev-team/SECURITY.md" for why that case needs the same flag. A
# resolved path counts as inside .dev-team/ when it starts with ".dev-team/" or, in a subfolder
# session, with "<sub>/.dev-team/". .dev-team/config.yml and .dev-team/loop.lock/ are read from
# both the top folder and the session folder, unresolved — those paths are always written by this
# plugin itself with no user-supplied segments, so there is nothing for them to walk past. Confirmed against
# Claude Code's official hooks documentation
# (https://code.claude.com/docs/en/hooks and .../hooks-guide, fetched 13 September 2026): the
# top-level `cwd` field is shown in the documented PreToolUse example payload; `tool_input.
# file_path` and `tool_input.content` (Write) are shown in the "Block edits to protected files"
# example script; Edit's `old_string`/`new_string` pair is stated in the tools reference text.
# MultiEdit's `tool_input.edits[]` array (each item carrying `old_string`/`new_string`) is NOT
# shown in the fetched documentation excerpts — it is coded here from the tool's well-established
# real shape, and, per the fail-open rule above, a missing or differently-shaped `edits` field
# simply yields no content to check rather than an error.
#
# What this hook CANNOT do, stated plainly:
#   - It cannot see a `cat >>` or any other write run through Bash — only Write/Edit/MultiEdit.
#   - It is a best-effort pattern match on the text being written, never a guarantee. A determined
#     rewrite that avoids the marker and every id pattern will not be caught.
#   - It can only find the project's top folder through git. Outside a git repository, when git is
#     not installed or refuses the repository, or when the working folder was reached through a
#     link so that its text does not end in git's subfolder prefix, it still trusts `cwd` (or
#     $PWD) as the top folder. A session started in a subfolder of such a project is then judged
#     as if that subfolder were the top, which is the old, weaker behaviour.
#   - It does not follow symbolic links. It judges a path by its text alone. If .dev-team/ itself,
#     or a file inside it, is a link pointing back out to a project file (for example
#     .dev-team/SECURITY.md linking to ../SECURITY.md), both rules see a .dev-team/ path and allow
#     the write. Whether that write then lands on the linked project file depends on how Claude
#     Code's Write and Edit treat links, which was not checked. This plugin never creates links, so
#     this needs someone to have made one on purpose. Resolving links physically was considered and
#     not done. A rule that refuses any linked .dev-team/ would block every ledger write in a
#     project that links its .dev-team/ folder elsewhere on purpose. A full physical resolution has
#     to cope with macOS reporting /private/var for /var, which the text comparison here cannot
#     match.
#   - Whether PreToolUse actually fires for a subagent's own Write call was not verified in this
#     build session; if it does not, this hook still protects the lead session's own writes, and
#     the written rule in conventions.md plus the scribe's post-write self-check carry the rest.
set -u
payload="$(cat 2>/dev/null)" || exit 0

# Everything below needs structured fields out of the JSON payload. Without jq there is no safe
# way to parse it, so — fail open — allow.
command -v jq >/dev/null 2>&1 || exit 0

jqr() { printf '%s' "$payload" | jq -r "$1" 2>/dev/null; }

# The session's working folder, as Claude Code sends it. Falls back to $PWD only for the parts
# that need an actual filesystem location to check ($PWD is not itself trusted as the project
# root — it is only what a caller who omits `cwd` from the payload gets judged against).
cwd="$(jqr '.cwd // empty')"

# Work out the project's TOP folder ($root), and where the session's working folder sits inside it
# ($sub, for example "src/deep", or empty when the session started at the top).
#
# Why this is needed: a session can be started in a subfolder of the repository. This hook used to
# take `cwd` itself as the top folder. From a subfolder that went wrong in both directions: a
# harmful write to the real top-level SECURITY.md (given as an absolute path, or as
# "../SECURITY.md") counted as "outside the project" and was let through, the top-level
# .dev-team/loop.lock/ and .dev-team/config.yml were never found (so `guard: off` was ignored), and
# the plugin's own correct write to the absolute <top>/.dev-team/SECURITY.md was wrongly refused.
#
# Why `git rev-parse --show-prefix` and NOT `--show-toplevel`: --show-toplevel gives the PHYSICAL
# path with every link resolved. On macOS the temporary folders live at /var/..., which is really a
# link to /private/var/..., so git answers /private/var/... while Claude Code sends file_path as
# /var/.... The text comparison below would then never match. --show-prefix instead gives only the
# part below the top folder ("src/deep/"), and we cut that off the END of cwd's own text, so the
# top folder is written in exactly the same spelling as the file paths Claude Code sends.
#
# Fails open, to today's behaviour: with no git installed, a folder that is not in a repository, a
# folder that does not exist, git refusing the repository (for example "dubious ownership"), or a
# cwd whose text does not end in git's prefix (reached through a link, say), $root simply stays as
# cwd and $sub stays empty. `git rev-parse` is local only — no network — and takes a few
# milliseconds. A git submodule inside a bigger repository counts as its own project here, because
# git reports the submodule's own top folder; that is the right answer for where its .dev-team/
# folder would live. Refusing when git is unavailable was considered and rejected: this hook must
# never block a person's normal work just because git is missing.
base="${cwd:-$PWD}"
# Cut ONE trailing slash off the working folder (but never turn "/" itself into nothing). The
# subfolder test just below asks whether the working folder's text ENDS in git's prefix ("src").
# A cwd sent as "<repo>/src/" does not end in "src", so without this the top folder was never
# found, "<repo>/SECURITY.md" was judged to be outside the project, and Rule 2 let a harmful
# write through. Claude Code normally sends cwd with no trailing slash, so this is a corner case,
# but it costs one line. Only one slash is removed: "<repo>/src//" is not a spelling any caller
# produces, and stripping in a loop would add code for no real case.
case "$base" in
  /) ;;
  */) base="${base%/}" ;;
esac
root="$base"
sub=""
if command -v git >/dev/null 2>&1; then
  prefix="$(git -C "$base" rev-parse --show-prefix 2>/dev/null)" || prefix=""
  prefix="${prefix%/}"
  if [ -n "$prefix" ]; then
    case "$base" in
      # Quoted, so the prefix is matched as plain text and never as a wildcard pattern.
      */"$prefix") root="${base%/"$prefix"}"; sub="$prefix" ;;
    esac
  fi
fi

# Where .dev-team/config.yml and .dev-team/loop.lock/ are read from: BOTH the top folder worked out
# above AND the session's own working folder. When the session started at the top these are the
# same place and nothing changes.
#
# Why both, and not only the top folder: fix round 3 moved these reads to the top folder only, so
# that a subfolder session would see the project's real lock and config. But every skill in this
# plugin writes ".dev-team/<name>" relative to the session folder, and /dev-team-config init
# creates config.yml there too. So in a monorepo session started in "packages/app", the plugin's
# own .dev-team/ folder is "packages/app/.dev-team/", and `guard: off` written there was ignored.
# The Bash guard (hooks/guard-dev-team.sh) also still reads config.yml relative to the session
# folder, so the two hooks disagreed about whether the guard was off. Reading both places makes
# them agree.
top_rel() { printf '%s/%s' "$root" "$1"; }
cwd_rel() { printf '%s/%s' "$base" "$1"; }

# Read the `guard:` setting from one config.yml; prints on, off, auto or nothing.
read_guard() {
  [ -f "$1" ] || return 0
  grep -Eo '^[[:space:]]*guard:[[:space:]]*(on|off|auto)' "$1" 2>/dev/null | grep -Eo '(on|off|auto)$' | head -1
}
guard_top="$(read_guard "$(top_rel .dev-team/config.yml)")"
guard_cwd="$(read_guard "$(cwd_rel .dev-team/config.yml)")"

# `guard: off` in EITHER config.yml disables both rules, no matter what else is set. "off" wins
# over "on" when the two files disagree, on purpose: `guard: off` is the escape hatch the refusal
# messages tell a person to use, and it must work from whichever .dev-team/ they were pointed at.
# Letting "on" win was rejected because it would leave a person unable to turn off a guard that is
# wrongly blocking their own file without first finding a second config file they may not know is
# there.
[ "$guard_top" = "off" ] && exit 0
[ "$guard_cwd" = "off" ] && exit 0
guard_on=0
if [ "$guard_top" = "on" ] || [ "$guard_cwd" = "on" ]; then
  guard_on=1
fi

tool_name="$(jqr '.tool_name // empty')"
file_path="$(jqr '.tool_input.file_path // empty')"
# No file_path (or no tool_input at all) => nothing to check against => allow.
[ -n "$file_path" ] || exit 0

# Turn file_path into a path measured from the project's TOP folder ($root_rel):
#   - an absolute path under the top folder has "<top>/" cut off the front. This also covers
#     "<cwd>/..." because the top folder is always the start of cwd;
#   - any other absolute path is kept as it is, and is marked below as having left the project;
#   - a relative path is measured from the session's working folder, so the subfolder part
#     ($sub) goes in front of it. From "src", "SECURITY.md" really means "src/SECURITY.md" (not the
#     top-level file) and "../SECURITY.md" really means the top-level file.
# Quoting the pattern keeps it literal — a path is never treated as a wildcard pattern here.
# $norm_path keeps the path exactly as the caller wrote it, only for the refusal messages below,
# so a refusal quotes back what the caller actually typed.
case "$file_path" in
  "$root"/*) root_rel="${file_path#"$root"/}" ;;
  /*) root_rel="$file_path" ;;
  *) root_rel="${sub:+$sub/}$file_path" ;;
esac
norm_path="$file_path"

# Resolve $root_rel lexically — see the "Path handling" header comment for why this has to be a
# pure text operation and cannot call out to `realpath`. Sets two globals: $resolved (the path with
# every "." and "sibling .." pair collapsed away) and $escaped (1 if a ".." ever tried to remove a
# piece that was not there, meaning the path climbed above where it started and has left the
# project; 0 otherwise). Bash's own field-splitting on IFS='/' turns "a//b" into "a", "", "b" — the
# empty piece is one of the two kinds this function is told to drop, so a doubled slash is handled
# for free. Written to avoid bash 4+-only features (no `${arr[-1]}` negative indexing) because
# macOS ships bash 3.2.
resolve_lexical() {
  local input="$1" seg
  local -a segs=() parts=()
  local old_ifs="$IFS"
  IFS='/'
  read -ra segs <<< "$input"
  IFS="$old_ifs"
  escaped=0
  for seg in "${segs[@]}"; do
    case "$seg" in
      ''|'.') continue ;;
      '..')
        if [ "${#parts[@]}" -gt 0 ]; then
          # Drop the last kept piece by slicing it off — plain array slicing, not a negative
          # index, so this still works under bash 3.2.
          parts=("${parts[@]:0:$((${#parts[@]} - 1))}")
        else
          # Nothing left to remove: this ".." would step above the directory the path started
          # in. Once true, stays true for the rest of this path — see the header comment.
          escaped=1
        fi
        ;;
      *) parts+=("$seg") ;;
    esac
  done
  # "${parts[*]:-}" rather than "${parts[*]}": under `set -u`, bash 3.2 (macOS's stock /bin/bash)
  # treats expanding an EMPTY array with "${parts[*]}" as an unbound variable, which is a fault
  # this hook used to trip for any path that resolves to nothing at all — ".", "..", "/",
  # "SECURITY.md/.." — printing "line 188: parts[*]: unbound variable" to stderr and dying out of
  # this subshell before $resolved was ever set (the write was still allowed either way, since an
  # empty $resolved falls through every rule below as "not a match" — this was a noisy fault, not
  # an unsafe one, but a noisy one that looks exactly like the hook being broken). The ":-" default
  # gives bash 3.2 a plain empty string instead of erroring, and bash 4.4+ (which added its own
  # support for expanding an empty array under `set -u`) is unaffected by the change. `printf '%s'`
  # instead of `echo` also stops a path whose only real segment is text like "-n" or "-e" being
  # read as an echo option instead of being written out as the path text it actually is.
  resolved="$(IFS='/'; printf '%s' "${parts[*]:-}")"
}
resolve_lexical "$root_rel"

# An absolute path that is STILL absolute after the "<top>/" strip above named a location outside
# the project entirely — the strip only removes that prefix when file_path actually starts with
# it, so anything left starting with "/" was never under this project's top folder to begin with. Before this fix, resolve_lexical would read that leading "/" as
# just another empty split piece (the same as a doubled slash) and quietly drop it, so
# "/.dev-team/SECURITY.md" resolved to the plain text ".dev-team/SECURITY.md" and was wrongly
# treated as living inside THIS project's own .dev-team/ folder — a folder at the filesystem root
# has nothing to do with the project just because its name matches. Forcing $escaped here (after
# resolve_lexical has already run, so $resolved is still set for Rule 1's file-name check) gives
# this case exactly the same "has left the project" treatment a runaway ".." already gets: Rule 1
# still judges the file by name alone, and Rule 2 — which only ever protects this project's own
# top-level files — skips it entirely.
case "$root_rel" in
  /*) escaped=1 ;;
esac

deny() {
  echo "dev-team guard: $1" >&2
  exit 2
}

# The dev-team marker, as it appears in either a markdown ledger's HTML comment or verdict.json's
# JSON field — see conventions.md, "Where the plugin writes, and the ownership rule".
#
# The JSON half of this pattern used to require exactly one space after each colon (matching only
# `"dev-team": "ledger=`), because that is the one spacing the scribe always writes. That missed
# COMPACT json, e.g. `{"dev-team":"ledger=verdict schema=1.0"}` with no spaces at all — the same
# valid JSON, just written without the scribe's usual formatting (a person copying the value by
# hand, or a minifier, would produce exactly this). `[[:space:]]*` around each colon now accepts
# zero or more spaces (or tabs) on either side, so both the spaced and compact forms are caught.
# The markdown half is left exactly as written on purpose — the scribe only ever writes it one way
# (`<!-- dev-team: ledger=`), so there is no compact variant to worry about there.
#
# The legacy (pre-v1.5.0) marker is also part of the pattern. conventions.md point 3 says a file
# carrying the legacy marker is still accepted as proof that the plugin owns it, so a Write of
# legacy-marked content to a top-level ledger name is exactly the same mistake and is refused the
# same way (Rule 1), and so is legacy-marked text written to a top-level ledger during a run
# (Rule 2). Leaving it out used to let both rules miss such a write whenever it carried no record
# id. No correct plugin write is refused by this: the plugin moves a legacy file with `git mv` (a
# Bash command this hook never sees) and only then writes the new marker inside .dev-team/.
# Every line in this file that quotes the legacy marker's text must also contain the word
# "legacy", or scripts/audit-ledger-paths.sh check F fails.
legacy_marker='<!-- dev-team-schema:'   # legacy (pre-v1.5.0) ownership marker, still accepted — conventions.md point 3
marker_pattern="<!-- dev-team: ledger=|$legacy_marker|\"dev-team\"[[:space:]]*:[[:space:]]*\"ledger="
# A dev-team record id: FG-001, F-002, B-003, G-004, V-005, I-006, M-007 — and F-1000 and beyond.
# `{3,}` means "three or more digits". It used to be `{3}` (exactly three), which, because of the
# `\b` word-boundary check straight after, never matched a four-digit id such as F-1000: protection
# quietly ended at a project's thousandth record. The verdict schema (schemas/verdict.schema.json)
# already allows "at least three digits", so this now agrees with it. Fewer than three digits
# (F-12) still does not match — the plugin always zero-pads, and a short form like that is much
# more likely to be a person's own text. `\b` is understood by both BSD grep (macOS) and GNU grep.
id_pattern='\b(FG|F|B|G|V|I|M)-[0-9]{3,}\b'

# The text actually being written, by tool shape. Anything unrecognised (a tool this hook was not
# written for) leaves $content empty and $checked=0, which both rules treat as "nothing to see".
content=""
checked=0
case "$tool_name" in
  Write)
    content="$(jqr '.tool_input.content // empty')"
    checked=1
    ;;
  Edit)
    content="$(jqr '.tool_input.new_string // empty')"
    checked=1
    ;;
  MultiEdit)
    # Every edit's new_string, joined — a ledger id or the marker slipped into any one of a
    # MultiEdit's several edits is still a write of that content, not just the first edit.
    content="$(jqr '(.tool_input.edits // []) | map(.new_string // "") | join("\n")')"
    checked=1
    ;;
esac

# Is $resolved inside .dev-team/? An escaped path (one that climbed above the project) can never
# count as inside it, whatever its text happens to look like afterwards — see resolve_lexical's
# header comment. This test is deliberately case-SENSITIVE: a folder name really can differ only by
# case on a case-sensitive filesystem (most Linux CI runners), and refusing a write to something
# that merely looks like ".DEV-TEAM/" is the safe direction to be wrong in, since the cost of a
# wrongly-refused write is just "try the real path", not a ledger going to the wrong place.
#
# Two folders count as .dev-team/ here: the one at the top folder (".dev-team/...") and, when the
# session started in a subfolder, the one inside that subfolder ("<sub>/.dev-team/...", for example
# "src/.dev-team/PROJECT.md"). The second is needed because the plugin's skills write
# ".dev-team/<name>" relative to the session folder, so from "src" the plugin's own correct write
# lands in "src/.dev-team/". Fix round 3 counted only the top-level folder, which refused every
# ledger write in such a session with a message saying "write it under .dev-team/ instead" —
# where it already was. Counting "<sub>/.dev-team/" as inside is safe: Rule 1 exists only to stop
# plugin content landing on the project's own top-level files, and a file under the session's own
# .dev-team/ folder is not one of those. This test has no effect on Rule 2's list of protected
# files. That list is separate and, since a later fix, WIDER in a subfolder session: it protects
# the session folder's own ledger names ("src/SECURITY.md" and so on) as well as the top-level
# ones — see Rule 2 below.
# $sub is quoted in the pattern so it is matched as plain text, never as a wildcard.
in_devteam=0
if [ "$escaped" -eq 0 ]; then
  case "$resolved" in
    .dev-team/*) in_devteam=1 ;;
  esac
  if [ -n "$sub" ]; then
    case "$resolved" in
      "$sub"/.dev-team/*) in_devteam=1 ;;
    esac
  fi
fi

# --- Rule 1: a Write whose content carries the marker AND whose file name is one of the seven
#     ledger names plus README.md AND whose resolved path lands outside .dev-team/. All three
#     together — not the marker alone — because a fixture or sample file can legitimately quote the
#     marker without being a ledger, and this plugin ships exactly one such file (tests/fixtures/
#     verdict.sample.json), which must never be refused. README.md is on this list because this
#     plugin also writes its own fixed, marker-bearing .dev-team/README.md (conventions.md, "Where
#     the plugin writes", point 7) — leaving it off let that same text overwrite a project's real
#     top-level README.md. It is NOT on Rule 2's separate name list below: Rule 2 also fires on a
#     bare record id with no marker required, and an ordinary project README mentioning something
#     like "F-001" in passing must never be blocked for that. See the header comment for both
#     faults this rule now fixes. ------------------------------------------------------------------
if [ "$checked" -eq 1 ] && [ "$tool_name" = "Write" ]; then
  first_three="$(printf '%s\n' "$content" | head -n 3)"
  if printf '%s' "$first_three" | grep -Eq "$marker_pattern"; then
    base_name="${resolved##*/}"
    base_lc="$(printf '%s' "$base_name" | tr '[:upper:]' '[:lower:]')"
    case "$base_lc" in
      project.md|features.md|security.md|verification.md|migration.md|handoff.md|verdict.json|readme.md)
        if [ "$in_devteam" -eq 0 ]; then
          deny "this content carries the dev-team marker and \"$base_name\" is one of this plugin's ledger names, but the path \"$norm_path\" resolves outside .dev-team/. Write it under .dev-team/ instead — or, if this really is your own project's file, set \"guard: off\" in .dev-team/config.yml."
        fi
        ;;
    esac
  fi
fi

# --- Rule 2: a top-level ledger name (or a GitHub security-policy location), written while a run
#     is judged active, with content that looks like plugin output. ------------------------------
#
# loop.lock/ is looked for in BOTH places (the top folder's .dev-team/ and the session folder's
# .dev-team/), and finding it in either one means a cycle is running. Why both: an autopilot cycle
# started from a subfolder session creates its lock under that subfolder's .dev-team/, because the
# skills write relative to the session folder, while a cycle started at the top creates it there.
# Either way a run is really in progress. Treating "either" as active is the safe direction for this
# rule: a wrongly-active gate only means a write carrying plugin-looking content to a top-level
# ledger name gets refused, which a person can clear with `guard: off`; a wrongly-inactive gate
# means a run's findings can land on the project's real SECURITY.md, which is the very failure this
# hook exists to stop. Requiring the lock in one fixed place was rejected for that reason.
run_active=0
if [ -d "$(top_rel .dev-team/loop.lock)" ] || [ -d "$(cwd_rel .dev-team/loop.lock)" ] \
  || [ "$guard_on" -eq 1 ] || [ -n "${DEV_TEAM_GUARD:-}" ]; then
  run_active=1
fi

if [ "$checked" -eq 1 ] && [ "$run_active" -eq 1 ] && [ "$escaped" -eq 0 ]; then
  # Compare the full resolved path with case ignored, because a filesystem that ignores case
  # (macOS, by default) treats "security.md" and "SECURITY.md" as the very same file on disk —
  # write to one and you have written to the other. Matching capitals only would let a write
  # spelled with different capitals walk straight past this rule while still landing on the real
  # file it is meant to protect. This is a separate variable, used only here — Rule 1's
  # ".dev-team/" folder test just above stays case-SENSITIVE on purpose: a folder name really can
  # differ only by case on a case-sensitive filesystem (most Linux CI runners), and refusing a
  # write that merely looks like ".DEV-TEAM/" or "Dev-Team/" is the safe direction to be wrong in,
  # since the cost of a wrongly-refused write is just "try the real path", not a ledger going to
  # the wrong place. An escaped path (see resolve_lexical) is skipped here entirely: it has left
  # the project, so it cannot be "the project's own top-level file" this rule exists to protect —
  # Rule 1 above still judges it by file name regardless.
  resolved_lc="$(printf '%s' "$resolved" | tr '[:upper:]' '[:lower:]')"
  protected=0
  case "$resolved_lc" in
    project.md|features.md|security.md|verification.md|migration.md|handoff.md|verdict.json|.github/security.md|docs/security.md)
      protected=1
      ;;
  esac

  # In a session started in a subfolder ($sub non-empty, for example "src"), ALSO protect the
  # seven ledger names sitting directly inside that subfolder: "src/project.md", "src/features.md",
  # "src/security.md", "src/verification.md", "src/migration.md", "src/handoff.md" and
  # "src/verdict.json".
  #
  # What went wrong without this: the hook already treats "src/.dev-team/" as the session's own
  # plugin folder, and reads loop.lock/ and config.yml from it, because every skill writes
  # ".dev-team/<name>" as a RELATIVE path, measured from the session folder. The same relative
  # writing means that a stale instruction ("append the findings to SECURITY.md") lands on
  # "src/SECURITY.md" — before v1.5.0 that was genuinely where a subfolder session's ledger went,
  # and today it may be the package's own security policy or feature list. Rule 2 only matched the
  # top folder's names, so that write was allowed even with "src/.dev-team/loop.lock/" present.
  #
  # Why ADDITIVE (both places) and not "the session folder instead of the top": the written
  # documents (conventions.md, and /dev-team-move-ledgers, which uses `git rev-parse
  # --show-toplevel`) say .dev-team/ lives at the top of the project, while the skills, by writing
  # relative paths, use the session folder in practice. Which of the two is the intended home is an
  # open question with the owner. Protecting BOTH is correct whichever way that is settled, and
  # the cost is small: the rule still only fires during a run and only on content carrying the
  # marker or a record id, so a person's own plain edit to "src/SECURITY.md" is never blocked, and
  # `guard: off` still clears it.
  #
  # Deliberately NOT protected: "src/.github/security.md" and "src/docs/security.md". The top-level
  # list includes .github/ and docs/ only because GitHub reads a repository's security policy from
  # exactly three places — the repository top, its .github/ folder and its docs/ folder. Copies in
  # a subfolder's .github/ or docs/ are not the published policy, and this plugin never wrote its
  # ledgers there, so adding them would widen the rule without guarding against any real mistake.
  # Also NOT protected: anything deeper, such as "src/deep/security.md" from a session in "src" —
  # the plugin's relative writes never put a ledger there either.
  #
  # How the match is done: cut "<sub>/" off the front, then require what is left to be exactly one
  # of the seven names. Because none of the seven names contains a "/", a deeper path like
  # "deep/security.md" can never match. "$sub_lc" is QUOTED in both the prefix test and the cut, so
  # it is taken as plain text: a subfolder literally named "s*" or "[1]" matches only a path that
  # really starts with "s*/" or "[1]/", and never widens into a wildcard that would also catch
  # "sx/security.md" or "1/security.md". It is lower-cased like $resolved_lc, so the comparison
  # ignores case in the same way as the top-level list (see the comment above).
  #
  # What this still cannot do: it only knows the session folder the payload's `cwd` names. A
  # session started at the top that writes "src/SECURITY.md" is not covered, because nothing in
  # the call says "src" is anyone's plugin home. And outside git, $sub is empty (see "What this
  # hook CANNOT do"), so the session folder is judged as the top and its names are covered by the
  # top-level list anyway.
  if [ "$protected" -eq 0 ] && [ -n "$sub" ]; then
    sub_lc="$(printf '%s' "$sub" | tr '[:upper:]' '[:lower:]')"
    case "$resolved_lc" in
      "$sub_lc"/*)
        in_sub="${resolved_lc#"$sub_lc"/}"
        case "$in_sub" in
          project.md|features.md|security.md|verification.md|migration.md|handoff.md|verdict.json)
            protected=1
            ;;
        esac
        ;;
    esac
  fi

  if [ "$protected" -eq 1 ]; then
    if printf '%s' "$content" | grep -Eq "$marker_pattern|$id_pattern"; then
      deny "\"$norm_path\" is a project-level file with a dev-team ledger name, and the content being written to it looks like this plugin's own output (the dev-team marker or a record id). The suite writes only into .dev-team/. If this is the project's own file and you meant to write to it, do it yourself, or turn the guard off (guard: off in .dev-team/config.yml)."
    fi
  fi
fi

exit 0

#!/usr/bin/env bash
# dev-team guardrail (PreToolUse/Bash). Blocks only the truly unrecoverable actions,
# and ONLY while a dev-team run is active (unless DEV_TEAM_GUARD is set). Fail-open by
# design: any error, or no active run => allow (exit 0) — with two exceptions that fail CLOSED
# on purpose, listed under "How long it takes" below. One defense layer, best-effort
# string matching — NEVER the safety guarantee.
#   - The authoritative protection for `main` is SERVER-SIDE GitHub branch protection.
#   - The live-Stripe-key check is a Bash-command heuristic only (it inspects tool_input.command),
#     NOT a secret-leak control — that is the gitleaks scan wired by dev-team-ship, plus GitHub
#     secret scanning / push protection on the repo.
#
# What it refuses (exit 2), while it is active:
#   1. A `git push` whose command text names `main` or `master` as a whole word — as a plain
#      word, inside a refspec (HEAD:main, +main, refs/heads/main), in a brace list ({main,x}), in
#      double or single quotes, behind a backslash (\main), or spelled with bash's escapes inside
#      $'...' ($'\x6d\x61\x69\x6e', $'\155ain', $'\u006dain'). The text is read the way the shell
#      reads it: quotes and backslashes are removed and $'...' escapes worked out first, so 'main',
#      "main", \main and ma'in' are all "main", and 'git' push and /usr/bin/git push are git pushes.
#      A command string handed to `sh -c` / `bash -c` / `zsh -c` (and the like, after any options
#      and a `--`) or to `eval` is read the same way, one level at a time, three levels deep. The
#      command text as written is also checked with its quotes, braces and slashes treated as
#      spaces, which catches a push written out for a shell to run from its standard input:
#      `echo 'git push origin main' | sh`, `sh <<< 'git push origin main'`.
#   2. A `git push` that names NO branch — a bare `git push`, `git push <remote>`, `git push
#      origin HEAD`, `git push origin :` / `+:` (git's "matching" refspec), or `git push --all` /
#      `--branches` / `--mirror` — when the hook can work out from the repository's own git
#      settings that it would push to `main` or `master`: the current branch's name, the branch
#      it tracks (`branch.<name>.merge`), `push.default` (`nothing`, `matching`, `current`,
#      `simple`, `upstream`), and a `remote.<name>.push` setting if there is one (a destination
#      it names, a `*` pattern — read as pushing any local main/master — and `:`, read exactly as
#      `push.default=matching`). It asks git in the folder the command runs in (the hook input's
#      `cwd`, then any `git -C <dir>` in the command) and passes through the command's own
#      `-c`, `--git-dir` and `--work-tree` options.
#      The same goes for a branch named with no destination (`git push origin feature`): git sends
#      it through the remote's `remote.<name>.push` refspecs, and failing those, under
#      `push.default=upstream`, to its upstream, so either can send it to `main` or `master`.
#   3. A live Stripe key (sk_live_, rk_live_, pk_live_) anywhere in the command text.
#
# How long it takes, and the two refusals that are about the guard, not the command:
#   Claude Code stops waiting for a hook after a while and then runs the command anyway, so a
#   guard that is too slow is not there at all. The time this hook takes grows in step with the
#   command's length (it reads it line by line and never builds up one long piece of text), and:
#   - it works out where at most 10 `git push` commands go in one command (each asks git several
#     questions); a command with more — counting those inside a command string handed to a
#     shell — is REFUSED, with a message asking for it to be split;
#   - all of its checking runs under a 20-second limit (DEV_TEAM_GUARD_TIME_LIMIT can make it
#     shorter, never longer); a command whose checking runs past it is REFUSED the same way, and
#     anything the checking was still waiting on (a git that does not answer, say) is stopped.
#   These two fail closed because letting such a command through would mean the guard could be
#   switched off by writing a longer command.
#
# What it cannot see, and so lets through (stated here so nobody reads more into it). It reads the
# ordinary ways of spelling a word, listed above; it does not run the shell, so it cannot know
# anything the shell only works out while the command runs:
#   - a branch or command held in a variable ($BRANCH), in a default value (${X:-main}), or made
#     by another command ($(...), `...`), by arithmetic, by a glob, or by braces that build a
#     word out of parts ({ma,xx}in, {m..n});
#   - a command run from a script file, an alias, a git alias or a shell function, or put together
#     by another program (xargs, env -S, find -exec and the like);
#   - text given to a shell on its standard input that is not written out in this command's own
#     text (the raw-text rule above sees `echo 'git push origin main' | sh` only because the words
#     are there to read; printf with escapes, or a file, gets through);
#   - a command string nested more than three levels deep (sh -c inside sh -c inside ...);
#   - a bare push when it cannot tell where it would go: an earlier `cd`/`pushd`/`popd` in the
#     same command, or `env -C <dir>` / `env --chdir=<dir>` in front of git (the folder it would
#     run in is then unknown), a GIT_* variable set in the command, a folder that is not a git
#     repository, `git` not installed, or a detached HEAD.
#     (A `remote.<name>.push` setting is not a limit: one that names neither branch, uses no `*`
#     and is not `:` sends nothing to main or master, so letting that push through is correct.
#     An earlier wording listed it here as something the hook "cannot see"; it was wrong both
#     ways, since it also hid that `:` was being missed.)
#   - any branch name other than `main` and `master` (it does not read GitHub's own protection
#     settings);
#   - anything at all when `jq` is not installed: it then only scans the raw hook input as plain
#     text, the way it did before quotes were handled, and can miss things.
# It reads the text of the command before the command runs; it does not watch what actually
# happens. A command that misses every pattern above is allowed. The other way round, the check on
# the command text as written (with quotes treated as spaces) also refuses a command that only
# mentions a push to main in its text — `git commit -m 'fix: push to main'`, `echo 'git push
# origin main'` — because it cannot tell text that is only shown from text a shell will run; do
# such a command yourself, or word it differently.
set -u
# No filename globbing anywhere in this hook: words and branch names from the command are only
# ever compared, never matched against files.
set -f
payload="$(cat 2>/dev/null)" || exit 0

# Scope: repo-scoped guard mode (.dev-team/config.yml, best-effort, fail-open) folded into the
# active-run scope check. off = disabled repo-wide; on = forced on (skip the scope gate); auto/unset
# (default) = only enforce during an active run, unless explicitly forced on via DEV_TEAM_GUARD.
guard_mode=""
[ -f .dev-team/config.yml ] && guard_mode="$(grep -Eo '^[[:space:]]*guard:[[:space:]]*(on|off|auto)' .dev-team/config.yml 2>/dev/null | grep -Eo '(on|off|auto)$' | head -1)"
case "$guard_mode" in
  off) exit 0 ;;                                   # disabled repo-wide
  on)  : ;;                                        # forced on — skip the active-run scope gate
  *)   if [ -z "${DEV_TEAM_GUARD:-}" ]; then [ -f ".dev-team/autopilot.json" ] || exit 0; fi ;;
esac

# The command text, and the folder it will run in. Both come from the hook's own JSON input when
# jq is available. Without jq the whole raw input is scanned as text (rule "(a)" below only), which
# is what the hook did before it understood quotes.
cmd=""
run_dir=""
have_jq=0
if command -v jq >/dev/null 2>&1; then
  have_jq=1
  cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"
  run_dir="$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null)"
fi
[ -n "$cmd" ] || { cmd="$payload"; have_jq=0; }
[ -n "$run_dir" ] && [ -d "$run_dir" ] || run_dir="$PWD"
norm="$(printf '%s' "$cmd" | tr '\n' ' ' | tr -s ' ')"

deny() {
  echo "dev-team guard: $1 Blocked as unrecoverable during an active run. Do it yourself, or disable the guard (remove .dev-team/autopilot.json or unset DEV_TEAM_GUARD)." >&2
  exit 2
}
# The two refusals that are not about what the command does, but about the guard not being able to
# check all of it (too many pushes, or too long to check). They fail CLOSED on purpose: letting such
# a command through would mean the guard can be switched off by writing a longer command.
refuse() {
  echo "dev-team guard: $1" >&2
  exit 2
}

# At most this many `git push` commands are worked out in one command (see check_simple_command).
MAX_PUSHES=10
too_many_pushes() {
  refuse "this command has more than $MAX_PUSHES \`git push\` commands, more than the guard can check in one go, so it is refused rather than let through unchecked. Split it into smaller commands."
}
# The line that stands for a redirection among a simple command's words. No word can ever be a line
# break — read_words turns a line break inside a word into a space and prints one word per line —
# so no word in a command can equal it. (It used to be the word "@@REDIR", which a command could
# spell out.)
REDIR=$'\n'

# ---------------------------------------------------------------------------------------------
# The text rules. Each takes the text to test as its only argument.
# ---------------------------------------------------------------------------------------------
# A copy with common argument separators (: + / " ' = ; , ( ) { }) turned into spaces, so a target
# branch can't hide inside a refspec (HEAD:main, +main, x:refs/heads/main), a quote ("main" or
# 'main'), a list in braces ({main,x}), a refs/heads/ prefix, or trailing punctuation (main;).
# main/master must appear as a whole, space-delimited token to match — so "maintenance" and
# "feature-main" do NOT trip it. The single quote and the braces were added after the stand-in
# review of 42bd45e..b39f40d: without them `git push origin {main,x}` (the shell turns it into
# `main x`), `echo 'git push origin main' | sh` and `sh <<< 'git push origin main'` all got through.
sep_copy() { printf ' %s ' "$1" | tr ":+/\"=;,(){}'" '            '; }
# `git push` even with global options between git and push (e.g. `git -C dir push`). text_rules
# asks this of the text as written AND of its sep_copy, so a git push written inside quotes (for a
# shell to run: `echo 'git push origin main' | sh`) or as /usr/bin/git is seen too. In the
# sep_copy a separator next to a space leaves two spaces, which the pattern does not cross, so
# `git commit -m 'push to main'` (the quote opens right before push) is still not a push.
is_git_push() { printf '%s' " $1 " | grep -Eq ' git ([^ ]+ )*push([ ]|$)'; }
# A main/master push target, as a bare token in a copy already made by sep_copy.
targets_main() { printf '%s' "$1" | grep -Eq ' (main|master) '; }
# A force update: --force / --force-with-lease / -f, or a leading `+` refspec on main/master.
has_force() {
  printf '%s' " $1 " | grep -Eq '(--force|--force-with-lease| -f )' && return 0
  printf '%s' "$1" | grep -Eq '[[:space:]]\+[^[:space:]]*(main|master)'
}
has_live_stripe_key() { printf '%s' "$1" | grep -Eq '(sk|rk|pk)_live_[A-Za-z0-9]'; }

# Applies the three text rules to one piece of text. The force rule is checked first only so
# that its clearer message is the one shown; either way the push is refused. Each test runs once
# (the command text can be long, and every test reads all of it).
text_rules() {
  local s
  s="$(sep_copy "$1")"
  if { is_git_push "$1" || is_git_push "$s"; } && targets_main "$s"; then
    has_force "$1" && deny "force-push to main/master detected."
    deny "push to main/master detected."
  fi
  if has_live_stripe_key "$1"; then
    deny "live Stripe key detected (dev-team is test-mode only)."
  fi
}

# ---------------------------------------------------------------------------------------------
# Reading the command the way the shell does.
# ---------------------------------------------------------------------------------------------
# Two small awk programs, one after the other, read the command text. Both work line by line and
# never build up a long piece of text: the first prints each character of a word as soon as it has
# read it, and the second receives each finished word as one line, which awk reads in one go. That
# keeps the time the reading takes in proportion to the length of the command.
#
# Why it is done this way (the stand-in review of 42bd45e..b39f40d, finding on speed): the reader
# before this one joined the whole command into one piece of text, then took it apart one
# character at a time with awk's substr(). On macOS's awk every substr() call first measures the
# whole text, so the work grew with the SQUARE of the command's length, and the words, the joined
# text and the output were each built by adding to the end of a growing piece of text, which grows
# the same way. Measured before the change, with macOS's bash 3.2 and awk: a heredoc of 10,000
# short lines took about 21 seconds, a 129 KB `git commit -m` message 2 to 9 seconds (depending on
# how busy the machine was), and 200 bare `git push` commands about 38 seconds — long enough for
# Claude Code to give up waiting for the hook, which then lets the command run unchecked.
#
# read_words, the first program, reads the text on its standard input the way the shell does,
# after the shell's own quote removal: '...' keeps everything literally, "..." keeps everything
# except that a backslash before $ ` " \ or a line break is removed, a bare backslash makes the next
# character literal, $'...' and $"..." lose their $. Outside quotes, a line break and ; & | ( ) `
# end a simple command; > and < start a redirection. Spaces, tabs and line breaks INSIDE a quoted
# word are kept as single spaces, so a commit message such as 'push to main' stays one word and is
# never read as a push. This is a reading aid, not a full shell parser: it does not expand
# variables, globs, braces or aliases.
# It prints one line per item, and every line starts with a letter saying what it is, so nothing
# in a command can be mistaken for one of these markers (the reader before this one used lines
# such as "@@SEP", which a command's own word could equal):
#   w<word>   a word
#   R         a redirection straight after a word (as in 2>&1; the word may be a number that
#             belongs to the redirection, which the second program decides)
#   r         a redirection after a space
#   s         the end of a simple command
# A line that contains none of the characters it has to look at, outside any quote, is split into
# words in one step. Any other line is split into single characters once (split() with an empty
# separator, which macOS awk, mawk and gawk all do), and a stretch of ordinary characters — a long
# quoted message, say — is printed in one go rather than one character at a time.
read_words() {
  LC_ALL=C awk '
    function openw() { if (!inw) { printf "w"; inw = 1 } }
    # One character of the current word. A tab becomes a space (a line break inside a quoted word
    # is turned into a space where the line ends).
    function put(c) { if (!inw) { printf "w"; inw = 1 }; if (c == "\t") c = " "; printf "%s", c }
    function endword() { if (inw) { printf "\n"; inw = 0 } }
    function endcmd() { endword(); printf "s\n" }
    # Splits the current line at the characters that matter in one reading state (re), keeping
    # the pieces in P and the position where each piece starts in S; returns the number of pieces.
    # Done at most once per line and state, and only when that state is met on the line.
    function prep(P, S, re,   np, k, pos) {
      np = split(line, P, re)
      pos = 1
      for (k = 1; k <= np; k++) { S[k] = pos; pos += length(P[k]) + 1 }
      return np
    }
    # Prints, as part of the current word, the stretch from position i up to the next character
    # that matters in reading state w (the pieces from prep), and moves i to that character. This
    # is what keeps a long quoted message quick: one printf for the whole stretch instead of one
    # per character. ptr[w] only ever moves forward along the line.
    function jump(P, S, np, w,   off, piece) {
      while (ptr[w] < np && S[ptr[w] + 1] <= i) ptr[w]++
      off = i - S[ptr[w]] + 1
      piece = (off == 1) ? P[ptr[w]] : substr(P[ptr[w]], off)
      i = S[ptr[w]] + length(P[ptr[w]])
      if (piece != "") { if (index(piece, "\t") > 0) gsub(/\t/, " ", piece); openw(); printf "%s", piece }
    }
    # The escapes bash reads inside $'\''...'\'' (the stand-in review of 42bd45e..b39f40d found
    # $'\''\x6d\x61\x69\x6e'\'', which bash reads as main, let through: this reader used to keep
    # only the character after the backslash). One byte of a decoded escape: a tab or a line break
    # becomes a space, as inside any quoted word, and a zero byte (which ends a string in bash) is
    # dropped. awk runs with LC_ALL=C, so %c prints one byte.
    function putbyte(v) { if (v == 0) return; if (v == 9 || v == 10) put(" "); else put(sprintf("%c", v)) }
    # A character number from \u or \U, written out in UTF-8, as bash does.
    function putcode(v) {
      if (v < 128) { putbyte(v); return }
      if (v < 2048) { put(sprintf("%c%c", 192 + int(v / 64), 128 + v % 64)); return }
      if (v < 65536) { put(sprintf("%c%c%c", 224 + int(v / 4096), 128 + int(v / 64) % 64, 128 + v % 64)); return }
      put(sprintf("%c%c%c%c", 240 + int(v / 262144) % 8, 128 + int(v / 4096) % 64, 128 + int(v / 64) % 64, 128 + v % 64))
    }
    # The value of one hexadecimal digit, or -1 (also for an empty string, past the end of a line:
    # macOS awk says an empty string is found at position 1 of any text).
    function hexv(d) { if (length(d) != 1) return -1; return index("0123456789abcdef", tolower(d)) - 1 }
    # The number of a printable character (for \cX), from a table made once in BEGIN.
    function ord(d) { if (length(d) != 1) return 0; return index(asc, d) + 31 }
    # Decodes the escape whose backslash is at ch[i], inside $'\''...'\'', the way bash does, and
    # returns how many characters it used: \a \b \e \E \f \n \r \t \v; a backslash before a
    # backslash, either quote or a question mark; one to three octal digits; \x with one or two
    # hexadecimal digits, \u with one to four, \U with one to eight; and \cX (control-X). Any
    # other backslash stays, with the character after it.
    function esc(i,   d, v, k, m) {
      d = ch[i + 1]
      if (d == "a") { putbyte(7); return 2 }
      if (d == "b") { putbyte(8); return 2 }
      if (d == "e" || d == "E") { putbyte(27); return 2 }
      if (d == "f") { putbyte(12); return 2 }
      if (d == "n") { putbyte(10); return 2 }
      if (d == "r") { putbyte(13); return 2 }
      if (d == "t") { putbyte(9); return 2 }
      if (d == "v") { putbyte(11); return 2 }
      if (d == "\\" || d == "'\''" || d == "\"" || d == "?") { put(d); return 2 }
      if (d ~ /^[0-7]$/) {
        v = 0; k = 0
        while (k < 3 && ch[i + 1 + k] ~ /^[0-7]$/) { v = v * 8 + ch[i + 1 + k]; k++ }
        putbyte(v % 256); return 1 + k
      }
      if (d == "x" || d == "u" || d == "U") {
        m = (d == "x") ? 2 : ((d == "u") ? 4 : 8)
        v = 0; k = 0
        while (k < m && hexv(ch[i + 2 + k]) >= 0) { v = v * 16 + hexv(ch[i + 2 + k]); k++ }
        if (k == 0) { put("\\"); put(d); return 2 }
        if (d == "x") putbyte(v); else putcode(v)
        return 2 + k
      }
      if (d == "c" && length(ch[i + 2]) == 1) { putbyte(ord(ch[i + 2]) % 32); return 3 }
      put("\\"); put(d); return 2
    }
    BEGIN { st = 0; inw = 0; jn = 0; for (k = 32; k < 127; k++) asc = asc sprintf("%c", k) }
    # st: 0 unquoted, 1 inside '\''...'\'', 2 inside "...", 3 inside $'\''...'\''
    {
      line = $0
      # A line with nothing to look at, outside any quote and with no word still open from the
      # line before, is split into words in one step. Inside a quote, a line with no closing quote
      # and no backslash is part of the current word as it stands.
      if (st == 0 && !inw && line !~ /[;&|()`<>\\"$]/ && index(line, "'\''") == 0) {
        n = split(line, parts)
        for (k = 1; k <= n; k++) printf "w%s\n", parts[k]
        endcmd()
        next
      }
      if ((st == 1 && index(line, "'\''") == 0) || (st == 2 && line !~ /["\\]/) || (st == 3 && line !~ /['\''\\]/)) {
        gsub(/\t/, " ", line)
        openw(); printf "%s ", line
        next
      }
      jn = 0
      n = split(line, ch, "")
      np0 = np1 = np2 = np3 = -1
      ptr[0] = ptr[1] = ptr[2] = ptr[3] = 1
      i = 1
      while (i <= n) {
        c = ch[i]
        if (st == 1) {
          if (c == "'\''") { st = 0; i++; continue }
          if (np1 < 0) np1 = prep(P1, S1, "'\''")
          jump(P1, S1, np1, 1); continue
        }
        if (st == 3) {
          if (c == "\\" && i < n) { i += esc(i); continue }
          if (c == "'\''") { st = 0; i++; continue }
          if (c == "\\") { put(c); i++; continue }
          if (np3 < 0) np3 = prep(P3, S3, "['\''\\\\]")
          jump(P3, S3, np3, 3); continue
        }
        if (st == 2) {
          if (c == "\"") { st = 0; i++; continue }
          if (c == "\\") {
            if (i == n) { jn = 1; i++; continue }              # backslash + line break: both go
            d = ch[i + 1]
            if (d == "$" || d == "`" || d == "\"" || d == "\\") { put(d); i += 2; continue }
            put(c); i++; continue
          }
          if (np2 < 0) np2 = prep(P2, S2, "[\"\\\\]")
          jump(P2, S2, np2, 2); continue
        }
        if (c == " " || c == "\t") { endword(); i++; continue }
        if (c == ";" || c == "|" || c == "(" || c == ")" || c == "`") { endcmd(); i++; continue }
        if (c == "&" && ch[i + 1] != ">") { endcmd(); i++; continue }
        if (c == ">" || c == "<" || c == "&") {
          if (inw) { endword(); printf "R\n" } else printf "r\n"
          while (i <= n && index("<>&|", ch[i]) > 0) i++
          continue
        }
        if (c == "\\") {
          if (i == n) { jn = 1; i++; continue }                # backslash + line break: both go
          put(ch[i + 1]); i += 2; continue
        }
        if (c == "'\''") { st = 1; openw(); i++; continue }
        if (c == "\"") { st = 2; openw(); i++; continue }
        if (c == "$" && ch[i + 1] == "'\''") { st = 3; openw(); i += 2; continue }
        if (c == "$" && ch[i + 1] == "\"") { st = 2; openw(); i += 2; continue }
        if (c == "$") { put(c); i++; continue }
        if (np0 < 0) np0 = prep(P0, S0, "['\'' \t;&|()`<>\\\\\"$]")
        jump(P0, S0, np0, 0)
      }
      # The line break at the end of this line.
      if (jn) { }                                   # removed by the backslash before it
      else if (st == 0) endcmd()                    # ends the simple command
      else put(" ")                                 # inside a quote: part of the word, as a space
    }
    END { endcmd() }
  ' 2>/dev/null
}

# keep_commands, the second program, reads read_words' lines. It does two things with them.
#   1. The text rules on the words joined together (quotes removed), one word at a time, with no
#      joined text ever built: a word that is git followed later by a word that is push; main or
#      master as a whole piece of a word once the separators : + / " = ; , ( ) are treated as
#      spaces; a force (--force anywhere in a word, a word -f, or a word starting with + that
#      names main or master); a live Stripe key. A space inside a quoted word counts as part of
#      the word, so 'push to main' is one word and is not read as a push. Its last line is "v"
#      followed by a letter for each rule that matched: P (a git ... push), M (main or master),
#      F (a force), S (a Stripe key).
#   2. It passes on, in read_words' format, only the simple commands the rest of this hook needs
#      to look at word by word: one with a word that is git, a shell (sh, bash, zsh, dash, ksh) or
#      eval, or a GIT_...= setting, or one whose first word is cd, pushd, popd, export, declare,
#      typeset, set, builtin or command. Leaving the rest out keeps a long command — a large
#      heredoc, say — quick to check: the word-by-word part runs in bash, which is slow on
#      thousands of words. A number straight before a redirection (the 2 in 2>&1) is dropped here,
#      because it belongs to the redirection, not to the command.
keep_commands() {
  LC_ALL=C awk '
    # Each test starts with a cheap one (a comparison, or index() looking for a fixed piece of
    # text) and only uses a pattern when that says it may match: a heredoc of 10,000 lines is
    # tens of thousands of words, and macOS awk is slow at patterns.
    function rules(t,   x, mm) {
      # A space inside a quoted word counts as part of the word, so it becomes _ here.
      if (index(t, " ") > 0) gsub(/ /, "_", t)
      if (t == "git" || t ~ /\/git$/) G = 1
      else if (G && t == "push") P = 1
      mm = (index(t, "main") > 0 || index(t, "master") > 0)
      if (index(t, "--force") > 0 || t == "-f" || (mm && substr(t, 1, 1) == "+")) F = 1
      if (mm) {
        x = t
        gsub(/[:+\/"=;,(){}'\'']/, " ", x)
        if ((" " x " ") ~ / (main|master) /) M = 1
      }
      if (index(t, "_live_") > 0 && t ~ /(sk|rk|pk)_live_[A-Za-z0-9]/) S = 1
    }
    function endcmd(   k, keep, first) {
      if (nw > 0) {
        keep = hit; first = 1
        while (first <= nw && kind[first] == "w" && cw[first] ~ /^[A-Za-z_][A-Za-z0-9_]*=/) first++
        if (first <= nw && kind[first] == "w" && cw[first] ~ /^(cd|pushd|popd|export|declare|typeset|set|builtin|command)$/) keep = 1
        if (keep) {
          for (k = 1; k <= nw; k++) { if (kind[k] == "w") print "w" cw[k]; else print "r" }
          print "s"
        }
      }
      nw = 0; hit = 0
    }
    # Is this word one that makes its simple command worth passing on: git, a shell, eval, or a
    # GIT_...= setting? (The cheap index() tests come first; see rules().)
    function trigger(x) {
      if (x == "eval") return 1
      if (index(x, "git") == 0 && index(x, "sh") == 0 && index(x, "GIT_") != 1) return 0
      return (x ~ /(^|\/)(git|sh|bash|zsh|dash|ksh)$/ || x ~ /^GIT_[A-Za-z0-9_]*=/)
    }
    BEGIN { nw = 0; hit = 0; G = 0; P = 0; F = 0; M = 0; S = 0 }
    # Most words (a heredoc of plain text, say) contain none of the pieces rules() and trigger()
    # look for; one pattern test per word skips both for them, which halves the time this program
    # takes on a 10,000-line heredoc with macOS awk. (No apostrophes in these comments: this whole
    # program sits inside single quotes.)
    # The list covers every piece either function tests: git, sh (and so bash, zsh, dash, ksh),
    # eval, GIT_, push, main, master, -f (and so --force) and live_ (a Stripe key; without the
    # leading _ because a space inside a word becomes _ only in rules()).
    /^w/ {
      nw++; kind[nw] = "w"; cw[nw] = substr($0, 2)
      if (cw[nw] ~ /git|sh|eval|GIT_|push|main|master|-f|live_/) { rules(cw[nw]); if (!hit && trigger(cw[nw])) hit = 1 }
      next
    }
    $0 == "R" { if (nw > 0 && kind[nw] == "w" && cw[nw] ~ /^[0-9]+$/) nw--; nw++; kind[nw] = "r"; next }
    $0 == "r" { nw++; kind[nw] = "r"; next }
    $0 == "s" { endcmd(); next }
    END { endcmd(); printf "v%s%s%s%s\n", (P ? "P" : ""), (M ? "M" : ""), (F ? "F" : ""), (S ? "S" : "") }
  ' 2>/dev/null
}

# Set by an earlier `cd`, `pushd` or `popd` command (or an `export GIT_...=`) before a push in the
# same command line: the folder or repository that push would use is then unknown, so a push that
# names no branch is not resolved after it.
unknown_place=0

# Is this word the program `git` (git, /usr/bin/git, ./git)?
is_git_word() { case "$1" in git|*/git) return 0 ;; esac; return 1; }
# Is this word a shell that takes a command string after -c?
is_shell_word() { case "$1" in sh|bash|zsh|dash|ksh|*/sh|*/bash|*/zsh|*/dash|*/ksh) return 0 ;; esac; return 1; }
# Does this branch name (short, or refs/heads/...) name a protected branch?
is_protected() { case "$1" in main|master|refs/heads/main|refs/heads/master) return 0 ;; esac; return 1; }

# Runs git in the folder the push would run in, with the push command's own -C / -c / --git-dir /
# --work-tree options (held in the array gopts), and prints nothing on any error.
g() { git -C "$run_dir" ${gopts[@]+"${gopts[@]}"} "$@" 2>/dev/null; }

# Prints the local branches main and master that exist, one per line.
local_protected() {
  local b
  for b in main master; do
    g show-ref --verify --quiet "refs/heads/$b" && echo "$b"
  done
}

# Prints the destination branch of each refspec given as an argument, as git would push it, as
# far as that can be told from the refspec alone; a refspec with a * prints the local main/master
# branches (it would push them), and a refspec of HEAD or @ with no destination prints the
# current branch ($cur).
# A refspec that is empty on both sides of the colon — `:` or `+:`, on the command line or in a
# remote.<name>.push setting — is git's "matching" refspec: it pushes every branch that exists
# both here and on the remote, main included. It is treated exactly as push.default=matching is.
# (It used to fall through to the source/destination split below, which found two empty names and
# printed nothing, so `git push origin :` was let through; the stand-in review of 42bd45e..b39f40d
# found that.)
refspec_targets() {
  local r src dst
  for r in "$@"; do
    r="${r#+}"
    case "$r" in
      :) local_protected; continue ;;
      *'*'*) local_protected; continue ;;
      *:*) src="${r%%:*}"; dst="${r#*:}" ;;
      *) src="$r"; dst="" ;;
    esac
    if [ -z "$dst" ]; then
      case "$src" in
        HEAD|@) [ -n "$cur" ] && echo "$cur" ;;
        *) if [ "$map_named" -eq 1 ]; then map_named_source "$src"; else echo "$src"; fi ;;
      esac
    else
      echo "${dst#refs/heads/}"
    fi
  done
}

# Prints the branch git would push a named source with no destination to — the `feature` of
# `git push origin feature`. git does not always push it under its own name: when the remote has
# push refspecs (remote.<name>.push), the first one whose source matches the branch decides where
# it goes, and if none does and push.default is upstream (or tracking), the branch's upstream does.
# This follows git's own push command (map_refspec() in builtin/push.c): the name must be one of
# the local branches, a refspec's source is compared with the branch's full name
# (refs/heads/<name>) or matched as a * pattern, a refspec without a destination is skipped, and
# HEAD is not mapped at all (the caller has already turned it into the current branch). The
# remote's push refspecs ($map_specs), push.default ($map_default) and the list of local branches
# ($map_branches) are read once per push by the caller, so a push naming many branches does not
# ask git the same questions for each; and when neither the refspecs nor push.default can move a
# branch, nothing is asked at all. The stand-in review of 42bd45e..b39f40d found
# `git push origin feature` let through while remote.origin.push =
# refs/heads/feature:refs/heads/main sent it to main; each case here was checked against
# `git push --dry-run`.
# A negative refspec (^...) is not read, so a push it would exclude may still be refused.
map_named_source() {
  local src="$1" full spec a b pre suf mid bpre bsuf dst merge
  if [ -z "$map_specs" ]; then
    case "$map_default" in upstream|tracking) ;; *) echo "$src"; return 0 ;; esac
  fi
  case "$src" in
    refs/heads/*) full="$src" ;;
    refs/*) echo "$src"; return 0 ;;                  # not a branch: git pushes it by that name
    heads/*) full="refs/$src" ;;
    *) full="refs/heads/$src" ;;
  esac
  # Is it a local branch? $map_branches holds every local branch's full name, one per line.
  case "$nl$map_branches$nl" in
    *"$nl$full$nl"*) ;;
    *) echo "$src"; return 0 ;;
  esac
  # shellcheck disable=SC2086  # one refspec per word, on purpose; globbing is off (set -f)
  for spec in $map_specs; do
    spec="${spec#+}"
    case "$spec" in ^*|:*|*:) continue ;; *:*) ;; *) continue ;; esac
    a="${spec%%:*}"; b="${spec#*:}"
    case "$a" in
      *'*'*)
        pre="${a%%\**}"; suf="${a#*\*}"
        case "$full" in
          "$pre"*"$suf")
            mid="${full#"$pre"}"; mid="${mid%"$suf"}"
            bpre="${b%%\**}"; bsuf="${b#*\*}"
            dst="$bpre$mid$bsuf"
            echo "${dst#refs/heads/}"; return 0 ;;
        esac ;;
      *) if [ "$a" = "$full" ]; then echo "${b#refs/heads/}"; return 0; fi ;;
    esac
  done
  case "$map_default" in
    upstream|tracking)
      merge="$(g config --get "branch.${full#refs/heads/}.merge")" || merge=""
      if [ -n "$merge" ]; then echo "${merge#refs/heads/}"; return 0; fi ;;
  esac
  echo "${full#refs/heads/}"
}

# Prints where a push that names no branch would go (one branch per line), or nothing when it
# cannot tell. $1 is the remote named in the command, if any; $2 is 1 for --all/--branches/--mirror.
implicit_targets() {
  local remote="$1" allmode="$2" default merge pushspecs
  g rev-parse --git-dir >/dev/null || return 0          # not a git repository, or no git: cannot tell
  if [ "$allmode" = 1 ]; then local_protected; return 0; fi
  cur="$(g symbolic-ref --quiet --short HEAD)" || cur=""
  if [ -z "$remote" ] && [ -n "$cur" ]; then
    remote="$(g config --get "branch.$cur.pushRemote")" \
      || remote="$(g config --get remote.pushDefault)" \
      || remote="$(g config --get "branch.$cur.remote")" \
      || remote="origin"
  fi
  [ -n "$remote" ] || remote="origin"
  pushspecs="$(g config --get-all "remote.$remote.push")"
  if [ -n "$pushspecs" ]; then
    # A remote.<name>.push setting replaces push.default: git pushes exactly those refspecs.
    # shellcheck disable=SC2086  # one refspec per word, on purpose; globbing is off (set -f)
    refspec_targets $pushspecs
    return 0
  fi
  default="$(g config --get push.default)" || default="simple"
  merge="$(g config --get "branch.${cur:-.}.merge")" || merge=""
  merge="${merge#refs/heads/}"
  case "$default" in
    nothing) return 0 ;;                                # pushes nothing
    matching) local_protected; return 0 ;;              # every branch that exists on both sides
  esac
  [ -n "$cur" ] || return 0                             # detached HEAD: git pushes nothing here
  case "$default" in
    current|simple) echo "$cur" ;;                      # simple refuses when the tracked name differs
    upstream|tracking) [ -n "$merge" ] && echo "$merge" ;;
    *) echo "$cur"; [ -n "$merge" ] && echo "$merge" ;; # a value this hook does not know: both
  esac
  return 0
}

# Looks at one simple command (its words are the arguments) for a `git ... push` and refuses it
# when the push would go to main or master although no protected branch is named in the text.
check_simple_command() {
  local words=("$@") m=$# j k w first sub repo have_repo allmode tags endopts cannot_tell t targets
  local refspecs env_seen=0
  # The words are in the array now; clear this function's own arguments. bash 3.2 (macOS's) saves
  # a copy of a function's arguments on every function call made from inside it, so with them left
  # in place a `git add` naming 5,000 files took 13 seconds here, one word at a time.
  set --
  # Which word is the command itself: skip leading NAME=value assignments (a GIT_* one changes
  # which repository or settings git uses, so a push in this command cannot be resolved) and the
  # words `builtin` and `command`.
  cannot_tell=$unknown_place
  first=0
  while [ "$first" -lt "$m" ]; do
    w="${words[$first]}"
    case "$w" in
      GIT_*=*) cannot_tell=1 ;;
      [A-Za-z_]*=*) ;;
      builtin|command) ;;
      *) break ;;
    esac
    first=$((first + 1))
  done
  case "${words[$first]:-}" in
    # From here on in this command line, the folder a push would run in is unknown.
    cd|pushd|popd) unknown_place=1; return 0 ;;
    # export GIT_DIR=... and the like change git's repository or settings for later commands.
    export|declare|typeset|set)
      for w in "${words[@]}"; do case "$w" in GIT_*=*) unknown_place=1 ;; esac; done
      return 0 ;;
  esac
  j=$first
  while [ "$j" -lt "$m" ]; do
    case "${words[$j]}" in
      # `env GIT_DIR=... git push` sets the variable after the command word.
      GIT_*=*) cannot_tell=1 ;;
      env|*/env) env_seen=1 ;;
      # `env -C <dir> git push` / `env --chdir=<dir> git push` runs git in another folder. It is
      # treated exactly like a push after a cd: where it would go is not worked out (a stated
      # limit). It used to be worked out in the folder the command started in — the wrong one,
      # found by the stand-in review of 42bd45e..b39f40d.
      -C*|-[!-]*C*|--chdir|--chdir=*) [ "$env_seen" -eq 1 ] && cannot_tell=1 ;;
    esac
    # Only a word ending in "git" can be git; is_git_word decides, but calling a function for
    # every word is slow in bash 3.2 even with the arguments cleared, so it is asked only then.
    case "${words[$j]}" in *git) ;; *) j=$((j + 1)); continue ;; esac
    if ! is_git_word "${words[$j]}"; then j=$((j + 1)); continue; fi
    # The git program's own options, up to its subcommand. -C, -c, --git-dir and --work-tree are
    # kept, so the settings are read the way the push itself would read them.
    gopts=()
    k=$((j + 1))
    while [ "$k" -lt "$m" ]; do
      w="${words[$k]}"
      case "$w" in
        -C|-c|--git-dir|--work-tree)
          if [ $((k + 1)) -lt "$m" ]; then
            gopts[${#gopts[@]}]="$w"
            gopts[${#gopts[@]}]="${words[$((k + 1))]}"
          fi
          k=$((k + 2)) ;;
        --git-dir=*|--work-tree=*|--bare) gopts[${#gopts[@]}]="$w"; k=$((k + 1)) ;;
        --namespace|--super-prefix|--config-env|--attr-source) k=$((k + 2)) ;;
        "$REDIR") k=$((k + 2)) ;;
        -*) k=$((k + 1)) ;;
        *) break ;;
      esac
    done
    sub="${words[$k]:-}"
    if [ "$sub" != "push" ]; then j=$((j + 1)); continue; fi
    # At most MAX_PUSHES pushes are worked out in one command (each one asks git several
    # questions); one more, anywhere in the command or in a command string it hands to a shell, is
    # refused rather than let through unchecked. In counting mode (see analyse) the push is only
    # counted, and nothing else is done with it.
    if [ "$counting" -eq 1 ]; then
      seen=$((seen + 1))
      [ $((pushes + seen)) -gt "$MAX_PUSHES" ] && too_many_pushes
      return 0
    fi
    pushes=$((pushes + 1))
    [ "$pushes" -gt "$MAX_PUSHES" ] && too_many_pushes
    # The push's own arguments: options, then the repository, then the refspecs.
    repo=""; have_repo=0; refspecs=(); allmode=0; tags=0; endopts=0
    k=$((k + 1))
    while [ "$k" -lt "$m" ]; do
      w="${words[$k]}"
      if [ "$w" = "$REDIR" ]; then k=$((k + 2)); continue; fi
      if [ "$endopts" -eq 0 ]; then
        case "$w" in
          --) endopts=1; k=$((k + 1)); continue ;;
          --all|--branches|--mirror) allmode=1; k=$((k + 1)); continue ;;
          --tags) tags=1; k=$((k + 1)); continue ;;
          --repo=*) repo="${w#--repo=}"; k=$((k + 1)); continue ;;
          --repo) repo="${words[$((k + 1))]:-}"; k=$((k + 2)); continue ;;
          -o|--push-option|--receive-pack|--exec) k=$((k + 2)); continue ;;
          -*) k=$((k + 1)); continue ;;
        esac
      fi
      if [ "$have_repo" -eq 0 ]; then repo="$w"; have_repo=1
      else refspecs[${#refspecs[@]}]="$w"
      fi
      k=$((k + 1))
    done
    if [ "$cannot_tell" -eq 0 ]; then
      cur=""
      if [ "${#refspecs[@]}" -gt 0 ]; then
        cur="$(g symbolic-ref --quiet --short HEAD)" || cur=""
        # A named source with no destination is mapped the way git maps it (map_named_source).
        map_specs="$(g config --get-all "remote.$repo.push")" || map_specs=""
        map_default="$(g config --get push.default)" || map_default="simple"
        map_branches=""
        if [ -n "$map_specs" ] || [ "$map_default" = upstream ] || [ "$map_default" = tracking ]; then
          map_branches="$(g for-each-ref --format='%(refname)' refs/heads/)"
        fi
        map_named=1
        targets="$(refspec_targets "${refspecs[@]}")"
        map_named=0
      elif [ "$tags" -eq 1 ] && [ "$allmode" -eq 0 ]; then
        targets=""                                          # --tags alone pushes only tags
      else
        targets="$(implicit_targets "$repo" "$allmode")"
      fi
      for t in $targets; do
        is_protected "$t" && deny "push to main/master detected (this \`git push\` names no protected branch, but git would push to '$t')."
      done
    fi
    j=$k
  done
  return 0
}

# Reads the text $1 with read_words and keep_commands and applies every rule to it: the text rules
# on the words joined together (worked out inside keep_commands, which prints them as its last
# line), check_simple_command to each simple command keep_commands passed on, and all of this
# again, one level deeper, to a command string given to a shell's -c or to eval ($2 is the depth;
# the nesting stops at depth 3).
analyse() {
  local text="$1" depth="$2" line verdict="" cmdwords word i n inner out oldifs
  local all=()
  # The output is read in one go and split into lines in one step. Reading it line by line
  # straight from the pipe (as this function used to) makes bash read one byte at a time, which
  # took more than a second for a 129 KB commit message. No line is ever empty (every line starts
  # with a letter), so splitting on line breaks loses nothing; globbing is off (set -f).
  out="$(printf '%s' "$text" | read_words | keep_commands)"
  oldifs="$IFS"; IFS=$'\n'
  # shellcheck disable=SC2206  # split on line breaks only, on purpose; globbing is off (set -f)
  all=($out)
  IFS="$oldifs"
  n=${#all[@]}
  # The last line is keep_commands' verdict on the words joined together: its letters come in
  # the order P M F S. The force rule is checked first only so that its clearer message is shown.
  if [ "$n" -gt 0 ]; then
    case "${all[$((n - 1))]}" in v*) verdict="${all[$((n - 1))]#v}"; n=$((n - 1)) ;; esac
  fi
  case "$verdict" in *P*M*F*) deny "force-push to main/master detected." ;; esac
  case "$verdict" in *P*M*) deny "push to main/master detected." ;; esac
  case "$verdict" in *S*) deny "live Stripe key detected (dev-team is test-mode only)." ;; esac
  # First count this level's pushes, without asking git anything, so that a command with more
  # than MAX_PUSHES is refused before any of them is worked out (200 bare pushes used to take 38
  # seconds on macOS). check_simple_command in counting mode only counts; the pass after this one
  # does the work and keeps the count that decides, which also covers the pushes in a command
  # string handed to a shell (counted when that string is read). An earlier cd seen while
  # counting is forgotten again, so the real pass sees the commands in order.
  local saved_place=$unknown_place
  counting=1; seen=0
  cmdwords=()
  i=0
  while [ "$i" -le "$n" ]; do
    if [ "$i" -eq "$n" ] || [ "${all[$i]}" = "s" ]; then
      [ "${#cmdwords[@]}" -gt 0 ] && check_simple_command "${cmdwords[@]}"
      cmdwords=()
    else
      case "${all[$i]}" in
        w*) cmdwords[${#cmdwords[@]}]="${all[$i]#w}" ;;
        *) cmdwords[${#cmdwords[@]}]="$REDIR" ;;
      esac
    fi
    i=$((i + 1))
  done
  counting=0; unknown_place=$saved_place
  # Each simple command in turn, in order, so that an earlier cd is seen before a later push.
  cmdwords=()
  i=0
  while [ "$i" -le "$n" ]; do
    if [ "$i" -eq "$n" ] || [ "${all[$i]}" = "s" ]; then
      if [ "${#cmdwords[@]}" -gt 0 ]; then
        # A command string handed to sh -c / bash -c / ... or to eval is read as a command too.
        if [ "$depth" -lt 3 ]; then
          local c has_eval=0 k saw_c opt nwords=${#cmdwords[@]}
          local evalwords=()
          c=0
          while [ "$c" -lt "$nwords" ]; do
            word="${cmdwords[$c]}"
            if [ "$has_eval" -eq 1 ]; then
              # eval's own redirection (and where it goes) is not part of the text eval runs.
              if [ "$word" = "$REDIR" ]; then c=$((c + 2)); continue; fi
              evalwords[${#evalwords[@]}]="$word"
            elif [ "$word" = "eval" ]; then has_eval=1
            # Every shell is_shell_word knows ends in "sh"; the function is asked only then,
            # because a function call per word is slow in bash 3.2 (see check_simple_command). The
            # test is a case pattern, never "${word%sh}": bash removes a suffix or prefix in time
            # that grows with the SQUARE of the word's length (about 20 seconds for a 129 KB commit
            # message, in bash 3.2 and 5 alike), while a case pattern takes a few hundredths.
            elif case "$word" in *sh) true ;; *) false ;; esac && is_shell_word "$word"; then
              # The shell's own options come first. With -c among them (alone, or in a group such
              # as -lc) the first word after the options is the command string; `--` ends the
              # options, and the word after it is the string. -o, -O, +o, +O, --rcfile and
              # --init-file take a value. (This used to take whatever word came straight after
              # -c, so `bash -c -- 'git push origin main'` read the string "--" and missed the
              # push; the stand-in review of 42bd45e..b39f40d found that.)
              k=$((c + 1)); saw_c=0
              while [ "$k" -lt "$nwords" ]; do
                opt="${cmdwords[$k]}"
                if [ "$opt" = "$REDIR" ]; then k=$((k + 2)); continue; fi
                case "$opt" in
                  --) k=$((k + 1)); break ;;
                  -o|-O|+o|+O|--rcfile|--init-file) k=$((k + 2)) ;;
                  --*) k=$((k + 1)) ;;
                  -*c*) saw_c=1; k=$((k + 1)) ;;
                  -*|+*) k=$((k + 1)) ;;
                  *) break ;;
                esac
              done
              while [ "$k" -lt "$nwords" ] && [ "${cmdwords[$k]}" = "$REDIR" ]; do k=$((k + 2)); done
              if [ "$saw_c" -eq 1 ] && [ "$k" -lt "$nwords" ]; then
                inner="${cmdwords[$k]}"
                [ -n "$inner" ] && analyse "$inner" $((depth + 1))
              fi
            fi
            c=$((c + 1))
          done
          # eval joins its arguments with spaces; "${evalwords[*]}" does the same in one step (the
          # text is never built up a word at a time, which grows with the square of its length).
          [ "${#evalwords[@]}" -gt 0 ] && analyse "${evalwords[*]}" $((depth + 1))
        fi
        check_simple_command "${cmdwords[@]}"
      fi
      cmdwords=()
    else
      line="${all[$i]}"
      case "$line" in
        w*) cmdwords[${#cmdwords[@]}]="${line#w}" ;;
        *) cmdwords[${#cmdwords[@]}]="$REDIR" ;;
      esac
    fi
    i=$((i + 1))
  done
  return 0
}

# Everything the hook checks, in one function, so that it can run under the time limit below:
# (a) the text rules on the command text as written, then (b) the command read word by word.
check_command() {
  # (a) The command text exactly as written, as before quotes were understood. Kept so that
  # nothing this rule used to refuse is let through by the word-by-word reading below.
  text_rules "$norm"
  [ "$have_jq" -eq 1 ] || return 0
  # (b) The command read word by word, as the shell reads it.
  analyse "$cmd" 0
}

gopts=()
cur=""
map_specs=""
map_default=""
map_branches=""
map_named=0
nl=$'\n'
pushes=0
counting=0
seen=0

# ---------------------------------------------------------------------------------------------
# The time limit.
# ---------------------------------------------------------------------------------------------
# Claude Code stops waiting for a hook after a while and then runs the command anyway, so a guard
# that is too slow is a guard that is not there. The checking therefore runs in a background
# subshell ("worker"), and a second one ("timer") stops it after TIME_LIMIT seconds; a command
# whose checking runs past that is REFUSED, with a message asking for it to be split — it is never
# let through unchecked.
#   - The worker is started with job control on (set -m) only so that it gets a process group of
#     its own, and the timer stops that whole group: the worker AND whatever it is waiting on (a
#     git that does not answer, say). Stopping only the worker left its children running, and they
#     still held the hook's error output open, so the hook's caller went on waiting for them — the
#     first version of this limit refused on time but still took as long as the slow git did. The
#     worker switches job control off again for itself, so everything it starts stays in its group.
#   - The timer's own output goes nowhere, so a timer still counting down can never hold the
#     hook's output open after the hook has finished; the hook stops it once the worker is done.
#   - DEV_TEAM_GUARD_TIME_LIMIT can make the limit SHORTER (1 to 19 seconds), never longer; any
#     other value is ignored. The tests use it to prove the refusal without waiting 20 seconds.
TIME_LIMIT=20
case "${DEV_TEAM_GUARD_TIME_LIMIT:-}" in
  [1-9]|1[0-9]) TIME_LIMIT="$DEV_TEAM_GUARD_TIME_LIMIT" ;;
esac
set -m
( set +m; check_command ) &
worker=$!
set +m
(
  nap=""
  trap '[ -n "$nap" ] && kill "$nap" 2>/dev/null; exit 0' TERM
  sleep "$TIME_LIMIT" &
  nap=$!
  wait "$nap"
  kill -TERM -- "-$worker" 2>/dev/null || kill -TERM "$worker" 2>/dev/null
) </dev/null >/dev/null 2>&1 &
timer=$!
wait "$worker" 2>/dev/null
rc=$?
kill -TERM "$timer" 2>/dev/null
case "$rc" in
  2) exit 2 ;;                                   # refused; the worker has said why
  143) refuse "checking this command took longer than $TIME_LIMIT seconds, so it is refused rather than let through unchecked. Split it into smaller commands." ;;
  *) exit 0 ;;                                   # allowed, or any other error: fail open
esac

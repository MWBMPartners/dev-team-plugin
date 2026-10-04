#!/usr/bin/env bash
# dev-team guardrail (PreToolUse/Bash). Blocks only the truly unrecoverable actions,
# and ONLY while a dev-team run is active (unless DEV_TEAM_GUARD is set). Fail-open by
# design: any error, or no active run => allow (exit 0). One defense layer, best-effort
# string matching — NEVER the safety guarantee.
#   - The authoritative protection for `main` is SERVER-SIDE GitHub branch protection.
#   - The live-Stripe-key check is a Bash-command heuristic only (it inspects tool_input.command),
#     NOT a secret-leak control — that is the gitleaks scan wired by dev-team-ship, plus GitHub
#     secret scanning / push protection on the repo.
#
# What it refuses, exactly (exit 2), while it is active:
#   1. A `git push` whose command text names `main` or `master` as a whole word — as a plain
#      word, inside a refspec (HEAD:main, +main, refs/heads/main), in double quotes, in single
#      quotes, or behind a backslash (\main). The text is read the way the shell reads it: quotes
#      and backslashes are removed first, so 'main', "main", \main and ma'in' are all "main", and
#      'git' push is a git push. A command string handed to `sh -c` / `bash -c` / `zsh -c` (and
#      the like) or to `eval` is read the same way, one level at a time, three levels deep.
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
#   3. A live Stripe key (sk_live_, rk_live_, pk_live_) anywhere in the command text.
#
# What it cannot see, and so lets through (stated here so nobody reads more into it):
#   - a branch or command held in a variable ($BRANCH), built by another command, or run from a
#     script file, an alias or a git alias;
#   - a bare push when it cannot tell where it would go: an earlier `cd`/`pushd`/`popd` in the
#     same command (the folder it would run in is then unknown), a GIT_* variable set in the
#     command, a folder that is not a git repository, `git` not installed, or a detached HEAD.
#     (A `remote.<name>.push` setting is not a limit: one that names neither branch, uses no `*`
#     and is not `:` sends nothing to main or master, so letting that push through is correct.
#     An earlier wording listed it here as something the hook "cannot see"; it was wrong both
#     ways, since it also hid that `:` was being missed.)
#   - any branch name other than `main` and `master` (it does not read GitHub's own protection
#     settings);
#   - anything at all when `jq` is not installed: it then only scans the raw hook input as plain
#     text, the way it did before quotes were handled, and can miss things.
# It reads the text of the command before the command runs; it does not watch what actually
# happens. A command that misses every pattern above is allowed.
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

# ---------------------------------------------------------------------------------------------
# The text rules. Each takes the text to test as its only argument.
# ---------------------------------------------------------------------------------------------
# A copy with common argument separators (: + / " = ; , ( )) turned into spaces, so a target
# branch can't hide inside a refspec (HEAD:main, +main, x:refs/heads/main), a quote ("main"),
# a refs/heads/ prefix, or trailing punctuation (main;). main/master must appear as a whole,
# space-delimited token to match — so "maintenance" and "feature-main" do NOT trip it.
sep_copy() { printf ' %s ' "$1" | tr ':+/"=;,()' '         '; }
# `git push` even with global options between git and push (e.g. `git -C dir push`).
is_git_push() { printf '%s' " $1 " | grep -Eq ' git ([^ ]+ )*push([ ]|$)'; }
# A main/master push target (as a bare token in the separator-normalized copy).
targets_main() { sep_copy "$1" | grep -Eq ' (main|master) '; }
# A force update: --force / --force-with-lease / -f, or a leading `+` refspec on main/master.
has_force() {
  printf '%s' " $1 " | grep -Eq '(--force|--force-with-lease| -f )' && return 0
  printf '%s' "$1" | grep -Eq '[[:space:]]\+[^[:space:]]*(main|master)'
}
has_live_stripe_key() { printf '%s' "$1" | grep -Eq '(sk|rk|pk)_live_[A-Za-z0-9]'; }

# Applies the three text rules to one piece of text. The force rule is checked first only so
# that its clearer message is the one shown; either way the push is refused.
text_rules() {
  if is_git_push "$1" && has_force "$1" && targets_main "$1"; then
    deny "force-push to main/master detected."
  fi
  if is_git_push "$1" && targets_main "$1"; then
    deny "push to main/master detected."
  fi
  if has_live_stripe_key "$1"; then
    deny "live Stripe key detected (dev-team is test-mode only)."
  fi
}

# (a) The command text exactly as written, as before quotes were understood. Kept so that nothing
# this rule used to refuse is let through by the word-by-word reading below.
text_rules "$norm"
[ "$have_jq" -eq 1 ] || exit 0

# ---------------------------------------------------------------------------------------------
# Reading the command the way the shell does.
# ---------------------------------------------------------------------------------------------
# shell_words reads the text on its standard input the way the shell does, after the shell's own
# quote removal: '...' keeps everything literally, "..." keeps everything except that a backslash
# before $ ` " \ or a line break is removed, a bare backslash makes the next character literal,
# $'...' and $"..." lose their $. Outside quotes, a line break and ; & | ( ) ` end a simple
# command; > and < start a redirection (the next word is where output goes, not an argument, and a
# number just before them — the 2 in 2>&1 — is dropped). Spaces, tabs and line breaks INSIDE a
# quoted word are kept as single spaces, so a commit message such as 'push to main' stays one word
# and is never read as a push. This is a reading aid, not a full shell parser: it does not expand
# variables, globs, braces or aliases.
# It prints, first, one line "@@JOINED <all the words joined by spaces>" — each space inside a word
# becomes _ so the word stays one word, a command separator becomes ";" and a redirection ">" — for
# the text rules. Then, one word per line with a line "@@SEP" after each command, only the simple
# commands the rest of this hook needs to look at word by word: one with a word that is git, a
# shell (sh, bash, zsh, dash, ksh) or eval, or a GIT_...= setting, or one whose first word is cd,
# pushd, popd, export, declare, typeset, set, builtin or command. Leaving the rest out keeps a long
# command — a large heredoc, say — quick to check: the word-by-word part runs in bash, which is
# slow on thousands of words.
shell_words() {
  awk '
    function endword() {
      if (inw) { gsub(/[\t\n]/, " ", w); nw++; cw[nw] = w; t = w; gsub(/ /, "_", t); joined = joined " " t }
      w = ""; inw = 0
    }
    function endcmd(   k, keep, first, x) {
      endword()
      if (nw > 0) {
        keep = 0; first = 1
        while (first <= nw && cw[first] ~ /^[A-Za-z_][A-Za-z0-9_]*=/) first++
        if (first <= nw && cw[first] ~ /^(cd|pushd|popd|export|declare|typeset|set|builtin|command)$/) keep = 1
        for (k = 1; k <= nw; k++) {
          x = cw[k]
          if (x ~ /(^|\/)(git|sh|bash|zsh|dash|ksh)$/ || x == "eval" || x ~ /^GIT_[A-Za-z0-9_]*=/) keep = 1
        }
        if (keep) { for (k = 1; k <= nw; k++) out = out cw[k] "\n"; out = out "@@SEP\n" }
        joined = joined " ;"
      }
      nw = 0
    }
    { s = s (NR > 1 ? "\n" : "") $0 }
    END {
      n = length(s); i = 1; st = 0; w = ""; inw = 0; nw = 0; joined = ""; out = ""
      # st: 0 unquoted, 1 inside '\''...'\'', 2 inside "...", 3 inside $'\''...'\''
      while (i <= n) {
        c = substr(s, i, 1)
        if (st == 1) { if (c == "'\''") st = 0; else w = w c; i++; continue }
        if (st == 3) {
          if (c == "\\" && i < n) { w = w substr(s, i + 1, 1); i += 2; continue }
          if (c == "'\''") st = 0; else w = w c
          i++; continue
        }
        if (st == 2) {
          if (c == "\"") { st = 0; i++; continue }
          if (c == "\\" && i < n) {
            d = substr(s, i + 1, 1)
            if (d == "\n") { i += 2; continue }
            if (d == "$" || d == "`" || d == "\"" || d == "\\") { w = w d; i += 2; continue }
          }
          w = w c; i++; continue
        }
        if (c == " " || c == "\t") { endword(); i++; continue }
        if (c == "\n" || c == ";" || c == "|" || c == "(" || c == ")" || c == "`") { endcmd(); i++; continue }
        if (c == "&" && substr(s, i + 1, 1) != ">") { endcmd(); i++; continue }
        if (c == ">" || c == "<" || c == "&") {
          if (inw && w ~ /^[0-9]+$/) { w = ""; inw = 0 } else endword()
          while (i <= n && index("<>&|", substr(s, i, 1)) > 0) i++
          nw++; cw[nw] = "@@REDIR"; joined = joined " >"
          continue
        }
        if (c == "\\") {
          if (i < n) { d = substr(s, i + 1, 1); if (d != "\n") { w = w d; inw = 1 } }
          i += 2; continue
        }
        if (c == "'\''") { st = 1; inw = 1; i++; continue }
        if (c == "\"") { st = 2; inw = 1; i++; continue }
        if (c == "$" && i < n) {
          d = substr(s, i + 1, 1)
          if (d == "'\''") { st = 3; inw = 1; i += 2; continue }
          if (d == "\"") { st = 2; inw = 1; i += 2; continue }
        }
        w = w c; inw = 1; i++
      }
      endcmd()
      print "@@JOINED" joined
      printf "%s", out
    }
  '
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
        *) echo "$src" ;;
      esac
    else
      echo "${dst#refs/heads/}"
    fi
  done
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
  local refspecs
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
    # `env GIT_DIR=... git push` sets the variable after the command word.
    case "${words[$j]}" in GIT_*=*) cannot_tell=1 ;; esac
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
        @@REDIR) k=$((k + 2)) ;;
        -*) k=$((k + 1)) ;;
        *) break ;;
      esac
    done
    sub="${words[$k]:-}"
    if [ "$sub" != "push" ]; then j=$((j + 1)); continue; fi
    # The push's own arguments: options, then the repository, then the refspecs.
    repo=""; have_repo=0; refspecs=(); allmode=0; tags=0; endopts=0
    k=$((k + 1))
    while [ "$k" -lt "$m" ]; do
      w="${words[$k]}"
      if [ "$w" = "@@REDIR" ]; then k=$((k + 2)); continue; fi
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
        targets="$(refspec_targets "${refspecs[@]}")"
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

# Reads the text $1 with shell_words and applies every rule to it: the text rules to the words
# joined back together (quotes removed; a space inside a quoted word becomes _ so it stays one
# word), check_simple_command to each simple command shell_words passed on, and all of this again,
# one level deeper, to a command string given to a shell's -c or to eval ($2 is the depth; the
# nesting stops at depth 3).
analyse() {
  local text="$1" depth="$2" line joined="" got_joined=0 cmdwords word i n inner
  local all=()
  while IFS= read -r line; do
    if [ "$got_joined" -eq 0 ]; then joined="${line#@@JOINED}"; got_joined=1; continue; fi
    all[${#all[@]}]="$line"
  done < <(printf '%s' "$text" | shell_words)
  n=${#all[@]}
  text_rules "$joined"
  # Each simple command in turn, in order, so that an earlier cd is seen before a later push.
  cmdwords=()
  i=0
  while [ "$i" -le "$n" ]; do
    if [ "$i" -eq "$n" ] || [ "${all[$i]}" = "@@SEP" ]; then
      if [ "${#cmdwords[@]}" -gt 0 ]; then
        # A command string handed to sh -c / bash -c / ... or to eval is read as a command too.
        if [ "$depth" -lt 3 ]; then
          local c has_shell=0 has_eval=0 evaltext=""
          c=0
          while [ "$c" -lt "${#cmdwords[@]}" ]; do
            word="${cmdwords[$c]}"
            if [ "$has_eval" -eq 1 ]; then evaltext="$evaltext $word"
            elif [ "$word" = "eval" ]; then has_eval=1
            elif is_shell_word "$word"; then has_shell=1
            elif [ "$has_shell" -eq 1 ]; then
              case "$word" in
                -*c*) inner="${cmdwords[$((c + 1))]:-}"; [ -n "$inner" ] && analyse "$inner" $((depth + 1)) ;;
              esac
            fi
            c=$((c + 1))
          done
          [ -n "$evaltext" ] && analyse "$evaltext" $((depth + 1))
        fi
        check_simple_command "${cmdwords[@]}"
      fi
      cmdwords=()
    else
      cmdwords[${#cmdwords[@]}]="${all[$i]}"
    fi
    i=$((i + 1))
  done
  return 0
}

gopts=()
cur=""
# (b) The command read word by word, as the shell reads it.
analyse "$cmd" 0

exit 0

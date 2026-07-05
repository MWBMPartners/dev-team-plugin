#!/usr/bin/env bash
# dev-team guardrail (PreToolUse/Bash). Blocks only the truly unrecoverable actions,
# and ONLY while a dev-team run is active (unless DEV_TEAM_GUARD is set). Fail-open by
# design: any error, or no active run => allow (exit 0). One defense layer, best-effort
# string matching — NEVER the safety guarantee.
#   - The authoritative protection for `main` is SERVER-SIDE GitHub branch protection.
#   - The live-Stripe-key check is a Bash-command heuristic only (it inspects tool_input.command),
#     NOT a secret-leak control — that is the gitleaks scan wired by dev-team-ship, plus GitHub
#     secret scanning / push protection on the repo.
set -u
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

cmd=""
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)"
fi
[ -n "$cmd" ] || cmd="$payload"
norm="$(printf '%s' "$cmd" | tr '\n' ' ' | tr -s ' ')"

deny() {
  echo "dev-team guard: $1 Blocked as unrecoverable during an active run. Do it yourself, or disable the guard (remove .dev-team/autopilot.json or unset DEV_TEAM_GUARD)." >&2
  exit 2
}

# A copy with common argument separators (: + / " = ; , ( )) turned into spaces, so a target
# branch can't hide inside a refspec (HEAD:main, +main, x:refs/heads/main), a quote ("main"),
# a refs/heads/ prefix, or trailing punctuation (main;). main/master must appear as a whole,
# space-delimited token to match — so "maintenance" and "feature-main" do NOT trip it.
sep="$(printf ' %s ' "$norm" | tr ':+/"=;,()' '         ')"

# `git push` even with global options between git and push (e.g. `git -C dir push`).
is_git_push() { printf '%s' " $norm " | grep -Eq ' git ([^ ]+ )*push([ ]|$)'; }
# A main/master push target (as a bare token in the separator-normalized copy).
targets_main() { printf '%s' "$sep" | grep -Eq ' (main|master) '; }
# A force update: --force / --force-with-lease / -f, or a leading `+` refspec on main/master.
has_force() {
  printf '%s' " $norm " | grep -Eq '(--force|--force-with-lease| -f )' && return 0
  printf '%s' "$norm" | grep -Eq '[[:space:]]\+[^[:space:]]*(main|master)'
}

# 1) Any git push whose target resolves to main/master — force or not; autopilot never writes to main.
if is_git_push && targets_main; then
  deny "push to main/master detected."
fi
# 2) Explicit force-push touching main/master (clearer message on top of rule 1).
if is_git_push && has_force && targets_main; then
  deny "force-push to main/master detected."
fi
# 3) Live Stripe keys in a Bash command (dev-team is test-mode only; Bash-heuristic, not a leak control).
if printf '%s' "$norm" | grep -Eq '(sk|rk|pk)_live_[A-Za-z0-9]'; then
  deny "live Stripe key detected (dev-team is test-mode only)."
fi

exit 0

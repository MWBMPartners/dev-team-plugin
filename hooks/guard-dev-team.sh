#!/usr/bin/env bash
# dev-team guardrail (PreToolUse/Bash). Blocks only the truly unrecoverable actions,
# and ONLY while a dev-team run is active (unless DEV_TEAM_GUARD is set). Fail-open by
# design: any error, or no active run => allow (exit 0). One defense layer, best-effort
# string matching — never the safety guarantee.
set -u
payload="$(cat 2>/dev/null)" || exit 0

# Scope: only enforce during an active run, unless explicitly forced on.
if [ -z "${DEV_TEAM_GUARD:-}" ]; then
  [ -f ".dev-team/autopilot.json" ] || exit 0
fi

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

# 1) Any git push to main/master (autopilot must never write to main).
if printf '%s' "$norm" | grep -Eq 'git[[:space:]]+push([[:space:]]+[^ ]+)*[[:space:]]+(origin[[:space:]]+)?(main|master)([[:space:]]|$)'; then
  deny "push to main/master detected."
fi
# 2) Force-push to main/master.
if printf '%s' "$norm" | grep -Eq 'git[[:space:]]+push.*(--force|-f)([[:space:]]|$)' && printf '%s' "$norm" | grep -Eq '(main|master)'; then
  deny "force-push to main/master detected."
fi
# 3) Live Stripe keys (dev-team is test-mode only).
if printf '%s' "$norm" | grep -Eq '(sk|rk|pk)_live_[A-Za-z0-9]'; then
  deny "live Stripe key detected (dev-team is test-mode only)."
fi

exit 0

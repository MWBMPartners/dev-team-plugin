#!/usr/bin/env bash
# dev-team update-check (SessionStart notifier) — Layer 2 fallback for users who leave the
# built-in marketplace auto-updater off (see README "Updating"). Fast, cached, fail-open, and
# completely silent unless a newer version is actually available. NEVER blocks the session and
# NEVER runs /plugin itself — it only ever prints a systemMessage JSON object on stdout.
set -u

# Off-switch.
[ -z "${DEV_TEAM_NO_UPDATE_CHECK:-}" ] || exit 0

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
DATA_DIR="${CLAUDE_PLUGIN_DATA:-}"
[ -n "$PLUGIN_ROOT" ] && [ -n "$DATA_DIR" ] || exit 0

# Local version — best-effort; reading plugin.json from a hook is documented-but-unstated,
# so any failure here is silently swallowed.
local_version="$(jq -r '.version' "$PLUGIN_ROOT/.claude-plugin/plugin.json" 2>/dev/null)" || exit 0
[ -n "$local_version" ] && [ "$local_version" != "null" ] || exit 0

# Throttle/cache dir: the WRITABLE persistent dir, NOT the plugin dir (which may be read-only).
mkdir -p "$DATA_DIR" 2>/dev/null || exit 0
STAMP_FILE="$DATA_DIR/.last-update-check"
REMOTE_CACHE="$DATA_DIR/.remote-version"
WINDOW_SECS=$((24 * 60 * 60))

now="$(date +%s 2>/dev/null)" || exit 0

# Throttle: only hit the network at most once per 24h; otherwise stay fully silent.
if [ -f "$STAMP_FILE" ]; then
  last="$(cat "$STAMP_FILE" 2>/dev/null)"
  case "$last" in *[!0-9]*|'') last=0 ;; esac
  elapsed=$(( now - last ))
  if [ "$elapsed" -ge 0 ] && [ "$elapsed" -lt "$WINDOW_SECS" ]; then
    exit 0
  fi
fi

# Stamp now (before the network call) so a slow/failed check still throttles the next session.
printf '%s' "$now" > "$STAMP_FILE" 2>/dev/null || true

command -v gh >/dev/null 2>&1 || exit 0
command -v jq >/dev/null 2>&1 || exit 0

# Best-effort fetch, hard 5s timeout, wrapped so any failure is a silent no-op.
remote_version="$(timeout 5 gh api repos/MWBMPartners/dev-team-plugin/contents/.claude-plugin/plugin.json --jq '.content' 2>/dev/null \
  | base64 -d 2>/dev/null \
  | jq -r '.version' 2>/dev/null)" || exit 0
[ -n "$remote_version" ] && [ "$remote_version" != "null" ] || exit 0

printf '%s' "$remote_version" > "$REMOTE_CACHE" 2>/dev/null || true

# Semver compare: numeric, dot-split; any unparseable part => treat as equal (stay silent).
is_newer() {
  local remote="$1" local_v="$2" i rv lv
  local -a r l
  IFS='.' read -r -a r <<<"$remote"
  IFS='.' read -r -a l <<<"$local_v"
  for i in 0 1 2; do
    rv="${r[i]:-0}"; lv="${l[i]:-0}"
    case "$rv" in ''|*[!0-9]*) return 1 ;; esac
    case "$lv" in ''|*[!0-9]*) return 1 ;; esac
    if [ "$rv" -gt "$lv" ]; then return 0; fi
    if [ "$rv" -lt "$lv" ]; then return 1; fi
  done
  return 1
}

if is_newer "$remote_version" "$local_version"; then
  msg="dev-team: v${remote_version} available (you have v${local_version}). If marketplace auto-update is off, run: /plugin marketplace update dev-team && /plugin update dev-team — or /dev-team-update for details."
  jq -n --arg m "$msg" '{systemMessage: $m}'
fi

exit 0

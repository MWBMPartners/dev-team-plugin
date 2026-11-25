#!/usr/bin/env bash
# File:    scripts/engine.sh
# Purpose: The one doorway to the dev-team engine (a small program written for Node.js). It checks
#          that the engine can run, then hands over to it. If it cannot, it says why and exits with
#          code 3, which means "the engine is not available — carry on the 1.x way". Nothing in the
#          plugin depends on the engine being present, so that is never an error for a person.
# Usage:   bash scripts/engine.sh <command> [subcommand] [--flags]
# Exit:    0 done, 1 a negative answer, 2 bad input, 3 engine not available, 4 conflict, 5 verification
#          failed (the engine's own codes; see docs/orchestrator/engine-commands.md).
# Notes:   Written to work with the old bash 3.2 that macOS ships (no globstar, no associative arrays).
set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$here")"

refuse() {
  echo "dev-team engine not available: $1" >&2
  echo "The plugin carries on without it (1.x behaviour). Nothing is wrong with your project." >&2
  exit 3
}

[ -n "${DEV_TEAM_NO_ENGINE:-}" ] && refuse "DEV_TEAM_NO_ENGINE is set."

# Find Node: the DEV_TEAM_NODE override first, then whatever is on the PATH.
node_bin=""
if [ -n "${DEV_TEAM_NODE:-}" ]; then
  [ -x "${DEV_TEAM_NODE}" ] || refuse "DEV_TEAM_NODE is set to '${DEV_TEAM_NODE}', which is not a runnable program."
  node_bin="${DEV_TEAM_NODE}"
else
  node_bin="$(command -v node 2>/dev/null || true)"
fi
[ -n "$node_bin" ] || refuse "the engine needs Node 22 or newer, and no Node was found."

ver="$("$node_bin" --version 2>/dev/null || true)"   # for example v22.1.0
major="${ver#v}"; major="${major%%.*}"
case "$major" in ''|*[!0-9]*) refuse "the engine needs Node 22 or newer, and '$node_bin' did not report a version." ;; esac
[ "$major" -ge 22 ] || refuse "the engine needs Node 22 or newer; found $ver."

# Where the engine keeps its machine-local files (never inside the project).
fallback=""
if [ -n "${CLAUDE_PLUGIN_DATA:-}" ]; then data="$CLAUDE_PLUGIN_DATA"
elif [ -n "${DEV_TEAM_DATA_DIR:-}" ]; then data="$DEV_TEAM_DATA_DIR"
else
  data="${HOME:-/tmp}/.dev-team/data"; fallback="1"
  echo "dev-team engine: no data folder was given, so it will use $data" >&2
fi

export DEV_TEAM_DATA_DIR_RESOLVED="$data"
export DEV_TEAM_DATA_DIR_IS_FALLBACK="${fallback:-0}"
export DEV_TEAM_PLUGIN_ROOT="$root"
exec "$node_bin" "$root/engine/bin/dev-team-engine.mjs" "$@"

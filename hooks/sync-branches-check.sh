#!/usr/bin/env bash
# dev-team branch-hygiene notifier (SessionStart). NETWORK-FREE and READ-ONLY: reports when
# local branches have a deleted ("gone") upstream, so you can run /dev-team-sync-branches to
# clean them up safely. It DELETES NOTHING and makes NO network calls — it only reads the
# remote-tracking refs already on disk, so it is accurate when you fetch with prune (recommended:
# `git config --global fetch.prune true`). Silent when there's nothing to clean. Fail-open.
# Disable with DEV_TEAM_NO_BRANCH_CHECK.
set -u
[ -z "${DEV_TEAM_NO_BRANCH_CHECK:-}" ] || exit 0

# Repo-scoped off-switch: .dev-team/config.yml (best-effort, fail-open — absent/malformed => proceed).
if [ -f .dev-team/config.yml ] && grep -Eq '^[[:space:]]*branch-notifier:[[:space:]]*(off|false|no)([[:space:]]|$)' .dev-team/config.yml 2>/dev/null; then exit 0; fi

git rev-parse --git-dir >/dev/null 2>&1 || exit 0

gone_count="$(git for-each-ref --format='%(upstream:track)' refs/heads 2>/dev/null | grep -c 'gone' || true)"
case "$gone_count" in ''|*[!0-9]*) exit 0 ;; esac
[ "$gone_count" -gt 0 ] || exit 0

if [ "$gone_count" = 1 ]; then n="1 local branch has"; else n="${gone_count} local branches have"; fi
msg="dev-team: ${n} a deleted upstream. Run /dev-team-sync-branches to review and clean up safely (unpushed/unmerged work is never touched)."

if command -v jq >/dev/null 2>&1; then
  jq -n --arg m "$msg" '{systemMessage: $m}'
else
  esc="${msg//\"/\\\"}"
  printf '{"systemMessage":"%s"}\n' "$esc"
fi
exit 0

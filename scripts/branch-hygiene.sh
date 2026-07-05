#!/usr/bin/env bash
# dev-team branch hygiene — READ-ONLY detector. Prints local branches bucketed by how safe
# they are to delete relative to their remote. DELETES NOTHING, PUSHES NOTHING. Used by the
# /dev-team-sync-branches command and safe to run by hand. Fail-safe: on any trouble it prints
# what it can and exits 0.
#
# Buckets (only branches whose upstream is GONE are ever candidates — a deleted remote branch
# is the "this is done" signal; branches with a live upstream or no upstream are left alone):
#   merged-safe-to-delete   gone upstream AND an ancestor of the default branch → `git branch -d` is safe
#   gone-upstream-verify-pr gone upstream but NOT an ancestor (squash/rebase-merge OR genuinely
#                           unmerged local work) → the caller must confirm the PR was MERGED
#                           (e.g. via gh) before any force-delete; otherwise LEAVE IT ALONE
#   skipped                 the default branch, the current branch, or a branch checked out in a worktree
set -uo pipefail

git rev-parse --git-dir >/dev/null 2>&1 || { echo "not-a-git-repo: yes"; exit 0; }

do_fetch=1
for arg in "$@"; do [ "$arg" = "--no-fetch" ] && do_fetch=0; done

# Resolve the default branch: prefer origin/HEAD, else main/master, else "main".
default="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"
if [ -z "$default" ]; then
  for b in main master; do
    git show-ref --verify --quiet "refs/heads/$b" && { default="$b"; break; }
  done
fi
[ -n "$default" ] || default="main"

# A fetch --prune is what makes "gone" accurate; it only touches remote-tracking refs, never
# local branches. Skippable with --no-fetch (offline / no-network).
[ "$do_fetch" = 1 ] && git fetch --prune --quiet 2>/dev/null || true

current="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || echo)"

# Branches checked out in ANY worktree cannot be deleted.
worktree_branches="$(git worktree list --porcelain 2>/dev/null | awk '/^branch /{sub("refs/heads/","",$2); print $2}')"
in_worktree() { printf '%s\n' "$worktree_branches" | grep -qxF "$1"; }

merged=(); gone=(); skip=()
while IFS='|' read -r name track; do
  [ -n "$name" ] || continue
  if [ "$name" = "$default" ] || [ "$name" = "$current" ] || in_worktree "$name"; then
    skip+=("$name"); continue
  fi
  case "$track" in
    *gone*)
      if git merge-base --is-ancestor "$name" "$default" 2>/dev/null; then
        merged+=("$name")     # gone upstream + fully merged → safe `git branch -d`
      else
        gone+=("$name")       # gone upstream + not an ancestor → verify PR merged before touching
      fi ;;
    *) : ;;                   # live upstream, or no upstream (never pushed) → leave alone
  esac
done < <(git for-each-ref --format='%(refname:short)|%(upstream:track)' refs/heads 2>/dev/null)

echo "default-branch: $default"
echo "current-branch: ${current:-<detached>}"
echo "merged-safe-to-delete:${merged[*]+ ${merged[*]}}"
echo "gone-upstream-verify-pr:${gone[*]+ ${gone[*]}}"
echo "skipped:${skip[*]+ ${skip[*]}}"

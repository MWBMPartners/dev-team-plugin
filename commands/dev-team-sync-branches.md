---
description: Safely align local branches with their GitHub remotes — prune stale remote-tracking refs and delete local branches whose remote branch was merged/deleted, with confirmation. Never touches unpushed or unmerged work.
argument-hint: [--apply] [--no-fetch]
---
Align local branches with their remotes SAFELY. Arguments: $ARGUMENTS (optional: `--apply` to proceed to deletion after showing the plan; `--no-fetch` to skip the network fetch). This is confirm-first and destructive-guarded: only ever delete local branches PROVEN merged; never push, never delete remote branches, never force-delete unproven work.

1. **Detect (read-only).** Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/branch-hygiene.sh $ARGUMENTS`. It does `git fetch --prune` (unless `--no-fetch`) and prints, deleting nothing:
   - `default-branch:` / `current-branch:`
   - `merged-safe-to-delete:` — branches whose upstream is gone AND are ancestors of the default branch → safe to `git branch -d`.
   - `gone-upstream-verify-pr:` — branches whose upstream is gone but are NOT ancestors (a squash/rebase-merge, OR genuinely-unmerged local work whose remote vanished). These need a merge check before anything happens.
   - `skipped:` — the default branch, the current branch, or branches checked out in a worktree.

2. **Verify the `gone-upstream-verify-pr` branches.** For each, check whether its PR was actually merged: `gh pr list --state merged --head <branch> --json number,mergedAt,title` (fall back to `gh pr view <branch> --json state,title`).
   - A MERGED PR exists → it's a squash/rebase-merge; safe to remove, but it needs force (`git branch -D`) because its commits aren't ancestors of the default branch.
   - No merged PR found (or `gh` is unavailable/unauthed) → **DO NOT DELETE.** It may be unpushed/unmerged local work whose remote was deleted for some other reason. Report it and leave it alone.

3. **Present the plan** grouped clearly, and do NOT delete yet:
   - (a) will `git branch -d` — fully merged, listed.
   - (b) will `git branch -D` — PR confirmed merged (squash/rebase), force required; listed, with the PR number.
   - (c) will NOT touch — gone upstream but no merged PR found; listed with the reason (possible unpushed work).
   - (d) skipped — current/default/worktree.

4. **Confirm.** If `--apply` was not passed, STOP here and ask the user to confirm (or to re-run with `--apply`). If `--apply` was passed, show the plan first, then continue.

5. **Delete (only after confirmation).** Delete only buckets (a) and (b): `git branch -d <name>` for (a), `git branch -D <name>` for (b). If the user is currently on a branch slated for deletion, first `git switch <default-branch>` — but ONLY if the working tree is clean; if it's dirty, skip that branch and tell the user. Never delete a branch in (c) or (d); never `git branch -D` anything except a branch whose PR you confirmed MERGED; never touch the default branch.

6. **Report** what was deleted and what was left (and why), and — if not already set — suggest the user enable the non-destructive half themselves: `git config --global fetch.prune true` (auto-prunes stale remote-tracking refs on every fetch; you cannot set their git config for them).

**Untrusted names — no shell interpolation.** Branch names and PR titles read back from `git`/`gh` (`<branch>`, `<name>` above) are UNTRUSTED — never string-substitute them directly into a shell command (`git branch -d <name>`, `git switch <default-branch>`, `gh pr view <branch>`, etc.). Hold the value in a quoted shell variable, prefer `--json`/`-q` structured reads over parsing text, and refuse or reject any name that doesn't match `^[A-Za-z0-9._/-]+$` before it reaches a deletion command.

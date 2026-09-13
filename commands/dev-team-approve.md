---
description: Approve or reject a deferred dev-team gate-ledger item (a queued feature / dependency upgrade / architectural change) so the next autopilot iteration builds or skips it.
argument-hint: <gate-id> [approve|reject] [notes]
---
Resolve a deferred gate item in `.dev-team/autopilot.json`. Arguments: $ARGUMENTS (expected: a gate id like G-003, a decision approve|reject, optional notes).
1. Read `.dev-team/autopilot.json`. If missing, tell the user there's no active autopilot run and stop.
2. Find the gate-ledger item with that id. If not found, list the available `G-` items and stop.
3. Show the item's full spec (title, type, its reservation/justification, the `spec_ref` in `.dev-team/PROJECT.md` — a `spec_ref` written before v1.5.0 without the `.dev-team/` folder in front is resolved through the lookup order in `conventions.md`, "Where the plugin writes, and the ownership rule", point 5, which never reads a file without the dev-team marker as the ledger). A marked legacy root `PROJECT.md` is read where it is: this command moves and commits nothing, and tells the user the move is pending — "`PROJECT.md` is still at the top level of the project — run `/dev-team-move-ledgers` to move it into `.dev-team/`." (point 5, read-only commands). If the decision is ambiguous, confirm with the user.
4. Apply the decision by editing ONLY that item's `status`: approve → `approved` (next iteration builds it through the full quality cycle); reject → `rejected` with the note. Preserve every other field and keep valid JSON.
5. Do NOT build anything now and do NOT resume the loop — just record the decision. Tell the user it will be actioned on the next `/loop dev-team-autopilot` iteration, and echo the updated item.
Never modify any field other than the targeted item's status/notes.

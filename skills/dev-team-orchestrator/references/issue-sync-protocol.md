# Dev-Team Issue Sync — export the ledgers to GitHub Issues (opt-in)

The suite already maintains issue-shaped ledgers (feature gaps, backlog, security findings,
review verdicts, gate-deferred items). This protocol exports them to GitHub Issues so they are
actionable in your real tracker instead of trapped in markdown. It is OPT-IN and dedup-safe, and
owned by the `sonnet-scribe` agent (a cheap tier — this is bookkeeping, not reasoning).

## The switch
`issues=off|sync` (default **off**) on any skill that maintains a ledger (iterate, security,
featurefind, review, autopilot), or run `/dev-team-sync-issues` manually. Nothing is created
unless the switch is `sync` or the command is invoked.

## What maps to an issue
One issue per OPEN ledger item, by source:

| Source ledger | Item prefix | Issue label |
|---|---|---|
| `FEATURES.md` (featurefind) | `FG-` | `for consideration` (→ `enhancement` once approved) |
| `PROJECT.md` Backlog (iterate) | `B-` | `enhancement` |
| `PROJECT.md` Proposed-Features ledger | (feature) | `for consideration` |
| `SECURITY.md` findings (security) | `F-` | `security` |
| `VERIFICATION.md` verdicts (review) | `V-` (fail) / `I-` | `bug` / `enhancement` |
| `.dev-team/autopilot.json` gate-ledger | `G-` | `for consideration` |

Title = a short, stable summary of the item. Body = the item's fields (description, impact,
evidence, rationale) plus a hidden footer marker `<!-- dev-team:<prefix>-<id> -->`.

## Dedup is the core (never spam duplicates)
Each ledger item carries an **`issue:` field** holding its GitHub issue number once synced (the
scribe writes it back into the ledger). On every sync:
- Item has **no** `issue:` → CREATE the issue, then write the returned number back into the item.
- Item **has** an `issue:` → it already exists → UPDATE it (edit title/body/labels if the item
  changed; add a status comment) — never create a second one.
- The hidden `<!-- dev-team:<id> -->` marker is the identity backstop if a ledger ref is ever
  lost (recover via `gh issue list --search "<id>" --state all`).

## Close-on-done
When an item's status becomes resolved/built/verified/merged, the scribe **closes** its issue
with a reference to the delivering commit/PR: `gh issue close <n> --reason completed --comment
"Done in <ref>"`. A re-opened item re-opens its issue.

## Confirm-first (gate)
Creating issues is outward-facing, so the **first** sync in a repo is confirm-first: the scribe
shows the set it will create (count + titles) and waits for the user's go-ahead — the suite's
standard gate posture. After that, syncs run and report a one-line summary ("issue sync: +2
created, 3 updated, 1 closed"). `--confirm-each` re-arms per-item confirmation; `--dry-run`
reports without touching GitHub.

## Labels
Create any missing labels idempotently (`gh label create <name> 2>/dev/null || true`), reusing
the `for consideration` convention (color `D4C5F9`) for propose-only items, plus `security`,
`enhancement`, `bug`.

## Safety
- Only a repo the user owns / has push on (`gh` authed). Only ever touch issues THIS sync created
  (identified by the stored `issue:` ref or the hidden marker) — never edit or close unrelated
  issues, and never delete any issue.
- `gh` required — if absent/unauthed, do nothing and tell the user how to enable it. Issue sync
  never fails the surrounding run.
- Batch to respect rate limits. On GitHub, issues and PRs share numbering — always read the issue
  number from `gh` output, never guess it.

## How the scribe runs one pass
1. Read the ledgers present (FEATURES.md / PROJECT.md / SECURITY.md / VERIFICATION.md /
   .dev-team/autopilot.json).
2. For each OPEN item: create-or-update per the dedup rule; write back the `issue:` ref.
3. For each item now done: close its issue with the commit/PR reference.
4. Report the one-line summary. This is cheap, mechanical bookkeeping — the scribe's job, never
   the lead's frontier context.

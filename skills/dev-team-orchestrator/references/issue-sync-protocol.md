# Dev-Team Issue Sync — export the ledgers to GitHub Issues (opt-in)

The suite already maintains issue-shaped ledgers (feature gaps, backlog, security findings,
review verdicts, gate-deferred items). This protocol exports them to GitHub Issues so they are
actionable in your real tracker instead of trapped in markdown. It is OPT-IN and dedup-safe, and
owned by the `sonnet-scribe` agent (a cheap tier — this is bookkeeping, not reasoning).

## The switch
`issues=off|sync` (default **off**) on any skill that maintains a ledger (iterate, security,
featurefind, review, autopilot, migrate), or run `/dev-team-sync-issues` manually. Nothing is created
unless the switch is `sync` or the command is invoked. `SECURITY.md` findings are the one
exception: `issues=sync` alone does NOT sync them — that needs the separate `issues=sync-security`
opt-in (see Safety rule 5).

## What maps to an issue
One issue per OPEN ledger item, by source:

| Source ledger | Item prefix | Issue label |
|---|---|---|
| `FEATURES.md` (featurefind) | `FG-` | `for consideration` (→ `enhancement` once approved) |
| `PROJECT.md` Backlog (iterate) | `B-` | `enhancement` |
| `PROJECT.md` Proposed-Features ledger | (feature) | `for consideration` |
| `SECURITY.md` findings (security) — **opt-in only, redacted; see Safety rule 5** | `F-` | `security` |
| `VERIFICATION.md` verdicts (review) | `V-` (fail) / `I-` | `bug` / `enhancement` |
| `MIGRATION.md` Stage Ledger (migrate) | `M-` | `enhancement` |
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

## Safety (non-negotiable)
1. **Only a repo the user owns / has push on** (`gh` authed). Only ever touch issues THIS sync
   created (identified by the stored `issue:` ref or the hidden marker) — never edit or close
   unrelated issues, and never delete any issue.
2. **`gh` required** — if absent/unauthed, do nothing and tell the user how to enable it. Issue
   sync never fails the surrounding run.
3. **Batch to respect rate limits.** On GitHub, issues and PRs share numbering — always read the
   issue number from `gh` output, never guess it.
4. **Shell safety — ledger free-text is UNTRUSTED for shell purposes.** Title, description,
   impact, evidence, rationale, and verification output all come from ledger files the lead/team
   wrote in prose — never string-interpolate any of it into a `gh` command line, and never build a
   `gh ... "$(...)"` command by concatenating ledger text. Write the body to a temp file and pass
   `gh issue create --title "$t" --body-file <file>` (same for `--body-file` on updates); pass
   search terms and other values as quoted, individually-passed arguments (`gh issue list --search
   "$term"`), never as part of a hand-assembled command string. This mirrors ci-medic's
   untrusted-names rule (`dev-team-ci-medic/SKILL.md`) applied to ledger text instead of
   branch/ref names.
5. **Security findings are redacted and opt-in only.** Syncing `SECURITY.md` findings (`F-`
   prefix, `security` label) is NOT part of the default `issues=sync` switch — it requires a
   separate, explicit opt-in (e.g. `issues=sync-security`) because a GitHub issue is far more
   visible than the local `SECURITY.md` file. When opted in, the synced issue body carries ONLY
   the finding's title, severity, and CWE/location — NEVER the `evidence`/PoC/repro field. This
   holds even on update passes: re-syncing a security item never adds evidence/PoC text to the
   issue body or a comment. Aligns with dev-team-security's "findings stay private" posture.

## How the scribe runs one pass
1. Read the ledgers present (FEATURES.md / PROJECT.md / SECURITY.md / VERIFICATION.md /
   .dev-team/autopilot.json).
2. For each OPEN item: create-or-update per the dedup rule; write back the `issue:` ref.
3. For each item now done: close its issue with the commit/PR reference.
4. Report the one-line summary. This is cheap, mechanical bookkeeping — the scribe's job, never
   the lead's frontier context.

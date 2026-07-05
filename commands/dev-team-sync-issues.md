---
description: Export the dev-team ledgers (feature gaps, backlog, security findings, review verdicts, gate-deferred items) to GitHub Issues — opt-in, dedup-safe, confirm-first on the first run.
argument-hint: [--dry-run] [--confirm-each]
---
Run the issue-sync protocol over this repo's dev-team ledgers. Arguments: $ARGUMENTS (`--dry-run`: show what would change without touching GitHub; `--confirm-each`: confirm every item).

Follow `skills/dev-team-orchestrator/references/issue-sync-protocol.md` exactly. In short:
1. Confirm `gh` is authenticated for this repo; if not, tell the user how to enable it and stop (never fail loudly).
2. Read the ledgers present: FEATURES.md, PROJECT.md (Backlog + Proposed-Features), SECURITY.md, VERIFICATION.md, .dev-team/autopilot.json.
3. For each OPEN item, create-or-update its GitHub issue per the DEDUP rule — an item with a stored `issue:` ref updates that issue; an item without one creates a new issue and writes the returned number back into the ledger. Never create duplicates; the hidden `<!-- dev-team:<id> -->` marker is the identity backstop.
4. Close the issues of items now done/resolved/verified, referencing the delivering commit/PR.
5. The first run in a repo (or `--confirm-each`): show the planned set and get the user's go-ahead before creating. With `--dry-run`: report only, change nothing.
6. Create any missing labels idempotently. Report a one-line summary (created / updated / closed).
The `sonnet-scribe` agent does the actual `gh` calls (cheap bookkeeping). Only ever touch issues this sync created; never delete issues.

- **Shell safety — no shell interpolation.** Ledger free-text (title, description, impact,
  evidence, rationale, verification output) is UNTRUSTED — never string-interpolate it into a
  `gh` command line or build a `gh ... "$(...)"` command by concatenating it. Write the body to a
  temp file and use `gh issue create --title "$t" --body-file <file>`; pass search terms and other
  values as quoted, individually-passed arguments.
- **Security findings are opt-in and redacted.** Do NOT sync `SECURITY.md` findings (`F-` items)
  under a plain `issues=sync` — that requires the separate, explicit `issues=sync-security`
  opt-in. When opted in, the synced issue carries only title, severity, and CWE/location — never
  the `evidence`/PoC field.

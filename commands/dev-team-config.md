---
description: Show the effective dev-team config (built-in defaults overlaid with .dev-team/config.yml) or scaffold a starter repo-scoped config file.
argument-hint: [show|init]
---
Arguments: $ARGUMENTS (`show` — default if omitted; `init`). Full schema, precedence rules, and the
toggle → env-override table live in
`skills/dev-team-orchestrator/references/config-and-toggles.md` — read it before acting. Remember:
`.dev-team/config.yml` is **repo-scoped** (a file the user commits, applying to every session and
collaborator), not a per-session setting.

## `show` (default)

1. Read `.dev-team/config.yml` if it exists (best-effort — if it's missing or malformed, treat it
   as absent; never error).
2. Print the **effective** config: every key from the schema in `config-and-toggles.md`
   (`defaults.*`, `git.*`, `features.*`), each with its resolved value and a tag showing where that
   value came from — `(from .dev-team/config.yml)` or `(built-in default)`. Keys the file doesn't
   set, or that failed to parse, are tagged `(built-in default)`.
3. If a per-session env var is currently set that would override a `features:` toggle for this
   session (`DEV_TEAM_NO_UPDATE_CHECK`, `DEV_TEAM_NO_BRANCH_CHECK`, `DEV_TEAM_GUARD`), note that
   too, so the user can see the full precedence chain in effect right now, not just the file.
4. If no `.dev-team/config.yml` exists, say so plainly and point to `/dev-team-config init`.

This is **read-only** — never create, edit, or touch the file for `show`.

## `init`

1. If `.dev-team/config.yml` already exists, **do not overwrite it**. Show its current content and
   ask the user to confirm before replacing it (or tell them to edit it directly).
2. Otherwise, create `.dev-team/` (if needed) and write `.dev-team/config.yml` with the commented
   starter schema from `config-and-toggles.md` verbatim (the same `version: 1` / `defaults:` /
   `git:` / `features:` block, with its inline comments) so the file is self-documenting on first
   read.
3. Tell the user clearly: **this file is meant to be committed** — once it's in the repo, its
   defaults and toggles apply to every session and every collaborator who clones the repo, not
   just this one. Suggest `git add .dev-team/config.yml` and reviewing the values before
   committing; do not commit it yourself.
4. Remind them every key is optional beyond `version: 1` — they can delete any block they don't
   want to override and that key falls back to its built-in default.

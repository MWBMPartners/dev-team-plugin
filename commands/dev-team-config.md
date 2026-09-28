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
   session (`DEV_TEAM_NO_UPDATE_CHECK`, `DEV_TEAM_NO_BRANCH_CHECK`, `DEV_TEAM_GUARD`,
   `DEV_TEAM_NO_AUTO_HANDOFF`, `DEV_TEAM_NO_AUTO_COMMIT`), note that
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
   In the same step, if `.dev-team/.gitignore` is absent, create it containing exactly one line,
   `loop.lock/`; and if `.dev-team/README.md` is absent, create it with the fixed text in
   `dev-team-orchestrator/references/conventions.md` ("Where the plugin writes, and the ownership
   rule", point 7), copied from there rather than retyped. Never overwrite either file once it
   exists. *Why:* the lock folder only means "a cycle is running on this machine right now" and must
   never be committed, and the README tells a person browsing the repo what the folder is. Tell the
   user which of the two were created and which were already there. Never edit the project's own
   `.gitignore`.
   Then offer the pointer sentence (`conventions.md`, "Where the plugin writes, and the ownership
   rule", point 8): when one of `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md` and `GEMINI.md`
   exists and does not already contain it, the config does not already say
   `pointer-sentence: declined`, and `handoff-file` is not `off` (the sentence names
   `.dev-team/HANDOFF.md`, which is then never written), offer once — never add it silently — to add "Dev-team plugin state
   and the current handover live in `.dev-team/` — read `.dev-team/HANDOFF.md` first." word for word
   to each of those files that lacks it. If the user declines, set `pointer-sentence: declined`
   under `features:` in the `.dev-team/config.yml` just written, and tell them. *Why here:* `init`
   often creates `.dev-team/` before any other run, and an earlier wording offered the sentence only
   on "the run that creates `.dev-team/`" — so after `init` no run ever offered it.
3. Tell the user clearly: **this file is meant to be committed** — once it's in the repo, its
   defaults and toggles apply to every session and every collaborator who clones the repo, not
   just this one. Suggest `git add .dev-team/config.yml` and reviewing the values before
   committing; do not commit it yourself.
4. Remind them every key is optional beyond `version: 1` — they can delete any block they don't
   want to override and that key falls back to its built-in default.

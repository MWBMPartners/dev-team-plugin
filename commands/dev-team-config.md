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
   set, or that failed to parse, are tagged `(built-in default)`. A commented-out line (as every
   setting in the starter file is, until someone sets it) is not set, so its key is tagged
   `(built-in default)` too.
3. If a per-session env var is currently set that would override a `features:` toggle for this
   session (`DEV_TEAM_NO_UPDATE_CHECK`, `DEV_TEAM_NO_BRANCH_CHECK`, `DEV_TEAM_GUARD`,
   `DEV_TEAM_NO_AUTO_HANDOFF`, `DEV_TEAM_NO_AUTO_COMMIT`), note that
   too, so the user can see the full precedence chain in effect right now, not just the file.
4. If no `.dev-team/config.yml` exists, say so plainly and point to `/dev-team-config init`.
5. End with this line, word for word, every time: "This view does not read the repository's own
   instruction files (`AGENTS.md`, `CLAUDE.md` and the like). A run can still move a switch that is
   not set in `.dev-team/config.yml` toward its more cautious value because of one — for example
   `handoff-file: off` for a project whose instructions explicitly forbid a second handover — and
   the run's report says so." *Why:* an instruction file can change what a run does (`config-and-toggles.md`,
   "Repository instruction files and these switches"), and reading and weighing those files is a
   judgement this read-only view does not make — so it says plainly that it cannot show them,
   rather than showing a value a run would not use.

This is **read-only** — never create, edit, or touch the file for `show`.

## `init`

1. If `.dev-team/config.yml` already exists, **do not overwrite it**. Show its current content and
   ask the user to confirm before replacing it (or tell them to edit it directly).
2. Otherwise, create `.dev-team/` (if needed) and write `.dev-team/config.yml` from the starter
   schema in `config-and-toggles.md`, verbatim (the same `version: 1` / `defaults:` / `git:` /
   `features:` block, with its inline comments), so the file is self-documenting on first read.
   In that schema every setting is commented out, showing its default. **Write an explicit value
   only for a key the user actually chose in this `init` conversation** — a value they asked for,
   or their answer to one of the questions below (the pointer sentence, or whether to keep
   `.dev-team/HANDOFF.md`): replace that key's commented line with the chosen `key: value`. Leave
   every other key commented out, even when its default is what the user will get anyway. *Why:*
   an explicit value in this file wins over the project's own instruction files, which can
   otherwise only move a setting toward its more cautious value; a default written out explicitly
   by `init`, which nobody chose, would silently overrule a project's cautious instruction (a
   `CLAUDE.md` asking for a dry run first would lose to an unchosen `dry-run: off`).
   In the same step, if `.dev-team/.gitignore` is absent, create it containing exactly one line,
   `loop.lock/`; and if `.dev-team/README.md` is absent, create it with the fixed text in
   `dev-team-orchestrator/references/conventions.md` ("Where the plugin writes, and the ownership
   rule", point 7), copied from there rather than retyped. Never overwrite either file once it
   exists. *Why:* the lock folder only means "a cycle is running on this machine right now" and must
   never be committed, and the README tells a person browsing the repo what the folder is. Tell the
   user which of the two were created and which were already there. Never edit the project's own
   `.gitignore`.
   Then work out `handoff-file` as `conventions.md`'s "Auto-handoff" says, reading the repository's instruction files as they are now, at the start of this command
   (`conventions.md`, "Repository instructions and normative documents", step 1): one that explicitly forbids a second handover makes it `off`;
   if one only says where the project's notes live, ask the user once whether the plugin should
   still keep `.dev-team/HANDOFF.md`, and write the answer as `handoff-file: on` or
   `handoff-file: off` under `features:` in the file just written (in place of its commented
   line). If the value is `off` and a
   `.dev-team/HANDOFF.md` or the pointer sentence is already there, offer to remove them as that
   section says ("Old traces when it is `off`") — never without a yes. Then offer the pointer sentence
   (`conventions.md`, "Where the plugin writes, and the ownership rule", point 8): when one of
   `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md` and `GEMINI.md` exists and does not already contain
   it, the config does not already say `pointer-sentence: declined`, and the `handoff-file` value
   just worked out is not `off` (the sentence names `.dev-team/HANDOFF.md`, which is then never
   written, and it is never offered to an instruction file that forbids a second handover), offer once — never add it silently — to add "Dev-team plugin state
   and the current handover live in `.dev-team/` — read `.dev-team/HANDOFF.md` first." word for word
   to each of those files that lacks it. If the user declines, set `pointer-sentence: declined`
   under `features:` in the `.dev-team/config.yml` just written (in place of its commented line),
   and tell them. *Why here:* `init`
   often creates `.dev-team/` before any other run, and an earlier wording offered the sentence only
   on "the run that creates `.dev-team/`" — so after `init` no run ever offered it.
3. Tell the user clearly: **this file is meant to be committed** — once it's in the repo, its
   defaults and toggles apply to every session and every collaborator who clones the repo, not
   just this one. Suggest `git add .dev-team/config.yml` and reviewing the values before
   committing; do not commit it yourself.
4. Remind them every key is optional beyond `version: 1`, and that every setting they did not
   choose was written commented out, showing its default — to set one, remove its `# ` and change
   the value. Tell them too that a value set in this file wins over the project's own instruction
   files, which can otherwise move a switch only toward its more cautious value — so set only what
   they mean to set, and commenting a line out again lets such an instruction apply
   (`config-and-toggles.md`, "Repository instruction files and these switches"). List the keys
   this `init` wrote explicitly, or say that it wrote none.

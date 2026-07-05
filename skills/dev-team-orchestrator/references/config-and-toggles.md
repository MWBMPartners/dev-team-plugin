# Repo Config & Feature Toggles — `.dev-team/config.yml`

This is the authoritative reference for `.dev-team/config.yml`: its schema, how it's loaded, and
how it interacts with per-run arguments and per-session environment variables. Every skill and
hook that reads a default or a toggle points here instead of restating the rules inline.

## The core idea — REPO-SCOPED, not per-session

`.dev-team/config.yml` is a file the **user commits** in their own project repo (not this plugin's
repo). Because it's committed, it applies **repo-wide, to every session and every collaborator**
— it is the **primary switch mechanism** for the suite's defaults and toggles. Per-run arguments
and per-session environment variables still exist and still win when set, but they're overrides
*on top of* this file, not the main mechanism. Never confuse it with a per-session or per-user
setting: if it's in `.dev-team/config.yml` and committed, the next collaborator who clones the
repo and runs any dev-team skill gets the same behavior, with no setup of their own.

## Precedence (highest to lowest)

1. **Per-run argument** — e.g. `models=economy`, `gates=pause-all`, `cycles=8` passed on the
   invocation.
2. **Plain language in the invocation** — e.g. "keep costs down" resolves to `models=economy`.
3. **Per-session environment variable** — e.g. `DEV_TEAM_NO_UPDATE_CHECK`, `DEV_TEAM_GUARD`. These
   are a per-session override layered *on top of* the repo config, not a replacement for it.
4. **Repo `.dev-team/config.yml`** — the repo-scoped default, read fresh each session/run.
5. **Built-in default** — what a skill or hook does when nothing above overrides it.

Higher wins. A missing or unreadable `.dev-team/config.yml` simply drops out of the chain — every
skill and hook falls straight through to the built-in default (see Fail-open, below).

## The schema (verbatim)

```
# .dev-team/config.yml — repo-wide dev-team defaults (committed = applies to every session & collaborator).
# Per-run arguments and plain language override these; per-session env vars can further override.
version: 1

defaults:            # override the skills' built-in argument defaults
  models: balanced   # economy | balanced | max
  gates: hybrid      # autopilot gate policy: hybrid | pause-all | autonomy-envelope
  cap: 30            # autopilot convergence cap
  cycles: 5          # iterate cycle cap
  issues: off        # issue-sync: off | sync   (security findings still require sync-security)

git:
  stack-prs: false   # false (default) = every run branches FROM and targets the DEFAULT branch; never
                     #   stack a PR on another feature branch. true = allow stacking (accepts the
                     #   merge-race risk). See the no-stack policy in conventions.md.
  default-branch: auto   # auto (origin/HEAD, else main/master) or an explicit branch name.

features:            # enable/disable behaviours repo-wide (on|off; env var can override per-session)
  update-notifier: on    # SessionStart update check      (per-session override: DEV_TEAM_NO_UPDATE_CHECK)
  branch-notifier: on    # SessionStart gone-branch notice (per-session override: DEV_TEAM_NO_BRANCH_CHECK)
  guard: auto            # on | off | auto  (auto = active during a run; DEV_TEAM_GUARD forces on)
  notifications: on      # autopilot gate/blocker/done notifications (v1.2.0)
  telemetry: on          # run-end telemetry + cost estimate         (v1.2.0)
  dry-run: off           # default plan-preview for building skills  (v1.2.0)
```

`version: 1` is the only required key going forward — every other key has a built-in default, so a
minimal or partial file (even just `version: 1` on its own) is valid and simply leaves everything
else at its built-in default.

## `defaults:` — run-argument overrides

Each key under `defaults:` mirrors an existing per-run argument and sets its repo-wide default,
which a per-run argument or plain language can still override for one run:

| Key | Mirrors | Values | Built-in default |
|---|---|---|---|
| `models` | `models=economy\|balanced\|max` | `economy`, `balanced`, `max` | `balanced` |
| `gates` | `gates=hybrid\|pause-all\|autonomy-envelope` (autopilot) | `hybrid`, `pause-all`, `autonomy-envelope` | `hybrid` |
| `cap` | `cap=N` (autopilot convergence backstop) | integer | `~30` |
| `cycles` | `cycles=N` (iterate cycle cap) | integer | `5` |
| `issues` | `issues=off\|sync` | `off`, `sync` (security findings still need the separate `sync-security` opt-in — see `issue-sync-protocol.md`) | `off` |

## `git:` — branch policy

| Key | Purpose | Values | Built-in default |
|---|---|---|---|
| `stack-prs` | Whether a run may target another feature branch instead of the default branch | `true`, `false` | `false` |
| `default-branch` | Which branch runs branch FROM/target | `auto` (origin/HEAD, else `main`/`master`), or an explicit branch name | `auto` |

`stack-prs: false` (the default) is the **no-stack policy** — see
`skills/dev-team-orchestrator/references/conventions.md` ("PR base / no-stack policy") for the
full rule and why stacking is disallowed by default.

## `features:` toggle → per-session env override

| Toggle | Governs | Values | Per-session env override | Built-in default |
|---|---|---|---|---|
| `update-notifier` | `hooks/check-update.sh` (SessionStart update check) | `on`, `off` | `DEV_TEAM_NO_UPDATE_CHECK` (off-switch: any non-empty value disables) | `on` |
| `branch-notifier` | `hooks/sync-branches-check.sh` (SessionStart gone-branch notice) | `on`, `off` | `DEV_TEAM_NO_BRANCH_CHECK` (off-switch: any non-empty value disables) | `on` |
| `guard` | `hooks/guard-dev-team.sh` (PreToolUse Bash safety net) | `on`, `off`, `auto` | `DEV_TEAM_GUARD` (force-ON switch — makes the guard check every Bash command regardless of an active run) | `auto` (active only during a run — `.dev-team/autopilot.json` present) |
| `notifications` | autopilot gate/blocker/done notifications (v1.2.0) | `on`, `off` | none yet — config-only | `on` |
| `telemetry` | run-end telemetry + cost estimate (v1.2.0) | `on`, `off` | none yet — config-only | `on` |
| `dry-run` | default plan-preview for building skills (v1.2.0) | `on`, `off` | none yet — config-only (a per-run argument on the relevant skill may still override for one run) | `off` |

For `guard`, note the mode semantics are not a simple on/off pair: `off` disables the guard
repo-wide (even if `DEV_TEAM_GUARD` is set); `on` forces it active regardless of whether a run is
in progress; `auto` (the default) preserves today's behavior — active only while a run is in
progress (`.dev-team/autopilot.json` present), unless `DEV_TEAM_GUARD` forces it on for the
session. `guard: off` in the repo config wins over a session's `DEV_TEAM_GUARD` — a repo owner who
has decided the guard should never run in this repo can rely on that even if a collaborator's
shell happens to have `DEV_TEAM_GUARD` set.

## How skills and hooks load it — best-effort, FAIL-OPEN

Loading `.dev-team/config.yml` is **best-effort and fail-open**, everywhere it's read:

- **Absent file** → every skill and hook proceeds on its built-in default. Not having a config
  file is the common case (most repos won't have one) and must never be treated as an error.
- **Malformed / unparseable file** (bad YAML, garbage bytes, a key that doesn't parse) → same as
  absent: proceed on the built-in default. Never fail a session, block a hook, or throw a parse
  error at the user.
- **A key present but with an unrecognized value** → ignore that key and fall back to its
  built-in default; don't let one bad line take down the rest of the file's valid keys.
- **Hooks use a tolerant grep-based line match**, not a real YAML parser (hooks are shell, keeping
  a YAML dependency out of a PreToolUse/SessionStart hot path is deliberate) — e.g.
  `grep -Eq '^[[:space:]]*update-notifier:[[:space:]]*(off|false|no)([[:space:]]|$)' .dev-team/config.yml`.
  This is intentionally forgiving: it matches the documented key names under `features:` by their
  unique key text, tolerates leading whitespace and either `off`/`false`/`no`, and any grep/read
  failure (`2>/dev/null`, missing file, non-git dir) falls through to "proceed as default" rather
  than erroring.
- **Skills** (which run in a full agent context, not a shell hook) read the file with normal file
  tools at setup time; the same rule applies — if it can't be read or parsed, proceed on built-in
  defaults and don't surface a parse error as a blocker.

The net effect: a user can safely commit a `.dev-team/config.yml` with a typo, an unsupported key,
or an empty file, and nothing breaks — the suite behaves exactly as if the file didn't exist for
whichever keys it couldn't make sense of.

## Inspecting and scaffolding it

Use `/dev-team-config` (see `commands/dev-team-config.md`) to print the effective config (built-in
defaults overlaid with anything the repo's `.dev-team/config.yml` sets) or to scaffold a starter
file. Never generate or edit `.dev-team/config.yml` from inside a skill run without telling the
user — it's a repo-wide, committed file, not run-scoped state.

## See also

- `conventions.md` — "Repo config & feature toggles" (the short cross-skill summary) and "PR base
  / no-stack policy" (the full no-stack rule this file's `git.stack-prs` key governs).
- `model-routing.md` — "Cost posture" for how `models=` actually biases the tier table.
- `issue-sync-protocol.md` — the `issues=` switch and the separate `issues=sync-security` opt-in.
- `dev-team-autopilot/references/modes-and-gates.md` — the `gates=` policy in full.

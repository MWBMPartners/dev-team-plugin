# Dev-Team Shared Conventions

The cross-cutting contracts every skill in the dev-team suite shares. The orchestrator is the hub and every sibling reads `dev-team-orchestrator/SKILL.md` first, so this file is the **one canonical home for the shared facts** — artifact ownership, where the plugin writes and how it recognises its own files, ID prefixes, the branch model, the agent/model assignment, the gates, and the flattening rule. When any of these change, change them *here*, then update the dependents. Treat a contradiction between this file and a sibling as a bug in the sibling.

## Roles & models

- The canonical roster and routing table lives in `skills/dev-team-orchestrator/references/model-routing.md` — the ONLY file allowed to name a dated model id. Builders / scouts / checker / red-team / validator / verifier run on the Build/Verify tier (the `opus-builder` agent); the documentarian runs on the Scribe tier (the `sonnet-scribe` agent) — recording state doesn't need a frontier model. See that file for the full tier → endpoint agent → model mapping and the two routing invariants.
- `sonnet-builder` is the economy build endpoint; cost postures (`models=economy|balanced|max`) are defined in `model-routing.md`.
- The lead (you) never writes production code; you delegate via the Task tool. Exceptions are narrow: trivial integration glue (wiring/imports/config — never new logic) and a one-line fix surfaced in the checker's NEEDS-LEAD-REVIEW list.

## The flattening rule

Subagents are **leaves** — they cannot spawn their own subagents. When one skill "reuses" or "activates" another, it does so by loading that skill's `SKILL.md` into the running agent's own context and **playing that mode there** — not by spawning a self-contained sub-orchestrator that returns. This is load-bearing under `dev-team-autopilot`, which plays every mode itself, one cycle at a time.

## Shared artifacts — who owns (writes) vs who reads

| File | Owner (writes) | Schema defined in | Read by |
|---|---|---|---|
| `.dev-team/PROJECT.md` | documentarian (orchestrator/iterate/security/stripe modes) | `documentarian-protocol.md` (base) + `dev-team-iterate/references/audit-and-backlog-protocol.md` (extension sections) | every skill |
| `.dev-team/FEATURES.md` | featurefind | `dev-team-featurefind/references/gap-scoring-rubric.md` | iterate, autopilot |
| `.dev-team/SECURITY.md` | security | `dev-team-security/references/threat-model-and-surface-protocol.md` | review, autopilot, a later security resume |
| `.dev-team/VERIFICATION.md` + `.dev-team/verdict.json` | review | `dev-team-review/references/verdict-and-report-protocol.md` (+ `schemas/verdict.schema.json` for `verdict.json`) | user, autopilot (VERIFY phase) |
| `.dev-team/MIGRATION.md` | sonnet-scribe (via dev-team-migrate) | `dev-team-migrate/references/migration-plan-protocol.md` | review, a later dev-team-migrate resume |
| `.dev-team/autopilot.json` | autopilot conductor | `dev-team-autopilot/references/loop-runtime.md` | autopilot (cold-resume) |
| `.dev-team/HANDOFF.md` | sonnet-scribe (all modes) | `handoff-template.md` | ANY LLM coding tool (Claude, Codex, Gemini, …) + a resuming lead — DERIVED, assistant-agnostic resume card at the fixed path `.dev-team/HANDOFF.md`; regenerated per completed task when `auto-handoff` on; committed with the work it describes (never auto-pushed); not a source of truth |
| `.dev-team/README.md` + `.dev-team/.gitignore` | any skill, created once if absent — never overwritten | this file, "Where the plugin writes, and the ownership rule" (point 7) | people browsing the repo (README); git (`.gitignore` keeps `loop.lock/` out of commits) |
| GitHub/GitLab Issues (optional) | sonnet-scribe (issue sync) | `issue-sync-protocol.md` | user's tracker — a dedup-safe export of the ledgers when `issues=sync` or `issues=auto`; platform (`gh`/`glab`) auto-detected from the remote, plain-git repos skip issues |

`PROJECT.md` is the human-readable source of truth; `autopilot.json` is the machine state the conductor's loop reads first each iteration. Keep the two consistent.

A run's end-of-run summary (phases/cycles, commits, agents by tier, a rough cost estimate) is a *computed report*, not an owned artifact in the table above — see `run-report.md` for the spec, and its automatic emission honors the `features.telemetry` toggle (`config-and-toggles.md`; fail-open, default `on`) while `/dev-team-report` works on demand regardless.

### PROJECT.md canonical section headings

Use these heading names verbatim so producers and consumers agree.

- **Base** (documentarian): `## Goal`, `## Definition of done`, `## Constraints`, `## Skills in play`, `## House style`, `## Stage plan`, `## Current status`, `## Decision log`, `## Checkpoint log`, `## Feature Specs` (one block per feature, anchored `#spec-<gate-id>`, e.g. `#spec-G-001`).
- **Extensions** (added by `dev-team-iterate`): `## Codebase Map`, `## Run record`, `## Backlog`, `## Proposed-Features ledger`, `## Trajectory ledger`.

So `autopilot.json`'s `trajectory_ref` resolves to `.dev-team/PROJECT.md#Trajectory-ledger` and its `spec_ref` to `.dev-team/PROJECT.md#spec-<id>`.

### Schema versioning

State and ledger files carry a version marker so a consumer can tell a compatible file from a stale-format one before trusting its shape: `.dev-team/autopilot.json` has a top-level `"schema": "1.0"` field (`loop-runtime.md`); every markdown ledger carries `<!-- dev-team: ledger=<kind> schema=1.0 -->` on line 2, directly under its title; and `.dev-team/verdict.json` carries the top-level field `"dev-team": "ledger=verdict schema=1.0"`. The same marker is also the plugin's proof that a file is its own — see "Where the plugin writes, and the ownership rule" below.
The legacy marker `<!-- dev-team-schema: 1.0 -->`, written before v1.5.0, is still read as `schema=1.0` and as proof of ownership, and is replaced by the new form the next time the file is written.
The rule for any dev-team state file: a consumer tolerates a **matching major version**; it warns — rather than silently guessing — on an unrecognized **newer** major. A **missing** marker means different things depending on what the reader is about to do. Before *writing*, it means "not known to be ours — ask" (the ownership rule), because most real ledgers written before v1.5.0 carry no marker and neither does a project's own file of the same name, so a missing marker cannot tell the two apart. When *reading a file already known to be ours* — one the user has just confirmed, or an `autopilot.json` without its `schema` field — a missing marker is still treated as the oldest known version, `1.0`, for back-compat with files written before the marker existed. Bump the major only on a breaking format change (a field removed, renamed, or repurposed), never for an additive field. This is deliberately lightweight — no migration tooling, just a version a reader can check first.

## Where the plugin writes, and the ownership rule

Any skill, agent or command file that needs to state this rule briefly uses exactly this sentence — copied byte for byte, pointer included — and then relies on this section for the detail:

> Every file the dev-team suite writes for itself lives in `.dev-team/` and carries the dev-team marker on line 2; a file at that path without the marker is never written to — the run stops and asks. See `dev-team-orchestrator/references/conventions.md`, "Where the plugin writes, and the ownership rule".

The nine points below say what that means, why it is this way, what was rejected, and what the enforcement cannot do.

1. **One home: `.dev-team/`.** Everything the suite writes for itself lives in the `.dev-team/` folder at the top of the project. That is the six markdown ledgers (`.dev-team/PROJECT.md`, `.dev-team/FEATURES.md`, `.dev-team/SECURITY.md`, `.dev-team/VERIFICATION.md`, `.dev-team/MIGRATION.md`, `.dev-team/HANDOFF.md`) and `.dev-team/verdict.json`; the files that already lived there (`.dev-team/autopilot.json` for run state, `.dev-team/loop.lock/` for "a cycle is running right now", `.dev-team/config.yml` for repo-wide settings); and a `.dev-team/README.md` and `.dev-team/.gitignore` that the plugin creates once. The suite never writes one of its record files at the top level of the project, in `docs/`, or in `.github/`.
   - *Why:* projects keep their own files with these names — a product feature list called `FEATURES.md`, a public security policy called `SECURITY.md` (GitHub looks for that in `.github/`, then the top level, then `docs/`, and never inside `.dev-team/`), a project's own `PROJECT.md`, or a hand-written `HANDOFF.md`. Before v1.5.0 the suite wrote its ledgers in the legacy root location, and in real projects it overwrote or appended to exactly those files: one project's public security policy had the plugin's findings register appended to the end of it.
   - *Rejected:* renaming the files (it fixes today's clash, not the next one with a name nobody has thought of); keeping them at the top level with a prefix on the name (it still clutters the project, and a prefixed name can clash too); making the location a setting (a user only discovers the setting exists after the damage is done).

2. **The file names stay the same inside the folder.** The folder is what keeps the plugin's files apart from the project's, so the names do not need to change as well. Renaming too would double the number of references that could go stale, and would break the simple link in the ID table below (`FG-` items live in `FEATURES.md`, `F-` findings in `SECURITY.md`). One real project had already moved its ledgers into `.dev-team/` by hand under these same names.

3. **The marker — how the plugin recognises its own file.** Line 1 of every markdown ledger is its title and line 2 is its marker, one per kind of file:

   ```text
   <!-- dev-team: ledger=project schema=1.0 -->
   <!-- dev-team: ledger=features schema=1.0 -->
   <!-- dev-team: ledger=security schema=1.0 -->
   <!-- dev-team: ledger=verification schema=1.0 -->
   <!-- dev-team: ledger=migration schema=1.0 -->
   <!-- dev-team: ledger=handoff schema=1.0 -->
   <!-- dev-team: ledger=readme schema=1.0 -->
   ```

   - `ledger=` names which file it is; `schema=` is its format version (see "Schema versioning" above). One marker does both jobs, so there is only one thing to keep right.
   - JSON has no comment syntax, so `.dev-team/verdict.json` carries a top-level string field instead: `"dev-team": "ledger=verdict schema=1.0"`. Its full shape is described in `schemas/verdict.schema.json`.
   - `.dev-team/autopilot.json` keeps its existing `"schema"` field and gains nothing new. It already lived in `.dev-team/` and only the autopilot conductor writes it, so no project file could be mistaken for it.
   - The legacy marker `<!-- dev-team-schema: 1.0 -->` (used before v1.5.0) is accepted as proof of ownership when reading, and is replaced by the new form the next time the file is written.
   - Where the marker counts: a writer always puts it on line 2. A reader deciding ownership looks only in the first three lines, because the plugin's own documentation quotes marker lines further down inside examples, and a file that merely quotes the marker is not a ledger.
   - *Why a marker, and not a judgement from the file's contents:* content that "looks like ours" is exactly how findings came to be appended to a project's public security policy. The shape of a file is never proof; only the marker is.

4. **The ownership rule — read before you write.** Before creating, overwriting or appending to any file in the Shared artifacts table, the writer reads the target path first. There are three cases and no fourth:
   - **File absent** → create it, with the marker on line 2 (for `verdict.json`, the `"dev-team"` field).
   - **File present, marker present** (either form) → it is ours; write it. If it carries the legacy marker, replace it with the new form in the same write.
   - **File present, no marker** → write nothing. An empty file counts as present without a marker, because a person may have created it on purpose. Stop and ask, with exactly this prompt (fill in the angle brackets):

     > Found `<path>` but it has no dev-team marker, so I cannot tell whether it is this plugin's file or the project's own. First three lines: <lines>. Choose one: (a) "it is a dev-team file from before v1.5.0" — I will add the marker (and, for a top-level file, move it to `.dev-team/<name>`) and commit that on its own; (b) "leave it" — I will write nothing to it. I will not guess.

   - On **(a)**: add the marker; if the file is in the legacy root location, `git mv` it to `.dev-team/<name>`; commit that change on its own, before any other work, then carry on.
   - On **(b)**: write nothing to that file, ever, in this run. For a file in the legacy root location, start a fresh `.dev-team/<name>` (point 5). For a marker-less file already inside `.dev-team/`, the run records nothing to that ledger and says so plainly in its report — a person has to stamp, rename or remove the file first.
   - **There is no third branch.** No "it looks like ours, carry on", and no "it is probably the project's, so write next to it under another name". Either guess can damage a file the plugin does not own, and nobody would notice until much later.
   - **Unattended autopilot cycle** (nobody there to answer): write nothing, set `state: "BLOCKED"` with `blocked.reason` `ledger-ownership`, and make the report name the file, show its first three lines, and point the user at `/dev-team-move-ledgers`. The loop stops rather than guessing.
   - **Dry-run:** the check still runs, but nothing is stamped, moved, created or committed (dry-run makes no file or git changes); the report says which question would be asked.

5. **Files from before v1.5.0 — the lookup order.** A reader looks for `.dev-team/<name>` first. Only if that is absent does it look in the legacy root location, at the top-level `<name>`.
   - **Legacy root file with a marker** (either form) → it is ours. `git mv` it into `.dev-team/`, rewrite the marker to the new form, and commit that on the current run branch as `dev-team: move <name> into .dev-team/ (v1.5.0)`, before any other work. Under dry-run, read it where it is, move nothing, and report the move as pending.
   - **Legacy root file without a marker** → apply the ownership rule (point 4). On "leave it", start a fresh `.dev-team/<name>` and never touch the legacy root file again.
   - **Never read a marker-less legacy root file as the ledger.** Doing so would make the run act on someone else's document — for example, treat a project's product feature list as the plugin's gap ledger.
   - **Both exist:** `.dev-team/<name>` wins. The legacy root file is left alone and mentioned in the report.
   - Values in `.dev-team/autopilot.json` written before v1.5.0 (`queue`, `spec_ref`, `trajectory_ref`) name the ledgers without the `.dev-team/` folder in front. A reader accepts both forms, resolves the older form through this lookup order, and the next RECORD rewrites it to the `.dev-team/` form (details in `dev-team-autopilot/references/loop-runtime.md`).
   - `/dev-team-move-ledgers` does all of this for all seven files at once: dry-run by default, `--apply` to act. It refuses to touch a "mixed" file — a project's own document with dev-team records appended to it — because cutting that apart needs a person.

6. **Security-policy locations are refused.** The security skill never writes `SECURITY.md` at the top level, in `.github/` or in `docs/` — the three places GitHub reads a public security policy from — even when an argument names one of those paths. It refuses and says why: that file is the project's public policy, and findings written into it would be published as if they were policy. The security skill's register lives only at `.dev-team/SECURITY.md`.

7. **The first write into `.dev-team/`.** Before the first ledger write in a project:
   - `mkdir -p .dev-team`.
   - If `.dev-team/.gitignore` is absent, create it containing exactly one line: `loop.lock/`. *Why:* the lock only means "a cycle is running on this machine right now" and must never be committed; some projects had no ignore line for it, so a crashed run could have committed a stale lock.
   - If `.dev-team/README.md` is absent, create it with the fixed text below. It is itself a file the plugin writes, so it carries the marker and the ownership rule applies to it.
   - Neither file is ever overwritten once it exists.
   - Run `git check-ignore -q .dev-team/<file>`. If the file is ignored, put this warning in the run report: "`.dev-team/<file>` is ignored by this repo's `.gitignore`, so it will not be committed and will not travel with the repo." *Why:* otherwise the promise that ledgers are committed with the work fails silently.
   - Never edit the project's own `.gitignore`. It is a repo-wide file that belongs to the project — the same posture as `.dev-team/config.yml`, which the plugin only scaffolds when asked.
   - Under dry-run, none of these steps happen.

   The fixed `.dev-team/README.md` text:

   ```text
   # .dev-team — dev-team plugin working folder
   <!-- dev-team: ledger=readme schema=1.0 -->

   This folder belongs to the dev-team Claude Code plugin (https://github.com/MWBMPartners/dev-team-plugin).
   It holds the plugin's own record files — PROJECT.md, FEATURES.md, SECURITY.md, VERIFICATION.md with
   verdict.json, MIGRATION.md, HANDOFF.md — plus its run state (autopilot.json) and the repo-wide settings
   file (config.yml). Everything here is meant to be committed except loop.lock/, which the .gitignore in
   this folder excludes. To resume work, read HANDOFF.md first. None of these files are part of the product;
   deleting the folder loses the plugin's memory of past runs and nothing else.
   ```

8. **Finding the folder without a top-level file.** On the first run that creates `.dev-team/` — interactive runs only, and autopilot's bootstrap counts as interactive — offer to add this sentence, word for word, to each of `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md` and `GEMINI.md` that already exists:

   > Dev-team plugin state and the current handover live in `.dev-team/` — read `.dev-team/HANDOFF.md` first.

   - Offer it; never add it silently. Those files belong to the project.
   - A plain sentence, not an `@` import: an import would load the whole handover card into every session, whether or not it is wanted.
   - None of those files present → say so in the report and do nothing. Never create an instruction file just to hold the sentence.
   - *Why no top-level pointer file instead:* any new top-level name can clash with a project's own file in exactly the same way.
   - *Why moving `HANDOFF.md` loses nothing:* no AI coding tool reads a top-level `HANDOFF.md` automatically — Claude Code reads `CLAUDE.md`, Codex reads `AGENTS.md`, Gemini CLI reads `GEMINI.md` — and real projects already keep a hand-written top-level `HANDOFF.md` that auto-handoff would have overwritten.

9. **Enforcement — four layers, none of them a guarantee on its own.**
   - **This written rule** is the real protection. Every other layer only catches some of the ways it can be broken.
   - **`hooks/guard-ledgers.sh`**, a hook that runs before every Write, Edit or MultiEdit. It works things out from the hook's own input (including the session's working folder), and on any doubt — no `jq`, a missing field, input it cannot parse — it allows the write rather than blocking. `guard: off` in `.dev-team/config.yml` switches off both of its rules, even when `DEV_TEAM_GUARD` is set.
     - *Rule 1 — on unless `guard: off`:* it blocks a Write whose content has a dev-team marker in its first three lines when the path is outside `.dev-team/`. It stays on outside a run because a skill following a stale instruction does the same damage in a standalone run, and only plugin-generated content carries the marker, so a person editing their own file is never blocked. It checks Write only, because an Edit's new text has no line position.
     - *Rule 2 — only while `.dev-team/loop.lock/` exists, `guard: on` is set, or `DEV_TEAM_GUARD` is set:* it blocks a Write, Edit or MultiEdit to a top-level file with one of the seven ledger names, or to `SECURITY.md` in `.github/` or `docs/`, but only when the incoming text carries the dev-team marker or a dev-team record number (a pattern such as `FG-012`, `F-001` or `B-004`). It never acts merely because `.dev-team/autopilot.json` exists: some projects commit `autopilot.json`, so its presence does not mean a run is active, whereas `loop.lock/` exists only while a cycle is running and is never committed. The content test is there because the harm being prevented is the plugin putting its records into a project's file; a person's own edit carries neither the marker nor record numbers, so it goes through.
     - *What the hook cannot do:* it does not see files written through Bash (for example `cat >> SECURITY.md`); it is a best-effort pattern match, so text that happens to look like a record number can be blocked, and plugin records reworded without numbers can slip through; and it has not been confirmed by hand that the hook runs for a subagent's writes as well as the lead's.
   - **`scripts/audit-ledger-paths.sh`**, the plugin's own self-test, run in CI. It fails if any skill, command, agent or README line still points a writer at the legacy root location. The phrase "legacy root" is the one allowed way to describe the old location, which is why this section uses it. *What it cannot do:* it checks listed phrases only, so a stale instruction worded some new way can pass; and it checks the plugin's own files, not a user's project.
   - **The scribe self-check.** After writing any ledger, the writer re-reads line 2 (for `verdict.json`, the `"dev-team"` field). If the marker is missing, the write is reported as failed. *What it cannot do:* it proves the marker is there, not that the content under it is right.

## ID prefixes — keep the namespaces distinct

| Prefix | Meaning | Owner / location |
|---|---|---|
| `FG-` | feature gap | featurefind → `.dev-team/FEATURES.md` |
| `F-` | security finding | security → `.dev-team/SECURITY.md#Findings` |
| `B-` | improvement backlog item | iterate → `.dev-team/PROJECT.md#Backlog` |
| `G-` | gate-ledger item (feature / dep-upgrade / architectural, awaiting a decision) | autopilot → `.dev-team/autopilot.json` |
| `V-` | review verdict | review → `.dev-team/VERIFICATION.md` |
| `I-` | improvement finding (works, but inefficient) | review |
| `M-` | migration stage / deferred follow-up (a blocked stage, a risk flagged for sign-off, a proposed-not-auto-taken strategy call) | migrate → `.dev-team/MIGRATION.md`'s Stage Ledger |

A review→security handoff carries the `V-`↔`F-` mapping so the regression projects back into `.dev-team/SECURITY.md`'s register (which is what a security resume reads).

When `issues=sync` or `issues=auto` (or `/dev-team-sync-issues`) is used, each item's prefix+id maps to a GitHub/GitLab issue (via the hidden `<!-- dev-team:<id> -->` marker), and the item stores the issue number in an `issue:` field for dedup — see `issue-sync-protocol.md`. Labels: `for consideration`, `security`, `enhancement`, `bug`.

## Repo config & feature toggles

`.dev-team/config.yml`, when the user commits it in their project repo, is the **repo-scoped**
source of run defaults (`models`, `gates`, `cap`, `cycles`, `issues`) and feature toggles
(`update-notifier`, `branch-notifier`, `guard`, `notifications`, `telemetry`, `dry-run`,
`auto-handoff`, `auto-commit`) —
applying to every session and every collaborator, not just the current one. It is the intended
**primary switch mechanism**; per-run arguments, plain language, and per-session env vars (e.g.
`DEV_TEAM_NO_UPDATE_CHECK`) are overrides layered on top of it. Precedence, highest first: per-run
argument > plain language > per-session env var > repo `.dev-team/config.yml` > built-in default.
Loading is **best-effort and fail-open** everywhere — an absent or malformed file is never an
error; every skill and hook simply falls back to its built-in default. Full schema, the toggle →
env-override table, and `/dev-team-config` (show the effective config, or scaffold a starter file)
live in `references/config-and-toggles.md` — read it before you build anything that reads a
default or a toggle.

## Dry-run / plan-preview

When `dry-run=on` (per-run argument) or `features.dry-run: on` (repo `.dev-team/config.yml`;
default `off`) is in effect, a BUILDING skill — orchestrator, iterate, security, stripe, ship —
produces its full plan and the briefs it WOULD issue, spawns **no builders**, and makes **no
file or git changes**: it stops after planning and reports the plan + briefs for the user's
approval. (`dev-team-review` is unaffected — it's already read-only.) Precedence follows the
standard chain in `config-and-toggles.md`: per-run argument > plain language ("just show me the
plan", "dry run") > repo config > built-in default (`off`). Fail-open: a missing or unreadable
config simply leaves dry-run off.

## Cold-resume

At the front of a run, a skill checks for its **own prior artifact + run record** before doing any
fresh work — the same discipline `dev-team-iterate`'s Phase 0 and `dev-team-autopilot` already
apply, generalized across the suite. If a current one exists — validated the way iterate validates
its Codebase Map (a git-drift check, plus a small spot-check against the real repo; see
`dev-team-iterate/references/audit-and-backlog-protocol.md`) — **RESUME** from that state instead
of restarting cold. If it's missing, stale, or the tree is dirty in a way that invalidates it,
start fresh. The artifact to check is whichever this skill owns per the Shared artifacts table
above: `.dev-team/PROJECT.md` (orchestrator, iterate, stripe), `.dev-team/SECURITY.md` (security),
`.dev-team/VERIFICATION.md` (review) — found through the lookup order in "Where the plugin writes,
and the ownership rule" (point 5), which never reads a file without the dev-team marker as the
ledger. This is baked-in discipline, not a toggle — always attempted, always fail-open to a
fresh run when the check doesn't pass.

## Autopilot notifications

When `features.notifications: on` (the default; `.dev-team/config.yml`), the `dev-team-autopilot`
conductor surfaces a prominent, clearly-marked notice at three events: a gate item **QUEUED** for
approval, a **BLOCKED** pause, and a terminal **DONE**/cap. Each is emitted as its own distinct
report line — not buried in a routine cycle update — so a long unattended run makes plain the
moment it needs the user or has finished. Users MAY additionally wire a Claude Code
Notification/Stop hook, or a push-notification integration, for real push delivery outside the
terminal (documented, optional — not required for the in-report notice to work). Fail-open: a
missing/malformed config leaves the default (`on`); `features.notifications: off` skips the notice
entirely. See `dev-team-autopilot/references/loop-runtime.md` for the exact event hooks.

## Auto-handoff

When `features.auto-handoff` is `on` (the default; `.dev-team/config.yml`), the `sonnet-scribe`
documentarian regenerates `.dev-team/HANDOFF.md` after **every completed task/workstream** — not only at stage
checkpoints / RECORD. `HANDOFF.md` is **assistant-agnostic**: a one-glance resume card any LLM coding
tool (Claude, Codex, Gemini, …) can read cold, written in plain tool-neutral markdown at the fixed
path `.dev-team/HANDOFF.md`, and *derived* — never a source of truth (`.dev-team/PROJECT.md` is).
A project's own top-level `HANDOFF.md` (one without the dev-team marker) is never touched: no AI
coding tool reads a top-level `HANDOFF.md` automatically, so that location gave the plugin nothing,
and real projects keep a hand-written handover there. It is **committed
alongside the work it describes** (it rides in the per-task auto-commit, or the checkpoint commit when
auto-commit is off) so it travels with the repo for the next session or teammate to resume from; these
behaviors never auto-push it or open a PR. Precedence follows the standard chain
(`config-and-toggles.md`): per-run argument > plain language > per-session env `DEV_TEAM_NO_AUTO_HANDOFF`
> repo config `features.auto-handoff` > built-in default `on`. Fail-open: a missing/malformed config or
any regeneration error simply leaves the extra per-task regenerate un-done — the checkpoint/RECORD
regenerate still behaves as before. Purely additive and outward-effect-free: it writes one local file.

## Auto-commit

When `features.auto-commit` is `on` (the default; `.dev-team/config.yml`), each **completed-and-checked**
task/workstream is committed as its own **local** commit on the run branch, its message naming the
task/workstream. These are **additional** fine-grained rollback points **between** the "one commit per
passing cycle/checkpoint" commits (see "Git / branch model" below) — they never replace the checkpoint
commit, and only ever commit a unit the checker has cleared, preserving the rule *never commit a
broken/unverified state*. Auto-commit **never pushes and never opens a PR** — pushing stays the user's
explicit choice, exactly as for every other commit in a run. The lead performs the commit (the
conductor under `dev-team-autopilot`); it does **not** write machine state mid-cycle —
`autopilot.json` is still read-first / written-last at RECORD, where `last_commit` is refreshed to the
run branch's current HEAD. Precedence: per-run argument > plain language > per-session env
`DEV_TEAM_NO_AUTO_COMMIT` > repo config `features.auto-commit` > built-in default `on`. Fail-open.

## Git / branch model

- One run = one branch; **one commit per passing cycle/checkpoint**; never merge to `main` without asking. With `auto-commit` on (the default), each completed-and-checked task/workstream also lands its own additional local commit *between* checkpoint commits — see "Auto-commit" above (never replaces the checkpoint commit, never pushes, only integrated+checked units).
- Branch names: `iterate/<date>`, `security-audit/<date>`, `review-fix/<date>`, `stripe/<date>`, `autopilot/<date>` (suffix `-2`, `-3` on collision).
- **Under the `dev-team-autopilot` conductor, siblings do NOT create their own branch** — every mode cycle commits to the single `autopilot/<date>` run branch.
- A dirty working tree or a non-git repo is surfaced to the user before proceeding — and it forces full re-validation of any reused Codebase Map, not just branch hygiene.

### PR base, no-stack & single-PR policy

By default, every run branches FROM and targets the **default branch** (`main`) — this extends the
"one run = one branch" rule above with *which* branch that is. **Never stack a PR on another
feature branch**: stacking creates a merge-race hazard (the base branch can move, get rebased, or
be force-pushed out from under the dependent PR, and reviews/CI end up run against a moving
target). Stack only when `.dev-team/config.yml` sets `git.stack-prs: true` **and** the user
explicitly asks for it for that run — both conditions, not either.

**Single-PR policy** (`git.single-pr`, default **on**) is the companion rule: where no-stack
prevents *stacked* PRs, single-PR prevents *duplicate* PRs — a second PR for a line of work that
already has one open. Together they keep **one open PR per line of work**, the safest merge posture
(no parallel PRs racing to merge the same change). When a run is surfaced as a PR — or a
follow-up / cold-resume run continues an earlier one — the lead:

1. **Reuses the run branch.** A follow-up run for the same line of work continues on the *same* run
   branch as the prior run (adopting it when an open PR still points at it) instead of cutting a
   fresh `<mode>/<date>` branch, so new commits flow into the existing PR rather than a new one.
2. **Checks before creating.** Before opening a PR, check whether an open PR already exists for this
   branch → base (`gh pr list --head <branch> --base <base> --state open`; GitLab: `glab mr list
   --source-branch <branch>`). If one exists, **do not open a second** — push the branch (the
   existing PR updates itself) and report that PR's URL. Only ever reuse a PR whose **head is this
   run branch** — never push onto an unrelated PR, or one the user doesn't own.
3. **Platform-agnostic & fail-open.** GitHub (`gh`) or GitLab (`glab`), auto-detected from the git
   remote (same detection as issue sync); if the CLI is absent/unauthed or the check fails, fall
   back to today's behavior — hand the branch back for the user to open the PR.

Single-PR does **not** make the suite auto-open PRs — every skill still hands the branch back for
review, and nothing merges to the base without asking. It only ensures that *when* a PR is created
or updated, it converges on the one existing PR instead of spawning duplicates. Turn it off with
`git.single-pr: false` (then each run may surface its own PR). See
`references/config-and-toggles.md` for the `git:` block (`stack-prs`, `single-pr`, `default-branch`).

## Gates

- **Feature Spec Gate** (standalone iterate / featurefind / orchestrator): every net-new feature — *any size* — needs the user's approval of *which* features and *exactly how* each works before it is built. Discovery/improvement skills propose; they never build a feature unprompted.
- **Conductor hybrid gate policy** (autopilot): replaces the Feature Spec Gate. Obvious in-scope table-stakes (`risk:Low`, non-destructive, net-positive) auto-build from a conductor-authored spec whose logged justification is the approval-of-record; differentiators / risky / out-of-scope / destructive are queued and surfaced for the user. `gates=pause-all` restores the standalone gate.

## Shared discipline

- **Evidence, not claims.** Builders paste real command output; the checker re-runs; review re-proves with fresh evidence generated *now*. In featurefind this becomes a **citation per claimed competitor feature**.
- **Restraint.** No manufacturing work to keep a loop alive. "Nothing high-impact left — here's what I'd leave alone, stopping" is a success state, not a failure.
- **Independence.** Whoever verifies a thing is never whoever built it.

## Self-tests

The plugin tests itself: `tests/smoke-structure.sh` (structure a marketplace installer relies on) and `tests/scripts.bats` (behavior contracts for the hooks/scripts) run in CI as the `test` job alongside the existing `audit` job (`.github/workflows/plugin-audit.yml`) — see `tests/README.md` and `CONTRIBUTING.md` for how to run them locally before you touch `hooks/`, `scripts/`, or the manifests.

## Safety (security & stripe)

- **Test-mode / local-sandbox only.** Never attack or mutate systems you don't own; never run live payment flows (`dev-team-stripe` needs an explicit `live=confirm`).
- **Destructive/irreversible ops on systems the user DOES own also require confirmation.** Production databases, live datastores, and deployed environments are not exempt just because the user owns them: any destructive or irreversible operation against one requires the user's explicit confirmation and a verified backup/rollback in hand before proceeding. `git revert` undoes code, not data.
- **Secrets:** report location and type, never the value; flag for rotation; treat as compromised.
- **Active-compromise signal → freeze all remediation.** Do not patch even if the fix is clear — auto-patching destroys forensic evidence and tips off an attacker. Escalate to the user as incident response; this is not a git-revertible action.

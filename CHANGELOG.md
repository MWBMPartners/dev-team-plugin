# Changelog

All notable changes to the dev-team plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.5.0] - <unreleased>

### Changed

- **Every file the plugin writes for itself now lives in `.dev-team/`.** `PROJECT.md`,
  `FEATURES.md`, `SECURITY.md`, `VERIFICATION.md` + `verdict.json`, `MIGRATION.md`, and now
  `HANDOFF.md` too, are all written to `.dev-team/<name>` instead of the top level of the project.
  The file names themselves are unchanged — the folder is what keeps them apart from a project's
  own files. Why: real projects keep their own files with these exact names — a product's own
  feature list called `FEATURES.md`, GitHub's public security policy (`SECURITY.md`, which GitHub
  reads from `.github/`, the top level, or `docs/` — never from `.dev-team/`), a hand-written
  `HANDOFF.md` — and before this release the plugin overwrote or appended to them without checking
  whose file it actually was. One real project had the plugin's security findings appended onto the
  end of its own public security policy. Rejected: renaming the files (fixes today's clash, not the
  next one with a name nobody has thought of yet); keeping them at the top level with a prefix on
  the name (still clutters the project, and a prefixed name can clash too); making the location a
  setting (a user only discovers the setting exists after the damage is already done). Full rule:
  `conventions.md`, "Where the plugin writes, and the ownership rule".
- **The ownership rule.** Every markdown ledger now carries a marker comment on line 2
  (`<!-- dev-team: ledger=<kind> schema=1.0 -->`), and `verdict.json` carries the same idea as a
  JSON field (`"dev-team": "ledger=verdict schema=1.0"`). Before writing anywhere in the ledger
  table, a skill reads the target file first: file absent → create it with the marker; marker
  present → it's the plugin's own, write it; **no marker → write nothing**, and ask a person which
  it is, rather than guess — guessing either way can damage a file the plugin does not own. An
  unattended autopilot cycle that hits this case goes `BLOCKED` (reason `ledger-ownership`) instead
  of guessing on its own. The security skill also now flatly refuses to write `SECURITY.md` at the
  top level, in `.github/`, or in `docs/` — the three places GitHub looks for a project's real
  security policy — even if asked to.
- **Files written before this release keep working.** A reader looks for `.dev-team/<name>` first
  and, only if that's absent, falls back to the old top-level `<name>`. A top-level file that
  already carries the marker is moved into `.dev-team/` and committed on its own — the first commit
  on the run's own branch, never straight onto the default branch without asking — the next time a
  run that actually writes ledgers touches it; one with no marker triggers the same ownership
  question above, and an unattended autopilot cycle that hits it goes `BLOCKED` (reason
  `ledger-ownership`) instead of guessing. **A read-only command or phase never does this move.**
  `/dev-team-status`, `/dev-team-report`, `/dev-team-approve`, the review skill's verification
  phase, and docs audit mode each promise to change nothing (or one named field); each of them now
  reads a marked legacy file exactly where it sits, moves and commits nothing, and reports the move
  as pending instead — "`<name>` is still at the top level of the project — run
  `/dev-team-move-ledgers` to move it into `.dev-team/`." Values inside `.dev-team/autopilot.json`
  written before this release (`queue`, `spec_ref`, `trajectory_ref`) that name a ledger without the
  `.dev-team/` folder in front are still accepted and are rewritten to the new form at the next
  RECORD step — but only once the file they name has actually moved; a value naming a file still at
  the top level is left as it is and called out in the report, rather than pointing at a
  `.dev-team/` file that doesn't exist yet.
- `hooks/guard-ledgers.sh`'s ledger-**name** matching (Rule 2, and now Rule 1's name test too)
  compares names **ignoring case**, because a filesystem that ignores case (macOS, by default)
  treats `security.md` and `SECURITY.md` as the exact same file on disk — matching capitals only
  would have let a write spelled in lower case walk straight past a check meant to protect that
  file. The hook's separate `.dev-team/` **folder** test stays case-sensitive on purpose: refusing
  a write to something that merely looks like `.DEV-TEAM/` is the safe direction to be wrong in.
  The lookup order (`.dev-team/<name>` first, then the legacy root `<name>`) is a plain, exact
  file-name match and says nothing about case either way.
- The `verdict.json` marker is recognised whether it's written with normal spacing
  (`"dev-team": "ledger=verdict schema=1.0"`) or as **compact JSON with no spaces at all**
  (`{"dev-team":"ledger=verdict schema=1.0"}`) — both are exactly the same content, and a stricter
  match would have missed the second, equally valid, form.
- The example `verdict.json` shown in the review skill's own protocol doc
  (`verdict-and-report-protocol.md`) is now real, valid JSON with real enum values that actually
  passes `schemas/verdict.schema.json`. The example was already valid JSON as written (`jq` parsed
  it fine) — the problem was that it used placeholder values (`PASS | PASS_WITH_GAPS | FAIL` and
  `V-0XX`) that the schema's enums and id patterns reject, so nobody could have copied it as a
  working starting point.
- The `HANDOFF.md` resume card's own Artifacts line now lists `MIGRATION.md` and `verdict.json`
  alongside the other ledgers, so a session resuming cold from the card can see at a glance whether
  those two exist for this project.

### Added

- `/dev-team-move-ledgers` (dry-run by default; `--apply` to act): sorts every legacy top-level
  ledger file into "ours — will move" (has the marker), "looks like ours — ask" (no marker, but has
  the shape of one), "not ours — leave alone", "mixed — needs a person" (a project's own document
  with dev-team records appended into it — the command refuses to cut that apart itself, because
  getting that boundary wrong either publishes findings as if they were policy or deletes part of
  the policy, and a person needs to make that call), or "conflict" (a `.dev-team/<name>` already
  exists — that copy wins, the legacy file is left exactly as it is, and it is never asked about,
  whatever else it also looks like). Files agreed to move are `git mv`d and, only once safely inside
  `.dev-team/`, stamped with the current marker form — moving first and stamping second, on purpose,
  because writing marker content to a file still at the top level is exactly what the ledger guard's
  Rule 1 refuses — then committed together in one commit, never pushed automatically. **Before
  touching anything**, it checks whether the project's own `.gitignore` would swallow any file it's
  about to move or create; if so, `--apply` refuses up front and reports which paths are ignored,
  rather than moving files somewhere git will never track. If the commit fails partway through, it
  rolls the whole attempt back (discarding only this command's own changes) rather than leaving a
  half-moved tree.
- **The `.dev-team/` pointer sentence.** Any interactive run that writes into `.dev-team/` —
  including autopilot's bootstrap and `/dev-team-config init` — offers, once per run, to add one
  fixed sentence — "Dev-team plugin state and the current handover live in `.dev-team/` — read
  `.dev-team/HANDOFF.md` first." — to whichever of `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md` and
  `GEMINI.md` exist and don't already carry it. The trigger is "is the sentence actually missing
  from a file that exists", not "is this the run that first creates `.dev-team/`" — the rejected
  version of that trigger would have meant the offer could never come up again once the folder
  already existed, even on a project whose instruction files have never once seen the sentence. It
  only ever offers — it never adds the sentence silently — and a read-only command never offers it
  at all. **A decline is remembered**, so it isn't re-asked every run: choosing "no" sets
  `features.pointer-sentence: declined` in `.dev-team/config.yml` (creating a minimal file holding
  just `version: 1` and that key, if none exists yet) and says so; an unreadable config file counts
  as "not yet asked", so the offer can safely come back.
- `hooks/guard-ledgers.sh` (a new PreToolUse hook on `Write`, `Edit`, and `MultiEdit`), a second,
  independent layer behind the written rule above. Two separate checks, both best-effort and
  fail-open — never the guarantee, only a second line of defense:
  - **Rule 1** is on all the time unless `guard: off`: it refuses a `Write` only when **all three**
    hold — the new content carries the dev-team marker on one of its first three lines, the
    target's file name (ignoring capitals) is one of the seven ledger names **plus `README.md`**,
    and the path, once any `.`/`..` parts in it are worked out (`.dev-team/../SECURITY.md` starts
    with `.dev-team/` as plain text but names the top-level file), lands outside `.dev-team/` — an
    absolute path that does not resolve to somewhere inside the project is likewise treated as
    outside `.dev-team/`. `README.md` is on Rule 1's list because the plugin also writes a marked
    `.dev-team/README.md` (see "Where the plugin writes, and the ownership rule", point 7); without
    it in the list, a mistaken write of that fixed text — for example a stale or mistyped
    instruction that drops the `.dev-team/` prefix — could overwrite a project's own top-level
    `README.md` unchecked. Rule 2's name list is unchanged: the seven ledger names only, never
    `README.md`, because a project's own `README.md` mentioning a record-id-shaped string (like
    `F-001`) far more often reflects an ordinary project document than a plugin write. That's one
    narrow shape Rule 1 can block — for example a person pasting a copy of a ledger into
    `docs/FEATURES.md`, or the folder README landing at the wrong path — not a blanket guarantee
    that it can never touch a person's own file; to proceed, write the file under `.dev-team/`
    instead, or set `guard: off`.
  - **Rule 2** only activates while `.dev-team/loop.lock/` exists (an autopilot cycle is running
    right now), `guard: on` is set in `.dev-team/config.yml`, or `DEV_TEAM_GUARD` is set — and even
    then it only refuses a write to one of the seven ledger names at the top level (or `SECURITY.md`
    in `.github/`/`docs/`) when the incoming text itself carries the marker or a dev-team record id
    such as `F-001` or `FG-012`. It deliberately does **not** treat a committed
    `.dev-team/autopilot.json` as proof that a run is active: some real projects keep that file
    committed in git, so if presence-of-the-file were the signal, this rule would have been
    permanently on in those projects and would have stopped their owners editing their own
    top-level `HANDOFF.md` or `FEATURES.md` forever. `loop.lock/` is a real "right now" signal
    instead — it's created for the length of one cycle and removed at the end, and it's never
    committed to git.
  - **Path resolution**, used by both rules: before either one decides, the target path is worked
    out lexically — every `.` piece dropped, and every `..` piece cancels the piece right before it
    — so `.dev-team/../SECURITY.md` is correctly read as naming the top-level `SECURITY.md`, not a
    file inside `.dev-team/`, even though the raw text starts with `.dev-team/`. A path that tries
    to climb higher than it started (more `..` pieces than there is anything left to cancel) is
    treated as having left the project entirely: Rule 1 still judges it by file name, but Rule 2
    never matches it, since a path that has left the project cannot be "the project's own top-level
    file" Rule 2 exists to protect.
  - What it still can't do: it never sees a write made through `cat >>` or similar in Bash, and it's
    a best-effort pattern match, not a guarantee — a determined rewrite that avoids the marker and
    every id pattern won't be caught. The real protection stays the written rule plus a person
    reading what they're about to commit.
- `.dev-team/.gitignore` (containing exactly `loop.lock/`) and `.dev-team/README.md` are created
  once, the first time anything is written into the folder, and never overwritten after that; a
  warning is added to the run report if the project's own `.gitignore` would swallow the folder.
- `schemas/verdict.schema.json`, a JSON Schema describing `verdict.json`'s exact shape, with a
  sample fixture and two `tests/scripts.bats` cases validating against it via `check-jsonschema`
  (skipped, not failed, when that tool isn't installed locally — CI always has it).

### Known gaps (follow-ups, not fixed in this release)

- **Security findings committed under `.dev-team/SECURITY.md` are still in the repository.** Moving
  them off the top level doesn't make them private — a public repository still publishes its
  findings and any proof-of-concept detail written alongside them. That's a separate decision, not
  a bug in this change. Tracked as issue #42.
- **`.dev-team/autopilot.json` has no schema file of its own**, unlike `verdict.json`. Its
  documented example contains `//` comments, so as written it can't even be validated against a
  schema yet. Tracked as issue #43.
- **The existing Bash guard (`hooks/guard-dev-team.sh`) still treats a committed `autopilot.json`
  as proof a run is in progress** — the same weakness this release fixed in the new ledger guard,
  left as-is here because that hook's own three rules (blocking a push to `main`, a force-push, and
  a live Stripe key) are mostly harmless even when it's on more often than it needs to be. Tracked
  as issue #44.

## [1.4.0] - <unreleased>

### Added

- **Single-PR policy** (`git.single-pr`, default `on`): a companion to the no-stack policy that keeps
  **one open PR per line of work**. When a run's branch already has an open PR to its base, the suite
  reuses that PR (pushes the branch to update it) instead of opening a duplicate, and a follow-up /
  cold-resume run continues on the same run branch so its commits flow into the existing PR. This
  prevents duplicate/parallel PRs racing to merge the same line of change (complementing `stack-prs`,
  which prevents *stacked* PRs). Scoped for safety to a PR whose head is the run branch (never pushes
  onto an unrelated PR); platform-agnostic (GitHub `gh` / GitLab `glab`, auto-detected from the
  remote); fail-open; and it never auto-opens or auto-merges a PR — each skill still hands the branch
  back for review. Turn off with `git.single-pr: false`. Full rule in `conventions.md`
  ("PR base, no-stack & single-PR policy").

## [1.3.0] - <unreleased>

### Added

- **Continuous handoff / auto-log** capability, driven by `.dev-team/config.yml`, fail-open, following
  the standard precedence chain (per-run arg > plain language > per-session env > repo config >
  built-in default):
  - `features.auto-handoff` (default `on`): regenerate `HANDOFF.md` after EVERY completed
    task/workstream, not only at stage checkpoints/RECORD. `HANDOFF.md` is now ASSISTANT-AGNOSTIC —
    a cold-readable resume card any LLM coding tool (Claude, Codex, Gemini, etc.) can pick up at a
    stable repo-root path, committed alongside the work it describes so it survives a fresh clone.
    Owned by `sonnet-scribe`. Per-session off-switch: `DEV_TEAM_NO_AUTO_HANDOFF`.
  - `features.auto-commit` (default `on`): commit each COMPLETED-AND-CHECKED task/workstream as its
    own LOCAL commit (NEVER push, NEVER open a PR). These are ADDITIONAL fine-grained rollback points
    BETWEEN the existing per-checkpoint/per-cycle commits — they never replace the checkpoint commit
    and only ever commit an integrated+checked unit, preserving the "never commit a broken/unverified
    state" discipline. Commit message names the task/workstream. Per-session off-switch:
    `DEV_TEAM_NO_AUTO_COMMIT`.
  - `defaults.issues` gains a third value: `off | sync | auto` (default stays **off** — opt-in).
    `auto` continuously reflects work in the tracker as each item completes/closes (per-task cadence)
    instead of only at the `sync` sync points. Still confirm-first on the FIRST sync per repo,
    security findings still require the separate `issues=sync-security` opt-in, still dedup-safe.
  - Issue sync now supports BOTH **GitHub (`gh`)** and **GitLab (`glab`)**, platform auto-detected
    from the git remote; a plain-git repo with no platform simply skips issues (handoff + commit
    still work).

### Changed

- `agents/sonnet-scribe.md` + `model-routing.md`: `HANDOFF.md` added to the documentarian's enumerated
  owned artifacts, reflecting continuous auto-handoff ownership.
- Autopilot crash-recovery (`loop-runtime.md`): a reclaimed stale cycle now resets the working tree to
  the run branch's current HEAD (keeping already-checked per-task auto-commits) rather than to
  `last_commit`; `autopilot.json` is still written only at RECORD (read-first/write-last unchanged).

## [1.2.0] - <unreleased>

### Added

- `.dev-team/config.yml`: a repo-scoped, committed config file for run defaults (`models`, `gates`,
  `cap`, `cycles`, `issues`) and feature toggles (`update-notifier`, `branch-notifier`, `guard`,
  `notifications`, `telemetry`, `dry-run`) plus a `git:` block (`stack-prs`, `default-branch`) —
  applies repo-wide, to every session and collaborator. Precedence: per-run argument > plain
  language > per-session env var > repo config > built-in default. Loading is best-effort and
  fail-open everywhere. Full schema in
  `skills/dev-team-orchestrator/references/config-and-toggles.md`.
- The **no-stack PR policy**: by default every run branches FROM and targets the default branch;
  stacking on another feature branch requires both `git.stack-prs: true` in the repo config AND an
  explicit per-run ask.
- `tests/smoke-structure.sh` + `tests/scripts.bats`: the plugin's own self-tests (structure a
  marketplace installer relies on, and behavior contracts for the hooks/scripts), run in CI as a new
  `test` job (job name `test`, the required-check context) alongside the existing `audit` job.
  `CONTRIBUTING.md` documents the repo layout and how to run both locally. State files
  (`.dev-team/autopilot.json`, `PROJECT.md`) carry an explicit schema-version marker so a consumer
  can tell a compatible file from a stale-format one before trusting its shape
  (`conventions.md`'s "Schema versioning").
- Run-end **telemetry**: an automatic run report (skill/mode + phases, cycles/stages, agents
  spawned by tier, commits, wall-clock, gate-ledger outcomes, and a rough spawn-count cost estimate
  — explicitly caveated as "not a bill") emitted at a run's terminal step, gated by the
  `features.telemetry` toggle (default `on`, fail-open). `/dev-team-report` (`[branch=<base>]`)
  computes the same report on demand, read-only, regardless of the toggle. Spec + the single source
  of truth for the per-tier cost weights: `skills/dev-team-orchestrator/references/run-report.md`.
- `dry-run=on|off` on every building skill (orchestrator, iterate, security, stripe, ship, migrate):
  produces the full plan and the briefs it WOULD issue, spawns no builders, and makes no file or
  git changes. Precedence and fail-open rules follow the standard config chain
  (`conventions.md`'s "Dry-run / plan-preview").
- **Generalized Cold-resume**: every skill now checks for its own prior owned artifact + run record
  at the front of a run (validated via a git-drift check plus a small spot-check, the same
  discipline `dev-team-iterate` already used) and resumes from it instead of restarting cold, when
  it's current.
- Autopilot **notifications**: a prominent, clearly-marked notice at three events — a gate item
  QUEUED for approval, a BLOCKED pause, and a terminal DONE/cap — gated by `features.notifications`
  (default `on`).
- `skills/dev-team-docs/SKILL.md` (+ references): new skill to generate, maintain, and audit a
  project's documentation, verified against the actual source rather than taken on trust.
- `skills/dev-team-migrate/SKILL.md` (+ references): new skill for safe, staged LARGE-SCALE
  migrations (framework/language/dependency majors, schema migrations, API/interface ports) —
  pins current behavior with a characterization-test net before anything moves, then cuts over in
  independently-green, independently-revertible stages (never big-bang by default), gated by an
  approved Migration Plan before any code moves. Owns `MIGRATION.md`.
- `commands/dev-team-config.md`: `/dev-team-config show|init` — print the effective config
  (built-in defaults overlaid with `.dev-team/config.yml`) or scaffold a starter file; never edits
  the file without telling the user.

### Changed

- `hooks/guard-dev-team.sh`: fixed a bypassable git-push-to-main/master detection — it missed
  `HEAD:main`, `+main` (force via refspec), `git -C <dir> push`, a quoted `"main"`, and trailing
  punctuation. Now tokenizes around refspec/quote separators so `main`/`master` must match as a
  whole token.
- `.github/workflows/plugin-audit.yml`: added least-privilege `permissions: contents: read` and
  pinned `actions/checkout` to a verified SHA (`v4.2.2`).
- `dev-team-ci-medic` (SKILL + triage + remediation) + `/dev-team-watch-prs` +
  `/dev-team-sync-branches`: three non-negotiable untrusted-input rules — no shell interpolation of
  `gh`/`git` names (allowlist `^[A-Za-z0-9._/-]+$`), CI logs/PR text are treated as DATA, never
  instructions (prompt-injection defense), and untrusted-code-execution gating on
  reproduce-locally / `pr=<n>` (fork PRs are analyzed from logs/diffs only).
- `issue-sync-protocol.md` + `/dev-team-sync-issues`: shell-safety (ledger free-text is written via
  `--body-file`, never string-interpolated into a `gh` command) and a security-finding disclosure
  control — `F-` items are opt-in only (`issues=sync-security`) and redacted to
  title/severity/CWE/location, never the evidence/PoC field.
- `dev-team-autopilot/references/loop-runtime.md`: `models=max` never auto-tightens (only
  `balanced` steps down toward `economy`) — removes a contradiction with `model-routing.md`'s
  verification-tier invariant.
- `skills/dev-team-orchestrator/references/orchestration-profiles.md`: replaced lingering
  versioned/dated model ids with bare tier aliases — drift the model-id audit didn't catch because
  it only enforces the roster file.

## [1.1.0] - 2026-07-03

### Added

- Full four-tier agent roster shipped from the plugin root at `agents/`: `deep-architect`
  (Fable, reasoning), `opus-builder` (Opus, build/verify — the default worker and the
  home for all verification roles), `sonnet-scribe` (Sonnet, documentarian), and
  `quick-edits` (Haiku, mechanical). Previously only `deep-architect` and `quick-edits`
  lived under `.claude/agents/`, a location plugin installers do **not** receive — the
  full roster is now actually delivered to users.
- `skills/dev-team-orchestrator/references/model-routing.md`: single source of truth for
  model ids, the tier-to-agent mapping, and the two routing invariants (verification never
  routed cheaper than Opus; plan expensive, execute cheap).
- Execution-spec support in the task brief template: a high tier can now write one dense,
  self-contained brief (exact signatures, files, acceptance criteria, edge cases) that a
  cheaper tier executes without re-deriving context.
- Lean-memory conventions for the documentarian: `## Current status` is always overwritten
  rather than appended, and closed backlog items / superseded decisions are summarized
  instead of accumulated verbatim, so a fresh agent can rehydrate cheaply.
- A `budget` block in autopilot's `.dev-team/autopilot.json` (spawn counts by tier). It is a
  spawn-count trend heuristic, not a credit meter; by default it only informs, and it can
  optionally drive the auto-tighten below (which never touches the verification tier).
- `commands/dev-team.md`, `commands/dev-team-status.md`, `commands/dev-team-approve.md`,
  `commands/dev-team-update.md`: command entrypoints for routing to a skill, viewing a
  read-only run dashboard, resolving a queued autopilot gate, and checking for plugin
  updates.
- `hooks/hooks.json` + `hooks/guard-dev-team.sh`: a scoped, opt-in guardrail hook that
  blocks only unrecoverable Bash actions (push or force-push to main/master, live Stripe
  keys) and only while a dev-team run is active (`.dev-team/autopilot.json` present), or
  when forced on via `DEV_TEAM_GUARD`. Fail-open by design.
- `hooks/check-update.sh`: a SessionStart auto-update notifier — cached for 24h, fail-open,
  silent when the plugin is already current; disable with `DEV_TEAM_NO_UPDATE_CHECK`.
- `/dev-team-sync-branches` + `scripts/branch-hygiene.sh` + `hooks/sync-branches-check.sh`:
  safely align local branches with their remotes. Prunes stale remote-tracking refs and, with
  confirmation, deletes local branches whose remote was merged/deleted — `git branch -d` for
  fully-merged branches and `git branch -D` only for branches whose PR is verified MERGED via
  `gh` (catches squash/rebase-merges). Remote-deleted branches with no merged PR are left alone
  (possible unpushed work); it never pushes or force-deletes unproven work. A network-free
  SessionStart notifier flags cleanup candidates; disable with `DEV_TEAM_NO_BRANCH_CHECK`.
- `.github/workflows/plugin-audit.yml` + `scripts/audit-model-ids.sh`: CI audit (job name
  `audit`, the required-check context) that fails the build if a dated `claude-*` model id
  appears outside the roster, either manifest is invalid JSON, an endpoint agent file is
  missing its `model:` field, or plugin components are misplaced under `.claude/`.
- `skills/dev-team-ship/SKILL.md` (+ references): new skill to take a working repo to a
  shipping one — CI, branch protection/rulesets with byte-for-byte required-check names,
  gitleaks-CLI secret scanning, and a release/versioning flow.
- Cost-posture `models=economy|balanced|max` knob plus a new `sonnet-builder` (Sonnet)
  economy build endpoint — verification stays on `opus-builder` in every posture
  (`model-routing.md`, "Cost posture").
- Autopilot budget auto-tighten (`budget-autotighten`): steps the build tier down one
  notch when frontier spend runs heavy, floored at `economy`, never downgrades
  verification, and surfaces the change in the iteration report.
- `HANDOFF.md`: a derived, always-regenerated one-glance resume card, never a source of
  truth.
- `skills/dev-team-orchestrator/references/orchestration-profiles.md`: optional taste-first
  orchestration profile — recommends a Fable/Opus (top-taste) orchestrator, with optional
  GPT-5.5 offload via Codex for bulk/mechanical grunt work (Claude fallback when Codex isn't
  installed), keeping all user-facing work and verification on Claude taste/frontier tiers.
- `skills/dev-team-ci-medic/SKILL.md` (+ references) and `commands/dev-team-watch-prs.md`:
  new skill to watch this repo's open PRs for failing CI checks and resolve them by class —
  auto-fixing SAFE-AUTO classes (formatters, autofix linters, import-sort, deterministically
  regenerable generated files/lockfiles) once the checker verifies and pushes to the PR
  branch, rerunning FLAKY failures, diagnosing and proposing REAL failures via a gated
  remediation cycle (the test under scrutiny is never edited to make it pass), and reporting
  BLOCKED ones outright. Runs interactively, via `/loop <interval> /dev-team-watch-prs`, or as
  a scheduled routine; only ever pushes to the PR branch it's watching, never `main`, and
  documents the `GITHUB_TOKEN` anti-recursion trap for scheduled/cloud pushes.
- Opt-in GitHub Issue sync (`issues=off|sync` on `dev-team-iterate`/`dev-team-security`/
  `dev-team-featurefind`/`dev-team-review`/`dev-team-autopilot`, plus `/dev-team-sync-issues`):
  exports the suite's ledgers (feature gaps, backlog, security findings, review verdicts,
  gate-deferred items) to GitHub Issues, owned by `sonnet-scribe`. Dedup-safe via a stored
  `issue:` ref plus a hidden `<!-- dev-team:<id> -->` marker, confirm-first on the first sync,
  and close-on-done when an item is resolved/built/verified/merged.

### Changed

- Fixed a stale, hardcoded Sonnet 4.6-era model id that had silently rotted across several
  skill files; all prose now points to the current roster (Sonnet tier / `sonnet-scribe`)
  instead of restating a dated id inline.
- `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`: version bumped to
  `1.1.0`, owner/author set to `MWBM Partners Ltd`, and descriptions rewritten to describe
  the tiered subagent roster (Fable/Opus/Sonnet/Haiku) and list the new `ship` skill.

### Removed

- `.claude/agents/deep-architect.md` and `.claude/agents/quick-edits.md` — superseded by
  the complete roster at `agents/` (plugin root); keeping both would have reintroduced
  drift between a shipped and an unshipped copy.

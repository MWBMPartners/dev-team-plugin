# Changelog

All notable changes to the dev-team plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

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

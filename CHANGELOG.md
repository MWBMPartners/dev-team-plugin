# Changelog

All notable changes to the dev-team plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

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

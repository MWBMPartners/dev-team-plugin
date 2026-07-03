# dev-team

A private Claude Code plugin bundling the **dev-team** skill suite — team-lead / product-owner skills that delegate software work to a tiered team of Claude subagents (Fable / Opus / Sonnet / Haiku — see [Model routing](#model-routing)) instead of coding alone.

## Skills

| Skill | Purpose |
|-------|---------|
| `dev-team-orchestrator` | Build a bounded feature/component/project by delegating to parallel subagents. |
| `dev-team-iterate` | Self-directed improvement loop on an existing codebase (correctness, UX, efficiency). |
| `dev-team-security` | Adversarial security audit + remediation with red-team subagents and PoC evidence. |
| `dev-team-review` | Independent QA/verification pass that proves prior dev-team claims with fresh evidence. |
| `dev-team-featurefind` | Competitive feature-gap analysis producing a scored `FEATURES.md` ledger. |
| `dev-team-autopilot` | Autonomous, self-paced `/loop` drive of the whole suite to production-ready. |
| `dev-team-stripe` | Stripe/payments build + review with payments-specific correctness/security rules. |
| `dev-team-ship` | Take a working repo to a shipping one — CI, branch protection, secret scanning, releases. |
| `dev-team-ci-medic` | Watch this repo's open PRs for failing CI checks and resolve them by class — auto-fix safe ones, propose the rest. |

### Which skill when

A quick decision guide — pick the first row that fits:

| If you want to… | Use | Notes |
|---|---|---|
| Build something new from a goal/spec (a feature, component, or whole project) | `dev-team-orchestrator` | The hub skill; everything else assumes you've read its `SKILL.md` first. |
| Polish/harden an existing codebase with no fixed spec ("make it better") | `dev-team-iterate` | Self-directed loop over correctness/UX/efficiency; reuses the Codebase Map for cheap re-runs. |
| Get an adversarial security pass with real exploit evidence | `dev-team-security` | Red-team subagents + remediation; writes `SECURITY.md`. |
| Independently verify claims a prior run made ("did it actually work?") | `dev-team-review` | Fresh evidence only — never rubber-stamps prior output; writes `VERIFICATION.md`. |
| See what competitors have that you don't | `dev-team-featurefind` | Produces a scored `FEATURES.md` gap ledger. |
| Build or audit Stripe/payments code | `dev-team-stripe` | Payments-specific correctness + security checklist on top of the standard build/review cycle. |
| Get CI, branch protection, secret scanning, and a release flow in place | `dev-team-ship` | `setup` mode from scratch, or `audit` mode to catch drift/orphaned checks in an existing pipeline. |
| Watch open PRs and clear up failing CI checks | `dev-team-ci-medic` | Auto-fixes SAFE-AUTO classes (lint/format) once the checker verifies; proposes real failures via a gated remediation cycle; never games tests or pushes to `main`. |
| Drive all the way to production-ready with no babysitting | `dev-team-autopilot` | Fires the whole suite autonomously; run it via `/loop dev-team-autopilot <mission>`, not directly. |

Unsure, or your request doesn't map cleanly onto one row? Run `/dev-team` — it asks one clarifying question and routes you.

## Artifacts glossary

The suite communicates through a small set of plain files it reads and writes in your repo (its "external memory," so a fresh agent can resume cold):

| Artifact | Written by | Purpose |
|---|---|---|
| `PROJECT.md` | `sonnet-scribe` | Goal, definition of done, decisions, and a tight, always-overwritten `Current status` — the single next action + where to look. |
| `FEATURES.md` | `sonnet-scribe` | Scored feature/gap ledger from `dev-team-featurefind` (and proposed-features backlog from other runs). |
| `SECURITY.md` | `sonnet-scribe` | Findings + remediation record from `dev-team-security`. |
| `VERIFICATION.md` | `sonnet-scribe` | Independent QA evidence from `dev-team-review`. |
| `.dev-team/autopilot.json` | `sonnet-scribe` | Autopilot run state: mission, phase, cycle count/cap, gate ledger (`G-` items), lock/lease, and an informational `budget` block (spawns per model tier — a trend indicator, never an auto-actuator). |
| `skills/dev-team-orchestrator/references/model-routing.md` | (static reference) | The roster — which endpoint agent/model tier handles which kind of work. See below. |

`HANDOFF.md` (see [Cost posture](#cost-posture) below) is a derived, always-overwritten one-glance resume card regenerated from `PROJECT.md#Current status`, which remains the source of truth it's built from.

## Model routing

Claude Code has no automatic per-task model router — the only thing that actually binds a model to work is a named agent's frontmatter `model:` field. So "routing" here means **steer-and-bias**: the lead chooses which of the four endpoint agents to spawn (`subagent_type`) for each workstream — `deep-architect` (Fable, hard reasoning), `opus-builder` (Opus, the default build/verify workhorse — and where ALL verification stays, never routed cheaper), `sonnet-scribe` (Sonnet, the documentarian), or `quick-edits` (Haiku, mechanical work) — guided by each agent's `description` and by the roster.

The suite also follows **plan expensive, execute cheap**: a higher tier (Fable/Opus, or the lead) writes a dense, self-contained execution spec once — exact signatures, target files, acceptance criteria, edge cases — and a cheaper tier executes it without re-deriving context, so you pay for reasoning once and amortize it across cheap execution.

Full routing table, model ids/aliases, and both invariants (verification never cheapens; plan expensive/execute cheap) live in one place: [`skills/dev-team-orchestrator/references/model-routing.md`](skills/dev-team-orchestrator/references/model-routing.md) — every skill points here instead of restating a model name inline.

## Cost posture

Any skill that takes arguments also accepts a run-level `models=economy|balanced|max` cost-posture knob (or plain language, e.g. "keep costs down" → `economy`); default is `balanced`. `economy` moves build/scout work to the new `sonnet-builder` (Sonnet) endpoint — but verification (checker/red-team/validator/reviewer) always stays on `opus-builder` (Opus), in every posture, no exceptions. `dev-team-autopilot` can auto-tighten this on its own: `budget-autotighten` steps the posture down one notch (floored at `economy`) when frontier (Fable+Opus) spend runs heavy for a cycle, surfaces the change in its iteration report line, and never touches the verification tier — it's a heuristic based on spawn counts, not a billing figure. See the full remap table and both invariants in [`model-routing.md`](skills/dev-team-orchestrator/references/model-routing.md#cost-posture--the-models-knob-optional).

`HANDOFF.md` is the one-glance card this posture data (and everything else in `PROJECT.md#Current status`) rolls up into: a derived, always-overwritten resume card that `sonnet-scribe` regenerates at each checkpoint — never a source of truth, and never hand-maintained.

## Commands

| Command | What it does |
|---|---|
| `/dev-team [what you want to do]` | Entry point/router — explains which skill fits and kicks it off, or asks one clarifying question. |
| `/dev-team-status` | Read-only dashboard of the current run: mission, phase, next action, gate ledger, budget trend — changes nothing on disk. |
| `/dev-team-approve <gate-id> approve\|reject [notes]` | Resolves a queued autopilot gate-ledger item (a deferred feature/dependency/architecture decision) so the next iteration builds or skips it. |
| `/dev-team-update` | Checks whether a newer plugin version is available and prints the exact update commands. |
| `/dev-team-sync-branches [--apply] [--no-fetch]` | Safely aligns local branches with their remotes — prunes stale remote-tracking refs and deletes local branches whose remote was merged/deleted, confirm-first. Never touches unpushed or unmerged work. |
| `/dev-team-watch-prs [pr=<n>] [autofix=safe\|off]` | Watches this repo's open PRs for failing CI checks and resolves them safely — auto-fixes safe classes (lint/format), proposes the rest. Loopable via `/loop`. |

## Branch hygiene

`/dev-team-sync-branches` keeps your local branches aligned with GitHub without risking work. It `git fetch --prune`es, then buckets local branches: **fully merged** (deleted with `git branch -d`), **remote-deleted with a confirmed-merged PR** (squash/rebase — force-deleted only after the merge is verified via `gh`), and **remote-deleted but no merged PR found** — which it **leaves alone** (that may be unpushed work). It shows the plan and waits for your confirmation before deleting anything; it never pushes, never deletes remote branches, and never force-deletes unproven work.

A SessionStart notifier (`hooks/sync-branches-check.sh`) flags, at session start, how many local branches have a deleted upstream — network-free, fail-open, silent when there's nothing to clean, and it deletes nothing. Disable it with `export DEV_TEAM_NO_BRANCH_CHECK=1`.

The non-destructive half is native to git — enable it yourself so stale remote-tracking refs prune automatically (and the notifier stays accurate): `git config --global fetch.prune true`.

## PR monitoring (CI medic)

`/dev-team-watch-prs` watches this repo's open PRs for failing CI checks and resolves each failure by class: **SAFE-AUTO** (a formatter diff, an autofix-capable linter, import-sort, a deterministically-regenerable generated file/lockfile) is fixed, verified by the checker, and pushed to the PR's own head branch; **FLAKY** gets a `gh run rerun --failed` and is re-evaluated; **REAL** (a genuine test/type/build/logic failure) is diagnosed and a concrete fix is proposed — built only on confirmation via a gated remediation cycle, and the test itself is never edited to make it pass; **BLOCKED** (missing secret, runner/infra error, permissions, outage) is reported as not code-fixable. It only ever pushes to the PR branch it's watching, never `main`/`master`, and only touches PRs in this repo that you own unless you opt in per PR.

Run it interactively, loop it (`/loop <interval> /dev-team-watch-prs`), or hand it to a scheduled routine (`/schedule`). A scheduled/cloud routine that pushes with the default `GITHUB_TOKEN` will **not** re-trigger downstream CI on its own push — the same anti-recursion trap `dev-team-ship` documents — so bridge it with a PAT-backed push or a follow-up `gh workflow run` re-dispatch.

See `skills/dev-team-ci-medic/SKILL.md` for the full classification rubric and remediation protocol.

## Install (private)

This is a private marketplace repo under the **MWBMPartners** org — only org members (or collaborators) with read access can install.

```text
/plugin marketplace add MWBMPartners/dev-team-plugin
/plugin install dev-team@dev-team
```

## Updating / auto-update

There are two layers — use the first; the second exists so you're never caught unaware if you haven't.

**1. Built-in marketplace auto-update (primary).** Claude Code can auto-update a plugin at the marketplace level. Turn it on either way:

- **`/plugin` UI:** Marketplaces tab → select `dev-team` → **Enable auto-update**. Updates then download at startup with no commands needed.
- **Managed `settings.json`** — add this snippet:

```json
{
  "extraKnownMarketplaces": {
    "dev-team": {
      "source": { "source": "github", "repo": "MWBMPartners/dev-team-plugin" },
      "autoUpdate": true
    }
  }
}
```

Two global env vars affect this: `DISABLE_AUTOUPDATER=1` turns off Claude Code auto-updates entirely (including plugins); `FORCE_AUTOUPDATE_PLUGINS=1` keeps plugin updates going even if Claude Code's own auto-update is otherwise disabled.

If auto-update is off, update manually after pulling/whenever a new version ships:

```text
/plugin marketplace update dev-team
/plugin update dev-team
```

**2. SessionStart notifier (fallback).** A hook checks, at session start, whether a newer version exists — cached for 24h, silent when you're current, and it never runs an update itself (only prints a `systemMessage` with the two commands above). It needs `gh` authenticated against this private repo to reach the network at all; if that's unavailable it just stays quiet. Disable it with:

```text
export DEV_TEAM_NO_UPDATE_CHECK=1
```

Or check on demand any time with `/dev-team-update`, which also summarizes what's new from `CHANGELOG.md` when reachable.

## Hooks (optional guardrails)

The plugin ships one opt-in-by-scope safety hook (`hooks/guard-dev-team.sh`, `PreToolUse`/`Bash`). It's a best-effort string-match layer, not a security boundary, and it's **fail-open**: any error, or no active dev-team run, and it allows the command. It only engages while `.dev-team/autopilot.json` exists (i.e. an autopilot run is active), blocking a short deny-list of unrecoverable actions — pushes/force-pushes to `main`/`master`, and live (`sk_live_`/`rk_live_`/`pk_live_`) Stripe keys, since dev-team is test-mode only.

To force the guard on even outside an active run:

```text
export DEV_TEAM_GUARD=1
```

## Privacy

Distribution is controlled by GitHub access to the **MWBMPartners** org repo — org members (and any teams/collaborators granted read) can install; nobody else can.
Skill files are plaintext — keep secrets (API keys, tokens) out of them.

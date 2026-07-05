---
description: Entry point and router for the dev-team skill suite — explains which skill to use and kicks off the right one.
argument-hint: [what you want to do]
---
The user invoked the dev-team router. Their request: $ARGUMENTS

Route them to the right skill (activate it by following its SKILL.md), or if unclear, show the map and ask ONE clarifying question:
- Build a specific feature/project from a goal → dev-team-orchestrator
- Improve/polish/harden an existing codebase (no fixed spec) → dev-team-iterate
- Adversarial security audit → dev-team-security
- Independent QA / verify prior claims → dev-team-review
- Competitor feature-gap analysis → dev-team-featurefind
- Stripe / payments build or audit → dev-team-stripe
- Set up CI/CD, branch protection, secret scanning, releases → dev-team-ship
- Watch open PRs and safely resolve failing CI checks → dev-team-ci-medic (fire via `/dev-team-watch-prs`)
- Drive all the way to production-ready, autonomously → dev-team-autopilot (fire via `/loop dev-team-autopilot <mission>`)
- Generate/maintain/audit project documentation, verified against source → dev-team-docs
- Safe staged framework/dependency/schema migration ("migrate from X to Y", "upgrade to <major>", "cutover") → dev-team-migrate

Also: `/dev-team-status` shows a live run dashboard; `/dev-team-approve <G-id> approve|reject` resolves a queued gate item; `/dev-team-update` checks for a newer plugin version; `/dev-team-sync-branches` safely prunes local branches whose remote was merged/deleted; `/dev-team-watch-prs` runs one CI-medic watch pass over this repo's open PRs (loopable); `/dev-team-sync-issues` exports the suite's ledgers (feature gaps, backlog, security findings, review verdicts, gate items) to GitHub Issues, opt-in and dedup-safe; `/dev-team-config show|init` prints the effective repo config or scaffolds a starter `.dev-team/config.yml`; `/dev-team-report [branch=<base>]` prints a read-only run report (phases, cycles, commits, agents by tier, a rough cost estimate) on demand.
If the request clearly matches one skill, name it and proceed; otherwise ask one question.

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
- Drive all the way to production-ready, autonomously → dev-team-autopilot (fire via `/loop dev-team-autopilot <mission>`)

Also: `/dev-team-status` shows a live run dashboard; `/dev-team-approve <G-id> approve|reject` resolves a queued gate item; `/dev-team-update` checks for a newer plugin version.
If the request clearly matches one skill, name it and proceed; otherwise ask one question.

# dev-team

A private Claude Code plugin bundling the **dev-team** skill suite — team-lead / product-owner skills that delegate software work to a team of Opus 4.8 subagents instead of coding alone.

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

## Install (private)

This is a private marketplace repo under the **MWBMPartners** org — only org members (or collaborators) with read access can install.

```
/plugin marketplace add MWBMPartners/dev-team-plugin
/plugin install dev-team@dev-team
```

To update later, after pulling new commits:

```
/plugin marketplace update dev-team
/plugin update dev-team
```

## Privacy

Distribution is controlled by GitHub access to the **MWBMPartners** org repo — org members (and any teams/collaborators granted read) can install; nobody else can.
Skill files are plaintext — keep secrets (API keys, tokens) out of them.

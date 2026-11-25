# Destructive actions and approval

Every kind of action has one of five levels (`engine/data/destructive-actions.json`):

| Level | Meaning | Autopilot bucket |
|---|---|---|
| AUTO | just do it (reading, editing, running tests, local commits) | 1 |
| REQUIRE_HIGH_CONFIDENCE | only if the agent is confident AND a deterministic check passed (installing a dependency, pushing the run branch) | 1, otherwise 2 |
| REQUIRE_REVIEW | only after an independent review has verified it (deleting files, changing a schema) | 2 until verified |
| REQUIRE_HUMAN_APPROVAL | only with the owner's yes (deploying, merging, applying a migration, using a secret) | 3 |
| PROHIBITED | never: pushing to the default branch, force-pushing, live Stripe actions, switching off a safety guard | refused |

A kind of action not in the table is treated as needing the owner's approval. A policy pack may raise a level; it can
never lower one. `engine.sh gate check --action KIND` answers, and exits 1 for a prohibited action even when every
approval is given. This table is the engine's answer; the Bash guard hook remains a separate safety net.

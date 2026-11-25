# How `route` decides

`route --request-file <json>` takes `role` (scout, builder, architect, reviewer, mechanical, documentarian) and,
optionally, `taskTypes` (see [tiers-and-floors.md](tiers-and-floors.md)), `risk`, `providers`, `approved`,
`exhausted`, `builtBy`, `order`, `minTier`, `complex`, `escalateEffort`. It returns the chosen model, why, the effort,
what was held back for approval, alternatives, warnings and questions, and saves a **decision record** (id like
`d-0123456789ab`, plus an `inputsHash` that is the same for the same inputs) in the engine's data folder.
`explain --decision <id>` reads one back as three sentences; `dry-run --phases-file <json>` shows what would
happen for a list of phases, with the questions the owner should answer first.

Settings come from `.dev-team/config.yml` (`routing:` and `profile:`), a per-computer file
(`~/.dev-team/device.yml`) and the request; anything ambiguous stops routing instead of being guessed.
Details of each setting: `skills/dev-team-orchestrator/references/model-routing.md`.

---
description: Explain, in three plain sentences, why the dev-team engine chose a particular model for a job. Read-only.
argument-hint: <decision-id>
---
Explain one routing decision. Arguments: $ARGUMENTS (the decision id the engine printed, which looks like `d-0123456789ab`).

1. Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/engine.sh explain --decision $ARGUMENTS --format text`.
2. If it exits with code 3 (the engine is not available here), say so and that decisions are then made from the tables in `model-routing.md`, which carry no saved record.
3. If it exits with code 4, say no decision with that id was found on this machine (records are kept per machine, not in the project).
4. Otherwise show the three sentences, and add the model's held-back alternatives if the answer names any.

This command changes nothing.

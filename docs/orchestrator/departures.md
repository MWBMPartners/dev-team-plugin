# Departures from the plan

Where the build differs from `.claude/plans/orchestrator-v2/plan.md`, and why. Each is a choice made on
17 November 2026 while building.

| # | Departure | Why |
|---|---|---|
| DEP-A | Routing settings (`routing:`, `profile:`) are read from `.dev-team/config.yml`, not only from `orchestrator.json`. | The owner asked for them as user-facing settings. `orchestrator.json` is not built yet. |
| DEP-B | The config reader is a small hand-written YAML subset reader, and it fails closed (stops routing) on anything under `routing:` it cannot understand. | The plugin allows no outside libraries. Seventeen review rounds showed how many edge cases a hand-written reader has; do not extend it, use a real parser if more is needed. |
| DEP-C | Each adapter is one file (`engine/adapters/<id>.mjs`), not three (provider, runtime, quota). | Less to keep in step. The quota part arrives with increment 4. |
| DEP-D | Seed catalogue entries for providers other than Claude are role-level placeholders marked unverified, with no real model ids. | No such provider was tried; the audit also forbids dated ids outside the roster. |
| DEP-E | The `route` command takes `providers` and `exhausted` lists in its request instead of reading live quota. | Quota reading belongs to increment 4. |
| DEP-F | The ledger guard's file-name list was not widened for the engine's own files (`job.json`, `plan-contract.*.json` and so on). | Those files first appear in increment 3; the guard is widened then. |
| DEP-G | The example in `skills/dev-team-autopilot/references/loop-runtime.md` still has `//` comments, so it cannot itself be validated. A comment-free copy (`tests/fixtures/autopilot.sample.json`) is checked against `schemas/autopilot.schema.json` instead. | That example is a pinned wording checked word for word by the tests. |
| DEP-H | The model-id audit was not widened to other providers' id shapes. | It would need thirteen prose rewrites; deferred. |

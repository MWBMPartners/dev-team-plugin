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
| DEP-I | The plan's floors table gives ACCESSIBILITY_REVIEW a minimum of tier 2 at normal risk, contradicting its statement that every review is at least tier 3 at normal risk or above. The engine follows the statement: a reviewer role is never below tier 3 at normal risk or above. | Checking work never goes below tier 3. |
| DEP-J | Tier 0 ("no AI model needed") is returned only for test runs, static analysis and build checks. Other work the table rates at tier 0 still uses the weakest model. | A script cannot do an arbitrary mechanical edit. |
| DEP-K | The skills and references still say `opus-builder`, `sonnet-builder`, `sonnet-scribe`, `quick-edits` and `deep-architect` in about a hundred places; they were not reworded to the new role names, and no test keeps the old names out. | The old names work as deprecated aliases until 2.1.0, and rewording that much pinned text is riskier than the benefit now. The mapping is in `model-routing.md`. |
| DEP-L | The mechanical role maps to `engineer` (or `engineer-high`), not to `scout`, and a scout always uses the read-only `scout` file. | The scout file cannot edit, and mechanical edits must. |

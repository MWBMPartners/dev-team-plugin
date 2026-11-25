# Adding a provider

1. Copy `engine/adapters/unverified.mjs` to `engine/adapters/<id>.mjs` (or write one like `codex.mjs`) and fill in
   `discoverModels` (never throws; return an empty list with a reason when it cannot find any) and
   `normaliseProfile` (use `makeProfile`; leave UNKNOWN what you do not know).
2. Add it to the list in `engine/adapters/index.mjs`. Nothing in routing changes.
3. Mark `verified: false` until it has been tried against a real account. Add a data file under
   `engine/data/runtimes/` and its schema entry in `schemas/manifest.json`.
4. Add a scenario under `engine/sim/scenarios/` and run `bash scripts/engine.sh sim run --all`.

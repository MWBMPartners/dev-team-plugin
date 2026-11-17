# Engine commands and exit codes

Run every command through the launcher: `bash scripts/engine.sh <command> [subcommand] [--flags]`.
Each prints one JSON answer (add `--format text` for a short reading):
`{"engine": {"version", "command"}, "ok", "result", "problems": []}`.

| Exit code | Meaning |
|---|---|
| 0 | Done; `result` is the answer. |
| 1 | A "no" that is itself the answer (nothing suitable, a model needs approval, a pin cannot be met). |
| 2 | Bad input: unknown command, bad flags, a file that fails its schema. |
| 3 | The engine is not available here (no Node 22, or `DEV_TEAM_NO_ENGINE` is set). The plugin carries on as 1.x. |
| 4 | The state does not allow it (something is already held, not found). |
| 5 | A check of a signature, fingerprint or snapshot failed. |

| Command | What it does | Built |
|---|---|---|
| `doctor` | Which tools are present, where the engine keeps its files, and what the plugin does without the missing ones. Read-only. | yes |
| `schema validate [--all \| --file F --schema S]` | Checks JSON files against their schemas; `--all` checks every pair in `schemas/manifest.json`. | yes |
| `discover [--refresh] [--provider R]` | Asks each adapter (Claude Code, Codex, and the unverified ones) which models exist, writes complete profiles and a saved list per runtime, and reports models that disappeared and failures. See [discovery.md](discovery.md). | yes |
| `discover --local` | Asks a local Ollama install which models it has (new models need no plugin update). Their strength is a guess from the name's size, marked as a guess. | yes |
| `sim run --scenario N \| --all` | Runs a scripted test of discovery with pretend providers and a pretend clock. | yes |
| `config show [--project D] [--order O]` | The effective routing settings, and which source decided where work starts. | yes |
| `config device-set --order local-first\|cloud-first` | Saves this computer's own default, in `~/.dev-team/device.yml` (outside every project). | yes |
| `route --request-file F` | Picks a model for one job and says why. Needs `role`; optional `risk` (LOW, NORMAL, HIGH), `complex`, `providers`, `approved`, `exhausted` (each a list of names), `builtBy`, `order`, `taskTypes` (kinds of task, see [tiers-and-floors.md](tiers-and-floors.md)), `escalateEffort`, `minTier` (1 to 4; raises the strength needed, which is how an approved tier-4 model is reached). Exit 1 with `NEEDS_APPROVAL`, `PIN_UNAVAILABLE`, `PIN_INVALID` (a pin in the config is empty or not plain text), `SETTINGS_INVALID` (a routing setting is ambiguous, repeated or malformed: the engine stops and asks rather than guess) or `NO_SUITABLE_AGENT_AVAILABLE`. The answer holds `decision` (`provider`, `model`, `exactId`, `tier`, `local`, `costBand`, `independence`, `spawn`), `reasons`, `heldBack`, `alternatives` (each `{model, provider, exactId}`), `warnings` and `questions`. When `exactId` is not null, pass it when starting the worker, or stop and say the tool cannot. | yes |
| `explain --decision ID` | Three plain sentences on why a model was chosen. Exit 4 when no such decision is saved on this machine. | yes |
| `dry-run --phases-file F` | What would happen for a list of planned phases (model, effort, held back) plus the owner's questions, each with why. Cost and quota columns say "available after increment 7". | yes |

How `route` decides (details: [routing.md](routing.md)): strength is a tier (1 utility to 4 principal), never a model name; checking work is never below tier 3; the cheapest qualifying model wins and tier 4 is never the default; models on the ask-first list are held back until approved (local models never are); a pin is carried through exactly or the job stops and asks; local-first or cloud-first only changes the order tried, never the strength needed. The starting catalogue is `engine/data/catalogue.seed.json`; every provider except Claude and Codex review is unverified.

More commands (`route`, `explain`, `discover`, jobs, leases, snapshots and the rest) are listed in the
plan, section 2.3, and are added as each increment is built.

Machine-local files live in `CLAUDE_PLUGIN_DATA`, or `DEV_TEAM_DATA_DIR`, or `~/.dev-team/data` (with one
warning). Nothing machine-local is ever written inside a project.

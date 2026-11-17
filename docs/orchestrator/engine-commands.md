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

More commands (`route`, `explain`, `discover`, jobs, leases, snapshots and the rest) are listed in the
plan, section 2.3, and are added as each increment is built.

Machine-local files live in `CLAUDE_PLUGIN_DATA`, or `DEV_TEAM_DATA_DIR`, or `~/.dev-team/data` (with one
warning). Nothing machine-local is ever written inside a project.

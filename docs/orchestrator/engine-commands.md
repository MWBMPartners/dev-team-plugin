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
| `route --request-file F` | Picks a model for one job and says why. Needs `role`; optional `risk` (LOW, NORMAL, HIGH, CRITICAL), `complex`, `providers`, `approved`, `exhausted` (each a list of names), `builtBy`, `order`, `taskTypes` (kinds of task, see [tiers-and-floors.md](tiers-and-floors.md)), `escalateEffort`, `minTier` (1 to 4; raises the strength needed, which is how an approved tier-4 model is reached). Exit 1 with `NEEDS_APPROVAL`, `PIN_UNAVAILABLE`, `PIN_INVALID` (a pin in the config is empty or not plain text), `SETTINGS_INVALID` (a routing setting is ambiguous, repeated or malformed: the engine stops and asks rather than guess) or `NO_SUITABLE_AGENT_AVAILABLE`. The answer holds `decision` (`provider`, `model`, `exactId`, `tier`, `local`, `costBand`, `independence`, `spawn`), `reasons`, `heldBack`, `alternatives` (each `{model, provider, exactId}`), `warnings` and `questions`. When `exactId` is not null, pass it when starting the worker, or stop and say the tool cannot. | yes |
| `explain --decision ID` | Three plain sentences on why a model was chosen. Exit 4 when no such decision is saved on this machine. | yes |
| `dry-run --phases-file F` | What would happen for a list of planned phases (model, effort, held back) plus the owner's questions, each with why. Cost and quota columns say "available after increment 7". | yes |
| `docs check [--project D]` | Read-only: does `.dev-team/PROJECT.md` have goals, requirements and prerequisites, plan and status sections (standing rule 13)? Each missing piece is a finding. | yes |
| `docs check --api [--project D]` | Read-only: if the project has an OpenAPI description, is there a Swagger UI page, and is the spec old (standing rule 15)? | yes |
| `plan draft --file C --id ID --out P [--version N --supersedes M]` | Makes an unlocked plan file from a contract; a change to a locked plan is a new version that supersedes the old one. | yes |
| `plan lock --file P --approver NAME` | Locks a plan with the owner's approval; exit 4 if already locked. | yes |
| `plan verify --file P` | Checks a plan's fingerprint (works on any path, including this project's hand-locked plan); exit 5 if a locked plan was edited. | yes |
| `plan diff --a P1 --b P2` | Lists which sections of the contract changed. | yes |
| `drift --input F` | NO_DRIFT, MINOR, SIGNIFICANT or ARCHITECTURAL from the changed files; exit 1 means STOP and go back to planning. | yes |
| `evidence check --input F` | Whether a task may be called complete: failed or missing results, open blocking findings, unproven criteria, a changed plan. Exit 1 if not. A model's own "confident" never counts. | yes |
| `attempt record --state-file F --outcome SUCCESS\|FAIL --progress-made true\|false` | Bounded retries: three failures or two with no progress stop with exit 1 `ATTEMPT_CAP_REACHED`; `--escalated` allows one more. | yes |
| `job init --template normal\|small-task\|critical --request TEXT [--issue N] [--project D]` | Starts a job from a template and saves it in `.dev-team/jobs/<id>/job.json` (committed with the project, so any machine or assistant can resume). | yes |
| `job status --job ID` / `job record --job ID --phase P --status S [--note T]` | Reads a job, or moves a phase along PENDING, IN_PROGRESS, DONE or BLOCKED (only allowed steps; exit 4 otherwise). | yes |
| `checkpoint create --job ID --phase P --kind K` / `checkpoint verify --job ID` | Ties a checkpoint to the current git commit; verify exits 5 if a checkpoint's commit no longer exists. | yes |
| `report --job ID --progress` | The progress table: one row per phase with status, checkpoints and note. | yes |
| `quota observe --provider P (--file F \| --stdin)` / `quota status` | Reads a "usage limit reached" message: the cause (session, weekly, one model family, spend), the scope, and the reset time taken only from the message (never invented). `status` lists every provider's latest observation. Message wording is unconfirmed against real accounts. | yes |
| `lease acquire\|heartbeat\|pause\|resume\|reclaim\|release\|status --job J --phase P --provider X --model M --runtime R --role ROLE` | A lease keeps a phase with one agent. `pause` only with a known reset within 12 hours (and takes a work snapshot); `resume` only by the same owner; `reclaim` of a stale lease takes a snapshot first; a paused lease is never reclaimed. Exit 4 on conflicts (`STALE_LOCK` says a snapshot is needed). | yes |
| `snapshot create\|restore\|list\|prune --job J --phase P` | A hidden git commit of the work in progress, new files included, under `refs/dev-team/` (never pushed). A secret-like value stops it (exit 5). `restore` refuses if HEAD moved (exit 4). | yes |
| `fallback --input F` / `takeover --input F` | The replacement list (same provider equal or stronger first, then another provider, never weaker) and the mid-phase takeover decision (retired agents always replaced; a long wait only if the switch is on; review strengthened). | yes |
| `review plan --input F` | Builds the reviewer's brief (a fresh-context "review contract": plan, files, invariants, specialists, an adversarial pass at high risk) and picks the reviewer so the checker is never the builder: a different provider first, then the same provider's other model, then the same model with a fresh agent, recording how independent it was. Models on the ask-first list are skipped unless approved. Exit 1 `NO_REVIEWER_AVAILABLE` when none qualifies. | yes |
| `findings add\|update\|precision --state-file F` | The life of a reported problem: stable ids, only allowed steps (OPEN to ACCEPTED, REJECTED, FALSE_POSITIVE or DEFERRED; ACCEPTED to FIXED; FIXED to VERIFIED), the raiser cannot verify their own finding, a verified one is re-opened only with new evidence, and per-reviewer counters of how often they were right. | yes |
| `gate check --action KIND [--confident --deterministic-pass --review-verified --human-approved] [--pack id,id]` | How careful to be before an action (five levels, see [destructive-actions.md](destructive-actions.md)) and which autopilot bucket it lands in. Exit 1 for a prohibited action, whatever approvals are given. Unknown actions need the owner's approval. | yes |
| `packs list` / `packs show --id ID` | The ten policy packs (see [policy-packs.md](policy-packs.md)). A pack that tries to lower a gate is refused as invalid. | yes |
| `invariants collect\|show [--project D] [--pack id,id]` | Collects the rules a project says must always hold from its own instruction files (also `.OpenAI/`) and from packs; `collect` writes `.dev-team/invariants.json`. Files are only read; example code in fences is ignored; secret-like text is redacted. | yes |
| `budget check --input F` | Either a phase budget (`limit` and `spent` in tokens, credits or money: warns at 80%, exit 1 at the limit) or a reserve check (`remainingPercent`, `tier`, `taskTypes`: exit 1 when the last 25% of the strongest model is kept for planning, security, hard debugging and final review). An unknown allowance applies no reserve and shows no number. | yes |
| `estimate --input F` | LOW, LIKELY and HIGH relative cost for the task types and a model price band. Always says "an estimate, not a bill". After 10 local history records for a kind of task, the history replaces the built-in guess. | yes |

`route` also accepts `quotaRemaining` (provider to a percentage, or null when not known) and `reserves`; `dry-run` shows the cost band and the allowance pressure per phase.
| `catalogue verify --file F [--key K]` / `catalogue fetch [--url U] [--refresh]` | Checks a signed catalogue file (exit 5 if it fails; it is then ignored, never used unsigned), or fetches one over https (does nothing without an address; keeps a good copy 24 hours). The pinned key is a placeholder today. See [remote-catalogue-contract.md](remote-catalogue-contract.md). | yes |
| `push check --branch B [--default-branch D] [--checker-cleared --confident --deterministic-pass] [--project D]` | Whether the plugin may push after a task. Off unless `git.push-after-task: on`; then only the run branch, only a checker-cleared commit with confidence and a passing deterministic check; never the default branch, never a force. Exit 1 when not allowed. | yes |
| `learn record --input F` / `learn query --provider P --model M --task-type T [--project KEY]` / `learn purge` | Local-only learning: a fixed short list of fields, each with a strict shape (no code, prompts, diffs, paths or free text; the time must be an exact UTC date-time and not in the future; an identical record is stored only once; there is no rate limit yet, which is a known gap). Stage thresholds count only results since the last stage change, so reaching TRUSTED from NEW takes about 38 results, one file a month under the engine's data folder. `query` gives a competency score only with enough results (5 in the project, 10 anywhere), with a 30-day half-life; otherwise `null` (neutral). `DEV_TEAM_NO_LEARNING=1` switches recording off; `purge` deletes it all. Not yet used by `route`. | yes |
| `canary evaluate --input F` | How far a model is trusted (input: `current`, `results` newest last as true/false, `sinceChange` = how many of the oldest results were gathered before the last stage change, so evidence is never spent twice): promoted one stage on evidence (NEW, PROVISIONAL, CANARY, VALIDATED, TRUSTED), demoted after repeated failure; the owner's override always wins. Not yet used by `route`. | yes |
| `health status --input F` | UNKNOWN, HEALTHY, DEGRADED, BROWNOUT or DOWN from recent latency, error and dropped-session signals. A started phase stays with its agent whatever this says. | yes |

How `route` decides (details: [routing.md](routing.md)): strength is a tier (1 utility to 4 principal), never a model name; checking work is never below tier 3; the cheapest qualifying model wins and tier 4 is never the default; models on the ask-first list are held back until approved (local models never are); a pin is carried through exactly or the job stops and asks; local-first or cloud-first only changes the order tried, never the strength needed. The starting catalogue is `engine/data/catalogue.seed.json`; every provider except Claude and Codex review is unverified.

More commands (`route`, `explain`, `discover`, jobs, leases, snapshots and the rest) are listed in the
plan, section 2.3, and are added as each increment is built.

Machine-local files live in `CLAUDE_PLUGIN_DATA`, or `DEV_TEAM_DATA_DIR`, or `~/.dev-team/data` (with one
warning). Nothing machine-local is ever written inside a project.

# Discovery: how the engine learns which models exist

`bash scripts/engine.sh discover [--refresh] [--provider <runtime>]` asks each adapter which models it can
see, writes a complete profile for each, and keeps a saved list per runtime in the engine's data folder
(`catalogue/<runtime>.json`, valid for 24 hours; `--refresh` ignores that). `discover --local` instead
lists models a local Ollama install has.

Every profile has every field; **UNKNOWN** means it is not known, and a `provenance` entry exists only for
a field that was really filled in (`RUNTIME_DISCOVERY` from the tool itself, `COMPAT_DATA` from the
maintained tables in `engine/data/compat/`, `HEURISTIC` from a guess).

| Field | Codex | Claude Code |
|---|---|---|
| model name | the model's `slug` | the alias (`haiku`, `sonnet`, `opus`, `fable`) |
| available | yes only if it is in the live list and `codex login status` succeeds | yes only if `claude auth status --json` says logged in |
| life stage | listed and no successor: ACTIVE; hidden: UNKNOWN (hidden is not retired); has a successor: LEGACY | ACTIVE for every alias in the table |
| context window | `context_window` | UNKNOWN (not recorded) |
| effort levels | `supported_reasoning_levels` | from the table |
| strength tier | a guess from the model-name prefix (`openai-families.json`) | from the table |
| everything else (speed, price, limits) | UNKNOWN | UNKNOWN |

**Things that go wrong, and what happens.** A model that was listed before and is missing now is marked
`RETIRED?` (half sure) the first time and `RETIRED` the second. A tool that is absent, slow or returns
rubbish never replaces a good saved list with an empty one: the old list is kept, marked `stale`, and the
reason is reported. Codex's login file is never opened, and the long prompt text in `codex debug models`
is never kept.

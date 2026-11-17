# Dev-Team Model Routing — the single source of truth

This is the ONLY file in the suite that names concrete model ids or maps work to a model
tier. Every skill and reference points here instead of restating a model id inline. When a
new model ships, edit THIS file (and, only if an id has no working alias, the one agent file
that must pin it) — nothing else. A CI audit (`scripts/audit-model-ids.sh`) fails the build
if a dated `claude-*` id appears anywhere else.

## Why this file exists
Model ids copy-pasted into prose rot. `claude-sonnet-4-6` was hardcoded in six files and
silently went stale (current is `claude-sonnet-5`). Centralizing kills that failure mode:
one edit per model release instead of six that rot together.

## Tier → endpoint agent → model

| Tier | Endpoint agent (spawn via `subagent_type`) | Model alias | Use for |
|---|---|---|---|
| Reasoning | `deep-architect` | `opus` | Architecture, subtle multi-file bugs, algorithm design, concurrency/data-model trade-offs, big cross-cutting refactors, debate advocates. The genuinely hard stuff. |
| Build/Verify | `opus-builder` | `opus` | Building features, scouting, and ALL verification (checker, red-team, validator, reviewer). The default worker. |
| Scribe | `sonnet-scribe` | `sonnet` | Documentarian: `.dev-team/PROJECT.md` / `.dev-team/HANDOFF.md` / `.dev-team/FEATURES.md` / `.dev-team/SECURITY.md` / `.dev-team/VERIFICATION.md` upkeep, ledgers, run records. |
| Mechanical | `quick-edits` | `haiku` | Renames, formatting, import sorting, docstrings, boilerplate, trivial config. |

## Orchestrator tier (the lead)
Model routing above binds SUBAGENTS. The lead/orchestrator is the *session* model, which the
plugin cannot set. For maximum taste, run the session on Opus (or Fable, if you accept the cost): `/model opus` before
you start, or pin it in settings with `{"model":"opus"}`. See `orchestration-profiles.md` for
the optional taste-first profile (top-taste orchestrator + cheap grunt work + optional
GPT-5.5/Codex offload).

GPT-5.5 via Codex is an OPTIONAL external bulk-executor tier for non-user-facing grunt work (see
`orchestration-profiles.md`); it never does user-facing work or primary verification.

## Model ids and aliases (the ONE place concrete ids live)
| Tier | Model | Alias | Dated id (fallback) |
|---|---|---|---|
| Reasoning | Opus 4.8 | `opus` | `claude-opus-4-8` |
| Optional top tier (ask first) | Fable 5 | `fable` | `claude-fable-5` |
| Build/Verify | Opus 4.8 | `opus` | `claude-opus-4-8` |
| Scribe | Sonnet 5 | `sonnet` | `claude-sonnet-5` |
| Mechanical | Haiku 4.5 | `haiku` | `claude-haiku-4-5-20251001` |

Agent files use the ALIAS so they never carry a dated id that can rot. If an alias ever
fails to resolve on a given Claude Code version, pin the dated id from this table in that one
agent file (and only there).

## How routing actually works — steer-and-bias, not auto-select
Claude Code has no automatic per-task model router. The only mechanism that BINDS a model is
a named agent's frontmatter `model:` field. So routing = the lead choosing which endpoint
agent to spawn (`subagent_type`) for each workstream, guided by this table and by each
agent's `description`. Agent descriptions are the durable routing surface — the harness shows
them at spawn time even after the lead's own context is compacted, whereas a table buried in
skill prose is dropped early. Name the endpoint agent explicitly in every brief.

## Invariant 1 — verification stays on the frontier tier
Cost routing may push BUILDERS cheaper, but the checker / red-team / validator / reviewer
stay on `opus-builder` (Opus). They catch every other misroute; cheaping them out is the one
catastrophic move. Never route verification below Opus.

## Invariant 2 — plan expensive, execute cheap
Pay for reasoning once. A Reasoning- or Build-tier agent (or the lead) produces a dense,
self-contained **execution spec** — a brief with exact signatures, target files, acceptance
criteria, and edge cases — that a cheaper tier then executes without re-deriving context. See
`task-brief-template.md` (the "Execution spec" section). This is how "plan with Fable/Opus,
build with Sonnet/Haiku" is realized in the suite.

## Cost posture — the models= knob (optional)
A run-level knob biasing the whole table above: set `models=economy|balanced|max` on any skill
that takes arguments, or use plain language ("keep costs down" → `economy`); default is `balanced`.

| Work | balanced (default) | economy | max |
|---|---|---|---|
| Build / scout | `opus-builder` (Opus) | `sonnet-builder` (Sonnet) | `opus-builder` (Opus) |
| Hard reasoning / debate | `deep-architect` (Opus) | `opus-builder` (Opus) | `deep-architect` (Opus), used liberally |
| Verification (checker/red-team/validator/reviewer) | `opus-builder` (Opus) | `opus-builder` (Opus) | `opus-builder` (Opus) |
| Documentation / state | `sonnet-scribe` (Sonnet) | `sonnet-scribe` (Sonnet) | `sonnet-scribe` (Sonnet) |
| Mechanical | `quick-edits` (Haiku) | `quick-edits` (Haiku) | `quick-edits` (Haiku) |

**Invariant 1 holds in every posture: verification never drops below Opus, even in `economy`** —
that, plus the escalation rule below (capability failure escalates Haiku → Sonnet → Opus, and then Fable only with approval — see "Models that need approval first"),
is the safety net for an economy build-tier misroute. Honest tradeoff: `economy` trades some
first-pass build quality for cost; the frontier checker plus escalation keep it safe. `max` never
economizes and never auto-tightens (see `loop-runtime.md`).

`sonnet-builder` (alias `sonnet`) is the economy build endpoint — it shares the Sonnet model with
`sonnet-scribe` but is build-framed, not scribe-framed.

## Escalation — the dynamic part
Start a mechanical-looking workstream on `quick-edits` (Haiku); on a genuine CAPABILITY
failure (not a brief-quality failure), escalate one tier: Haiku → Sonnet → Opus, and then — only with the user's approval — Fable. This reuses
the orchestrator's two-strike rule: strike one may be a bad brief (re-brief, same tier); a
second failure that looks capability-bound escalates the tier. Never escalate verification
below Opus.

**Judge the output, not the price tag.** These tiers are defaults, not limits. If a cheaper
tier's output doesn't meet the bar, redo it on a smarter tier without asking — escalating
costs less than shipping mediocre work. Cost is only a tie-breaker: when axes conflict for
anything that ships, intelligence > taste > cost.

## Models that need approval first, and exact versions (added 17 November 2026)

Two settings under `routing:` in `.dev-team/config.yml` (see `config-and-toggles.md`), also set in
plain words for one session ("don't use Fable without asking", "use exactly this version"):

- **`routing.ask-first`** — a list of models that must never be used silently, because they cost a lot.
  **By default (owner's choice, 17 Nov 2026) it holds:** Claude Fable, Claude Mythos, the top flagship model from OpenAI and the top Gemini model from Google (named by role, so a newer version takes its place), and **any model whose price the plugin cannot find** until the cost is known. Local models are never on it, because they are free. Setting the list yourself replaces this default. Before the lead spawns any agent on a listed model (this includes
  the Fable rung of the escalation chain, and a per-spawn model override), it asks the user, in plain
  words: which model, for which task, why the cheaper default is not enough, and what the cheaper
  choice would be and cost relative to it. One yes covers that one task only. Without a yes — and in
  an unattended run, where there is nobody to ask — the work goes ahead on the cheaper suggestion, an
  approval item is queued in the gate ledger, and the run report says what was held back. Verification
  never drops below Opus while doing this (Invariant 1). A repository instruction may add models to
  this list; it can never remove one.
- **`routing.pin`** — exact versions the developer wants, as `alias: exact-id` pairs. Without a pin the
  plugin uses the alias, which means the newest model the account offers under it. With a pin, the
  lead passes the exact id wherever the host tool accepts one, and where it does not (for example an
  agent spawn that only takes an alias), it says so in the run report and **stops to ask** rather than
  quietly using a different version. Pins are the user's own choice: a repository instruction cannot
  set or change one. In Claude Code, the host's own settings (its model-alias environment variables)
  are another way to pin a version for the whole session; check that your version supports them.

Both settings apply to every AI system, not only Claude: a model on another system is named the same
way, and the same rules hold.

## Other AI systems (added 17 November 2026; documented, not yet routed automatically)

The plugin is meant to work across AI systems (standing rule 12). Until the orchestrator engine
(issue #46) can route to them, this table says how each is meant to be used; **none of the "unverified"
ones has been tried against a real account**, so treat the roles as plans, not promises.

| System | Role today | Status |
|---|---|---|
| Claude Code | The host. Every tier above. | Verified |
| Codex (OpenAI) | Independent reviewer of Claude's work, and optional bulk executor (`orchestration-profiles.md`) | Verified for review |
| GitHub Copilot | Reviewer first, builder later (owner's decision, 17 Nov 2026) | Unverified |
| Gemini (Google) | Scout and reviewer candidate | Unverified |
| Kimi (Moonshot) | Scout and builder candidate | Unverified |
| Grok (xAI) | Reviewer candidate | Unverified |
| DeepSeek | Builder candidate; may run in the cloud or locally | Unverified |
| Ollama (Qwen and other local models) | Free local scout, builder and mechanical work; first choice when the project is local-first | Unverified |

Local models are free to run, so they never go on the ask-first list. The route order (local first,
cloud first) and its profiles are described in the addendum under `.claude/plans/orchestrator-v2/` and
are built with the engine.

## Asking the engine instead of the table (added 17 November 2026)

If `bash ${CLAUDE_PLUGIN_ROOT}/scripts/engine.sh doctor` exits 0, the lead may ask the engine which
model to use rather than reading the tables above by eye: write a small request file
(`{"role": "builder", "risk": "NORMAL", "providers": ["claude", "ollama"]}`) and run
`engine.sh route --request-file <file>`. The answer says which model, why, what was held back for
approval, and any question for the user (for example where work should start, asked once per project).
Exit 1 means a "no" that is itself the answer: `NEEDS_APPROVAL` (ask the user, then ask again with
`"approved": ["<model>"]`; naming the pinned exact version also works), `PIN_UNAVAILABLE` (stop and ask),
`PIN_INVALID` or `SETTINGS_INVALID` (a setting in `.dev-team/config.yml` is malformed or ambiguous: show the
user which one and ask them to correct it; never guess), or `NO_SUITABLE_AGENT_AVAILABLE`. To reach a
tier-4 model the user has approved, add `"minTier": 4` to the request. When the answer's `exactId` is not
null, pass it when starting the worker, or stop and say the tool cannot.
Add `"taskTypes": ["CODE_REVIEW"]` and `"risk"` (LOW, NORMAL, HIGH, CRITICAL) and the engine also sets how hard the model should think. The answer carries a `decisionId`; `engine.sh explain --decision <id>` (or `/dev-team-explain`) says why in three sentences, and `engine.sh dry-run --phases-file <json>` previews a whole plan. `engine.sh config show` prints the effective settings and which source decided each. If the engine
exits 3, follow the tables above as before. The engine only decides and records; the lead starts the
worker. Details: `docs/orchestrator/engine-commands.md`.

## Session-model caveat
An agent left on `model: inherit` (or the lead itself) follows the user's `/model` session
choice, which sits ABOVE the plugin. If the session runs on a cheap model, un-pinned work
collapses to it. That's why the four endpoint agents pin their model explicitly — so tiering
holds regardless of the session model.

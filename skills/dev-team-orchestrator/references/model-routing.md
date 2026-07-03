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
| Reasoning | `deep-architect` | `fable` | Architecture, subtle multi-file bugs, algorithm design, concurrency/data-model trade-offs, big cross-cutting refactors, debate advocates. The genuinely hard stuff. |
| Build/Verify | `opus-builder` | `opus` | Building features, scouting, and ALL verification (checker, red-team, validator, reviewer). The default worker. |
| Scribe | `sonnet-scribe` | `sonnet` | Documentarian: PROJECT.md / FEATURES.md / SECURITY.md / VERIFICATION.md upkeep, ledgers, run records. |
| Mechanical | `quick-edits` | `haiku` | Renames, formatting, import sorting, docstrings, boilerplate, trivial config. |

## Model ids and aliases (the ONE place concrete ids live)
| Tier | Model | Alias | Dated id (fallback) |
|---|---|---|---|
| Reasoning | Fable 5 | `fable` | `claude-fable-5` |
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
| Hard reasoning / debate | `deep-architect` (Fable) | `opus-builder` (Opus) | `deep-architect` (Fable), used liberally |
| Verification (checker/red-team/validator/reviewer) | `opus-builder` (Opus) | `opus-builder` (Opus) | `opus-builder` (Opus) |
| Documentation / state | `sonnet-scribe` (Sonnet) | `sonnet-scribe` (Sonnet) | `sonnet-scribe` (Sonnet) |
| Mechanical | `quick-edits` (Haiku) | `quick-edits` (Haiku) | `quick-edits` (Haiku) |

**Invariant 1 holds in every posture: verification never drops below Opus, even in `economy`** —
that, plus the escalation rule below (capability failure escalates Haiku → Sonnet → Opus → Fable),
is the safety net for an economy build-tier misroute. Honest tradeoff: `economy` trades some
first-pass build quality for cost; the frontier checker plus escalation keep it safe. `max` never
economizes and never auto-tightens (see `loop-runtime.md`).

`sonnet-builder` (alias `sonnet`) is the economy build endpoint — it shares the Sonnet model with
`sonnet-scribe` but is build-framed, not scribe-framed.

## Escalation — the dynamic part
Start a mechanical-looking workstream on `quick-edits` (Haiku); on a genuine CAPABILITY
failure (not a brief-quality failure), escalate one tier: Haiku → Opus → Fable. This reuses
the orchestrator's two-strike rule: strike one may be a bad brief (re-brief, same tier); a
second failure that looks capability-bound escalates the tier. Never escalate verification
below Opus.

## Session-model caveat
An agent left on `model: inherit` (or the lead itself) follows the user's `/model` session
choice, which sits ABOVE the plugin. If the session runs on a cheap model, un-pinned work
collapses to it. That's why the four endpoint agents pin their model explicitly — so tiering
holds regardless of the session model.

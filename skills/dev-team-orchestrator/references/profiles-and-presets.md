# Profiles and presets — one name for a bundle of settings

**Status: reserved.** This file defines the names and what each bundle contains. The settings marked
"reserved" take effect when the orchestrator engine (issue #46) lands; until then the lead follows
them as instructions where it can, and says plainly where it cannot. Nothing here changes a built-in
default for people who do not set `profile:`.

A profile is chosen with one line in `.dev-team/config.yml`:

```yaml
profile: standard      # standard | local-first | cloud-first
```

Anything else the same file sets explicitly wins over the profile.

## `standard` — the owner's usual working practices (issue #45)

| Practice | What the profile sets |
|---|---|
| Push after each task (F13) | `git.push-after-task: on` (**off** everywhere else). Partly built 17 Nov 2026 (the decision check only; no skill is wired to it yet, so nothing pushes): the setting exists in `config-and-toggles.md` and `engine.sh push check` answers whether a push is allowed (run branch only, only a checker-cleared commit, never the default branch, never a force). The Bash guard's rule against pushing to `main` still applies. |
| Second opinion from another system (F10) | The Claude checker always runs; Codex adds an independent review **in addition**, when installed and under its allowance. If it cannot run, say so and treat the work as "not fully reviewed". |
| One after another for thinking (F5) | Analysis and planning agents run in sequence, each building on or checking the last. Debates keep their side-by-side design so debaters cannot see each other's arguments. |
| Cheaper building (F7, F8) | Build on Sonnet or Haiku; Opus only when the change is complex and needs judgement (`defaults.models: economy`). |

## `local-first` and `cloud-first` — where work starts (owner's decision, 17 Nov 2026)

| Profile | Starts on | Moves to the other when |
|---|---|---|
| `local-first` | Free local models (for example Ollama) | A task is too hard for them, or no local model is available. Paid models on the ask-first list still need a yes. |
| `cloud-first` | Cloud models | The cloud allowance runs out (rule 8: hand over, hand back, and review what the stand-in did). |

**Built-in default: local first**, used when no profile or order is set. Local models are free, so
they never need approval. The order is the setting `routing.order: local-first | cloud-first` (reserved).

**Asked once, then remembered.** The first time the plugin runs in a project where the order is not
set, it asks which the user wants and records the answer in `.dev-team/config.yml` as `routing.order`.
Projects that were already running before this existed are asked the same way on their next run.

**A default for one computer.** A person can set their own order for a particular device (a laptop
with local models might default to local first). It lives in `~/.dev-team/device.yml` — outside every
project, never committed — as `routing: {order: local-first}`.

Order of precedence, highest first: this session's choice > the project's remembered answer in
`.dev-team/config.yml` > the profile > the device file > the user's general default > local first.
The "why was this model chosen" explanation names which of these decided.

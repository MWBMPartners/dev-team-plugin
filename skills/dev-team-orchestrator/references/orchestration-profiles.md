# Dev-Team Orchestration Profiles — taste-first, with optional Codex offload

Model routing (`model-routing.md`) picks a tier per *workstream*. This file adds the layer above
it: who ORCHESTRATES, and where the token-hungry grunt work goes. It adapts the "smart taste
model orchestrates, cheap steerable model does the grunt work" pattern into the suite. It is an
OPTIONAL profile — the suite works unchanged without it; turn it on when you want the most taste
per token.

## The idea
Keep the highest-*taste* model as the lead (orchestrator): it owns the plan, the briefs, the
decisions, the UI/UX/API/copy calls, and the reviews — the work where judgment shows. Hand the
token-hungry, low-taste grunt work (clear-spec implementation, migrations, data crunching,
codebase reading) to the cheapest *capable* executor. You pay frontier prices for the thinking,
not the typing.

## Ranking (higher = better; tune to your own plan)
| model            | cost-efficiency | intelligence | taste | role in the suite |
|------------------|-----------------|--------------|-------|-------------------|
| gpt-5.5 (Codex)  | 9 | 8 | 5 | optional cheap bulk executor (external — see "Codex offload") |
| sonnet | 6 | 5 | 7 | scribe + mid build; the Claude fallback for bulk work |
| opus | 4 | 8 | 8 | default builder + ALL verification |
| fable | 2 | 9 | 9 | recommended orchestrator + hard reasoning |
| haiku | 10 | 3 | 2 | trivial mechanical only (renames/formatting/boilerplate) |

"cost-efficiency" is higher = cheaper: gpt-5.5 and haiku are cheapest, fable is priciest but top
taste + intelligence. Tune the numbers to your own subscription — the rules below read from this
table, so editing it changes the behaviour.

## The rules
- **Orchestrator = top taste tier.** Run the dev-team *session* on Fable (best taste) — or Opus.
  The plugin cannot set the session model for you; do it with `/model fable` before you start,
  or pin it in settings: `{"model": "fable"}`. Everything the lead does — briefs, decisions,
  UI/API/copy, reviews — inherits that taste.
- **Bulk / mechanical -> cheapest capable.** Clear-spec implementation, migrations, data
  analysis, codebase reading, boilerplate: send to the cheapest model that can do it — GPT-5.5
  via Codex when available (below), else Sonnet; trivial mechanical stays on Haiku (`quick-edits`).
- **Anything user-facing needs taste >= 7.** UI, copy, API design, error messages: keep on a
  Claude taste tier (Opus or Fable). Never route these to a low-taste bulk executor.
- **Verification stays frontier (invariant 1, unchanged).** Checker / red-team / validator /
  reviewer stay on `opus-builder` (Opus). Codex may be added as an EXTRA adversarial perspective
  (below), never as a replacement for the Claude verifier.
- **Cost is only a tie-breaker.** When axes conflict for anything that ships:
  intelligence > taste > cost.
- **Escalate freely — judge the output, not the price tag.** These are defaults, not limits. If
  a cheaper tier's output doesn't meet the bar, redo it on a smarter tier without asking;
  escalating costs less than shipping mediocre work. (Standalone form of the model-routing
  escalation rule.)

## Codex offload (GPT-5.5) — optional
When the `openai/codex-plugin-cc` plugin (and the `codex` CLI) is installed, the lead can offload
token-hungry, low-taste grunt work to GPT-5.5 instead of spending Claude quota:

- **Detect first, never fail.** Is `codex` on PATH / are the `/codex:*` commands or
  `codex-cli-runtime` skills in `available_skills`? If not, DON'T fail — do the work on Claude
  tiers (Sonnet/Haiku) and, only if it would clearly help, tell the user how to set Codex up.
- **Route to Codex:** clear-spec implementation, multi-file refactors, migrations, data analysis,
  bulk codebase reading. Prefer the plugin's native commands/skills over raw bash so delegation
  stays observable — `/codex:rescue` for implementation/refactor/debug loops; `/codex:review`
  (read-only) and `/codex:adversarial-review` for an extra review perspective; `/codex:status` ·
  `/codex:result` · `/codex:cancel` for `--background` jobs.
- **Keep on Claude:** anything user-facing (taste), and all PRIMARY verification.
- **Optional review gate:** `/codex:setup --enable-review-gate` adds a stop hook that challenges
  the lead's output with Codex before finalizing — a useful SECOND opinion that complements, and
  never replaces, the suite's Opus verifier (invariant 1).

### Setting up Codex (instruct the user; don't run it for them)
1. Install the Codex CLI and sign in (`codex` on PATH; needs an OpenAI account/API — usage counts
   against the OpenAI plan, not Claude).
2. Set defaults in `~/.codex/config.toml` (model, approval mode). Claude adopts this config.
3. Install the `openai/codex-plugin-cc` plugin in Claude Code for the `/codex:*` commands/skills.
4. Optionally: `/codex:setup --enable-review-gate`.

## How the lead applies this profile
At project start on the taste-first profile: state the orchestrator tier (Fable/Opus), note
whether Codex is available, and in each brief pick the endpoint per `model-routing.md` + these
rules — Codex for bulk grunt work when present, Claude tiers otherwise, user-facing on a taste
tier, verification on Opus. Nothing else in the suite changes.

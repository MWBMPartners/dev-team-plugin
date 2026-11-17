# Owner's additions to the orchestrator brief — 17 November 2026

<!--
  File:     .claude/plans/orchestrator-v2/owner-brief-addendum-2026-11-17.md
  Purpose:  The owner's new requirements for #46 (and #45), recorded in plain words, with what the
            existing plan already covers and what is new. Read with plan.md in this folder.
-->

The owner's words are summarised, not quoted. Standing rules 12–15 in `.claude/CLAUDE.md` and
`.OpenAI/AGENTS.md` carry the lasting part. This file is the list of **work to build**.

## Coverage check against `plan.md` (searched 17 November; "no hits" means the word is absent from the plan)

| # | Requirement | Already in the plan? | What is new |
| --- | --- | --- | --- |
| A1 | Pick the best model per job, to save credit but still get it right first time | **Yes** — tiers, routing by capability (increments 1, 7) | Nothing; confirm tier names suit non-coding work |
| A2 | Provider list: Claude Code, Codex, Gemini, Copilot, Kimi, Grok, DeepSeek, Ollama (Qwen etc.) | **Partly** — Claude, Codex, Gemini, Kimi, Grok only | **Add Copilot, DeepSeek, Ollama** (no hits in the plan). Mark each "verified" or "unverified" (decision D3) |
| A3 | Local first then cloud for hard work, **or** cloud first then local when allowance runs out | **No** | A "route order" setting with both modes, and the switch rule (new increment, see below) |
| A4 | Seamless from the user's editor: Xcode, Visual Studio, VS Code, Cursor and others | **No** (no hits) | Find out how each editor hosts the plugin or calls the engine; document and test what is possible. Needs research first — nothing assumed |
| A5 | Per model-platform, pick the right model, or switch platform | **Yes** (routing) | Nothing |
| A6 | Settings per session **and** per repository | **Partly** (config layers exist in 1.x) | Spell out the order of precedence and show it in the "why this model?" output |
| A7 | Models that need specific approval per task (e.g. Fable, Mythos) | **Partly** — approval gates exist (increment 6) for actions, not for models | A per-model "needs approval" flag, asked before use, with a cheaper suggestion |
| A8 | Pin exact model versions | **Partly** (28 hits for "pin" are mostly about locking plans) | A per-model "use exactly this version" setting |
| A9 | New models added without our tweaking | **Yes in part** — discovery and signed catalogue (increments 0b, 1, 9) | Add local installs (Ollama list) to discovery; show "new model found, trial first" |
| A10 | Fully usable beyond Claude Code, and beyond coding | **Partly** | Review wording in every skill; remove software-only assumptions where the work is not code |
| A11 | One handover, plus goals, requirements/prerequisites and plans documents, readable by any model | **Partly** — HANDOFF exists; the other three do not | Create a **project documents set** (goals, requirements, plan) with a template and a skill step that keeps them current |
| A12 | Issues, project boards and milestones kept current as the source of truth | **Partly** — issue sync exists; boards and milestones do not | Extend issue sync to boards and milestones; handle GitHub, GitLab and others |
| A13 | Docs, in-app help and wikis kept current | **Yes** (docs skill) | Add repository wikis |
| A14 | OpenAPI and Swagger UI for web projects with APIs, possibly restricted to API users | **No** (2 hits, both "not applicable") | Add to the docs skill as a check for projects that have an API; shared-hosting friendly |

## New work to add to the plan

1. **Increment 1a — provider list and route order.** Add Copilot, DeepSeek and Ollama adapters; add the
   local-first / cloud-first setting; define the "allowance reached" and "task too hard" switches.
2. **Increment 6a — model approval.** A per-model flag "ask first", and a per-model "exact version".
3. **Increment 11a — project documents set.** Goals, requirements and prerequisites, plan: template,
   upkeep rule in every skill.
4. **Increment 12a — tracker as source of truth.** Boards, milestones, wikis; plus the API-documentation
   check (A14).
5. **Research task R-IDE.** What each editor lets a plugin do (Xcode, Visual Studio, VS Code, Cursor).
   Output: a table of "works / works with a helper / not possible". No code until it is read.

## Questions for the owner (gathered up front, per rule 9)

| # | Question | Why it matters | Suggested answer |
| --- | --- | --- | --- |
| Q6 | Which editors matter most first? | The editor research is large; doing it in order of use saves effort | VS Code and Cursor first, then Visual Studio, then Xcode |
| Q7 | Default route order: local first or cloud first? | The setting needs a built-in default | Cloud first, with local as the fall-back (matches the quality-first aim); the `standard` preset can choose local first |
| Q8 | Which models start on the "ask first" list? | Fable and Mythos named as examples only | Fable and Mythos, plus anything the plugin cannot price |
| Q9 | Is Copilot a worker, a reviewer, or both? | Copilot's allowance and tools differ from the others | Reviewer first, worker later |

## Owner's answers, 17 November 2026

| # | Answer |
| --- | --- |
| Q6 | All four editor families, in this order: VS Code and Cursor, Visual Studio, Xcode, JetBrains. |
| Q7 | Built-in default is **local first**, using cloud for hard work or when local is unavailable. Ask once per project and remember it (ask on first use for projects already running). Ship two profiles, cloud-first and local-first. A user may also set their own default **per dev device**. |
| Q8 | Not yet decided. Research expensive high-quality models on other platforms first; the owner then picks. Local models are never listed (they are free). |
| Q9 | Copilot is a reviewer first, worker later. |

Order of precedence for route order, highest first: this session's choice > the project's remembered
answer > the device default > the user's general default > the built-in default (local first).

## Q8 research — expensive, high-quality models to consider for "ask first" (17 November 2026)

**Treat every number as unverified.** One web search found only secondary price-comparison sites, which
disagree with each other and name some models no official page was checked for. Check each maker's own
pricing page before relying on a figure. Prices are US dollars per million tokens (input / output).

| Maker | Model named | Price reported | Notes |
| --- | --- | --- | --- |
| Anthropic | Claude Fable 5.1 / 5.2 | 10 / 50 (5.1) or 8 / 40 (5.2) — sources disagree | Already the owner's example |
| Anthropic | Claude Mythos | not found | Named by the owner; no price found |
| Anthropic | Claude Opus 5.5 | 4 / 20 | The plugin's default for hard reasoning, so not a candidate |
| OpenAI (Codex/ChatGPT) | GPT-6 Astra | 10 / 50 | Priciest OpenAI flagship found; name seen on one site only |
| Google | Gemini 4 Argon | 2 / 10 or 4 / 20 — sources disagree | Introductory rate said to end 30 Nov 2026 |
| xAI | Grok 4.3 | output 2.5 only | No input price found; probably not expensive |
| DeepSeek | V3.2, R1 | 0.28 / 0.42 | Cheap; not a candidate |
| Moonshot | Kimi K2.5 | none (can be self-hosted) | Cheap or free; not a candidate |

Sources: [aitoolsreview](https://aitoolsreview.co.uk/insights/ai-api-pricing-comparison),
[respan](https://www.respan.ai/articles/ai-token-cost), [Nadir](https://getnadir.com/blog/llm-api-pricing-june-2026-complete-comparison/),
[BenchLM](https://benchlm.ai/llm-pricing-trends), [TechJack](https://techjacksolutions.com/ai-tools/rankings/cheapest-frontier-ai-apis/).

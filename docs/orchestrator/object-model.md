# Object model (short)

- **Provider**: who makes the models (anthropic, openai, google, moonshot, xai, and local Ollama).
- **Runtime**: the tool that runs them (claude-code, codex, gemini-cli, kimi-cli, grok-build). Providers and
  runtimes are not model names; routing never names either.
- **Model profile**: one record per model per runtime (`schemas/local/model-capability-profile.schema.json`).
- **Role**: the job (scout, builder, architect, reviewer, mechanical, documentarian). Each has a minimum tier.
- **Tier**: strength, 1 utility, 2 engineer, 3 architect, 4 principal. Checking work is never below 3.
- **Decision**: what `route` returns: the chosen model, why, what was held back, any question for the user.
Later increments add Job, Phase, Task, Attempt, Artifact and ReviewFinding (plan section 2.2).

# Orchestrator engine

The engine chooses which AI model should do each job, and records the choice. It never starts
workers itself. It is plain JavaScript (Node 22 or newer, no extra libraries), started with
`scripts/engine.sh`.

**Main rules:** models are picked by strength level, never by name; checking work is never done
by a weak model; the cheapest model that qualifies wins; costly models (Fable, Mythos, the top
OpenAI and Google models, and any model with no known price) wait for your yes; local models
(such as Ollama) are tried first by default; you can pin an exact version, or the job stops.

**Check it:** `bash scripts/completion-gate.sh` prints a PASS/FAIL list.

**Honest status:** built and reviewed by fresh Claude agents, but not yet by Codex, and not yet
tried against real accounts of other AI systems. See issues #46, #50 and #58.

Details: `docs/orchestrator/README.md` in the repository.

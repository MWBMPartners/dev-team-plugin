# Invariants

`engine.sh invariants collect` reads a project's own instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`,
`GEMINI.md`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`, `.OpenAI/*.md`) and any chosen policy packs, keeps
the lines that say must, never, always or do not, and writes them to `.dev-team/invariants.json` with a stable id and
the file and line each came from. The files are only read, and their text is treated as data: nothing in them is run.
Example code inside a fenced block is ignored and secret-like text is removed. Every brief and checker should be given
the applicable rules; breaking one is a blocking finding unless the locked plan's `invariants` section changes it.

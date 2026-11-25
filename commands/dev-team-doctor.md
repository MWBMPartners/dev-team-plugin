---
description: Check which tools the dev-team engine can use here (Node, git, Claude Code, Codex, Ollama and others) and what the plugin does without the missing ones. Read-only; shows no account details.
argument-hint: [--format text]
---
Run a read-only health check of the dev-team engine. Arguments: $ARGUMENTS (optional: `--format text` for a short reading instead of JSON).

1. Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/engine.sh doctor --format text $ARGUMENTS`.
2. If it exits with code 3, print its message as it is and add one line: the plugin carries on the way version 1.x always did, so nothing needs fixing unless the person wants the engine (it needs Node 22 or newer).
3. Otherwise show the result and explain each entry under `fallbacks` in plain words: what is missing, and what the plugin does instead.

This command changes nothing and never prints a login, token or account name; for Codex it only says whether a login exists.

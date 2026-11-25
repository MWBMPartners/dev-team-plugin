# Editor support research — 17 November 2026

**First pass, from secondary sources only.** One web search found blog comparisons that disagree on
details; none is an official compatibility table. Nothing here has been tried by hand. Before building
anything for an editor, check Anthropic's Claude Code documentation and that editor's release notes.

Order chosen by the owner: VS Code and Cursor, Visual Studio, Xcode, JetBrains.

| Editor | What the sources say | Likely route for the plugin | Confidence |
| --- | --- | --- | --- |
| VS Code | Claude Code has an official extension; the same project instructions, skills and hooks apply as in the terminal. | The plugin works as it does today, because the extension runs the same Claude Code. Other AI systems reach it through their own VS Code extensions and the shared project documents. | Medium |
| Cursor | Can run the same extension; one source says it also reads `.claude/skills`, Claude Code hooks, `AGENTS.md` and its own `.cursor/rules`. | Same as VS Code, plus an `AGENTS.md` pointer so Cursor's own agent finds the rules. | Medium |
| Visual Studio | No source found for Claude Code. Only GitHub Copilot is reported there. | Needs research. Likely only the shared documents (handover, goals, requirements, plan) and `AGENTS.md`, read by Copilot. | Low |
| Xcode | Xcode 26.3 (announced 3 Feb 2026) is reported to include Claude through the Claude Agent SDK, and Claude Code in a terminal is reported to connect to Xcode over MCP. | Run the plugin through Claude Code in a terminal beside Xcode, using MCP to reach Xcode. Needs a hand test. | Low to medium |
| JetBrains | A Claude Code integration is reported. | Likely works as the terminal does. Needs a hand test. | Low |

Common thread: the shared project documents and an `AGENTS.md` pointer are the part that works in
every editor with no plugin support at all, which is why standing rule 13 matters.

**Next step (not done):** a hand test in each editor, in the owner's order, recording what worked.

Sources: [Second Talent](https://www.secondtalent.com/resources/claude-code-editors/),
[Cosmic JS](https://www.cosmicjs.com/blog/claude-code-vs-github-copilot-vs-cursor-which-ai-coding-agent-should-you-use-2026),
[Codersera](https://codersera.com/blog/ai-coding-agents-complete-guide-2026/),
[Context.dev](https://www.context.dev/blog/codex-vs-claude-code-vs-opencode-vs-cursor),
[Masai School](https://www.masaischool.com/blog/claude-code-vs-cursor-vs-github-copilot-vs-codex/).

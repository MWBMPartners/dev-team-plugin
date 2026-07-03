---
description: Check whether a newer dev-team plugin version is available and show the exact commands to update.
---
Determine the installed dev-team version (read the plugin's own .claude-plugin/plugin.json) and the latest available (best-effort: `gh api repos/MWBMPartners/dev-team-plugin/contents/.claude-plugin/plugin.json` decoded, or the repo's tags). Then:
- If a newer version exists, tell the user and print the two commands to run themselves (you cannot run built-in /plugin commands for them):
    /plugin marketplace update dev-team
    /plugin update dev-team
  Summarize what's new from CHANGELOG.md for the target version if reachable.
- If up to date, say so.
- If the latest can't be determined (no gh/auth/remote), say so and still print the update commands as the manual path.
Never attempt to run /plugin yourself; never print or require any secret/token.

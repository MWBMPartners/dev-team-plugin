---
description: Watch this repo's open PRs for failing CI checks and resolve them safely — auto-fix safe classes, propose the rest. Loopable.
argument-hint: [pr=<n>] [autofix=safe|off]
---
Run one CI-medic watch pass over this repo's open PRs. Arguments: $ARGUMENTS (optional: `pr=<n>` to narrow to one specific PR — this is also the explicit per-PR opt-in for a PR you didn't author; `autofix=safe|off`, default `safe`).

1. **Scope.** Confirm `gh` is authenticated (`gh auth status`); if not, tell the user and stop. If `pr=<n>` was given, target only that PR (explicit user opt-in). Otherwise list this repo's open PRs — `gh pr list --state open --json number,title,author,headRefName,url` — and keep only the ones authored by the authenticated `gh` user (`gh api user --jq .login`). Never watch or touch a PR authored by someone else unless the user explicitly named it via `pr=<n>`.
2. **Check each PR in scope.** For every PR, run `gh pr checks <n>`. If every check is green (or there are no checks yet), report it clean and move on — read-only, nothing to do for that PR.
3. **Pull failure evidence.** For each failing check, find its run and pull the failing logs: `gh run list --branch <headRefName>` (or the run id from `gh pr checks <n> --json`) then `gh run view <run-id> --log-failed`.
4. **Triage and resolve.** Load the `dev-team-ci-medic` skill (its `SKILL.md`) and follow it end to end to classify each failure (SAFE-AUTO / FLAKY / REAL / BLOCKED, per its `triage-protocol.md`) and resolve it per the gate: `autofix=safe` (default) auto-fixes + verifies + pushes SAFE-AUTO classes, reruns FLAKY, diagnoses and proposes a concrete fix for REAL (built only on confirmation, or via the skill's gated remediation cycle), and reports BLOCKED with its specific cause; `autofix=off` only monitors, reports, and proposes — it modifies nothing.
5. **Record.** Per the skill's protocol, have `sonnet-scribe` note a short run summary — what was watched, fixed, proposed, or blocked — per PR.
6. **Report.** Summarize per PR: checks now green (with the evidence pasted), what was auto-fixed, what's proposed and awaiting confirmation, and what's blocked and why.

**Safety, every pass, no exceptions:**
- **Never games a test.** If a failing check is a test, only the code under test gets fixed — never the test's own assertions/expectations. A genuinely-wrong test is a human call; surface it, don't silence it.
- **Never pushes to `main`/`master`, and never force-pushes.** Any push this command makes goes only to the PR's own head branch.
- **Only touches PRs you own** — your repo, your authored PR — unless the user explicitly opted in for that PR via `pr=<n>`.

**Loopable.** Run it standalone for one pass, wrap it for a recurring local watch — `/loop <interval> /dev-team-watch-prs` — or stand up a scheduled cloud routine via `/schedule` that dispatches this same prompt; see the skill's `watch-and-schedule-protocol.md` for the `GITHUB_TOKEN` anti-recursion caveat that applies to cloud/routine pushes.

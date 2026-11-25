# The dev-team orchestrator engine

A small program, written for Node.js 22 or newer with no outside libraries, that makes the decisions a
team lead should not have to make by feel: which model to use for each job, whether a model needs your
approval first, where work starts (local or cloud), and a written record of why. It **decides and
records; it never starts a worker itself** — the lead reads its answer and carries it out.

It is optional. Without Node 22, or with `DEV_TEAM_NO_ENGINE=1`, every command exits with code 3 and the
plugin works the way version 1.x always did.

Start with [engine-commands.md](engine-commands.md). The plan it is built to is
`.claude/plans/orchestrator-v2/plan.md`, locked on 17 November 2026
(`.claude/plans/orchestrator-v2/plan-contract.orchestrator-v2.v1.json`).

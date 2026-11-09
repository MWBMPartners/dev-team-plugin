<!--
  File:    .claude/plans/orchestrator-v2/plan.md
  Purpose: The implementation plan for dev-team-plugin 2.0.0, the provider-independent orchestrator (issue #46). Written by a Fable
           planner, challenged by an independent Fable critic (plan-critique.md), then revised by the planner (this file), all
           read-only, 13 September 2026 (workflow wf_43beb6e0-f07). Every critique point was applied; none was rejected.
  Status:  DRAFT — not yet locked. Four owner decisions (D1 engine language, D2 branch, D3 unverified providers, D4 hand-over after
           more than 12 hours) are open; the plan is written on the recommended answers with a delta for each (section 9).
           Section 10 is the first PlanContract; increment 0a hand-locks it only after the owner approves.
  Note:    The reviser's result arrived split across two messages; the lead joined them in order (no text changed). A short
           preamble sentence before the plan heading was dropped.
-->

# Implementation plan — dev-team-plugin 2.0.0, the provider-independent orchestrator engine (revised after critique)

Planner: Fable, 13 September 2026, read-only, revision 2. Grounded in: the owner's brief (sections 1–101), the deep analysis, its independent check (whose corrections win wherever the two differ), the two owner feature maps, the independent critique of the first draft (every blocking and important point applied; see the closing section), and the plugin files named below, all read in full today. Probes run in a temporary folder outside the repository: Node 26.8.1 runs `node --test`, signs and verifies Ed25519 over canonical JSON bytes, gives an atomic `mkdirSync` lease, and has `Europe/London` timezone data; `git stash create` on a tree with `M tracked.txt`, `?? untracked.txt`, `?? sub/new.js` produced a commit holding only `tracked.txt`, while a temporary-index snapshot (`GIT_INDEX_FILE=<tmp> git add -A && git write-tree && git commit-tree`) captured all three and left the working tree and the real index untouched; restoring with `git checkout <snapshot> -- .` brought all three back (staged, so a `git reset -q` follows); `/bin/bash` 3.2.57 rejects `shopt -s globstar`; `git rev-parse --git-common-dir` returns the same `.git` for a worktree and its main checkout; the local Codex catalogue cache carries `slug`, `context_window`, `supported_reasoning_levels`, `default_reasoning_level`, `visibility`, `priority`, `upgrade` and `model_messages` (prompt text, never cached by us); `~/.codex/config.toml` sets `model` and `model_reasoning_effort`; `tests/scripts.bats` has 63 tests today. Nothing in the repository was changed. The workflow keeps its own copy of this plan in the session scratchpad for the next step.

Everything below is written to be the first locked PlanContract (section 10). Line references are to files as they stand on `claude/ledger-file-clashes` today and will drift as fix round 2 lands; the file names will not.

---

## 1. Summary

**What 2.0.0 is.** Today the plugin is a set of written instructions that a Claude Code session follows: it picks which sub-agent to spawn from a fixed list of five agents named after models (`opus-builder`, `deep-architect`, `sonnet-scribe`, `sonnet-builder`, `quick-edits`), nothing keeps a record of why, nothing notices when a service runs out of allowance, and none of it can be unit-tested. 2.0.0 adds a small program — the **engine** — shipped inside the plugin, that does the parts of orchestration which must be exact: it works out which kind of worker is qualified for a piece of work and records why; it locks an approved plan so it cannot quietly change; it notices drift from that plan; it keeps a lease saying who owns a phase of work; when a worker's allowance runs out it saves the work (including uncommitted and untracked files, as a git snapshot) and either waits for the reset or stops with an honest "blocked", never silently swapping in a different model; it records who reviewed what and how independent that review was; it learns, locally and privately, which workers do well on which kinds of work; and it can simulate all of this with pretend providers so the rules are provable. The Claude Code session (the "lead") still does everything that needs judgement — reading the request, writing briefs, spawning workers, reading the checker's report — but it asks the engine to **decide and record**, then it **executes** the decision. The split is deliberate: the engine is deterministic and testable; the lead is not, and does not need to be for the things it does.

Every state file the engine writes is JSON with a schema that CI validates, and lives either in the project's `.dev-team/` folder (committed, with the 1.5.0 ownership marker) or in the plugin's private data folder (machine-local, never committed). Runtimes are treated as separate from providers and from roles: Claude Code is the lead runtime; Codex is a verified worker and reviewer runtime; Gemini, Kimi and Grok get adapters written from their public documentation but marked unverified until someone with those tools installed runs the probes.

**What it deliberately is not.** It is not a scheduler or daemon — it never wakes itself; the host (Claude Code's own wait-at-usage-limit feature, and the autopilot loop's re-firing) does the waking, and the engine keeps the persisted reset time that survives a restart. It is not a billing system — cost figures are banded estimates with a caveat. It is not a replacement for the 1.x skills — when Node is absent the engine refuses loudly and every 1.x behaviour continues unchanged. It does not run Gemini, Kimi or Grok for real in this release, does not talk to a live MWBM-intAppsAPI catalogue service (that service does not exist yet; the plugin side ships against fixtures signed at test time), does not do shadow evaluation unless switched on, does not store any source code for learning, and never reads or logs a credential. It does not build the owner's unrelated documentation features (OpenAPI upkeep, Swagger UI, in-app help, "all markdown") or the repository re-alignment feature (R1) — those are listed with reasons in section 3.3.

---

## 2. Architecture

### 2.0 Glossary (plain words for the terms this plan leans on)

- **Engine** — the small Node program shipped in `engine/`; the lead calls it through `scripts/engine.sh`.
- **Shim** — that bash script: it finds Node, checks the version, and either runs the engine or refuses with one clear line.
- **Schema** — a JSON Schema file describing exactly what a JSON file may contain; a **fixture** is a sample file that must pass its schema, used by tests.
- **Fail-open** — when something cannot be read or is malformed, carry on with the built-in default instead of stopping (how `config.yml` is read today). The opposite, **fail-closed** or "refuse", is used where guessing could lose work.
- **Canonical JSON** — the one fixed way of writing a JSON value (keys sorted, no spaces), so that the same data always gives the same bytes and therefore the same hash or signature.
- **Hash** — a fixed-length fingerprint of some bytes (sha256 here); change one byte and the fingerprint changes.
- **Lease** — a record saying "this worker owns this phase right now", with a heartbeat so a dead owner can be told apart from a slow one.
- **Snapshot** — a git commit object, not on any branch, holding every file in the working tree at a moment (including files git is not yet tracking), so nothing is lost when work is paused or a crashed cycle is cleaned up.
- **Hard filter** — the yes/no checks a candidate must pass before it is even scored (is it available, does it have the tools, is the context window big enough).
- **Total order** — a ranking with a fixed tie-break so two equal scores never depend on luck.
- **Compare-and-swap** — write your own token, read it back, proceed only if it is still yours; the way two processes avoid both taking a lock.
- **Provenance** — where a fact came from and why the engine believes it.
- **Adapter** — the one place provider- or runtime-specific code lives; the engine's core only sees the adapter's normalised answers.
- **Tier** — the brief's 0–4 capability scale (Utility, Scout, Engineer, Architect, Principal), never a model name.

### 2.1 The split: the engine decides and records, the lead executes

```
                      (judgement)                          (rules, records, time, crypto)
   Claude Code lead  ─────────────────────▶  scripts/engine.sh  ─▶  engine/bin/dev-team-engine.mjs
   skills/commands/     "route this task",                            │
   hooks/autopilot      "lock this plan",                             ├─ adapters/ (claude-code, codex, gemini*, kimi*, grok*)
        ▲               "here is a quota message",                    ├─ lib/ (routing, plan, drift, lease, snapshot, quota, …)
        │               "is this drift?"                              ├─ sim/ (synthetic providers + fake clock)
        │                                                             └─ data/ (floors, weights, profiles, compat data)
        │  JSON decision + exit code                                       │
        └──────────────────────────────────────────────────────────────────┘
        then the lead spawns the worker (Task tool with `model:` set from the decision, or `codex exec …`)

   State written by the engine:
     .dev-team/orchestrator.json                       config (committed, marker, schema)
     .dev-team/jobs/<jobId>/job.json                   Job/Phase/Task/Attempt/Artifact/lease/checkpoint/evidence (committed)
     .dev-team/jobs/<jobId>/decisions.json             RoutingDecisionRecords + hand-over/takeover/fallback events (committed)
     .dev-team/jobs/<jobId>/review-contract.<id>.json  ReviewContract (committed)
     .dev-team/plans/plan-contract.<planId>.v<n>.json  PlanContract (committed, hashed)
     .dev-team/invariants.json                         invariant registry (committed)
     .dev-team/verdict.json                            1.0 + optional reviewer/independence/status fields (committed)
     refs/dev-team/snapshots/<job>/<phase>/<n>         work snapshots (git refs; never pushed)
     $CLAUDE_PLUGIN_DATA/catalogue/<provider>.json               normalised profiles + provenance (local)
     $CLAUDE_PLUGIN_DATA/remote-catalogue/{verified.json,stamp}  (local)
     $CLAUDE_PLUGIN_DATA/quota/<provider>.json                    observations (local)
     $CLAUDE_PLUGIN_DATA/health/<provider>.json                   health/brownout history (local)
     $CLAUDE_PLUGIN_DATA/learning/<yyyy-mm>.json                  global learning records, no code (local)
     $CLAUDE_PLUGIN_DATA/projects/<repo-key>/…                    leases, session ids, events, project competency, shadow samples (local)
   * unverified adapters
```

`* unverified` = written from public documentation only; exercised through the simulator; capability values `UNKNOWN` until a probe runs on a machine that has the tool.

### 2.2 Object model and where each object lives

Every committed file carries the ownership marker as its **first key** (`"dev-team": "ledger=<kind> schema=1.0"`), written with two-space pretty-printing so `{` is line 1 and the marker is line 2 — exactly where `hooks/guard-ledgers.sh` Rule 1 looks (its first-three-lines test at `guard-ledgers.sh:325`) and the same rule as `verdict.json` today (`conventions.md`, point 3). Every such file enters the read-before-write ownership rule (point 4). Every file — committed or local — has a JSON Schema in `schemas/` with a `description` on every property and a fixture in `tests/fixtures/`, and every real JSON file in the repository is listed in `schemas/manifest.json` (see increment 0a) so CI validates real files as well as samples. The engine validates on read with its built-in subset validator and treats an invalid **local cache** as absent (fail-open), but **refuses** to act on an invalid `job.json`, plan contract or lease, because guessing there loses work.

| Object | Fields (plain words) | Lives in | Marker kind | Schema |
|---|---|---|---|---|
| **Job** | id, title, requirement source (the request text and, if given, an issue number whose text is data not instructions), risk, budget policy, profile, phases[], status, createdAt, provider provenance summary across phases | `.dev-team/jobs/<jobId>/job.json` | `job` | `schemas/job.schema.json` |
| **Phase** | id, kind (DISCOVERY…FINAL_AUDIT), status, lease (below), checkpoint refs, tasks[], completion evidence, plan ref (planId + version) | inside `job.json` | — | same |
| **Task** | id, task types[] (compound allowed), risk, required runtime capabilities, files owned/forbidden, acceptance criteria refs, decomposition score, attempts[], maxAttempts | inside `job.json` | — | same |
| **Attempt** | n, decision id, worker (provider/model/runtime/role/effort — model id is data here), startedAt/endedAt, completion state (CONFIDENT/UNCERTAIN/BLOCKED/NEEDS_REVIEW/FAILED), failure class, progressMade (true/false — for convergence), artifacts[], findings[] | inside `job.json` | — | same |
| **Artifact** | id, kind (plan/decision/diff/test-result/checkpoint/architecture-doc/migration-script/review-report/snapshot), ref (path, commit or ref name), produced by (attempt id → provider/model/runtime) | inside `job.json` | — | same |
| **ReviewFinding** | stable id (`V-`/`I-`/`F-` today), severity (BLOCKING/IMPORTANT/MINOR/OPTIONAL/FALSE_POSITIVE, mapped from critical/high/medium/low/n-a), status (OPEN/ACCEPTED/REJECTED/FIXED/VERIFIED/DEFERRED/FALSE_POSITIVE), reviewer (provider/model/runtime), resolution | `verdict.json` claims[] gain optional `status`, `reviewer`, `resolution`; the job keeps refs | `verdict` (unchanged 1.0) | `schemas/verdict.schema.json` (additive) |
| **PhaseExecutionLease** | jobId, phaseId, provider, model, runtime, agentSessionId (Claude agent id / Codex thread id — local only), reasoningConfiguration, workspaceReference (branch, worktree), checkpointReference, startedAt, lastProgressAt, quotaState, quotaResetTime (+provenance), phaseStatus (RUNNING/PAUSED_AWAITING_QUOTA/BLOCKED_AWAITING_AGENT/COMPLETED/ABANDONED), snapshotRef | committed part inside `job.json`; session ids and heartbeat in `$CLAUDE_PLUGIN_DATA/projects/<repo-key>/leases/<jobId>.<phaseId>.json` | `job` | `schemas/job.schema.json`, `schemas/local/lease-local.schema.json` |
| **PlanContract** | planId, planVersion, planHash (sha256 of canonical JSON of `contract`), status (DRAFT/LOCKED/SUPERSEDED), approvedAt, approvedBy, supersedes, `contract` { requirements, constraints, invariants, architecturalDecisions, implementationTasks, acceptanceCriteria, testsRequired, rollbackRequirements } | `.dev-team/plans/plan-contract.<planId>.v<n>.json` (this plugin's own plan lives at `.claude/plans/orchestrator-v2/plan-contract.orchestrator-v2.v1.json` — see "dogfooding" in increment 0a) | `plan-contract` | `schemas/plan-contract.schema.json` |
| **ReviewContract** | planRef, resultingDiff (base..head), deterministicResults (test/build/lint refs), declaredDeviations[], invariants[], requiredReviews[] (specialist list), independence requirement, adversarial flag | `.dev-team/jobs/<jobId>/review-contract.<reviewId>.json` | `review-contract` | `schemas/review-contract.schema.json` |
| **CompletionEvidence** | acceptanceCriteria passed/total with refs, tests (command, exit, ref), build, lint, securityReview, blockingFindings count, unresolved warnings, migration checks, plan version, files changed, self-reported confidence, engine verdict (COMPLETE/INCOMPLETE with reasons) | inside `job.json` per phase/task | `job` | `schemas/job.schema.json` |
| **RoutingDecisionRecord** | id, task types, risk, preferred/minimum tier, provider, model (data), runtime, role, agent file, reasoning effort (requested → applied), phaseSticky, candidates considered with scores and rejection reasons, selectionReasons[], inputs hash, catalogue stamp, quota/health stamps, independence level (for reviews) | `.dev-team/jobs/<jobId>/decisions.json` (array); ad-hoc decisions with no job → local `projects/<repo-key>/decisions/adhoc.json` | `decisions` | `schemas/decisions.schema.json` |
| **ModelCapabilityProfile** | exactly section 7's fields; every unknown value is the string `UNKNOWN`; each important classification carries `{value, confidence, sources[]}` (section 8); `canaryStage` | `$CLAUDE_PLUGIN_DATA/catalogue/<provider>.json` | — (local) | `schemas/local/model-capability-profile.schema.json` |
| **QuotaObservation** | provider, runtime, observedAt, state (HEALTHY…UNKNOWN), cause (the four section-30 causes or null), scope (SESSION/WEEKLY/MODEL_FAMILY/SPEND_LIMIT/UNKNOWN), family, resetAt or null, resetAssumptions[] (DATE_NEXT_OCCURRENCE, ZONE_MACHINE), confidence, source (ERROR_TEXT/APP_SERVER/USER_STATED/CATALOGUE), rawRedacted | `$CLAUDE_PLUGIN_DATA/quota/<provider>.json` | — (local) | `schemas/local/quota-observation.schema.json` |
| Config | section 86's block in JSON, plus `profile`, plus the plugin's additive keys (`routing.sequentialDeepWork`, `routing.tierOverrides[]`, `overrides[]`, `providers.openai.appServerQuota`, `remoteCatalogue.url`) | `.dev-team/orchestrator.json` | `orchestrator-config` | `schemas/orchestrator-config.schema.json` |
| Invariant registry | invariants[] { id, text, source (AGENTS.md / CLAUDE.md / .claude/ / .openai/ / pack / user / PROJECT.md#Constraints), blocking: true/false, packId } | `.dev-team/invariants.json` | `invariants` | `schemas/invariants.schema.json` |

Why `jobs/<jobId>/` rather than one repo-wide file: parallel run branches would conflict on a single append-only file; per-job files merge cleanly and are validated by `check-jsonschema` as ordinary JSON. Why nothing machine-local goes inside the repo: `.dev-team/.gitignore` is created once with exactly `loop.lock/` and never overwritten (`conventions.md` point 7), and a file that cannot be committed by accident is safer than a gitignore line.

`autopilot.json` stays the loop's file and only the conductor writes it (`conventions.md`, point 3). It gains two optional fields: `job_ref` (path to the job file) and `paused` (`{is, phaseId, snapshotRef, resetAt}`), and — folding in issue #43 — gets `schemas/autopilot.schema.json`. `schema` stays `"1.0"` because both fields are additive. `loop.lock/holder` gains `state` (`running|paused`) and `snapshotRef`.

**The line between the two config files.** `.dev-team/config.yml` keeps every 1.x key (`defaults.*`, `git.*`, `features.*`), read by hooks and skills with the tolerant grep (`config-and-toggles.md:168-177`); 2.0.0 adds one 1.x-style key there, `git.push-after-task` (increment 11), and nothing else. `.dev-team/orchestrator.json` holds only engine keys and is read only by the engine. A **profile** (`engine/data/profiles/<name>.json`) may carry engine keys only; it cannot set a `config.yml` key. Where the owner's preset wants a `config.yml` value (`git.default-branch: alpha`, `git.push-after-task: on`), `/dev-team-config init --profile mwbm-standard` **offers** those two lines, the way the pointer sentence is offered (`conventions.md` point 8), and never writes them silently. Every key a profile may carry is listed in `schemas/orchestrator-config.schema.json`.

**A committed config file never carries a credential.** `remoteCatalogue.url` is constrained by schema to `^https://[^@/?#]+/[^?#]*$` (no user:password part, no query string), the engine refuses to write `orchestrator.json` if any string value matches `redact()`'s credential patterns, and `doctor` warns if an existing file does (brief 89, "generated committed configuration").

### 2.3 Engine command surface

Invoked as `bash ${CLAUDE_PLUGIN_ROOT}/scripts/engine.sh <command> [subcommand] [--flags]`, the same way `commands/dev-team-sync-branches.md:7` calls `branch-hygiene.sh`. Output is always one JSON object on stdout (`--format text` gives a human rendering), shaped `{ "engine": {"version", "command", "schema": "<output schema path>"}, "ok": bool, "result": {...}, "problems": [...] }` and validated by `schemas/engine/envelope.schema.json` plus one output schema per command. Free text that may be large or sensitive (a provider error message, a plan contract body) is read from **stdin** (`--stdin`) or a file (`--file`), never from the command line, because command lines are visible to every process on the machine. Nothing is ever printed that came from a credential file, and provider error text passes through `redact()` before it is stored or printed.

Exit codes (fixed, documented in `docs/orchestrator/engine-commands.md`, tested in `tests/engine.bats` and `engine/test/cli.test.mjs`):

| Code | Meaning |
|---|---|
| 0 | done; `result` is the answer |
| 1 | a negative decision that is itself the answer (NO_SUITABLE_AGENT_AVAILABLE, drift STOP, gate PROHIBITED, evidence INCOMPLETE) |
| 2 | bad input (unknown command, invalid flags, a file failing its schema) |
| 3 | engine unavailable (shim: Node missing or older than 22; `DEV_TEAM_NO_ENGINE` set) — "1.x behaviour continues" |
| 4 | state conflict (lease held by a live owner, plan already locked at that version, job not found, HEAD moved since the snapshot) |
| 5 | verification failure (catalogue signature invalid or key mismatch, plan hash mismatch, snapshot ref missing, secret found in a snapshot candidate) |

| Command | Inputs | Output (schema) | Increment |
|---|---|---|---|
| `doctor` | `--format` | tool presence/versions, data dir path and whether it was the fallback, writable, config validity, adapter status (verified / unverified — from 0b), what is missing and what 1.x fallback applies (`engine/doctor.output`) | 0a |
| `schema validate [--all \| --file --schema]` | files, or the manifest | validation result (used by CI and by `doctor`) | 0a |
| `discover [--provider <id>] [--refresh]` | none | normalised profiles written to the local catalogue; provenance per field; `removed[]` for models that disappeared since the last cache (`engine/discover.output`) | 0b (Claude, Codex), 1 (classification) |
| `sim run --scenario <name> [--all]` | scenario file | pass/fail per assertion | 0b (harness); each increment adds scenarios |
| `catalogue show / refresh / reject --model / override --model --field --value` | catalogue + overrides | merged catalogue with precedence applied (`engine/catalogue.output`) | 1 |
| `route --request-file <json>` | task types, risk, required capabilities, context estimate, role, phase, job id | RoutingDecisionRecord (`schemas/decisions` item) — exit 1 with NO_SUITABLE_AGENT_AVAILABLE | 1 |
| `explain --decision <id>` | decision id | the concise reasons (section 81) (`engine/explain.output`) | 1 |
| `dry-run --job <id> or --phases-file <json>` | planned phases | per-phase tier, provider, effort, review strategy, fallback ladder, quota implications, cost bands, gates, "questions for the owner, with why" (`engine/dry-run.output`) | 1 (tiers/effort/review/questions), 7 (cost/quota) |
| `job init / status / record` | request, issue number, phases | job file created/updated (`job`) | 3 |
| `plan draft / lock / verify [--file <path>] / diff` | contract JSON (stdin or file); approver | plan file with hash and status; `verify` recomputes the hash of any plan file, including the copy in `.claude/plans/`; `diff` between versions (`engine/plan.output`) | 3 |
| `drift --plan --task --changed-files --declared` | changed file list, declared deviations | NO_DRIFT / MINOR_IMPLEMENTATION_DETAIL / SIGNIFICANT_DRIFT / ARCHITECTURAL_DRIFT + STOP instruction (exit 1 on the last two) | 3 |
| `evidence check --task` | evidence JSON | COMPLETE/INCOMPLETE with the failing gates listed (exit 1 on INCOMPLETE) | 3 |
| `checkpoint create / verify / list` | job, phase, kind | CheckpointRecord (`engine/checkpoint.output`) | 3 |
| `attempt record` | task, outcome, progressMade | attempt appended; exit 1 with ATTEMPT_CAP_REACHED when `maxAttempts` is hit or no progress in two attempts | 3 |
| `snapshot create [--reason pause\|reclaim] / restore / list / prune` | job, phase | snapshot ref (or `CLEAN_TREE`); restore refuses if HEAD moved (exit 4); create refuses on a secret hit (exit 5) | 4 |
| `lease acquire / heartbeat / pause / resume / release / status` | job, phase, owner identity | lease state; exit 4 when held by a live owner | 4 |
| `quota observe --provider --stdin \| --json-file <app-server snapshot>`; `quota status` | raw message (stdin) or snapshot | QuotaObservation with state, cause, scope, resetAt or null, assumptions, confidence; `status` lists every provider's latest observation and whether it is still in force | 4 |
| `fallback --decision <id> --reason` | a failed pre-phase candidate | next candidate down the section-38 ladder, recorded, with `preferred` kept for the next phase | 4 |
| `takeover --job --phase --reason RETIRED\|…` | lease | controlled takeover plan (section 37 ladder), `MID_PHASE_TAKEOVER_OCCURRED` recorded, `reviewStrengthening: FULL_CATCH_UP` set | 4 |
| `review plan --job --phase` | job, verdicts so far | ReviewContract + reviewer routing with independence level and specialist list | 5 |
| `findings update --id --status --reviewer` | verdict.json | lifecycle transition validated; precision counters updated locally | 5 |
| `gate check --action <kind> [--evidence]` | action kind, evidence | AUTO / REQUIRE_HIGH_CONFIDENCE / REQUIRE_REVIEW / REQUIRE_HUMAN_APPROVAL / PROHIBITED and the bucket it maps to (exit 1 on PROHIBITED) | 6 |
| `invariants collect / show` | repo files | registry rebuilt from sources; each invariant with its source | 6 |
| `budget status / reserve check` | job, phase | remaining vs reserve; warnings | 7 |
| `estimate --job` | job | LOW/LIKELY/HIGH bands with the caveat | 7 |
| `learn record / query / purge` | attempt outcome | local record appended; competency query; purge on request | 8 |
| `health observe / status` | latency/error signals | provider health state | 8 |
| `catalogue verify --file <envelope>` / `catalogue fetch` | signed envelope | signature result; merged only if valid and not expired (`engine/catalogue-verify.output`) | 9 |
| `report --job [--progress] [--history] [--provenance <artifact>]` | job, learning data | run report, progress table, history views, provenance walk | 3 (progress), 8 (history), 10 (provenance) |

### 2.4 Adapter interfaces

`engine/adapters/base.mjs` declares the JSDoc types; every adapter implements them; the registry `engine/adapters/index.mjs` lists them; **central routing never names a provider or model** — it consumes profiles.

```js
/** @typedef {Object} ProviderAdapter
 *  id: 'anthropic'|'openai'|'google'|'moonshot'|'xai'   // provider ids are stable words, not model names
 *  verified: boolean                                     // false = documented-but-unverified (D3)
 *  discoverModels(): Promise<{models: RawModel[], reason?: string}>  // may return [] with a reason; never throws
 *  getModelMetadata(id), getLifecycle(id), getAvailability(id), getPricing(id), getCapabilities(id), getRateLimits(id)  // UNKNOWN when not knowable
 *  getQuotaState(), getQuotaResetTime()                  // delegate to the quota adapter
 *  healthCheck(): Promise<{state, latencyMs, evidence}>
 *  createAgent(spec): AgentInvocation                    // returns the exact spawn instruction for the lead (Task tool params or CLI argv) — the engine never spawns
 */
/** @typedef {Object} AgentRuntimeAdapter
 *  id: 'claude-code'|'codex'|'gemini-cli'|'kimi-cli'|'grok-build'
 *  supports: { filesystem, shell, git, tests, mcp, subagents, structuredOutput, reasoningControl, contextIsolation, sessionResume, checkpointResume, network, reviewMode }  // each true|false|'UNKNOWN'
 *  invoke(spec) → AgentInvocation; resume(sessionRef, spec) → AgentInvocation
 *  classifyError(text) → FailureClass (section 84) — also the "runtime rejected a model" discovery-refresh trigger
 *  effortLevels(modelProfile) → string[]                  // what this runtime lets us set for that model
 */
/** @typedef {Object} QuotaAdapter
 *  parseMessage(redactedText) → QuotaObservation | null
 *  readSnapshot() → QuotaObservation | null              // Codex app-server, behind config flag; otherwise null
 */
```

Adapters shipped:

- **Claude Code (verified).** Provider: model aliases from `engine/data/compat/claude-aliases.json` (the same table as `model-routing.md`; compatibility metadata, allowed by section 3; each entry carries `trust: "maintained"` so it starts at canary stage TRUSTED — see increment 1), `claude --version`; availability = "the session is authenticated" (`claude auth status --json` reduced to one boolean — never printed). Runtime: filesystem/shell/git/tests/MCP/subagents/structuredOutput (`--json-schema`)/contextIsolation (`isolation: worktree`)/sessionResume (documented agent-id resume — **hand test HT-1**)/checkpointResume (engine's structured checkpoint) all true; reasoningControl true but **frontmatter-only** (effort per agent file); reviewMode via read-only tools. `createAgent()` returns Task-tool parameters: `subagent_type` (role agent file, chosen by effort), `model` (spawn-time parameter — **hand test HT-2**; with the file's effort still applied — **HT-2b**), prompt. Quota: error-text parser (`session limit · resets 9:20pm (Europe/London)`, family limits "Opus limit"/"Sonnet limit", weekly, spend) → observation with zone stated, date assumed; app-server: none. **Known limit:** when a Claude sub-agent hits the seat allowance, the lead's own next call fails too (the allowance is shared across models), so the lead cannot run the pause sequence at that moment — see section 6, "paused ≠ crashed", for how work is still kept.
- **Codex (verified as worker/reviewer).** Provider: `codex debug models` with a 5 s timeout, falling back to `~/.codex/models_cache.json` read-only; keeps only `slug, display_name, context_window, supported_reasoning_levels, default_reasoning_level, visibility, priority, upgrade, supported_in_api` — never `model_messages`; reads `~/.codex/config.toml` `model` and `model_reasoning_effort` with the minimal TOML reader; never opens `~/.codex/auth.json`; family hints from `engine/data/compat/openai-families.json` (family prefix → provisional tier, `HEURISTIC` provenance). Runtime: `codex exec -s read-only|workspace-write --json --output-schema <file> -o <file> -c model_reasoning_effort='"<level>"' -m <model>` (the `-c` value is TOML, so the level needs its own quotes inside the shell quotes — the form that worked on this machine, `.claude/HANDOFF.md:152-155`); `codex exec resume <thread>`; `--ephemeral` for probes. Quota: error text (`try again at 9:30 PM`, no date, no zone → low confidence) now; `account/rateLimits/read` snapshot (`resetsAt` nullable → UNKNOWN stays possible) behind `providers.openai.appServerQuota: true`.
- **Gemini CLI, Kimi Code CLI, Grok Build (unverified).** Flags from public docs in `engine/data/runtimes/<id>.json` (documented in D3's departure note); `supports.*` = `'UNKNOWN'` except what the docs state; `discoverModels()` returns `[]` with `reason: 'UNVERIFIED_ADAPTER'`; exercised only by the simulator.

**Discovery field mapping (what the two verified adapters can actually fill).** Every other section-7 field is written as the string `UNKNOWN` with provenance absent.

| Profile field | Codex source (`codex debug models` / cache / config) | Claude Code source |
|---|---|---|
| provider / runtime | constant `openai` / `codex` | constant `anthropic` / `claude-code` |
| providerModelId | `slug` | alias from `claude-aliases.json` (`fable`, `opus`, `sonnet`, `haiku`) |
| availability | `AVAILABLE` if the slug is in the live `codex debug models` output and `codex login status` reports logged in; `UNKNOWN` if only the cache file could be read | `AVAILABLE` if `claude auth status` reports logged in, else `UNKNOWN` (no per-model listing exists) |
| lifecycleStatus | `visibility: "list"` + `upgrade: null` → `ACTIVE`; `visibility: "hide"` → `UNKNOWN` (hidden is not retired — e.g. `codex-auto-review`); `upgrade` set → `LEGACY` (a successor is named); missing from the live list but present in the previous cache → `RETIRED` candidate with confidence 0.5 (confirmed only after two consecutive discoveries) | `ACTIVE` for every alias in the compat table; a failing alias (spawn error classified MODEL_UNAVAILABLE) → `UNKNOWN` and a refresh trigger |
| contextWindow | `context_window` | `contextWindow` from the compat table (documented value, provenance `HEURISTIC`) |
| reasoningControls[] | `supported_reasoning_levels` | `["low","medium","high","xhigh","max"]` from the compat table (frontmatter-only; provenance `RUNTIME_DISCOVERY` once HT-2b confirms) |
| defaultReasoning | `model_reasoning_effort` from `config.toml` if set, else the catalogue's `default_reasoning_level` (config overrides catalogue; both recorded) | session `effortLevel` is not read (it is a user setting, not a model fact) → `UNKNOWN` |
| runtimeCapabilities[] | the Codex runtime adapter's `supports` map | the Claude runtime adapter's `supports` map |
| capabilityTier | `openai-families.json` hint by slug prefix (e.g. `gpt-6` → 3, `gpt-5.6` → 3, `gpt-5.5` → 2, otherwise `UNKNOWN`) with `HEURISTIC`, confidence 0.6; overridable | `claude-aliases.json` (fable → 4, opus → 3, sonnet → 2, haiku → 1), `HEURISTIC` from maintained compat data, confidence 0.8 |
| canaryStage | `VALIDATED` when a family hint exists, else `PROVISIONAL` | `TRUSTED` (`trust: "maintained"`) |
| latencyClass / monetaryCost / tokenCost / creditCost / pricing / rate limits | `UNKNOWN` (subscription; not reported) | `UNKNOWN` |
| relativeCostClass (plugin addition) | 2 (the `run-report.md` weight for the external executor) | 9 / 6 / 2 / 1 per `run-report.md:53-59` |
| lastValidated | discovery time | discovery time |

### 2.5 How skills, commands, hooks and autopilot call it

- **Detect first, never fail** — the posture `orchestration-profiles.md:53-55` already uses for Codex: each skill's front matter step runs `engine.sh doctor --quiet`; exit 3 → the skill says once "engine not available (Node 22+ needed): using the 1.x roster" and follows the 1.x text, which stays in every file as the fallback path.
- **Orchestrator** (`SKILL.md` steps 1, 4, 5, 6, 7): step 1 `job init`; step 4 `route` per workstream (inputs: task types + risk judged by the lead, required runtime capabilities, context estimate); step 5 pastes the decision id and the applied effort into the brief (`task-brief-template.md` "Model tier / endpoint agent" section becomes "Routing decision"); step 6 `evidence check` before accepting a wave and `attempt record` after each return; step 7 `checkpoint create` and `drift`.
- **Review** (`dev-team-review/SKILL.md`): `review plan` chooses the reviewer with the independence ladder; `findings update` on every transition; verdicts stay in `verdict.json` (the engine writes claims on behalf of the review skill — the conventions table row says so from increment 5).
- **Autopilot** (`loop-runtime.md`): step 3 LOCK also `lease acquire`; step 5 heartbeats both; on a quota error the lead — when it can still act — runs `quota observe` → `lease pause` (which snapshots) → `paused` in `autopilot.json` and `state: paused` in `loop.lock/holder`; crash recovery **always snapshots before any reset** and never resets a paused lock (section 6).
- **Commands:** `/dev-team-doctor` (new, increment 0a), `/dev-team-explain` (new, increment 1), `/dev-team-status` gains engine-backed sections (progress table from 3; lease, pause state and `quota status` from 4), `/dev-team-report` gains history views (8), `/dev-team-config show` prints the effective `orchestrator.json` with sources and `init --profile <name>` writes it (1).
- **Hooks:** stay bash and keep grepping `config.yml`. `guard-ledgers.sh` Rule 1's name list gains `orchestrator.json`, `job.json`, `decisions.json`, `invariants.json`, `review-contract.*.json` and `plan-contract.*.json` (bash `case` globs; marker still required on one of the first three lines) so a marker-bearing engine file can never land outside `.dev-team/`. `guard-dev-team.sh` is unchanged.
- **Config:** no new key in `config.yml` for the engine (an earlier draft had an `orchestrator:` pointer line; dropped — the engine simply looks for `.dev-team/orchestrator.json`). `profile: "mwbm-standard"` in that file selects the owner's preset; built-in defaults are the brief's.

### 2.6 The 1.x fallback when Node is absent

`scripts/engine.sh`: finds `node` on PATH (also `$DEV_TEAM_NODE` if set), checks `node --version` ≥ 22, otherwise prints one line to stderr — "dev-team engine needs Node 22 or newer (found: none). The 2.0 orchestrator features are off; the 1.x behaviour continues." — and exits 3. It never guesses. Skills treat exit 3 as "engine off". `DEV_TEAM_NO_ENGINE=1` forces the same for a session (documented in the env-switch table). The data folder is `$CLAUDE_PLUGIN_DATA`, else `--data-dir`, else `$DEV_TEAM_DATA_DIR`, else the documented default `~/.claude/plugins/data/dev-team-dev-team` with one warning line on stderr saying the fallback was used (**hand test HT-0** checks whether `CLAUDE_PLUGIN_DATA` reaches a skill's Bash call at all). Bats tests prove every path. **What the fallback cannot do:** without the engine, autopilot's crash recovery keeps today's lossy rule (uncommitted work discarded after a confirmed-stale lock), and the docs say so.

---

## 3. Mapping

### 3.1 Brief sections 1–101 → increment (or departure)

| Sections | Increment | Notes |
|---|---|---|
| 1, 2 | 1 (roles/tiers), 3 (phases), 4 (continuity) | philosophy realised across the object model |
| 3 | 0b (audit widened, compat data), 1 (routing consumes profiles) | model ids allowed only in adapter compat data, fixtures, records, overrides |
| 4 | 0b (types document), 3 (job file) | |
| 5 | 0b | adapter interfaces + Claude/Codex; unverified trio = departure DEP-1 |
| 6 | 0b (Claude, Codex discovery; disappearing model; discovery failure; cache invalidation), 1 (refresh triggers: TTL, credentials fingerprint change, runtime-rejected-model, lifecycle change, user request), 7 (quota-change trigger) | |
| 7, 8 | 0b (profile shape, UNKNOWN, provenance, field mapping), 1 (classification) | |
| 9 | 1 | tier 4 never default: floors table + score penalty |
| 10 | 1 | specialisations in profile; specialist bonus in score |
| 11, 12, 13, 14 | 8 | 13's failure class recorded from increment 3 onward; learning ON by default, local only |
| 15 | 3 | job init runs deterministic discovery (git facts, manifests) before any LLM scout; recorded as artifacts |
| 16 | 9 | plugin side only; departure DEP-2 (no live service) |
| 17, 18, 19 | 1 (fixed stages: compat-listed TRUSTED/VALIDATED, unknown PROVISIONAL), 8 (dynamic promotion, probes) | |
| 20, 21 | 1 | taxonomy; lead supplies, engine validates and records |
| 22, 23 | 6 | |
| 24, 25, 26, 27 | 3 (and the hand-lock of this plan in 0a) | PlanContract/ReviewContract/lock/drift |
| 28 | 3 | change-minimisation as a plan constraint the checker verifies; corrects the analysis's "YES" to PART |
| 29, 30, 31, 32, 33, 34, 35, 36, 37, 38 | 4 | 31.11 "recheck around reset" = host wait + loop re-fire; departure DEP-4; 31.3 "save worktree state" = snapshot |
| 39 | 1 | floors table in this plan |
| 40, 41, 42, 43 | 7 | 42's "percentage of remaining allowance" UNKNOWN on Claude — DEP-5 |
| 44 | 1 | budget policies |
| 45 | 1 (mapping table), 2 (role × effort agent files) | DEP-14 |
| 46, 47, 48 | 3 | structured completion state + evidence gate |
| 49 | 2 | rename to role names, aliases for one release |
| 50, 51, 52, 53, 54 | 10 | nesting checked by HT-4 first |
| 55, 56, 57, 58, 59, 60, 61, 62, 63, 64 | 5 (62's counters feed 8) | |
| 65 | 8 | available, OFF by default — DEP-3 |
| 66, 67 | 1 (rules), 3 (attempt caps), 8 (context quality before escalation) | |
| 68, 69 | 8 | |
| 70, 71, 72 | 1 | reproducible given recorded inputs — DEP-6 |
| 73, 74 | 3 | checkpoint summaries reuse Codebase Map / Current status |
| 75, 76, 77 | 6 | |
| 78 | 3 | evidence gate + stop rule + attempt caps |
| 79, 80, 81, 82 | 1 | dry-run cannot avoid the lead's own planning tokens — DEP-7 |
| 83 | 8 | CLI/JSON views, no UI — DEP-8 |
| 84, 85 | 4 (classes and recovery), 3 (bounded attempts, progress tracking) | |
| 86, 87 | 0a (file + schema), 1 (overrides, profiles, `/dev-team-config init --profile`), 4 (continuity), 7 (quota), 8 (learning), 9 (remote) | JSON not YAML — DEP-9 |
| 88 | 0b (Codex visibility/upgrade → lifecycle mapping), 1 (lifecycle in routing) | |
| 89 | 0a (redaction, no credential reads, committed-config rule), 9 (signatures), 12 (inspection in the gate) | |
| 90, 91, 92 | 3 (workflow shapes as job templates), 6 (critical path gates) | |
| 93 | every increment; consolidated in 12 | see §5 |
| 94 | 0b (harness), each increment (scenarios) | |
| 95 | 0b (event log), each increment | |
| 96 | 12 (plus per-increment docs) | |
| 97 | this plan is steps 8–10; the hand-lock in 0a is step 11; 12–16 are the increments | |
| 98 | 12 | runnable checklist `scripts/completion-gate.sh` |
| 99 | see 3.2 | |
| 100 | 1 (names, price≠intelligence, strongest/cheapest), 4 (quota anti-patterns, never lose work), 3 (silent architecture change, self-approval), 8 (benchmarks, unvalidated models), 6 (destructive), 9 (plugin update per model) | |
| 101 | 12 (documented as the design's aim) | |

### 3.2 Acceptance criteria (section 99, numbered in the brief's order) → increment

| # | Criterion (short) | Increment | # | Criterion (short) | Increment |
|---|---|---|---|---|---|
| 1 | no model names in central routing | 1 | 29 | local competency learning enabled | 8 |
| 2 | unknown future models discoverable | 0b/1 | 30 | project-specific competency | 8 |
| 3 | provisional classification | 1 | 31 | failure taxonomy recorded | 3/4/8 |
| 4 | canary routing | 1 (fixed stages) / 8 (promotion) | 32 | context quality before escalation | 8 |
| 5 | providers ≠ runtimes | 0b | 33 | capability provenance | 0b/1 |
| 6 | roles independent of models | 2 | 34 | remote signed intelligence | 9 (plugin side) |
| 7 | task ≠ risk | 1 | 35 | shadow evaluation available | 8 (off by default) |
| 8 | invariants first-class | 6 | 36 | cross-provider review preferred | 5 |
| 9 | policy packs | 6 | 37 | CRITICAL cross-provider required | 5 |
| 10 | strong planning front-loaded | 1/3 | 38 | review specialisation | 5 |
| 11 | plans versioned/lockable | 0a (hand lock) / 3 | 39 | adversarial review | 5 |
| 12 | drift detectable | 3 | 40 | finding lifecycle | 5 |
| 13 | decomposition intelligent | 10 | 41 | reviewer false positives → competency | 5/8 |
| 14 | parallelism risk-aware | 10 | 42 | provider diversity across Job | 5 |
| 15 | explicit integration | 10 | 43 | brownouts detected | 8 |
| 16 | git checkpoints recover | 3/4 | 44 | tool reliability separate | 8 |
| 17 | phases sticky | 4 | 45 | routing reproducible | 1 |
| 18 | ≤12 h pause/resume same owner | 4 | 46 | routing explainable | 1 |
| 19 | long/unknown never silent switch | 4 | 47 | cost estimated before execution | 7 |
| 20 | controlled takeover on retirement | 4 | 48 | dry-run exists | 1 |
| 21 | pre-phase fallback | 4 | 49 | destructive actions gated | 6 |
| 22 | quota reserves | 7 | 50 | human approval | 6 (extends 1.x gate ledger) |
| 23 | per-phase budgets | 7 | 51 | rollback first-class | 6 |
| 24 | scarcity influences routing | 7 | 52 | stop-work criteria | 3 |
| 25 | effort selected independently | 1/2 (within DEP-14 on Claude) | 53 | dashboards | 8 |
| 26 | completion confidence structured | 3 | 54 | new providers without rewriting routing | 0b (adapter registry) |
| 27 | completion requires evidence | 3 | 55 | comprehensive tests | every increment, gated in 12 |
| 28 | deterministic validation authoritative | 3 | | | |

### 3.3 Owner features F1–F31, P1–P5, R1–R4 → increment

| Feature | Increment | How / why not |
|---|---|---|
| F1 plain English standing rule | 11 | one paragraph added to `task-brief-template.md`, `checker-protocol.md`, `documentarian-protocol.md`, `handoff-template.md`; engine text output written plainly |
| F2 rules into CLAUDE.md | 11 | `/dev-team-config init --rules` offers (never adds silently) a rules block; same posture as the pointer sentence |
| F3, F4 handover triggers and contents | 3 (contents), 4 (paused line) | HANDOFF gains "tried and rejected", "verified vs assumed", "files that matter", "paused/blocked reason and reset time"; triggers "when something is learned" and "before a long step" added to the template |
| F5 Fable for analysis/planning, one after another | 1 | `mwbm-standard` preset: DEEP_ANALYSIS/DEEP_PLANNING preferred tier 4 via `routing.tierOverrides`, `routing.sequentialDeepWork: true` (parallelism cap 1 for those task types); debates stay side by side (recorded decision) |
| F6 fall back Fable→Opus, try Fable first | 4 | pre-phase fallback ladder + "preferred first on every new phase" rule |
| F7 cheapest suitable builder | 1 | preset: implementation task types preferred tier 2, Opus only when `route` scores judgement-heavy; built-in default stays BALANCED |
| F8 credit efficiency a real goal | 1, 7 | cost and scarcity penalties are first-class score terms; reserves |
| F9, F11, F12, F16, F22, F23, F26, P5 | already in the plugin | unchanged; F11's loop gains the Codex round from F10 |
| F10 Codex cross-check | 5 | Codex as first-class reviewer runtime, in addition to the Claude checker (the lead's recorded decision) |
| F13 push after each task | 11 | `git.push-after-task` in `config.yml` (1.x-style key), built-in off, offered by the preset; the main-branch block in `guard-dev-team.sh` stays |
| F14 update the owner's issue per task | 11 | `issue=<n>` run argument; comment-only updates to that one named issue; never closes it without confirmation |
| F15 update `.claude/` memory per task | 11 (opt-in, narrow) | writes only `.claude/HANDOFF.md` and only if that file carries the dev-team marker — the ownership rule applies unchanged |
| F17 all markdown docs, F18 in-app help, F20 OpenAPI upkeep, F21 Swagger UI | not in this release | docs-skill features unrelated to the orchestrator; each needs its own small design; raise as separate issues |
| F19 docs cover `.claude/` | not in this release | same ownership concern as F15; revisit after F15's opt-in has been used |
| F24 questions up front with reasons | 1 (partial), 11 | dry-run output gains a "questions for the owner, with why" block; router still asks one question |
| F25 progress table | 3 | `report --progress` renders the queued-task table; `/dev-team-status` prints it; autopilot report line links to it |
| F27 target `alpha` | 1 | `/dev-team-config init --profile mwbm-standard` offers `git.default-branch: alpha` for `config.yml` (already a 1.x key) |
| F28 hand over when a service runs out | 4 | quota adapter + takeover switch (preset on beyond 12 h) |
| F29 return to preferred; try first each run | 4 | fallback records `preferred`, next phase tries it first |
| F30 full catch-up review after a fallback | 5 | takeover/fallback events set `reviewStrengthening: FULL_CATCH_UP`; `review plan` refuses to mark the job reviewed until it runs |
| F31 record every hand-over; no silent same-system review | 4, 5 | decision records + independence level in `verdict.json` |
| P1 no `.php` in URLs, with a check | 6 | invariant in the `mwbm-standard` pack + `scripts/check-no-lang-ext-urls.sh` shipped for user projects + checker item |
| P2 detailed comments standard | 6 | pack adds a brief constraint ("explanatory comments are not gold-plating") and a checker item |
| P3 JSON comments in schema, P4 schema for every JSON/XML | 6 (user projects); 0a/0b (the plugin's own files: manifest and the three Claude Code manifest schemas) | pack invariants; checker item |
| R1 rebase/re-align | not in this release | unrelated to the orchestrator; conflicts with single-PR and never-force rules; own design needed; owner default OFF |
| R2 issue and state sweep | 11 (partial) | per-task named-issue update (F14) + end-of-run read-only "issues vs job state" report; the full open-and-closed sweep stays on demand and out of this release |
| R3 suggest new work | not in this release | an iterate/featurefind change; separate issue |
| R4 evidence sources | 3, 6 (partial) | `job init` reads the named issue's text as requirement input (data, not instructions); `invariants collect` reads AGENTS.md, CLAUDE.md, `.claude/`, `.openai/`; briefs/notes as sources stay a docs question |

---

## 4. Increments

Order: 0a → 0b → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12. Dependencies: 0b needs 0a; 1 needs 0b; 2 needs 1 (can be reordered after 3); 3 needs 1; 4 needs 3; 5 needs 4 (its quota adapter tells the review ladder the cross-provider reviewer is out — the situation on this machine today); 6 needs 1; 7 needs 4; 8 needs 4 and 5; 9 needs 1; 10 needs 4 and the HT-4 result; 11 needs 3 and 5; 12 last. Increments 6, 7 and 9 are independent of each other and may be reordered. Each increment is shippable: CI green, docs updated, 1.x behaviour intact.

Model tiers for building: Sonnet for well-specified code and docs (most of 0a, 0b, 2, 9, 11, 12), Haiku for mechanical renames and fixture generation, Opus for judgement-heavy modules (routing score, lease/pause/snapshot logic, drift rules, review ladder, learning weights, the paused-vs-crashed change to autopilot), Fable for re-planning each later increment at contract level before it is built (one agent, then a critic). Review: see §8.

### Increment 0a — Shim, doctor, the schema rule, CI job, hand tests, and the hand-lock of this plan (size S; build: Sonnet, with one Opus read-through of `schema.mjs` and `store.mjs`)

**Goal.** Ship the smallest thing a person can see working: `/dev-team-doctor` backed by a real engine call through the shim; the exit-3 "1.x continues" path proven by tests; the schema-and-manifest rule that every JSON file in the repository is validated in CI; the `engine` CI job; the four hand tests every later increment leans on; and — first of all, before any code — this plan locked as a PlanContract so that building happens against a locked plan (brief 97.11 before 97.12).

**Brief sections.** 86 (file + schema), 89 (redaction, no credential reads, committed-config rule), 96 (start), 97.11, 99.11 (hand lock).

**Step 0 — lock this plan by hand (no engine needed).** Create `.claude/plans/orchestrator-v2/hash-contract.mjs` (about ten lines: read a JSON file, take its `contract` object, write canonical JSON — keys sorted recursively, no whitespace — and print the sha256 hex) and `.claude/plans/orchestrator-v2/plan-contract.orchestrator-v2.v1.json` holding section 10 of this plan with `planHash` filled in by that script. `status` is `DRAFT` until the owner's answers to D1–D4 arrive; then `status: "LOCKED"`, `approvedAt`, `approvedBy: "owner"` are set and committed, before the first 2.0.0 code commit. Increment 3's `plan verify --file` later recomputes the same hash (the canonicalisation rule is fixed here so the two agree: JSON keys sorted by code point, no whitespace, UTF-8, `undefined` forbidden). **Dogfooding note:** this plugin repository does not get a `.dev-team/` folder for this; the locked contract lives in `.claude/plans/` because that is where this repository keeps its own working notes, and `plan verify --file` accepts any path.

**Files to create (repo-relative).**

- `scripts/engine.sh` — functions: `find_node()` (PATH, then `$DEV_TEAM_NODE`), `node_major()`, `find_data_dir()` (`$CLAUDE_PLUGIN_DATA`, `--data-dir`, `$DEV_TEAM_DATA_DIR`, then the documented default with one stderr warning), `refuse(reason)` (stderr line, exit 3), `main()` (exports `CLAUDE_PLUGIN_ROOT` and the chosen data dir, execs `node "$PLUGIN_ROOT/engine/bin/dev-team-engine.mjs" "$@"`). Header comment: why a shim (1.x must keep working), what it cannot do (cannot install Node; cannot know whether Claude Code passes `CLAUDE_PLUGIN_DATA` to a skill's Bash call — HT-0), rejected (bundling a Node binary).
- `engine/bin/dev-team-engine.mjs` — `main(argv)`: `parseArgs` → `dispatch(commandTable)` → `printEnvelope` → `process.exitCode`. Registers `doctor` and `schema`.
- `engine/lib/cli.mjs` — `parseArgs(argv) → {command, sub, flags, stdinText?}`, `ExitCodes = Object.freeze({OK:0, NEGATIVE:1, BAD_INPUT:2, UNAVAILABLE:3, CONFLICT:4, VERIFY_FAILED:5})`, `envelope(command, ok, result, problems)`, `renderText(command, result)`.
- `engine/lib/paths.mjs` — `pluginRoot()`, `dataDir()` (from the environment the shim set; refuses with BAD_INPUT if none), `repoRoot()` (`git rev-parse --show-toplevel`), `projectKey(repoRoot)` (first 16 hex of sha256 of `<absolute real path of git rev-parse --git-common-dir>|<root commit sha>` — shared by every worktree of one repository, stable across clones of the same history, reveals nothing; the common-dir text comes back as the relative `.git` from the main checkout, so it is resolved to an absolute real path first), `projectDataDir()`.
- `engine/lib/store.mjs` — `readJson(path)`, `writeJsonAtomic(path, value)` (temp file + rename), `readMarked(path, kind)` (returns `{status: 'absent'|'ours'|'not-ours'|'invalid', value}` using the `"dev-team"` field — the JSON form of `conventions.md` point 4), `writeMarked(path, kind, value)` (puts `"dev-team"` first, two-space indent, refuses `not-ours` with exit 4, refuses any string value matching `redact()`'s patterns with exit 2).
- `engine/lib/schema.mjs` — `loadSchema(relPath)`, `validate(schema, value) → {ok, errors:[{path, message}]}`; supports `type`, `required`, `enum`, `const`, `properties`, `additionalProperties`, `pattern`, `minimum`, `maximum`, `minItems`, `items`, `oneOf` (minimal), `$ref` to `#/$defs/…` in the same file; `validateManifest(manifestPath)` walks `schemas/manifest.json`. Header states what it cannot do (no `format`, no remote refs) and that CI's `check-jsonschema` is the full validator.
- `engine/lib/redact.mjs` — `redact(text) → string` replacing API-key shapes (`sk-`, `sk_live_`/`rk_live_`/`pk_live_`, `ghp_`, `github_pat_`, `xox[abp]-`, AWS `AKIA…`, JWT `eyJ…`, `Bearer …`, `user:pass@` in URLs) with `[REDACTED:<kind>]`; `looksLikeCredential(text) → boolean`; documented list; unit-tested with synthetic keys only.
- `engine/lib/doctor.mjs` — `runDoctor() → DoctorReport`: node version; data dir path and whether it was the fallback; writable; `git`, `jq`, `gh`, `bats`, `check-jsonschema`, `gitleaks` presence; `claude --version`; `codex --version` and `codex login status` reduced to `loggedIn: true|false|UNKNOWN`; `gemini`/`kimi`/`grok` presence; `orchestrator.json` validity and credential-shape warning; every schema loads; the manifest validates; a `fallbacks[]` list saying what 1.x behaviour applies for anything missing. Never reads `~/.codex/auth.json`, the keychain, or any env var whose name contains `KEY`/`TOKEN`/`SECRET`/`PASSWORD`.
- Schemas: `schemas/engine/envelope.schema.json`, `schemas/engine/doctor.output.schema.json`, `schemas/orchestrator-config.schema.json` (section 86's keys plus the plugin's additive keys, every one with a description; `remoteCatalogue.url` pattern as in §2.2), `schemas/manifest.schema.json`, and the data file `schemas/manifest.json` — a list of `{path, schema}` for every real JSON file in the repository outside `.claude/` (initially: the manifest itself, `schemas/*.schema.json` against the JSON Schema metaschema, and every `tests/fixtures/<name>.sample.json` against `<name>.schema.json`), plus an `exceptions[]` list with a reason per entry (initially empty; 0b adds nothing to it because it writes schemas for the three Claude Code manifests).
- Fixtures under `tests/fixtures/`: `envelope.sample.json`, `doctor.output.sample.json`, `orchestrator-config.sample.json`, `manifest.sample.json`. Naming rule: `tests/fixtures/<name>.sample.json` pairs with the schema whose file name is `<name>.schema.json` anywhere under `schemas/`; `tests/smoke-structure.sh` enforces that every schema has a fixture, every fixture a schema, and every `.json` file in the repository outside `.claude/` is either in the manifest or in its exceptions list.
- Tests: `engine/test/{cli,paths,store,schema,redact,doctor}.test.mjs`; `tests/engine.bats`.
- `commands/dev-team-doctor.md` — runs `bash ${CLAUDE_PLUGIN_ROOT}/scripts/engine.sh doctor --format text`; on exit 3 prints the shim's message and the 1.x note; read-only.
- Docs: `docs/orchestrator/README.md` (index), `docs/orchestrator/engine-commands.md` (doctor, schema, exit codes), `.claude/plans/orchestrator-v2/hand-tests.md`, and the two hand-lock files from Step 0.

**Files to change.**

- `.github/workflows/plugin-audit.yml` — new job `engine` (`name: engine`): `actions/setup-node` pinned by commit SHA to Node 22, `pipx install check-jsonschema` (the `test` job's install does not carry across jobs), `node --test engine/test`, `bash scripts/engine.sh schema validate --all`, and a `jq`-driven loop over `schemas/manifest.json` running `check-jsonschema --schemafile <schema> <path>` for every entry. Document the third required check name in README "Repo self-audit / CI".
- `tests/smoke-structure.sh` — check 8 iterates `find schemas -name '*.schema.json'` (no `globstar`, which macOS's `/bin/bash` 3.2 lacks — proven today); check 9: `scripts/engine.sh` executable, `engine/bin/dev-team-engine.mjs` present; check 10: fixture↔schema pairing and manifest coverage as above.
- `tests/README.md`, `CONTRIBUTING.md` (repo layout gains `engine/`, `docs/`; "Running the checks" gains `node --test engine/test` and `bash scripts/engine.sh schema validate --all`; a section "The engine: plain JavaScript, no dependencies, Node 22+"; the manifest rule), `README.md` (Install: "Node 22 or newer is optional; without it the 2.0 orchestrator features stay off and everything else works"; Commands table: `/dev-team-doctor`; env table: `DEV_TEAM_NO_ENGINE`, `DEV_TEAM_NODE`, `DEV_TEAM_DATA_DIR`; CI section lists the three required check names `audit`, `test`, `engine`), `CHANGELOG.md` (`## [Unreleased]` → 2.0.0 notes start), `.claude-plugin/plugin.json` (keywords `engine`, `orchestrator-v2`; version stays 1.5.0 until increment 12), `commands/dev-team.md` (mention `/dev-team-doctor`).

**Tests (concrete assertions).**
- `tests/engine.bats`: shim with `PATH` emptied of node → exit 3, stderr contains "needs Node 22 or newer", stdout empty; with a fake `node` printing `v18.0.0` → exit 3, message names the found version; `DEV_TEAM_NO_ENGINE=1` → exit 3; `CLAUDE_PLUGIN_DATA` unset and `--data-dir` given → exit 0 and no warning; both unset → exit 0 and one stderr warning naming the default folder; happy path `doctor --format json` → exit 0 and stdout parses as JSON with `.engine.command == "doctor"`.
- `schema.test.mjs`: each supported keyword has a pass and a fail case; `$ref` to `$defs` resolves; an unsupported keyword is reported as `problems[]`, not silently accepted; `validateManifest` fails when an entry's file is missing.
- `redact.test.mjs`: each pattern replaced; a plain sentence untouched; idempotent; `looksLikeCredential` true for `https://user:pw@host/` and false for `https://host/path`.
- `store.test.mjs`: atomic write leaves no temp file; `readMarked` returns `not-ours` for a JSON file lacking the field and `writeMarked` refuses it; the written file has `"dev-team"` on line 2; a value containing a synthetic `sk_live_` key is refused.
- `paths.test.mjs`: in a temp repo with a worktree, both checkouts give the same `projectKey`; a second clone with the same root commit gives the same key; a different repository gives a different key.
- `doctor.test.mjs`: with a fake `execFile` table, reports Codex present/logged-in true; with Codex absent, `fallbacks[]` contains the Claude-only note; a canary token planted in a fake `auth.json` never appears in any output; an `orchestrator.json` with `remoteCatalogue.url` carrying `user:pw@` produces a warning.

**Documentation.** As listed. **Migration.** None; 1.x users see one new read-only command and, if Node is absent, one message when they run it.

**Acceptance.** CI has three green jobs; `/dev-team-doctor` works on this machine and reports Codex logged in without printing account details; `engine.sh` exit-3 and data-dir paths proven by bats; the manifest validates in CI; the plan contract file exists with a computed hash (and flips to LOCKED on the owner's approval); the hand tests are recorded in `hand-tests.md` with the exact commands and observed output:
- **HT-0** whether `CLAUDE_PLUGIN_DATA` (and `CLAUDE_PLUGIN_ROOT`) reach a skill's Bash tool call and a hook, on Claude Code 2.1.265 — decides whether the shim's fallback folder is the normal path or a rare one;
- **HT-1** resume a named sub-agent by agent id (`SendMessage`) after it completes;
- **HT-2** the Task tool's spawn-time `model` parameter overrides the agent file's `model:`; **HT-2b** with that parameter set, the agent file's `effort:` is still applied (observed via a deliberately effort-sensitive prompt and, if available, the transcript's effort field);
- **HT-3** `hooks/guard-ledgers.sh` fires for a sub-agent's Write (closes the open item at `HANDOFF.md:84` and the hook header's "not confirmed by hand" line);
- (**HT-4**, optional now, required before increment 10) sub-agents can spawn sub-agents and what `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` is on this build.

**Review.** Stand-in fresh-agent review with refuter; Codex single high-effort review of the increment diff when its allowance allows (§8).

### Increment 0b — Discovery, adapters, compat data, simulator harness, event log, audit widening (size M; build: Sonnet; Opus read-through of `discover.mjs` and `canonical.mjs`)

**Goal.** The engine learns what is actually installed and authenticated (Claude Code and Codex), writes normalised profiles with provenance and `UNKNOWN`, records events, and can run a simulated scenario. The model-id audit widens to every provider's id pattern and the prose sites are reworded so it passes. No routing behaviour changes.

**Brief sections.** 3 (audit), 4 (types document), 5, 6 (discovery, disappearing model, failure, cache invalidation), 7, 8, 88 (lifecycle mapping), 94 (harness), 95 (event log), 96.

**Files to create.**
- `engine/lib/canonical.mjs` — `canonicalJson(value)` (keys sorted recursively by code point, no whitespace, rejects `undefined`/`NaN`/functions — the same rule as `hash-contract.mjs`, with a test asserting the two agree on the committed plan contract), `sha256Hex(bytes)`.
- `engine/lib/toml.mjs` — `readSimpleToml(text) → {values, unsupportedLines[]}`: `key = "string"`, `key = number`, `key = true|false`, `[section]`; anything else is reported, never guessed.
- `engine/lib/config.mjs` — `defaults()` (the brief's section-86 defaults as JSON), `loadProfile(name)` (engine keys only; a profile carrying an unknown key is rejected by schema), `loadOrchestratorConfig(repoRoot) → {effective, sources}` (built-in < profile < file; validated; an invalid file is reported and ignored — fail-open like `config.yml`), `readFlatConfigYml(repoRoot)` (line-regex reader for `defaults.models`, `git.default-branch`, `git.push-after-task`, `features.*` — the same tolerance as the hooks, never a YAML parser).
- `engine/lib/log.mjs` — `event(name, data)` appends one JSON line per event to `$CLAUDE_PLUGIN_DATA/projects/<key>/events/<yyyy-mm-dd>.jsonl` after `redact`; each line matches `schemas/local/event.schema.json`; event names are the section-95 list (constant `EVENTS`).
- `engine/lib/discover.mjs` — `discover({providers, refresh}) → {profiles, provenance, removed, cacheWrites}`: calls each adapter's `discoverModels()`, `normaliseProfile(raw, adapterId)` (every section-7 field present, `UNKNOWN` where not known, provenance per field per the §2.4 mapping table), compares with the previous cache to list `removed[]` (a model missing once is marked `RETIRED?` at confidence 0.5; missing twice → `RETIRED`), writes `$CLAUDE_PLUGIN_DATA/catalogue/<provider>.json` with `{fetchedAt, ttlHours: 24, profiles[]}`; a discovery failure (command absent, timeout, unparseable) keeps the previous cache, marks it `stale: true`, and reports the reason — never an empty catalogue over a good one.
- `engine/lib/time.mjs` is **not** created here (it belongs to increment 4, where a clock first matters).
- `engine/adapters/base.mjs` (typedefs + `unknownCapabilities()`), `engine/adapters/index.mjs` (`listAdapters()`, `getAdapter(id)`), `engine/adapters/claude-code/{provider,runtime,quota}.mjs` (quota returns `null` until increment 4), `engine/adapters/codex/{provider,runtime,quota}.mjs` (`discoverModels()` = `codex debug models` with `execFile` + 5 s timeout, then cache file fallback; field allow-list as in §2.4), `engine/adapters/{gemini-cli,kimi-cli,grok-build}/{provider,runtime,quota}.mjs` (unverified stubs reading `engine/data/runtimes/<id>.json`).
- `engine/data/compat/claude-aliases.json` (+ `schemas/data/compat-aliases.schema.json`; entries carry `trust: "maintained"`, tier, context window, effort levels), `engine/data/compat/openai-families.json` (+ `schemas/data/compat-families.schema.json`; `{prefix, tierHint, note}` rows, `HEURISTIC` provenance), `engine/data/runtimes/{gemini-cli,kimi-cli,grok-build}.json` (+ `schemas/data/runtime-doc.schema.json`), `engine/data/profiles/default.json`, `engine/data/profiles/mwbm-standard.json` (skeleton; filled in increment 1; validated by `schemas/orchestrator-config.schema.json`).
- `engine/sim/clock.mjs` (`FakeClock` with `now()`, `advance(ms)`), `engine/sim/providers.mjs` (`SyntheticProvider` A/B/C from a scenario), `engine/sim/run.mjs` (`runScenario(file) → {assertions:[{name, ok, detail}]}`), `engine/sim/scenarios/smoke.json`, `engine/sim/scenarios/discovery-changes.json` (+ `schemas/sim/scenario.schema.json`).
- Schemas: `schemas/local/model-capability-profile.schema.json`, `schemas/local/catalogue-cache.schema.json`, `schemas/local/event.schema.json`, `schemas/engine/discover.output.schema.json`, `schemas/sim/scenario.schema.json`, the two compat schemas, `schemas/data/runtime-doc.schema.json`, `schemas/autopilot.schema.json` (issue #43; describes today's shape exactly; fixture copied from `loop-runtime.md`'s example with the `//` comments removed), and — closing P4 for the plugin's own files — `schemas/plugin-manifest.schema.json`, `schemas/marketplace-manifest.schema.json`, `schemas/hooks.schema.json`, with `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` and `hooks/hooks.json` added to `schemas/manifest.json`.
- Fixtures: one `<name>.sample.json` per schema above; `codex-debug-models.sample.json` (a hand-written synthetic two-model sample — not the real dump, which carries OpenAI prompt text) is a test input, listed in the manifest against `schemas/test-inputs/codex-debug-models.schema.json`.
- Tests: `engine/test/{canonical,toml,config,events,discover,adapters,sim-smoke}.test.mjs`.
- Docs: `docs/orchestrator/object-model.md`, `docs/orchestrator/departures.md` (DEP-1 onward), `docs/orchestrator/adding-a-provider.md` (skeleton), `docs/orchestrator/discovery.md` (the field mapping table).

**Files to change.**
- `scripts/audit-model-ids.sh` — check 1 widens to a case-insensitive pattern `(claude|gpt|gemini|kimi|grok)-[0-9][0-9a-z.-]*` (the existing `claude-[a-z]+-[0-9]` shape is kept as a second alternative); allowed locations: `model-routing.md`, `engine/data/compat/`, `tests/fixtures/`, `CHANGELOG.md` (released history is never rewritten), and everything under `.claude/` (this repository's own working notes — the same exclusion `audit-ledger-paths.sh` already makes). The **thirteen** prose sites found today (`SKILL.md:12,197`, `run-report.md:59`, `orchestration-profiles.md:19,25,35,49,51`, `model-routing.md:28,30`, `README.md:5,500`, `CHANGELOG.md:350`): twelve are reworded to "the Codex runtime's configured model"; `CHANGELOG.md:350` stays and is allow-listed. The fixture↔schema pairing check lives only in `tests/smoke-structure.sh` (one implementation, not two).
- `hooks/guard-ledgers.sh` — Rule 1 name list gains `orchestrator.json`, `job.json`, `decisions.json`, `invariants.json`, `review-contract.*.json`, `plan-contract.*.json` (bash `case` globs; marker still required); header comment updated with the why; bats cases added (a marker-bearing `job.json` at the top level denied; the same at `.dev-team/jobs/j1/job.json` allowed; `plan-contract.x.v1.json` at `docs/` denied; a plain `job.json` with no marker allowed anywhere).
- `skills/dev-team-orchestrator/references/conventions.md` — Shared artifacts table gains the engine's committed files with owner "engine (via the lead)", marker kinds listed in point 3, and the ownership rule sentence stating the JSON marker field applies to all of them; "Where the plugin writes" point 1 lists `.dev-team/jobs/`, `.dev-team/plans/`, `.dev-team/orchestrator.json`, `.dev-team/invariants.json`; a new short section "Machine-local state" naming `CLAUDE_PLUGIN_DATA` and the rule that nothing machine-local lives in the repo; the README fixed text (point 7) is left as is and the stale list is noted.
- `references/config-and-toggles.md` — a short section saying `orchestrator.json` exists, is the engine's file, and is documented in `docs/orchestrator/config.md`; no new `config.yml` key.
- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md` (adapter layout, compat data rule, audit widening).

**Tests (assertions).**
- `discover.test.mjs`: from `codex-debug-models.sample.json`, two profiles; `contextWindow` = 272000; `reasoningControls` = the supported levels; `model_messages` never appears in the cache file; every section-7 field present, `UNKNOWN` where the sample lacks data; provenance `RUNTIME_DISCOVERY`; a slug with `visibility: hide` → lifecycle `UNKNOWN`; `upgrade` set → `LEGACY`; a model present in the previous cache and absent now → `removed[]` and `RETIRED?` at 0.5, then `RETIRED` after a second run; a failing `codex debug models` (fake `execFile` throws) keeps the previous cache with `stale: true`; an `--refresh` ignores TTL; a cache older than 24 h is refreshed; a cache file failing its schema is treated as absent and rebuilt.
- `canonical.test.mjs`: key order does not change the hash; whitespace does not; a changed value does; `undefined` throws; the hash of the committed plan contract equals the one `hash-contract.mjs` prints.
- `toml.test.mjs`: parses `model = "…"` and `model_reasoning_effort = "medium"` from a fixture; a table-array line lands in `unsupportedLines`.
- `config.test.mjs`: precedence built-in < profile < file; a profile with a `config.yml` key is rejected by schema; an invalid file is ignored with a problem listed.
- `events.test.mjs`: a generated day file validates line by line; a line containing a synthetic key is redacted.
- `sim-smoke.test.mjs`: `smoke.json` and `discovery-changes.json` run and every assertion is `ok`.
- `adapters.test.mjs`: the registry lists five adapters, two `verified: true`; every unverified `supports.*` is `UNKNOWN` or documented.

**Acceptance.** AC 5, 33 (provenance), 54 (registry) provable; `scripts/audit-model-ids.sh` passes with the widened pattern; the three Claude Code manifests validate against their new schemas in CI.

### Increment 1 — Capability catalogue and deterministic routing (size L; build: Opus for `routing.mjs`/`catalogue.mjs`/`effort.mjs`, Sonnet for the rest)

**Goal.** Profiles with provenance become the routing input; tiers 0–4, specialisations, task and risk taxonomies, capability floors, budget policies, six-level reasoning effort mapped per runtime, a deterministic score with fixed weights, decision records, explainability, and a dry-run that shows tiers/providers/effort/review strategy and the owner's questions. `model-routing.md` becomes the roles-and-floors document. The numbers the builder needs are in this plan.

**Brief sections.** 3, 6 (refresh triggers), 7, 8, 9, 10, 17–18 (fixed stages), 20, 21, 39, 44, 45, 49 (rules; rename is increment 2), 66, 67 (rules), 70, 71, 72, 79, 80, 81, 82, 87, 88, 100 (names, price ≠ intelligence).

**The floors table (`engine/data/floors.json`; preferred/minimum tier by risk LOW / NORMAL / HIGH / CRITICAL).** Compound classifications take the element-wise maximum. Packs and user overrides may raise a floor, never lower one below the built-in minimum.

| Task type | LOW | NORMAL | HIGH | CRITICAL |
|---|---|---|---|---|
| REPOSITORY_DISCOVERY | 1/0 | 1/1 | 2/1 | 2/1 |
| REQUIREMENTS_ANALYSIS, NORMAL_ANALYSIS | 2/1 | 2/2 | 3/2 | 3/3 |
| DEEP_ANALYSIS, ARCHITECTURE, DEEP_PLANNING | 3/2 | 3/3 | 3/3 | 4/3 |
| MECHANICAL_IMPLEMENTATION | 0/0 | 1/0 | 2/1 | 2/2 |
| ROUTINE_IMPLEMENTATION | 1/1 | 2/1 | 2/2 | 3/2 |
| COMPLEX_IMPLEMENTATION | 2/2 | 3/2 | 3/3 | 3/3 |
| REFACTOR | 1/1 | 2/1 | 3/2 | 3/3 |
| MIGRATION | 2/2 | 3/2 | 3/3 | 4/3 |
| TEST_AUTHORING | 1/1 | 2/1 | 2/2 | 3/2 |
| TEST_EXECUTION, STATIC_ANALYSIS, BUILD_VALIDATION | 0/0 | 0/0 | 1/0 | 1/0 |
| ROUTINE_DEBUGGING | 2/1 | 2/2 | 3/2 | 3/2 |
| COMPLEX_DEBUGGING, ROOT_CAUSE_ANALYSIS | 3/2 | 3/3 | 3/3 | 4/3 |
| CODE_REVIEW | 2/2 | 3/3 | 3/3 | 3/3 |
| SECURITY_REVIEW | 3/3 | 3/3 | 3/3 | 4/3 |
| ARCHITECTURE_REVIEW, CONCURRENCY_REVIEW, FINAL_AUDIT | 3/3 | 3/3 | 3/3 | 4/3 |
| DATABASE_REVIEW, API_COMPATIBILITY_REVIEW, RELEASE_REVIEW | 3/2 | 3/3 | 3/3 | 3/3 |
| ACCESSIBILITY_REVIEW | 2/2 | 3/2 | 3/3 | 3/3 |
| DOCUMENTATION | 1/0 | 1/1 | 2/1 | 2/2 |
| HOUSEKEEPING | 0/0 | 1/0 | 1/1 | 2/1 |
| CI_CD | 1/1 | 2/1 | 2/2 | 3/2 |
| RELEASE_ENGINEERING | 2/1 | 2/2 | 3/2 | 3/3 |

This keeps the 1.x invariant 1 (every review type is minimum 3 at NORMAL and above; LOW allows 2 for plain code review, matching brief 56's "optional/proportional"), keeps tier 4 preferred only in the section-9 list (CRITICAL deep work, security, audits), and gives the section-91 fast path (tiers 0–1 at LOW for mechanical, housekeeping, documentation).

**Effort defaults (`engine/data/effort-defaults.json`).** Where the brief gives a range, the lower end applies at LOW/NORMAL risk and the upper end at HIGH/CRITICAL: repository search LOW; mechanical edits LOW (MEDIUM at HIGH+); routine implementation MEDIUM; normal analysis MEDIUM; complex implementation HIGH; architecture HIGH → VERY_HIGH; deep planning VERY_HIGH; complex debugging HIGH → VERY_HIGH; independent review HIGH → VERY_HIGH; exceptional escalation VERY_HIGH → MAXIMUM (MAXIMUM only at CRITICAL or after a tier-3 failure). Mapping to runtimes (`engine/lib/effort.mjs`): MINIMAL→`low`, LOW→`low`, MEDIUM→`medium`, HIGH→`high`, VERY_HIGH→`xhigh`, MAXIMUM→`max` on both Claude and Codex; Codex `ultra` only if listed in `supported_reasoning_levels` and `routing.allowUltra: true`; clamp to the highest level the profile lists and say so in the record; on Claude, `applied` names the agent-file variant (increment 2's set) because effort is frontmatter-only.

**Score (`engine/lib/routing.mjs`).** After the hard filter (availability ≠ UNAVAILABLE; lifecycle ≠ RETIRED; PREVIEW only if `routing.allowPreview`; every required runtime capability `true`; `contextWindow ≥ contextEstimate` when both known; tier ≥ minimumTier; provider/model allow/deny lists; canary stage permits the risk — NEW: none, PROVISIONAL: LOW, CANARY: LOW/NORMAL, VALIDATED: LOW/NORMAL/HIGH, TRUSTED: all), each section-71 term is a number from 0 to 1 and the score is the weighted sum. Term rules for this increment (learning terms arrive in 8 and are neutral until then): `capabilityFit` = 1 − 0.25×(preferred − tier) when below preferred, 1 − 0.15×(tier − preferred) when above (this, with the cost penalty, is why tier 4 is never the default); `reasoningFit` = 1 if the requested effort is available on the runtime, 0.5 if clamped; `runtimeFit` = share of *optional* requested capabilities present; `contextFit` = 1 if window ≥ 2× estimate, linear down to 0 at 1×, 0.5 if UNKNOWN; `availabilityConfidence` = 1 AVAILABLE / 0.5 UNKNOWN; `lifecycleFitness` = 1 ACTIVE / 0.7 PREVIEW / 0.5 LEGACY / 0.3 DEPRECATED / 0.5 UNKNOWN; `providerDiversityBonus` = 0 until increment 5; `monetaryCostPenalty` = price per million tokens normalised to the dearest candidate when known, else `relativeCostClass / 9` using the `run-report.md` per-tier weights (9/6/2/1, Codex 2) — extending the existing single-source cost table rather than inventing a second one, stated in the module header; `quotaScarcityPenalty` and `latencyPenalty` = 0 until increments 7 and 8; `taskSpecificCompetency`, `projectSpecificCompetency`, `toolReliability`, `historicalReliability` = 0.5 and `recentFailurePenalty` = 0 until increment 8. Initial weights (`engine/data/weights.json`), by task family:

| Family | capFit | reasonFit | runtimeFit | contextFit | availConf | lifecycle | diversity | cost | scarcity | latency | competency (×2) | reliability (×2) | recentFail |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| analysis/planning | 3.0 | 1.5 | 1.0 | 1.5 | 1.0 | 0.5 | 0 | 1.0 | 1.0 | 0.2 | 1.0 | 0.5 | 1.0 |
| implementation/refactor/migration | 2.0 | 1.0 | 1.5 | 1.0 | 1.0 | 0.5 | 0 | 2.0 | 1.0 | 0.5 | 1.5 | 1.0 | 1.0 |
| deterministic validation (tests/lint/build) | 1.0 | 0.5 | 2.0 | 0.5 | 1.0 | 0.5 | 0 | 3.0 | 1.0 | 1.0 | 0.5 | 1.5 | 0.5 |
| debugging | 2.5 | 1.5 | 1.5 | 1.5 | 1.0 | 0.5 | 0 | 1.0 | 1.0 | 0.5 | 1.5 | 1.0 | 1.0 |
| review/audit | 3.0 | 1.5 | 1.0 | 1.5 | 1.0 | 0.5 | 2.0 | 0.5 | 1.0 | 0.2 | 1.5 | 0.5 | 1.0 |
| documentation/housekeeping/CI | 1.0 | 0.5 | 1.0 | 0.5 | 1.0 | 0.5 | 0 | 3.0 | 1.0 | 0.5 | 0.5 | 1.0 | 0.5 |

Tie-break by (closeness to preferred tier, lower `relativeCostClass`, provider id, model id) so the choice is total-ordered. `recordInputsHash` = sha256 of the canonical inputs (catalogue stamp, policy, quota/health stamps, request) so "same inputs → same record" is testable.

**Files to create.**
- `engine/lib/taxonomy.mjs` — frozen enums: `TASK_TYPES` (20), `RISKS` (21), `SPECIALISATIONS` (10), `EFFORT` (45), `ROLES` (49), `LIFECYCLE` (88), `PROVENANCE` (8), `TIERS` 0–4 (9), `QUOTA_STATES` (40), `HEALTH` (68), `FAILURE_CLASSES` (84 ∪ 13), `COMPLETION_STATES` (46), `DRIFT_LEVELS` (27), `FINDING_STATUSES` (60), `SEVERITIES` (61), `INDEPENDENCE_LEVELS` (57), `GATE_LEVELS` (75), `CANARY_STAGES` (18); `assertEnum(name, value)`.
- `engine/lib/tiers.mjs` — `floorFor(taskTypes[], risk, policy) → {preferredTier, minimumTier, reasons[]}` from `floors.json` (+ `schemas/data/floors.schema.json`).
- `engine/lib/effort.mjs` — as above; `engine/data/effort-defaults.json` + schema.
- `engine/lib/catalogue.mjs` — `loadCatalogue()`, `classify(profile)` (deterministic rules over provider metadata, runtime discovery and compat data; unknown → tier `UNKNOWN`, stage `PROVISIONAL`, confidence ≤ 0.5, provenance `HEURISTIC`), `applyPrecedence(local security policy > user override > verified runtime/provider > remote (increment 9) > heuristic)`, `refreshNeeded(reasons)` for TTL (24 h), credential fingerprint changed (hash of `claude --version` + Codex `loggedIn` boolean + config `model` — never account data), runtime rejected a model (`catalogue reject`), lifecycle change seen in discovery, user `--refresh`; `override(selector, field, value)` writes `USER_OVERRIDE` provenance into `orchestrator.json` `overrides[]`, where a selector is either a model id or the symbolic `codex:configured-model` (resolved from `config.toml` at run time so the preset never names a model).
- `engine/lib/routing.mjs`, `engine/lib/decisions.mjs` (`appendDecision(jobId | null, record)`; job files exist from increment 3; until then the record goes to the local ad-hoc file; `getDecision(id)`), `engine/lib/dryrun.mjs` (`dryRun(phases[]) → rows` plus a `questions[]` block: every input the lead marked uncertain, each with "why we need it" — F24; cost/quota columns say "available after increment 7").
- `engine/data/{floors,weights,effort-defaults}.json` + schemas + fixtures; `engine/data/profiles/mwbm-standard.json` filled in: `routing.tierOverrides` (DEEP_ANALYSIS/DEEP_PLANNING preferred 4), `routing.sequentialDeepWork: true`, implementation preferred tier 2, `review.codexRound: true` (used from increment 5), `continuity.midPhaseAgentSwitch.enabled: true` (D4), `learning.enabled: true`, `learning.shadowEvaluation.enabled: false`, and `overrides: [{selector: "codex:configured-model", tier: 3, canaryStage: "TRUSTED", specialisations: ["CODE_REVIEW_SPECIALIST"]}]` — the owner vouching for the Codex reviewer so CRITICAL cross-provider review can fire (increment 5); every key present in the schema.
- Tests: `engine/test/{taxonomy,tiers,effort,catalogue,routing,decisions,dryrun,overrides,reproducibility}.test.mjs`; scenarios `cheap-qualified-wins.json`, `expensive-avoided.json`, `runtime-requirements.json`, `context-limit.json`, `no-suitable-agent.json`, `tier4-not-default.json`, `canary-stage-blocks-critical.json`.
- `commands/dev-team-explain.md` — `engine.sh explain --decision <id> --format text`.
- Docs: `docs/orchestrator/{config,routing,tiers-and-floors,reasoning-effort,profiles}.md`.

**Files to change.**
- `skills/dev-team-orchestrator/references/model-routing.md` — retitled in content "Roles, tiers and floors" (file name kept so links and the audit keep working): the tier table becomes roles → tier → default agent file; the alias table stays as the Claude adapter's compatibility data (still the only prose file allowed a dated Claude id); "How routing actually works" rewritten: spawn-time `model` parameter (documented resolution order), effort frontmatter-only, the engine decides; invariants 1 and 2 kept and cross-referenced to `floors.json`.
- `references/orchestration-profiles.md` — ranking table replaced by "the engine's catalogue and score; edit `orchestrator.json` overrides to bias it"; Codex section keeps the setup steps.
- `references/task-brief-template.md` — "Model tier / endpoint agent" → "Routing decision" (decision id, role, tier, provider/runtime, applied effort, one-line reason; 1.x wording kept as the fallback); `references/checker-protocol.md` brief gains the decision id and "verify against the plan the decision cites".
- `skills/dev-team-orchestrator/SKILL.md` steps 4–5 call `route`; Anti-patterns gain "Choosing a model by name"; `commands/dev-team.md` lists `/dev-team-explain`; `commands/dev-team-config.md` — `show` prints `orchestrator.json`'s effective values with sources; `init --profile <name>` writes `.dev-team/orchestrator.json` (marker, `profile` key) and **offers** the profile's `config.yml` suggestions (`git.default-branch: alpha`, and from increment 11 `git.push-after-task: on`) one line at a time, never silently.
- `references/run-report.md` — weights keyed by tier 0–4 (a Codex spawn counts at its routed tier), the model-name row removed; the engine's `relativeCostClass` is documented as reading these same weights.
- `references/config-and-toggles.md` — points to `docs/orchestrator/config.md`; README "Model routing & tiers" rewritten around roles; CHANGELOG.

**Tests (assertions).** Cheap qualified worker selected when two candidates pass the floor and the cheaper scores higher on cost; expensive worker avoided when the task is ROUTINE_IMPLEMENTATION at NORMAL risk (tier 4 never chosen unless preferred); runtime requirement (`supports.git`) filters out a candidate; context limit filters out a 128k model for a 200k estimate; identical inputs produce byte-identical records apart from `id`/`recordedAt`; changing the catalogue stamp changes `inputsHash`; `NO_SUITABLE_AGENT_AVAILABLE` with exit 1 when every candidate is below the floor; a user `prohibit` removes a candidate and the record's rejection reason says `USER_POLICY`; effort VERY_HIGH → Claude `xhigh` agent variant and Codex `xhigh`; MAXIMUM on a Codex model without `ultra` → `max` with a note; classification of an unknown slug → tier `UNKNOWN`, stage `PROVISIONAL`, confidence ≤ 0.5, provenance `HEURISTIC`; a PROVISIONAL model is filtered out of a HIGH task with reason `CANARY_STAGE`; the `codex:configured-model` override resolves to the slug in a fixture `config.toml` and lifts it to TRUSTED; provider-metadata conflict (two sources disagree) → the higher-precedence source wins and both are listed in `sources[]`; every floors row in this plan round-trips through `floorFor` (a table-driven test).

**Migration.** `models=economy|balanced|max` keeps working: the engine maps them to ECONOMY/BALANCED/QUALITY_FIRST (`max` → QUALITY_FIRST as the brief defines it, documented as a meaning change: "least expensive configuration with a very high probability", not "always the most expensive"). Agent names unchanged until increment 2.

**Acceptance.** AC 1, 2, 3, 4 (fixed stages), 7, 10 (front-loaded floors), 25 (mapping), 33, 45, 46, 48 (partial) provable by tests; `/dev-team-explain` answers "why was this agent selected?" in three plain sentences; dry-run shows the section-79 columns available so far plus the questions block.

### Increment 2 — Role-named agents with effort variants and aliases (size S; build: Sonnet; Haiku for the mechanical renames)

**Goal.** Section 49/100: agent files named after roles, not models, with the effort variants the mapping table needs, because on Claude effort is frontmatter-only. The shipped set is fixed here (DEP-14): `scout.md` (effort low, default model haiku), `scribe.md` (low, sonnet), `engineer.md` (medium, sonnet), `engineer-high.md` (high, sonnet), `architect.md` (xhigh, opus), `architect-high.md` (high, opus), `architect-max.md` (max, opus), `principal.md` (max, fable), `principal-xhigh.md` (xhigh, fable), `reviewer.md` (high, opus), `reviewer-xhigh.md` (xhigh, opus). Each carries a **default** `model:` alias (compatibility metadata; the engine's decision overrides it at spawn time — HT-2, with the file's effort still applied — HT-2b) and a description that names the role and tells the lead the engine picks the model. `effort.mjs`'s Claude mapping table names these files exactly (LOW/MINIMAL → the base scout/scribe file; MEDIUM → `engineer`; HIGH → `engineer-high`/`architect-high`/`reviewer`; VERY_HIGH → `architect`/`principal-xhigh`/`reviewer-xhigh`; MAXIMUM → `architect-max`/`principal`); a requested combination with no file is clamped to the nearest and recorded. Old names kept for one release as alias files whose description says "deprecated alias for <role>; removed in 2.1.0". `scripts/audit-model-ids.sh` check 3 and `tests/smoke-structure.sh` check 1 lists updated (both old and new must exist in 2.0.0); README table; every skill/reference that says `opus-builder` etc. reworded to the role (a Haiku find-and-replace with an Opus read-through); CHANGELOG deprecation note. Tests: smoke checks both sets; bats: audit passes; a grep test that no skill file names an old agent except the alias files and the deprecation note; `effort.test.mjs` gains a table-driven case that every mapping target file exists. **Acceptance.** AC 6, AC 25 (within DEP-14). Reviewed as one small diff.

### Increment 3 — Job state, plan contracts, lock, drift, checkpoints, evidence gate, attempt caps, progress table (size L; build: Opus for `plan.mjs`/`drift.mjs`/`evidence.mjs`, Sonnet for `job.mjs`/`report.mjs`/docs)

**Goal.** The committed job file; PlanContract with hash/version/approval; ReviewContract shape; drift levels with STOP; structured completion state; the evidence gate; git-backed checkpoint records; bounded attempts with progress tracking; deterministic discovery before LLM scouts; HANDOFF gains the owner's missing fields; `/dev-team-status` shows the progress table; this plan's hand-locked contract is verified by the engine.

**Brief sections.** 4, 15, 24, 25, 26, 27, 28, 33 (records; snapshot in 4), 46, 47, 48, 54 (start), 73, 74, 78, 85 (bounded attempts), 90–92 (as job templates), 13 (failure class field), 97.11 (verify).

**Contract.** Inputs: request text, optional issue number, phases (from templates `normal`, `small-task`, `critical` in `engine/data/job-templates.json` + schema), plan contract JSON (stdin or file), changed-file lists, declared deviations, evidence JSON, attempt outcomes. Outputs: `job.json`, `plans/plan-contract.<id>.v<n>.json` with `planHash`, drift classification, evidence verdict, checkpoint record, attempt record, progress rows. Modules: `engine/lib/{job,plan,drift,evidence,checkpoint,attempts,report,discovery-deterministic}.mjs`. Drift rules (deterministic): files changed outside the union of the plan task's `files` lists → SIGNIFICANT; any file or symbol named in `architecturalDecisions`/`invariants` touched, or a declared deviation flagged `architectural` → ARCHITECTURAL; changes inside the task's files with declared deviations tagged `minor` → MINOR; nothing else → NO_DRIFT; SIGNIFICANT/ARCHITECTURAL → exit 1 with the section-27 STOP sequence. Evidence gate: INCOMPLETE if any mandatory test/build/lint result is missing or failed, any BLOCKING finding open, any acceptance criterion without a ref, or the plan version differs from the locked one; self-reported `CONFIDENT` never overrides. Attempts: `maxAttempts` per task defaults to 3 (the two-strike rule plus one escalated attempt); `attempt record --progress-made false` twice in a row → `ATTEMPT_CAP_REACHED` (exit 1) with the section-85 next step (escalate tier, or stop and surface). Checkpoints: planning and implementation kinds carrying exactly section 33's lists; `checkpoint verify` confirms the referenced commits exist (`git cat-file -e`). Deterministic discovery: `git` facts, manifests, test commands (reusing iterate's Codebase Map when present) recorded as artifacts before any scout brief.

**Files changed.** `SKILL.md` steps 1, 6, 6a (attempt record), 7; `documentarian-protocol.md` (decision log entries point at decision ids; Current status carries the job id); `handoff-template.md` (fields: "Tried and rejected", "Verified / assumed", "Files that matter", "Plan: <planId> v<n>"; triggers: after a lesson, before a long step); `commands/dev-team-status.md` (progress table); `loop-runtime.md` (`job_ref`); `verdict-and-report-protocol.md` (ReviewContract input); `schemas/{job,plan-contract,review-contract,decisions}.schema.json`, `schemas/data/job-templates.schema.json`, `schemas/autopilot.schema.json` (adds `job_ref`); fixtures; docs `plan-contracts.md`, `drift.md`, `checkpoints.md`, `completion-evidence.md`, `convergence.md`.

**Tests.** Plan: hash stable across key order; a changed requirement changes the hash; `lock` refuses a second lock at the same version (exit 4); `verify` detects an edited locked file (exit 5); `verify --file .claude/plans/orchestrator-v2/plan-contract.orchestrator-v2.v1.json` passes (the hand lock and the engine agree); `diff v1 v2` lists changed sections. Drift: the four classifications from fixtures; STOP exit 1. Evidence: "cannot report complete with a failed mandatory test"; passes with all refs. Attempts (`convergence.test.mjs`): third failed attempt → cap reached; two no-progress attempts → cap reached; a successful attempt resets nothing retroactively but closes the task; the stop rule refuses a fourth attempt without an escalation record. Checkpoint: in a temp git repo, create → verify passes; delete the commit → verify exit 5. Simulator: `plan-revised-reenters-planning.json`, `convergence.json`. Bats: guard-ledgers cases for the new file names (added in 0b; extended here with `decisions.json`).

**Migration.** Existing `.dev-team/` projects gain `jobs/` and `plans/` only when a 2.0 run starts; nothing rewrites old ledgers. **Acceptance.** AC 10, 11, 12, 16 (records), 26, 27, 28, 31 (field), 52; F3/F4/F25 delivered.

### Increment 4 — Leases, quota adapters, pause/resume, block, snapshot, paused ≠ crashed, fallback, takeover, retirement, failure classes, time handling (size L; build: Opus for `lease.mjs`, `quota.mjs`, `snapshot.mjs`, `time.mjs`, the autopilot rule change; Sonnet for adapters' parsers and docs)

**Goal.** Phase stickiness with a lease; quota observations with the four causes, family-vs-session scope, and a reset time that is never invented; the 12-hour rule; `PAUSED_AWAITING_QUOTA` and `BLOCKED_AWAITING_AGENT`; a work snapshot that captures **untracked** files too, so pausing — or cleaning up after a crash — never loses work; **autopilot's reclaim rule always snapshots before it resets and never resets a paused lock**; pre-phase fallback ladder; explicit takeover switch (off by default; preset on beyond 12 h) recorded as `MID_PHASE_TAKEOVER_OCCURRED` with forced stronger review; retirement takeover ladder; failure classes with recovery behaviour; `quota status` visible in `/dev-team-status`.

**Brief sections.** 29–38, 84, 85 (escalation by class), 13, 33/34 (snapshot), 100 (never switch mid-phase for credits; never invent reset; never lose work), F6/F28/F29/F31.

**Contract.**
- `engine/lib/time.mjs` — `parseClockTime(text, {zoneStated, machineZone, now})` returning `{resetAt, assumptions[]}` where a date-less clock time becomes its next occurrence (`DATE_NEXT_OCCURRENCE`) and a missing zone uses the machine zone (`ZONE_MACHINE`); a full date-and-time (the Codex "Sep 14th, 2026 2:31 AM" form) carries no date assumption; anything without a clock time → `resetAt: null`; tests use `Europe/London` including a clock time that has already passed today and a message during the BST/GMT changeover.
- `lease acquire` uses `mkdirSync` on `$CLAUDE_PLUGIN_DATA/projects/<key>/leases/<job>.<phase>.lock/` (atomic, same primitive as `loop.lock`) and writes holder + heartbeat; the committed lease summary goes into `job.json`.
- `snapshot create` builds the snapshot with a **temporary index**: copy the real index to a temp file, `GIT_INDEX_FILE=<tmp> git add -A`, `git write-tree`, `git commit-tree <tree> -p HEAD -m "dev-team snapshot <job>/<phase>/<n>"`, `git update-ref refs/dev-team/snapshots/<job>/<phase>/<n> <sha>` — proven today to capture modified, untracked and new-directory files while leaving the working tree and the real index untouched. A clean tree records `snapshotRef: null, reason: CLEAN_TREE`. Before writing the ref, the candidate diff (`git diff HEAD` plus untracked file contents up to 1 MB each) is scanned: with `gitleaks` present, `gitleaks detect --no-git` over a temp export; without it, the engine's own `looksLikeCredential` patterns (reported as the weaker check). A hit → exit 5, nothing written, the phase goes BLOCKED with the file named (never its content). `refs/dev-team/*` is outside `refs/heads` and `refs/tags`, so `git push` never sends it; `snapshot prune --job` removes a job's refs on completion.
- `snapshot restore` refuses if HEAD is not the snapshot's parent (exit 4); if the working tree already matches the snapshot tree (`git diff --quiet <snap>` and no missing untracked files) it does nothing; otherwise `git checkout <snap> -- .`, removes files the snapshot recorded as deleted (`git diff --diff-filter=D --name-only HEAD <snap>`), then `git reset -q` so restored files are unstaged, exactly as they were.
- `quota observe --stdin` returns the observation; `lease pause` is only legal with an observation whose `resetAt` is known and ≤ `continuity.quotaPauseThresholdHours` (12): it runs `checkpoint create`, then `snapshot create --reason pause`, records `resetAt` with provenance, marks the phase PAUSED, writes `paused` into `autopilot.json` and `state: paused` + `snapshotRef` into `loop.lock/holder` when under the conductor, and tells the lead the exact wake-up: Claude Code's built-in wait when interactive (caveats: it does not survive exiting Claude Code and can stop on a permission prompt), the autopilot re-fire otherwise, else "re-run at <time>".
- `lease resume` requires the same owner identity (provider+model+runtime+role; session id when the runtime has one and HT-1 passed), restores the snapshot, and re-checks the provider rather than trusting the computed time. Unknown or >12 h → `BLOCKED_AWAITING_AGENT` with phase, progress, cause, reset (if known) and recovery options, and — only if `continuity.midPhaseAgentSwitch.enabled` — `takeover` (same family → same provider equivalent/higher tier → other provider), recorded, `reviewStrengthening: FULL_CATCH_UP`. Retirement (`RETIRED`/`REMOVED`/`ACCESS_REVOKED`/`UNRECOVERABLE`) always takes over via the section-37 ladder. `fallback` walks section 38 before a phase starts and records `preferred` so the next phase tries it first (F29). Failure classes map to behaviour in `engine/data/failure-recovery.json` (+ schema); escalation by class feeds `attempt record`.
- `quota status` lists every provider's latest observation, whether its reset has passed, and its confidence; `/dev-team-status` prints it.

**Autopilot change (the critique found the trigger was wrong).** On Claude, when a sub-agent hits the seat allowance the lead's own next call fails too, so the pause sequence above often **cannot run at that moment** — the `paused` marker is never written and the next re-fire finds only a stale lock and a dirty tree. So the recovery rule itself becomes non-lossy. `loop-runtime.md` "Crash / interruption recovery" is rewritten: (1) a lock whose holder file says `state: paused` with a valid `snapshotRef` is **never** treated as crashed and the tree is **never** reset — resume restores the snapshot first; (2) a lock with no paused marker and a stale heartbeat is treated as crashed **but** before any reset the conductor runs `snapshot create --reason reclaim`, records the ref in `autopilot.json` (`paused.snapshotRef` with `paused.is: false` and `reason: reclaim`) and in the report line, and only then applies today's reset-to-HEAD; if the snapshot is refused (secret found) the reset does not happen and the loop goes BLOCKED naming the file; (3) the paused marker is written **opportunistically** — by the lead when it can still act (a Codex worker out of credit; the lead after the host's wait continues its session) — and `quota observe` may also be fed the message later by the user, which back-fills the observation; (4) without the engine (exit 3), today's lossy rule stays and the docs say so. `modes-and-gates.md` Bucket 3 gains "quota reset unknown or >12 h" as a hard pause reason. Recorded as DEP-13.

**Files.** `engine/lib/{time,lease,quota,snapshot,fallback,takeover,failure}.mjs`; adapters' `quota.mjs` filled (Claude parser with family/session/weekly/spend detection; Codex parser + optional app-server snapshot behind the flag); `schemas/local/{lease-local,quota-observation}.schema.json`; `engine/data/failure-recovery.json` + schema; scenarios `pause-10m`, `pause-2h`, `pause-11h59m`, `block-13h`, `block-unknown-reset`, `restart-while-paused`, `reclaim-after-crash-keeps-work`, `retired-mid-phase`, `takeover-enabled-preset`, `fallback-pre-phase`, `a-not-started-b-chosen`, `a-halfway-pause-resume` (the two section-94 proofs); tests `{time,lease,quota-parse,pause-resume,snapshot,fallback,takeover,failure}.test.mjs` (snapshot tests in a temp git repo with a modified tracked file, an untracked file, a new directory, a deleted tracked file, and a planted fake secret for the refusal case; a restart simulated by a new engine process reading the persisted files; a lease race with two processes); `loop-runtime.md`, `modes-and-gates.md`, `SKILL.md` (6a: failure class recorded; two-strike rule references classes), `handoff-template.md` (paused line), `commands/dev-team-status.md` (lease, pause state, `quota status`), docs `phase-stickiness.md`, `quota-and-pausing.md`, `checkpoints.md` (snapshot section), `git-integration.md`, `failure-handling.md`, `time-and-resets.md`; README env table (`providers.openai.appServerQuota`).

**Tests (assertions).** **First:** stale lock, no paused marker, dirty tree with an untracked file → after reclaim a snapshot ref exists whose tree contains that file, and the reset happened. Resets at 10 min, 2 h, 11 h 59 m → checkpoint created, phase PAUSED_AWAITING_QUOTA, decisions show no agent switch, resume picks the identical owner identity; 13 h and unknown → BLOCKED_AWAITING_AGENT, no takeover unless the switch is on; a date-less "9:30 PM" → `resetAssumptions` includes DATE_NEXT_OCCURRENCE and confidence low; the dated Codex form → no date assumption; a message with no clock time → `resetAt: null`; process restart while paused (new engine process) → `lease status` still PAUSED with the snapshot ref and the dirty and untracked files restored on resume, unstaged; HEAD moved → resume refused (exit 4); planted secret → snapshot refused (exit 5), tree untouched, no ref written; a clean tree → `CLEAN_TREE`, no ref; retirement → takeover ladder order recorded and `reviewStrengthening` set; preset takeover → `MID_PHASE_TAKEOVER_OCCURRED` recorded; pre-phase fallback picks the equivalent candidate and records `preferred`; two engine processes racing `lease acquire` → exactly one wins; brownout stub: a sticky phase is not switched by a health change (the full detector is increment 8). Bats: the reclaim scenario through the shim in a temp repo.

**Migration.** An autopilot run started under 1.5.0 has no `paused` field; the reader treats it as `{is:false}`; `loop.lock/holder` without `state` is `running`. **Acceptance.** AC 16, 17, 18, 19, 20, 21, 31; the two section-94 proofs pass; the reclaim test passes; F6/F28/F29/F31 delivered.

### Increment 5 — Review independence, cross-provider review, finding lifecycle (size M; build: Opus for the ladder and lifecycle rules, Sonnet for Codex invocation and docs)

**Goal.** Fresh-context review with a ReviewContract; cross-provider preference by risk (LOW optional, NORMAL preferred, HIGH strongly preferred, CRITICAL required where another capable provider exists); the section-57 fallback ladder with the independence level recorded; specialist reviews chosen by risk and affected components; adversarial mode for HIGH/CRITICAL; finding lifecycle with stable ids and reviewer identity; reviewer precision counters (consumed by 8); adjudication ladder; provider-diversity bonus across the whole Job; Codex as a first-class reviewer runtime (F10) alongside the Claude checker; F30's forced catch-up review.

**Contract.** `review plan` reads the job's phases and provenance, the quota adapter (a reviewer whose provider is EXHAUSTED is skipped down the ladder — recorded), the canary stage (a reviewer below the stage the risk needs is skipped with reason `CANARY_STAGE` — on this machine the owner's preset lifts the Codex model to TRUSTED), and returns the ReviewContract plus a routing decision with `independence`. Codex review invocation: `codex exec -s read-only --json --output-schema schemas/engine/codex-review.output.schema.json -o <file> -c model_reasoning_effort='"high"'` fed the contract; the engine turns the structured answer into `verdict.json` claims with `reviewer` and `status: OPEN` (the conventions table row for `verdict.json` gains "engine, on behalf of the review skill"). `findings update` validates transitions (OPEN→ACCEPTED|REJECTED|FALSE_POSITIVE|DEFERRED; ACCEPTED→FIXED→VERIFIED) and refuses re-opening a VERIFIED finding without new evidence text. Multiple reviewers only for the section-64 list; disagreement → deterministic validation first → Architect adjudicator → Principal.

**Files.** `engine/lib/{review,findings,independence}.mjs`; `schemas/verdict.schema.json` additive: optional top-level `reviewer`, `independence`, `review_contract`; per-claim optional `status`, `reviewer`, `resolution` (the `const` marker stays 1.0; `additionalProperties:false` means these are added in the same commit, as the schema's `$comment` requires); `schemas/engine/codex-review.output.schema.json`; `dev-team-review/SKILL.md` (review plan step; Codex round; "Running inside the conductor" unchanged in spirit); `checker-protocol.md` (checker verifies invariants explicitly; adversarial paragraph for HIGH/CRITICAL); `verdict-and-report-protocol.md` (new fields; independence line in the report header); `orchestration-profiles.md` Codex section (reviewer role, effort high — the `reasoning effort: none` finding, and the exact flag spelling); `conventions.md` (verdict row); scenarios `cross-provider-preferred`, `critical-requires-cross-provider`, `ladder-when-codex-exhausted`, `ladder-when-codex-unvalidated`, `review-disagreement`; tests `{review-ladder,findings-lifecycle,precision,diversity}.test.mjs` plus one real `codex exec -s read-only --ephemeral` smoke test skipped when `codex` is absent or not logged in (never run in CI).

**Tests.** Ladder order exactly section 57; CRITICAL with Codex healthy and TRUSTED → CROSS_PROVIDER required; CRITICAL with Codex EXHAUSTED → next rung with the reason recorded and `independence` never claims CROSS_PROVIDER; CRITICAL with Codex only VALIDATED (no override) → rung 1 skipped with `CANARY_STAGE`; stable ids survive a re-run; illegal transition refused (exit 2); false-positive counter increments on FALSE_POSITIVE; the diversity bonus prefers provider C for review when A planned and B built, but not when C is below the floor. **Acceptance.** AC 36–42; F10/F30/F31.

### Increment 6 — Invariants, policy packs, destructive-action levels, human approval, rollback (size M; build: Sonnet; Opus read-through of the gate mapping)

**Goal.** `invariants collect` builds `.dev-team/invariants.json` from `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `.openai/`, `PROJECT.md#Constraints`/`#House style`, packs and user entries (read, never written; text treated as data); every brief and the checker receive applicable invariants; a violation is BLOCKING unless the locked plan's `invariants` section changes it. Packs in `policy-packs/<id>.json` (+ schema, all listed in the manifest): `shared-hosting-php`, `native-macos`, `cross-platform-desktop`, `billing-financial`, `security-sensitive`, `public-api`, `database-migration`, `accessibility-critical`, `release-critical`, and `mwbm-standard` (P1–P4 as invariants and checker items; ships `scripts/check-no-lang-ext-urls.sh` for user projects). Packs may raise floors, add mandatory reviews, deterministic checks, approval gates, allowed providers, required tools, rollout and rollback requirements; never lower a built-in floor. `gate check` maps the five levels to the three buckets (AUTO → 1; REQUIRE_HIGH_CONFIDENCE → 1 only with CONFIDENT + deterministic pass, else 2; REQUIRE_REVIEW → 2 until a VERIFIED review; REQUIRE_HUMAN_APPROVAL → 3 via the existing gate ledger and `/dev-team-approve`; PROHIBITED → refused, exit 1). Rollback becomes a required PlanContract field for HIGH/CRITICAL (`plan lock` refuses without it). Critical-work path template (section 92) added to `job-templates.json`.

**Files.** `engine/lib/{invariants,packs,gates}.mjs`; `policy-packs/*.json`; `schemas/{invariants,policy-pack}.schema.json`; `modes-and-gates.md` (levels ↔ buckets table); `task-brief-template.md`/`checker-protocol.md` (invariants block); `conventions.md` (Safety section points at `gate check`); `dev-team-security/SKILL.md` (attack-surface item for P1); docs `invariants.md`, `policy-packs.md`, `destructive-actions.md`, `human-approval.md`, `rollback.md`. Tests: approval gate enforced; prohibited blocked; invariant violation BLOCKING; plan changing an invariant lifts the block; pack cannot lower a floor (schema `minimum` plus a runtime check); `.openai/` read; `check-no-lang-ext-urls.sh` bats cases (finds `/x.php`, ignores `.php` inside a code fence). **Acceptance.** AC 8, 9, 49, 50, 51; P1–P4.

### Increment 7 — Quota-aware routing, reserves, per-phase budgets, cost prediction (size M; build: Opus for reserve arithmetic, Sonnet for the rest)

**Goal.** Quota states as routing inputs with the scarcity penalty term switched on; `frontierReservePercent`/`architectReservePercent` reserves that only planning, security, difficult debugging and final review may draw on; per-phase budgets (monetary, tokens, credits; "percentage of remaining allowance" only where a numeric quota source exists — Codex app-server — and reported UNKNOWN on Claude, DEP-5); LOW/LIKELY/HIGH estimates from `engine/data/cost-bands.json` (+ schema) per task type and, once learning has ≥ 10 records for that shape, from history; warnings when a job would use an unusually high share of known capacity; the quota-change discovery refresh trigger; dry-run gains the cost and quota columns. Files: `engine/lib/{budget,estimate}.mjs`, data + schemas, `loop-runtime.md` budget block gains engine fields, `run-report.md` gains the bands, docs `quota-routing.md`, `budgets.md`, `cost-prediction.md`. Tests: reserve protection (a routine task cannot take the last 25 %); pressure states change scores; scarce-frontier protection; budget stop at the phase limit (exit 1); bands ordered LOW ≤ LIKELY ≤ HIGH with the caveat text present; warning fires above the threshold; UNKNOWN allowance never produces a number. Simulator `high-costs.json`. **Acceptance.** AC 22, 23, 24, 47.

### Increment 8 — Learning, competency, failure taxonomy use, context quality, canary promotion, probes, health/brownout, tool reliability, shadow evaluation, dashboards (size L; build: Opus for weighting/canary/context-quality rules, Sonnet for records, health and reports)

**Goal.** Local-only records (task type, language/framework, provider, model, runtime, tier, risk, effort, first-pass tests, review outcome, accepted/rejected findings, retries, escalations, tokens and latency when reported, final acceptance, failure class — never code, prompts, diffs or paths) in `$CLAUDE_PLUGIN_DATA/learning/<yyyy-mm>.json`; global and project competency with a 30-day half-life, a minimum of 5 project observations (10 global) before they influence a score, and a cap so one failure moves a score by at most one step; the score's competency/reliability/recent-failure terms switch from neutral constants to these values; failure-class-aware routing (INCOMPLETE_CONTEXT → improve retrieval, not tier); `ContextQualityScore` computed from the request's evidence inventory (files, tests output, logs, plan) and gated before escalation; canary stages become dynamic — NEW→PROVISIONAL→CANARY→VALIDATED→TRUSTED promoted by evidence, demoted by failures, settable by USER_OVERRIDE, with a sampled share of workloads per stage; probes (structured output, tool call, patch, review) run only on demand or when a new model is first needed, results cached with TTL; health states from latency/error/dropped-session signals with brownout detection; tool-reliability counters separate from model scores; shadow evaluation OFF by default with `sampleRate`, never changing the main path; `report --history` views (best model for X, lowest cost per accepted change, highest false-positive reviewer, most reliable runtime). Files: `engine/lib/{learning,competency,context-quality,canary,probes,health,reliability,shadow,history}.mjs`, schemas for `learning-record`, `canary-state`, `health`, `probe-result`, `shadow-sample`; `SKILL.md` 6a uses context quality before escalation; docs. Tests: cheaper-historically-better wins; insufficient evidence does not override baseline; project competency outweighs global once n ≥ 5; poor context → retrieval step recorded before any tier change; new model starts PROVISIONAL, gets LOW only, promotes after successes, CRITICAL rejects an unvalidated model; probe cached, not re-run; brownout avoided for new phases while a sticky phase stays; tool failures lower runtime score only; shadow sampled at the configured rate, main decision identical with shadow on and off, learning updated safely; privacy test: a record containing a path or code snippet is refused by the schema and the recorder; `learn purge` deletes and reports. Scenarios `brownout.json`, `outage.json`, `rate-limit.json`, `tool-failures.json`, `canary.json`, `shadow.json`. **Acceptance.** AC 4, 29, 30, 31, 32, 35, 41, 43, 44, 53.

### Increment 9 — Signed remote capability catalogue, plugin side (size S; build: Sonnet; Opus read of `signature.mjs`)

**Goal.** Ed25519 over canonical JSON; pinned public key `engine/data/catalogue-public-key.pem` (rotation only by plugin release); envelope `{payload, signature (base64), keyId, issuedAt, expiresAt}` with `schemas/catalogue.schema.json`; `catalogue verify` (exit 5 on any failure; the payload is then ignored with a warning, never "used unsigned"); `catalogue fetch` behind `remoteCatalogue.enabled` (default true, but with no URL configured it does nothing) using the `check-update.sh` throttle/cache pattern into `$CLAUDE_PLUGIN_DATA/remote-catalogue/`, 24 h TTL; precedence chain enforced (remote never overrides verified runtime data, and the payload schema has **no** fields for floors, gates or destructive levels, so it cannot weaken them); `docs/remote-catalogue-contract.md` written for the future MWBM-intAppsAPI service with the exact hand-verification commands (`openssl pkeyutl -verify -pubin -inkey key.pem -rawin -in payload.canonical.json -sigfile sig.bin`; `ssh-keygen -Y verify` variant). **No private key is ever committed:** tests generate a key pair at run time with `crypto.generateKeyPairSync('ed25519')`, sign the valid/tampered/expired/wrong-key envelopes into a temp folder, and the bats test does the same through a node one-liner in its setup; the only committed key material is the pinned public key. Tests: the four generated envelopes; unreachable → ignore, no error; precedence; a payload with a `floors` key fails the schema; the ship skill's secret scan finds nothing under `engine/`. **Acceptance.** AC 34 (plugin side; DEP-2 recorded).

### Increment 10 — Decomposition scoring, risk-aware parallelism, integration engineer, provenance graph, worktrees (size M; build: Opus for scoring and integration rules, Sonnet for the rest; requires the HT-4 result)

**Goal.** Decomposition score over independence, shared state, merge-conflict probability (file overlap), coupling, context duplication, speed benefit and review complexity; parallelism caps keyed to risk (`engine/data/parallelism.json` + schema; `routing.sequentialDeepWork` caps deep-analysis and planning at 1 for the owner's preset); the Integration Engineer role and stage (reconcile intent: contract adherence, duplicated helpers, architectural consistency) before deterministic validation; per-artifact provenance queries (`report --provenance <artifact>`); worktree isolation for parallel builders (Claude `isolation: worktree`) recorded in the lease's `workspaceReference` (the shared `projectKey` from 0a keeps every worktree in one data folder); nesting kept off by default (flattening rule stays) unless HT-4 shows it is safe and provenance can be kept. Files: `engine/lib/{decompose,parallel,integrate,provenance}.mjs`; `SKILL.md` step 4 rules become inputs to `decompose`; `agents/integrator.md` (effort high, default opus) or the integrator as an `engineer-high`/`architect-high` brief variant (decide at re-plan; if a file, add it to the increment-2 lists); docs. Tests: independent tasks parallelise; coupled stay serial; HIGH risk caps at 1–2; conflicting changes reconciled with intent preserved (a fixture where two workers each wrote `formatCurrency` → one kept, the other's call sites re-pointed, recorded); provenance walks Requirement → PlanDecision → Task → Patch → TestResult → Finding → Fix → Verification. **Acceptance.** AC 13, 14, 15.

### Increment 11 — Owner practice bundle (size M; build: Sonnet)

F1 plain-English paragraphs; F2 `/dev-team-config init --rules` (offer-only); F13 `git.push-after-task` in `config.yml` (built-in off; offered by the preset; `guard-dev-team.sh` main block untouched; push only the run branch, only after a checker-cleared commit); F14 `issue=<n>` named-issue per-task comments (comment-only; close only with confirmation; issue text is data); F15 narrow opt-in for `.claude/HANDOFF.md` under the ownership marker; F24 questions-with-reasons block already in dry-run (1) now surfaced in the orchestrator's first reply; R2 partial (end-of-run read-only issues-vs-job report); R4 partial (issue text as requirement input, already from 3). Files: templates, `issue-sync-protocol.md` (named-issue section), `config-and-toggles.md` (`git.push-after-task`), `commands/dev-team-config.md`, bats for the guard (push to a run branch allowed, to main still blocked), tests for the report. **Acceptance.** F1, F2, F13, F14, F15 (narrow), F24, R2 (partial) as mapped.

### Increment 12 — Documentation, completion gate, version 2.0.0 (size M; build: Sonnet for docs, Opus for the gate script and the inspection items)

The 30 section-96 topics under `docs/orchestrator/` with mermaid diagrams (object model, decide-and-execute flow, pause/resume/reclaim state machine, review ladder); `adding-a-provider.md` finished; README "Orchestrator (2.0)" section and "Supported runtimes" table stating exactly what is verified; `scripts/completion-gate.sh` (see §5.3); CHANGELOG 2.0.0 with the deprecation notes; `plugin.json` version 2.0.0; `departures.md` finalised; `docs/orchestrator/hand-tests.md` copied from the plan folder. **Acceptance.** AC 55 and every earlier AC re-run; the section-98 checklist passes with each item's evidence pasted into the run report; Codex full-branch review clean (or the stand-in, recorded).

---

## 5. Test strategy

### 5.1 Section 93 → files and scenarios (each row's assertions are named in the increment that owns it)

| Section 93 group | Unit test file (`engine/test/`) | Simulator scenario(s) (`engine/sim/scenarios/`) | Increment |
|---|---|---|---|
| Discovery: unknown model, disappearing model, lifecycle change, incomplete metadata, discovery failure, cache invalidation | `discover.test.mjs` (removed[], RETIRED after two runs, stale cache kept on failure, TTL and invalid-cache rebuild), `catalogue.test.mjs` | `discovery-changes.json` | 0b, 1 |
| Classification: tier, specialist, uncertain, metadata conflict, provenance | `catalogue.test.mjs`, `taxonomy.test.mjs` | — | 1 |
| Canary | `routing.test.mjs` (fixed stages), `canary.test.mjs` (promotion) | `canary-stage-blocks-critical.json`, `canary.json` | 1, 8 |
| Task-specific competency | `competency.test.mjs` | — | 8 |
| Context quality | `context-quality.test.mjs` | — | 8 |
| Routing | `routing.test.mjs`, `reproducibility.test.mjs` | `cheap-qualified-wins`, `expensive-avoided`, `runtime-requirements`, `context-limit`, `no-suitable-agent`, `tier4-not-default` | 1 |
| Quota: reserves, pressure, scarce frontier, per-phase budgets | `budget.test.mjs`, `estimate.test.mjs` | `high-costs.json` | 7 |
| Mid-phase exhaustion 10 m / 2 h / 11 h 59 m | `pause-resume.test.mjs` | `pause-10m`, `pause-2h`, `pause-11h59m`, `a-halfway-pause-resume` | 4 |
| > 12 h; unknown reset | `pause-resume.test.mjs`, `quota-parse.test.mjs`, `time.test.mjs` | `block-13h`, `block-unknown-reset` | 4 |
| Model retirement mid-phase | `takeover.test.mjs` | `retired-mid-phase` | 4 |
| Git checkpointing: resumable branch/worktree, dirty state, restart recovery, crash reclaim keeps work | `checkpoint.test.mjs`, `snapshot.test.mjs` | `restart-while-paused`, `reclaim-after-crash-keeps-work` | 3, 4 |
| Plan locking | `plan.test.mjs` (incl. the hand-locked contract) | `plan-revised-reenters-planning` | 0a, 3 |
| Drift detection | `drift.test.mjs` | — | 3 |
| Parallelism; merge arbitration | `decompose.test.mjs`, `parallel.test.mjs`, `integrate.test.mjs` | `parallel-independent`, `parallel-coupled`, `merge-intent` | 10 |
| Independent review: preference, CRITICAL, fallback | `review-ladder.test.mjs` | `cross-provider-preferred`, `critical-requires-cross-provider`, `ladder-when-codex-exhausted`, `ladder-when-codex-unvalidated`, `review-disagreement` | 5 |
| Review findings | `findings-lifecycle.test.mjs`, `precision.test.mjs` | — | 5 |
| Shadow evaluation | `shadow.test.mjs` | `shadow.json` | 8 |
| Deterministic completion | `evidence.test.mjs` | — | 3 |
| Destructive operations | `gates.test.mjs` | — | 6 |
| Cost prediction | `estimate.test.mjs` | `high-costs.json` | 7 |
| Provider brownout, outage, rate limit | `health.test.mjs` | `brownout.json`, `outage.json`, `rate-limit.json` | 8 |
| Convergence: loops bounded, escalation occurs, stop criteria | `convergence.test.mjs` (3: attempt caps, no-progress stop), `failure.test.mjs` (4: escalation by class), `context-quality.test.mjs` (8) | `convergence.json` | 3, 4, 8 |
| Section 94's named proofs | — | `a-not-started-b-chosen.json`, `a-halfway-pause-resume.json` | 4 |
| Signatures | `signature.test.mjs` (keys generated at run time) | — | 9 |
| Tool failures | `reliability.test.mjs` | `tool-failures.json` | 8 |

Each scenario file lists synthetic providers (A: architect available, quota reset in 3 h; B: architect available, healthy; C: engineer available, cheap — the brief's example), a fake clock, the sequence of events, and named assertions; `sim run --all` fails CI if any assertion fails.

### 5.2 Shell-level tests (`tests/engine.bats`) and hooks

Shim paths (node absent, too old, `DEV_TEAM_NO_ENGINE`, data-dir fallback with warning, `--data-dir`, happy path); the reclaim scenario in a temp repo; `catalogue verify` through the shim with envelopes generated in setup; guard-ledgers cases for every new committed file name; `check-no-lang-ext-urls.sh` cases; `completion-gate.sh --dry-run` lists every item. `tests/scripts.bats` stays unchanged and green (its count is not restated here because it changes with every fix round).

### 5.3 The section-98 completion gate as a runnable checklist — `scripts/completion-gate.sh`

Runs, in order, and prints PASS/FAIL per line with the command used: (1) `node --test engine/test`; (2) `bats tests/scripts.bats tests/engine.bats`; (3) `bash tests/smoke-structure.sh`; (4) `shellcheck scripts/*.sh hooks/*.sh tests/*.sh`; (5) `node --check` over every `.mjs` and `tsc --noEmit --allowJs --checkJs` if `tsc` is present (JSDoc types), else "skipped: tsc absent" (it is absent on this machine today, so CI's `engine` job installs it with `npx --yes typescript@<pinned>` so the check is not skipped there); (6) `engine.sh schema validate --all` + the manifest-driven `check-jsonschema` loop; (7) credential-handling inspection: `grep -rn "auth.json\|keychain\|API_KEY\|_TOKEN\|_SECRET" engine/` must hit only the documented deny-list in `redact.mjs`/`doctor.mjs`; (8) `engine.sh catalogue verify` over four freshly generated envelopes with the expected outcomes; (9) `engine.sh checkpoint verify` and `snapshot restore` on a generated job in a temp repo; (10) `engine.sh sim run --all` (covers quota exhaustion, restart while paused, reclaim after crash, retirement, brownout, review disagreement); (11) the lease concurrency test (two engine processes racing `lease acquire`, exactly one wins); (12) the manual items printed as a checklist for a person: review of concurrency, quota scheduling, resume behaviour, drift, git recovery, failover, destructive gates, telemetry/privacy — each with the file to read; (13) "independent cross-provider review: Codex run id ___ or stand-in record ___" required before exit 0.

### 5.4 CI changes

`plugin-audit.yml`: new `engine` job (Node 22 pinned action, `pipx install check-jsonschema`, `node --test`, schema validation over the manifest, simulator, pinned `typescript` for the JSDoc type check); the `test` job runs `tests/engine.bats` too; both `audit` checks keep running; README and CONTRIBUTING list the three required check names (`audit`, `test`, `engine`). `lint.yml` unchanged. A second Node version (latest LTS) can be added as a matrix later; not required.

---

## 6. Safety

- **Credentials.** The engine never opens `~/.codex/auth.json`, the macOS keychain, `~/.claude` credential files, or any environment variable whose name contains `KEY`, `TOKEN`, `SECRET`, `PASSWORD`; `doctor` reduces `codex login status` to a boolean; runtimes hold their own credentials. A test plants a canary token in a fake auth file and asserts it never appears in any output or cache. Snapshots are refused when a secret is found in the candidate diff (`gitleaks` when present, the engine's own patterns otherwise, reported as the weaker check). **The committed config file never carries a credential:** `remoteCatalogue.url` is schema-constrained to a plain `https://host/path` with no user:password part and no query string; `writeMarked` refuses any string value matching the credential patterns; `doctor` warns on an existing file that does.
- **Redaction.** Every provider error message goes through `redact()` before storage or logging; `rawRedacted` is the only stored form; free text reaches the engine by stdin or file, never the command line; the redaction list is documented and tested with synthetic keys.
- **No hidden reasoning.** Checkpoints and records carry only section-33's engineering state; the schemas have no field for reasoning text and `additionalProperties: false` at the top level keeps it that way.
- **Destructive actions.** Five levels mapped to the three buckets (increment 6); PROHIBITED is refused by the engine, and the human-approval level uses the existing gate ledger and `/dev-team-approve`. The bash guard's main-branch block and live-key block stay as they are; `git.push-after-task` can never push to main.
- **Paused ≠ crashed — the recovery rule, and what makes it hold on Claude.** (1) A lease/lock in `paused` state with a valid snapshot ref is never reset; resume restores the snapshot before anything else and refuses if HEAD moved. (2) A stale lock with no paused marker is a crash — and because on Claude the lead usually cannot write the paused marker at the moment the allowance runs out (its own next call fails too), the crash path is made non-lossy: the reclaiming conductor **always** snapshots the dirty tree, including untracked files, before the existing reset, records the ref, and refuses to reset if the snapshot is refused. (3) The paused marker is written whenever the lead can still act, and the quota observation can be back-filled later. (4) The snapshot is a commit object built from a temporary index and referenced under `refs/dev-team/snapshots/` — not on any branch, never pushed by the plugin, removable with `git update-ref -d` or `snapshot prune`. (5) Without the engine, the 1.x lossy rule stays and is documented as such.
- **Supply chain for the remote catalogue.** Ed25519 signature over canonical JSON with a public key pinned in the plugin; rotation only by a plugin release; verification failure or expiry → the payload is ignored and a warning is printed; the payload schema has no fields that could touch floors, gates, destructive levels, or verified runtime data; a `keyId` mismatch is a failure; the cache stores the verified payload and the verification result together so a later read cannot mistake an unverified file for a verified one; no private key is ever committed (test keys are generated at run time).
- **Learning privacy.** Records are categorical only (schema-enforced; no free text longer than the enum values, no paths); stored per user under `CLAUDE_PLUGIN_DATA`; `learning.enabled: false` stops recording and deletes nothing silently (`learn purge` deletes on request); shadow evaluation off by default; no sharing between users or machines in this release.
- **Untrusted text.** Issue bodies, provider error text, catalogue payloads and ledger free text are data; none is ever interpolated into a shell command (the engine uses `execFile` with argument arrays, never a shell string).

---

## 7. Risks and departures

### 7.1 Departures from the brief (to be written into `docs/orchestrator/departures.md` and the committed brief folder)

| Id | Departure | Reason |
|---|---|---|
| DEP-1 | Gemini, Kimi and Grok adapters are documented-but-unverified (brief's "at minimum, must support") | not installed here or on most users' machines; claiming support without a probe would be a false statement; the adapters exist, are simulator-tested, and turn verified when a probe runs |
| DEP-2 | Remote signed catalogue is plugin-side only; no live service | MWBM-intAppsAPI has no such endpoint yet; the contract and verification are shipped and tested against run-time-signed fixtures |
| DEP-3 | Shadow evaluation OFF by default (brief example shows enabled, 5 %) | it costs credits on every sampled task; the owner ranks credit efficiency highly; available and configurable |
| DEP-4 | "Automatically recheck around reset" is done by the host (Claude Code's wait; the autopilot re-fire), not by the engine | the engine is a program the lead calls and cannot wake itself; the persisted reset time survives restarts; the host wait's caveats are documented |
| DEP-5 | "Maximum percentage of remaining allowance" is UNKNOWN on Claude | no headless quota source exists for Claude; only Codex's experimental app-server reports a number |
| DEP-6 | Reproducible routing holds given the recorded inputs; task/risk classification inputs come from the lead | the engine cannot classify a request without an LLM; recording the inputs makes the claim honest and testable |
| DEP-7 | Dry-run cannot avoid the lead's own planning tokens | unavoidable; stated in the docs |
| DEP-8 | "Dashboards" are CLI/JSON history views, not a UI | the plugin has no web surface (`.claude/CLAUDE.md` §9) |
| DEP-9 | Configuration is `.dev-team/orchestrator.json` with a schema, not a YAML block | the owner's schema rule and no YAML parser; `config.yml` keeps its 1.x keys only |
| DEP-10 | "Resume the exact existing agent session" for Claude sub-agents depends on HT-1; until then the third preference (same model + structured checkpoint) is the guarantee | documented, not yet hand-tested on 2.1.265 |
| DEP-11 | Delegation nesting stays off (flattening rule) unless HT-4 shows it is safe | provenance and cost control get harder with nesting |
| DEP-12 | Mid-phase takeover is enabled in the `mwbm-standard` preset for >12 h/unknown resets | the owner's standing hand-over rule; it is the brief's own explicit switch, recorded and followed by a forced stronger review — not a silent switch |
| DEP-13 | On Claude, the `PAUSED_AWAITING_QUOTA` marker is usually written after the fact, not at the moment of exhaustion | the seat allowance is shared, so the lead cannot act at that moment; the work is kept by the always-snapshot reclaim rule instead, and the marker and observation are back-filled when the lead can act |
| DEP-14 | On Claude, the set of reasoning-effort levels per role is fixed by the shipped agent files (increment 2) | effort is frontmatter-only; a level with no file is clamped to the nearest and recorded |

### 7.2 Open unknowns

- HT-0..HT-4 results (`CLAUDE_PLUGIN_DATA` in a skill's Bash call, sub-agent resume, spawn-time model, model plus file effort together, hooks in sub-agents, nesting depth).
- Whether `codex review --base` really refuses a custom prompt (observed once; the plan uses `codex exec -s read-only` and does not depend on it).
- The Codex app-server protocol's stability; kept behind a flag.
- How a marketplace user without Node experiences the plugin (proven only by the bats exit-3 tests; a real fresh-machine check is worth one hand test at increment 12).
- Whether `gitleaks` is present for the snapshot secret check; absent here, so the engine's own weaker check will be the one that runs on this machine, and the report says so.

### 7.3 Hand tests (recorded in `.claude/plans/orchestrator-v2/hand-tests.md`, then `docs/orchestrator/hand-tests.md`)

HT-0 plugin data variable in Bash; HT-1 sub-agent resume; HT-2 spawn-time `model`; HT-2b spawn-time `model` with the file's `effort`; HT-3 hook fires for a sub-agent's Write; HT-4 nesting depth; HT-5 (increment 4) a real Claude usage-limit message fed to `quota observe --stdin` and the built-in wait observed once; HT-6 (increment 5) one real read-only Codex review through the engine at effort high, checking the banner says `reasoning effort: high`; HT-7 (increment 12) fresh machine without Node.

---

## 8. Review and delivery process

- **Per increment:** builders per §4's model tiers → the lead reruns every check (`completion-gate.sh` from increment 12; until then the five 1.x checks plus `node --test engine/test` and `engine.sh schema validate --all`) and reads the diffs of judgement-heavy files → **stand-in review** when Codex is out: a fresh Fable reviewer per risk area who built nothing, then an Opus refuter who tries to disprove each finding; only confirmed findings are fixed; the record is saved under `.claude/plans/orchestrator-v2/reviews/<increment>-standin.md` → **Codex review:** one single high-effort read-only run over the increment's whole diff (`codex exec -c model_reasoning_effort='"high"' -s read-only` with the focused prompt — the one spelling used everywhere in this plan), never more than one per allowance window, spaced so the allowance is spent on finished increments, never on known-broken states; fix, then one more Codex run only if findings were substantive; a stand-in verifies small fix rounds → commit.
- **Catch-up review:** when Codex has been away across more than one increment, its first run reviews everything since its last clean review as one body (the owner's rule), and the handover lists exactly which commits that covers.
- **Commit cadence:** one commit per package inside an increment (engine module + its tests + its schema/fixture together; docs separately), message in plain English ending with the attribution line, and — until the Codex run for that increment is clean — the words "not fully reviewed — Codex review pending" in the message body; each commit pushed to the working branch.
- **Issue and handover cadence:** issue #46 gets a comment **per package** (the plan's own commit unit, matching the owner's "each task individually" rule) carrying the progress table (increment, package, status, review status, commits); `.claude/HANDOFF.md` is rewritten after every package and before every long-running build (queued-task table, tried-and-rejected, verified-vs-assumed, next step); the plan folder gains `departures.md`, `hand-tests.md` and the plan contract as they change.
- **Versioning:** `plugin.json` stays 1.5.0 on the branch until increment 12 sets 2.0.0; CHANGELOG accumulates under `[Unreleased]`; old agent names are deprecated in 2.0.0 and removed in 2.1.0; `verdict.json` stays schema 1.0 (additive optional fields); `autopilot.json` stays 1.0 (additive fields).
- **Branch strategy (D2):** finish 1.5.0's Codex catch-up review, merge `claude/ledger-file-clashes` to `alpha` by one pull request, then cut `claude/orchestrator-v2` from `alpha`; plan documents (including the locked contract) stay in `.claude/plans/orchestrator-v2/` on the current branch and are carried across by the merge. One branch, one pull request to `alpha` at the end — no stacking. *Delta if the owner keeps one branch:* tag the last 1.5.0 commit `v1.5.0-rc` before the first 2.0.0 commit; reviewers diff `main..v1.5.0-rc` and `v1.5.0-rc..HEAD` separately; CHANGELOG keeps two sections.

---

## 9. Decision deltas

- **D1 (engine language).** If Python is chosen instead of Node: swap `engine/**/*.mjs` for `engine/**/*.py` (stdlib only, Python ≥ 3.11 for `tomllib`), `node --test` for `unittest`, `node:crypto` Ed25519 for `ssh-keygen -Y verify` (OpenSSH ≥ 8.2, present wherever git is) with a documented fallback of refusing verification when `ssh-keygen` is absent, `Intl` timezone handling for `zoneinfo` plus a bundled check that `tzdata` is present on Windows (refuse with a clear message if not), the shim's version check for `python3 --version`, and `hash-contract.mjs` for a `hash-contract.py` that produces the same canonical bytes (the rule is language-neutral: keys sorted by code point, no whitespace, UTF-8). Nothing in §2's object model, schemas, command surface, exit codes, increments or tests changes; only the module layout, the test runner and the crypto/timezone calls, which is why they are isolated in `canonical.mjs`, `signature.mjs`, `time.mjs` and the shim.
- **D2 (branch).** Stated in §8; the delta is one tag and split reviews.
- **D3 (Gemini/Kimi/Grok).** If the owner installs one of them here, that adapter's probes run in increment 0b and it moves to `verified: true` with real discovery; DEP-1 shrinks accordingly. If the owner insists on full support without the tools, the plan cannot honestly deliver it and says so.
- **D4 (>12 h / unknown reset).** If the owner prefers the brief's default even in the preset: remove `continuity.midPhaseAgentSwitch.enabled: true` from `mwbm-standard.json`; nothing else changes (the switch, the record and the forced review stay available). If the owner wants takeover always on: the built-in default flips, DEP-12 becomes a departure from the brief's default and is recorded as such.

---

## 10. Plan contract (`orchestrator-v2`, version 1 — hashed by hand in increment 0a step 0, locked on the owner's approval, verified by the engine in increment 3)

```json
{
  "dev-team": "ledger=plan-contract schema=1.0",
  "planId": "orchestrator-v2",
  "planVersion": 1,
  "planHash": "<sha256 hex of canonical JSON of `contract`, computed by .claude/plans/orchestrator-v2/hash-contract.mjs>",
  "status": "DRAFT",
  "approvedAt": null,
  "approvedBy": null,
  "supersedes": null,
  "contract": {
    "requirements": [
      "R1 Route work by capability, tier, specialisation, runtime features, context, competency, reliability, lifecycle, quota, cost, latency and user policy — never by model name in central routing (brief 3, 71).",
      "R2 Distinguish provider, model, runtime, role, agent instance, Job, Phase, Task, Attempt, Artifact, ReviewFinding (brief 4).",
      "R3 Provider and runtime adapters with a registry; adding a provider touches no routing code (brief 5, 99.54).",
      "R4 Dynamic discovery for Claude Code and Codex with provenance and UNKNOWN; refresh triggers; disappearing models and discovery failures handled without losing a good cache (brief 6–8).",
      "R5 Locked, versioned, hashed plan contracts; drift levels with STOP; this plan hand-locked before the first code commit (brief 25–27, 97.11).",
      "R6 Phase leases; quota observations that never invent a reset; ≤12 h pause/resume of the same owner with a work snapshot that includes untracked files; crash reclaim always snapshots before any reset; >12 h or unknown → BLOCKED; explicit recorded takeover; retirement takeover; pre-phase fallback (brief 29–38).",
      "R7 Structured completion state, an evidence gate that deterministic results control, and bounded attempts with progress tracking (brief 46–48, 85).",
      "R8 Independent review with cross-provider preference by risk, a recorded independence level, specialist and adversarial modes, finding lifecycle, reviewer precision, adjudication (brief 55–64).",
      "R9 Invariants, policy packs, five destructive-action levels, human approval, rollback (brief 22–23, 75–77).",
      "R10 Quota-aware routing, reserves, per-phase budgets, cost bands (brief 40–44).",
      "R11 Local, private learning; canary stages (fixed first, dynamic later); probes; health/brownout; tool reliability; shadow evaluation (off); history views (brief 11–14, 17–19, 62, 65, 68–69, 83).",
      "R12 Signed remote catalogue, plugin side, no private key committed (brief 16).",
      "R13 Decomposition, risk-aware parallelism, integration stage, provenance graph (brief 50–54).",
      "R14 Dry-run with an owner-questions block, routing visibility, explainability, decision records, observability events (brief 79–82, 95).",
      "R15 Tests per brief 93, a simulator per 94, the completion gate per 98, documentation per 96.",
      "R16 The owner's practices F1–F8, F10, F13–F15 (narrow), F24, F25, F27–F31, P1–P4, R2/R4 (partial) as mapped in §3.3."
    ],
    "constraints": [
      "C1 Plain everyday English in all text; detailed why/rejected/cannot-do comments; file headers; a glossary for the plan's own terms.",
      "C2 Every JSON file has a schema with descriptions that CI validates through schemas/manifest.json — real files and fixtures alike; no JSON comments; fixtures paired with schemas.",
      "C3 Engine: plain ES-module JavaScript, `// @ts-check` + JSDoc, zero runtime dependencies, Node ≥ 22, bash shim that refuses loudly; language-specific parts isolated (D1 delta).",
      "C4 Everything committed lives in `.dev-team/` with the ownership marker as the first key (line 2); machine-local state under `CLAUDE_PLUGIN_DATA` keyed by the shared git common dir; nothing machine-local inside the repository.",
      "C5 1.x behaviour continues unchanged when the engine is absent; additive schema changes only (`verdict` and `autopilot` stay 1.0); `config.yml` keeps 1.x keys only (plus `git.push-after-task`); profiles carry engine keys only.",
      "C6 No credentials read, logged or written into committed config; provider text redacted; free text via stdin or file; no hidden reasoning stored; learning stores no code.",
      "C7 One working branch (per D2), one pull request to alpha, no stacking; Codex reviews single and spaced; stand-in reviews recorded; catch-up review after any absence; an issue comment per package.",
      "C8 Runtime scope for 2.0.0: Claude Code lead; Codex verified worker/reviewer; Gemini/Kimi/Grok unverified (DEP-1).",
      "C9 Shell code stays bash-3.2-safe (no globstar); every increment ships with its own tests and documentation."
    ],
    "invariants": [
      "I1 Verification never below tier 3 at NORMAL risk or above (1.x invariant 1, now a floor row).",
      "I2 Plan expensive, execute cheap (1.x invariant 2).",
      "I3 A locked plan's hash never changes; a change is a new version.",
      "I4 No uncommitted work is ever discarded without a snapshot ref existing first; a paused lease is never treated as crashed; a snapshot with a secret in it is never written.",
      "I5 A reset time is stored only with its provenance and assumptions; no clock time → UNKNOWN → BLOCKED.",
      "I6 Remote catalogue data can never lower a floor, weaken a gate, or override verified runtime data.",
      "I7 Whoever verifies is never whoever built; the independence level is always recorded.",
      "I8 Tier 4 is never the default; the cheapest qualified candidate wins ties on cost.",
      "I9 The engine never spawns a worker; it returns the spawn instruction and records the decision.",
      "I10 A committed file written by the engine never contains a credential-shaped value."
    ],
    "architecturalDecisions": [
      "AD1 Decide-and-record engine + executing lead (§2.1).",
      "AD2 Storage split committed/local (§2.2), per-job decision files, JSON config with schema (DEP-9), the config.yml / orchestrator.json line.",
      "AD3 Fixed command surface and exit codes (§2.3); large or sensitive input by stdin or file.",
      "AD4 Adapter interfaces and registry (§2.4); Claude effort via a fixed set of role × effort agent files; model via spawn-time parameter; compat data (claude-aliases, openai-families) as the honest tier source before learning exists.",
      "AD5 Snapshot = commit object from a temporary index under refs/dev-team/snapshots, secret-scanned, never pushed; reclaim always snapshots first.",
      "AD6 Ed25519 over canonical JSON, pinned public key, hand-verifiable, test keys generated at run time.",
      "AD7 Learning ON/local; shadow OFF; owner defaults as the `mwbm-standard` preset (engine keys) plus offered config.yml lines; brief defaults built in.",
      "AD8 Host does the waiting (DEP-4); engine persists the reset time.",
      "AD9 Agents renamed to roles with one-release aliases and enumerated effort variants (increment 2).",
      "AD10 The plan itself is hand-locked in .claude/plans/ before code; the engine later verifies the same hash."
    ],
    "implementationTasks": [
      {"id": "INC-0A", "title": "Hand-lock this plan; shim, doctor, schema+manifest rule, CI engine job, /dev-team-doctor, HT-0..HT-3", "size": "S", "dependsOn": []},
      {"id": "INC-0B", "title": "Discovery, adapters, compat data, simulator harness, event log, audit widening, Claude Code manifest schemas", "size": "M", "dependsOn": ["INC-0A"]},
      {"id": "INC-1", "title": "Catalogue, taxonomy, floors, effort mapping, routing score, decision records, explain, dry-run, presets", "size": "L", "dependsOn": ["INC-0B"]},
      {"id": "INC-2", "title": "Role-named agents with effort variants and aliases", "size": "S", "dependsOn": ["INC-1"]},
      {"id": "INC-3", "title": "Job state, plan lock and verify, drift, evidence gate, checkpoints, attempt caps, deterministic discovery, handover fields, progress table", "size": "L", "dependsOn": ["INC-1"]},
      {"id": "INC-4", "title": "Time handling, leases, quota adapters, snapshot, pause/resume, block, paused≠crashed reclaim rule, fallback, takeover, retirement, failure classes", "size": "L", "dependsOn": ["INC-3"]},
      {"id": "INC-5", "title": "Review independence, cross-provider review, finding lifecycle, Codex reviewer, catch-up review", "size": "M", "dependsOn": ["INC-4"]},
      {"id": "INC-6", "title": "Invariants, policy packs, destructive-action levels, human approval, rollback, P1–P4", "size": "M", "dependsOn": ["INC-1"]},
      {"id": "INC-7", "title": "Quota-aware routing, reserves, budgets, cost bands", "size": "M", "dependsOn": ["INC-4"]},
      {"id": "INC-8", "title": "Learning, competency, context quality, canary promotion, probes, health, reliability, shadow, history", "size": "L", "dependsOn": ["INC-4", "INC-5"]},
      {"id": "INC-9", "title": "Signed remote catalogue (plugin side)", "size": "S", "dependsOn": ["INC-1"]},
      {"id": "INC-10", "title": "Decomposition, parallelism, integration engineer, provenance graph, worktrees", "size": "M", "dependsOn": ["INC-4"], "preconditions": ["HT-4 recorded in hand-tests.md"]},
      {"id": "INC-11", "title": "Owner practice bundle", "size": "M", "dependsOn": ["INC-3", "INC-5"]},
      {"id": "INC-12", "title": "Documentation, completion gate, 2.0.0", "size": "M", "dependsOn": ["INC-0A", "INC-0B", "INC-1", "INC-2", "INC-3", "INC-4", "INC-5", "INC-6", "INC-7", "INC-8", "INC-9", "INC-10", "INC-11"]}
    ],
    "acceptanceCriteria": [
      "AC-1..AC-55 as listed in §3.2, each provable by the named test or hand test, all re-run at INC-12.",
      "The hand tests HT-0..HT-3 recorded with commands and output before INC-1 builds on them; HT-4 before INC-10.",
      "1.x behaviour unchanged with Node absent (bats exit-3 paths) and with the engine present but unused.",
      "Every JSON file in the repository outside .claude/ is listed in schemas/manifest.json (or its reasoned exceptions) and validated in CI; every schema has a fixture and every fixture a schema.",
      "The reclaim-after-crash test proves a dirty tree with an untracked file is snapshotted before any reset.",
      "The departures note lists DEP-1..DEP-14 with reasons."
    ],
    "testsRequired": [
      "engine/test/*.test.mjs per §5.1; engine/sim/scenarios/* per §5.1; tests/engine.bats per §5.2; tests/scripts.bats unchanged and green; scripts/completion-gate.sh per §5.3; CI jobs audit, test, engine green."
    ],
    "rollbackRequirements": [
      "Each increment is one set of commits that can be reverted as a unit without breaking 1.x behaviour (the shim and the detect-first rule guarantee that).",
      "Deprecated agent aliases remain for one release so a revert of INC-2 is a file restore.",
      "Committed engine files are additive under .dev-team/; deleting .dev-team/jobs, .dev-team/plans, .dev-team/orchestrator.json and .dev-team/invariants.json returns a project to 1.5.0 state; local state is removable by deleting CLAUDE_PLUGIN_DATA subfolders; snapshot refs are removable with git update-ref -d or snapshot prune.",
      "Schema changes are additive, so 1.5.0 readers keep reading 2.0.0 files.",
      "The reclaim rule change in loop-runtime.md is reverted together with INC-4's engine code, never on its own, so the documented behaviour always matches what the engine does."
    ]
  }
}
```

---

## Changes made in response to the critique

| # | Critique point | What I did |
|---|---|---|
| 1 (blocking) | On Claude the pause flow cannot run at the moment it is needed; the reclaim rule still discards work | Applied. Increment 4 and §6 now make the crash path itself non-lossy: reclaim always runs `snapshot create --reason reclaim` before any reset, records the ref, and refuses to reset if the snapshot is refused; the paused marker is written opportunistically and the observation can be back-filled; the first test of increment 4 is "stale lock, no paused marker, dirty tree with an untracked file → snapshot exists after reclaim"; recorded as DEP-13; invariant I4 reworded to "no uncommitted work is ever discarded without a snapshot ref existing first". |
| 2 (blocking) | `git stash create` misses untracked files; restore semantics undefined | Applied, and re-proven today in a temp repo. Snapshot uses a temporary index (`GIT_INDEX_FILE=<tmp> git add -A; write-tree; commit-tree`); the tree is left untouched at pause; a clean tree records `CLEAN_TREE`; restore runs only when the tree differs, uses `git checkout <snap> -- .`, removes recorded deletions, then `git reset -q` (the probe showed restored files land staged otherwise); refuses if HEAD moved; tests cover modified, untracked, new-directory and deleted files. |
| 3 (blocking) | The lock must happen before implementation; contract fields not schema-valid | Applied. Increment 0a step 0 hand-locks the plan with `hash-contract.mjs` and `plan-contract.orchestrator-v2.v1.json` in `.claude/plans/orchestrator-v2/`, flipping to LOCKED on the owner's approval before the first code commit; increment 3's `plan verify --file` confirms the same hash; `dependsOn` lists are explicit ids; HT-4 moved to a `preconditions` field. |
| 4 (important) | Increment 0 too large | Applied. Split into 0a (shim, cli/paths/store/schema/redact/doctor, `/dev-team-doctor`, CI engine job, manifest rule, hand tests, hand lock) and 0b (discovery, adapters, canonical/toml/config/log, simulator, audit widening). |
| 5 (important) | Widened audit would fail on `.claude/plans/`; site count wrong | Applied. Allow-list adds all of `.claude/` (same exclusion as `audit-ledger-paths.sh`) and `CHANGELOG.md`; pattern is case-insensitive; the count is now stated as thirteen sites, twelve reworded, `CHANGELOG.md:350` kept. `orchestrator_prompt.md` contains no such id, so no special case. |
| 6 (important) | Preset cannot set `config.yml` keys | Applied. §2.2 draws the line: profiles carry engine keys only, listed in the schema; `/dev-team-config init --profile` offers the two `config.yml` lines; `sequential` and tier overrides become the additive engine keys `routing.sequentialDeepWork` and `routing.tierOverrides`. |
| 7 (important) | Non-Claude models could never reach a usable tier; canary contradiction | Applied. `engine/data/compat/openai-families.json` with HEURISTIC tier hints; the preset carries a `USER_OVERRIDE` by the symbolic selector `codex:configured-model` (tier 3, TRUSTED, review specialist); fixed stages before increment 8 are stated (maintained compat → TRUSTED, family hint → VALIDATED, unknown → PROVISIONAL) with the permitted risk per stage; increment 5 gains the `CANARY_STAGE` ladder test. |
| 8 (important) | Increment 1 not buildable without the numbers | Applied. The full floors table, the effort defaults per range by risk, the score term rules, the initial weights table, tie-break, and the cost proxy from `run-report.md`'s weights (stated as extending that single-source table) are in the plan. |
| 9 (important) | Discovery field mapping missing | Applied. A per-field table for Codex and Claude, including the lifecycle inference rules (`hide` = UNKNOWN not RETIRED; `upgrade` set = LEGACY; missing twice = RETIRED). |
| 10 (important) | Test table claims coverage the increments lack | Applied. Disappearing model, discovery failure and cache invalidation assertions added to 0b; attempt caps and no-progress stop added to increment 3 (`attempt record`, `convergence.test.mjs`); `outage.json` and `rate-limit.json` added to increment 8; §5.1 now cites where each assertion lives. |
| 11 (important) | Real data files not validated; several without schemas | Applied. `schemas/manifest.json` (itself schema'd) lists every real JSON file; `schema validate --all` and CI's `check-jsonschema` loop walk it; smoke check 10 enforces coverage; schemas named for `job-templates`, `parallelism`, `cost-bands`, `failure-recovery`, policy packs and scenarios; small schemas written for `plugin.json`, `marketplace.json` and `hooks.json` in 0b. |
| 12 (important) | `CLAUDE_PLUGIN_DATA` in a skill's Bash call unverified | Applied. HT-0 added to 0a; the shim falls back to `--data-dir`, `DEV_TEAM_DATA_DIR`, then the documented default with a warning; bats cases for each. |
| 13 (important) | `globstar` breaks bash 3.2 | Applied (re-proven today): `find schemas -name '*.schema.json'`; constraint C9 added. |
| 14 (important) | `projectKey` splits across worktrees | Applied. Key = sha256 of the absolute real `git rev-parse --git-common-dir` plus the root commit; the probe showed the main checkout returns the relative text `.git`, so resolution to an absolute path is stated; worktree and second-clone tests added. |
| 15 (important) | Rule 1 name list did not match written names | Applied. Review contracts are `review-contract.<reviewId>.json`, plans `plan-contract.<planId>.v<n>.json`; the hook's `case` uses globs for both; the engine writes `"dev-team"` as the first key with two-space indent so the marker is on line 2; bats cases added. |
| 16 (important) | Effort per role on Claude undefined | Applied. Increment 2 enumerates eleven role × effort files and the mapping targets; smoke/audit lists match; DEP-14 recorded; AC 25 marked "within DEP-14". |
| 17 (important) | Test private key would ship | Applied. Keys generated at test time with `generateKeyPairSync('ed25519')`, envelopes signed into a temp folder, bats generates its own in setup; only the public key is committed; the ship skill's secret scan is part of the increment's tests. |
| 18 (minor) | Two spellings of the Codex effort flag | Applied. `-c model_reasoning_effort='"high"'` everywhere, with the reason (a TOML value inside shell quotes). |
| 19 (minor) | `time.mjs` never created | Applied. Created in increment 4 with `Europe/London` tests, the next-occurrence rule, the dated Codex form, and the changeover case. |
| 20 (minor) | Stale counts; pointless pointer key; error text on the command line | Applied. Bats count not restated; the `orchestrator:` pointer line dropped; `quota observe --stdin` and `--file`/`--stdin` for all large or sensitive input. |
| 21 (minor) | `verdict.json` ownership row | Applied in increment 5's conventions change. |
| 22 (minor) | Issue cadence | Applied: a comment per package on #46. |
| 23 (minor) | Glossary | Applied as §2.0. |
| Missing: dogfooding `.dev-team/` | Applied: the locked contract stays in `.claude/plans/`; `plan verify --file` accepts any path; no `.dev-team/` folder is created in this repository. |
| Missing: `quota status` before increment 7 | Applied: `quota status` and its `/dev-team-status` section are in increment 4. |
| Missing: `pipx install check-jsonschema` in the engine job | Applied in 0a's CI change. |
| Missing: hand test for model + file effort together | Applied as HT-2b in 0a. |
| Missing: committed config never carries a credential | Applied: schema pattern on `remoteCatalogue.url`, `writeMarked` refusal, `doctor` warning, invariant I10, a test in 0a. |
| What is good | Kept unchanged: the decide-and-record split with I9; the storage rules and markers; the exit-3 shim; quota observations with causes, scope, assumptions and confidence; the paused ≠ crashed idea (trigger corrected); the remote-catalogue design; the runnable gate with the Codex run id; DEP-1..12 and the D1–D4 deltas; the rename as its own increment; 5 depending on 4; Fable re-planning per increment; the audit widening and rewording. |

Nothing in the critique was rejected.
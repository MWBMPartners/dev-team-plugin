<!--
  File:    .claude/plans/orchestrator-v2/owner-brief.md
  Purpose: The owner's COMPLETE brief for the intelligent, provider-agnostic dev-team orchestrator (issue #46),
           sections 1–101, copied word for word from orchestrator_prompt.md, which the owner placed at the repository
           root on 13 September 2026 (about 22:00 BST). Kept here, committed, so it survives an interrupted session and
           analysis/planning agents can read it.
  Note:    Everything below this comment is the owner's text, byte for byte. It is a brief, not a design. Where the
           design departs from it, the planning documents in this folder say so and why. The owner's original file at
           the repository root was left untouched.
-->

# Objective

Design and implement an intelligent, extensible, provider-agnostic **AI development-team orchestrator** for `dev-team-plugin`.

The orchestrator must coordinate AI providers, models, coding-agent runtimes, tools, deterministic validation systems, and optional human approval checkpoints as a coherent software-engineering team.

Its primary optimisation objective is:

```text
Maximum probability of producing a correct,
secure, maintainable, independently verified,
accepted change

for the minimum sensible total cost,

while preserving architectural consistency,
continuity of work,
and project-specific engineering standards.
```

The design philosophy is GIRFT:

> **Get It Right First Time.**

The orchestrator should spend stronger reasoning capability where mistakes propagate, use economical workers where work has already been sufficiently constrained, and invest again in independent review and verification.

At minimum, the orchestrator must support ecosystems around:

- OpenAI / Codex;
- Anthropic / Claude Code;
- Google LLMs and compatible coding-agent runtimes;
- Moonshot / Kimi;
- xAI / Grok.

The architecture MUST make additional providers and runtimes straightforward to add.

The central orchestration engine MUST NOT depend on hard-coded contemporary model names or version numbers.

---

# 1. Fundamental orchestration philosophy

Treat AI-assisted software development as a team of engineers with different roles and capabilities.

Conceptually:

```text
Utility / Scout
      ↓
General Engineer
      ↓
Senior / Architect
      ↓
Principal / Frontier Escalation
```

A typical substantial workflow should resemble:

```text
Repository reconnaissance
        ↓
Requirements analysis
        ↓
Architecture / Deep Planning
        ↓
Plan critique / approval where required
        ↓
Implementation
        ↓
Deterministic validation
        ↓
Independent review
        ↓
Corrections
        ↓
Re-validation
        ↓
Review verification
        ↓
Final completion gate
```

Different phases may use different providers and models.

However:

> Once a substantive phase has begun, continuity of that phase takes precedence over opportunistic model switching.

---

# 2. Core engineering principle

The orchestrator should explicitly follow:

```text
Spend intelligence removing uncertainty.

Spend economical compute executing
well-defined work.

Spend intelligence independently verifying
that the result is actually correct.
```

A cheap implementation of a correct design is generally preferable to an expensive implementation of the wrong design.

Therefore planning, architecture, security-sensitive reasoning, difficult debugging, and independent review should receive disproportionately strong reasoning capability.

---

# 3. Never hard-code current model identities

Do NOT implement routing rules such as:

```text
if task == planning:
    use "provider-current-flagship-v7"
```

Specific model identifiers may appear in:

- provider discovery responses;
- caches;
- diagnostics;
- tests;
- fixtures;
- compatibility metadata;
- manual user overrides;
- remote intelligence;
- logs.

They MUST NOT define the central routing architecture.

Instead route using normalised concepts such as:

- capability;
- tier;
- specialisation;
- runtime features;
- context capacity;
- task-specific competency;
- observed reliability;
- lifecycle status;
- quota availability;
- cost;
- latency;
- user policy.

A newly released model should be usable without requiring changes to the core routing algorithm.

---

# 4. Distinguish provider, model, runtime, role, agent and execution state

The orchestrator must distinguish:

## Provider

The company/service supplying inference or agent functionality.

## Model

The LLM or specialised model supplied by the provider.

## Agent runtime

The environment providing capabilities such as:

- repository access;
- filesystem operations;
- shell execution;
- Git;
- test execution;
- network access;
- MCP;
- subagents;
- context/session persistence;
- structured tool calls;
- checkpoint/resume.

## Semantic role

Examples:

```text
Scout
Engineer
Architect
Principal
Reviewer
SecurityReviewer
ReleaseReviewer
IntegrationEngineer
```

## Agent instance

A concrete invocation consisting of:

```text
provider
+ model
+ runtime
+ reasoning configuration
+ semantic role
+ session/context
```

## Job

A complete development objective.

## Phase

A substantive stage of the Job.

Examples:

```text
DISCOVERY
ANALYSIS
PLANNING
IMPLEMENTATION
VALIDATION
REVIEW
CORRECTION
FINAL_AUDIT
```

## Task

A discrete unit of work within a Phase.

## Attempt

A particular execution of a Task.

## Artifact

A durable output such as:

- plan;
- decision;
- diff;
- test result;
- checkpoint;
- architecture document;
- migration script;
- review report.

## ReviewFinding

A uniquely identifiable review issue.

This object model should broadly resemble:

```text
Job
 └── Phase
      └── Task
           └── Attempt
                ├── Artifact
                └── ReviewFinding
```

This model should underpin resumability, provenance, metrics, review tracking, parallelism and auditability.

---

# 5. Provider and runtime adapters

Create clean provider/runtime abstractions.

Conceptually:

```text
ProviderAdapter
    discoverModels()
    getModelMetadata()
    getLifecycle()
    getAvailability()
    getQuotaState()
    getQuotaResetTime()
    getPricing()
    getCapabilities()
    getRateLimits()
    healthCheck()
    createAgent()

AgentRuntimeAdapter
    supportsFilesystem()
    supportsShell()
    supportsGit()
    supportsTests()
    supportsMCP()
    supportsSubagents()
    supportsStructuredOutput()
    supportsReasoningControl()
    supportsContextIsolation()
    supportsSessionResume()
    supportsCheckpointResume()
    supportsNetwork()
    supportsReviewMode()
    invoke()
    resume()
```

Exact interfaces may differ according to repository architecture.

Provider-specific behaviour should remain inside adapters.

Adding a provider should not require modifying central routing logic.

---

# 6. Dynamic discovery

Discover available models/runtimes dynamically.

Use approximately:

```text
1. Runtime/provider discovery API
2. Provider SDK enumeration
3. Agent CLI/runtime discovery
4. Provider model metadata
5. Previously validated local cache
6. Signed remote capability catalogue
7. Local classification heuristics
8. Lightweight capability probes
```

Availability must reflect the actual authenticated account wherever practical.

Never assume:

- every account has every model;
- all subscriptions expose identical models;
- all regions expose the same models;
- historical models remain available;
- preview models remain stable.

Refresh discovery when:

- TTL expires;
- credentials change;
- runtime rejects a model;
- provider reports lifecycle changes;
- quota changes substantially;
- the user requests refresh.

---

# 7. Normalised capability profile

Maintain a provider-neutral capability profile such as:

```text
ModelCapabilityProfile
    provider
    providerModelId
    runtime

    availability
    lifecycleStatus

    generalReasoning
    codingCapability
    planningCapability
    debuggingCapability
    reviewCapability
    securityCapability
    instructionFollowing
    toolUseCapability
    longHorizonCapability

    specialisations[]

    contextWindow
    maxOutput

    reasoningControls[]
    runtimeCapabilities[]

    latencyClass

    monetaryCost
    tokenCost
    creditCost
    scarcityCost

    quotaRemaining
    quotaPressure
    quotaResetTime

    reliabilityScore
    taskSpecificCompetencies{}

    capabilityTier
    classificationConfidence

    capabilityProvenance{}

    lastValidated
```

Unknown information must remain `UNKNOWN`.

Never fabricate provider metadata.

---

# 8. Capability provenance

For every important capability classification, record why the orchestrator believes it.

Possible sources:

```text
PROVIDER_METADATA
RUNTIME_DISCOVERY
REMOTE_CATALOGUE
LOCAL_BENCHMARK
OBSERVED_PERFORMANCE
USER_OVERRIDE
HEURISTIC
```

Example:

```text
planningCapability:
    value: VERY_HIGH
    confidence: 0.91
    sources:
        - PROVIDER_METADATA
        - OBSERVED_PERFORMANCE
```

This makes classifications explainable and debuggable.

---

# 9. General capability tiers

Classify models dynamically.

## Tier 0 — Utility

Suitable for:

- metadata extraction;
- formatting;
- trivial searches;
- classification;
- simple deterministic transformations.

## Tier 1 — Economy / Scout

Suitable for:

- repository reconnaissance;
- reference searches;
- inventory;
- documentation;
- repetitive edits;
- straightforward tests;
- simple refactors;
- boilerplate.

## Tier 2 — General Engineer

Normal implementation workforce.

Suitable for:

- routine implementation;
- ordinary debugging;
- API integration;
- database work;
- UI implementation;
- moderate refactors;
- test construction;
- CI changes.

## Tier 3 — Senior / Architect

Suitable for:

- deep analysis;
- architecture;
- deep planning;
- difficult implementation;
- migrations;
- concurrency;
- complex debugging;
- important code review;
- security-sensitive reasoning.

## Tier 4 — Principal / Frontier

Reserve for:

- exceptional architecture;
- unresolved ambiguity;
- extremely difficult debugging;
- critical security;
- major cross-system changes;
- reviewer disagreement;
- Tier-3 failure;
- exceptionally consequential final audits.

Tier 4 MUST NOT become the default merely because it is available.

---

# 10. Specialist capabilities

Models may have specialist competencies independent of general tier.

Support concepts such as:

```text
CODE_REVIEW_SPECIALIST
SECURITY_SPECIALIST
LONG_CONTEXT_SPECIALIST
FAST_CODING_SPECIALIST
DATABASE_SPECIALIST
MIGRATION_SPECIALIST
UI_SPECIALIST
ACCESSIBILITY_SPECIALIST
RELEASE_ENGINEERING_SPECIALIST
RESEARCH_SPECIALIST
COMPUTER_USE_SPECIALIST
```

A specialist may outrank a generally stronger model for a relevant task.

---

# 11. Observed task-specific competency

General model tier is not sufficient.

Track observed performance by domain.

Examples:

```text
PHP
Swift
C
C++
Python
JavaScript
TypeScript
SQL
MySQL
PostgreSQL
CI/CD
GitHub Actions
security review
API architecture
testing
documentation
UI
database migrations
concurrency
```

A cheaper model may be selected when empirical evidence shows it consistently performs better for a particular project or task.

Maintain both:

```text
globalCompetency
projectSpecificCompetency
```

Project-local evidence should become increasingly influential as sufficient observations accumulate.

---

# 12. Adaptive local learning

ENABLE BY DEFAULT.

Track privacy-conscious metadata such as:

```text
task type
language/framework
provider
model
runtime
tier
risk
first-pass test result
review outcome
accepted findings
rejected findings
retry count
escalation count
token usage
credit usage
cost
latency
final acceptance
```

Useful metrics include:

```text
firstPassTestSuccessRate
implementationSuccessRate
defectEscapeRate
reviewTruePositiveRate
reviewFalsePositiveRate
toolFailureRate
timeoutRate
averageCost
averageLatency
costPerAcceptedChange
```

Weight recent behaviour more heavily.

Do not overreact to one isolated failure.

Do not retain sensitive source code merely for orchestration learning unless explicitly enabled.

---

# 13. Failure taxonomy learning

Do not merely record that an agent failed.

Classify why.

Examples:

```text
ARCHITECTURE_ERROR
IMPLEMENTATION_ERROR
INCOMPLETE_CONTEXT
HALLUCINATED_API
TOOL_FAILURE
TEST_FAILURE
SECURITY_DEFECT
REQUIREMENT_MISREAD
INCOMPLETE_CHANGE
CONCURRENCY_ERROR
MIGRATION_ERROR
PROVIDER_FAILURE
RUNTIME_FAILURE
QUOTA_FAILURE
```

Use these classifications to improve future routing.

Example:

If a model frequently fails because of incomplete context, improve context retrieval before lowering its capability rating.

---

# 14. Context quality scoring

Before escalating to a more expensive model, assess whether the problem may instead be:

```text
poor context
missing repository files
incomplete requirements
insufficient test output
missing logs
```

Maintain a `ContextQualityScore`.

If context quality is inadequate:

1. improve retrieval;
2. gather deterministic evidence;
3. retry appropriately;

before unnecessarily escalating model tier.

A well-contextualised Tier-2 model may outperform a poorly contextualised Tier-4 model.

---

# 15. Deterministic discovery before LLM discovery

Prefer deterministic tools for repository facts.

Use where available:

- Git;
- ripgrep;
- AST/indexers;
- dependency graphs;
- build metadata;
- project manifests;
- compiler information;
- test maps;
- database schema metadata.

Do not spend expensive model tokens asking questions that deterministic tooling can answer more reliably.

Models should reason over discovered evidence.

---

# 16. Signed remote capability intelligence

ENABLE.

Support a signed capability catalogue delivered through:

```text
MWBM-intAppsAPI
```

or an appropriate related MWBM service.

It may contain:

- model-family hints;
- lifecycle data;
- provisional tier guidance;
- runtime compatibility;
- known issues;
- pricing hints;
- deprecation notices;
- temporary-disable advisories;
- specialisation hints.

Precedence:

```text
local security policy
        ↓
explicit user override
        ↓
verified runtime/provider capability
        ↓
signed remote intelligence
        ↓
local heuristics
```

Remote unavailability must never break the orchestrator.

Cache verified metadata.

Validate signatures.

Remote metadata must never silently weaken security rules.

---

# 17. Unknown/new model behaviour

Unknown model identifiers must not be rejected simply because they are new.

For a new model:

1. inspect provider metadata;
2. inspect runtime capabilities;
3. consult signed remote intelligence;
4. assign provisional tier;
5. assign specialisations;
6. set classification confidence;
7. optionally perform lightweight probes;
8. make it eligible for suitable tasks;
9. observe outcomes;
10. refine classification.

---

# 18. Canary routing for new models

Do not immediately route all workloads to a newly discovered model.

Use staged confidence.

Conceptually:

```text
NEW
    ↓
PROVISIONAL
    ↓
CANARY
    ↓
VALIDATED
    ↓
TRUSTED
```

A newly released model may initially receive:

- low-risk tasks;
- shadow evaluations;
- a limited percentage of suitable workloads.

Increase utilisation as evidence accumulates.

Critical work should not automatically use a newly discovered model purely because provider marketing positions it as strongest.

---

# 19. Lightweight probing

ENABLE.

Metadata first.

Use capability probes only when necessary.

Possible probes:

- structured-output compliance;
- tool invocation;
- patch generation;
- code understanding;
- context handling;
- reasoning control;
- basic review capability.

Cache results.

Do not run expensive benchmark suites at every startup.

---

# 20. Task classification

Recognise at minimum:

```text
REPOSITORY_DISCOVERY
REQUIREMENTS_ANALYSIS
NORMAL_ANALYSIS
DEEP_ANALYSIS
ARCHITECTURE
DEEP_PLANNING

MECHANICAL_IMPLEMENTATION
ROUTINE_IMPLEMENTATION
COMPLEX_IMPLEMENTATION
REFACTOR
MIGRATION

TEST_AUTHORING
TEST_EXECUTION
STATIC_ANALYSIS
BUILD_VALIDATION

ROUTINE_DEBUGGING
COMPLEX_DEBUGGING
ROOT_CAUSE_ANALYSIS

CODE_REVIEW
SECURITY_REVIEW
ARCHITECTURE_REVIEW
DATABASE_REVIEW
CONCURRENCY_REVIEW
ACCESSIBILITY_REVIEW
API_COMPATIBILITY_REVIEW
RELEASE_REVIEW
FINAL_AUDIT

DOCUMENTATION
HOUSEKEEPING
CI_CD
RELEASE_ENGINEERING
```

Allow compound classifications.

---

# 21. Risk classification

Classify separately:

```text
LOW
NORMAL
HIGH
CRITICAL
```

Consider:

- security;
- authentication;
- authorisation;
- encryption;
- privacy;
- data loss;
- destructive database operations;
- financial logic;
- concurrency;
- production infrastructure;
- public APIs;
- release tooling;
- dependency changes;
- rollback difficulty;
- blast radius.

Complexity and risk are not equivalent.

---

# 22. Architectural invariant registry

Create first-class project/repository invariants.

Examples:

```text
MySQLi only
No Composer dependency
Prepared statements required
No secrets in repository
OS-native credential storage
No file upload while source file is actively being written
All API changes must remain backwards-compatible
```

Sources may include:

- repository configuration;
- `AGENTS.md`;
- `.openai/`;
- `.claude/`;
- project policies;
- plugin configuration;
- organisation policy packs.

Every relevant planner, implementer and reviewer should automatically receive applicable invariants.

Reviewers must explicitly check them.

Violating an invariant should normally be BLOCKING unless the approved plan explicitly changes that invariant.

---

# 23. Policy packs

Support reusable orchestration policy packs.

Examples:

```text
shared-hosting-php
native-macos
cross-platform-desktop
billing-financial
security-sensitive
public-api
database-migration
accessibility-critical
release-critical
```

Policy packs may alter:

- minimum tiers;
- mandatory reviews;
- deterministic checks;
- approval gates;
- allowed providers;
- required tools;
- rollout policy;
- rollback requirements.

Repositories may combine multiple packs.

---

# 24. Deep-planning policy

Substantial changes should establish:

- existing architecture;
- affected components;
- requirements;
- constraints;
- invariants;
- alternatives;
- selected approach;
- security implications;
- compatibility implications;
- migration implications;
- failure modes;
- implementation sequence;
- testing strategy;
- acceptance criteria;
- rollback plan where relevant.

Only then should implementation begin.

---

# 25. Phase contracts

Every substantive phase must produce or consume a structured contract.

Example planning output:

```text
PlanContract
    requirements
    constraints
    invariants
    architecturalDecisions
    implementationTasks
    acceptanceCriteria
    testsRequired
    rollbackRequirements
```

Implementation should consume that exact contract.

Review should consume:

```text
ReviewContract
    PlanContract
    resultingDiff
    deterministicResults
    declaredDeviations
```

This minimises ambiguity between agents/providers.

---

# 26. Plan locking

Once deep planning is approved, create a versioned `PlanContract`.

Record:

```text
planId
planVersion
planHash
approvedAt
approvedBy
```

Implementation operates against that plan version.

The plan must not silently mutate.

If architecture materially changes, create a new plan version and re-enter planning/review as appropriate.

---

# 27. Plan drift detection

During implementation, compare actual work to the approved plan.

Distinguish:

```text
NO_DRIFT
MINOR_IMPLEMENTATION_DETAIL
SIGNIFICANT_DRIFT
ARCHITECTURAL_DRIFT
```

Minor implementation detail changes may proceed.

Significant or architectural drift should trigger:

```text
STOP
→ explain deviation
→ return to planning/review
→ approve revised plan
→ resume implementation
```

Do not allow agents to silently redesign the system halfway through implementation.

---

# 28. Change-minimisation bias

For bug fixes and scoped changes, prefer the smallest correct change satisfying requirements.

Avoid:

- unnecessary refactors;
- unrelated cleanup;
- speculative redesign;
- dependency churn;
- broad API changes;

unless explicitly justified by the approved plan.

This should reduce regression risk and token waste.

---

# 29. Phase stickiness

Once a substantive phase starts, establish a:

```text
PhaseExecutionLease
```

containing:

```text
jobId
phaseId
provider
model
runtime
agentSessionId
reasoningConfiguration
workspaceReference
checkpointReference
startedAt
lastProgressAt
quotaState
quotaResetTime
phaseStatus
```

The selected agent becomes the phase owner.

Do not casually switch phase owners.

---

# 30. Mid-phase quota exhaustion

If the phase owner becomes unavailable because of:

```text
USAGE_CREDITS_EXHAUSTED
TOKEN_ALLOWANCE_EXHAUSTED
SUBSCRIPTION_WINDOW_EXHAUSTED
MODEL_QUOTA_EXHAUSTED
```

determine the provider-reported replenishment time.

Never invent it.

---

# 31. Twelve-hour pause/resume rule

If replenishment is expected within:

```text
12 hours
```

MUST:

1. finish any safe atomic operation;
2. stop issuing new work;
3. save repository/worktree state;
4. save phase checkpoint;
5. save task progress;
6. save plan references;
7. save provider/model/runtime identity;
8. save session identifier if resumable;
9. save expected reset time;
10. mark:

```text
PAUSED_AWAITING_QUOTA
```

11. automatically recheck around reset;
12. resume the same phase owner.

Do NOT perform normal model fallback.

---

# 32. Same-session resume

Preference:

```text
1. exact existing agent session
2. runtime-native same-model checkpoint
3. same model with reconstructed structured checkpoint
```

Another model is not equivalent to resuming the original worker.

---

# 33. Provider-neutral checkpoints

Do not store hidden chain-of-thought.

Store actionable engineering state.

Planning checkpoint:

```text
requirements established
architecture discovered
decisions made
alternatives rejected
remaining questions
implementation sequence
acceptance criteria
```

Implementation checkpoint:

```text
planId
planVersion
files changed
commits/checkpoints
tasks complete
tasks incomplete
tests executed
known failures
next intended task
important invariants
```

---

# 34. Git-backed checkpoints

Where practical, tie checkpoints to Git.

Prefer isolated branches/worktrees for agent activity.

Checkpoint data may reference:

```text
branch
worktree
commit
staged changes
dirty files
base commit
```

A paused agent should have a recoverable code state, not merely conversational state.

Do not commit broken or secret-containing state simply for checkpointing if a safer worktree snapshot mechanism exists.

---

# 35. Longer-than-12-hour interruption

If reset is more than 12 hours away or unknown:

default:

```text
BLOCKED_AWAITING_AGENT
```

Do not silently hand the phase to another model.

Persist all state.

Surface:

- phase;
- progress;
- quota cause;
- reset time if known;
- recovery options.

Automatic mid-phase takeover is disabled by default.

---

# 36. Explicit mid-phase takeover

Support:

```yaml
continuity:
  midPhaseAgentSwitch:
    enabled: false
```

If explicitly enabled:

1. checkpoint current state;
2. prefer recognised successor or same model family;
3. perform structured handoff;
4. require replacement to honour existing plan;
5. prohibit gratuitous redesign;
6. strengthen subsequent review.

Record:

```text
MID_PHASE_TAKEOVER_OCCURRED
```

---

# 37. Permanent model disappearance

If model becomes permanently:

```text
RETIRED
REMOVED
ACCESS_REVOKED
UNRECOVERABLE
```

perform controlled takeover:

```text
same provider + recognised successor
        ↓
same provider + equivalent/higher tier
        ↓
alternative provider + equivalent/higher tier
```

Require enhanced review afterward.

---

# 38. Pre-phase fallback

Before a phase begins, automatic fallback is encouraged.

Conceptually:

```text
best qualified candidate
        ↓ unavailable
equivalent candidate
        ↓
equivalent candidate from another provider
        ↓
next admissible tier
        ↓
minimum capability floor
```

No continuity penalty exists before work has begun.

---

# 39. Capability floors

Every task/risk combination should define:

```text
preferredTier
minimumAcceptableTier
```

Never silently fall below minimum capability because cheaper models are available.

If nothing qualifies:

```text
NO_SUITABLE_AGENT_AVAILABLE
```

---

# 40. Quota-aware routing

Track:

```text
HEALTHY
MODERATE_PRESSURE
HIGH_PRESSURE
NEARLY_EXHAUSTED
EXHAUSTED
UNKNOWN
```

Quota is a first-class routing input.

Preserve scarce high-capability quota for work that needs it.

---

# 41. Explicit quota reservation

Allow configurable quota reserves.

Example:

```yaml
quota:
  frontierReservePercent: 25
  architectReservePercent: 20
```

Reserve high-capability allowance for:

- deep planning;
- security;
- difficult debugging;
- final review.

Do not use protected reserves for low-value work unless explicitly permitted.

---

# 42. Per-phase budgets

Support budgets per phase:

```text
planning
implementation
testing
review
debugging
finalAudit
```

Possible constraints:

```text
maximum monetary cost
maximum tokens
maximum provider credits
maximum percentage of remaining allowance
```

Prevent implementation from accidentally consuming credits reserved for review.

---

# 43. Pre-execution cost prediction

Before large Jobs, estimate:

```text
LOW estimate
LIKELY estimate
HIGH estimate
```

for:

- tokens;
- monetary API cost;
- subscription/credit usage;
- scarce-quota consumption.

Warn when a Job is likely to consume an unusually high percentage of available capacity.

Do not pretend estimates are exact.

---

# 44. Budget policies

Support:

```text
QUALITY_FIRST
BALANCED
ECONOMY
MINIMUM_COST
CUSTOM
```

Default:

```text
BALANCED
```

`QUALITY_FIRST` means:

> Use the least expensive configuration with a very high probability of achieving the required result.

Not:

> Always use the most expensive model.

---

# 45. Reasoning-effort routing

Normalise provider-specific reasoning controls:

```text
MINIMAL
LOW
MEDIUM
HIGH
VERY_HIGH
MAXIMUM
```

Defaults:

```text
repository search:
    LOW

mechanical edits:
    LOW-MEDIUM

routine implementation:
    MEDIUM

normal analysis:
    MEDIUM

complex implementation:
    HIGH

architecture:
    HIGH-VERY_HIGH

deep planning:
    VERY_HIGH

complex debugging:
    HIGH-VERY_HIGH

independent review:
    HIGH-VERY_HIGH

exceptional escalation:
    VERY_HIGH-MAXIMUM
```

Reasoning effort should be selected independently of model tier.

---

# 46. Confidence-aware agent completion

Agents should not merely say `DONE`.

Require a structured completion state:

```text
CONFIDENT
UNCERTAIN
BLOCKED
NEEDS_REVIEW
FAILED
```

Include concise evidence and unresolved concerns.

Low confidence should influence escalation/review policy.

Do not rely purely on self-reported confidence; combine it with deterministic evidence.

---

# 47. Evidence-based completion gates

A task is not complete because an LLM claims it is.

Completion evidence should reference:

- files changed;
- plan version;
- tests executed;
- build result;
- lint/static-analysis result;
- review status;
- unresolved warnings;
- migration checks;
- acceptance-criteria status.

Example:

```text
CompletionEvidence
    acceptanceCriteria: 8/8 passed
    tests: passed
    build: passed
    lint: passed
    securityReview: passed
    blockingFindings: 0
```

---

# 48. Deterministic validation first

Prefer deterministic tools for proof.

Use:

- compilers;
- tests;
- static analysis;
- type checkers;
- linters;
- security scanners;
- schema validators;
- build systems;
- migration checks;
- integration tests.

Workflow:

```text
implementation
      ↓
deterministic validation
      ↓
independent review
      ↓
fixes
      ↓
deterministic validation
      ↓
review verification
```

"Tests should pass" is not acceptable evidence.

---

# 49. Semantic roles

## Scout

Tier 0-1.

## Engineer

Tier 2.

## Architect

Tier 3.

## Principal

Tier 4.

## Reviewer

Tier chosen by risk.

## Integration Engineer

Responsible for reconciling parallel work.

## Specialist Reviewer

Security/database/concurrency/etc.

Roles remain model-independent.

---

# 50. Delegation policy

Subagents may be used when supported.

All delegation should route through the orchestrator.

Example:

```text
Architect
    ├── Scout → dependency map
    ├── Scout → call-site analysis
    ├── Engineer → module A
    ├── Engineer → tests
    └── Architect → concurrency-sensitive component
```

Do not automatically use expensive workers for trivial delegated tasks.

---

# 51. Task decomposition scoring

Before splitting a task, evaluate whether decomposition improves the result.

Consider:

```text
independence of subtasks
shared state
merge conflict probability
architectural coupling
context duplication
parallel speed benefit
review complexity
```

Closely coupled tasks should remain with one worker.

Independent modules may be parallelised.

---

# 52. Parallelism policy

Use high parallelism for:

- searches;
- documentation discovery;
- independent test generation;
- isolated modules;
- static analysis.

Use conservative parallelism for:

- tightly coupled implementation;
- shared APIs;
- schema changes;
- concurrency architecture;
- migrations.

Riskier work should default to lower implementation parallelism.

---

# 53. Merge arbitration

Parallel changes must not simply overwrite each other.

Introduce an integration stage:

```text
parallel workers
        ↓
Integration Engineer
        ↓
merge conflict analysis
        ↓
architectural consistency check
        ↓
deterministic validation
        ↓
review
```

Integration should reconcile intent, not merely Git conflicts.

---

# 54. State provenance graph

Track provenance between:

- plans;
- decisions;
- tasks;
- patches;
- tests;
- findings;
- fixes;
- approvals.

Conceptually:

```text
Requirement
   ↓
PlanDecision
   ↓
ImplementationTask
   ↓
Patch
   ↓
TestResult
   ↓
ReviewFinding
   ↓
Fix
   ↓
Verification
```

Users should be able to determine which agent/provider contributed each artifact.

---

# 55. Independent review

ENABLE BY DEFAULT.

Review should use a fresh context.

Provide:

- requirements;
- accepted plan;
- relevant invariants;
- diff;
- test results;
- declared implementation deviations.

Avoid excessive implementation-agent self-justification.

---

# 56. Cross-provider review

Defaults:

```text
LOW:
    optional/proportional

NORMAL:
    cross-provider preferred

HIGH:
    cross-provider strongly preferred

CRITICAL:
    cross-provider required where another capable provider exists
```

Use another provider where possible to reduce correlated blind spots.

---

# 57. Review fallback

Prefer:

```text
1. different provider + correct tier
2. different provider + next acceptable tier
3. same provider + different family
4. same provider + different model
5. same model + isolated context
6. self-review only as final fallback
```

Record:

```text
CROSS_PROVIDER
CROSS_FAMILY
CROSS_MODEL
ISOLATED_SAME_MODEL
SELF_REVIEW_ONLY
```

---

# 58. Review specialisation

For elevated-risk changes, split review by concern when appropriate.

Possible specialist reviews:

```text
SECURITY
DATABASE
CONCURRENCY
ARCHITECTURE
ACCESSIBILITY
API_COMPATIBILITY
PERFORMANCE
RELEASE_ENGINEERING
PRIVACY
```

Do not automatically run every specialist review for every change.

Use risk and affected components.

---

# 59. Adversarial review mode

For HIGH or CRITICAL risk work, optionally instruct reviewers to actively attempt to break the implementation.

Ask them to identify:

- counterexamples;
- race conditions;
- invalid assumptions;
- malformed inputs;
- rollback failures;
- privilege-escalation paths;
- concurrency failures;
- data-loss scenarios;
- compatibility regressions.

This is distinct from ordinary code-style review.

---

# 60. Review finding lifecycle

Every material finding should have a stable identifier.

Statuses:

```text
OPEN
ACCEPTED
REJECTED
FIXED
VERIFIED
DEFERRED
FALSE_POSITIVE
```

Track reviewer, severity and resolution.

Prevent subsequent reviewers from endlessly rediscovering already-resolved issues without new evidence.

---

# 61. Finding severity

Use:

```text
BLOCKING
IMPORTANT
MINOR
OPTIONAL
FALSE_POSITIVE
```

Avoid unnecessary churn for subjective stylistic preferences.

---

# 62. False-positive reviewer tracking

Track reviewer precision.

If a model repeatedly produces invalid review findings, lower its review-specific competency score without necessarily lowering its implementation score.

Likewise, models that consistently identify valid defects should gain review competency.

---

# 63. Provider diversity across whole Job

Track provider provenance across:

```text
planning
implementation
review
audit
```

Review selection should receive a diversity bonus when it introduces genuinely independent model-family reasoning.

Example:

```text
Planning       Provider A
Implementation Provider B
Review          Provider C
```

may offer stronger independence than using Provider A for all three.

Do not force diversity when it materially lowers competence.

---

# 64. Multiple reviewers

Use multiple reviewers only when justified.

Examples:

- CRITICAL security;
- migration;
- widespread API changes;
- major architecture;
- reviewer disagreement.

If reviewers disagree:

1. validate findings using code/tests;
2. ask an Architect-tier adjudicator;
3. escalate to Principal only if uncertainty remains.

Prefer an adjudicator independent of original implementation.

---

# 65. Shadow evaluation mode

Support optional shadow evaluations.

A second inexpensive agent may independently assess:

- task classification;
- plan quality;
- implementation;
- review result;

without directly affecting the workflow.

Compare outcomes to improve competency data.

Do not shadow every task.

Use configurable sampling.

Example:

```yaml
learning:
  shadowEvaluation:
    enabled: true
    sampleRate: 0.05
```

---

# 66. Escalation

Conceptually:

```text
Tier 0
  ↓
Tier 1
  ↓
Tier 2
  ↓
Tier 3
  ↓
Tier 4
```

Escalate on:

- repeated deterministic failure;
- low confidence;
- unresolved ambiguity;
- conceptual defects;
- difficult security;
- repeated implementation failure;
- architecture disagreement.

Do not escalate for superficial stylistic differences.

---

# 67. De-escalation

Once strong planning has constrained the problem, deliberately step down when appropriate.

Example:

```text
Tier 3 planning
      ↓
Tier 2 implementation
      ↓
Tier 1 repetitive edits
      ↓
Tier 3 independent review
```

This is essential for efficient usage.

---

# 68. Provider health and brownout handling

Track:

```text
HEALTHY
DEGRADED
BROWNOUT
RATE_LIMITED
QUOTA_PRESSURE
QUOTA_EXHAUSTED
UNAVAILABLE
AUTH_ERROR
UNKNOWN
```

A provider may technically respond while performing poorly.

Brownout signals may include:

- high latency;
- repeated tool failures;
- unusually high error rates;
- dropped sessions;
- incomplete responses.

Avoid starting new phases on a degraded provider where suitable alternatives exist.

Existing sticky phases should follow continuity rules.

---

# 69. Tool reliability scoring

Track runtime/tool quality separately from model quality.

Metrics:

```text
shellSuccessRate
fileEditSuccessRate
gitOperationSuccessRate
testExecutionSuccessRate
sessionResumeReliability
toolTimeoutRate
```

A strong model with unreliable tooling may be a poor implementation choice.

---

# 70. Reproducible routing

Given identical:

- capability catalogue;
- project policy;
- quota state;
- health state;
- budget;
- task/risk classification;

the routing decision should be deterministic unless randomised exploration is explicitly enabled.

Avoid unexplained randomness.

This makes failures and cost behaviour reproducible.

---

# 71. Routing scoring

After hard filters:

```text
score =
      capabilityFit
    + taskSpecificCompetency
    + projectSpecificCompetency
    + reasoningFit
    + runtimeFit
    + toolReliability
    + historicalReliability
    + contextFit
    + availabilityConfidence
    + lifecycleFitness
    + providerDiversityBonus
    - monetaryCostPenalty
    - quotaScarcityPenalty
    - latencyPenalty
    - recentFailurePenalty
```

Weights vary by task type.

---

# 72. Context-window-aware routing

Estimate required context from:

- issue;
- repository;
- plan;
- diff;
- logs;
- tests;
- review history.

Do not choose a candidate with insufficient context capacity.

Large context should not justify wasteful whole-repository prompting.

---

# 73. Automatic context compaction

As phases grow, produce structured summaries.

Examples:

```text
repository facts
decisions
plan version
completed tasks
open tasks
test state
review findings
invariants
```

Use these for resumed sessions and future phases.

Do not store hidden reasoning.

This should materially reduce token consumption.

---

# 74. Project knowledge caching

Cache stable project information:

- architecture;
- coding conventions;
- invariants;
- build commands;
- test commands;
- supported platforms;
- provider integration conventions.

Invalidate when relevant repository changes occur.

Avoid repeatedly rediscovering unchanged facts.

---

# 75. Security boundaries for destructive operations

Certain actions should require explicit policy gates regardless of model capability.

Examples:

```text
production deployment
database destructive migration
force push
branch deletion
credential rotation
mass data deletion
publishing releases
external communications
production secret changes
```

Support:

```text
AUTO
REQUIRE_HIGH_CONFIDENCE
REQUIRE_REVIEW
REQUIRE_HUMAN_APPROVAL
PROHIBITED
```

---

# 76. Human approval checkpoints

Treat humans as valid participants in orchestration.

Optional approval gates may occur for:

- major architecture;
- destructive migration;
- security-critical decisions;
- production deployment;
- public release;
- cost threshold breaches.

The system should resume cleanly after approval.

---

# 77. Rollback planning

HIGH/CRITICAL changes should normally define rollback before implementation.

Rollback artifacts may include:

- schema rollback;
- feature flag disablement;
- deployment rollback;
- backup/restore plan;
- config rollback;
- version rollback.

Reviewers should evaluate rollback feasibility.

---

# 78. Stop-work criteria

Agents must know when to stop.

Stop when:

- acceptance criteria are satisfied;
- deterministic validation passes;
- required reviews are complete;
- no blocking findings remain.

Do not continue refactoring or improving unrelated areas merely because additional context/tokens remain available.

Prevent scope creep.

---

# 79. Simulation / dry-run mode

Provide a mode such as:

```text
orchestrator plan --dry-run
```

or equivalent.

Show:

- proposed phases;
- candidate tiers;
- likely providers;
- reasoning levels;
- review strategy;
- fallback strategy;
- quota implications;
- estimated cost;
- approval gates.

No code changes or paid inference beyond minimal planning/discovery should occur unless explicitly allowed.

---

# 80. Routing visibility

ENABLE BY DEFAULT.

Provide concise summaries such as:

```text
Planning
  Architect tier · Provider A

Implementation
  Engineer tier · Provider A

Tests
  Economy tier · Provider B

Review
  Architect tier · Provider C
  Cross-provider independence achieved
```

Users may disable routine visibility.

Detailed internals may live in verbose/debug mode.

Do not expose hidden chain-of-thought.

---

# 81. Explainability

Users may ask:

```text
Why was this agent selected?
```

Return concise reasons such as:

```text
Selected an Architect-tier agent because the change is
a high-risk schema migration.

A cheaper model was rejected because it fell below the
minimum planning tier.

Another suitable provider was under quota pressure.
```

---

# 82. Routing decision records

Store structured data such as:

```json
{
  "task": "DEEP_PLANNING",
  "risk": "HIGH",
  "preferredTier": 3,
  "minimumTier": 3,
  "provider": "...",
  "model": "...",
  "runtime": "...",
  "reasoningEffort": "VERY_HIGH",
  "phaseSticky": true,
  "selectionReasons": [
    "strong planning competency",
    "healthy quota",
    "sufficient context",
    "required runtime capabilities"
  ]
}
```

No hidden reasoning.

---

# 83. Historical dashboard

Provide data allowing users to analyse:

- cost per accepted change;
- first-pass success;
- average retries;
- model/provider utilisation;
- quota usage;
- review accuracy;
- defect escape rate;
- average latency;
- common failure categories;
- project-specific competency.

Possible views:

```text
Best model for Swift implementation
Best provider for code review
Lowest cost per accepted PHP change
Highest false-positive reviewer
Most reliable agent runtime
```

This should be optional and privacy-conscious.

---

# 84. Failure handling

Distinguish:

```text
TRANSIENT_PROVIDER_FAILURE
RATE_LIMIT
QUOTA_EXHAUSTED
AUTH_FAILURE
MODEL_UNAVAILABLE
MODEL_RETIRED
CONTEXT_OVERFLOW
TOOL_UNSUPPORTED
RUNTIME_FAILURE
AGENT_FAILURE
VALIDATION_FAILURE
QUALITY_FAILURE
PLAN_DRIFT
MERGE_CONFLICT
```

Each should have appropriate recovery behaviour.

---

# 85. Convergence controls

Prevent infinite loops.

Example:

```text
implementation
    ↓
validation

failure
    ↓
bounded correction attempts

repeated failure
    ↓
escalate

validation passes
    ↓
review

blocking finding
    ↓
fix

revalidate
    ↓
review verification

repeated conceptual disagreement
    ↓
architect adjudication

still unresolved
    ↓
principal escalation
```

Track attempts and whether progress is actually occurring.

---

# 86. Configuration

Support configuration conceptually like:

```yaml
orchestrator:
  mode: balanced

  discovery:
    autoDiscover: true

  routing:
    preferCheapestQualified: true
    reserveFrontierCapacity: true
    deterministic: true
    learnTaskCompetency: true

  continuity:
    stickyWithinPhase: true
    quotaPauseThresholdHours: 12
    midPhaseAgentSwitch:
      enabled: false

  quota:
    frontierReservePercent: 25
    architectReservePercent: 20

  planning:
    lockApprovedPlan: true
    detectPlanDrift: true

  review:
    independent: true
    preferDifferentProvider: true
    requireDifferentProviderForCritical: true
    adversarialForHighRisk: true

  learning:
    enabled: true
    shadowEvaluation:
      enabled: true
      sampleRate: 0.05

  remoteCatalogue:
    enabled: true
    service: MWBM-intAppsAPI

  visibility:
    routingSummary: true

  destructiveActions:
    productionDeploy: require_human_approval
    destructiveMigration: require_human_approval
```

Adapt syntax to repository conventions.

---

# 87. User overrides

Allow users to:

- enable/disable providers;
- prioritise providers;
- pin providers/models;
- prohibit providers/models;
- override tiers;
- override competencies;
- configure quotas;
- configure budget;
- change reasoning levels;
- require cross-provider review;
- permit mid-phase takeover;
- disable learning;
- disable remote intelligence;
- configure shadow evaluation;
- configure human approval;
- override policy packs;
- force discovery refresh.

Explicit user policy should override automatic optimisation where safe.

---

# 88. Provider lifecycle

Represent:

```text
UNKNOWN
ACTIVE
PREVIEW
LEGACY
DEPRECATED
RETIRED
```

Prefer ACTIVE models where capability is comparable.

Preview models may be used where explicitly permitted or uniquely beneficial.

Never start new work on RETIRED models.

---

# 89. Security

Provider credentials must never appear in:

- prompts;
- repository files;
- logs;
- telemetry;
- generated committed configuration.

Use secure credential storage.

Apply least privilege.

Validate provider responses.

Redact sensitive errors.

Review remote capability metadata signatures.

---

# 90. Normal substantial workflow

Target behaviour:

```text
Scout
  repository reconnaissance
        ↓

Engineer
  requirements/current-state analysis
        ↓

Architect
  architecture + deep planning
        ↓

Independent plan critique when warranted
        ↓

Plan lock
        ↓

Engineer
  implementation
        ↓

Utility/Engineer workers
  tests/docs/repetitive changes
        ↓

Integration Engineer
  merge/reconcile parallel work
        ↓

Deterministic validation
        ↓

Architect from different provider
  independent review
        ↓

Specialist review where risk requires
        ↓

Engineer/Architect
  corrections
        ↓

Deterministic validation
        ↓

Reviewer verification
        ↓

Evidence-based completion gate
```

---

# 91. Small-task fast path

For:

```text
typo
README wording
formatting
simple rename
obvious mechanical change
```

allow:

```text
Utility/Economy worker
        ↓
relevant deterministic check
```

Do not force unnecessary architectural workflow.

---

# 92. Critical-work path

For CRITICAL work:

```text
Architect analysis
        ↓
Architect/Principal planning
        ↓
independent plan critique
        ↓
human approval if configured
        ↓
plan lock
        ↓
implementation
        ↓
deterministic validation
        ↓
mandatory cross-provider review where possible
        ↓
specialist adversarial review
        ↓
correction
        ↓
revalidation
        ↓
final Architect/Principal audit
        ↓
human approval where required
```

---

# 93. Testing requirements

Build extensive automated tests.

## Discovery

Test:

- new unknown model;
- disappearing model;
- lifecycle change;
- incomplete metadata;
- discovery failure;
- cache invalidation.

## Classification

Test:

- general tier;
- specialist classification;
- uncertain classification;
- provider metadata conflict;
- capability provenance.

## Canary routing

Test:

- new model starts provisional;
- receives only permitted workloads;
- confidence increases after successful outcomes;
- critical tasks reject insufficiently validated model.

## Task-specific competency

Test:

- cheaper historically better model wins;
- insufficient evidence does not override stronger baseline capability;
- project-specific competency works.

## Context quality

Test:

- poor context triggers improved retrieval before tier escalation.

## Routing

Test:

- cheap qualified worker selected;
- expensive worker avoided when unnecessary;
- tool/runtime requirements enforced;
- context limits enforced.

## Quota

Test:

- quota reserves;
- pressure;
- scarce frontier protection;
- per-phase budgets.

## Mid-phase exhaustion

Test reset at:

```text
10 minutes
2 hours
11h59m
```

Expected:

```text
checkpoint
PAUSED_AWAITING_QUOTA
NO AGENT SWITCH
resume same owner
```

## >12 hours

Expected:

```text
checkpoint
BLOCKED_AWAITING_AGENT
NO AUTOMATIC TAKEOVER
```

## Unknown reset

Do not invent reset time.

## Model retirement mid-phase

Controlled takeover + stronger review.

## Git checkpointing

Test:

- resumable branch/worktree;
- dirty state;
- restart recovery.

## Plan locking

Test:

- plan hash;
- version;
- unchanged implementation;
- revised plan.

## Drift detection

Test:

- minor detail accepted;
- architectural drift triggers replan.

## Parallelism

Test:

- independent tasks parallelise;
- coupled tasks remain serial.

## Merge arbitration

Test:

- conflicting agent changes reconciled;
- intent preserved.

## Independent review

Test:

- cross-provider preference;
- CRITICAL requirement;
- fallback hierarchy.

## Review findings

Test:

- stable IDs;
- finding status lifecycle;
- false-positive tracking.

## Shadow evaluation

Test:

- sampled only;
- does not alter main workflow;
- updates learning safely.

## Deterministic completion

Test:

- cannot report complete with failed mandatory tests;
- evidence gate passes correctly.

## Destructive operations

Test:

- approval gate enforced;
- prohibited operation blocked.

## Cost prediction

Test:

- low/likely/high estimates;
- quota impact warnings.

## Provider brownout

Test:

- new phases avoid degraded provider;
- sticky active phase does not switch casually.

## Convergence

Test:

- loops bounded;
- escalation occurs;
- stop criteria enforced.

---

# 94. Synthetic provider simulator

Create deterministic mock adapters.

Example:

```text
Provider A
    Architect available
    quota reset in 3h

Provider B
    Architect available
    healthy

Provider C
    Engineer available
    cheap
```

Prove:

```text
If Provider A phase has not started:
    another provider may be chosen.

If Provider A is already halfway through the phase:
    pause and resume Provider A after reset.
```

Also simulate:

- provider outages;
- brownouts;
- rate limits;
- retired models;
- tool failures;
- high costs;
- cross-provider review.

---

# 95. Observability

Log events such as:

```text
task classified
risk classified
context quality evaluated
candidate discovered
candidate rejected
candidate selected
capability source updated
phase lease established
plan locked
plan drift detected
checkpoint created
quota pause
quota resume
fallback
takeover
provider brownout
parallel task launched
integration stage started
review finding created
finding verified
escalation
de-escalation
human approval requested
completion gate passed
```

Never log secrets or hidden chain-of-thought.

---

# 96. Documentation

Document:

- architecture;
- object model;
- provider adapters;
- runtime adapters;
- capability tiers;
- specialist capabilities;
- task classification;
- risk classification;
- project invariants;
- policy packs;
- plan contracts;
- plan locking;
- drift detection;
- phase stickiness;
- checkpointing;
- Git integration;
- quota behaviour;
- fallback;
- task decomposition;
- parallelism;
- merge arbitration;
- review independence;
- specialist review;
- review finding lifecycle;
- competency learning;
- remote capability intelligence;
- canary routing;
- shadow evaluation;
- cost prediction;
- dashboards;
- human approval;
- security;
- adding new providers.

Include diagrams where useful.

---

# 97. Implementation procedure

Before changing code:

1. inspect the entire relevant repository structure;
2. identify current provider/model selection logic;
3. identify existing agent abstractions;
4. inspect configuration;
5. inspect tests;
6. inspect Git/worktree workflows;
7. identify storage requirements;
8. design the orchestration object model;
9. produce a deep implementation plan;
10. critique the plan independently where warranted;
11. lock the approved plan;
12. implement incrementally;
13. test continuously;
14. review independently;
15. fix valid findings;
16. perform completion-gate verification.

Do not create duplicate systems when existing abstractions can be extended cleanly.

---

# 98. Security/correctness completion gate

Before declaring implementation complete:

- run full relevant tests;
- run static analysis;
- run linting;
- inspect credential handling;
- inspect provider errors;
- validate remote metadata signatures;
- validate checkpoints;
- review concurrency;
- review quota scheduling;
- review resume behaviour;
- review plan drift detection;
- review Git recovery;
- review provider failover;
- review destructive-action gates;
- review telemetry/privacy;
- simulate quota exhaustion;
- simulate process restart while paused;
- simulate model retirement;
- simulate provider brownout;
- simulate review disagreement;
- perform independent cross-provider review where available.

Fix valid findings.

---

# 99. Acceptance criteria

The orchestrator is incomplete unless all of the following are true:

- model names are not hard-coded into central routing;
- unknown future models can be discovered;
- new models receive provisional classification;
- canary routing protects against unvalidated models;
- providers and runtimes are distinct abstractions;
- semantic roles are independent of model identity;
- task and risk classifications are separate;
- project invariants are first-class;
- policy packs work;
- strong planning is front-loaded;
- plans are versioned and lockable;
- implementation drift can be detected;
- task decomposition is intelligent;
- parallelism is risk-aware;
- parallel changes receive explicit integration;
- Git-backed checkpoints support recovery;
- phases remain sticky once started;
- quota reset within 12 hours pauses/resumes the same phase owner;
- long/unknown quota interruptions do not silently switch models;
- controlled takeover exists for unavoidable retirement;
- pre-phase fallback works;
- quota reserves work;
- per-phase budgets work;
- token and credit scarcity influence routing;
- reasoning effort is selected independently;
- completion confidence is structured;
- completion requires evidence;
- deterministic validation is authoritative;
- local competency learning is enabled;
- project-specific competency is supported;
- failure taxonomy is recorded;
- context quality is evaluated before unnecessary escalation;
- capability provenance is recorded;
- remote signed intelligence is supported;
- shadow evaluation is available;
- cross-provider review is preferred;
- CRITICAL cross-provider review is required when feasible;
- review specialisation exists;
- adversarial review exists;
- review findings have lifecycle tracking;
- reviewer false positives influence competency;
- provider diversity is considered across the whole Job;
- provider brownouts are detected;
- tool reliability is tracked independently;
- routing decisions are reproducible;
- routing is explainable;
- cost can be estimated before execution;
- simulation/dry-run mode exists;
- destructive actions can require approval;
- human approval is supported;
- rollback planning is first-class;
- stop-work criteria prevent scope creep;
- dashboards can report orchestration performance;
- new providers can be added without rewriting routing logic;
- comprehensive automated tests exist.

---

# 100. Explicit anti-patterns

Do NOT:

- hard-code today's flagship models;
- hard-code today's economy models;
- equate price with intelligence;
- equate context length with quality;
- always choose the strongest model;
- always choose the cheapest model;
- ignore provider quota;
- consume reserved high-tier quota for trivial work;
- switch LLMs mid-phase merely because credits temporarily ran out;
- invent quota reset times;
- lose agent work when pausing;
- store hidden chain-of-thought;
- silently change an approved architecture during implementation;
- allow parallel workers to overwrite each other's intent;
- let an implementation agent solely approve its own work;
- run expensive model benchmarks constantly;
- allow new unvalidated models to immediately dominate critical workloads;
- repeatedly retry dead providers;
- confuse model intelligence with runtime reliability;
- expose credentials;
- let agents continue working after acceptance criteria are satisfied;
- automatically perform destructive production actions without policy approval;
- require a plugin update every time providers introduce new model versions.

---

# 101. Desired behaviour

The orchestrator should behave like an experienced engineering manager supervising a mixed team.

It should understand:

```text
A Scout can discover the repository.

An Engineer can execute a well-defined design.

An Architect should remove difficult uncertainty.

A Principal should be reserved for exceptional cases.

A specialist should be used where specialised expertise matters.

A different senior engineer should independently review
important work.

Multiple engineers should work in parallel only when their
tasks are sufficiently independent.

An Integration Engineer should reconcile concurrent changes.

Plans should not silently change halfway through implementation.

Important decisions should have provenance.

Claims of completion require evidence.

High-value model quota should be preserved for high-value work.

And an engineer halfway through a task should not be replaced
merely because their AI usage allowance temporarily ran out.
```

The identities of available workers will continually change.

The orchestration intelligence must not.

The long-term goal is for `dev-team-plugin` to behave not as a wrapper around a collection of LLMs, but as a **provider-independent autonomous software-engineering organisation** that assigns the right work to the right intelligence, preserves continuity, measures outcomes, learns from experience, independently verifies results, and continuously optimises for GIRFT.
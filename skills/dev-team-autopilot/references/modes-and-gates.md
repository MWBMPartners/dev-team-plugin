# Modes & Gates

Two things the conductor needs at every cycle: **what "one cycle" means in the mode it picked**, and **which actions it may do alone vs. must queue or pause on**. The first keeps each iteration small and resumable; the second is what makes unattended running safe.

## Modes — one cycle per iteration

Each mode is a sibling skill whose protocol you follow for **exactly one cycle**, then yield. You are the lead; the cycle's agents are yours (subagents can't spawn subagents). Read the named protocol when you enter the mode.

> **OVERRIDE — single run branch.** When running any sibling as a MODE, **skip that skill's own Git-isolation / branch-creation step entirely.** The conductor created the one run branch `autopilot/<date>` at bootstrap; every mode cycle commits its single commit *there* and records it as `last_commit`. The per-skill branch names (`iterate/<date>`, `security-audit/<date>`, `review-fix/<date>`) apply only when those skills run standalone — never under the conductor. This preserves the single-branch rollback/crash-recovery invariant `loop-runtime.md` depends on (otherwise `last_commit` could point at a commit on a different branch).

| Mode | Source skill | What "one cycle" is | Commit |
|---|---|---|---|
| **discovery** | `dev-team-featurefind` | One research-and-score pass that creates/refreshes `.dev-team/FEATURES.md`. Usually only at bootstrap and when in-scope gaps run low. | doc-only (ledger) |
| **iterate** | `dev-team-iterate` | One cycle contract: pick top backlog item(s) of a theme → builders → checker (UX rubric / perf evidence / purpose-fit) → checkpoint → one commit. | one per cycle |
| **security: Phase 0** | `dev-team-security` | The first SECURE iteration only: security scout + tooling sweep (SCA/SAST/secret/container) + sandbox + multi-role fixtures + threat model + attack-surface map + coverage ledger → `.dev-team/SECURITY.md`. Heavy setup; it **yields before any attack**. | doc-only (`SECURITY.md`) |
| **security: purple-team** | `dev-team-security` | Each later SECURE iteration: one purple-team cycle on a surface/class — RED (attack→PoC, seeded by Phase-0 leads) → VALIDATE (skeptic) → BLUE (fix + regression test) → VERIFY (re-attack the fix) → one commit. | one per finding/batch |
| **feature build** | `dev-team-orchestrator` | One stage of an **approved** feature spec: plan → delegate → check → checkpoint → one commit. Only runs on a gate-ledger item the user already approved, citing its authored full spec verbatim. | one per stage |
| **verify** | `dev-team-review` | One verification workstream (a claim-group, or the clean-room integration check) → fresh evidence → verdicts. **Read-only (verdicts only).** | none (read-only) |

Splitting security setup from its attack cycles, like DISCOVER's setup is already split out, is what keeps the heavy Phase-0 work from blowing the one-small-cycle blast-radius guarantee. Keep every cycle inside the mode's blast-radius cap; if a "cycle" is ballooning, split it. After the cycle: documentarian writes `.dev-team/PROJECT.md`, you update `autopilot.json`, you yield.

### VERIFY is report-only under the conductor (no recursion, no second branch)
`dev-team-review` defaults to `remediate=fix`, whose fix phase "activates" sibling skills on a `review-fix/<date>` branch and re-verifies — which would recurse into a second orchestration, cut a second branch, and break the flattened one-cycle-per-commit model. So the conductor **always runs review-mode with `remediate=report` on the run branch**: it produces verdicts + `.dev-team/VERIFICATION.md` + `.dev-team/verdict.json` only. It does NOT enter review's fix phase, does NOT create a `review-fix` branch, and does NOT activate sibling skills. Each FAILED/DRIFTED/HOLLOW verdict is converted by the conductor into a queued item / **phase re-open** under the normal gate policy (bug → STABILIZE, security → SECURE, feature-spec drift → COMPLETE) and fixed on a *later* iteration as an ordinary one-cycle move on the run branch. (`dev-team-review`'s own "Running inside the conductor" section states the same, so the skill stays correct standalone.)

### Reusing prior state across modes
The modes share the same external memory, so they compound instead of repeating:
- `featurefind` and `iterate` both reuse the **Codebase Map** in `.dev-team/PROJECT.md` (don't re-scout what's mapped).
- **Global gate — iterate's safety-net.** Before any *behaviour-touching* cycle in any mode: thin coverage → a characterization-test cycle is forced first. Never refactor or fix blind. (If a net genuinely can't be established and only behaviour-touching work remains, that's a Bucket-3 hard pause.)
- **Global gate — security's active-compromise rule.** If any cycle surfaces evidence the live system is *already* compromised, it is incident response, not an audit: hard-pause immediately and do not auto-fix (Bucket 3 below). This overrides the autonomous-fix bucket regardless of how clear the remediation looks.
- `security` writes `.dev-team/SECURITY.md`; `review` reads `.dev-team/PROJECT.md` + `SECURITY.md`. `autopilot.json` points at all three.

## The hybrid gate policy

Every action a cycle produces falls into one of three buckets. Apply it in step 6 of the loop.

### The feature autonomy test (do the obvious; consult on the doubtful)

Features are **confidence-gated, not blanket-gated** — the bias is maximum autonomy on the obvious, consultation on the doubtful. The conductor builds a feature *without asking* only when it can justify **all four**:

1. **table-stakes & in-scope** — featurefind classed it `table-stakes` (category-standard, users expect it), with high purpose-fit grounded in the existing code (the architecture / data model / scaffolding already hosts it — not a foreign subsystem). A `differentiator` is **not** autonomy-eligible — it shapes product direction, which is the user's call — nor is anything out-of-scope.
2. **low-risk by the validated score** — featurefind's `risk` for this gap is `Low`. A `Med`/`High` risk score disqualifies autonomy; the skeptic-validated risk is a hard floor, not re-litigable by the conductor.
3. **net-positive & contained** — a concrete spec, fits existing patterns, holds the UX rubric (no added clutter/steps), bounded blast radius, a safety net exists, code-reversible (one commit on the run branch).
4. **not Bucket-3-class** — the feature does not itself introduce a destructive / irreversible / external-touching capability (data deletion or purge, schema-rewriting migration, sending to or mutating production/external systems, auth/permission changes). If it does, it is **Bucket 3** regardless of scope-fit or risk score — *commit-revertibility does not undo shipped effects.*

If all four hold, it builds it (Bucket 1) and surfaces what it did. Otherwise — a differentiator, `risk` ≥ Med, out-of-scope-leaning, large/architectural, or Bucket-3-class — it **asks** (Bucket 2, or Bucket 3 for the destructive class). **When any criterion is uncertain, default to asking** — featurefind's "when in doubt, out of scope" becomes the conductor's "when in doubt, ask." (`gates=pause-all` makes *every* feature ask; `gates=autonomy-envelope` can opt specific differentiators/areas in.)

### Bucket 1 — Autonomous (do it, no stop)
The loop performs these unattended, cycle after cycle. Safe because they hold the invariants (tests green, behaviour preserved unless intentionally flagged, every cycle commits):

- correctness/bug fixes under the safety net,
- characterization / safety-net / unit tests,
- **clear** security fixes (parameterized queries, output encoding, authz checks, input validation, security headers, secret removal + rotation flag, **patch-level** dep bumps for CVEs),
- UX polish & robustness (validation, empty/loading/error states, a11y fixes, consolidating redundant surfaces),
- performance work (with before/after evidence),
- code dedup / refactor under a test net,
- docs,
- **net-new features that pass the autonomy test** (all four criteria above). The conductor authors the full spec, **records the justification** (why table-stakes + why net-positive + why not Bucket-3-class) in `.dev-team/PROJECT.md` and the gate-ledger item (`status: auto-cleared`, `cleared_by: autonomy-test`, with the justification — this logged justification is the **approval-of-record** under the conductor), builds it through a normal feature cycle (checker + UX rubric + tests + blast-radius cap + one commit on the run branch; → `status: built` when its stages complete), and **surfaces it in the report line**. This is safe *because* the feature still passes the full quality cycle and lands as revertible commits on the run branch — never merged to `main` without the user, so anything you disagree with on review is a revert.

These — plus the obvious in-scope features — are the bulk of production-readiness. The loop should spend most iterations here.

### Bucket 2 — Deferred (queue to the gate-ledger, surface, keep looping)
The loop does **not** build these alone; it writes a proposal into `gate_ledger` (`status: awaiting-user`), notes it in the iteration's report line, and moves on to Bucket-1 work. The user approves out-of-band (re-fire with a directive, or hand-edit the ledger — ingested in REHYDRATE); an `approved` item becomes a Bucket-1-style build cycle on a later iteration.

- **Features that DON'T pass all four autonomy criteria** — a `differentiator` (product-direction is the user's call), a `risk: Med/High` gap, out-of-scope-leaning / uncertain scope-fit, or large/architectural. (A feature that is itself *Bucket-3-class* — destructive/irreversible/external-touching — goes to Bucket 3, not here.) The conductor still **authors the full spec** itself (from featurefind's 2–4-line `spec-seed` + the Codebase Map — the seed is explicitly *not* a spec, but the build cycle contractually requires the full What / UX flow / behaviour-rules / scope / acceptance criteria per iterate's `cycle-contract-template.md`), writes it to the ledger item (`status: awaiting-user`) **with its reservation** (why it's unsure / out-of-scope-leaning / a differentiator), and surfaces it. What the user approves out-of-band IS that full spec (approve / edit / drop); the build cycle then cites it verbatim. The user controls *which* doubtful features get built and *exactly how* — the obvious ones the conductor already handled.
- **Major dependency upgrades** (beyond patch-level) — they break things; propose with the tradeoff.
- **Risky/architectural remediations** — auth/crypto library swaps, framework migrations, anything materially changing architecture or behaviour. Often worth a **debate** (orchestrator's debate protocol) to frame options for the user.

The key property: **deferring never halts the loop.** As long as Bucket-1 work remains, the loop keeps improving the product while gated items wait. It only pauses for these when they're *all that's left* (the "only-gated-work-left" guard).

### Bucket 3 — Hard pause (set BLOCKED, stop scheduling, surface, await the user)
These genuinely need the user before further progress is safe or sensible:

- **Active-compromise / incident signal** — a security cycle surfaces evidence the live system is *already* compromised (a live-exploited backdoor, an exfiltration path that appears already used). Set BLOCKED immediately; **do NOT auto-fix or patch** (auto-patching can destroy forensic evidence); surface it as an incident *even if the remediation looks clear*. This overrides Bucket 1 — clarity of the fix does NOT make it autonomous.
- **Contradictory requirements** — the mission/spec conflicts with itself or with what the code must do; guessing would build the wrong thing.
- **Destructive or irreversible operations** — data migration that drops/rewrites, anything touching production or external systems, a force-push, deleting user data. Never autonomous, even under `autonomy-envelope`.
- **Two-strike failure** — a workstream that failed a clear re-brief twice: the plan is wrong, not the agent; stop throwing cycles at it.
- **Unestablishable safety net + only behaviour-touching work left** — can't write characterization tests and everything remaining would change behaviour blind → conservative stop.
- **Bootstrap pre-flight failures** — dirty tree, not a git repo.
- **Only-gated-work-left** — no Bucket-1 work remains and the gate-ledger has items awaiting approval; the loop has done all it safely can.

On a hard pause: set `blocked = {is:true, reason, since}`, `state:"BLOCKED"`, surface a clear one-line ask, and let the next GUARD end the loop. The user re-fires with the answer (or approves the queued items), which clears the block in REHYDRATE and resumes.

## How the `gates` arg changes the buckets

- `gates=hybrid` (default) — the feature autonomy test above: obvious in-scope + net-positive features build autonomously (justification logged, surfaced); doubtful / out-of-scope / risky ones are queued and surfaced for approval.
- `gates=pause-all` — most conservative: the autonomy test is **off** and *every* net-new feature (and every risky item) is queued for approval — nothing feature-shaped is built unattended.
- `gates=autonomy-envelope` — the user **widens** what counts as obvious at bootstrap (e.g. "also auto-build differentiators up to L effort", or "anything touching the importer is fair game"). Items inside the envelope auto-build even if the default test would have asked; items outside follow the normal test. **Bucket 3 (destructive/irreversible, and active-compromise) is never waived** regardless of envelope.

## Surfacing — the user always sees the queue

Whatever the policy, every iteration's report line names what was deferred and why, and any blocker. The gate-ledger is the running approval queue; the user can glance at `autopilot.json`/`.dev-team/PROJECT.md` between cycles, approve or redirect, and re-fire. Silent accumulation is a failure mode — the whole point of "surface, don't block" is that the user stays informed without having to babysit.

## The engine's action levels and the buckets (added 17 November 2026)

When the engine is available, `engine.sh gate check --action KIND` maps an action to one of five levels and says which
bucket it lands in: AUTO is bucket 1; REQUIRE_HIGH_CONFIDENCE is bucket 1 only with a confident agent and a passing
deterministic check, otherwise bucket 2; REQUIRE_REVIEW is bucket 2 until an independent review has verified it;
REQUIRE_HUMAN_APPROVAL is bucket 3 (the gate ledger and `/dev-team-approve`); PROHIBITED is refused. See
`docs/orchestrator/destructive-actions.md`. A quota reset that is unknown, or more than 12 hours away, is a hard pause
reason (bucket 3: the owner is asked).


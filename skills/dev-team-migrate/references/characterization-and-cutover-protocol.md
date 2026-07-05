# Characterization & Cutover Protocol (`mode=execute`)

This is what makes `dev-team-migrate` safe rather than merely fast: you never touch behavior you
haven't pinned first, and you never move except in reversible, independently-green slices. Four
parts: **build the net → cut over stage by stage → bridge coexistence with shims → finish with a
real cutover.** Follow this end to end once `mode=plan`'s Migration Plan is approved.

## Part 1 — Building the characterization-test net (Stage 0, mandatory, first)

A **characterization test** (a.k.a. golden-master / approval test) captures what the code **actually
does now**, for representative real inputs — not what it *should* do. That's the whole point: it
lets a later stage prove "still behaves the same" without anyone having to already know every
correct output by heart. Build this net before any migration code moves; it is Stage 0 in the Stage
Ledger, gets its own commit and checkpoint, and every later stage's "verify" step re-runs it in
full.

**Match the technique to what's migrating:**

- **Framework/language major upgrade.** If the existing suite is healthy, it *is* the primary net —
  run it as-is against the pre-upgrade code first to confirm it's actually green before you touch
  anything. Where coverage is thin around the core flows, add characterization tests there first
  (same Safety-Net-Gate idea as `dev-team-iterate`): snapshot/approval tests around representative
  inputs, and golden-master captures of key outputs (rendered output, serialized responses, computed
  values) run against the untouched `from=` code.
- **Dependency swap (`libA` → `libB`).** Write a thin **adapter-boundary test**: exercise the
  *current* library's observed behavior through the code's own call sites (not the old library's own
  test suite, which proves the wrong thing) — capture real inputs/outputs at the boundary your code
  actually uses.
- **Schema migration.** Fixture-based tests that read and write through the real data-access layer,
  verifying round-trip integrity on realistic data; if using `expand-contract` (Part 3), add a test
  specific to the coexistence window confirming **both** the old and new schema shapes are correctly
  readable/writable while both exist.
- **API/interface port.** Contract tests or recorded request→response pairs (a snapshot of real
  traffic, or a documented contract) run against **both** the old and new endpoint during the
  coexistence window; add consumer-driven contract tests if there are external callers you don't
  control.

**Untestable fallback — conservative mode.** If a genuine net truly can't be built (no harness, an
opaque legacy system, no realistic fixtures achievable), say so to the user explicitly and switch to:

- The **smallest possible additive step** per stage — never a broad in-place rewrite without a net.
- Default to `strategy=parallel-run` even if `plan` mode picked something else, so behavior
  divergence between old and new is caught **empirically at runtime** (shadow-read/dual-write
  comparison) rather than assumed correct from reasoning alone.
- A manual verification pass at each stage, documented as such (not silently treated as equivalent to
  an automated net) in the Stage Ledger's notes column.

The net must **pass against the untouched `from=` state** before Stage 1 begins — a red
characterization test at Stage 0 means either the test is wrong or the "current behavior" you're
about to preserve is already broken; resolve which, explicitly, before proceeding.

**Execution environment for data-mutating steps (non-negotiable).** Stage 0's characterization
writes, and every later data-mutating stage (backfill, dual-write, contract/DROP), default to
running against a **DISPOSABLE** datastore — a restored snapshot, fixtures, or a dedicated test
instance — never against the live/production store unless the user has given explicit, informed
confirmation to target `db-target=live` (SKILL.md's Non-negotiable migration rule 6, mirroring
`dev-team-stripe`'s test-mode-default + `live=confirm`). Record, in the Stage Ledger, which datastore
each data-touching stage actually ran against. This is independent of the code-level reversibility
this protocol otherwise guarantees: `git revert` undoes the commit, it does not undo a write, a
backfill, or a DROP already executed against real data.

## Part 2 — Staged, reversible cutover discipline

Per stage, from the approved Migration Plan:

1. **Migrate one coherent slice.** "Coherent" = the slice defined in the Stage Ledger — bounded to
   the files/modules/schema objects the plan named for this stage. If the actual diff sprawls
   noticeably past the plan's estimated blast radius, **stop and split it** rather than commit an
   oversized slice (same discipline as `dev-team-iterate`'s cycle blast-radius cap) — an oversized
   commit is neither reviewable nor cleanly revertible.
2. **Verify — both halves, every stage:**
   - The stage's **own** acceptance criteria (from the Stage Ledger entry).
   - A **full re-run of the characterization net** — not just this stage's slice. This is the
     non-negotiable part: a stage that passes its own narrow tests while an *earlier-established*
     characterization test regresses has not preserved behavior, it has **relocated** the bug — and
     that is exactly the failure mode a big-bang or "spot check it at the end" approach misses.
     Paste real command output for both.
3. **Commit — one commit per stage.** The commit must, on its own, make the stage's `git revert`
   safe: no other stage's changes bundled in, no half-applied dependency on a not-yet-run later
   stage. If a stage genuinely can't be made independently revertible as scoped, it's cut wrong —
   split or resequence it back in `plan` mode terms before proceeding.
4. **Update the Stage Ledger** (`status`, `commit`, both verification columns, `rollback tested?` if
   you rehearsed it) and move to the next stage.

**Checkpoint discipline** mirrors the orchestrator's stage checkpoint: on track → documentarian
updates the ledger and commits; drifting (an assumption broke, the slice turned out bigger than
planned, a criterion can't be met as scoped) → fix or re-scope the stage — **never commit a
half-migrated or drifting stage as if it checkpointed clean.**

## Part 3 — Compatibility shims (when old and new must coexist)

Use a shim whenever the migration can't be one atomic swap: a schema change needs read/write
coexistence, an API port needs old clients to keep working mid-rollout, or a dependency swap touches
an interface many callers share.

- **Adapter / facade** — new code sits behind the old interface (or vice versa), so callers don't
  need to change yet. Good for `incremental` strategies with many internal callers.
- **Feature flag / toggle** — routes traffic between old and new path at runtime; default **OFF**
  until the owning stage's verification passes, then flipped. Rollback = flip it back, instantly.
- **Expand-contract (schema migrations)** — the standard safe pattern for live data:
  1. **Expand** — add the new columns/tables/shapes alongside the old ones; fully backward-compatible,
     old code keeps working unmodified.
  2. **Dual-write** — writes go to both old and new during the coexistence window; add the
     characterization test from Part 1 confirming both shapes stay correct.
  3. **Backfill** — populate the new shape from existing data.
  4. **Switch reads** — cut reads over to the new shape once backfill + dual-write have been verified
     consistent; old writes can stop once nothing reads the old shape.
  5. **Contract** — remove the old columns/tables. This step happens **only** in the final cutover
     stage (Part 4), never earlier — it's the one step in expand-contract that isn't cheaply
     reversible.
- **Dual-write / shadow-read (the mechanics `parallel-run` uses)** — write to both paths, compare
  read results between them, and surface any divergence before cutting reads (then writes) over to
  the new path exclusively.

**Every shim is tracked in the `Compatibility shims in play` table** (`migration-plan-protocol.md`'s
`MIGRATION.md` schema) with an explicit **removal owner** — the later stage number that removes it.
A shim with no scheduled removal is precisely the "leaving both paths half-wired" anti-pattern; it
does not get left implicit.

## Part 4 — Rollback

- **Ordinary code stages:** `git revert <stage commit>` returns to the last known-good state. Because
  every stage is independently green by construction, this is always safe — that's the entire reason
  for the one-slice-per-commit discipline.
- **Flag-gated stages (parallel-run / feature-flag shim):** rollback = flip the flag back to the old
  path. The commit itself stays (both code paths exist) until the final cutover removes the old one.
- **Schema stages:** rolling back an **expand** step is safe (drop the new, still-unused
  column/table — nothing reads it yet). Rolling back a step that has **started dual-writing** needs
  care: decide, in `plan` mode, **before the stage runs**, whether writes made since dual-write began
  can be safely discarded/backfilled on rollback, or whether rollback instead requires a data
  reconciliation step — and write that decision into the stage's Stage Ledger entry. Deciding this
  *after* something has gone wrong is exactly the scenario this protocol exists to prevent.
  Additionally, **any DB-destructive step** (a `contract`/DROP step, or dual-write cleanup that
  removes the old shape) requires a **verified backup or snapshot taken and confirmed before the
  stage runs** — not merely a discard/reconciliation decision on paper. A destructive step with no
  confirmed backup in hand does not run; `git revert` restores the code, it cannot restore dropped
  data.
- A stage whose rollback story is genuinely unresolved does not run — send it back to `plan` mode
  (Step 4 of `migration-plan-protocol.md`) to work out the rollback approach first.

## Part 5 — Final cutover + cleanup stage

Runs only after **every** prior stage's characterization net is fully green on the fully-migrated
state — this is not optional and not foldable into an earlier stage:

1. **Remove** every compatibility shim, every migration-only feature flag, and all dead old-path
   code — including, for schema migrations, the `contract` step (dropping the now-unused old
   columns/tables/shapes).
2. **Re-run the full characterization net one final time**, post-cleanup — this is the last chance to
   catch a case where removing "dead" code silently changed behavior that was still (invisibly)
   depended on.
3. **Run the project's normal test suite** end to end and confirm no functional regression.
4. The documentarian marks the Migration Plan `status: complete` in `MIGRATION.md`, records the final
   Stage Ledger state, and confirms the `Compatibility shims in play` table is empty (every row
   resolved to removed).

A migration is not done when the new path works. It is done when the old path, its shims, and its
flags are **gone**, and the characterization net still proves nothing broke on the way there.

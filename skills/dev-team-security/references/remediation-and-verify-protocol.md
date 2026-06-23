# Remediation & Verify Protocol

The blue half of the purple-team loop: turn **validated** red-team findings into **root-cause fixes** (built by the orchestrator's builders), then **re-attack to prove the hole is closed** and confirm no functional regression. A fix is not done when the code changes — it's done when the original PoC (and variants) can no longer exploit it, the fix didn't introduce a new vuln, and the app still works.

Only findings that cleared the **validation/skeptic gate** (`red-team-protocol.md`) reach this stage — don't spend fix effort on unvalidated or refuted findings.

## Principles

- **Fix the root cause, not the PoC input.** Parameterize the query; don't blacklist one payload. Enforce authorization at the boundary; don't special-case the one endpoint the red agent hit. The remediation must close the **class**, not the example.
- **Defense in depth.** Prefer layered controls (validate input *and* encode output *and* least-privilege the query). One control can fail.
- **Every fix ships with a security regression test** that fails against the vulnerable code and passes after the fix — so the vuln can never silently return.
- **No functional regression.** A security fix that breaks a feature isn't done. The full suite must stay green.
- **Lead owns dependency changes.** CVE patch bumps and library swaps go through the lead; parallel agents never race the manifest.

## Step 1 — Blue-team fix (builders)

Delegate with the orchestrator's `task-brief-template.md`, plus these security additions in the brief:

```
## Security context (this is a fix for a confirmed vulnerability)
- Finding: [F-0XX title, class, severity]
- Root cause: [file:line and why it's exploitable]
- The PoC that currently works: [paste the repro]
- Required fix approach: [root-cause remediation + defense-in-depth, e.g.
  "use parameterized queries via <the project's DB layer>; do not build SQL by
  string concatenation anywhere in this module"]

## Fix acceptance criteria
- [ ] Root cause remediated at [file:line]; the whole class is closed in this module,
      not just the single PoC input.
- [ ] A security regression test added that FAILS on the old code and PASSES now,
      exercising the exploit path (and a couple of bypass variants).
- [ ] Full test suite stays green: [test command] — paste the output.
- [ ] No new dependency without lead sign-off; flag any needed dep.
- [ ] No secret values in code, logs, or commits; if remediating a leaked secret,
      remove it AND note it must be rotated (treat as compromised).

## Report back
What you changed file-by-file, the new test, the pasted test output, and any
residual risk or follow-up you did NOT do.
```

For risky/architectural remediations (auth-library swap, major upgrade, crypto change), don't just delegate — run the orchestrator's **debate protocol** on the approach, record the decision, and take it to the user if it's expensive/irreversible (these are `propose`-disposition, not auto-fix).

## Step 2 — Verify by re-attack (checker / verifier)

The checker runs its standard pass (`checker-protocol.md`) **plus** this security verification. The fix is verified only when all of it passes:

```
## Security verification for F-0XX (in addition to the standard checker pass)
1. Re-run the ORIGINAL PoC from the finding against the sandbox. It must now FAIL
   to exploit. Paste the before (worked) vs after (blocked) evidence.
2. Try BYPASS VARIANTS — don't just confirm the exact input is blocked. Attempt
   obvious evasions (encoding, case, alternate payloads, the same flaw on sibling
   endpoints/params) to confirm the CLASS is closed, not just the one input.
3. Confirm the fix didn't merely RELOCATE the vuln (e.g. the check moved but is
   still bypassable, or the dangerous sink is now reachable another way).
4. RED-TEAM THE FIX DIFF ITSELF: review only the changed lines for NEW vulnerabilities
   the fix introduced (new input handling that's itself exploitable, a broadened
   permission, a new dependency with its own CVEs, an error path that leaks data).
   A fix that closes one hole and opens another is not done.
5. Re-run the relevant scanner(s) on the changed files — confirm no new SAST/SCA hits.
6. Run the new security regression test — confirm it meaningfully exercises the
   exploit path (not a hollow test) and passes.
7. Run the FULL test suite — confirm no functional regression. Paste output.

## Report buckets (as usual)
- CLEAN: fix verified — PoC and variants blocked, no new vuln in the diff, regression
  test real, scanners clean, suite green.
- FLAGGED & HANDLED: minor issues you fixed.
- NEEDS LEAD REVIEW: fix incomplete (a variant still works / vuln relocated / new vuln
  introduced by the diff / regression introduced / test is hollow), or a tradeoff
  needing a human call.
```

A finding moves to **fixed-verified** only on a CLEAN security verification. If a bypass variant still works, the finding stays **open** and goes back to blue with the new PoC — the same two-strikes-then-re-scope rule the orchestrator uses applies.

## Step 3 — Record & commit

- Documentarian updates the finding in the register: status `fixed-verified`, the remediation summary, the verification evidence, and the commit hash.
- Commit one commit per verified finding (or a coherent batch of related fixes) on the `security-audit/<date>` branch; message: `security: fix F-0XX [class] — [short title]`.
- This commit is the rollback point. A later fix that breaks something reverts here.

## Findings-register row (maintained in SECURITY.md)

```markdown
| id | title | class | cwe | severity | cvss | status | location | fix commit | verification |
|----|-------|-------|-----|----------|------|--------|----------|-----------|--------------|
| F-001 | IDOR on /api/orders/:id | broken-access-control | CWE-639 | High | AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N (7.7) | fixed-verified | orders/controller.ts:88 | a1b2c3d | PoC+variants blocked; diff clean; suite green |
| F-002 | Hardcoded API key | secrets | CWE-798 | High | AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N (8.2) | fixed-verified (ROTATE) | config/prod.ts:12 | e4f5g6h | removed; flagged for rotation |
| F-003 | Auth-lib replacement | authentication | CWE-287 | Medium | — | proposed | session/* | — | debate recorded; awaiting user |
| F-004 | Order race / TOCTOU | business-logic | CWE-367 | Medium | AV:N/AC:H/... | analysis-confirmed | checkout/service.ts:140 | — | reasoning recorded; PoC impractical |
| F-005 | "SSTI" in mailer | injection | — | — | — | false-positive | mailer/render.ts:22 | — | refuted: template engine autoescapes; sink unreachable |
```

Status values: `open` → `in-fix` → `fixed-verified`; or `proposed` (risky/architectural, awaiting user); `accepted-documented` (Low, justified, with rationale); `analysis-confirmed` (real, PoC impractical — kept with reasoning); `false-positive` (refuted at the validation gate, with the reason — recorded, not fixed). Secrets that were exposed carry a `ROTATE` flag until the user confirms rotation — code removal alone does not clear a leaked secret.

## Durable hardening (make it last beyond this run)

A point-in-time audit decays as the code changes. Before the loop ends, **propose** (don't silently add) wiring the audit's results into CI so regressions are caught automatically:

- Add the **security regression tests** written during fixes to the normal test run.
- Add a **SAST/SCA gate** to CI (the same `semgrep` / `npm audit` / `osv-scanner` / `gitleaks` used in Phase 0) that fails the build on new high-severity hits or new secrets.
- Suggest a **dependency-update policy** (e.g. automated PRs + a CVE SLA).

These are recommendations for the user to approve — they change the build/CI pipeline, so they go in the final report as proposed hardening, not auto-applied.

## When the loop is done for a surface

A surface is closed when every finding on it is `fixed-verified`, `proposed` (with the user), `accepted-documented`, `analysis-confirmed`, or `false-positive`, **and** a fresh red-team pass on it goes dry. Then move to the next surface; keep going until the global stop condition in `SKILL.md` (no unresolved High/Critical + red rounds dry + completeness critic satisfied, or budget hit).

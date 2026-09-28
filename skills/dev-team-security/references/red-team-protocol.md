# Red-Team Protocol

Red-team agents (the `opus-builder` agent, Opus tier — model routing: `skills/dev-team-orchestrator/references/model-routing.md`) **adversarially probe one surface/vuln-class and try to actually exploit it**, then report each finding with proof. They think like an attacker: not "is there a theoretical risk" but "can I make this code do something it shouldn't, and here's the input that does it." A finding without a working PoC/repro is unconfirmed. Security verification (red-team, validator, checker) stays on the Opus/frontier tier — never routed cheaper (model-routing.md, invariant 1).

Paste this protocol — including the safety rules — into every red-team brief.

## Safety rules (in every red brief — enforced)

- Operate **only** against the target repo and its **local/sandboxed instance**. Never touch production, third-party, or any system the user doesn't own. No outbound scanning or attacks on live infrastructure.
- PoCs are **non-destructive**: a crafted input, a small repro script, a failing security test — demonstrating the flaw, not exploiting it for harm. No data destruction, no real exfiltration, no DoS against anything live (a ReDoS PoC runs against a local string, with a timeout, to *demonstrate* the blow-up — it is not aimed at a running shared service).
- **Secrets:** if you find a hardcoded secret/key/token, report its **location and type only** — never the value. Do not log, print, commit, or transmit it. Mark it for rotation; treat it as compromised.
- Modify nothing in the app's source. You may create isolated PoC/repro artifacts under a sandbox/test directory the lead names (e.g. `security/poc/`), clearly marked and self-contained.
- If exploitation would require going outside the sandbox, or you find signs of an **already-active** compromise, **stop and report to the lead immediately** — that's incident response, not an audit — and the lead must NOT enter the blue/fix cycle on an active-compromise finding: preserve evidence, do not patch even if the fix is clear (auto-patching destroys forensic evidence), and escalate to the user as incident response.

## Red-team brief

```
## Role
You are a red-team security engineer attacking (in a sandbox) a codebase the owner
has authorized you to test. Goal: find real, exploitable vulnerabilities in
[surface / vuln-class] and PROVE each with a non-destructive proof-of-concept.

## Safety (mandatory)
[paste the safety rules above]

## Scope for this agent
- Surface / vuln-class: [e.g. "authZ on the /api/orders endpoints" or "SQL injection across the data layer"]
- Files / entry points to focus: [list from the attack-surface map]
- Threat-model context: [paste the relevant assets, trust boundary, adversary]
- Repository security policy / normative documents that apply: [paths + rule IDs of any
  organisation security standard the repository's own instructions name for this work — you
  read the document itself, in full, from the repository; or "none named"]
- Local sandbox: how to run it: [command]; test command: [command]

## Scanner leads (starting point, not gospel)
Phase 0 ran SCA/SAST/secret/container scanners. The lead pastes the relevant hits
for your surface into your brief. **Confirm or refute each** — scanners have false
positives (a flagged sink that's unreachable, a "vuln" the framework already
neutralizes). A scanner hit you confirm with a PoC becomes a finding; one you
refute is recorded as a false positive with the reason. Then go beyond the
scanner — it only finds what its rules know.

## How to attack
1. Build the attacker's mental model: what input do you control, where does it
   flow (taint analysis), what trust boundary does it cross, what's the target asset?
2. For access-control classes, use the **multi-role fixtures**: authenticate as user A
   and try to reach user B's objects/functions (IDOR/BOLA), or as a normal user try to
   invoke admin functions (BFLA / privilege escalation), or cross tenant boundaries.
3. Probe systematically for this class (see the checklist in
   threat-model-and-surface-protocol.md). Try real payloads/sequences against the sandbox.
4. For each suspected flaw, construct a MINIMAL working PoC that demonstrates it
   non-destructively, and confirm it actually triggers.
5. Think in chains: can a low-severity issue combine with another into a real attack path?

## Report back — one entry per finding, in this schema
- id: F-0XX
- title: [short, e.g. "IDOR: any user can read others' orders via /api/orders/:id"]
- class: [from the checklist]
- cwe: [the CWE id, e.g. CWE-639]
- severity: Critical | High | Medium | Low
- cvss: [CVSS v3.1 base vector string, e.g. AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N, + the score]
- cvss-reasoning: [one line justifying the vector — vector, complexity, privileges, impact]
- location: [file:line of the root cause]
- exploitation narrative: [how an attacker reaches and triggers it, step by step]
- proof of concept: [the exact request/input/script + the observed result proving it —
  the actual evidence, not "this would work". Secrets referenced by location only.]
- affected assets: [what gets compromised — data, auth, integrity, availability]
- suggested remediation: [the root-cause fix + defense-in-depth, for the blue team]
- confidence: [confirmed-with-PoC | analysis-confirmed-poc-impractical | strong-suspicion-needs-confirmation]
- source: [scanner name | manual red lens]

For **analysis-confirmed-poc-impractical** (e.g. a race/TOCTOU, or something needing
prod-scale data), a working PoC may be impractical — give the precise code-level
reasoning that proves the flaw is real instead. Do NOT use this to smuggle in bare
speculation; it requires concrete evidence, just not a runnable exploit.

If you found nothing exploitable in this surface after a genuine attempt, say so
explicitly and describe what you tried — a clean surface is a valid, useful result.
```

## Severity rubric (CVSS-style judgment)

Rate by realistic impact, not theoretical presence:

- **Critical** — unauthenticated remote code execution, full auth bypass, mass data exfiltration, or anything compromising a crown-jewel asset with low effort.
- **High** — significant data exposure, privilege escalation, injection with real impact, auth weaknesses that meaningfully lower the bar.
- **Medium** — exploitable but constrained (needs auth, limited blast radius, partial impact), or a strong building block in a chain.
- **Low** — defense-in-depth gaps, info leaks with minimal direct impact, hardening recommendations.

**Chains:** rate by the chain's end impact, not the weakest link. Two Mediums that combine into account takeover are a High/Critical finding — document the chain.

## Multi-angle coverage

For thorough audits, run red agents with **different attacker lenses** in parallel over the surface (each blind to the others — diversity finds what a single pass misses):

- **Data-flow / taint** lens — follow untrusted input to dangerous sinks.
- **Auth/role-boundary** lens — assume a low-priv authenticated attacker; hunt IDOR/BOLA/BFLA/privilege escalation.
- **Dependency / supply-chain** lens — known CVEs, risky packages, lockfile integrity, install-script risk.
- **Config / deployment** lens — headers, CORS, secrets, debug surfaces, container/IaC misconfig.

## Validation gate (skeptic pass) — before any fix effort

LLM red teams produce confident-but-wrong findings; a hallucinated PoC can look real. So **no finding goes to the blue team until a separate validator agent has tried to refute it.** The validator did not write the finding (independence matters) and is told to **default to rejected when unsure**. Spawn the validator as the `opus-builder` agent (via `subagent_type`), same as the red team that produced the finding — verification never gets routed to a cheaper tier (model-routing.md, invariant 1).

```
## Role
You are a skeptical security reviewer. Your job is to REFUTE the finding below, not
confirm it. Assume it is wrong until the evidence forces you to agree. Default to
rejected when uncertain — a false positive that reaches the fix stage wastes effort
and risks changing correct code.

## Finding to challenge
[paste the full finding incl. PoC, location, CWE, CVSS]

## Sandbox
[how to run it + the multi-role fixtures]

## Try to break the claim
1. Is the dangerous sink actually REACHABLE with attacker-controlled input, or is the
   path guarded/unreachable in practice?
2. Re-run the PoC yourself. Does it genuinely trigger the claimed effect, or did the
   original agent misread the output?
3. Is something upstream already neutralizing it (framework autoescaping, an ORM
   parameterizing, validation/middleware)?
4. Is the severity/CVSS inflated for the real preconditions?
5. Also apply "Repository instructions and normative documents" (orchestrator conventions.md): check the finding against the repository's instruction files and any normative documents, with their rule-ID scheme and profiles.

## Verdict
- status: CONFIRMED (PoC reproduces, sink reachable) | REFUTED (why it's not exploitable)
  | DOWNGRADED (real but lower severity — give corrected CVSS)
  | ANALYSIS-CONFIRMED (real, PoC impractical, reasoning holds up)
- evidence: [what you ran/observed]
```

- **CONFIRMED / ANALYSIS-CONFIRMED** → proceeds to the fix + verify cycle.
- **REFUTED** → recorded in the register as a false positive (with the reason), not fixed. Don't touch correct code for a phantom vuln.
- **DOWNGRADED** → severity corrected, re-triaged at the new level.

Run validators in parallel across a round's findings (it's a barrier before the fix wave).

## What the lead does with the report

- The documentarian appends each finding to the **findings register** in `.dev-team/SECURITY.md` (id, title, class, cwe, severity/cvss, status=`open`, location, source).
- The lead triages: dedup, set provisional severity/disposition (fix-now / propose / accept-document), and **notifies the user immediately of any Critical**.
- Every fix-now finding goes through the **validation gate** above; `strong-suspicion-needs-confirmation` findings get a focused second red pass to reach confirmed-with-PoC first.
- Validated (CONFIRMED/ANALYSIS-CONFIRMED) findings flow into the blue-team fix + verify cycle (`remediation-and-verify-protocol.md`).

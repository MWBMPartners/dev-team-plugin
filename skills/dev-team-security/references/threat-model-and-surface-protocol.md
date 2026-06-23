# Threat Model & Attack-Surface Protocol (Phase 0)

The front end of `dev-team-security`: before attacking anything, understand what you're protecting, where the trust boundaries are, and **every class of vulnerability that could apply**. Steps: security scout → **tooling sweep** → **multi-role fixtures** → threat model → attack-surface map + **coverage ledger**. The documentarian records all of it in `SECURITY.md`.

Reasoning is not enough on its own. This phase combines **deterministic tooling** (scanners that find what code-reading misses) with the **threat model** that tells the red team where to aim.

All work here is read-only and against a **local/sandboxed instance** the user owns. Carry the authorization & safety rules from `SKILL.md` into every brief.

## Step 1 — Security scout (read-only)

Spawn scout agent(s) (Opus 4.8, modify nothing) to answer:

**Architecture & trust boundaries**
- Stack, frameworks, runtime; how it's built, run, and deployed; how to stand up a **local sandbox instance** for safe testing.
- Entry points: HTTP routes/APIs, CLIs, message consumers, webhooks, file uploads, scheduled jobs, anything that ingests external input.
- Trust boundaries: where untrusted input crosses into trusted code; client↔server, service↔service, app↔database, app↔third-party.
- Data flows for the sensitive paths (auth, payments, PII, file handling): input → processing → storage → output.

**Security-relevant specifics**
- AuthN model (sessions, JWT, OAuth, API keys) and authZ model (roles, ownership checks, where they're enforced).
- Secrets management: where credentials/keys live, how config/`.env` is handled, what's in version control.
- Data classification: what PII/financial/credential/regulated data exists and where it flows and is logged.
- External integrations and their trust assumptions; the dependency manifest(s) and lockfiles.
- Existing security controls: input validation, output encoding, headers, CSP, rate limiting, CSRF protection, encryption.
- Test framework + run command (the verifier and security regression tests will need it).

Use multiple scouts for a large repo (split by area), one for a small one.

## Step 1b — Tooling sweep (deterministic scanners)

Unless `tools=off`, have the scouts run whatever the stack supports and capture the output as **starting leads** for the red team (each becomes a candidate finding to confirm, not an auto-truth — scanners have false positives too). Match tools to the stack:

- **SCA / dependencies & CVEs:** `npm audit` / `yarn npm audit`, `pip-audit`, `osv-scanner`, `govulncheck`, `bundler-audit`, `cargo audit`.
- **SAST / static analysis:** `semgrep --config auto`, `bandit` (Python), `gosec` (Go), `brakeman` (Rails), language linters with security rules.
- **Secrets — including git history:** `gitleaks detect` (scans history), `trufflehog`. History matters: a secret deleted from current code still lives in old commits and must be rotated.
- **Containers / IaC:** `trivy fs` / `trivy image`, `checkov`, `tfsec` for Dockerfiles, k8s manifests, Terraform.

If a tool isn't installed, note it as a coverage gap (and optionally suggest the user install it) — don't silently skip. Record which tools ran, their versions, and a summary of hits in the coverage ledger.

## Step 1c — Multi-role test fixtures (so access control is testable)

Broken access control (IDOR/BOLA/BFLA, privilege escalation) is usually the highest-value class — but you can't test it without **multiple identities in the sandbox**. Before red-teaming, establish:

- Test accounts at distinct privilege levels: **anonymous**, **normal user A**, **normal user B** (a peer, for cross-user IDOR), **admin/elevated**, and a **second tenant/org** if the app is multi-tenant.
- How to authenticate as each in the sandbox (tokens/sessions/fixtures) so a red agent can attempt "user A reaches user B's object" or "user escalates to admin function."

If the app has no auth, note that and skip; if fixtures can't be created, that's a coverage gap for the access-control classes — record it, don't pretend it was tested.

## Step 2 — Threat model (lightweight)

From the scout reports, write a concise threat model:

- **Assets** — what's worth protecting (user data, credentials, funds, integrity of records, availability).
- **Entry points & trust boundaries** — enumerated from the scout.
- **Adversaries / abuse cases** — unauthenticated attacker, authenticated-but-malicious user (privilege escalation, IDOR), malicious input, compromised dependency, insider/misconfig.
- **Crown jewels** — the few paths whose compromise is worst; red-team these hardest.

This frames severity (impact on assets) and prioritization (crown jewels first).

## Step 3 — Attack-surface map against the checklist

Walk the **full checklist** below. For each class, record: *applies / not applicable (why) / needs investigation*, and which files/surfaces it touches. The goal is **complete coverage**, not a sampling — "not applicable" must have a reason.

### Vulnerability-class checklist

**Input & injection**
- SQL / NoSQL injection
- OS command / argument injection
- Server-side template injection (SSTI), expression-language injection
- LDAP / XPath / header / log injection
- Path traversal / directory traversal; zip-slip on archive extraction

**AuthN / AuthZ / session**
- Broken access control: IDOR / BOLA (object-level), BFLA (function-level), missing ownership checks
- Privilege escalation (horizontal & vertical), forced browsing
- Authentication weaknesses: credential handling, password storage, brute-force/rate-limit gaps, account enumeration
- Session management: fixation, weak/long-lived tokens, missing rotation, insecure cookie flags
- JWT issues: `alg=none`, weak secret, missing signature/expiry validation, claim confusion
- OAuth/SSO flow flaws, redirect-URI validation

**Web / client-side**
- XSS — stored, reflected, DOM-based
- CSRF (state-changing requests without anti-CSRF protection)
- Clickjacking (framing), missing security headers, weak/absent CSP
- CORS misconfiguration (wildcard with credentials, reflected origin)
- Prototype pollution, insecure `postMessage`, open redirect

**Server-side & data**
- SSRF (server-side request forgery), including cloud-metadata access
- Insecure deserialization / unsafe object instantiation
- Mass assignment / over-posting; parameter pollution
- XXE (XML external entity) processing
- Business-logic flaws: workflow bypass, negative/overflow quantities, replay, TOCTOU race conditions
- Sensitive data exposure: PII in logs/errors, verbose error/stack traces, debug endpoints, data in URLs

**Crypto & secrets**
- Weak/broken algorithms (MD5/SHA1 for passwords, ECB, DES), bad key sizes
- Insecure randomness for security tokens (non-CSPRNG)
- Hardcoded secrets/keys/tokens in code or history; secrets in client bundles
- Missing/weak encryption at rest/in transit; improper TLS/cert validation

**Config, dependencies & infra**
- Dependency & supply chain: known CVEs in deps, unpinned/typosquattable packages, lockfile integrity, postinstall-script risk
- Security misconfiguration: debug mode in prod, default credentials, exposed admin/management endpoints, permissive file permissions
- Container/IaC misconfig (Dockerfiles, k8s, Terraform): running as root, exposed ports, secrets in images, over-broad IAM
- Missing rate limiting / resource limits; ReDoS and other unbounded-resource (algorithmic-complexity) DoS surfaces in **own** code

**API-specific**
- Excessive data exposure in responses; lack of pagination/limits
- Improper inventory (undocumented/legacy endpoints), version-skew endpoints
- Improper authZ at the API object/function level (the API view of BOLA/BFLA above)

> Treat this as the floor, not the ceiling. If the stack has framework-specific footguns not listed (e.g. an ORM's raw-query escape hatch, a template engine's autoescape-off mode), add them to the map.

## Output of Phase 0

The documentarian writes into `SECURITY.md`:

- **Threat model** — assets, entry points, trust boundaries, adversaries, crown jewels.
- **Attack-surface map** — the checklist with applies / N/A (reason) / investigate, and the files per class.
- **Coverage ledger** — one row per checklist class: `tested? | how (which tool + manual red lens) | result | gaps`. This is the artifact the completeness critic checks against at the end and the proof behind any "every surface" claim. Tooling-sweep hits and the multi-role fixture status are recorded here too.
- **Findings register** (starts empty; filled by red-team) — see `red-team-protocol.md` for the row schema (incl. CWE + CVSS vector).
- **Sandbox & test setup** — how to run the app locally, how tests run, and the multi-role fixtures available.

### Coverage ledger row

```markdown
| class | tested? | how | result | gaps |
|-------|---------|-----|--------|------|
| SQL/NoSQL injection | yes | semgrep + taint red lens | 1 finding (F-001) | — |
| broken access control | partial | manual red, user A/B fixtures | F-004 | admin role fixture not seeded |
| secrets | yes | gitleaks (history) + scan | F-002 (rotate) | — |
| container/IaC | no | trivy not installed | — | install trivy to cover |
```

Map each class to its **CWE** where applicable (e.g. SQLi → CWE-89, IDOR → CWE-639, XSS → CWE-79) so findings inherit a standard identifier.

Then report the plan + surface map + coverage ledger to the user, and **surface any already-confirmed Critical immediately**. Then begin the purple-team cycle, crown jewels and highest-severity classes first.

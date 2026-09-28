---
name: dev-team-stripe
description: Build or review Stripe integration pathways with a team of `opus-builder` subagents (Opus tier), with Stripe-specific correctness and security expertise. In BUILD mode it implements payment flows (Checkout, Payment Element, PaymentIntents, subscriptions/billing, Connect, webhooks) via the orchestrator workflow; in REVIEW mode it audits existing Stripe code for correctness and security (idempotency, webhook signature verification, API-key handling, PCI scope, authz/IDOR on Stripe objects, amount tampering, SCA/3DS) and fixes what it finds. Leverages the official Stripe Claude plugin (stripe@claude-plugins-official), the stripe-best-practices skill, and the Stripe MCP — all in TEST MODE by default. Use when the user wants to build, integrate, audit, harden, or verify anything involving Stripe / payments / subscriptions / Connect / webhooks. Sibling of dev-team-orchestrator. Takes precedence over dev-team-security / dev-team-review / dev-team-iterate when the work involves Stripe / payments. Do NOT use for non-Stripe work or one-off questions; a generic post-run QA pass over a prior dev-team run's recorded .dev-team/PROJECT.md/.dev-team/SECURITY.md claims (even one touching Stripe as one workstream) is dev-team-review's job.
---

# Dev Team Stripe

You are the **payments lead** for Stripe work. You either **build** a Stripe pathway or **review** an existing one for correctness and security — delegating to a team of `opus-builder` subagents (Opus tier; model routing: `skills/dev-team-orchestrator/references/model-routing.md`), never coding it yourself. Payments is unforgiving: a missing idempotency key double-charges, an unverified webhook forges fulfillment, a leaked secret key drains an account. This skill bakes that expertise into every brief.

This is the **Stripe-specialized variant** of `dev-team-orchestrator`. It **reuses that skill's machinery** — team, briefs, checker, documentarian, debate, evidence-not-claims, rollback commits. It adds two things: a **mode switch** (build vs. review), and deep **Stripe domain rules** that every builder/reviewer and the checker must apply.

> **Read `dev-team-orchestrator/SKILL.md` first** — locate it via your `available_skills` registry (it lives under `~/.claude/skills/` for a user install or `.claude/skills/` for a project install). For REVIEW mode, also borrow the discipline of `dev-team-security` (red-team + severity) and `dev-team-review` (independent verification). This file documents the Stripe-specific deltas.

## Safety — TEST MODE by default (non-negotiable)

Stripe operations can move real money. Every agent brief carries these rules and you enforce them:

- **Test mode only by default.** Use **test API keys** (`sk_test_…`/`pk_test_…`), test cards, the Stripe CLI for webhook forwarding, and **test clocks** for subscription/billing time travel. Never run code paths against **live** keys without the user's explicit, specific go-ahead.
- **Never touch live secrets.** Don't read, print, log, commit, or move live API keys. If you find a live key in the repo or client bundle, treat it as compromised → flag for **rotation** (report location/type, never the value).
- **No real charges/refunds/account mutations** during build or review. PoCs and tests run against test mode only.
- **No raw card data.** Never build or condone code that touches a raw PAN/CVC — only Stripe Elements/tokens/PaymentMethods (keeps PCI scope at SAQ-A).
- **Stop and ask** before anything that would run in live mode or affect real customers/funds.

## Assurance & limitations (state this honestly — never overclaim)

This skill is the strongest *automated* assurance available for Stripe work — full checklist coverage, adversarial red-team + skeptic validation, independent re-verification, deterministic scanners, defense-in-depth fixes, and test-mode evidence. It **materially reduces** vulnerability risk and **enforces Stripe's prescribed patterns**. It does **NOT guarantee zero vulnerabilities** — nothing automated can, and claiming so in a payments context is itself dangerous:

- LLM verification has false negatives; novel **business-logic** flaws and subtle race/timing conditions can survive.
- Code review can't fully cover **runtime/infra/config**, your hosting, secret storage, or transitive dependencies beyond what scanners catch.
- The audit is **test-mode simulated**; live behavior, Stripe **account settings**, and **Radar/fraud** rules live outside the code.

So treat it as the first and most thorough layer, **not the last**. For real money, pair it with **human review**, Stripe's **native controls** (restricted keys, webhook signing secrets, Radar, automatic SCA), and — for high-stakes or live flows — a **professional pentest / Stripe's own integration review**. The skill must surface these limitations in its report rather than imply completeness.

## Tooling — use the Stripe plugin & skills (route them to agents)

This skill is built to ride on Stripe's own tooling. Survey what's available and route it into briefs:

- **Stripe Claude plugin** — `stripe@claude-plugins-official`. If not installed, tell the user to run `/plugin install stripe@claude-plugins-official` (a built-in Claude Code command you cannot run for them). Once installed, route its skills/commands to the relevant agents.
- **`stripe-best-practices` skill** — available in most environments — confirm it resolves in `available_skills` before naming its path in a brief; if it does not, fall back to `references/stripe-checklist.md` + WebFetch/WebSearch against current Stripe docs (docs.stripe.com), and note in the report that canonical grounding was reduced. It's the canonical source for API selection (Checkout vs PaymentIntents), Connect (Accounts v2, controller properties), billing/subscriptions, migrating off deprecated APIs, and key/security best practices. **Name its path in every Stripe builder/reviewer brief** and require they follow it.
- **Native mobile — split by platform.** Both share the same server backend (intents / CustomerSession / webhooks); the client half differs:
  - **iOS** (`stripe-ios`, Swift/ObjC) → route the **`stripe-ios-payments` skill** + the **Native iOS** section of `references/stripe-checklist.md` (PaymentSheet/FlowController/CustomerSheet/Apple Pay, publishable-key-only, `returnURL`, 3DS via `STPPaymentHandler`).
  - **Android** (`stripe-android`, Kotlin/Java) → route the **`stripe-android-payments` skill** + the **Native Android** section of `references/stripe-checklist.md`. Covers PaymentSheet (Views & Compose)/FlowController/CustomerSheet/Google Pay, publishable-key-only (no `sk_`/`rk_` in the APK — R8 won't protect it), 3DS via `PaymentLauncher` (Custom Tabs — no manual deep-link wiring), and surviving process death.
- **Stripe MCP** — agents can reach Stripe MCP tools via ToolSearch (docs search, API helpers). Use for grounding against current API behavior; do not let it perform live mutations.

Record which tooling is in play in `.dev-team/PROJECT.md` (the documentarian) so it sticks across the team.

## Picking the mode

**At the start of the run, before any agent is spawned:** take the instruction snapshot
(`dev-team-orchestrator/references/conventions.md`, "Repository instructions and normative
documents", step 1) and settle `handoff-file` once ("Auto-handoff", same file); pass the snapshot in
every brief and the `handoff-file` value in every documentarian brief. Under the autopilot
conductor, use the conductor's snapshot and value instead of taking your own.

- **BUILD** — "add Stripe checkout", "implement subscriptions", "set up Connect onboarding", "handle webhooks". Run the orchestrator loop with Stripe rules baked in.
- **REVIEW** — "audit our Stripe integration", "is our billing correct/secure", "check our webhook handling". Run a Stripe-scoped correctness + security audit, then fix.
- Set `mode=build|review`, or infer from the request. If genuinely ambiguous, ask. A build job naturally ends with a review pass (see below).

## BUILD mode

Follow `references/build-and-review-protocol.md` (build half). It's the orchestrator loop — understand → stage → delegate → check → checkpoint — with these Stripe specializations:

- **Decide the integration surface first** (a real architecture decision; use the debate protocol if contested): hosted **Checkout Session** vs **Payment Element** vs raw **PaymentIntents**; **Checkout/Billing** vs custom subscriptions; Connect account type. Bias to **Stripe-hosted surfaces** (less PCI scope, SCA handled). Record the decision + reason.
- **Define the money/contract details up front** (the lead's job, like any interface contract): amounts in the smallest currency unit (integer cents; mind zero-decimal currencies), the price/product source of truth (**server-side, never client-sent amounts**), the pinned **API version**, and the webhook event set you'll handle.
- **Every builder brief carries `references/stripe-checklist.md`** (correctness + security) and the `stripe-best-practices` skill path.
- **Fulfillment is driven by verified webhooks**, not client redirects. Build the webhook handler with **signature verification + idempotent event processing** as first-class acceptance criteria.
- **Verification is in TEST MODE**: builders paste real evidence from test keys — a test-card PaymentIntent succeeding, a `stripe listen`/`trigger` webhook delivered and handled, a test-clock advancing a subscription. "It should work" is not done.
- A BUILD job's definition of done **includes a REVIEW pass** over what was built before you call it shipped.

## REVIEW mode

Follow `references/build-and-review-protocol.md` (review half). It's a Stripe-scoped blend of `dev-team-security` and `dev-team-review`:

1. **Map the Stripe pathways** (scouts, read-only): every place the code creates/confirms PaymentIntents, Checkout Sessions, customers, subscriptions, refunds, Connect transfers; every webhook endpoint; where keys live; client vs server boundaries. **Run deterministic scanners as starting leads** (don't rely on reasoning alone): secret scanning **including git history** (`gitleaks`/`trufflehog`) for leaked `sk_live`/`sk_test`/`whsec` keys, **SCA** (`npm audit`/`pip-audit`/`osv-scanner`) on the Stripe SDK and deps, and grep/SAST for Stripe anti-patterns — string-built amounts, create/confirm calls missing an `Idempotency-Key`, `webhooks.constructEvent` without the signing secret, secret keys referenced client-side.
2. **Audit each pathway** against both checklists in `references/stripe-checklist.md` — **correctness** (idempotency, amounts, lifecycle, SCA, webhook reliability, reconciliation) and **security** (key handling, signature verification, authz/IDOR on Stripe objects, amount tampering, PCI scope, test/live separation). Red-team the security items with **test-mode PoCs** and rate findings by severity (CVSS-style).
3. **Fix** confirmed issues via builders (root-cause + defense-in-depth + a regression test), then **re-verify in test mode** that the issue is closed and nothing regressed — same purple-team discipline as `dev-team-security`.
4. **Report**: findings register (severity, status, evidence), what was fixed vs proposed, residual risk, and any **live key flagged for rotation**.

## Arguments

- `mode=build|review` — pick the mode [infer from the request; ask if ambiguous].
- `dry-run=on|off` — produce the full plan and stop, spawning no builders/red-team agents and making no file or git changes (BUILD: the stage/workstream plan + builder briefs; REVIEW: the pathway map + audit/red-team briefs); report the plan for approval. Precedence: this argument > `features.dry-run` in `.dev-team/config.yml` > built-in default [off]. Plain language ("just show me the plan", "dry run first") also sets it. See `dev-team-orchestrator/references/conventions.md` ("Dry-run / plan-preview").
- `surface=checkout|payment-element|payment-intents|billing|connect|webhooks|ios-native|android-native|auto` — the Stripe surface in scope [auto-detect the platform from the repo].
- `severity-floor=critical|high|medium|low` — (review) lowest severity to fix this run [high].
- `live=confirm` — explicit, one-time acknowledgement required before ANY live-mode action [absent → test mode only].
- `branch=<name>` — work branch [`stripe/<date>`].

## What carries over from the dev-team family (unchanged)

- Orchestrator: team sizing, parallelism, interface/contract-up-front, **you own dependency & API-version decisions**, brief discipline, checker triage (runs on `opus-builder` — verification stays on the Opus/frontier tier, never routed cheaper; model-routing.md invariant 1), debate for big surface decisions, the `sonnet-scribe` documentarian on `.dev-team/PROJECT.md`.
- Security (review mode): red-team + severity + adversarial validation + re-attack-to-confirm (`dev-team-security` references).
- Review (review mode): independent verification, evidence-not-claims, re-verify after fix (`dev-team-review` references).
- **Composing other skills** — route `stripe-best-practices` and any user UI/testing skill to the relevant agents and have the checker verify conformance.

## References

- `references/stripe-checklist.md` — the Stripe **correctness** and **security** checklists (the domain knowledge). Paste the relevant slice into every builder/reviewer brief and the checker brief.
- `references/build-and-review-protocol.md` — the BUILD loop and the REVIEW loop, how to use the Stripe plugin/skills, and TEST-MODE verification (Stripe CLI, test cards, test clocks). Read before your first wave.

Reused: `dev-team-orchestrator/references/*`; for review mode, `dev-team-security/references/*` and `dev-team-review/references/*`.

The suite's **shared contracts** — artifact ownership & schemas, ID prefixes, the branch model, the flattening rule, gates, and safety — live in `dev-team-orchestrator/references/conventions.md`; read it once.

## Anti-patterns (in addition to the family's)

- **Running against live mode.** Test keys, test cards, test clocks by default; live needs explicit `live=confirm`.
- **Trusting client-sent amounts/prices.** Amounts and prices come from the server / your Stripe Prices, never the client — else it's a tampering bug.
- **Missing idempotency keys.** Every create/confirm POST carries an idempotency key, or it can double-charge on retry.
- **Unverified webhooks.** Verify the signature with the signing secret and process events idempotently; never fulfill on a client redirect alone.
- **Leaking secret keys.** Secret keys are server-side only, never in client bundles, logs, or the repo; prefer **restricted keys**; a found key is compromised → rotate.
- **Raw card data.** Never handle a PAN/CVC directly; use Elements/tokens (SAQ-A).
- **IDOR on Stripe objects.** Confirm the authenticated user owns the customer/subscription/PaymentIntent before acting on it.
- **Shipping build without a review pass.** A BUILD job isn't done until REVIEW mode has checked it.
- **Ignoring the Stripe plugin/skill.** Route `stripe-best-practices` and the official plugin to agents; don't let them invent patterns Stripe already prescribes.

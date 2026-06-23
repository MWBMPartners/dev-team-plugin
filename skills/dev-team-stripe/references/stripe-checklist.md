# Stripe Checklist — Correctness & Security

The domain knowledge that makes `dev-team-stripe` worth more than a generic team. Paste the relevant slice into every builder, reviewer, and checker brief. In BUILD mode these are acceptance criteria; in REVIEW mode they are the audit dimensions. Pair this with the `stripe-best-practices` skill (canonical guidance) and ground specifics against the Stripe MCP/docs — Stripe's API evolves.

Throughout: **test mode only** unless the user explicitly authorized live (`live=confirm`).

## Correctness

**Idempotency & retries**
- Every create/confirm POST (PaymentIntents, Checkout Sessions, Refunds, Transfers, Subscriptions) sends an **`Idempotency-Key`** so a retry/network blip can't double-charge.
- Retries use the *same* idempotency key; new logical operations use a new one.
- Idempotency keys are **short-lived** (~24h) and scoped per account/mode — they stop short-window retries, not long-term duplicates. The key must be **derived from / tied to the logical operation** (e.g. order/cart id) and **persisted** so every retry reuses it; a fresh UUID per attempt defeats it. Idempotency is **not** a substitute for **server-side duplicate-order detection on your own business key**.
- Handle network timeouts as *unknown*, not failure — re-query or retry idempotently before assuming.

**Amounts & currency**
- Amounts are integers in the **smallest currency unit** (cents). Handle **zero-decimal currencies** (e.g. JPY) correctly.
- The **price/amount is server-authoritative** — derived from your Stripe Prices/Products or server logic, never trusted from the client.
- Currency is consistent across the PaymentIntent/Customer/Subscription; no float math on money.

**Object lifecycle & API choice**
- Right object for the job: **Checkout Session** (hosted) vs **Payment Element** (embedded) vs **PaymentIntent** (custom) vs **SetupIntent** (save-for-later, no charge); **Subscriptions/Invoices** for recurring.
- Pin `apiVersion` explicitly in the SDK client; understand it before upgrading; test on upgrade. Separately, **webhook event payloads are serialized at the account-default API version** (Dashboard) unless a per-endpoint override is set — verify the version the webhook handler parses against matches what Stripe actually sends, and flag a **code-vs-webhook version mismatch** as a correctness finding (re-fetch the object via the SDK to normalize if in doubt).
- Handle the full state machine: `requires_action`/`requires_confirmation`/`processing`/`succeeded`/`canceled`; subscription `incomplete`/`past_due`/`active`/`canceled`; invoice/payment retries (dunning).

**SCA / 3D Secure**
- Use PaymentIntents/Checkout that handle SCA automatically; handle `requires_action` (return the client secret, let the client complete 3DS) — don't assume one-step success.

**Webhooks = source of truth for fulfillment**
- Fulfill orders / grant access on the **verified webhook event** (`checkout.session.completed`, `payment_intent.succeeded`, `invoice.paid`, etc.), **not** on the client success redirect (the user can close the tab / forge the redirect).
- **Idempotent event processing** (dedupe by event id) — Stripe delivers at-least-once and can re-send.
- Tolerate **out-of-order** and duplicate events; respond **2xx fast**, do heavy work async.
- Handle the events you actually depend on; ignore the rest cleanly. Reconcile missed events (Stripe retries; also support backfill).

**Connect (if applicable)**
- Correct account type / **controller properties (Accounts v2)**; complete onboarding/capabilities before charging.
- Correct money flow: destination charges / separate charges & transfers / application fees — and who bears Stripe fees and refunds/disputes.

**Reconciliation & data**
- **Stripe is the source of truth**; store Stripe object **IDs** and reconcile, don't duplicate state that can drift.
- Refunds, disputes/chargebacks, and partial refunds are handled (and reflected in your system via webhooks).

## Security

**API key management**
- **Secret keys server-side only** — never in client bundles, mobile apps, logs, error messages, or the repo/git history.
- Prefer **restricted keys** scoped to least privilege; separate keys per environment; rotate on exposure.
- Keys come from a secret manager / env vars, not source. Publishable keys (`pk_…`) are the only ones client-side.

**PCI scope**
- **Never handle raw card data** (PAN/CVC). Use Stripe Elements / Checkout / tokens / PaymentMethods so card data never touches your server (SAQ-A).
- No card numbers in logs, metadata, or your database.

**Webhook security**
- **Verify the webhook signature** with the endpoint **signing secret** (`whsec_…`) on every event; reject unverified payloads. Use the SDK's `constructEvent` on the **RAW** request body (don't pre-parse — a consumed/re-encoded body fails verification), and **don't disable or inflate its default timestamp tolerance**, which would re-open replay of captured old events.
- Don't trust event *contents* blindly for authorization-sensitive actions — re-fetch the object from Stripe if needed.

**Authorization / IDOR on Stripe objects**
- Before acting on a `customer`/`subscription`/`paymentIntent`/`invoice`, confirm the **authenticated user owns it**. A Stripe object id in a request is attacker-controllable — never operate on it just because it was passed in.
- Map your users ↔ Stripe customers server-side; don't let a user supply an arbitrary customer/payment-method id.

**Tampering & abuse**
- Server sets amount, currency, price, quantity limits — reject or ignore client-supplied money fields.
- Validate `success_url`/`return_url` and any redirect; guard against open redirect.
- **Rate-limit** payment/customer-creation endpoints (card testing / enumeration abuse).
- Metadata is **not** for secrets or PII.

**Test / live separation**
- Test and live keys/objects never mix; never run destructive or charge operations against live during build/review.
- Guard config so a deploy can't accidentally point test code at live keys.

## Native iOS (Stripe iOS SDK — Swift / Objective-C)

For apps using `stripe-ios`. **Route the `stripe-ios-payments` skill into the brief** (the canonical guide) and apply these on top of every general rule above.

**Integration surface — pick the highest-level that fits**
- **PaymentSheet** (recommended) — prebuilt sheet; least code, SCA + saved-method management handled. Prefer it.
- **PaymentSheet.FlowController** — your own button/UI, Stripe handles confirmation.
- **Embedded Payment Element** · **CustomerSheet** (manage saved methods) · **Apple Pay** button · **Card Element** (legacy — avoid for new work).
- SDK via **SPM** (or CocoaPods), **pinned version**; import only the modules used (`StripePaymentSheet`, `StripeApplePay`, `StripePayments`, `StripePaymentsUI`).

**Backend contract the SDK requires (server-side)**
- Create the **PaymentIntent** (or **SetupIntent** to save a card with no charge) on the server; return the **client secret** to the app.
- For saved payment methods, create a **CustomerSession** (or legacy **ephemeral key**) server-side and pass it to PaymentSheet/CustomerSheet.
- **Amount/currency are set server-side on the intent** — the app never sends the price.

**iOS security specifics**
- The app ships the **publishable key only**. Audit `Info.plist`, the bundle, and source for any **secret/restricted key** (`sk_…`/`rk_…`) — a secret key in an app binary is extractable → **critical**, rotate immediately.
- **Apple Pay**: a registered **merchant ID** + the Apple Pay **entitlement/capability**; the SDK handles merchant validation; no card data touches your code.
- **`returnURL`** (universal link or custom URL scheme) configured so redirect-based methods (3DS, some APMs) return to the app; handle the callback.
- No card data, tokens, or client secrets in logs / analytics / crash reports.

**iOS correctness**
- **SCA/3DS** is handled by PaymentSheet / `STPPaymentHandler`; handle `requires_action` / canceled / failed, not just success.
- **Fulfillment is webhook-driven on the server**, never the app's completion handler — the app can be backgrounded or killed before the callback fires.
- Handle all `PaymentSheetResult` cases (`.completed` / `.canceled` / `.failed`) and surface errors; idempotency lives on the server-side intent creation.

## Native Android (Stripe Android SDK — Kotlin / Java)

For apps using `stripe-android`. There's no dedicated Android skill, so this section + the `stripe-best-practices` skill + the Stripe plugin/MCP docs are the source of truth. Apply these on top of every general rule above. (Same server backend as iOS — the split is server + app.)

**Integration surface — pick the highest-level that fits**
- **PaymentSheet** (recommended) — prebuilt sheet (Views *and* Jetpack Compose); least code, SCA + saved-method management handled. Prefer it.
- **PaymentSheet.FlowController** — your own button/UI, Stripe handles confirmation.
- **Embedded Payment Element** · **CustomerSheet** (manage saved methods) · **Google Pay** button · **Card Element / `CardInputWidget`** (legacy — avoid for new work).
- SDK via **Gradle** (`com.stripe:stripe-android`), **pinned version**; pull only the artifacts used (`payments-ui`, `paymentsheet`, etc.).

**Backend contract the SDK requires (server-side)**
- Create the **PaymentIntent** (or **SetupIntent** to save a card with no charge) on the server; return the **client secret** to the app.
- For saved payment methods, create a **CustomerSession** (or legacy **ephemeral key**) server-side and pass it to PaymentSheet/CustomerSheet.
- **Amount/currency are set server-side on the intent** — the app never sends the price.

**Android security specifics**
- The app ships the **publishable key only**. Audit `BuildConfig`, `gradle.properties`, `res/`, `AndroidManifest.xml`, and source for any **secret/restricted key** (`sk_…`/`rk_…`) — a secret key shipped in an APK is trivially extractable, and **ProGuard/R8 does not protect it** → **critical**, rotate immediately.
- **Google Pay**: correct `GooglePayEnvironment` (Test vs Production), merchant config, gateway = `stripe`; the SDK handles tokenization — no card data touches your code.
- **Redirects/3DS are handled by the SDK via Custom Tabs** — for PaymentSheet/FlowController/CustomerSheet/`PaymentLauncher` you do **not** wire a custom URL scheme, intent filter, or App Links (unlike iOS's `returnURL`). Don't add manual deep-link plumbing for these; the SDK returns to the app itself.
- No card data, tokens, or client secrets in Logcat / analytics / crash reports.

**Android correctness**
- Initialize `PaymentConfiguration` with the publishable key (in `Application.onCreate`/Activity `onCreate`); create `PaymentSheet`/`PaymentLauncher` **in `onCreate` via `PaymentSheet.Builder(...)`, or in Compose via `rememberPaymentSheet(...)`** — *not* lazily in a click handler. (PaymentSheet does not use `registerForActivityResult`; building it early registers its result launcher and lets it **survive configuration changes and process death** — a classic Android payment bug.)
- **SCA/3DS** is handled by PaymentSheet / `PaymentLauncher`; handle `requires_action` / canceled / failed, not just success.
- **Fulfillment is webhook-driven on the server**, never the app's result callback — the Activity can be recreated or the process killed before the result arrives.
- Handle all `PaymentSheetResult` cases (`Completed` / `Canceled` / `Failed`) and surface errors; idempotency lives on the server-side intent creation.

## How findings/criteria are evidenced (test mode)

- **PaymentIntent / Checkout**: a test-card flow succeeding (and a 3DS test card hitting `requires_action`) with pasted output.
- **Webhooks**: `stripe listen --forward-to …` + `stripe trigger <event>` showing the event delivered, signature-verified, and handled idempotently (re-trigger to prove dedupe). Also flag **key not tied to a business key / regenerated per attempt; no server-side business-key dedupe** and a **webhook payload version mismatch** (handler parses a different API version than Stripe sends) as correctness review items.
- **Subscriptions/billing**: a **test clock** advanced to show renewal/dunning behavior.
- **Security items**: a test-mode PoC (e.g. replaying a webhook without a valid signature is rejected; a user cannot act on another user's customer id; an unauthenticated secret-key path doesn't exist).
- **Native iOS**: run in the simulator/device in **test mode** — screenshot the PaymentSheet, a **test-card** success (`4242…`), a **3DS** card completing `requires_action`, and a **decline** handled; show the server **webhook** (`payment_intent.succeeded`) driving fulfillment; confirm no `sk_`/`rk_` key is in the app bundle.
- **Native Android**: run in the emulator/device in **test mode** — screenshot the PaymentSheet, a **test-card** success (`4242…`), a **3DS** card completing, a **decline** handled, and (if used) Google Pay in the **Test** environment; show the server **webhook** driving fulfillment; confirm the flow survives a config change / process death; confirm no `sk_`/`rk_` key is in `BuildConfig`/`gradle.properties`/the APK.

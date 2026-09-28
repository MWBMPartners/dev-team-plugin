# Accuracy Verification Protocol

This is `dev-team-docs`'s teeth. Everything else in the skill — scouting, drafting, style —
is in service of this single non-negotiable: **no doc claim ships unless it has been traced
to real source by an agent that did not write it.** A claim with no trace is a guess wearing
the formatting of a fact, and guesses are how documentation becomes the thing users trust and
then get burned by.

The checker runs as the `opus-builder` agent (Opus tier; model routing:
`skills/dev-team-orchestrator/references/model-routing.md`) — verification never drops below
the frontier tier (invariant 1) — and it is **never the same agent thread that drafted the
doc** (conventions.md: "whoever verifies a thing is never whoever built it"). It does not
proofread prose quality; it interrogates every factual assertion.

## What counts as a "claim"

Anything a reader could rely on and be wrong to have relied on:

- A function/method/class **signature** — name, parameters (names, types, order, required vs.
  optional, defaults), return type/shape, exceptions/errors it can raise.
- A **CLI flag or subcommand** — its name, accepted values, default, and effect.
- A **config key** — its name, expected type/shape, default, and what it controls.
- An **endpoint/route** — path, method, request/response shape, status codes, auth
  requirement.
- A stated **behavior** — "X happens when Y", ordering guarantees, idempotency, side effects,
  what's logged, what's retried.
- A **default value** or **limit** (rate limits, size limits, timeouts).
- An **example** — any code block presented as something that runs and does what's claimed.
- A **cross-reference** — a link, anchor, or "see X" pointing at another file/section/symbol.
- A **version/compatibility claim** — supported language/runtime/OS/browser versions,
  minimum dependency versions.

A sentence with none of the above (pure narrative framing, "this section covers...") isn't a
claim to verify — don't manufacture verification work on prose that carries no factual
content.

## The trace: every claim gets a `file:line`

For each claim, find the real source that makes it true or false, and record the result:

| Claim | Source (`file:line`) | Verified? | Notes |
|---|---|---|---|
| `parseConfig(path, opts?)` returns `Config \| null` | `src/config.ts:41` | yes | matches exactly |
| `--dry-run` flag defaults to `off` | `cli/flags.go:88` | yes | |
| `POST /users` returns `201` with the created user | `routes/users.py:22` | **no** — returns `200` | doc says 201, code returns 200 |
| "Retries failed jobs up to 3 times" | — | **unverifiable** | no retry logic found anywhere in `queue/` |
| Example: `client.fetch({retries: 5})` | `examples run: see below` | yes | ran it, output matched |

This ledger (or an equivalent inline in the checker's report) is the checker's real output —
not a prose summary asserting "looks accurate."

## How to verify each claim type

- **Signatures**: open the actual declaration (`Grep` the symbol, `Read` the definition).
  Compare parameter names, types, order, optionality, and defaults character-for-character
  against what the doc says. A doc that reorders optional params, gets a default wrong, or
  misses a thrown exception is **wrong**, not "close enough."
- **CLI flags / config keys**: find the actual parser/schema (`argparse`/`clap`/`commander`/
  `yargs`/a config-schema file) and confirm the flag/key exists, its default, and its effect —
  don't infer effect from the flag's name.
- **Endpoints**: find the actual route registration/handler. Confirm method, path (including
  path params), request/response shape, and status codes against the doc. Hit it against a
  local/test instance where feasible and compare the real response to the documented one.
- **Behaviors**: find the code path that would implement the claimed behavior. "Unverifiable"
  is a legitimate, common outcome for behavior claims — don't stretch a plausible-sounding
  guess into a false "verified." If you can't find the code that does it, say so.
- **Runnable examples — actually run them, but only safely (non-negotiable).** Execute the exact
  command/snippet (or the closest safe proxy: a local sandbox, a dry-run flag, a unit test invoking
  the same call) and compare real output to what the doc shows. A snippet that was never executed is
  an unconfirmed claim regardless of how plausible it reads. This is gated on HOW: run **only** the
  project's own examples, in the project's normal sandbox/test manner. **Never** auto-run an example
  that performs a destructive or external-side-effecting operation (network writes, deletes, prod/live
  calls), or one sourced from an untrusted/unfamiliar origin, without the user's explicit
  confirmation first. If running it is genuinely unsafe/infeasible (paid external API, destructive
  prod access, no confirmation obtained), say so explicitly rather than silently skipping it — flag
  as "not run: <reason>", never silently pass it. When in doubt, verify the claim by **static trace
  against the source** (read the code path the example exercises) instead of executing it.
- **Cross-references**: resolve every link/anchor/"see X" and confirm the target exists at
  that path/heading. A broken internal reference is a defect, not a style nit.
- **Version/compatibility claims**: check the actual manifest/config that would enforce them
  (`package.json` `engines`, a CI test matrix, a `python_requires`, a lockfile) — don't assume
  a stated range is accurate without a real source for it.

## Catching the specific ways docs go wrong

- **Stale/renamed** — the doc refers to a function/flag/endpoint that was renamed or removed.
  This is not "close enough," it's actively wrong and higher-severity than a simple gap.
- **Signature drift** — a real symbol still exists, but its parameters, types, order, or
  defaults have changed since the doc was written.
- **Aspirational-as-current** — a TODO, roadmap item, feature-flagged/partial path, or
  planned-but-unbuilt capability is described as if it ships today. This must be either
  removed or explicitly re-labeled ("planned", "not yet implemented", "behind `X` flag") —
  never left asserting current behavior.
- **Undocumented-entirely** — a real, user-facing symbol/endpoint/flag has no doc coverage in
  the requested scope at all. In `audit` mode this is a finding; in `generate`/`maintain` it's
  what the drafter should have covered — flag it if it didn't.
- **Both-direction drift** — check not only "is every doc claim true" but "is everything real
  in scope documented." A reference that's internally accurate but silently missing half the
  public API has failed just as much as one with wrong claims in it.

## Triage buckets (same shape as `checker-protocol.md`)

- **CLEAN** — every claim in this doc-area traced and confirmed; nothing to discuss.
- **FLAGGED & FIXED** — small, unambiguous drift the checker corrected itself (a wrong default,
  a stale parameter name, a dead link) — noted briefly, not escalated.
- **NEEDS LEAD REVIEW** — a claim that's genuinely unverifiable (no source found either way),
  a real behavior disagreement between doc and code that needs an intent call (which one is
  actually supposed to be true?), or anything where fixing the doc silently would paper over a
  real bug in the code itself. For each: the claim, `file:line` (or "no source found"), why it
  needs a human call, and your recommendation. If nothing qualifies, say "NEEDS LEAD REVIEW:
  none."

The lead reads only NEEDS LEAD REVIEW, exactly as in the base checker pattern. A checker that
routes an unverifiable claim into FLAGGED & FIXED (by quietly rewriting it to sound plausible
rather than escalating "I couldn't confirm this") has failed at its one job.

## Accuracy checker brief (paste into the checker's Task prompt)

```
## Role
You are the accuracy checker for a documentation pass. You did not write the draft you're
reviewing. Your job is to independently re-derive every factual claim in it from the real
source and report which are confirmed, which you fixed, and which need a human call. You are
not reviewing prose quality — you are auditing truth.

## What to check
- Doc file(s)/section(s) this wave touched: [list]
- The real source they describe: [files/modules/schemas relevant to this doc-area]
- Scope: [readme|api|reference|docstrings|changelog|guides|architecture]
- Repository instructions and normative documents that apply (e.g. a documentation or naming
  standard the repository's own instructions point to): [paths + rule IDs — you read the
  document itself, in full, from the repository; if a named one cannot be found, say so plainly
  rather than treating it as nothing to check; or "none named"]

## Do
1. Extract every claim from the draft (signatures, flags, config keys, endpoints, behaviors,
   defaults, examples, cross-references, version claims — see "What counts as a claim").
2. For each, find the real source and record verified / fixed / unverifiable with file:line
   evidence (or "no source found").
3. Actually RUN every runnable example; compare real output to what's documented.
4. Check both directions: doc claims that are wrong, AND real surface that's undocumented.
5. Fix small, unambiguous drift yourself (wrong default, stale name, dead link). Never
   silently smooth over an unverifiable claim to make it sound plausible — flag it instead.
6. Flag anything described as current that's actually a TODO/roadmap/partial/flagged path.

## Report back in exactly these three buckets
- CLEAN: claims confirmed, nothing to discuss.
- FLAGGED & FIXED: what you found and corrected yourself, briefly.
- NEEDS LEAD REVIEW: claim, file:line (or "no source found"), why it needs a human call, your
  recommendation. "NEEDS LEAD REVIEW: none" if nothing qualifies.
```

## What this protocol does NOT cover

Prose clarity, tone, and formatting are the drafter's job (guided by `doc-standards.md`), not
the accuracy checker's — don't spend the frontier tier on copyediting. The one exception:
if a claim is ambiguously *worded* in a way that could be misread as a different (and false)
claim, that's an accuracy issue (fix the wording so the true claim is unambiguous), not a
style one.

---
name: dev-team-ship
description: Take a repo that WORKS to a repo that SHIPS — stand up or audit CI (tests/lint/build running green on every PR), secret scanning (the gitleaks CLI, never the paid gitleaks-action), branch protection/rulesets with correctly-named required checks, and a release/versioning flow, as a team lead delegating to a team of `opus-builder` subagents (Opus tier). Runs in two modes: `setup` (build the delivery pipeline from scratch) and `audit` (check an existing pipeline for four hard-won CI/CD traps — mismatched required-check context names, the gitleaks-action licence trap, GITHUB_TOKEN anti-recursion breaking merge-to-deploy chains, and secrets handled unsafely — and fix them). Use when the user wants to "set up CI", "add branch protection", "wire up secret scanning", "cut a release", "stop force-pushes to main", or "make this repo ready to ship". Sibling of dev-team-orchestrator. Never sets a GitHub secret itself — it hands the user the exact web-UI steps. Do NOT use to build product features (dev-team-orchestrator/iterate) or to audit the application code's own security (dev-team-security) — this skill is scoped to the delivery pipeline, not the product.
---

# Dev Team Ship

You are the **delivery-pipeline lead**. The product already works; your job is to make it
**shippable** — CI that actually runs and gates merges, secret scanning that actually
scans, branch protection whose required checks actually resolve, and a release flow that
actually cuts a version — delegating to a team of `opus-builder` subagents (Opus tier;
model routing: `skills/dev-team-orchestrator/references/model-routing.md`), never wiring
it yourself.

This is the **delivery-infrastructure variant** of `dev-team-orchestrator`. It **reuses
that skill's machinery wholesale** — the team, brief format, checker, documentarian,
debate protocol, evidence-not-claims, rollback commits. It changes the front end (a
pipeline inventory instead of a feature spec) and bakes in four hard-won CI/CD lessons
that are easy to get subtly, silently wrong.

> **Read `dev-team-orchestrator/SKILL.md` first** — locate it via your `available_skills`
> registry (it lives under `~/.claude/skills/` for a user install or `.claude/skills/` for
> a project install). Delegation, team sizing, parallelism, contracts, the checker, and
> the documentarian all apply unchanged. This file documents only the ship-specific
> deltas.

## Non-negotiable CI/CD rules (read before running)

These four traps are the reason this skill exists — every setup/audit pass enforces them:

1. **Branch protection and rulesets are additive — and their context names differ from
   what the PR UI shows.** A repo can have BOTH classic branch-protection rules AND newer
   rulesets active at once; a required check registered in EITHER blocks the merge. The
   required-check **context name is the job's `name:` field**, not the "Workflow / Job"
   string the PR UI displays. Inspect both `branches/<b>/protection` and `rulesets`,
   verify names byte-for-byte, and recommend an automated cross-check. A mismatch is an
   **orphan** — a silent soft-lock on every future PR. Full protocol:
   `references/branch-protection-protocol.md`.
2. **Secret scanning: the gitleaks CLI, never `gitleaks/gitleaks-action@v2`.** The
   wrapper action requires a paid licence for org-owned repos; unlicensed, it prints a
   warning and **exits 0 without scanning** — the check looks green having scanned
   nothing. The gitleaks **CLI binary is MIT-licensed and free**. Download the release
   binary directly and run `gitleaks detect` yourself. Full pattern:
   `references/ci-setup-protocol.md`.
3. **`GITHUB_TOKEN` doesn't trigger downstream workflows.** A push, merge, or tag made
   with the default `GITHUB_TOKEN` does NOT fire a `push:`/`release:`-triggered workflow
   — "merge → deploy" (or "release → publish") silently breaks with no error anywhere.
   Bridge it: a follow-up `gh workflow run` step, a PAT in place of `GITHUB_TOKEN`, or a
   documented manual first-dispatch. Flag this up front any time a workflow
   auto-commits/auto-merges/auto-tags to a branch with a downstream trigger depending on
   it. Full pattern: `references/ci-setup-protocol.md` and `references/release-protocol.md`.
4. **Secrets are set via the GitHub web UI by default — never by this skill.** Give the
   user the exact path (**Repository → Settings → Secrets and variables → Actions → New
   repository secret**), the secret name, and where the value comes from. Offer the CLI
   (`gh secret set NAME`, no `--body`, so it prompts) only if asked. Never echo, log,
   paste, or handle a secret value; never run a secret-setting command yourself.

## Your team

Same shape as the orchestrator, specialized for delivery infrastructure:

- **Scouts** — the `opus-builder` agent (Opus tier), read-only. Inventory existing
  workflows and their job `name:` fields, existing branch protection AND rulesets, any
  existing secret scanning, the CHANGELOG/version/tag conventions in use, and any
  auto-commit/auto-merge/auto-tag step that could hit the `GITHUB_TOKEN` trap.
- **Builders** — the `opus-builder` agent (Opus tier). Scaffold/patch CI workflows, wire
  the gitleaks CLI, configure branch protection/rulesets, and stand up the release flow,
  via the orchestrator's `task-brief-template.md`.
- **Checker / verifier** — the `opus-builder` agent (Opus tier). Confirms CI is
  **actually** green (a real run, not a YAML lint), required-check context names match
  **byte-for-byte** across BOTH branch protection and rulesets, the gitleaks step is
  genuinely the CLI (not the paid action) and has really scanned, and no
  `GITHUB_TOKEN`-authored push/tag silently breaks a downstream trigger. Verification
  stays on the Opus/frontier tier — never routed cheaper (model-routing.md, invariant 1).
- **Documentarian** — the `sonnet-scribe` agent (Sonnet tier). Records what pipeline now
  exists — the workflows, the required-check names, the scanning setup, the release flow
  — in `.dev-team/PROJECT.md` (Current status + a decision-log entry for any real tradeoff). Ship
  writes CI/config files, not a new ledger.

## Picking the mode

- **`setup`** — the repo has no CI workflow, no branch protection/ruleset, no secret
  scanning, and/or no release flow. Stand it all up from scratch.
- **`audit`** — the repo already has some pipeline. Check it against the four rules above
  and fix what's broken, without silently loosening protection the user configured on
  purpose.
- Set `mode=setup|audit`, or infer: no `.github/workflows/*` and nothing configured →
  `setup`; anything already in place → `audit`. If genuinely mixed (CI exists, nothing
  else does), run `setup` for the missing lanes and `audit` for the existing one.

## SETUP mode

Follow `references/ci-setup-protocol.md` (workflow scaffolding + the gitleaks-CLI and
`GITHUB_TOKEN` patterns), `references/branch-protection-protocol.md` (protection/ruleset
config with byte-for-byte required-check names), and `references/release-protocol.md`
(versioning, CHANGELOG, tagging, the anti-recursion bridge) end to end:

1. **Scout** (read-only): stack + real test/lint/build commands, existing
   `.github/workflows/*`, existing branch protection AND rulesets (both — rule 1),
   existing secret scanning, existing CHANGELOG/version/tag conventions, and any
   auto-commit/auto-merge step that would trip rule 3.
2. **Stand up CI**: a workflow running the project's real test/lint/build commands on
   every PR (and push to the default branch). Give each job a deliberate, stable `name:`
   — that string is what branch protection will require.
3. **Wire secret scanning**: the gitleaks CLI pattern (rule 2), `continue-on-error` while
   establishing a baseline, tightened once triaged. Run it once and paste the actual
   result.
4. **Configure branch protection / rulesets**: required checks whose name is the exact
   job `name:` field from step 2, set in whichever mechanism(s) the repo uses; verify
   byte-for-byte in both.
5. **Stand up the release flow**: `references/release-protocol.md` — either an automated
   tag-on-version-bump workflow (with the `GITHUB_TOKEN` bridge if it auto-tags/releases)
   or a documented manual release runbook, the user's call.
6. **Verify** (checker): a real PR-triggered CI run is green (paste the run URL/log, not a
   YAML lint), required-check names match byte-for-byte in both mechanisms with no
   orphan, the gitleaks CLI genuinely ran (paste output), and any push-based chain was
   bridged and tested.
7. **Document**: the `sonnet-scribe` documentarian records what pipeline now exists in
   `PROJECT.md`.
8. **Hand back secrets**: any secret the pipeline needs (a PAT for the anti-recursion
   bridge, a `GITLEAKS_LICENSE` only if the user explicitly wants the paid action's
   PR-comment feature) is handed to the user as exact web-UI steps (rule 4) — never set
   by this skill.

## AUDIT mode

Follow `references/branch-protection-protocol.md`'s cross-check and
`references/ci-setup-protocol.md`'s trap list against what already exists:

1. **Scout**: every workflow and its job `name:` fields; every required check in BOTH
   branch protection and rulesets; whether `gitleaks/gitleaks-action@v2` is in use and
   whether the repo is org-owned (the licence trap only bites orgs); every workflow that
   auto-commits/auto-merges/auto-tags and whether a downstream `push:`/`release:`
   workflow depends on it; how secrets currently get set (look for evidence of CLI-set
   values in scripts/docs — never their contents).
2. **Check each of the four rules** against reality and record disposition: **fix-now**
   (safe, additive config/CLI changes), **propose** (anything that would remove or
   loosen a required check the user configured deliberately — confirm before touching
   it), or **clean** (already correct).
3. **Fix**: replace `gitleaks/gitleaks-action@v2` with the CLI pattern; add the missing
   required check(s) with byte-for-byte names (never silently *remove* an existing one —
   that's a `propose`); add the bridge step where a push/tag chain is broken; if secrets
   were being set via CLI/pasted, note it and point the user at the web UI going forward.
4. **Verify**: re-run the same checks; a clean audit means no orphaned required check, the
   gitleaks CLI actually scans, no broken merge→deploy (or release→publish) chain, and the
   release flow still works.
5. **Document & report**: the `sonnet-scribe` documentarian records the audit result and
   any fix in `PROJECT.md`; report what was fixed vs proposed vs already clean.

## Definition of done

- [ ] CI runs on every PR and is **actually green** — a real run/log pasted, not a YAML
      lint.
- [ ] Secret scanning is wired via the **gitleaks CLI** (not the paid action) and has been
      run at least once with pasted output.
- [ ] Branch protection and/or rulesets carry required checks whose name matches the job's
      `name:` field **byte-for-byte**, checked in both mechanisms — no orphaned required
      check.
- [ ] A release/versioning flow exists: an automated tag-on-version-bump workflow (with
      the `GITHUB_TOKEN` bridge if it needs one) **or** a documented manual release
      runbook.
- [ ] Every secret the pipeline needs is handed to the user as exact web-UI steps — never
      set by this skill.

## Git & secrets safety

- One run = one branch: `ship/<date>` (suffix `-2` on collision), matching the suite's
  branch model. Config/workflow changes go on this branch and are handed back for review
  — never pushed straight to `main`.
- Never commit a live secret, token, or key. If one turns up while scouting, report its
  **location and type only** (never the value), flag it for rotation, and tell the user
  to remove/rotate it via the web UI.
- Never run `git push --force` to `main`/`master`; never disable branch protection to "get
  past" a failing check — fix the check or take the tradeoff to the user.
- Web-UI-first for every secret (rule 4). CLI (`gh secret set` / `gh variable set`) only
  if the user explicitly asks — and even then, invoke it without `--body` so it prompts
  instead of taking the value as an argument (keeps it out of shell history).

## Arguments

Optional run arguments (defaults in brackets):

- `mode=setup|audit|auto` — pick the mode [auto: infer from whether CI/protection/scanning/release already exist].
- `dry-run=on|off` — produce the full pipeline inventory/plan and the builder briefs you WOULD issue (workflow/config changes, branch-protection/ruleset updates, release-flow wiring), then stop — spawn no builders, make no file, git, GitHub-config, or branch-protection changes; report the plan for approval. Precedence: this argument > `features.dry-run` in `.dev-team/config.yml` > built-in default [off]. Plain language ("just show me the plan", "dry run first") also sets it. See `dev-team-orchestrator/references/conventions.md` ("Dry-run / plan-preview").
- `targets=ci,branch-protection,secret-scanning,release|all` — narrow the run to specific lanes [all].
- `fix=auto|propose-only` — apply safe, additive fixes automatically, or only report and
  propose [auto for additive changes; anything that loosens/removes an existing required
  check is always `propose`, regardless of this flag].
- `branch=<name>` — override the default `ship/<date>` branch name.

## What carries over from dev-team-orchestrator (unchanged)

- Brief discipline (`task-brief-template.md`), evidence-not-claims, the lean/efficiency
  bar.
- Checker triage (`checker-protocol.md`) — runs on `opus-builder`; verification stays on
  the Opus/frontier tier, never routed cheaper (model-routing.md invariant 1).
- Documentarian (`documentarian-protocol.md`) — the `sonnet-scribe` agent records what
  shipped in `PROJECT.md`; ship introduces no new ledger.
- Failed/stuck agents: diagnose, re-brief, two strikes then re-scope.
- Debate mode (`debate-protocol.md`) for a contested infra decision (rulesets vs classic
  protection, automated vs manual release).
- **You own dependency/tooling additions** (a new CI action, the pinned gitleaks binary
  version) — don't let parallel agents race the workflow files.

## References

- `references/ci-setup-protocol.md` — CI workflow scaffolding, the gitleaks-CLI pattern,
  and the `GITHUB_TOKEN` anti-recursion pattern with its bridges. Read before the first
  setup/fix wave.
- `references/branch-protection-protocol.md` — additive branch protection + rulesets, the
  byte-for-byte required-check-name check across both, and a `repo-config-audit`-style
  cross-check workflow. Read before configuring or auditing required checks.
- `references/release-protocol.md` — versioning/CHANGELOG/tagging, the manual-vs-automated
  release choice, and applying the `GITHUB_TOKEN` bridge to a tag/release chain.

Reused from `dev-team-orchestrator/references/`: `task-brief-template.md`,
`checker-protocol.md`, `documentarian-protocol.md` (+ `debate-protocol.md` for contested
infra decisions).

The suite's **shared contracts** — artifact ownership & schemas, ID prefixes, the branch
model, the flattening rule, gates, and safety — live in
`dev-team-orchestrator/references/conventions.md`; read it once.

## Anti-patterns (in addition to the orchestrator's)

- **Trusting `gitleaks/gitleaks-action@v2` on an org repo.** Unlicensed, it exits 0
  without scanning — a green check that scanned nothing. Use the CLI.
- **Reading the PR UI's "Workflow / Job" string as the required-check context.** The real
  context name is the job's `name:` field; verify byte-for-byte, in both branch
  protection and rulesets.
- **Checking only one of branch protection or rulesets.** They're additive — a required
  check on either blocks the PR; audit both or you'll miss orphans.
- **Expecting a `GITHUB_TOKEN`-authored push/merge/tag to trigger a downstream
  `push:`/`release:` workflow.** It won't, silently. Bridge it or document the manual
  dispatch.
- **Setting secrets via CLI/pasting values in chat by default.** Web UI first; CLI only
  if asked, and never with `--body`.
- **Silently loosening protection to unblock a PR.** Removing or downgrading a required
  check the user configured on purpose is a `propose`, never an auto-fix.
- **Calling a YAML lint "CI is green."** Definition of done requires a real run, pasted.
- **Auto-merging pipeline changes to `main`.** Ship's own config changes go on
  `ship/<date>` and are handed back for review like every sibling skill.

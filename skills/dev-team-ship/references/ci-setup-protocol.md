# CI Setup Protocol

How `dev-team-ship` scouts, scaffolds, and hardens a repo's continuous-integration
pipeline — the workflow itself, secret scanning, and the `GITHUB_TOKEN` trap that
silently breaks "merge → deploy" chains. Read this before the first setup/fix wave in
either mode.

## Principles

- **CI that doesn't actually run isn't CI.** A workflow file that parses is not evidence;
  a real, green run against a real PR is. The checker pastes a run URL/log, never a YAML
  lint result.
- **Every job needs a deliberate, stable `name:` field.** It's the string branch
  protection/rulesets will require verbatim later (`references/branch-protection-protocol.md`)
  — decide it once, don't let it drift.
- **Scanners over reasoning for secrets.** Don't rely on an agent eyeballing the diff for
  a leaked key; run gitleaks and trust the tool.
- **A green check can lie.** The single most expensive lesson here: a security action can
  exit 0 having scanned nothing. Verify what a check actually *did*, not just that it
  passed.

## Step 1 — Scout the existing pipeline (read-only)

Before writing anything, inventory what's already there:

- Every file under `.github/workflows/*.yml|*.yaml` — trigger conditions (`on:`), every
  job's `name:` field (not just the workflow's top-level `name:`), and what each step
  actually runs.
- The project's real test/lint/build commands (package.json scripts, Makefile, tox.ini,
  etc.) — CI must run the commands the team actually uses locally, not a guessed
  substitute.
- Any existing secret-scanning step — grep for `gitleaks` (action or CLI), `trufflehog`,
  `detect-secrets`.
- Any workflow that **auto-commits, auto-merges, or auto-tags** using the default token —
  these are the candidates for the `GITHUB_TOKEN` anti-recursion trap (Step 3).
- Whether the repo is **org-owned or personal** — the gitleaks-action licence trap (Step 2)
  only bites org-owned repos.

Report the inventory before scaffolding anything so the user isn't surprised by new
workflow files landing.

## Step 2 — CI workflow scaffolding

A minimal, language-agnostic shape — adapt the install/test/build steps to the project's
actual stack (this is what the scout in Step 1 is for):

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    name: test               # ← this exact string is the required-check context later
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install toolchain
        run: <setup step for the project's language/runtime, pinned version>
      - name: Install dependencies
        run: <the project's real install command>
      - name: Lint
        run: <the project's real lint command>
      - name: Test
        run: <the project's real test command>
      - name: Build
        run: <the project's real build command, if applicable>
```

Keep the job `name:` short, stable, and deliberate — once branch protection points at it,
renaming the job orphans the required check (`references/branch-protection-protocol.md`).
Run the workflow for real (push a throwaway branch / open a draft PR) and paste the actual
run result — a passing YAML schema is not the same as a passing job.

## Step 3 — Secret scanning: the gitleaks CLI, never the paid action

**The trap:** `gitleaks/gitleaks-action@v2` prints `missing gitleaks license. Go grab one
at gitleaks.io and store it as a GitHub Secret named GITLEAKS_LICENSE` when the repo is
owned by an **organization** — and then **exits 0 without scanning**. The check shows
green in the PR UI. Nothing was scanned. This is silent; nobody sees an error.

**The fix:** the **gitleaks CLI binary itself is MIT-licensed and free for any use** —
personal or org. Skip the wrapper action; download the release binary directly and run it
yourself:

```yaml
- name: Install gitleaks CLI
  run: |
    VERSION="8.21.2"  # check gitleaks releases for current
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz" \
      | tar -xz -C /tmp gitleaks
    sudo mv /tmp/gitleaks /usr/local/bin/gitleaks

- name: Scan for committed secrets
  continue-on-error: true
  run: |
    gitleaks detect --source . \
      --log-opts "${{ github.event.pull_request.base.sha }}..${{ github.sha }}" \
      --redact --report-format sarif --report-path /tmp/gitleaks.sarif --exit-code 1
```

Notes:
- `--log-opts base..head` scopes the scan to the PR's new commits — full-history scans
  belong in a separate, less-frequent job (or a one-time baseline pass) so a repo with
  pre-existing findings doesn't fail every PR forever.
- `continue-on-error: true` while establishing a baseline on an existing repo; tighten to
  a hard failure once the backlog of pre-existing findings (if any) is triaged.
- `--redact` keeps matched secret values out of logs — never remove that flag.
- This also sidesteps the Node.js 20 deprecation warning the wrapper action emits (it's
  still on Node 20; the CLI route uses no Node runtime at all).
- Only suggest `gitleaks/gitleaks-action@v2` instead of this pattern if the user
  **explicitly** wants its PR-comment auto-posting feature **and** confirms they have a
  paid licence — and if so, the license key is a secret: hand the user the exact
  **Settings → Secrets and variables → Actions → New repository secret** steps for
  `GITLEAKS_LICENSE` (web-UI-first — see `SKILL.md`'s non-negotiable rule 4). Never ask
  for or handle the licence value yourself.

## Step 4 — `GITHUB_TOKEN` anti-recursion

**The trap:** when a workflow run pushes commits, merges a PR, or creates a tag using the
default `GITHUB_TOKEN`, that push **does not trigger** any other workflow that listens on
`push:` (this is deliberate GitHub anti-recursion behavior). Symptom: a PR merges, `main`
updates, but `deploy.yml` (triggered `on: push: branches: [main]`) never fires — silently,
with no error anywhere to find.

This shows up in `dev-team-ship` setups in two places: an **auto-merge/auto-label**
workflow feeding a `push:`-triggered deploy, and a **release workflow that tags/pushes**
(see `references/release-protocol.md`) feeding a `push:`/`release:`-triggered publish job.

**Bridges** — pick one per broken chain, and always flag the trap to the user up front
whenever a workflow auto-commits/auto-merges/auto-tags to a branch with a downstream
`push:` workflow:

1. **Dispatch the next workflow explicitly**, in a follow-up step of the *same* run (uses
   `GITHUB_TOKEN`'s `actions: write` scope, which IS allowed):
   ```yaml
   - name: Trigger downstream deploy
     run: gh workflow run deploy.yml --ref main
     env:
       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```
2. **Use a PAT instead of `GITHUB_TOKEN`** for the push/merge/tag step — a token pushing
   as a real identity does trigger downstream workflows. This is a credential: hand the
   user the exact **Settings → Secrets and variables → Actions → New repository secret**
   steps for the PAT (name it, tell them where to generate the token and what scopes it
   needs) — never generate or paste the token value yourself.
3. **Document a manual first-dispatch** — if automation is overkill for this repo, say so
   plainly in `PROJECT.md` / the release runbook: "after merging, manually run
   `/deploy.yml` (or the equivalent) once."

## Step 5 — Verifying a setup or an audit fix

The checker (`opus-builder`, per `SKILL.md`'s "Your team") confirms, with real evidence:

- [ ] A genuine CI run (not a lint) against a real PR/push is green — paste the run
      URL/log.
- [ ] The gitleaks step is the **CLI pattern**, not `gitleaks/gitleaks-action@v2` (unless
      the user explicitly confirmed a paid licence) — paste its actual scan output.
- [ ] Every job that a required check will point at has a **stable, deliberate `name:`**
      field, cross-checked against `references/branch-protection-protocol.md`.
- [ ] Any auto-commit/auto-merge/auto-tag step has its `GITHUB_TOKEN` chain either bridged
      (dispatch/PAT) or explicitly documented as manual — never silently assumed to work.

## Setup vs. audit — what each mode does at this layer

| Item | `setup` | `audit` |
|---|---|---|
| CI workflow | Scaffold from Step 2, run for real | Confirm it still runs green; add missing lint/test/build coverage |
| Secret scanning | Wire the CLI pattern (Step 3) | Replace any `gitleaks-action@v2` found; verify the CLI actually scans |
| `GITHUB_TOKEN` chains | Design with a bridge from the start if auto-merge/tag is wanted | Find any existing broken chain (Step 4); bridge or document it |
| Evidence | First real green run pasted | A fresh real green run pasted (not the historical one) |

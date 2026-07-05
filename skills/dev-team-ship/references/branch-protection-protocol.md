# Branch Protection Protocol

How `dev-team-ship` configures and audits required status checks so they never silently
orphan — the single most common "why is my PR stuck" trap in a GitHub repo. Read before
configuring or auditing any required check, in either mode.

## Principles

- **Branch protection rules and rulesets are additive, not either/or.** A repo can have
  BOTH the classic branch-protection API AND the newer rulesets API active on the same
  branch at once. A required check registered in **either** mechanism blocks the merge.
  Checking only one and declaring the branch "protected" is how a mismatch hides.
- **The required-check context name is the job's `name:` field — nothing else.** Not the
  workflow's top-level `name:`, not the "Workflow / Job" string the PR UI displays for a
  passing check. GitHub records the **job `name:`** as the status context. If you type
  the PR-UI label into "required checks," you've registered a context that will never be
  reported — an orphan, and a **silent soft-lock** on every future PR.
- **Verify byte-for-byte.** Whitespace, case, and punctuation all matter. Don't eyeball it
  — diff the two lists.

## Worked example (the trap, concretely)

Given this workflow:

```yaml
# .github/workflows/plugin-audit.yml
name: plugin-audit
on: [pull_request]
jobs:
  audit:
    name: audit          # ← THIS is the required-check context: "audit"
    runs-on: ubuntu-latest
    steps: [...]
```

- The PR UI shows the check as **"plugin-audit / audit"** (workflow name / job id).
- The actual **status context GitHub records** — and the only string that will ever
  satisfy a required check — is **`audit`** (the job's `name:` field).
- Typing `plugin-audit / audit` (or `plugin-audit`, or the job id if `name:` differs from
  it) into the required-checks list creates a context that will **never be reported**.
  The PR shows "Expected — Waiting for status to be reported" **forever**. That's the
  orphan.

## Step 1 — Inspect both mechanisms

Never trust one API. Read both for the target branch:

```bash
gh api repos/OWNER/REPO/branches/<branch>/protection
gh api repos/OWNER/REPO/rulesets
gh api repos/OWNER/REPO/rulesets/<id>          # for each ruleset that targets <branch>
```

Extract every `context` (classic protection, under
`required_status_checks.contexts` / `checks[].context`) and every required-status-check
`context` inside a ruleset's `required_status_checks` rule. Combine into one list — this
is the full set of contexts the branch actually requires.

Running these calls is a repo-configuration read/write, not a credential operation — run
it directly with an authenticated `gh` if you have sufficient scope. If you don't have
admin scope on the repo, hand the exact settings to the user as the equivalent web-UI path
instead (Settings → Branches → branch protection rules, and Settings → Rules → Rulesets).

## Step 2 — Enumerate every real context

For every workflow that can run against the target branch (`on: pull_request` and/or
`on: push: branches: [<branch>]`), list each job's **`name:`** field verbatim (fall back
to the job id only if the job has no `name:` — then the id *is* the context). This is the
complete set of contexts that can ever be reported.

```bash
grep -n '^\s*name:' .github/workflows/*.yml   # top-level AND per-job — read the file to tell them apart
```
(A quick grep is a starting point, not a substitute for actually reading each workflow —
`name:` appears at both the workflow level and the job level, and only the job-level one
is the context.)

## Step 3 — Diff, byte-for-byte

Compare the required-contexts list (Step 1) against the real-contexts list (Step 2):

- **Required but not producible anywhere** → **orphan**. Fix now: either the required
  check has a typo/stale name (correct it in whichever mechanism holds it), or the
  workflow/job that used to produce it was renamed or deleted (either restore the job
  name or update the requirement — confirm with the user which is intended before
  removing a required check; see the `propose` rule in `SKILL.md`).
- **Producible but not required** → not broken, but worth flagging — a check that runs on
  every PR but blocks nothing may be an oversight; ask the user whether it should gate
  merges.
- **Match** → clean.

## Step 4 — Setting/fixing a required check

Once the correct context string is known (the job's `name:` field, confirmed against a
real run of that job — not assumed from the YAML):

- **Classic branch protection**:
  ```bash
  gh api -X PATCH repos/OWNER/REPO/branches/<branch>/protection/required_status_checks \
    -f 'strict=true' -f 'contexts[]=<exact job name>'
  ```
- **Rulesets**: `gh api -X POST repos/OWNER/REPO/rulesets` (or `PATCH` an existing one)
  with a `required_status_checks` rule whose `required_status_checks[].context` matches
  the job `name:` exactly.
- Or the web-UI equivalents (Settings → Branches / Settings → Rules → Rulesets → Add
  required status check) — offer this path any time the agent lacks admin scope, or the
  user simply prefers to click it themselves.

Never **remove** an existing required check as an auto-fix — that's a `propose`, always
confirmed with the user (it may be deliberately strict, e.g. gating on a manual approval
context). Only **adding** a missing check or **correcting** a genuinely misspelled context
that's demonstrably never been reported is a safe auto-fix.

## Step 5 — Recommend an automated cross-check

A byte-for-byte audit done once decays the moment someone renames a job. Recommend (don't
silently add without asking, since it's a new workflow) a small `repo-config-audit`-style
workflow that fails the build when an orphan appears:

```yaml
name: repo-config-audit
on:
  pull_request:
  schedule:
    - cron: "0 6 * * 1"     # weekly — catches drift even without a PR
jobs:
  check-required-contexts:
    name: check-required-contexts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Compare required checks against real job names
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          # 1. Pull required contexts from classic protection + every matching ruleset
          # 2. Pull every job `name:` field from .github/workflows/*.yml
          # 3. Diff; fail (exit 1) and print the mismatch if any required context
          #    has no producing job
          echo "See references/branch-protection-protocol.md for the exact diff logic."
```
Fill in the actual diff logic against the two `gh api` calls in Step 1 and the grep/parse
in Step 2 for the specific repo; the skeleton above is the shape — the point is a
**standing, automated** check, not a one-time manual pass.

## Audit-mode checklist

- [ ] Both `branches/<b>/protection` and `rulesets` inspected — not just one.
- [ ] Every required context matched byte-for-byte to a job `name:` field that a live
      workflow actually produces.
- [ ] No orphaned required check (or, if found, surfaced to the user rather than silently
      dropped).
- [ ] A recommendation (or standing workflow) exists to catch future drift automatically.

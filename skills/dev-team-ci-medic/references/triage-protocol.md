# Triage Protocol

How the triager enumerates a repo's open PRs, pulls each failing check's real logs, and
classifies each one — before anything is fixed. Read this before the first watch pass.

## Principles

- **Classify before you touch anything.** A failure gets one of four classes (below) from the
  actual logs, not from the check's name or a guess. `gh pr checks` tells you *that* something
  failed; `gh run view --log-failed` tells you *why*.
- **The allowlist is an allowlist, not a vibe.** SAFE-AUTO is a short, explicit list of
  mechanical, reversible operations — not "anything that looks minor." If a failure doesn't
  match an allowlisted signal, it isn't SAFE-AUTO, no matter how small the diff looks.
- **Rerun before you diagnose.** A failure that might be flaky gets one rerun before it's
  treated as REAL — diagnosing a network blip as a logic bug wastes a remediation cycle and
  can lead to "fixing" something that was never actually broken.
- **Scope is per-repo, and PR-owned by default.** Enumerate only the current repo's open PRs,
  and only PRs authored by the user (or the account running ci-medic) unless the user has
  explicitly opted in to a specific PR that isn't theirs (safety rule 3).

## Step 1 — Enumerate open PRs and their failing checks

```bash
# Every open PR in the current repo (scope is per-repo, never cross-repo)
gh pr list --state open --json number,title,headRefName,author

# Per PR: the status of every check
gh pr checks <pr>

# Narrow to just the failing ones (adapt the filter to the `gh` version's output shape)
gh pr checks <pr> --json name,state,link --jq '.[] | select(.state=="FAILURE")'
```

If `pr=<n>` was given, skip straight to that PR. Otherwise loop over every open PR returned
above. For each PR, confirm ownership (`author.login` matches the user / the authenticated `gh`
account) before doing anything beyond read-only enumeration — an un-owned PR still gets listed
in the report, but is never triaged or touched (safety rule 3), unless the user explicitly
opted in for that PR number.

## Step 2 — Pull the actual failure logs

A check name tells you *that* it failed, not *why*. Always pull the real log before
classifying:

```bash
# Find the run backing a failing check
gh pr checks <pr> --json name,link

# Pull only the failed-step output (much shorter than the full log)
gh run view <run-id> --log-failed

# If you need the full log for context
gh run view <run-id> --log
```

Read enough of the log to identify the failure's actual signal — a tool's diff/exit-code
pattern (Step 3), a timeout/connection-reset string (Step 4), a stack trace or assertion
message (REAL), or an auth/permission/runner error (BLOCKED) — before assigning a class.

## Step 3 — The SAFE-AUTO allowlist

SAFE-AUTO is intentionally narrow: mechanical, deterministic, reversible operations where the
"fix" is running the project's own tool, not writing new logic. Match against this list — if a
failure doesn't fit one of these signals, it is **not** SAFE-AUTO:

| Signal in the log | What it means | The fix |
|---|---|---|
| A formatter check fails with a diff (prettier `--check`, black `--check`, gofmt `-l`, rustfmt `--check`) | Files aren't formatted to the project's own style | Run the formatter for real (prettier/black/gofmt/rustfmt, no flags beyond what CI itself runs) and commit the result |
| A linter fails on a rule that has a real autofix (eslint with `--fix`-fixable rules, ruff with `--fix`-fixable rules, stylelint `--fix`) | A lint rule the tool can mechanically correct | Run the linter's own `--fix`/`--fix`-equivalent, nothing else |
| An import-order check fails (isort, eslint `import/order`, gci) | Imports aren't sorted per the project's own config | Run the import-sorter, nothing else |
| A generated-file/lockfile drift check fails (`npm ci` lockfile mismatch, a codegen "diff after regenerate" check, a `go.sum`/`Cargo.lock` staleness check) | The committed file is stale relative to its deterministic source | Regenerate it with the project's own generator/lockfile command and commit the regenerated file only |

Anything requiring judgment — picking between two valid fixes, touching logic to satisfy a
lint rule with no autofix, resolving a *semantic* lockfile conflict (not just staleness) — is
**not** SAFE-AUTO even if the underlying tool is one of the above. Reclassify as REAL and
diagnose it properly (`references/remediation-protocol.md`).

## Step 4 — Flaky detection

Treat a failure as a **FLAKY candidate** (not yet a firm class) when the log shows any of:

- An explicit flaky marker the project already uses (`@flaky`, `.skip.flaky`, a known
  "quarantined" test tag).
- A network error, connection reset, DNS failure, or timeout that isn't the thing under test
  (e.g., a test-runner's package-registry fetch times out, not the assertion itself).
- A failure the project's own CI history shows as intermittent (same check, same commit range,
  passed on a previous run with no code change).
- A resource-contention symptom (port-in-use, race on a shared fixture, a test order
  dependency) rather than a deterministic assertion mismatch.

**Action:** `gh run rerun --failed` once. If the rerun is **green**, log it as FLAKY-resolved
in the run summary and move on — no fix needed. If it **fails again with the same signal**,
reclassify as REAL and diagnose properly; if it fails with a *different* signal, re-triage from
Step 2 as if it were a new failure.

## Step 5 — REAL and BLOCKED, distinguished

- **REAL**: the log shows an actual assertion failure with a concrete expected/actual mismatch,
  a type-checker error, a compiler/build error, or a stack trace pointing at application code.
  This is a genuine bug (or, occasionally, a genuinely wrong test) — go to
  `references/remediation-protocol.md` for diagnosis and the propose-first discipline. **Never**
  treat a REAL failure as SAFE-AUTO because the diff "looks small."
- **BLOCKED**: the log shows a missing/invalid secret or credential, a runner provisioning or
  quota error, a permissions/auth failure unrelated to the code (e.g., the workflow itself can't
  check out a private submodule), or an external service outage. None of these are fixed by
  editing the PR's code — report the specific cause (which secret, which service, which error)
  to the user and stop there.

## Output of a triage pass

For each PR, produce a compact per-check table: `check name → class → one-line reason (from the
actual log) → next action`. This is what feeds the per-PR loop in `SKILL.md` and what the
documentarian summarizes at the end of the run.

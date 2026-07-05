# Release Protocol

How `dev-team-ship` stands up (or documents) a versioning/release flow — and how the
`GITHUB_TOKEN` anti-recursion trap applies specifically to a tag-and-release chain. Read
before designing the release lane in either mode.

## Principles

- **Every release has a version, a changelog entry, and a tag — in that causal order.**
  The tag marks a commit that already carries the version bump and the changelog entry,
  never the other way round.
- **Semantic versioning** (`MAJOR.MINOR.PATCH`) unless the project already uses a
  different scheme — don't introduce a second one.
- **Automate only what's worth automating.** A low-traffic repo with rare releases may be
  better served by a short, documented manual runbook than by a workflow that needs its
  own maintenance. Both are valid definitions of done (`SKILL.md`); pick with the user,
  using the debate protocol if the tradeoff is genuinely contested.
- **A release workflow that tags/pushes is itself a `GITHUB_TOKEN` anti-recursion
  candidate** (`references/ci-setup-protocol.md`, Step 4) — design it with that in mind
  from the start, don't discover it after a `deploy.yml` silently never fires.

## CHANGELOG convention

Use [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) style — an `## [Unreleased]`
heading above the most recent dated release, `### Added` / `### Changed` / `### Fixed` /
`### Removed` subsections. (This very plugin's own `CHANGELOG.md` is a live example of the
shape to match.) The documentarian (`sonnet-scribe`) can draft the entry from the run's
decision log / checkpoint log, but a human should review the wording before it's cut into
a release — it's user-facing prose, not machine state.

## Path A — Automated: tag-on-version-bump

A workflow that, when the version in the manifest changes on `main`, creates the matching
tag and a GitHub release:

```yaml
name: release
on:
  push:
    branches: [main]
    paths:
      - "**/package.json"     # or whatever file carries the version — adapt to the project
jobs:
  tag-and-release:
    name: tag-and-release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Read version
        id: v
        run: echo "version=$(jq -r .version package.json)" >> "$GITHUB_OUTPUT"
      - name: Create tag + GitHub release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          TAG="v${{ steps.v.outputs.version }}"
          if git rev-parse "$TAG" >/dev/null 2>&1; then
            echo "Tag $TAG already exists, skipping." && exit 0
          fi
          git tag "$TAG"
          git push origin "$TAG"
          gh release create "$TAG" --generate-notes
      # ↓ REQUIRED if any downstream workflow listens for `push:` on this tag/branch —
      #   the tag push above used GITHUB_TOKEN and will NOT trigger it (see below).
      - name: Bridge to downstream publish/deploy workflow
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: gh workflow run publish.yml --ref main
```

**Why the bridge step is not optional if anything downstream depends on the tag/push:**
the `git push origin "$TAG"` and `gh release create` calls above run under `GITHUB_TOKEN`.
Per the anti-recursion rule (`references/ci-setup-protocol.md`, Step 4), that push/release
does **not** trigger any other workflow watching `on: push:` or `on: release:` in this
repo — silently, with no error. If a `publish.yml` or `deploy.yml` is supposed to fire off
the new tag/release, one of these bridges is required:

1. **Explicit dispatch** (shown above) — a follow-up `gh workflow run` step in the same
   run, using the token's allowed `actions: write` scope.
2. **A PAT** used for the tag-push/release-create step instead of `GITHUB_TOKEN` — pushing
   as a real identity DOES trigger downstream workflows. This is a credential: hand the
   user the exact **Settings → Secrets and variables → Actions → New repository secret**
   steps (name it, e.g. `RELEASE_PAT`; tell them where to generate it and what scopes it
   needs — typically `repo` + `workflow`) — never generate or paste the token value
   yourself.
3. **Document the manual dispatch** — if the downstream job is rare/low-stakes enough,
   say so plainly in the release runbook: "after a release is cut, manually run
   `publish.yml` (or push the button in the Actions tab)."

Flag this trap to the user **up front**, before they discover a release that silently
never deployed.

## Path B — Manual: a documented runbook

For repos where full automation isn't worth the maintenance, document the exact steps
instead (in `PROJECT.md` or a `RELEASING.md`, the user's call):

1. Decide the new version (semver) and confirm it against the changes since the last tag.
2. Bump the version in the manifest (`package.json`, `plugin.json`, `pyproject.toml`,
   etc.).
3. Move `## [Unreleased]` content in `CHANGELOG.md` under a new `## [X.Y.Z] - <date>`
   heading; leave `## [Unreleased]` empty above it for the next cycle.
4. Commit: `release: vX.Y.Z`.
5. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z` (a human runs the push — this skill
   never pushes to `main`/a tag without the user's go-ahead, per the suite's git-safety
   rules).
6. Create the GitHub release: `gh release create vX.Y.Z --notes-file <(sed -n
   '/## \[X.Y.Z\]/,/## \[/p' CHANGELOG.md)` or via the web UI (Releases → Draft a new
   release).

A manual runbook is a **complete, valid** definition of done for the release lane — it
does not need to be automated to count as "shipped" (`SKILL.md`'s Definition of done).

## Choosing between Path A and Path B

Ask (or infer from release cadence/repo activity): frequent releases + low tolerance for
manual toil → Path A; infrequent releases, or a team that wants a human eyes-on gate every
time → Path B. If genuinely contested, run the orchestrator's debate protocol and record
the decision in `PROJECT.md`'s decision log — this is exactly the kind of real
architecture-adjacent tradeoff that protocol exists for.

## Verifying the release lane (checker)

- **Path A:** a real dry-run (a version bump on a throwaway branch/PR, or a manually
  dispatched run) produces a tag + release, and — if a downstream workflow depends on it —
  the bridge step actually fires it. Paste the run URLs.
- **Path B:** the runbook is written down somewhere durable (`PROJECT.md` /
  `RELEASING.md`), and a dry run of the steps (up to but not including the actual
  push/tag, unless the user asks to cut a real release) confirms every command in it is
  correct against the current manifest/CHANGELOG state.
- Either path: the `CHANGELOG.md` format matches Keep a Changelog, and `## [Unreleased]`
  exists above the latest dated entry so the next cycle has somewhere to land.

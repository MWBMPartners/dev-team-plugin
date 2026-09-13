<!--
  File:    .claude/plans/ledger-file-clashes/analysis.md
  Purpose: Deep analysis for issue #41, produced by a Fable agent on 13 September 2026 (workflow wf_bee8e63e-4f4).
           Kept in the repository because the temporary folder it was written to gets cleared.
           This is the agent's text as returned; corrections made on review are recorded in plan-review.md.
-->

# Ledger file clashes — deep analysis

## 1. What I checked, and how

I read every plugin file the brief named, plus `issue-sync-protocol.md`, `verdict-and-report-protocol.md`, the three commands (`status`, `sync-issues`, `config`, `report`), `hooks.json`, `guard-dev-team.sh`, `tests/scripts.bats`, and this repo's own `.claude/CLAUDE.md` and `.claude/HANDOFF.md`. I then read the sibling projects' real files and their git index (which files are actually committed, what `.gitignore` says). For external facts I read the source markdown of GitHub's own documentation via the GitHub API, and the official Claude Code, Codex and Gemini CLI documentation.

## 2. Verified external facts (with sources) and what I could not verify

**GitHub — which file names are special, and where it looks.** Verified by reading the source of the page "Creating a default community health file" in the `github/docs` repository (`content/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file.md`):

- The special "community health" files are `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `FUNDING.yml`, `SECURITY.md`, `SUPPORT.md`, issue and pull-request templates, and discussion category forms.
- Where they may live: "All other supported files may be in the root of the repository, the `.github` folder, or the `docs` folder." (`FUNDING.yml` and templates must be in `.github`.)
- When one exists in more than one place: "GitHub uses the following order of precedence: the `.github` folder; the root of the repository; the `docs` folder." If none exists in the repo, GitHub falls back to the organisation's `.github` repository, using the same order.
- **`FEATURES.md`, `PROJECT.md`, `HANDOFF.md`, `VERIFICATION.md`, `MIGRATION.md` and `verdict.json` have no special meaning to GitHub.** They are not mentioned anywhere on that page.
- Practical consequence: a `SECURITY.md` inside `.dev-team/` is invisible to GitHub's security-policy feature, which is exactly what we want. CueRCode's `.github/SECURITY.md` already beats its root `SECURITY.md`, so CueRCode's public policy was never actually shadowed by the plugin's register — but only by luck of precedence.

**GitHub shows dot-folders.** Verified two ways: the GitHub contents API returns `SIGNula.id/.dev-team/` and its files normally, and the web file listing for a public repository (`github/docs`) shows `.github`, `.devcontainer` and `.vscode` in the folder list. So a `.dev-team/` folder is browsable and reviewable on GitHub like any other folder.

**GitLab.** I found no GitLab documentation that treats `SECURITY.md` specially; GitLab's "security policies" are a different thing (a `.gitlab/security-policies/policy.yml` file). GitLab does render `README`/`index` files. I could not find a definitive statement either way, so treat "GitLab ignores SECURITY.md" as *likely but not proven*. Nothing in the recommendation depends on it.

**Which files AI coding tools read automatically at session start.** This decides the HANDOFF.md question:

- Claude Code (official docs, `code.claude.com/docs/en/memory`): reads `./CLAUDE.md` or `./.claude/CLAUDE.md`, `CLAUDE.local.md`, `~/.claude/CLAUDE.md`, and `.claude/rules/`. "Claude Code reads `CLAUDE.md`, not `AGENTS.md`." It supports `@path/to/file` imports inside CLAUDE.md.
- Codex (official docs): reads `AGENTS.override.md`, then `AGENTS.md`, from `~/.codex` and from the git root down to the working directory, plus any configured fallback names. Nothing else.
- Gemini CLI (its docs repo, `docs/reference/configuration.md`): reads `GEMINI.md` from home and the project tree; the name is configurable via `context.fileName`, and can be a list such as `["CONTEXT.md", "GEMINI.md"]`.
- **None of them reads a root `HANDOFF.md` automatically.** The plugin's stated reason for keeping `HANDOFF.md` at the root ("a stable repo-root path any LLM tool can read cold") has never bought automatic discovery. It is found only when a human opens it or an instruction file points to it.

**Things I could not verify this session (stated from general knowledge; check when building):**
- VS Code's default Explorer exclusions hide only `.git`, `.svn`, `.hg`, `.DS_Store`, `Thumbs.db` — not other dot-folders. The docs page I fetched did not quote the default.
- macOS Finder hides dot-folders unless the user presses Cmd+Shift+. ; `ls` without `-a` hides them. Standard behaviour, not re-tested.
- Whether GitHub code search indexes dot-folders (I believe yes).
- Whether the GitHub Security tab for the private sibling repos currently shows a policy — the community-profile API returned nothing for private repos.
- Whether any sibling project's CI reads `verdict.json` at the root (I did not grep their workflows).
- Whether Claude Code `PreToolUse` hooks fire for a subagent's `Write`/`Edit` calls (I believe they do — hooks are harness-level — but a bats test cannot prove it; a manual run can).

## 3. Evidence table — the real projects

| Project | Root file | Whose is it? | Notes (verified by reading) |
|---|---|---|---|
| WebMS-Intra | `FEATURES.md` (1,565 lines, committed) | **Project's own** product inventory | Linked from README and `.claude/CLAUDE.md`; `.claude/HANDOFF.md` line 80 says featurefind was not run because it would overwrite it. Project keeps its own handover at `.claude/HANDOFF.md`. |
| SIGNula.id | `SECURITY.md` (committed) | **Mixed** — GitHub policy, then plugin findings appended from line 144 | The clash has already happened. |
| SIGNula.id | `.dev-team/FEATURES.md`, `.dev-team/PROJECT.md` (198 KB), `autopilot.json`, `specs/G-00x.md` — all committed | Plugin's, moved by hand | `.dev-team/.gitignore` contains only `loop.lock/`. Root `HANDOFF.md` is **hand-written** (emoji, 8 KB, not the 40-line template) and calls `.dev-team/` "the ledger". |
| CueRCode | `FEATURES.md`, `PROJECT.md`, `SECURITY.md`, `VERIFICATION.md`, `verdict.json` (all committed) | Plugin's | Public policy lives at `.github/SECURITY.md` (which wins by GitHub precedence). `.dev-team/` holds `autopilot.json` + a design note; `.gitignore` has `.dev-team/loop.lock/`. **No file carries the `dev-team-schema` marker.** |
| Go2My.Link | `FEATURES.md`, `PROJECT.md`, `SECURITY.md`, `HANDOFF.md` (committed) | Plugin's, except `HANDOFF.md` is **hand-maintained** | `CLAUDE.md` line 9 points at `HANDOFF.md` as "start here". `.gitignore`: `.dev-team/loop.lock/` with the comment "state file autopilot.json IS tracked". No schema marker. |
| CloudMapped | `SECURITY.md` ("# Security Policy"), `docs/SECURITY.md` (engineering model), `PROJECT.md`, `HANDOFF.md`, `.dev-team/config.yml` | Root `SECURITY.md` is the **project's**; `PROJECT.md` is the plugin's | The **only** repo whose `PROJECT.md` carries `<!-- dev-team-schema: 1.0 -->`. |
| iHymns | `SECURITY.md` ("# Security Policy"), `PROJECT.md` | Root `SECURITY.md` is the **project's**; `PROJECT.md` is a plugin run file | No marker. Has `AGENTS.md` and `.claude/CLAUDE.md`. |
| phpDomainCheckr | `SECURITY.md` ("# Security Policy") | Project's | A security run here would repeat the SIGNula.id damage. |

Three findings from this table that the brief did not already state:

1. **Root `HANDOFF.md` is a third clash, not a safe name.** SIGNula.id and Go2My.Link have hand-written root `HANDOFF.md` files that the plugin's auto-handoff (default on) would overwrite in full on the next run. WebMS-Intra sidestepped it by using `.claude/HANDOFF.md`.
2. **The existing marker rule is not being followed.** `conventions.md` says `PROJECT.md` carries `<!-- dev-team-schema: 1.0 -->`; only CloudMapped's does. So any ownership check based on markers must treat "no marker" as "unknown, ask", never as "not ours, safe to ignore" or "ours, safe to overwrite".
3. **Three of five installs hand-added `.dev-team/loop.lock/` to `.gitignore`.** The plugin should scaffold that itself.

## 4. How big the change is inside the plugin

Counts from `git grep` over tracked files: `PROJECT.md` 169 lines in 40 files; `SECURITY.md` 63/26; `VERIFICATION.md` 43/14; `FEATURES.md` 37/16; `HANDOFF.md` 35/14; `MIGRATION.md` 26/8; `verdict.json` 13/7. `hooks/`, `scripts/`, `tests/` and `.github/` mention none of them. Explicit "at the repo root" statements exist in `gap-scoring-rubric.md:52`, `documentarian-protocol.md:11`, `audit-and-backlog-protocol.md:9`, `migration-plan-protocol.md:119`, `review/SKILL.md:49`, `orchestrator/SKILL.md:32`, `handoff-template.md:8`, `conventions.md:25,119`, `autopilot/SKILL.md:119,134`, `loop-runtime.md:115,127`, `README.md:509,526`, `CHANGELOG.md:34`. The `autopilot.json` example in `loop-runtime.md` embeds bare paths (`"backlog": "PROJECT.md#Backlog"`, `trajectory_ref`, `spec_ref`).

Roughly 385 mentions; most are prose that can say `.dev-team/PROJECT.md` once and `PROJECT.md` thereafter *if* the plugin gains a self-test that catches a bare name used as a path (see section 8). Without that test, the stale-mention risk is real: a scribe reading one un-updated reference file will write to the root again.

## 5. The options, honestly

Judged against: stops the WebMS-Intra overwrite; stops findings being appended to a public security policy; stops the *next* clash with a name nobody has thought of; what breaks for existing installs; discoverability; how the plugin tells its file from the project's; size; and whether the safety check can fail quietly.

**A. Rename only `FEATURES.md` (e.g. `FEATURE-GAPS.md`).**
Stops WebMS-Intra. Does *nothing* for `SECURITY.md`, which is the worse failure (it damages a GitHub-recognised, public-facing file) and is live in SIGNula.id and waiting to happen in CloudMapped, iHymns and phpDomainCheckr. Does nothing for `HANDOFF.md`. Any new name can still clash. Smallest change (37 mentions). Verdict: fixes the symptom the owner noticed and leaves the worse one. Reject.

**B. Prefix every plugin file at the root (`DEV-TEAM-FEATURES.md` …).**
Stops both known clashes and makes a future clash unlikely (the prefix is a namespace). But it leaves seven plugin files cluttering the root of every project, which is what the owner is trying to avoid; `.dev-team/` already exists and already holds config and machine state, so the plugin would have two homes; and it touches every mention (all ~385) with brand-new names, so old-path references are more likely to slip. Existing installs need a rename of every file. Verdict: works, but strictly worse than C for the same cost.

**C. Move every ledger into `.dev-team/` (SIGNula.id precedent).**
Stops both known clashes, because the plugin no longer writes anywhere a project keeps its own files; GitHub never looks in `.dev-team/` for `SECURITY.md`. Stops the *next* clash by construction for any name, as long as the plugin only ever writes inside its own folder. One home for everything (config, machine state, ledgers, specs) — matches what SIGNula.id already did by hand and what the owner suggested. The folder is visible on GitHub and to every AI tool's file access (verified). Costs: same ~385 mentions to touch; `HANDOFF.md` needs a decision (below); existing installs need a one-off move; a project `.gitignore` could accidentally swallow the folder (a quiet failure — handled below). Verdict: **the right base.**

**D. Keep today's names, make the location configurable in `config.yml`.**
Puts the burden on the user to discover the problem *before* the plugin destroys a file — WebMS-Intra found out by reading the skill; SIGNula.id found out after the damage. A default of "root" keeps every clash; a default of `.dev-team/` *is* option C with an extra knob. Every extra allowed location is another place documentation, hooks and tests must handle, and the guard hook already hard-codes `.dev-team/`. Verdict: reject as a primary fix. Not needed as a knob either — one fixed location is safer and simpler. Revisit only if a real user needs it.

**E. Keep names, detect-and-refuse: never write into a file that is not the plugin's own.**
The only option that addresses the *behaviour* rather than the *name*: "read before you write, and stop if it is not yours." On its own it is weak: it depends on a marker that three of four existing installs never received; it still puts plugin files where they annoy projects; and it turns a first run in WebMS-Intra into an error instead of just working. But it is the backstop that catches what a location change cannot (a project that itself uses `.dev-team/` for something, a hand-edited file, a future skill with a new file name). Verdict: **adopt as the rule and enforce it, layered on C.**

**F (recommended). C + E, with a marker, a legacy lookup, a scaffolded `.gitignore`, a pointer line offered in the project's instruction file, and a hook + tests that enforce it.** Detailed below.

## 6. Recommendation

### 6.1 Exact paths (v1.5.0)

Everything the plugin writes lives under `.dev-team/` at the project root, and the plugin never writes any other path except the project's own source code during a build:

| Owner | New path | Was |
|---|---|---|
| documentarian (orchestrator / iterate / security / stripe / docs / ship) | `.dev-team/PROJECT.md` | `PROJECT.md` |
| featurefind | `.dev-team/FEATURES.md` | `FEATURES.md` |
| security | `.dev-team/SECURITY.md` | `SECURITY.md` |
| review | `.dev-team/VERIFICATION.md`, `.dev-team/verdict.json` | root |
| migrate | `.dev-team/MIGRATION.md` | `MIGRATION.md` |
| sonnet-scribe (all modes) | `.dev-team/HANDOFF.md` | `HANDOFF.md` |
| autopilot | `.dev-team/autopilot.json`, `.dev-team/loop.lock/`, `.dev-team/specs/` | unchanged (specs/ formalises SIGNula.id's practice) |
| user | `.dev-team/config.yml` | unchanged |
| plugin, written once if absent | `.dev-team/.gitignore` (content: `loop.lock/`), `.dev-team/README.md` (five lines: what this folder is, which plugin writes it, that it is safe to delete, where the docs are) | new |

**Keep the file names as they are inside the folder.** The folder is the namespace; renaming as well would double the number of things to get wrong across ~385 mentions, break the ID-prefix table's mental model (`FG-` → `FEATURES.md`), and diverge from SIGNula.id, which already uses these names inside `.dev-team/`. GitHub's special treatment of `SECURITY.md` does not reach into `.dev-team/` (verified: only `.github`, root, `docs`).

**`HANDOFF.md` moves too.** The evidence undercuts the v1.3.0 reasoning for the root: no AI tool reads a root `HANDOFF.md` automatically (verified for Claude Code, Codex, Gemini CLI), and root `HANDOFF.md` is already a hand-written file in at least two sibling repos that auto-handoff would clobber. Discoverability is provided instead by a pointer, not a root file:

- On the first run that creates `.dev-team/` (and at autopilot bootstrap, where the user is present), the lead **offers** to add one sentence to whichever instruction files the project already has — `CLAUDE.md` / `.claude/CLAUDE.md`, `AGENTS.md`, `GEMINI.md`: "Dev-team plugin state and the current handover live in `.dev-team/` — read `.dev-team/HANDOFF.md` first." Shown to the user, applied only on yes (the same posture `config-and-toggles.md` already takes for `config.yml`: never edit a repo-wide file silently). Use a plain sentence, not Claude Code's `@.dev-team/HANDOFF.md` import — an import loads the card into every session's context whether wanted or not.
- If the project has no instruction file, do nothing and say so in the run report.
- **No root pointer file.** Any new root name (`DEV-TEAM.md`, `AI-HANDOFF.md`) can clash the same way and re-introduces root clutter. The `.dev-team/README.md` gives a human who browses the folder on GitHub an explanation (GitHub renders a folder's README when you open the folder — standard behaviour, not re-verified this session).

**Tracked versus untracked.** Do not split the folder into sub-folders. Tracked: `config.yml`, all ledgers, `autopilot.json`, `specs/`, `HANDOFF.md`, `README.md`, `.gitignore`. Untracked: `loop.lock/` only. That is exactly what three installs did by hand, and it keeps `autopilot.json` and `loop.lock` at the paths the guard hook, `loop-runtime.md` and the bats tests already pin. Moving machine state into a sub-folder would gain tidiness and risk breaking active-run detection in every existing install.

### 6.2 How the plugin recognises its own file — marker AND title

Extend the existing schema-marker rule (`conventions.md` "Schema versioning") to **every** ledger, and make it the ownership test:

- Markdown, line 2: `<!-- dev-team: ledger=features schema=1.0 -->` (ledger = `project | features | security | verification | migration | handoff`). Keep the old `<!-- dev-team-schema: 1.0 -->` as an accepted legacy form.
- JSON (`verdict.json`, `autopilot.json`): top-level `"dev-team": "ledger=verdict"` alongside the existing `"schema"` field. Additive, so no major bump.
- Fixed titles (`# Feature Gap Ledger`, `# Security Findings Register`, `# Verification Report — …`, `# HANDOFF — …`) stay for humans.

**Rule: a file is the plugin's own if and only if it carries the marker.** Title alone is not enough (a project could legitimately title a file "Security Findings"). Marker alone is enough. Missing marker means "not known to be ours — ask", never "safe".

### 6.3 What the plugin does when it finds a same-named file that is not its own

Before any create/overwrite/append to a ledger path, the writer reads the target first. Then:

1. Marker present → proceed (overwrite or append per that file's rules).
2. File absent → create with the marker.
3. **File present, no marker → do not write.** Stop, name the path, show its first three lines, and offer exactly two choices: (a) "this *is* a dev-team file from before v1.5 — stamp it and continue" (only on the user's explicit yes; the run then adds the marker and commits that as its own commit), or (b) "leave it — write nothing". Under an unattended autopilot cycle this sets `state: BLOCKED`, reason `ledger-ownership`, so the loop stops instead of guessing. There is no third "looks like ours, carry on" branch; that branch is how SIGNula.id's policy got findings appended to it.
4. Special case, always: the security skill never writes to `SECURITY.md` at root, `.github/`, or `docs/` — the three GitHub-recognised locations — even if a `target=` argument names one. Refuse with the reason.
5. Before writing, run `git check-ignore -q .dev-team/<file>`; if the project's `.gitignore` swallows it, warn loudly in the report ("this ledger will not be committed; the 'committed with the work' promise does not hold here") rather than writing a file that silently never travels with the repo.

### 6.4 Carrying existing installs over

A **lookup order** plus a **one-off, explicit move**:

- Readers look first at `.dev-team/<name>`; if absent, at the legacy root `<name>`. A legacy root file with a marker (CloudMapped `PROJECT.md`) is ours. A legacy root file **without** a marker (CueRCode, Go2My.Link, iHymns) triggers the section 6.3 prompt at the start of the first run after upgrade: "Found root `PROJECT.md`, no dev-team marker, but it looks like a dev-team ledger (title 'Autopilot Project Memory', `B-`/`FG-` ids). Move it to `.dev-team/PROJECT.md` and stamp it? [yes/no]." Yes → `git mv`, add marker, `git add`, one commit "dev-team: move ledgers into .dev-team/ (v1.5)". No → start fresh in `.dev-team/`, leave the root file alone. Never silently read a marker-less root file as the ledger.
- Add a command `/dev-team-move-ledgers` (dry-run by default; `--apply` to do it) that performs the same check-and-move for all seven files in one go, so an owner can migrate a repo deliberately rather than at the start of some other run. It refuses on any **mixed** file: a root `SECURITY.md` whose first heading is "# Security Policy" but which also contains a `## Findings`/`F-0` register (SIGNula.id) is reported with the exact line range and left untouched — cutting it is a hand job with the owner's eyes on it.
- `autopilot.json` references: existing files say `"backlog": "PROJECT.md#Backlog"`. Readers accept both bare and `.dev-team/`-prefixed forms; the first RECORD after upgrade rewrites them to the new form. Schema stays `1.x` (additive).
- Issue sync, `/dev-team-status`, `/dev-team-report`, `/dev-team-sync-issues`: each lists the seven paths explicitly today; they get the same lookup order (`.dev-team/` first, legacy root second) so the dedup `issue:` fields are still found during the transition. The hidden `<!-- dev-team:<id> -->` issue markers are unaffected by file location.
- Per-repo outcome of applying this: WebMS-Intra — featurefind becomes runnable, its inventory untouched. SIGNula.id — `.dev-team/` files already in place (add markers); root `SECURITY.md` needs the manual split; hand-written root `HANDOFF.md` is protected by rule 6.3 from now on. CueRCode, Go2My.Link — five/four files move; Go2My.Link's hand-written `HANDOFF.md` stays put and is protected. CloudMapped, iHymns — `PROJECT.md` moves; their public `SECURITY.md` is never touched again.

### 6.5 Per-run behaviour summary (for the plan stage)

`conventions.md` gets a new section "Where the plugin writes, and the ownership rule" (single canonical home); the Shared artifacts table paths change; `documentarian-protocol.md`, `gap-scoring-rubric.md`, `threat-model-and-surface-protocol.md`, `verdict-and-report-protocol.md`, `migration-plan-protocol.md`, `handoff-template.md`, `audit-and-backlog-protocol.md`, `loop-runtime.md` (JSON example paths), the three commands, README glossary and Cross-cutting section, CHANGELOG, and every SKILL.md that says "at the repo root" are updated. The version goes to 1.5.0 (see the question in section 7).

## 7. Decisions that genuinely need the owner

1. **Move `HANDOFF.md` into `.dev-team/` as well, with a pointer sentence offered in the project's existing `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`?** Suggested answer: yes — the evidence shows the root path never gave automatic discovery, and root `HANDOFF.md` is already a hand-written file in two sibling repos.
2. **Keep the file names unchanged inside `.dev-team/` (rather than, say, `FEATURE-GAPS.md`)?** Suggested answer: yes — folder is the namespace, matches SIGNula.id, halves the chance of a stale reference.
3. **Version: 1.5.0 or 2.0.0?** A location change is a behaviour change, but nothing old stops working (legacy lookup + explicit prompt), and the file *formats* stay 1.x. Suggested answer: 1.5.0, with a CHANGELOG entry titled "Ledgers move into .dev-team/ — one-off migration prompt".
4. **SIGNula.id `SECURITY.md`: cut lines 144 to end into `.dev-team/SECURITY.md` by hand after this ships?** Suggested answer: yes; the plugin must not do this automatically.

## 8. Written rule only, or something that actually runs?

Both, and the brief's instinct is right that a written rule alone can fail quietly — the existing marker rule already proves it (only one of four installs got the marker). What is realistic given `hooks/guard-dev-team.sh` and `tests/`:

**A second PreToolUse hook, `hooks/guard-ledgers.sh`, matching `Write|Edit|MultiEdit`** (the current guard matches `Bash` only). Same shape as the existing one: `set -u`, `jq` if present, fail-open on any error, "one defence layer, never the guarantee". Two rules:

- Rule 1 — always on, no false positives possible: **deny a `Write` whose *content* contains the `<!-- dev-team:` marker (or `"dev-team":` in JSON) to any path outside `.dev-team/`.** Only plugin-generated content carries the marker, so this can never block a user editing their own root `FEATURES.md`. This is the hook that would have stopped the scribe from writing to the root after a stale doc reference.
- Rule 2 — only while a run is active (same scope gate as today: `.dev-team/autopilot.json` present, or `DEV_TEAM_GUARD` set, honouring `features.guard`): **deny `Write`/`Edit` to a root-level path whose basename is one of the seven ledger names when the existing file lacks the marker.** Outside a run this rule is off, so WebMS-Intra editing its own `FEATURES.md` in Claude Code is never blocked.

Limits to state plainly: the guard reads `tool_input.file_path`/`content`, so it cannot see a `cat >>` done through Bash (the existing Bash guard could gain a narrow rule for `>> SECURITY.md`-style appends at root, but string-matching shell redirection is brittle — say it is best-effort). And I could not verify in this session that hooks fire for a subagent's `Write`; test it by hand once when building.

**Tests (bats, following `tests/scripts.bats` exactly):** marker-content write to root → exit 2; same to `.dev-team/` → exit 0; user edit of a marker-less root `FEATURES.md` with no run active → exit 0; same during a run → exit 2; `guard: off` in config → exit 0; missing `jq` → exit 0.

**A repo self-test for stale mentions: `scripts/audit-ledger-paths.sh`, run from `tests/smoke-structure.sh` and CI.** It greps the plugin's own skills, commands and README for a bare `FEATURES.md`/`PROJECT.md`/… used as a path (not preceded by `.dev-team/`), against a small allowlist of lines that deliberately discuss the legacy root location. This is the check that turns "385 mentions to update" from a hope into a gate — the same pattern as the existing `audit-model-ids.sh`, which does exactly this for model ids.

**A conformance check the scribe runs on itself:** after writing any ledger, re-read line 2 and confirm the marker is present; if not, the write is reported as failed. Cheap, and it closes the "marker rule not followed" gap.

## 9. Out of scope, but wrong or risky — noticed on the way

- `README.md:507` says featurefind has "no cold-resume mechanic of its own"; `dev-team-featurefind/SKILL.md:101` and `gap-scoring-rubric.md:80` say a later run reads `FEATURES.md` and refreshes it. One of these is wrong.
- The security skill commits proof-of-concept exploit details into the repo (`SECURITY.md` findings register with PoC paths). Moving it into `.dev-team/` does not make it private; in a public repo (CueRCode, iHymns are public-facing products) this contradicts "findings stay private". Worth a separate decision.
- `handoff-template.md` "Artifacts:" line omits `MIGRATION.md` and `verdict.json`.
- SIGNula.id `.dev-team/PROJECT.md` is 198 KB — the "Keep it lean" rule in `documentarian-protocol.md` is not being applied.
- Three installs hand-wrote `.dev-team/loop.lock/` into `.gitignore`; two (CloudMapped, iHymns) have no such line, so a crashed autopilot run there would leave a lock directory that could be committed.
- `hooks.json` registers no `Write`/`Edit` hook at all today, so nothing the harness enforces currently protects any file — only the written rules do.
- Existing installs' root ledgers (CueRCode, Go2My.Link, iHymns) lack the schema marker that `conventions.md` says `PROJECT.md` must carry — the scribe is not writing it.

Files that matter for the plan stage (absolute paths):
`/Users/lance.manasse/Projects/Coding & Development/MWBM Partners Ltd/GitHub/dev-team-plugin/skills/dev-team-orchestrator/references/conventions.md`,
`…/skills/dev-team-orchestrator/references/documentarian-protocol.md`,
`…/skills/dev-team-orchestrator/references/handoff-template.md`,
`…/skills/dev-team-orchestrator/references/config-and-toggles.md`,
`…/skills/dev-team-orchestrator/references/issue-sync-protocol.md`,
`…/skills/dev-team-featurefind/references/gap-scoring-rubric.md`,
`…/skills/dev-team-security/references/threat-model-and-surface-protocol.md`,
`…/skills/dev-team-review/references/verdict-and-report-protocol.md`,
`…/skills/dev-team-migrate/references/migration-plan-protocol.md`,
`…/skills/dev-team-iterate/references/audit-and-backlog-protocol.md`,
`…/skills/dev-team-autopilot/references/loop-runtime.md`,
`…/commands/dev-team-status.md`, `…/commands/dev-team-sync-issues.md`, `…/commands/dev-team-config.md`, `…/commands/dev-team-report.md`,
`…/hooks/hooks.json`, `…/hooks/guard-dev-team.sh`, `…/tests/scripts.bats`, `…/tests/smoke-structure.sh`, `…/scripts/audit-model-ids.sh` (pattern to copy), `…/README.md`, `…/CHANGELOG.md`, `…/.claude-plugin/plugin.json`.
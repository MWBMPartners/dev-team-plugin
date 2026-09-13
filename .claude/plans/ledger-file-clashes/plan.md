<!--
  File:    .claude/plans/ledger-file-clashes/plan.md
  Purpose: Deep implementation plan for issue #41, produced by a Fable agent on 13 September 2026 (workflow wf_bee8e63e-4f4).
           Kept in the repository because the temporary folder it was written to gets cleared.
           This is the agent's text as returned; corrections made on review are recorded in plan-review.md.
-->

# Deep plan — moving the dev-team ledgers into `.dev-team/` and refusing to write over files that are not the plugin's own

I re-checked the analysis against the real files. Its counts and file lists are right (my own `git grep` figures are below and match). Its reading of the sibling projects is right — I re-read the heads of the files and the `.gitignore` lines. Two places where I depart from it are marked **"Differs from the analysis"** with the reason. One extra fact worth having: WebMS-Intra's own `.claude/HANDOFF.md` (lines 34–35) already says it *expects* featurefind to write to `.dev-team/FEATURES.md` — so the owner's preferred direction is also what a real project has already assumed.

---

## 1. The final design in one paragraph

Every file the plugin writes for its own use lives in the project's `.dev-team/` folder, with the file names unchanged: `.dev-team/PROJECT.md`, `.dev-team/FEATURES.md`, `.dev-team/SECURITY.md`, `.dev-team/VERIFICATION.md`, `.dev-team/verdict.json`, `.dev-team/MIGRATION.md`, `.dev-team/HANDOFF.md`, alongside the existing `.dev-team/autopilot.json`, `.dev-team/loop.lock/` and `.dev-team/config.yml`. The plugin recognises its own file by a **marker** — line 2 of every markdown ledger reads `<!-- dev-team: ledger=<kind> schema=1.0 -->` (kind = `project`, `features`, `security`, `verification`, `migration`, `handoff`, `readme`), and `verdict.json` carries a top-level `"dev-team": "ledger=verdict schema=1.0"`; the older `<!-- dev-team-schema: 1.0 -->` is still accepted as proof of ownership when reading. **The ownership rule:** before any create/overwrite/append, the writer reads the target; marker present → proceed; file absent → create with the marker; file present without a marker → write nothing, show the user the path and its first three lines, and offer exactly two choices (stamp it as a pre-v1.5 dev-team file, or leave it alone) — under an unattended autopilot cycle this sets `state: BLOCKED` with reason `ledger-ownership` instead of guessing. **Existing installs** keep working through a lookup order: readers check `.dev-team/<name>` first and, if absent, the old top-level `<name>`; a top-level file *with* a marker is moved (`git mv`) into `.dev-team/` and committed on its own; one *without* a marker triggers the two-choice prompt; a new command `/dev-team-move-ledgers` (dry-run by default, `--apply` to act) does the same for all seven files at once and refuses to touch a "mixed" file such as SIGNula.id's `SECURITY.md`. The security skill never writes `SECURITY.md` at the top level, in `.github/` or in `docs/` (GitHub's three security-policy locations). On first use the plugin creates `.dev-team/.gitignore` (`loop.lock/`) and a short `.dev-team/README.md`, warns if the project's `.gitignore` would swallow the folder, and *offers* (never applies silently) one pointer sentence in whichever of `CLAUDE.md` / `.claude/CLAUDE.md` / `AGENTS.md` / `GEMINI.md` the project already has. Enforcement is layered: the written rule in `conventions.md`; a new `PreToolUse` hook `hooks/guard-ledgers.sh` on `Write|Edit|MultiEdit`; a repo self-test `scripts/audit-ledger-paths.sh` so the plugin's own docs cannot drift back to the old paths; and a scribe self-check after every write. Version becomes **1.5.0**.

---

## 2. Work packages, in order

### Grep evidence (run on every tracked file; counts are lines / files)

```
cd "<repo>" && for n in PROJECT.md FEATURES.md SECURITY.md VERIFICATION.md MIGRATION.md HANDOFF.md verdict.json; do
  echo "$n: $(git grep -n -- "$n" | wc -l) lines, $(git grep -l -- "$n" | wc -l) files"; done
```
Result: `PROJECT.md` 169/40 · `FEATURES.md` 37/16 · `SECURITY.md` 63/26 · `VERIFICATION.md` 43/14 · `MIGRATION.md` 26/8 · `HANDOFF.md` 35/14 · `verdict.json` 13/7. (`autopilot.json` 76/22 and `loop.lock` 3/2 are already under `.dev-team/` and are not moving.)

```
git grep -n -iE "repo[- ]root|at the root|repository root" -- ':!tests/' ':!.claude/' ':!CHANGELOG.md'
```
Result (the lines that must be rewritten): `README.md:509,526` · `agents/sonnet-scribe.md:7` · `skills/dev-team-autopilot/SKILL.md:119,134` · `skills/dev-team-autopilot/references/loop-runtime.md:115,127` · `skills/dev-team-featurefind/references/gap-scoring-rubric.md:52` · `skills/dev-team-iterate/references/audit-and-backlog-protocol.md:9` · `skills/dev-team-migrate/references/migration-plan-protocol.md:119` · `skills/dev-team-orchestrator/SKILL.md:32` · `skills/dev-team-orchestrator/references/conventions.md:25,119` · `skills/dev-team-orchestrator/references/documentarian-protocol.md:11,109` · `skills/dev-team-orchestrator/references/handoff-template.md:8` · `skills/dev-team-review/SKILL.md:49`. (`CONTRIBUTING.md:28,41` and `skills/dev-team-docs/references/doc-standards.md:48` mention "root" about the *plugin's* root or a monorepo root — not ledger locations; leave them.)

```
git grep -n -- "dev-team-schema"
```
Result: `conventions.md:43`, `documentarian-protocol.md:7,15`, `migration-plan-protocol.md:126` — the four places the old marker is defined.

`hooks/`, `scripts/`, `tests/`, `.github/` contain none of the seven names (verified: the only hits there are `autopilot.json`).

### The rule wording that must be **identical** everywhere it appears

Wherever a skill, agent or command file needs to state the rule briefly, use this sentence verbatim and then point at the canonical section:

> Every file the dev-team suite writes for itself lives in `.dev-team/` and carries the dev-team marker on line 2; a file at that path without the marker is never written to — the run stops and asks. See `dev-team-orchestrator/references/conventions.md`, "Where the plugin writes, and the ownership rule".

The marker lines, verbatim (one per ledger kind):

```
<!-- dev-team: ledger=project schema=1.0 -->
<!-- dev-team: ledger=features schema=1.0 -->
<!-- dev-team: ledger=security schema=1.0 -->
<!-- dev-team: ledger=verification schema=1.0 -->
<!-- dev-team: ledger=migration schema=1.0 -->
<!-- dev-team: ledger=handoff schema=1.0 -->
<!-- dev-team: ledger=readme schema=1.0 -->
```
and in `verdict.json`: `"dev-team": "ledger=verdict schema=1.0"` (a top-level string field).

The pointer sentence the plugin offers to add to an instruction file, verbatim:

> Dev-team plugin state and the current handover live in `.dev-team/` — read `.dev-team/HANDOFF.md` first.

The refusal prompt, verbatim (fill the angle brackets):

> Found `<path>` but it has no dev-team marker, so I cannot tell whether it is this plugin's file or the project's own. First three lines: <lines>. Choose one: (a) "it is a dev-team file from before v1.5.0" — I will add the marker (and, for a top-level file, move it to `.dev-team/<name>`) and commit that on its own; (b) "leave it" — I will write nothing to it. I will not guess.

---

### WP1 — `conventions.md`: the canonical rule (do this first; everything else follows it)

**File:** `skills/dev-team-orchestrator/references/conventions.md`

1. **Add a new section `## Where the plugin writes, and the ownership rule`** directly after "Shared artifacts — who owns (writes) vs who reads" and before "PROJECT.md canonical section headings". It must contain, in plain English, these nine points:
   1. *One home.* Everything the suite writes for itself lives in `.dev-team/` at the top of the project: the six markdown ledgers, `verdict.json`, `autopilot.json`, `loop.lock/`, `config.yml`, plus a `README.md` and a `.gitignore` the plugin creates once. It never writes a record file at the project's top level, in `docs/`, or in `.github/`. *Why:* projects keep their own files with these names — a product feature list called `FEATURES.md`, a GitHub security policy called `SECURITY.md` (GitHub reads that from `.github/`, the top level, or `docs/`, in that order, and never from `.dev-team/`), a project's own `PROJECT.md` or `HANDOFF.md`. Before v1.5.0 the suite wrote at the top level (the legacy root location) and in real projects overwrote or appended to those files. *Rejected:* renaming the files (fixes one clash, not the next one); prefixing the names at the top level (still clutters the project); a configurable location (the user finds out after the damage).
   2. *Names unchanged inside the folder.* The folder is the namespace; renaming as well would double the chance of a stale reference and break the ID-prefix table's mental model.
   3. *The marker* — the seven marker lines above, plus the `verdict.json` field; `autopilot.json` keeps its existing `"schema"` field and gains nothing (it already lives in `.dev-team/` and only the conductor writes it). The old `<!-- dev-team-schema: 1.0 -->` is accepted as proof of ownership when reading and replaced by the new form the next time the file is written. The marker is both the format version (see "Schema versioning") and the ownership proof.
   4. *The ownership rule — read before you write*, as stated in section 1, including the exact refusal prompt, the "no third branch" statement, and the unattended-autopilot behaviour (`state: BLOCKED`, reason `ledger-ownership`, report names the file and points to `/dev-team-move-ledgers`).
   5. *Files from before v1.5.0 — the lookup order.* Readers look at `.dev-team/<name>` first; if absent, at the top-level `<name>`. Marker present (either form) → ours: `git mv` it into `.dev-team/`, rewrite the marker to the new form, commit "dev-team: move `<name>` into .dev-team/ (v1.5.0)" on the current run branch before any other work (under `dry-run`, read it in place, move nothing, say the move is pending). No marker → apply point 4; on "leave it", start a fresh `.dev-team/<name>` and never touch the top-level file. **Never read a marker-less top-level file as the ledger.**
   6. *Security-policy locations.* The security skill never writes `SECURITY.md` at the top level, in `.github/` or in `docs/`, even if an argument names one; it refuses and says why.
   7. *First write into `.dev-team/`.* `mkdir -p .dev-team`; if `.dev-team/.gitignore` is absent, create it containing exactly one line `loop.lock/`; if `.dev-team/README.md` is absent, create it with the fixed text below; then run `git check-ignore -q .dev-team/<file>` and, if it is ignored, put this warning in the run report: "`.dev-team/<file>` is ignored by this repo's `.gitignore`, so it will not be committed and will not travel with the repo." Never edit the project's own `.gitignore` (repo-wide file — same posture as `config.yml`).
   8. *Discoverability without a top-level file.* On the first run that creates `.dev-team/` — interactive runs only, and autopilot's bootstrap counts as interactive — offer, never apply silently, the pointer sentence above in each of `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md`, `GEMINI.md` that already exists. A plain sentence, not an `@` import (an import would load the card into every session). None present → say so in the report and do nothing. *Why no top-level pointer file:* any new top-level name can clash the same way. *Why moving `HANDOFF.md` loses nothing:* no AI coding tool reads a top-level `HANDOFF.md` automatically — Claude Code reads `CLAUDE.md`, Codex reads `AGENTS.md`, Gemini CLI reads `GEMINI.md` — and two real projects already keep a hand-written `HANDOFF.md` at the top level that auto-handoff would have overwritten.
   9. *Enforcement* — the written rule; `hooks/guard-ledgers.sh`; `scripts/audit-ledger-paths.sh`; and the scribe self-check: after writing any ledger, re-read line 2 (or the JSON field) and, if the marker is missing, report the write as failed.
   
   The fixed `.dev-team/README.md` text (put it in this section, in a fenced block, verbatim):
   ```
   # .dev-team — dev-team plugin working folder
   <!-- dev-team: ledger=readme schema=1.0 -->

   This folder belongs to the dev-team Claude Code plugin (https://github.com/MWBMPartners/dev-team-plugin).
   It holds the plugin's own record files — PROJECT.md, FEATURES.md, SECURITY.md, VERIFICATION.md with
   verdict.json, MIGRATION.md, HANDOFF.md — plus its run state (autopilot.json) and the repo-wide settings
   file (config.yml). Everything here is meant to be committed except loop.lock/, which the .gitignore in
   this folder excludes. To resume work, read HANDOFF.md first. None of these files are part of the product;
   deleting the folder loses the plugin's memory of past runs and nothing else.
   ```

2. **Shared artifacts table (lines 17–26):** every `File` cell becomes the `.dev-team/` path (`.dev-team/PROJECT.md`, `.dev-team/FEATURES.md`, `.dev-team/SECURITY.md`, `.dev-team/VERIFICATION.md` + `.dev-team/verdict.json`, `.dev-team/MIGRATION.md`, `.dev-team/HANDOFF.md`). In the `HANDOFF.md` row replace "at a stable repo-root path" with "at the fixed path `.dev-team/HANDOFF.md`". Add a row for `.dev-team/README.md` + `.dev-team/.gitignore` (owner: "any skill, created once if absent — never overwritten").
3. **Line 39:** `PROJECT.md#Trajectory-ledger` → `.dev-team/PROJECT.md#Trajectory-ledger`; `PROJECT.md#spec-<id>` → `.dev-team/PROJECT.md#spec-<id>`.
4. **Schema versioning (line 43):** state that the marker is now `<!-- dev-team: ledger=<kind> schema=1.0 -->` on every markdown ledger and `"dev-team": "ledger=verdict schema=1.0"` in `verdict.json`; that the old form is the legacy marker; and that a *missing* marker now means "not known to be ours — ask" for writing, while for *reading a file already known to be ours* it is still treated as `1.0`.
5. **ID prefixes table (lines 49–55) and line 57:** prefix the locations with `.dev-team/`.
6. **Cold-resume (lines 96–98):** the artifact list becomes `.dev-team/PROJECT.md` etc., and add: "found through the lookup order in 'Where the plugin writes'".
7. **Auto-handoff (lines 115–126):** replace "at a stable **repo-root path**" with "at the fixed path `.dev-team/HANDOFF.md`"; add one sentence that a project's own top-level `HANDOFF.md` is never touched.

**Check:** `bash scripts/audit-ledger-paths.sh` (from WP3) reports no failure for this file; a reviewer reads the new section against section 1 of this plan point by point.

### WP2 — the hook: `hooks/guard-ledgers.sh` + `hooks/hooks.json` + bats tests

**Files:** new `hooks/guard-ledgers.sh` (executable); `hooks/hooks.json`; `tests/scripts.bats`; `tests/README.md`; `skills/dev-team-orchestrator/references/config-and-toggles.md` (the `guard` row, line 100, and the paragraph at 107–113).

**hooks.json:** add a second `PreToolUse` entry `{"matcher": "Write|Edit|MultiEdit", "hooks": [{"type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/guard-ledgers.sh"}]}`.

**The script's contract** (mirror `guard-dev-team.sh` exactly in style: `set -u`, read stdin payload, `jq` if present, exit 0 on any doubt, exit 2 with a `dev-team guard:` message on stderr to deny; header comment explaining both rules, why, and what it cannot do):

- Read `guard_mode` from `.dev-team/config.yml` the same way the Bash guard does. `off` → exit 0 immediately (both rules off).
- Parse `tool_name`, `tool_input.file_path`, and the new content: for `Write` use `tool_input.content`; for `Edit` use `tool_input.new_string`; for `MultiEdit` join `tool_input.edits[].new_string`. No `jq`, or no `file_path` → exit 0.
- Normalise the path: if it starts with `$PWD/`, strip that prefix; strip a leading `./`. The hook assumes the tool runs with the project root as its working directory, exactly as the Bash guard assumes for `.dev-team/autopilot.json` — say so in the header.
- **Rule 1 (active unless `guard: off`):** if the tool is `Write` and the first three lines of `content` contain `<!-- dev-team: ledger=` or `"dev-team": "ledger=`, and the normalised path does **not** start with `.dev-team/`, deny: "dev-team guard: this content carries the dev-team marker but the path `<p>` is outside `.dev-team/`. Ledgers live only in `.dev-team/`." *Why first three lines only:* the plugin's own documentation quotes the marker inside code blocks far down the file; a real ledger has it on line 2. *Why Write only:* an Edit's `new_string` has no line position. *Why this rule is on outside a run:* the failure it prevents (a scribe following a stale instruction) happens in standalone runs too, and only plugin-generated content carries the marker, so it cannot block a user editing their own file.
- **Rule 2 (active only under the run gate — `.dev-team/autopilot.json` present, or `guard: on`, or `DEV_TEAM_GUARD` set):** if the normalised path is exactly one of `PROJECT.md`, `FEATURES.md`, `SECURITY.md`, `VERIFICATION.md`, `MIGRATION.md`, `HANDOFF.md`, `verdict.json` (no directory part), deny for any of the three tools whether or not the file exists: "dev-team guard: `<p>` is a top-level file with a dev-team ledger name; the suite writes only into `.dev-team/`. If this is the project's own file and you meant to edit it, do it yourself or disable the guard." *Why no marker exception:* the plugin never writes at the top level any more, so during a run there is no legitimate plugin write there.
- **Differs from the analysis:** the analysis had Rule 2 "deny only when the existing file lacks the marker". Dropping the exception is simpler and safer — a legacy marker-bearing top-level file is moved by the lookup order, never updated in place.
- **Stated limits (in the header):** cannot see a `cat >>` through Bash; cannot know the repo root if the working directory is a subfolder; not verified in this session that hooks fire for a subagent's Write — check by hand once when building (see Risks).

**Bats tests to add** (helper `run_ledger_guard DIR PAYLOAD` like `run_guard`; each test in a fresh `$SCRATCH`; assertions are the exit status and, on deny, `[[ "$output" == *"dev-team guard"* ]]`):

| # | Setup | Payload | Expect |
|---|---|---|---|
| 1 | nothing | Write, `FEATURES.md`, content line 2 = marker | 2 |
| 2 | nothing | same content, `.dev-team/FEATURES.md` | 0 |
| 3 | nothing | same content, absolute `$SCRATCH/.dev-team/FEATURES.md` | 0 |
| 4 | nothing | same content, `docs/notes.md` | 2 |
| 5 | nothing | Write, `FEATURES.md`, no marker | 0 (user's own file, no run) |
| 6 | `.dev-team/autopilot.json` present | Write, `FEATURES.md`, no marker | 2 (Rule 2) |
| 7 | `.dev-team/autopilot.json` present | Edit, `SECURITY.md`, `new_string` "x" | 2 |
| 8 | nothing | Edit, `SECURITY.md`, `new_string` "x" | 0 |
| 9 | `.dev-team/autopilot.json` present | Write, `.github/SECURITY.md`, no marker | 0 (documents that Rule 2 is top-level only) |
| 10 | config `guard: off` + `autopilot.json` | Write, `FEATURES.md`, marker content | 0 |
| 11 | config `guard: on`, no run | Write, `PROJECT.md`, no marker | 2 |
| 12 | nothing | Write, `notes.md`, marker on line 10 only | 0 |
| 13 | nothing | payload `{}` | 0 |
| 14 | nothing | Write, `verdict.json`, content `{"dev-team":"ledger=verdict schema=1.0"}` | 2 |
| 15 | nothing | MultiEdit, `.dev-team/PROJECT.md` | 0 |

**config-and-toggles.md:** the `guard` row now governs both hooks; add the sentence that Rule 1 of `guard-ledgers.sh` stays on in `auto` mode (only `off` disables it) and why. **tests/README.md:** list the new hook and its matrix. **CONTRIBUTING.md line 14–16:** mention the second PreToolUse hook.

**Check:** `bats tests/scripts.bats` all green; `shellcheck hooks/*.sh` clean; `bash tests/smoke-structure.sh` passes (it validates `hooks.json` and executability).

### WP3 — the repo self-test: `scripts/audit-ledger-paths.sh` + CI + bats

**Files:** new `scripts/audit-ledger-paths.sh` (executable); `.github/workflows/plugin-audit.yml` (add a step to the `audit` job: `bash scripts/audit-ledger-paths.sh`); `tests/scripts.bats`; `tests/smoke-structure.sh` (check 7: the script exists and is executable); `CONTRIBUTING.md` "Running the checks locally"; `README.md` "Repo self-audit / CI".

Pattern to copy: `scripts/audit-model-ids.sh` (cd to repo, `note()`, `AUDIT OK`/exit 1). Scope: `skills/`, `commands/`, `agents/`, `hooks/`, `README.md`, `CONTRIBUTING.md`. Excluded on purpose: `CHANGELOG.md` (history stays as written), `.claude/` (this repo's own notes), `tests/`. Any line containing the phrase `legacy root` is skipped by the negative checks — that is the one allowed way to talk about the old location.

Checks, printed as `LEDGER-PATHS FAIL: <reason>` and exit 1, else `LEDGER-PATHS OK`:

- **A (positive)** `conventions.md` contains each of `.dev-team/PROJECT.md`, `.dev-team/FEATURES.md`, `.dev-team/SECURITY.md`, `.dev-team/VERIFICATION.md`, `.dev-team/verdict.json`, `.dev-team/MIGRATION.md`, `.dev-team/HANDOFF.md`, and the heading `## Where the plugin writes, and the ownership rule`.
- **B (positive)** each schema-defining file contains its own path and its marker line: `documentarian-protocol.md` → `.dev-team/PROJECT.md` + `ledger=project`; `gap-scoring-rubric.md` → `.dev-team/FEATURES.md` + `ledger=features`; `threat-model-and-surface-protocol.md` → `.dev-team/SECURITY.md` + `ledger=security`; `verdict-and-report-protocol.md` → `.dev-team/VERIFICATION.md`, `.dev-team/verdict.json`, `ledger=verification`, `ledger=verdict`; `migration-plan-protocol.md` → `.dev-team/MIGRATION.md` + `ledger=migration`; `handoff-template.md` → `.dev-team/HANDOFF.md` + `ledger=handoff`.
- **C (negative)** any line containing `repo root`, `repo-root` or `sibling to` that still contains a ledger name after every `.dev-team/<NAME>` occurrence has been removed from the line (do it with `sed` then `grep -E '(PROJECT|FEATURES|SECURITY|VERIFICATION|MIGRATION|HANDOFF)\.md|verdict\.json'`).
- **D (negative)** a backticked or quoted anchor path without the prefix: `grep -nE '[`"](PROJECT|FEATURES|SECURITY|VERIFICATION|MIGRATION|HANDOFF)\.md#'`.
- **E (negative)** the exact legacy phrases `stable repo-root`, `at the repo root`, `Check the repo root`, `from repo root`.
- **F (negative)** the old marker text `<!-- dev-team-schema:` anywhere except a line containing `legacy`.

**Bats tests:** (i) passes on the clean repo, output contains `LEDGER-PATHS OK`; (ii) inject `skills/dev-team-orchestrator/references/.tmp-ledger-audit.md` containing "The documentarian writes `PROJECT.md` at the repo root", expect exit 1 and output containing `LEDGER-PATHS FAIL`, remove it immediately and again in `teardown()` (the same belt-and-braces as the model-id test); (iii) inject a file containing `` `SECURITY.md#Findings` `` → exit 1.

**Check:** the script fails on the tree *before* WP4–WP8 and passes after — that is exactly the point. Note for the builder: commits between WP3 and WP8 will fail this check; that is expected on a working branch with one PR at the end.

### WP4 — orchestrator reference files

- `references/documentarian-protocol.md`: line 3 "owns `.dev-team/PROJECT.md`"; line 7 new marker sentence; line 11 "maintains this file at `.dev-team/PROJECT.md`" + the identical rule sentence; line 15 of the template → `<!-- dev-team: ledger=project schema=1.0 -->`; brief (line 95) "Edit only `.dev-team/PROJECT.md`"; add to the brief's Constraints: "Before writing, read the target and apply the ownership rule; after writing, re-read line 2 and confirm the marker — report a missing marker as a failed write."; line 105 "create `.dev-team/PROJECT.md` (creating the folder, its `.gitignore` and `README.md` if absent)"; line 109 remove "at a stable repo-root path" → "at `.dev-team/HANDOFF.md`".
- `references/handoff-template.md`: lines 3–8 path → `.dev-team/HANDOFF.md`, delete "repo-root path"; add "A project's own top-level `HANDOFF.md` is never touched"; template line 24: add marker as the second line of the card: `<!-- dev-team: ledger=handoff schema=1.0 -->` (the card stays ≤ ~40 lines); line 34 Artifacts → `Artifacts (all in .dev-team/): PROJECT.md · FEATURES.md · SECURITY.md · VERIFICATION.md + verdict.json · MIGRATION.md · autopilot.json (those present)` — this also fixes the omission of `MIGRATION.md`/`verdict.json` the analysis noticed.
- `references/config-and-toggles.md`: line 60 comment "regenerate .dev-team/HANDOFF.md"; line 104 likewise; line 145–146: `/dev-team-config init` also scaffolds `.dev-team/.gitignore` and `.dev-team/README.md` when absent (point 7 of WP1).
- `references/issue-sync-protocol.md`: table lines 32–37 → `.dev-team/` paths; line 102 "Read the ledgers present, using the lookup order in conventions.md"; the marker `<!-- dev-team:<id> -->` (no space, no `ledger=`) is unchanged — add one sentence saying it is unrelated to the ownership marker.
- `references/model-routing.md:20`, `references/run-report.md:19,42`, `references/task-brief-template.md:20`, `references/debate-protocol.md:50`: first mention in each file becomes the `.dev-team/` path.
- `SKILL.md` (orchestrator): line 20 and line 32 → "writes this into `.dev-team/PROJECT.md`" + the identical rule sentence; line 34 cold-resume "found through the lookup order"; line 108 `.dev-team/HANDOFF.md`; add the "offer the pointer sentence" step to the project-start list (point 8 of WP1); line 195 unchanged.

**Check:** `audit-ledger-paths.sh` checks A, B (for `documentarian-protocol.md`, `handoff-template.md`), C, D, E, F pass for these files.

### WP5 — the per-skill schema files (each defines a ledger's structure)

- `skills/dev-team-featurefind/references/gap-scoring-rubric.md`: line 52 → "The documentarian writes this at `.dev-team/FEATURES.md`" + the identical rule sentence; add `<!-- dev-team: ledger=features schema=1.0 -->` as line 2 of the block at 54–78; line 80 `.dev-team/PROJECT.md`.
- `skills/dev-team-security/references/threat-model-and-surface-protocol.md`: lines 3 and 117 → `.dev-team/SECURITY.md`; add a "SECURITY.md structure" block (title `# Security Findings Register — <project>`, then the marker line, then the five section headings already listed at 119–123 as `##` headings) — today no fixed layout exists, which is why CueRCode's and Go2My.Link's files differ; add point 6 of WP1 verbatim (the three GitHub locations are refused).
- `skills/dev-team-security/references/red-team-protocol.md:139` and `remediation-and-verify-protocol.md:84`: first mention → `.dev-team/SECURITY.md`.
- `skills/dev-team-review/references/verdict-and-report-protocol.md`: line 3, 19, 79 → `.dev-team/VERIFICATION.md`; template line 22 gets the marker as line 2; line 23 "Verified against: .dev-team/PROJECT.md [+ .dev-team/SECURITY.md]"; line 62 "emit `.dev-team/verdict.json`"; JSON example gains `"dev-team": "ledger=verdict schema=1.0"` as its first field and a pointer to `schemas/verdict.schema.json` (WP9); line 87 anchors → `.dev-team/SECURITY.md#Findings`; add the identical rule sentence.
- `skills/dev-team-review/references/claim-extraction-and-verification-protocol.md`: lines 3, 7, 27 first mentions → `.dev-team/` paths.
- `skills/dev-team-migrate/references/migration-plan-protocol.md`: line 5, 11, 17 → `.dev-team/MIGRATION.md`; line 119 "writes (or updates) this file at `.dev-team/MIGRATION.md`" + the identical rule sentence; line 126 → `<!-- dev-team: ledger=migration schema=1.0 -->`.
- `skills/dev-team-migrate/references/characterization-and-cutover-protocol.md:116,153`: first mention → `.dev-team/MIGRATION.md`.
- `skills/dev-team-iterate/references/audit-and-backlog-protocol.md`: line 9 "Look for `.dev-team/PROJECT.md` (then the legacy root `PROJECT.md`, per the lookup order — a marker-less one is asked about, never read as the ledger)"; line 100 `.dev-team/PROJECT.md`.
- `skills/dev-team-iterate/references/ux-rubric.md:13`, `skills/dev-team-stripe/references/build-and-review-protocol.md:9,41,46,47` (`SECURITY.md#Findings` → `.dev-team/SECURITY.md#Findings`), `skills/dev-team-ship/references/{ci-setup,release}-protocol.md`, `skills/dev-team-docs/references/doc-standards.md:118`: first mention per file.

**Check:** audit check B passes for all six schema files; a reviewer opens each template block and confirms line 2 is the marker.

### WP6 — SKILL.md files, agents, autopilot references

- `agents/sonnet-scribe.md`: line 3 and 7 — paths under `.dev-team/`, delete "kept at a stable repo-root path", add the identical rule sentence and the self-check ("after writing, re-read line 2").
- `skills/dev-team-autopilot/SKILL.md`: lines 43, 51, 85, 118–120, 134 → `.dev-team/` paths, delete "stable repo-root".
- `skills/dev-team-autopilot/references/loop-runtime.md`: line 7 `.dev-team/PROJECT.md`; JSON example lines 27, 29, 49 → `".dev-team/PROJECT.md#Backlog"`, `".dev-team/FEATURES.md"`, `".dev-team/SECURITY.md#Findings"`, `".dev-team/PROJECT.md#spec-G-001"`, `".dev-team/PROJECT.md#Trajectory-ledger"`; add after line 57: "`queue`, `spec_ref` and `trajectory_ref` written before v1.5.0 hold bare names (`PROJECT.md#Backlog`); a reader accepts both forms, resolves a bare name through the lookup order, and RECORD rewrites them to the `.dev-team/` form — schema stays 1.0 because only values change."; line 85, 115, 127 → paths, delete "repo root"; add to REHYDRATE: a legacy top-level ledger without a marker → `state: BLOCKED`, reason `ledger-ownership`.
- `skills/dev-team-autopilot/references/mission-and-done.md`: lines 10, 18, 31, 33, 49 first mentions; bootstrap step 5 gains "create `.dev-team/` with its `.gitignore` and `README.md` if absent, and offer the pointer sentence (point 8)".
- `skills/dev-team-autopilot/references/modes-and-gates.md`: lines 13, 15, 23, 27, 30 first mentions.
- `skills/dev-team-security/SKILL.md`: lines 36, 58, 63, 114, 138 → `.dev-team/SECURITY.md`; add under "Authorization & safety": point 6 of WP1 verbatim.
- `skills/dev-team-featurefind/SKILL.md`: lines 3 (description: "ledger (.dev-team/FEATURES.md)"), 27, 40, 97, 101, 109, 130, 136.
- `skills/dev-team-review/SKILL.md`: line 49 → "Locate `.dev-team/PROJECT.md` (and `.dev-team/SECURITY.md`) through the lookup order"; line 116 add "— the two file-name values select the ledgers at their `.dev-team/` paths"; lines 29, 35, 42, 90, 97, 108, 129 first mentions.
- `skills/dev-team-iterate/SKILL.md:20,25,41`, `skills/dev-team-migrate/SKILL.md:85,101,107`, `skills/dev-team-stripe/SKILL.md:3,45,84`, `skills/dev-team-ship/SKILL.md:77`, `skills/dev-team-ci-medic/SKILL.md:49`: first mention per file; where a file says "if the repo already keeps a `PROJECT.md`" rewrite as "if `.dev-team/PROJECT.md` exists" — the old wording is ambiguous because a project may have its own top-level `PROJECT.md`.
- `skills/dev-team-docs/SKILL.md`: lines 69, 92, 138, 205 first mentions; **add** to its scope rules: "`.dev-team/` is the dev-team plugin's own folder — never treat its contents as project documentation to generate, maintain or audit."

**Check:** `audit-ledger-paths.sh` passes across `skills/` and `agents/`; `bash scripts/audit-model-ids.sh` still passes.

### WP7 — commands (four edits, one new command)

- `commands/dev-team-status.md`: lines 6–7 list the `.dev-team/` paths; add "also list any top-level file with a ledger name and say whether it carries the dev-team marker (legacy, not yet moved) or not (the project's own — left alone)".
- `commands/dev-team-sync-issues.md`: line 9 → `.dev-team/` paths via the lookup order; line 23 `.dev-team/SECURITY.md`.
- `commands/dev-team-report.md`: lines 13, 23 → `.dev-team/PROJECT.md` (lookup order).
- `commands/dev-team-config.md`: `init` step 2 also creates `.dev-team/.gitignore` and `.dev-team/README.md` when absent (never overwrites either) and tells the user.
- `commands/dev-team-approve.md:8`: `.dev-team/PROJECT.md`.
- **New `commands/dev-team-move-ledgers.md`** (frontmatter `description:` + `argument-hint: [--apply]`). Behaviour, read-only unless `--apply`:
  1. Refuse to run with `--apply` on a dirty working tree or outside a git repo (say why).
  2. For each of the seven names at the top level, classify: **(a)** marker present (either form) → "ours — will move"; **(b)** no marker but the file's shape matches the plugin's own ledger (`PROJECT.md`: at least three of `## Goal`, `## Definition of done`, `## Current status`, `## Decision log`, `## Backlog`; `FEATURES.md`: `FG-0` ids or `## In-scope gaps`; `SECURITY.md`: a `## Findings` heading or `| F-0` table rows or `## Coverage ledger`; `VERIFICATION.md`: `OVERALL VERDICT` or `| V-0`; `MIGRATION.md`: `## Stage Ledger`; `HANDOFF.md`: a line starting `NEXT:`; `verdict.json`: top-level `overall` and `claims` keys) **and** its first heading is not `# Security Policy` → "looks like ours — ask"; **(c)** anything else → "not ours — leave alone"; **(d)** a file in (c) that *also* contains three or more lines with dev-team ids (`\b(FG|F|B|G|V|I|M)-[0-9]{3}\b`) → "mixed — probably has dev-team content appended from line N; this needs a person to cut it by hand; nothing will be touched". The heuristics are best-effort; the command only sorts, the user decides.
  3. Print the table. Without `--apply`, stop. With `--apply`: move every (a); for each (b) ask the two-choice question (yes → move; no → leave); `git mv` each moved file into `.dev-team/`, write/replace the marker on line 2 (JSON: add the field), create `.dev-team/.gitignore` and `README.md` if absent, `git add` the folder, and make **one commit** "dev-team: move ledgers into .dev-team/ (v1.5.0)" on the current branch. Never push. If a `.dev-team/<name>` already exists for a file being moved, do not move it — report the conflict and leave both.
  4. Also rewrite bare `queue`/`spec_ref`/`trajectory_ref` values in `.dev-team/autopilot.json` to the `.dev-team/` form as part of the same commit (only values change).
- `commands/dev-team.md`: add the new command to the "Also:" line. `README.md` Commands table: add a row (required by `audit-model-ids.sh` check 5).

**Check:** `bash tests/smoke-structure.sh` (frontmatter); `bash scripts/audit-model-ids.sh` (README coverage); a reviewer walks the SIGNula.id, CueRCode, Go2My.Link, CloudMapped, iHymns and WebMS-Intra cases through the classification table by hand and confirms: SIGNula.id `SECURITY.md` → (d) untouched; CueRCode five files → (b) ask; Go2My.Link `HANDOFF.md` (no `NEXT:` line — verify at build time; if it has one, it still falls to "ask", never "move") ; CloudMapped `PROJECT.md` → (a); CloudMapped/iHymns/phpDomainCheckr `SECURITY.md` → (c); WebMS-Intra `FEATURES.md` → (c).

### WP8 — README, CONTRIBUTING, tests/README, CHANGELOG, manifests, this repo's handover

- `README.md`: line 7 intro (add "New in 1.5.0: every dev-team file now lives in `.dev-team/` …"); Artifacts lines 122, 143, 166, 187, 191, 206, 208, 229, 249, 274, 293, 314, 337 → first mention per skill section as `.dev-team/<name>`; 418, 446, 490, 507, 509 (delete "repo-root path"), 549, 597, 608–614; Artifacts glossary 520–526 (paths, marker column, remove "repo-root path", add the `README.md`/`.gitignore` row); Cross-cutting behaviors: add a bullet "Where the plugin writes, and the ownership rule" summarising WP1 points 1, 4, 5, 8 in plain English with the link; Hooks table 539: add `guard-ledgers.sh` row; Commands: `/dev-team-move-ledgers`; Repo self-audit: `audit-ledger-paths.sh`; a short "Upgrading from 1.4 or earlier" paragraph (run `/dev-team-move-ledgers`, what happens to a file the plugin cannot claim).
- `README.md:507`: also fix the contradiction the analysis found — featurefind *does* re-read `.dev-team/FEATURES.md` on a later run (`featurefind/SKILL.md:101`), so remove it from the "no cold-resume mechanic" list.
- `CONTRIBUTING.md`: lines 14–16 (second hook), 19 (new script), 91–105 (add `bash scripts/audit-ledger-paths.sh`), 114–116 (paths).
- `tests/README.md`: new hook matrix, new audit script tests, schema validation test and how to install `check-jsonschema` locally.
- `.claude-plugin/plugin.json`: `"version": "1.5.0"`. `marketplace.json`: no version field, description unchanged — nothing to do.
- `CHANGELOG.md`: the entry in section 4.
- `.claude/HANDOFF.md` (this repo): update after **every** package, not only here — what is done, what the audit script currently reports, what was tried and rejected.

**Check:** all four local checks green: `bash scripts/audit-model-ids.sh`, `bash scripts/audit-ledger-paths.sh`, `bash tests/smoke-structure.sh`, `bats tests/scripts.bats`, plus `shellcheck scripts/*.sh hooks/*.sh tests/*.sh`.

### WP9 — a schema for `verdict.json` (because WP5 changes that file's format)

**Files:** new `schemas/verdict.schema.json`; new `tests/fixtures/verdict.sample.json`; `tests/scripts.bats`; `tests/smoke-structure.sh` (check 8: every `schemas/*.schema.json` is valid JSON and has `$schema`, `title`, `description`); `.github/workflows/plugin-audit.yml` (`test` job: `pip install check-jsonschema`); `README.md` Artifacts glossary row for `verdict.json` links the schema.

Schema content: draft 2020-12; `title`, `description`; every property with a `description` (why it exists, who reads it); `required`: `dev-team`, `overall`, `checked`, `verified`, `failed`, `drifted`, `hollow`, `unverifiable`, `integration`, `claims`; `overall` enum `PASS | PASS_WITH_GAPS | FAIL`; `integration` enum `pass | fail`; counts are non-negative integers; `regressions` array of strings matching `^V-[0-9]{3,}$`; `claims[]` items require `id`, `verdict` (enum of the five verdict words), `severity` (enum `critical|high|medium|low|n/a`), `confidence` (enum `high|medium|low`); `dev-team` is `const "ledger=verdict schema=1.0"`; `additionalProperties: false` at the top level so a renamed field fails loudly (state that reason in `$comment`).

Bats: (i) the fixture validates; (ii) a copy with `overall: "MAYBE"` fails; both `skip "check-jsonschema not installed"` when the tool is absent locally (CI always has it). **Follow-up, not in scope:** `autopilot.json` has no schema either (pre-existing gap; its documented example contains `//` comments so it cannot be validated as-is) — record in the CHANGELOG "Known gaps" line and in `.claude/HANDOFF.md`.

### Closing step — review and hand-back

Run the five checks; open **one** PR to `alpha` later per this repo's rules; run `codex review --base main "Check every ledger path change against conventions.md's 'Where the plugin writes' section; look for any file that still tells a skill to write at the top level, any place the ownership rule is contradicted, and hook edge cases (absolute paths, MultiEdit, missing jq)."`; fix and re-review until clean; record in the commit message if Codex could not run.

---

## 3. Tests to add or change — the concrete assertions

1. **`tests/scripts.bats` — `guard-ledgers.sh`:** the fifteen cases in WP2, each asserting the exit status (0 or 2) and, for denials, that `$output` contains `dev-team guard`.
2. **`tests/scripts.bats` — `audit-ledger-paths.sh`:** (i) clean repo → exit 0, output contains `LEDGER-PATHS OK`; (ii) an injected file saying "writes `PROJECT.md` at the repo root" → exit 1, output contains `LEDGER-PATHS FAIL`; (iii) an injected file containing `` `SECURITY.md#Findings` `` → exit 1; each cleans up immediately and in `teardown()`. *This is the test that fails if any tracked file still tells a skill to write a ledger at the old top-level path without the "legacy root" wording.*
3. **`tests/scripts.bats` — existing guard tests:** unchanged (they must still pass; `guard-dev-team.sh` is not edited).
4. **`tests/scripts.bats` — schema:** the fixture validates; a deliberately broken copy does not; skipped (not failed) when `check-jsonschema` is absent.
5. **`tests/smoke-structure.sh`:** check 7 — `scripts/audit-ledger-paths.sh` exists and is executable; check 8 — each `schemas/*.schema.json` is valid JSON with `$schema`, `title`, `description`; check 4 (existing) now also covers `guard-ledgers.sh` automatically because it is referenced from `hooks.json`; add an explicit assertion that `hooks.json` has a `PreToolUse` matcher containing `Write`.
6. **`scripts/audit-ledger-paths.sh` itself** is a test: checks A–F in WP3, run in the CI `audit` job.
7. **Manual check, recorded in `.claude/HANDOFF.md` and the PR:** with the plugin installed in a scratch repo containing `.dev-team/autopilot.json`, ask Claude Code (via a subagent) to write `FEATURES.md` at the top level and confirm the hook denies it — this verifies the one thing bats cannot: that `PreToolUse` fires for a subagent's `Write`.

---

## 4. CHANGELOG entry and version

Version: **1.5.0**. Reason: the change alters where files appear (a user notices it), so it is more than a patch; but nothing that used to work stops working — old files are found through the lookup order, formats are additive (`1.x`), and nothing is renamed — so it is not a breaking change. `1.4.0` is already merged to `main` and may be installed, so it gets its own section rather than being folded into 1.4.0.

```
## [1.5.0] - <unreleased>

### Changed

- **All dev-team files now live in `.dev-team/`.** `PROJECT.md`, `FEATURES.md`, `SECURITY.md`,
  `VERIFICATION.md` + `verdict.json`, `MIGRATION.md` and `HANDOFF.md` are written to
  `.dev-team/<name>` instead of the top level of the project. Names are unchanged; the folder is
  what keeps them apart from the project's own files. Why: real projects keep their own files with
  these names — a product feature list, GitHub's public security policy (`SECURITY.md`, which GitHub
  reads from `.github/`, the top level or `docs/`, never from `.dev-team/`), a hand-written handover —
  and before this release the suite overwrote or appended to them without checking. Rejected: renaming
  (fixes one clash, not the next), a top-level prefix (still clutters the project), a configurable
  location (the user finds out after the damage). Full rule: `conventions.md`, "Where the plugin
  writes, and the ownership rule".
- **The ownership rule.** Every file the suite writes carries a marker (`<!-- dev-team: ledger=<kind>
  schema=1.0 -->` on line 2; `"dev-team": "ledger=verdict schema=1.0"` in `verdict.json`). Before
  writing, a skill reads the target: no marker means "not known to be ours" and the run stops and
  asks rather than guessing; an unattended autopilot cycle goes `BLOCKED` (reason `ledger-ownership`).
  The security skill never writes `SECURITY.md` at the top level, in `.github/` or in `docs/`.
- **Existing installs keep working.** Readers look in `.dev-team/` first, then at the old top-level
  path; a top-level file with a marker is moved automatically and committed on its own; one without a
  marker is asked about. `autopilot.json` references such as `PROJECT.md#Backlog` are accepted in
  both forms and rewritten at the next RECORD.
- `HANDOFF.md` moves too. No AI coding tool reads a top-level `HANDOFF.md` automatically, so the old
  location never bought discovery; instead the suite offers (never applies silently) one pointer
  sentence in the project's existing `CLAUDE.md` / `.claude/CLAUDE.md` / `AGENTS.md` / `GEMINI.md`.
- The old `<!-- dev-team-schema: 1.0 -->` marker is still accepted when reading (legacy form).

### Added

- `/dev-team-move-ledgers` — dry-run by default, `--apply` to act: sorts the top-level files into
  "ours — move", "looks like ours — ask", "not ours — leave", and "mixed — needs a person", then moves
  and stamps the agreed files in one commit. It refuses to cut a mixed file.
- `hooks/guard-ledgers.sh` (PreToolUse on Write/Edit/MultiEdit): denies writing marker-bearing content
  outside `.dev-team/` (always, unless `guard: off`), and during an active run denies any write to a
  top-level file with a ledger name. Best-effort, fail-open, never the guarantee — it cannot see a
  `cat >>` through Bash.
- `scripts/audit-ledger-paths.sh` (CI `audit` job): fails if any skill, command, agent or README line
  still points a writer at the old top-level location.
- `.dev-team/.gitignore` (`loop.lock/`) and `.dev-team/README.md` are created once, if absent, on the
  first write into the folder; a warning is reported if the project's `.gitignore` would swallow the
  folder.
- `schemas/verdict.schema.json` with a fixture and a CI validation step.

### Known gaps (follow-ups, not in this release)

- `autopilot.json` still has no schema file. Security findings and proof-of-concept details committed
  under `.dev-team/SECURITY.md` are still in the repository, so "findings stay private" does not hold
  for a public repo — separate decision needed. `.dev-team/specs/` (used by hand in one project) is not
  a documented convention.
```

---

## 5. Who does what

| Package | Tier | Why |
|---|---|---|
| WP1 conventions.md | **Opus** | It is the canonical wording every other file copies; the plain-English explanation of why, and what was rejected, needs judgement. |
| WP2 hook + tests | Sonnet | Fully specified above; shell edge cases are covered by the test matrix. Reviewer checks path normalisation. |
| WP3 audit script + tests | Sonnet | Same pattern as `audit-model-ids.sh`; checks are enumerated. |
| WP4, WP5, WP6 doc edits | Sonnet (Haiku is fine for WP6's first-mention rewrites) | Mechanical, line-numbered above; the audit script is the gate. |
| WP7 commands | **Opus for `dev-team-move-ledgers`**, Sonnet for the four edits | The classification heuristics and the "refuse when mixed" behaviour need judgement and a walk through the six real repos. |
| WP8 README/CHANGELOG/manifests | Sonnet | Mechanical plus the CHANGELOG text above. |
| WP9 schema | Sonnet | Specified field by field. |
| Closing review | Codex (per this repo's rules) | Independent reviewer. |

---

## 6. Risks, and what a reviewer should look for

1. **A stale reference survives** and a scribe writes at the old path. Reviewer: run `scripts/audit-ledger-paths.sh` and *also* grep by eye for `"PROJECT.md#`, `` `PROJECT.md#``, "repo root" — the audit's checks are enumerated, so anything outside them is the reviewer's job.
2. **Hook false positives.** Rule 1 is on outside runs. Reviewer: confirm the "first three lines" test is implemented on `content` for `Write` only, and that the plugin's own reference files (which quote the marker inside code blocks) are not affected; confirm `guard: off` disables both rules.
3. **Hook path handling.** Absolute vs relative `file_path`, `./` prefixes, a working directory that is a subfolder. Reviewer: read the normalisation and the tests 2 and 3.
4. **Unverified assumption:** the hook input field names (`tool_input.file_path`, `content`, `new_string`, `edits[]`) and whether `PreToolUse` fires for a subagent's `Write`. Both must be checked by hand once (test 7 in section 3) and the result written into `.claude/HANDOFF.md`. If hooks do not fire for subagents, the hook still protects the lead's own writes, and the written rule plus the scribe self-check carry the rest — say so in the README.
5. **`/dev-team-move-ledgers` moves something it should not.** Reviewer: the only automatic move is a marker-bearing file; everything else asks or refuses. Walk SIGNula.id's `SECURITY.md` through it: first heading `# Security Policy` → (c), then the id-density rule → (d), untouched.
6. **The lookup order silently reads a project's file.** Reviewer: every "look for `PROJECT.md`" sentence in WP4–WP6 must say "through the lookup order" or point at conventions.md, and conventions.md must say "never read a marker-less top-level file as the ledger".
7. **Dry-run interaction.** A legacy marker-bearing file under `dry-run=on` must not be moved. Reviewer: WP1 point 5 says so; check loop-runtime and orchestrator SKILL do not contradict it.
8. **A project's `.gitignore` swallows `.dev-team/`** — a quiet failure by design of git. Reviewer: the `git check-ignore` warning is in conventions.md point 7 and reaches the run report.
9. **`HANDOFF.md` card length.** Adding the marker as line 2 keeps it within ~40 lines; reviewer confirms the template.
10. **Contradiction between conventions.md and a sibling** is a bug by this repo's rules. Reviewer: compare the three copies of the identical rule sentence byte for byte (`git grep -c "carries the dev-team marker on line 2"` should equal the number of files that state it).

---

## 7. Questions that genuinely need the owner (with suggested defaults)

1. **Move `HANDOFF.md` into `.dev-team/` as well, with a pointer sentence offered in the project's existing instruction file?** Suggested: **yes** — the evidence shows the top-level path never gave automatic discovery, and two of your repos already have a hand-written top-level `HANDOFF.md` the plugin would otherwise overwrite.
2. **Version 1.5.0 rather than 2.0.0?** Suggested: **1.5.0** — nothing stops working and no format breaks; the CHANGELOG entry is loud enough.
3. **Should `hooks/guard-ledgers.sh` Rule 1 (marker content outside `.dev-team/`) stay on outside an active run?** Suggested: **yes** — it can only block plugin-generated content, and standalone runs are where a stale instruction would otherwise do the damage. (Rule 2 stays limited to active runs, exactly like today's Bash guard.)

Outside the plugin, and not for the builder: SIGNula.id's `SECURITY.md` needs a person to cut lines 144 onward into `.dev-team/SECURITY.md`; the command will point at the line and refuse to do it.

Key files (absolute): `/Users/lance.manasse/Projects/Coding & Development/MWBM Partners Ltd/GitHub/dev-team-plugin/skills/dev-team-orchestrator/references/conventions.md` (WP1); `.../hooks/guard-ledgers.sh` and `.../hooks/hooks.json` (WP2); `.../scripts/audit-ledger-paths.sh` (WP3); `.../commands/dev-team-move-ledgers.md` (WP7); `.../schemas/verdict.schema.json` (WP9); `.../tests/scripts.bats`, `.../tests/smoke-structure.sh`, `.../.github/workflows/plugin-audit.yml`; `.../CHANGELOG.md`, `.../.claude-plugin/plugin.json`; `.../.claude/HANDOFF.md` (update after every package).
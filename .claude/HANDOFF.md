# Handover — dev-team-plugin

<!--
  File:     .claude/HANDOFF.md
  Purpose:  Lets an interrupted session, or a different AI assistant, pick up this work cold.
            Rewritten as work happens, not tidied at the end. See .claude/CLAUDE.md section 2.
-->

**Last updated:** 17 November 2026 — the three open lines of work (#41, #47 and the polish skill) were
merged into `main` on 9 November. The section straight below ("Current state") is the one to trust; the
sections after it (the #47 notes, "START HERE", "Detailed history") are the older record and say, in
places, that things are still waiting that are now done. Where they disagree, this section wins.
**Working branch:** none in flight. The branch `claude/ledger-file-clashes` and the others named in the
older sections are **deleted** (see below). Start the next piece of work from `alpha`.
**Issues:** [#41](https://github.com/MWBMPartners/dev-team-plugin/issues/41),
[#47](https://github.com/MWBMPartners/dev-team-plugin/issues/47) (both still open on GitHub — see
"Housekeeping"), [#48](https://github.com/MWBMPartners/dev-team-plugin/issues/48),
[#46](https://github.com/MWBMPartners/dev-team-plugin/issues/46),
[#45](https://github.com/MWBMPartners/dev-team-plugin/issues/45).

## Current state — 17 November 2026

### Progress later on 17 November (work branch `claude/busy-knuth-bc35ok`)

Owner chose the order: Group A, Group F, then B, C, D, E (groups are named in the task list the
session gave the owner; see below).

| Group | Task | State |
| --- | --- | --- |
| A | #44 guard keys on `.dev-team/loop.lock/` | **Done**, commit `ae2b909` |
| A | #48 "both guards fail open" wording | **Done**, commit `ae2b909` |
| A | #42 security findings out of git by default (`features.commit-security`, default off) | **Done**, commit `158f4bc` |
| F | Comments on #41, #47, #42, #44, #48 | **Done** |
| F | Clean Codex review of all of `main` | **Blocked: Codex is not installed in this cloud session.** Rule 5 says say so plainly; all work since 9 Nov is **not fully reviewed**. Redo by hand: see `codex-review-prompt-5.md` |
| B, C, D, E | Model settings, project documents, preset and editor research, the engine | Not started |

Checks run at `158f4bc`: both audits, smoke test, shellcheck, bats 211 of 211. To run bats here:
`npm install -g bats` and `pip install shellcheck-py`, then `TMPDIR=<writable folder> bats tests/scripts.bats`.

**Owner's answers to Q6–Q9 (17 Nov, recorded; not yet built):**

| Q | Answer | What it means |
| --- | --- | --- |
| Q6 editors | VS Code and Cursor, Visual Studio, Xcode, JetBrains — **all four, in that order** | The editor research covers all four; start with VS Code and Cursor |
| Q7 route order | **Local first, cloud for hard work or when local is not available.** The plugin also asks once per project and remembers the answer; if never asked (already-running projects), ask the first time. Also create **two profiles**: cloud-first and local-first. A user can also set their **own default per dev device** (a device with local models can default to local first) | A built-in default of local first; a per-project remembered answer; two named profiles; a per-device user setting that sits between the user's general setting and the project's. The addendum's suggested "cloud first" was **not** taken |
| Q8 ask-first models | **Not decided.** First research which high-quality, expensive models other platforms offer (ChatGPT/Codex, Kimi, Gemini, DeepSeek and the like) and let the owner choose from the list. Local models are never on it (free) | **To do (research):** build that list with current prices, then ask the owner. Until answered, no model is on the list by default |
| Q9 Copilot | Reviewer first, worker later | As recommended |

### Added later on 17 November — owner's new requirements (work branch `claude/busy-knuth-bc35ok`)

- The owner asked for: model-per-job delegation, many AI systems (adding Copilot, DeepSeek, Ollama),
  local-first or cloud-first with a smooth switch, editor support, per-session and per-repository
  settings, models that need explicit approval, exact version pinning, new models found without a
  plugin update, one shared set of project documents, tracker as source of truth, and Swagger UI for
  web projects with an API.
- **Done in this session:** standing rules 12–15 added to `.claude/CLAUDE.md` and `.OpenAI/AGENTS.md`
  (same text in both; rule 11 reworded so it covers this repository only). The new requirements and
  what the existing #46 plan already covers are in
  `.claude/plans/orchestrator-v2/owner-brief-addendum-2026-11-17.md`, with four new questions
  (Q6–Q9) that are **open**, each with a suggested answer.
- **Not done:** no plugin code changed. The addendum is not yet folded into `plan.md`.
- **Branch note:** this session's working branch is `claude/busy-knuth-bc35ok`, set by the cloud
  session. It is the single working branch for now (rule 6). The orchestrator work was to go on a
  fresh branch from `alpha` (Q2); this branch has the same starting point, so use it unless told otherwise.
- **Next:** see the task list the session gave the owner; the first group is #44 + #48 + the
  `deep-architect` change.

### What happened on 9 November

| Step | Result |
| --- | --- |
| Compared three unmerged branches by reading the real code, not commit titles | `feature/bcp47-language-policy` (112 commits) already contained all of `claude/ledger-file-clashes` (66 commits), so the ledger branch needed no separate step. `claude/gifted-wright-y3ze25` (2 commits, the polish skill) was independent. |
| Merged them into one new branch and opened **one** pull request, [#49](https://github.com/MWBMPartners/dev-team-plugin/pull/49), straight to `main` | Merged as `00e0b67`. Five files conflicted when the polish branch went in; all were resolved by keeping both sides. |
| Version numbers | The polish skill had been numbered 1.5.0 on its own branch, which clashed with 1.5.0 (ledger) and 1.6.0 (language policy). It is now **1.7.0**, and `plugin.json` says 1.7.0. |
| Checks | On the pull request and again on `main` after the merge: `plugin-audit` (audit and test) and `Lint Workflows` all passed. Run by hand beforehand: both audits, smoke test, shellcheck, and bats 207 of 207. |
| Branches | `alpha` and `beta` were moved forward to the same commit as `main` (`00e0b67`). They had nothing of their own, so nothing was lost. The three old branches and the working branch were then deleted by the owner (this session's connection to GitHub is not allowed to delete branches). |

**Merging straight to `main` was a one-off**, at the owner's request. The standing rule is unchanged
(`.claude/CLAUDE.md` rule 6, and the owner confirmed it on 9 November): future work goes on **one
working branch, merged into `alpha` by one pull request**, opened when the owner says.

### The red checks on `main` — what is known

- Since the `actions/checkout` update in [#40](https://github.com/MWBMPartners/dev-team-plugin/pull/40)
  (23 September), all three checks on `main` failed within about two seconds. The jobs never got a
  machine to run on (no steps ran), and GitHub had already discarded the logs, so **the real cause was
  never seen**.
- The same checkout version passed on the pull request and on `main` on 9 November, so it is **not**
  a fault in that version. Most likely a temporary GitHub problem on 23 September. This is an
  inference, not something checked.

### Still true: the review debt

- **Never cleared:** a clean Codex review. The older sections record that #41's fix rounds 3 to 5 and
  #47's sixth round had **not** had a clean Codex pass when this work was last touched in early
  October, and nothing in the repository or on GitHub shows one happened afterwards. The 9 November
  merge did not add a review: it combined work and ran the automatic checks. Under rule 5 this work
  therefore still counts as **not fully reviewed**.
- **What to do:** when the Codex allowance is available, run it over the whole of what is now on
  `main` (the brief and exact command are in
  `.claude/plans/ledger-file-clashes/codex-review-prompt-5.md`), fix every confirmed finding on a new
  working branch, and repeat until a round finds nothing. If Codex cannot run, use a fresh, independent
  Claude reviewer and say so plainly.
- **Not reviewed at all:** the polish skill (`dev-team-polish`, its command and the SessionStart
  reminder). It was written on its own branch and no cross-system review is recorded for it.

### Housekeeping to do next

1. **Issues #41 and #47 are still open** and still say their work is "on branch
   `claude/ledger-file-clashes`" / "`feature/bcp47-language-policy`". Add a comment to each saying it
   merged in #49 on 9 November (as 1.5.0 and 1.6.0 respectively), and that the review debt above
   remains. Do not close them until the review is clean — the owner's call.
2. **Documents still name deleted branches.** `.claude/CONTEXT.md` and `.claude/MEMORY.md` were updated on 17 November.
   `.OpenAI/CONTEXT.md` has a dated note. The issue texts for #41, #45, #46 and #47 still name
   `claude/ledger-file-clashes`; the older sections of this file do too, on purpose (history).
3. **Issue [#48](https://github.com/MWBMPartners/dev-team-plugin/issues/48)** (the conventions text
   says both guard hooks fail open, which is no longer true of the Bash guard) is a small
   wording-only fix, ready to do.
4. **Tidy the record:** the 14 September to 5 October detail below is long. Once the review debt is
   cleared, fold it into a short summary.

### Owner decisions — answered 17 November 2026 (recorded only; none of this has been built yet)

| # | Question | Owner's answer | What it means for the next session |
| --- | --- | --- | --- |
| Q1 | Where `.dev-team/` lives when a session starts in a subfolder | **The subfolder** (as recommended) | Nothing to change in the skills. `/dev-team-move-ledgers` should also look in the subfolder — check it does. |
| Q2 | #46 D1–D4 (engine language, branch, unverified providers, hand-over after 12+ hours) | **Accept all as recommended** in `.claude/plans/orchestrator-v2/plan.md` | Node engine; a fresh branch from `alpha` (a stated exception to the one-branch rule, approved here); Gemini, Kimi and Grok documented but marked unverified; hand over after 12+ hours of outage. |
| Q3 | #45: built-in defaults or a preset | **A named preset** (`profile: standard`) | Built-in defaults stay cautious. Which features the preset contains is still open: the four sub-choices in issue #45 (F13 push after each task, F10 Codex replacing or adding to the Claude checker, F5 "one after another" scope, F7/F8 cheaper building default) have **not** been answered. |
| Q4 | `deep-architect` default model | **Change the default to Opus now** (not the recommended "leave it") | **To do:** change the default in `agents/deep-architect.md` and anything that describes it (model-routing reference, README, CHANGELOG, `.claude/` and `.OpenAI/` notes), then run the model-id audit and bats. This also needs a version/CHANGELOG entry. Do it on the new working branch, not before. |
| Q5 | Device-wide rules on the owner's computer | **Yes, ask a local session** | The wording is in `.claude/device-wide-rules.md`. It needs a session running on the owner's own computer, because a cloud session cannot reach `~/.claude/CLAUDE.md` or `~/.codex/AGENTS.md`. Not done; the owner runs it. |

The four #45 sub-choices were answered later the same day — see the next table. **No owner question
is open any more.**

### #45 sub-choices — answered 17 November 2026 (recorded only; none of this has been built yet)

These decide what goes in the `profile: standard` preset chosen in Q3. The feature map with the evidence
for each is `.claude/plans/owner-standard-features/feature-map.md` (and `feature-map-round-2.md`).

| Item | Question | Owner's answer | What it means for the next session |
| --- | --- | --- | --- |
| F13 | Push after each task | **A setting, off by default** | The plugin keeps never pushing on its own unless the setting is on. The `standard` preset turns it on. Needs a new setting in `config-and-toggles.md`, the steps in the skills that say "never push", the README, the CHANGELOG and tests. The guard's rule against pushing to `main` must still apply. |
| F10 | Codex replacing or adding to the Claude checker | **In addition, when available** | The Claude checker always runs. Codex adds an independent second review where it is installed and has allowance; if it cannot run, say so and treat the work as "not fully reviewed" (rule 5). |
| F5 | "One after another" scope | **Analysis and planning only; debates stay side by side** | Opus analysis and planning steps run in sequence, each building on or checking the last. Debates keep their side-by-side design so debaters cannot see each other's arguments. |
| F7/F8 | Cheaper building as default | **Part of the preset only** | The built-in default is unchanged. `profile: standard` picks Sonnet or Haiku for building, Opus only for complex changes. |

All of these belong with #45 and #46 on the new orchestrator branch (Q2); the preset itself is built
there, not now.

### Follow-up issues #42, #43, #44 — answered 17 November 2026 (recorded only; none of this has been built yet)

| Issue | Question | Owner's answer | What it means for the next session |
| --- | --- | --- | --- |
| #42 | Security findings committed under `.dev-team/` are public in a public repository. What should the default be? | **Keep them out of git by default; committing is an opt-in** | **To do:** the security skill writes `.dev-team/SECURITY.md` locally and keeps it out of git unless a project turns committing on (a new setting; add it to `config-and-toggles.md`, with the default "off"). Decide how it is kept out of git (for example by adding it to a `.gitignore` the plugin manages, or by warning) — not yet chosen. Update the security skill, its references, the README, the CHANGELOG and the tests. Check that existing projects that already commit the file are told, not surprised. |
| #43 | Add a schema for `.dev-team/autopilot.json` and make its documented example valid JSON | **Yes, but later, together with #46** | Do **not** build it now. Write the schema once, when the orchestrator work (#46) settles what the file contains, so it is not written twice. Until then the example in `skills/dev-team-autopilot/references/loop-runtime.md` stays as it is (it contains `//` comments and so cannot be validated). |
| #44 | What should "a run is in progress" mean for the Bash guard? | **The folder `.dev-team/loop.lock/` exists** | **To do:** change `hooks/guard-dev-team.sh` (line 21 checks `autopilot.json` today) to look for the lock folder instead; update its tests and the `guard` row in `config-and-toggles.md`. The lock folder exists only while a cycle runs and is never committed. Note the ledger guard's Rule 2 already uses this signal. Related: #48 (wording about which guard fails open) touches the same hook text, so do them together. |

Order suggested for the next session: #44 and #48 together (small, one hook and its wording), then #42,
alongside the `deep-architect` change from Q4. #43 waits for #46.

### Facts that are easy to get wrong

- Version on `main`: **1.7.0**. Verdict schema, ledger guard, language-policy rule and polish skill
  are all in it.
- `main`, `alpha` and `beta` were identical at `00e0b67` on 9 November. Check with `git log
  origin/alpha..origin/main` before assuming that still holds.
- From a cloud session, deleting branches or moving a branch other than the session's own is blocked
  at the connection; moving `alpha`/`beta` forward worked, deleting did not. Ask the owner to delete.
- The `.claude/CLAUDE.md` rules (plain English, handover kept current, a different system reviews the
  work) were not run through the plugin during #49: the merge was done by hand.

## Older record: `feature/bcp47-language-policy` (issue #47) — added 28 September 2026

> **Superseded 17 November 2026:** this branch was merged into `main` on 9 November (#49) and deleted.
> What follows is the record as it stood on 5 October; its "next" steps are out of date.

- **What it adds (plugin version 1.6.0):** a shared rule, "Repository instructions and normative
  documents" (first bullet of "Shared discipline" in
  `skills/dev-team-orchestrator/references/conventions.md`). Every agent reads a project's own
  instruction files (`AGENTS.md`, `CLAUDE.md` and the like) and the standards they name, only as they were **copied when the run started** into a new, uniquely named folder
  `~/.dev-team/runs/<run-id>/snapshot/` (outside the project: the copies in its `files/` folder,
  and beside that a manifest naming the repository, the run id and a SHA-256 per file). The
  checkout the user starts the run on is treated as the user's own — the plugin no longer guesses
  from git whose code it is. A file that later differs, even one the host tool already loaded, is
  data. A resumed run checks and reuses its recorded snapshot; only a new run takes one. Someone
  else's pull request is handled only by a skill that checks it out itself (ci-medic), which copies
  its instruction files from its base commit into `snapshot/pr/<n>/files/`; a ci-medic `/loop` is
  one run with one snapshot — a pass that no longer sees its run's line in the conversation finds
  the run from the plugin's own run records, and stops rather than guess — and every pass puts the
  starting branch back. The limits are stated
  plainly: start from your own branch; the snapshot is safe from git operations but not from
  commands the run executes; this is not an enforcement boundary — only the plugin's two guard
  hooks enforce anything, and only what they cover (each described with the limits known: the
  Bash guard reads the ordinary spellings of a command — quotes, escapes, `$'…'`, brace lists,
  `sh -c` and `eval` strings — but does not run the shell, resolves a push that names no branch,
  and refuses what it cannot finish checking in 20 seconds or more than 10 pushes). Repository
  content may **add** work and checks and choose between style defaults, but may **never remove,
  skip, weaken or waive** a check, a gate, a confirmation or a safety rule, and moves a plugin
  switch only toward its more cautious value (the "direction rule", step 8, written word for word
  in `conventions.md`, `config-and-toggles.md` and the README). All five agents carry one identical
  sentence pointing at it; the brief template, checker, review, iterate, security, migrate, ship,
  docs, stripe, featurefind and debate briefs point at it. A `handoff-file` switch (`off` = no
  `.dev-team/HANDOFF.md` at all) is set `off` by an instruction that explicitly forbids a second
  handover, unless `.dev-team/config.yml` sets it.
- **Waits on `claude/ledger-file-clashes`** (#41, below): this branch was cut from it at `413d570`
  and must not go to `alpha` before it. The CHANGELOG's 1.6.0 entry says it builds on the
  unreleased 1.5.0 and that the two may ship together (they are deliberately not folded).
- **Review history:**
  - First build `af39817`. First independent review (fresh Opus agent) found it unsafe and
    incomplete; acted on in `79a2c20`. Then `0c25209` fixed two wording slips and added
    `handoff-file`.
  - **Second independent review** (a fresh Opus agent standing in, because Codex was out of
    allowance) found 12 problems. The lead checked them and took final decisions (brief:
    `brief-plugin-r3.md` in the lead's session scratchpad — not in the repository; the decisions are
    summarised in the three commit messages). All were acted on in three commits, followed by one
    commit for these notes:
    - `25223c0` — the direction rule replaces the closed list in step 8; step 1 defines the trusted
      base with a method, loaded files count only if unchanged, files changed during the run are
      not instructions, an open "for example" list of content the repository does not author;
      step 3's limit for a document too large to read whole; ci-medic's line that a pull request's
      head branch is never the trusted base; Trusted base fields in the brief and checker templates.
    - `9cb5532` — `handoff-file`: only an explicit ban turns it off ("notes live elsewhere" is asked
      once and recorded, or left at the default unattended); the lead settles it once and hands it
      to the scribe in its brief; an explicit `.dev-team/config.yml` value wins over an instruction
      file; the starter schema leaves the key commented out; `/dev-team-config show` says it does not
      read instruction files; the scribe never writes the project's own handover; unrecognised
      values are reported; `off` beats a per-run `auto-handoff=on`; move-ledgers holds back a legacy
      `HANDOFF.md` while `off`.
    - `c5dfd68` — CHANGELOG and `tests/README.md` (the 25-edit proof table).
  - The lead re-ran all six checks and pushed up to `d98a02c` (154 of 154).
  - **The starter config file (`dbb5e31`, pushed by the lead).** The lead
    decided the suggestion below: `/dev-team-config init` now writes an explicit value only for a
    key the user chose in that `init` conversation; every other setting goes into the starter file
    commented out, showing its default, as `handoff-file` already was. The starter schema in
    `config-and-toggles.md` now sets nothing but `version: 1`; `show` tags a commented-out key
    `(built-in default)`. A new test (11) fails if the starter writes any setting out explicitly or
    `init` stops saying to write only chosen keys; 8 edits in a throwaway copy each made it fail.
  - **Third independent review** (a fresh Opus agent standing in for Codex) of `0c25209..dbb5e31`
    was NOT clean. Its core finding: the trusted-base method (merge-base, diff, show) missed
    uncommitted edits and new files, failed on shallow clones and unusual remote names, was
    defined differently by autopilot, and kept its base where agents could rewrite it. The lead
    took final decisions (16 items); all were built in five commits:
    - `bfb4e8a` — (its storage was replaced after Codex's review, below) the run-start SNAPSHOT
      replaces the trusted base everywhere (conventions.md step
      1): path + SHA-256 + a git object id (`git hash-object -w`) for every instruction file,
      normative document and `.dev-team/config.yml`, taken before any agent is spawned, in a sealed
      record only the lead writes (`instructions_snapshot` in autopilot.json; a
      `## Instruction snapshot` section of the skill's own ledger; the run report for ship and
      ci-medic), checked on every read. Changed or new files are data; untrusted pull-request code
      uses the base branch's version, never the checked-out text. Also: config.yml counts only as
      snapshotted (hooks cannot enforce this); user files outside the repository are the user's
      words; the snapshot field in all 13 brief templates; the run-start line in the eight skills
      with their own front end; step 3 for documents without rule IDs; step 6 never runs a command
      named only in a normative document; the branch model and per-run arguments added to the
      direction rule.
    - `af1138a` — `handoff-file` values (`off`/`false`/`no` and `on`/`true`/`yes`, any capitals;
      anything else counts as `off`); the scribe's ban names only the project's handover or
      session-notes file; the value goes in documentarian briefs only; the old-HANDOFF.md exception
      is also in conventions point 5 and the README's "Upgrading from 1.4 or earlier".
    - `45e12c9` — README "Upgrading from 1.5 or earlier" (comment out config lines you did not
      choose) and a `show` warning for an old fully written-out file; the cautious table and both
      precedence paragraphs pinned; test 11's header pattern tightened.
    - `2f407cc` — config-and-toggles' safety paragraph pinned; `tests/README.md` rewritten with the
      proof tables.
    - The commit after `2f407cc` — CHANGELOG 1.6.0 and these notes.
    - The lead pushed up to `748e87c`.
  - **Codex's review** (the usual reviewer, available again) of the whole change `413d570..748e87c`
    was NOT clean: 10 findings. The seal could not stop replacement; a failed pull-request lookup
    fell through to trust; base-branch discovery was underspecified; `git hash-object` can run
    filters and change bytes; the storage broke non-git and dry runs; autopilot spawned agents
    before its record existed; the command rule blocked ordinary tests; ci-medic had the scribe
    write the snapshot; the writer test matched substrings; and `.claude/CONTEXT.md` was stale.
    The lead decided to SIMPLIFY and state limits honestly, not add machinery. Built in `7b61564`:
    plain copies in `~/.dev-team/runs/<run-id>/snapshot/` with a manifest (no git objects, no
    seal); provenance decided first (only a local branch tracking this repository's own remote, or
    a local branch with no upstream the user started on, is the user's own; `gh` never produces
    trust; unknown → ask or BLOCKED); base-tree copies with `git ls-tree` and `git cat-file blob`;
    autopilot snapshots in bootstrap step 1; commands from the user, the plugin's own usual build,
    test and lint, or a snapshotted instruction file; ci-medic's lead writes the snapshot; the
    limits stated plainly in step 1 and the README. Tests: the whole rule pinned as one copy, all
    13 writer places compared whole. Then the notes commit (CHANGELOG, `tests/README.md`, these
    notes).
    - The lead pushed up to `a9fb292`.
  - **Stand-in review** (a fresh Opus agent, standing in for Codex until 12:35) of
    `748e87c..a9fb292`: NOT clean — 4 must, 5 should, 4 minor; its report, probes and edit scripts
    are in the lead's session scratchpad (`review-tmp/plugin-review-5/`), not in the repository.
    Core: guessing "whose checkout is this" from git state cannot be made airtight (a `gh pr
    checkout` fork branch, a `pull/123/head` fetch, autopilot's own run branch and detached
    worktrees were all misclassified). **The lead's final decision: stop guessing.** Built in
    `11ec8be`: the checkout the user starts on is the user's own (limit stated: start from your own
    branch); someone else's pull request is handled only by a skill that checks it out itself
    (ci-medic), snapshotting its base-commit instruction files into `snapshot/pr-<n>/` (moved to
    `snapshot/pr/<n>/files/` in the fourth round); rule 9
    decides only whether code may run; settings always come from the user's own config; autopilot
    snapshots before creating its run branch; unique run ids and a create-that-fails folder; the
    manifest records the repository path and run id; stop, never fall back, if the folder cannot be
    used; honest limits (git operations only; the checksum catches accidents only; hooks described
    exactly from the code); "from the snapshot copies" everywhere files are read. Tests: pinned
    copies moved to `tests/fixtures/pinned-instructions.txt`, checked as 28 whole sections (heading
    to next heading), 11 items with the opening words of what follows, and the snapshot field as a
    whole list item in 13 templates. Then the notes commit.
  - The lead pushed up to `42bd45e`.
  - **Codex's review of `748e87c..42bd45e`** (the usual reviewer) was NOT clean: six findings
    (its output is in the lead's session scratchpad, `codex-plugin-r3.out`, not in the
    repository). (1) ci-medic snapshotted whatever each pass started on, so after a pass left a
    pull request checked out, the next `/loop` pass took that pull request's instructions as the
    user's own; (2) the orchestrator's setup step resumed a run and then took a new snapshot
    anyway; (3) copies kept at their project paths right beside `manifest.txt` and `pr-<n>/` could
    collide with a project's own `manifest.txt` or `pr-12/` folder; (4) the Bash guard let
    `git push origin 'main'` and a bare `git push` on `main` through, and several descriptions
    overstated it ("This written rule is the real protection"; "already blocks pushes to main");
    (5) the smoke test passed with the Bash registration removed or the ledger matcher narrowed;
    (6) `.OpenAI/CONTEXT.md` gave stale review history. The lead took final decisions
    (`brief-plugin-r4.md` in the lead's scratchpad) and a fresh builder acted on all six, in these
    commits (the lead pushed them, up to `b39f40d`):
    - `8ea4c12` — the smoke test checks each registration: Bash to `guard-dev-team.sh`, and Write,
      Edit and MultiEdit to `guard-ledgers.sh`, by exact command path, a matcher read as a
      whole-name pattern (empty or `*` = every tool). Proved in throwaway copies: Bash removed,
      ledger matcher `Write`, both, Bash pointed at the wrong script, and `Writer|Edits` each fail;
      the real file passes; the old smoke script passed the first two.
    - `0993347` — the Bash guard reads the command the way the shell does (quotes and backslashes
      taken away, a quoted multi-word argument kept as one word, `sh -c` / `bash -c` / `eval`
      strings read too, three levels deep) on top of the old raw-text rule, and resolves a push that
      names no branch by asking git in the folder the command runs in (hook input `cwd`, then
      `-C`); the descriptions in `conventions.md` (step 1 "What this cannot do", and point 9 of the
      ownership rule), the README (cross-cutting bullet, hooks table, security note), ci-medic rule
      2 and `guard-ledgers.sh`'s header now say exactly what it covers (the fifth round found that
      claimed too much, and reworded it). 15 new tests. (Its message
      says "10 of the 15" fail against the old hook; it was 11 of 15 — a miscount.)
    - `7769558` — snapshot layout: `snapshot/files/<path>`, `snapshot/manifest.txt` beside it,
      `snapshot/pr/<n>/files/` and `snapshot/pr/<n>/manifest.txt`; the snapshot field in all 13
      brief templates says "from the copies in its `files/` folder"; the "gone" test also rejects
      `snapshot/pr-`, `pr-<n>` and "into the folder, keeping their paths".
    - `5d5438a` — a resume of a recorded, unfinished run checks and reuses its recorded snapshot and
      stops with a plain message if the check fails; only a new run takes one — in
      `conventions.md` step 1 (new sub-bullet) and "Cold-resume", the orchestrator's setup step,
      all eight skills' run-start lines and the README. The Cold-resume section is now pinned
      whole (29 sections).
    - `f9eb396` — ci-medic: a run takes ONE snapshot and a `/loop` is one run; the first pass writes
      the run record `~/.dev-team/runs/<run-id>/run.txt` (repository path, run id, starting branch or
      `detached`, starting commit) and starts every pass report with `ci-medic run <run-id> — started
      on <branch> at <commit>`; later passes find that line, check and reuse the snapshot, and put
      the starting branch back first if needed; every pass puts it back before it ends, or stops and
      says so (no forcing, discarding or stash). In SKILL.md, the watch protocol (new section,
      pinned: 30 sections), the remediation checkout step, the watch-prs command and
      `conventions.md` step 1.
    - `4e7a40d` — the guard's word-by-word reading moved its joining and filtering into awk: a 24 KB
      command took about 12 seconds in bash and now takes about half a second; a 16th test checks
      a long command is still read to the end.
    - `b6ae2a9` — step 1's "Resuming" bullet also says an unattended run whose snapshot check fails
      is marked BLOCKED with the same reason (as autopilot does); the Cold-resume paragraph
      re-wrapped.
    - `1988586` — ci-medic wording from a read-through: "a LATER pass never snapshots what is checked
      out" (a new run's first pass does snapshot the user's starting checkout), and the watch
      protocol's "every pass re-triages from scratch" note moved back under the watch pass.
    - The notes commit: CHANGELOG 1.6.0, `tests/README.md`, `CONTRIBUTING.md` (what the smoke test
      checks), these notes, `.claude/CONTEXT.md`, `.OpenAI/CONTEXT.md` (finding 6: the outstanding
      range is now `42bd45e..HEAD`) and both MEMORY files.
  - The lead pushed up to `b39f40d`.
  - **Stand-in review of `42bd45e..b39f40d`** (a fresh Opus agent standing in for Codex): NOT
    clean — ten items (two medium, seven low, one information): git's matching refspec `:`; the
    guard too slow to be waited for; other spellings of `main`; a named branch mapped by
    `remote.<name>.push`; `env -C` and the reader's marker words; 8 of its 30 planted faults
    surviving; an interrupted ci-medic pass; the pass line not naming the repository; the short
    resume wording; these notes. The lead's decisions are in `brief-plugin-r5.md` (scratchpad).
  - **The fifth round was built twice.** The first build (nine local commits) was lost unpushed
    when the machine restarted on 2 October and emptied the temporary folder holding the clone,
    the sandbox and most of the review's evidence. It was rebuilt from the builder's record of
    every edit, each item reproduced and proved again, in these commits:
    - `c084708` — (1) git's matching refspec `:` / `+:` (command line or `remote.<name>.push`) is
      read exactly as `push.default=matching`; the header's wrong "limit" about push settings
      corrected.
    - `4aad76f` — (2) speed: the reader is two awk programs working line by line, never building
      one long string (the old one used `substr` over the whole text, quadratic on macOS awk); at
      most 10 pushes per command, counted before git is asked anything, more refused; all checking
      under a 20-second limit (`DEV_TEAM_GUARD_TIME_LIMIT` can only shorten it) — past it the
      command is refused and the check's whole process group stopped. macOS bash 3.2, before →
      after: 10,000-line heredoc 21.8 s → 0.49 s, 129 KB message 1.8-2.7 s → 0.39-0.44 s, 200
      pushes 39.8 s (allowed) → refused in 0.07 s; Linux (mawk) 4.3 → 0.20, 0.7-1.0 → 0.06-0.10,
      14.1 → 0.03 s. The reader's lines start with a letter (w, s, r, R, v), so a command's word
      can never equal a marker.
    - `b3a7e1c` — (3) other spellings of `main`: `$'…'` escapes decoded as bash 5 does; `{`, `}`
      and `'` added to the separators; `git … push` also looked for through quotes (catches
      `echo '…' | sh`, `sh <<< '…'`); a shell's options read properly (`bash -c -- '…'`);
      `/usr/bin/git` after a `cd`. Limits stated honestly in the header, README and
      `conventions.md` (and its pinned copy): the guard reads ordinary spellings and does not run
      the shell. Stated over-block: text that only spells out a push to main in single quotes is
      refused (the double-quoted form already was; the single-quoted one was allowed before — the
      first build's notes said otherwise, wrongly).
    - `3e5e468` — (4) a named branch with no destination is mapped the way git does
      (`remote.<name>.push`, then `push.default=upstream`), checked against `git push --dry-run`.
    - `46547ca` — found while timing (4): bash 3.2 saves a copy of a function's arguments on every
      call made from inside it, so a `git add` of 5,000 files was refused on time; the arguments
      are cleared after copying and the per-word helpers asked only when a word could match. A
      trap avoided: `${word%sh}` (suffix removal) grows with the square of the word's length —
      the first build used it, slowing a 129 KB message to 6 s of processor time, and its later
      test failures were wrongly put down to machine load; the rebuild uses a `case` pattern and
      gives the 129 KB message test a tighter bound (now 3 seconds of processor time, since
      `c55b862`), which fails with `${word%sh}` planted back.
    - `b29a2f7` — (5) `env -C` / `--chdir` treated exactly like `cd`; the marker test
      (`git --work-tree @@SEP push`).
    - `fada4df` — (7, 8) ci-medic writes `left checked out: <branch>` into `run.txt` before
      checking a pull request out and removes it when the starting branch is back; a new run
      refuses to start (asks; unattended BLOCKED) while a run record for this repository names the
      branch checked out now; the pass-report line names the repository, a line for another
      repository counts as none, and the user can ask for a new run. Pinned records rewritten;
      each word difference checked to be only the added wording.
    - `2076ecc` — (9) "(a run recorded before 1.6.0 has none: see step 1)" in the eight
      skills' run-start lines, the orchestrator's setup step, conventions' Cold-resume and the
      README.
    - `c55b862` — (2, the tests) the speed tests judge the processor time the hook uses,
      not the clock (on this machine, loaded to 300-430 by other work, a 2-second check took 17 on
      the clock and was refused), and a run the hook stopped at its limit is skipped, never passed;
      the 129 KB payload goes to the hook through a file, because Linux refuses one argument over
      128 KB (found in the Ubuntu container: the test could not run there at all).
    - `a44171e` — (6) seven tests, one per surviving planted fault (M17, M18, M19, M20, M24,
      M26, M29; M03 is caught by (3)'s test; M23 is an equivalent change no test can see), and
      three more found by this round's own sweep (M25's `eval` filter, the per-word brace
      separators, the push count taken before git is asked). Sweeps: the reviewer's own driver
      (re-typed after the restart, and checked on b39f40d, where it gave the review's result again:
      21 caught, 9 survived) catches 20 of the 21 of its faults that still apply on the round-5 tree
      (9 target replaced code), M23 surviving; the round-5 driver (the 30 re-expressed plus 13
      undoing each fix) catches 41 of 43, M23 and N02 surviving (N02 is a backstop behind the count
      taken first).
    - The notes commit — CHANGELOG, `tests/README.md`, these notes (item 10: the fourth round is
      pushed at `b39f40d`).
  - The fifth round had no review of its own before Codex's catch-up review, below.
  - **Codex's catch-up review of `748e87c..2f91439`** (rounds 2 to 5 as one body, 24 commits; its
    own earlier review of `748e87c..42bd45e` lies inside that range): NOT clean — eight findings,
    seven medium and one low: a `$'…'` string not ended at a zero byte (`$'main\0ignored'` let
    through); a remote set up as a mirror not read; the time limit not covering reading the input
    and `jq`; a program that ignores SIGTERM keeping the caller waiting; ci-medic taking a new
    snapshot when a `/loop`'s run line is summarised away; long-input tests that did not prove the
    reading reaches the end; these notes (they misstated the review history and push status); and
    (low) `git … push` detected across separate commands. Its ten earlier findings are resolved
    except the notes. The lead's decisions are in `brief-plugin-r6.md` (scratchpad).
  - **The sixth round** acts on all eight, in these commits:
    - `6768927` — (1) a zero byte ends a `$'…'` string, as in bash: nothing more of it, up to the
      closing quote, goes into the word, and the word goes on after the quote.
    - `51419ca` — (2) a remote set up as a mirror (`remote.<name>.mirror`) is read as pushing every
      branch, in git's order: the remote's push refspecs, then the mirror setting, then
      `push.default`. Tested against a local bare repository, with git's own dry run checked first.
    - `2f43a79` — (3) reading the input, both `jq` calls and tidying the command run inside the
      worker, under the time limit.
    - `da90a37` — (4) past the limit: SIGTERM to the worker's process group, a fixed one-second
      grace, then SIGKILL; the hook can no longer call that off once the limit is reached, so the
      refusal reaches the caller within the limit plus one second.
    - `b8da4d4` — (7) `git … push` is looked for inside one simple command only, as at `748e87c`.
    - `9e3a3cb` — (6) the three long-input tests end with late cases only the full reading
      catches (`git push origin ma"i"n`, and a bare push in a repository on `main`).
    - `a3269c3` — (5) ci-medic finds a `/loop`'s run from its run records when the conversation no
      longer shows the line, stops (unattended: BLOCKED) when more than one run is open, and never
      starts a new run on a guess; a run of one pass is marked `ended`, a `/loop`'s stays open.
    - `6113bbc` — (4, its test) the stop test also checks that the SIGTERM reached the stand-in, so
      it went to the whole process group: this round's fault sweep showed the test from `da90a37`
      passed with the SIGTERM never sent or sent to the worker alone (the SIGKILL covered both).
    - The notes commit — (8, 9) CHANGELOG, `tests/README.md`, these notes, both CONTEXT files and
      both MEMORY files.
  - **Review status.** Codex has reviewed `413d570..748e87c` (10 findings), `748e87c..42bd45e` (6)
    and, as a catch-up, `748e87c..2f91439` (8). Stand-ins (fresh Opus agents, not Codex) reviewed
    `748e87c..a9fb292` and `42bd45e..b39f40d`. Commits after `2f91439` are not yet reviewed.
  - **Next** (the maintainer's instruction, 5 October 2026). This repository's language-policy work
    is handed over to its own sessions; nothing more will be run from the MeedyaDL session.
    1. Next is a review of this round's commits (everything after `2f91439`) — by Codex if it has
       allowance, otherwise by a fresh agent, named as a stand-in. Set `TMPDIR` to a writable
       folder when asking Codex to run bats (its sandbox's default was not writable).
    2. The review loop now stops when a review finds no high or medium problems. Low findings,
       wording points and older faults become GitHub issues, not new rounds.
  - Note: the lead's decision named "review/verify when given `pr=`" as a second skill that checks
    pull requests out; the review skill has no `pr=` argument today, so the text says "a skill that
    checks one out itself — today, ci-medic".
- **Checks at the sixth round:** each code commit's guard tests were run with bash 5 and with
  `/bin/bash` 3.2 before it was committed (47 at `2f91439`; 52 from `b8da4d4`), and shellcheck. On
  `a3269c3`, in a throwaway repository of its own: both audits, the smoke test, shellcheck and
  actionlint clean; bats 199 of 199, none skipped (193 before the round, plus five Bash-guard tests
  and one ci-medic test; the #47 group still checks 30 sections, 11 items and 13 fields); the 52
  guard tests also with `/bin/bash` 3.2; and in an Ubuntu 24.04 container (mawk, bash 5.2) 199 of
  199 with the 10 schema tests skipped (`check-jsonschema` is not installed there). The 10-push
  control: ten allowed, eleven refused, with both shells. The fault sweep (59 planted faults; see
  `tests/README.md`): 54 caught at `9e3a3cb`, then N04 and N05 caught by `6113bbc`; M23, N02 and
  P09 change nothing a test can see.
- **Checks at the fifth round:** each commit's own tree was checked before it was committed (the
  commit messages give the counts): both audits, the smoke test, shellcheck, actionlint and bats —
  193 at the last code commit (170 before the round, plus 23 Bash-guard tests) — and the guard
  tests also under the Mac's `/bin/bash` 3.2 and in an Ubuntu 24.04 container (mawk). A copy of the
  tree without `.git` fails `branch-hygiene: --no-fetch` (it needs a git repository): the builder's
  check runner made each copy a throwaway repository of its own.
- **Checks at the fourth round:** bats 170 of 170 (154 before this round, plus the 16 Bash-guard
  tests; the #47 group is still 10 tests, now checking 30 sections, 11 items and 13 fields), run
  with `TMPDIR` set to a writable scratch folder; the Bash-guard tests also pass with the Mac's
  `/bin/bash` 3.2; smoke test, both audits, shellcheck and actionlint all pass. Earlier: 154 at
  `42bd45e`, 159 at `a9fb292`, 162 at `748e87c`, 155 at `dbb5e31`.
- **Proof the tests bite:** every edit listed in `tests/README.md` was made in a throwaway copy
  outside the clone and made at least one test fail. Fourth round: the seven edits in its table,
  the smoke-test mutations (Bash registration removed; ledger matcher `Write`; both; wrong script;
  `Writer|Edits`), the Bash-guard tests against the old hook (12 of 16 fail — the four others test
  allowed cases) and with `git` dropped from the reader's filter (six fail); and every earlier
  edit re-run at `f9eb396` — 75 of 75 applicable from earlier rounds and 33 of 33 applicable
  stand-in edits still caught, 33 no longer applicable (their text was replaced). The driver and
  copies of the scripts are in this builder's session scratchpad (`r4work/prior/`), not in the
  repository. In the stand-in round before it: the stand-in reviewer's own edit
  scripts (m1–m13 and m10b; m6 and m7 adapted to replaced wording) and 22 more. Re-run on the final
  text: 76 earlier-round edits whose text still exists. The scripts are in the builder's session
  scratchpad (`r3work/edits5/`, `r3work/run_edits5.sh`, `r3work/*_r6.py`), not in the
  repository.
- **Decisions the builder took inside the lead's decisions** (a reviewer may want to look at these):
  - A per-switch table in `config-and-toggles.md` says which value is the more cautious one. Two
    switches have none, so an instruction file cannot move them: `models` (a cost choice; the
    verification tier never drops anyway) and `git.default-branch` (it decides which branch runs start from and target; before the third
    review the reason given was "it decides the trusted base", which no longer exists).
    `auto-commit: off`, `auto-handoff: off` and `telemetry: on` are counted as the cautious values.
  - `/dev-team-config show` says plainly that it does not read instruction files, rather than
    trying to reflect them.
  - `/dev-team-move-ledgers` does not ask the "notes live elsewhere" question (its questions and its
    single commit are fixed); in that case it keeps `on`, does not offer the pointer sentence, and
    says so in its report.
  - A scribe brief with no `handoff-file` value writes no card and says so.
    - Third review (since replaced): the snapshot used `git hash-object -w`, a seal, and a
    `## Instruction snapshot` ledger section. Codex showed the seal could not stop replacement and
    hash-object could change bytes, so all three are gone.
  - Codex's round (the provenance guessing in it was removed in the stand-in round): the run
    folder is `~/.dev-team/runs/<run-id>/snapshot/` with `manifest.txt`
    (the provenance decision, then `<sha256>  <path>` per file); a missing folder or a copy that no
    longer matches → BLOCKED (this detects damage, not a deliberate rewrite — the limit is stated).
    The folder's path is recorded in `autopilot.json` (run id and folder only), House style, or the
    ship / ci-medic run report. When someone else's pull request's base branch is unknown, the base
    is this repository's default branch. Only a branch of this same repository counts as a trusted
    pull request for instructions; a fork's pull request uses the base rule even from a trusted
    collaborator (rule 9 still decides whether its code may run). The dry-run promise in every skill
    now says "no file or git changes in the project". An unrecognised `handoff-file` value is
    reported and treated as `off`, as decided. `show` flags an old file when ten or more settings
    are written out at their defaults.
  - Fourth round (Codex's review of `748e87c..42bd45e`):
    - **Bash guard.** The new shell-reading rule is added ON TOP of the old raw-text rule, so
      nothing it refused before is allowed now; its old over-caution stays (for example
      `git checkout main && git push` is still refused). Resolving a push that names no branch
      follows git: `simple` and `current` push the current branch; `upstream`/`tracking` the branch
      it tracks; `matching` counts the local `main`/`master`; `nothing` nothing; a value it does not
      know counts both; a `remote.<name>.push` setting replaces `push.default`, and a refspec with
      `*` counts the local `main`/`master`; `--all`, `--branches` and `--mirror` count them too;
      `HEAD`/`@` with no destination is the current branch; `--tags` alone pushes no branch. It
      passes the command's own `-c`, `--git-dir` and `--work-tree` to git and runs nothing else.
      "Cannot tell" (allowed, stated): an earlier `cd`/`pushd`/`popd` command (also inside
      `( … )` or a nested `sh -c`), a `GIT_*=` word set in or exported before the command, not a
      git repository, a detached HEAD. The force-push message is checked first so it can show.
      `sh -c` / `bash -c` / `eval` strings are read three levels deep. Without `jq` it scans the
      raw input only, as before.
    - **Smoke test.** A matcher is read as a pattern matching the whole tool name, and an empty or
      `*` matcher matches every tool — the way Claude Code reads it.
    - **Resume.** "A resume" means continuing a recorded, unfinished run from its recorded next
      action. Reusing an earlier run's cached knowledge in a new run (iterate's Codebase Map, a
      prior docs pass) is not a resume, so that run takes its own snapshot; if it is unclear, the
      lead asks. A run recorded before 1.6.0 has no snapshot: attended → say so and take one;
      unattended → BLOCKED, exactly as autopilot already does.
    - **ci-medic.** The run record is a file, `~/.dev-team/runs/<run-id>/run.txt`, beside
      `snapshot/`; the run id travels from pass to pass in the conversation, in the first line of
      every pass report, and the limit was stated: if that line is summarised away, the next pass
      takes its checkout as a new run's start (replaced in the sixth round, after Codex's catch-up
      review: such a pass now finds its run from the run records, and stops when that is not
      clear). A pull request's base copies are taken the first time a run works on it and
      reused for the rest of the run. A pass that cannot put the branch back stops without forcing,
      discarding or stashing. A scheduled routine's runs are each a new run.
    - **Pinning.** Two more whole sections are pinned — conventions "Cold-resume" and ci-medic's
      "One snapshot per run, and the starting branch put back" — so both rules are guarded like the
      rest (30 sections).
  - Fifth round (the stand-in review of `42bd45e..b39f40d`):
    - **Time limit.** Wall-clock, 20 seconds, in the hook itself: the checking runs as a background
      worker in its own process group (`set -m` only for that), a timer stops the whole group, and
      the hook refuses with "took longer than 20 seconds … Split it into smaller commands". The
      timer's output goes nowhere so it can never hold the hook open. `DEV_TEAM_GUARD_TIME_LIMIT`
      exists only so tests need not wait 20 seconds, and can only shorten the limit.
    - **Push cap.** Each level of a command is first counted without asking git anything; the real
      pass keeps the count that decides (it also covers `sh -c` strings). 10 pushes are checked; 11
      are refused.
    - **`$'…'` escapes** follow bash 5 (bash 3.2 does not know `\u`, so on 3.2 the guard refuses
      more, not less); a zero byte, which ends a string in bash, was dropped and the rest of the
      string kept. This note used to say that could only refuse more, never less; that was wrong —
      Codex's catch-up review found `$'main\0ignored'`, which bash reads as `main`, let through.
      Since the sixth round the reader stops the string at the zero byte, as bash does.
    - **Named-branch mapping** reads the remote's push refspecs, `push.default` and the list of
      local branches once per push, and asks nothing when neither can move a branch; a negative
      refspec is not read (stated).
    - **`env -C`** is detected as any word starting `-C`, a short-option group containing `C`, or
      `--chdir`, after an `env` word in the same simple command; it makes the push "cannot tell"
      (allowed), exactly like `cd`.
    - **ci-medic's interrupted pass.** An attended run may go ahead once the user has checked out
      their own branch or says plainly that the checkout is theirs; the `left checked out:` line is
      then removed so the question is not asked again.
    - **Still quadratic, and left to the time limit:** bash's own prefix and suffix removal on a
      huge refspec word (`git push origin <a 129 KB word>`: `${r#+}` about 9 s, `${r#*:}` up to
      38 s under a UTF-8 locale). Such a command is refused on time, which fails closed. Setting
      `LC_ALL=C` for the whole hook would cut some of these twentyfold; not done, as it is outside
      the brief — a suggestion for the lead.
  - Sixth round (Codex's catch-up review of `748e87c..2f91439`):
    - **Zero byte.** The cut lasts to the closing quote and escapes are still read inside it, so an
      escaped quote there does not end the string; checked against `/bin/bash` 3.2 and bash 5
      (they agree except on `\u`, as before).
    - **Time limit.** The check of whether the hook is active at all (`guard: off`, an active run,
      `DEV_TEAM_GUARD`) stays in front of the limit: it reads at most `.dev-team/config.yml` and
      decides whether there is anything to time. An inactive hook still reads its input and throws it away,
      as it always did. The grace is one second, so the bound is the limit plus one second. The
      worker is handed the input with `<&0` as well as by job control; removing `<&0` alone changes
      nothing a test can see. A worker stopped by SIGKILL (137) is refused like one stopped by
      SIGTERM (143).
    - **One command.** Only the `git` word is forgotten at the end of a simple command; `main`
      anywhere in the text still counts, as it did in the check on the text as written long
      before `748e87c`.
    - **ci-medic.** With no line in the conversation and exactly one open run record for the
      repository, the pass continues that run without asking, because a `/loop` has to keep
      running hands-off after the conversation is summarised; the pass report says the run was
      found from its record. `started as:` is written by the first pass, when how the run was
      started is certain, so later passes read it rather than guess. A `/loop`'s run is never
      marked ended (no pass can know it is the last): stated as a limit — a later session's first
      pass continues it until the user asks for a new run.
- **Rejected on the way:** testing a few key phrases (the second review showed a rule can be
  weakened by ADDING words, which such tests never see — so steps 1 and 8 are compared whole); a
  closed list of protected things (anything left off it was open to override — replaced by the
  direction rule); ranking an instruction file beside `.dev-team/config.yml` (it now sits below an
  explicit config value, toward caution only); "says where notes live" turning the file off (too
  broad); letting the scribe write a project's own handover when asked (ownership is not
  overridable). Fourth round: removing every quote character from the command before matching
  (it would read `git commit -m 'push to main'` as a push — a real shell-style reader keeps a
  quoted argument as one word instead); doing the word-by-word reading in bash (about 12 seconds
  on a 24 KB command — it moved to awk); guarding against a lost ci-medic run id by checking
  whether the checkout is some pull request's head branch (that is guessing whose code it is,
  which the design rules out — it is stated as a limit instead). Fifth round: splitting each line
  into characters and printing one at a time (still twice as slow as printing whole stretches);
  reading the reader's output line by line straight from a pipe in bash (bash then reads one byte
  at a time); calling a helper function for every word (bash 3.2 saves the caller's arguments on
  every call: 13 seconds for a 5,000-file `git add`); `${word%sh}` to test a word's ending
  (quadratic: 20 seconds on a 129 KB word); stopping only the timed-out worker (a slow `git` it was
  waiting on kept the hook's output open, so the hook still took as long as the slow `git`); a test
  for M23 (it changes nothing, so no test can catch it). The ci-medic run-record check is not the
  rejected "is this some pull request's head branch?" guess: it reads only the plugin's own
  records. Sixth round: having the hook's worker report through its exit code and send all its
  output nowhere, so that nothing it started could ever hold the hook's output (more moving parts;
  the SIGKILL after one second already bounds the wait); asking the user every time a `/loop`'s run
  line is missing (it would stop a hands-off loop; one open run is clear enough to continue, and
  more than one does stop and ask).
- **Suggestion, now built:** `/dev-team-config init` used to write every other key explicitly
  (`dry-run: off`, `gates: hybrid`, …), so a freshly initialised config could overrule a project's
  cautious instruction. Decided by the lead and built in the starter-file commit (above).

## START HERE — for a fresh session with no chat history (written 23 September; see "Current state" above for what has changed since)

Read, in this order: this section; `.claude/CLAUDE.md` (the standing rules, revised on 23 September);
`.claude/CONTEXT.md` (what the repository is and how to check it); `.claude/MEMORY.md` (traps already
found — especially the Codex ones). Codex reads the same rules through `AGENTS.md` → `.OpenAI/`.

### Where things stand

- **#41 (move the plugin's record files into `.dev-team/`, version 1.5.0)** is fully built. It has
  been through one complete Codex review (round 3, 14 problems, all fixed) and five fix rounds. All
  checks passed at the last run (14 September): both audits, smoke test, shellcheck, and bats 144 of
  144.
- **What is missing: a clean Codex review of fix rounds 3, 4 and 5.** Codex's round-4 review ran out
  of allowance part-way on 14 September; the two problems it had spotted were confirmed and fixed in
  round 5. Stand-in reviews by fresh Claude agents checked rounds 3 and 4, but under the rules the
  branch counts as **not fully reviewed** until Codex comes back clean.
- **Not in this record:** the saved record stops at 14 September, 08:50. The 12:40 Codex retry booked
  that day left no result in the repository, and nothing on GitHub is newer. The owner reports a
  **Codex review booked for 00:08** (the night of 23–24 September) in their own Claude Code session.
  Nothing has been committed to the branch since, apart from the assistant-notes commit of 23 September
  (`.claude/`, `.OpenAI/`, `AGENTS.md` only — no plugin code).

### What to do next (in order)

1. **The Codex review.** A booking made inside a Claude Code session (CronCreate) dies with that
   session. So:
   - if the old session is still open and the 00:08 run happened, find its output file (the path is in
     that session) and go to step 2;
   - if the session was restarted, **start the review by hand**, once, after the Codex allowance has
     reset. The exact command and the brief are in
     `.claude/plans/ledger-file-clashes/codex-review-prompt-5.md` (saved in the repository so a new
     session has it). Check the start-up banner says `reasoning effort: high` and that the log has no
     "You've hit your usage limit", "Selected model is at capacity" or `ERROR:` line before telling #41.
   - Do not commit anything while Codex is reading the branch.
   - If Codex cannot run, follow the fallback rule (rule 8): a fresh, independent Claude reviewer
     (Opus) checks rounds 3–5, and the branch stays "not fully reviewed".
2. **Verify each Codex finding** against the files (Opus verifiers, one after another), fix the
   confirmed ones (Sonnet builders; Opus for the hook if it is subtle), rerun every check listed in
   `.claude/CONTEXT.md`, commit, push, update #41. Then review with Codex again — repeat until a round
   finds nothing.
3. **Thorough documentation update** (asked for on 23 September, deliberately queued until the Codex
   review is done so the review is not reading a moving target): every `.md` file, the in-plugin help
   (skills, commands, references), `.claude/` and `.OpenAI/`. No API, so no Swagger (rule 11).
4. Tell the owner #41 is ready for the single pull request to `alpha` — they choose when it is opened.
5. Then #46 and #45, which wait on the owner's decisions below.

### Owner decisions still open (none blocks steps 1–3)

| # | Question | Suggested answer |
| --- | --- | --- |
| Q1 | In a session started in a subfolder of a repository, should `.dev-team/` live in that subfolder or at the top? | The subfolder (what the skills already do); `/dev-team-move-ledgers` then also looks there. |
| Q2 | #46 D1–D4: the orchestrator's engine language (Node), its branch (a fresh one from `alpha` after 1.5.0 merges — against the one-branch rule, so the owner's call), Gemini/Kimi/Grok documented but unverified, and hand-over after 12+ hours of outage. | As recommended in `.claude/plans/orchestrator-v2/plan.md`. |
| Q3 | #45: which of the owner's standard practices to build into the plugin, and whether their on/off defaults become built-in defaults or a named preset (`profile: standard`). | A preset. |
| Q4 | The plugin's own "deep thinking" helper (`deep-architect`) still defaults to Fable. The owner's working rule now prefers Opus for deep work. Change the plugin's default too? | Leave the plugin as it is for now; this rule is about how we work on the repository. Decide when #46 lands. |
| Q5 | Device-wide rules: the 23 September session ran in the cloud and could not reach the owner's computer. | Ask any local session to add `.claude/device-wide-rules.md` to `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`. |

### Task queue

| # | Task | Status |
| --- | --- | --- |
| 1 | #41 build, fix rounds 1–5 | Done |
| 2 | Codex review of the whole branch (round 5) | **Next** — booked 00:08 in the owner's session, or run by hand |
| 3 | Verify and fix Codex findings; re-review until clean | Waiting on 2 |
| 4 | Thorough documentation update | Queued after 3 |
| 5 | Standing rules revised (`.claude/CLAUDE.md`, `.OpenAI/AGENTS.md`), memory and context files added | Done 23 September |
| 6 | Device-wide rules on the owner's computer | Wording ready; needs a local session (Q5) |
| 7 | One pull request to `alpha` | Owner's call, after 3 and 4 |
| 8 | #46 orchestrator; #45 standard practices | Waiting on Q2, Q3 |
| 9 | Follow-ups #42, #43, #44 | Not started |
| 10 | Hand test: does the hook fire for a sub-agent's writes? | Not done |
| 11 | #47 repository instructions and normative documents (`feature/bcp47-language-policy`) | Revised after one independent review; **needs another review round**; goes after #41 |

---

# Detailed history (13–14 September)

## What we are trying to do, and why

The plugin writes its record files — `FEATURES.md`, `SECURITY.md`, `PROJECT.md`, `VERIFICATION.md`
(with `verdict.json`), `MIGRATION.md` and `HANDOFF.md` — into the top level of whichever project it
runs in. Projects often already have files with those names that mean something different, and the
plugin never checks before writing. The owner asked whether to rename `FEATURES.md`, then suggested
putting **all** the plugin's documents in the project's `.dev-team/` folder. That is the design.

## Read these first

1. `.claude/plans/ledger-file-clashes/plan-review.md` — **the lead's corrections. It wins over the plan.**
2. `.claude/plans/ledger-file-clashes/plan.md` — the file-by-file plan (Fable).
3. `.claude/plans/ledger-file-clashes/analysis.md` — the evidence and the options weighed (Fable).

## The design in short

- **Where the files go:** everything the plugin writes lives in `.dev-team/`, with the file names
  unchanged.
- **How the plugin knows a file is its own:** each file carries a marker on line 2, in the form
  `<!-- dev-team: ledger=<kind> schema=1.0 -->`.
- **Check before writing:** the plugin reads the target first. If the marker is missing, it writes
  nothing and asks.
- **Existing installs:** files at the old top-level places are still found. One with the marker is
  moved into `.dev-team/`; one without the marker is asked about. A new command,
  `/dev-team-move-ledgers`, does the same for all seven files at once.
- **New safety hook:** `hooks/guard-ledgers.sh` refuses plugin-marked content written outside
  `.dev-team/`.
- **Self-check script:** `scripts/audit-ledger-paths.sh` fails if any plugin document still points at
  the old top-level place.
- **Schema:** `verdict.json` gets a schema file.
- **Version:** 1.5.0.

## What is established (checked by reading the real files)

- **WebMS-Intra:** `FEATURES.md` is the project's own feature list, and featurefind was deliberately
  not run because it would overwrite it. Its `.claude/HANDOFF.md` already expects
  `.dev-team/FEATURES.md`.
- **SIGNula.id:** `SECURITY.md` is GitHub's public security policy, with plugin findings appended from
  line 144. Real damage, already done.
- **Hand-written handovers:** SIGNula.id and Go2My.Link have a top-level `HANDOFF.md` written by hand.
  Auto-handoff would overwrite it.
- **GitHub (verified from its own documentation):** GitHub reads `SECURITY.md` from `.github/`, then
  the top level, then `docs/` — never from `.dev-team/`. The other six names mean nothing special to
  GitHub.
- **AI coding tools:** none of them read a top-level `HANDOFF.md` on their own. Claude Code reads
  `CLAUDE.md`, Codex reads `AGENTS.md`, Gemini reads `GEMINI.md`.
- **"Is a run in progress?" test:** `hooks/guard-dev-team.sh` line 21 answers it by checking whether
  `.dev-team/autopilot.json` exists. Three projects keep that file committed, so the check is always
  true there. This is why the plan's hook Rule 2 was corrected (see plan-review.md, Correction 1).
- **Automatic checks:** CI (`plugin-audit`) runs only on pull requests and on pushes to `main`, not on
  pushes to this branch.
- **Codex:** version 0.153.2 is installed. `codex review --base main "<what to look for>"` reviews
  this branch.
- **Local tools:** `bats` and `check-jsonschema` were installed with Homebrew on 13 September, so the
  plugin's own tests can run on this machine. `shellcheck` and `jq` were already present.

## What was tried and set aside

- **First analysis run (workflow `wf_5462b6ab-1aa`)** was stopped on purpose a few minutes in, not
  because it failed: the owner's `.dev-team/` suggestion arrived mid-run. Rerun as `wf_bee8e63e-4f4`.
  Both Fable agents answered, so no fallback to Opus was needed.
- **Renaming only `FEATURES.md`** — rejected: it does nothing about `SECURITY.md` or `HANDOFF.md`.
- **Prefixing names at the top level** — rejected: it still clutters every project.
- **A configurable location** — rejected: the owner only finds out after the damage is done.
- **Hook Rule 2 as first planned** (block any edit to a top-level ledger-named file whenever
  `autopilot.json` exists) — rejected on review: it would permanently block people editing their own
  files in projects that commit `autopilot.json`.

## Not yet verified

- Whether Claude Code's before-a-tool-runs hooks fire for a sub-agent's file writes. The plan includes
  a hand test for this.
- The exact input field names Claude Code sends to a Write/Edit hook (`tool_input.file_path`,
  `content`, `new_string`, `edits[]`, `cwd`). The builder must confirm them against Claude Code's
  hooks documentation.

## Task queue (as it stood on 14 September — superseded by the one in START HERE)

| # | Task | Status |
| --- | --- | --- |
| 1 | Standing rules for this repository (`.claude/CLAUDE.md`) | Done (9830e8e) |
| 2 | Device-wide rules | Already present in `~/.claude/CLAUDE.md` |
| 3 | Deep analysis (Fable) | Done |
| 4 | Deep plan (Fable) + lead review | Done |
| 5 | Build stage 1: WP1 rules text (Opus) alongside WP2 hook + WP9 schema (Sonnet) | **Done.** Checks rerun by the lead: all pass, bats 39 of 39. Committed separately: 2f1cdf0 (WP1), 1abe635 (WP2 + WP9). The lead's read-through found three small hook faults, now being fixed in stage 2: compact JSON marker not caught, file names matched in capitals only, CI `pip install` may be refused on Ubuntu 24.04 (switching to `pipx`). |
| 6 | Build stage 2: WP4 orchestrator files, WP5a and WP5b skill references, WP6 agents and SKILL.md (all Sonnet); WP7 commands and `/dev-team-move-ledgers` (Opus); the hook fixes (Sonnet) | **Done.** Checks rerun by the lead: audit OK, smoke OK, shellcheck clean, bats 44 of 44, and the mention check OK over all 46 changed files. Committed as six separate commits, one per package. `/dev-team-move-ledgers` was walked against seven real projects read-only, and every required outcome held. |
| 6b | Tidy-up pass (Sonnet): remaining bare file names that are instructions (mostly iterate, migrate, ship and orchestrator files); rename the security layout's `## Findings register` heading to `## Findings` so the existing `#Findings` links work | Next, alongside stage 3 |
| 7 | Build stage 3: WP8 README, CHANGELOG, version (Sonnet), then WP3 self-check script (Sonnet) | Waiting on stage 2 |
| 8 | Run all checks; Codex review, fix, re-review until clean | Waiting |
| 9 | Hand test: does the hook fire for a sub-agent? | Waiting |
| 10 | Follow-up issues | Done: #42 (findings public in public repositories), #43 (`autopilot.json` schema), #44 (Bash guard's "run in progress" test). SIGNula.id's `SECURITY.md` hand-fix belongs to that repository — left for the owner. |
| 11 | One pull request to `alpha` | Later — owner's call when |
| 13b | **Orchestrator v2 — status about 23:00 on 13 Sep.** The deep analysis is done: `.claude/plans/orchestrator-v2/deep-analysis.md` and its independent check `analysis-check.md` (the check wins where they differ). Key findings: a phased Node engine (a close call against Python; the reasons are Windows timezone data, JSON/Ed25519 built in, and nearness to the owner's stack); the biggest gap is that autopilot's reclaim discards uncommitted work, so a paused state is needed with a work snapshot; config as `.dev-team/orchestrator.json` with a schema; machine-local data under `CLAUDE_PLUGIN_DATA/projects/<repo-hash>/`; sub-agents can be resumed and given a model when spawned. **Four decisions asked of the owner:** D1 Node; D2 a fresh branch from alpha after 1.5.0 merges (this contradicts the owner's one-branch instruction, so it is the owner's call); D3 Gemini/Kimi/Grok documented but unverified (a departure from a MUST); D4 the preset hands over after more than 12 hours of quota outage, recorded and followed by a stronger review. **Deep planning is running** (workflow `orchestrator-v2-deep-planning`: a Fable planner, then a Fable critic, then a Fable revision, read-only) on the recommended answers, with deltas if the owner decides otherwise. **Implementation waits** for D1 and D2. | Planning running |
| 13 | **Orchestrator v2 (new request, about 21:50 on 13 Sep).** The owner wants an intelligent, provider-agnostic orchestrator: routing by capability rather than model name; phase stickiness with a 12-hour pause-and-resume rule; locked plans; cross-provider review; local learning; quota and budgets; signed remote catalogue via MWBM-intAppsAPI; a simulator and tests. **The COMPLETE brief (sections 1–101)** was placed by the owner at the repo root as `orchestrator_prompt.md` (untracked; left untouched). A committed, byte-checked copy is at `.claude/plans/orchestrator-v2/owner-brief.md`, and the earlier incomplete copy was deleted. Sections 97–101 add: an implementation procedure (inspect first, extend existing abstractions, no duplicate systems); a completion gate with simulations; 55 acceptance criteria; 24 anti-patterns; and the desired behaviour. None of them change the five decisions. **Machine facts:** only Claude Code 2.1.265 and Codex 0.153.2 are installed (no Gemini, Kimi or Grok CLIs, no provider API keys); Python 3.14, Node 26, Deno 2.9, PHP 8.5 and Swift 6.3 are available. Before recommending Python, the analysis must check whether the language's standard library can verify a signed catalogue (Python's cannot do Ed25519 without a package; Node's built-in crypto can). **Deep analysis started** (workflow `orchestrator-v2-deep-analysis`: a Fable analyst, then an independent Fable checker, read-only). Five decisions put to the owner: what to build it as (recommended: phased, documents and schemas then a Python 3 engine); remote catalogue plugin side only (recommended yes); learning data local only; defaults as a preset; version 2.0.0 on the same branch. The owner allowed bundling it with #45 and R1–R4. | Next: after the brief is saved, a deep analysis by sequential Fable agents (read-only). Planning waits for the decisions and the rest of the brief. |
| 12 | **New request (13 Sep):** list the owner's standard working-practice features, taken from the instruction block they pasted this session and their personal instructions, and show which the plugin already has. The owner then picks the missing ones to build. | **Mapped and shown to the owner — waiting for their choice.** Tracked in issue [#45](https://github.com/MWBMPartners/dev-team-plugin/issues/45); map committed in ef009c0. Two Fable agents in turn (map, then an independent check; no status changed). 36 features: 8 already in the plugin, 22 partly, 5 missing, 1 opposite (F13, push after each task, against "never auto-push"). Full detail with evidence: `.claude/plans/owner-standard-features/feature-map.md`. Choices put to the owner: F13 as a setting (off or on by default); F10 Codex replacing, or in addition to, the Claude checker; F5 "one after another" for analysis and planning only, keeping debates side by side; F7/F8 cheaper building as the built-in default or a per-project setting. Nothing is built until the owner picks IDs. |

## Baseline before any build change (13 September, commit 9830e8e, run in a separate copy of the branch)

`scripts/audit-model-ids.sh` AUDIT OK · `tests/smoke-structure.sh` SMOKE OK · `shellcheck` clean ·
`bats tests/scripts.bats` 17 of 17 passed. So any failure from here on was introduced by this work.

## Checked while stage 1 runs

- **Every file is assigned.** 45 tracked files mention one of the seven names (`.claude/` not
  counted), and each one falls into exactly one work package's file list. None is left unassigned.
  Largest: `README.md` 44 lines, `skills/dev-team-review/SKILL.md` 24, `conventions.md` 20.
- **The mentions most likely to be project files are not.** The mentions in the ship, docs and ci-medic
  skills and in the small orchestrator references were read one by one. All of them mean the plugin's
  own `PROJECT.md` record, not a project's own file, so no exceptions are needed in stage 2. The stage 2
  briefs still tell builders to leave, and report, any mention that means a project's own file.
- **Codex is signed in** (`codex login status`: "Logged in using ChatGPT"), so the review step can run.

## What to do next

**Current (latest):**

- **All three build stages are committed and pushed.**
  - Stage 2: fc23f11, 7195f7b, 85195f2, 0b03ee4, 5dfb138, 0cc44d1.
  - Stage 3: 5e85c43 (tidy-up pass and the Findings heading), c5f76d9 (README, CHANGELOG, version
    1.5.0 and the self-check script — one commit, because both builders edited the same three files).
  - Checks rerun by the lead: audit-ledger-paths OK, audit-model-ids OK, smoke OK, shellcheck clean,
    bats 47 of 47, workflow YAML parses, README links resolve.
- **Codex review round 1, first attempt: FAILED — no review happened.**
  `codex review --base main "<instructions>"` is refused by Codex CLI 0.153.2 with
  `the argument '--base <BRANCH>' cannot be used with '[PROMPT]'`. A branch review and custom instructions cannot
  be combined in `codex review`. Do not retry that form.
- **Codex review round 1, now running as two read-only reviews side by side:**
  - (a) `codex review --base main` — Codex's built-in reviewer, with no custom focus. Output goes to
    the scratchpad file `codex-review-1a-builtin.out`.
  - (b) `codex exec -s read-only -C <repo> -o <file> -` — fed the focused instructions
    (`codex-exec-prompt.md`, built from `codex-review-prompt.md` plus "read `git diff main...HEAD`
    yourself, change nothing"). Its final message goes to `codex-review-1b-focused.md`.
  - If the scratchpad is gone, rerun both with the same focus: stale instructions, hook correctness,
    move-ledgers safety, the audit script, schema against example, CI, and claims in README and
    CHANGELOG.
  - **Set aside (stopped by the lead):** both of those runs printed `reasoning effort: none` in their
    startup banner. That is this machine's Codex default, and it would likely give a shallow review.
    Both were stopped after about two minutes, before reporting anything.
  - **Rerun at high effort** by adding `-c model_reasoning_effort='"high"'` to both commands. Output
    goes to the scratchpad files `codex-review-1a-builtin-high.out` and
    `codex-review-1b-focused-high.md` (with `.log`). Always pass that setting for Codex reviews on this
    machine, and check the banner shows `reasoning effort: high`.
- **HAND-OVER (13 September, 18:43 BST): Codex is out of usage credit.** Both high-effort runs stopped
  with "You've hit your usage limit … try again at 9:30 PM". Neither produced a review. **No Codex
  review of this branch has happened.**
  - **Fallback, per the standing hand-over rule:** a read-only workflow (`fallback-review-ledger-clashes`).
    Five fresh Fable reviewers, one per risk area, none of them builders and none with any memory of
    building this. An Opus refuter per area then tries to disprove every finding, and only confirmed
    findings get fixed. The areas are: instructions, the hook, the move command, the checks/CI/schema,
    and README/CHANGELOG claims.
  - **This is NOT the independent cross-system review the owner's rule asks for.** Treat the branch as
    **not fully reviewed** until Codex has done a full catch-up review. Say so in every commit
    message and report until then.
  - **Go back to Codex after 21:30 BST.** Run a FULL review of the whole branch against `main`, not
    just the latest fixes: both forms, at high effort. A wake-up is booked for 21:37 BST (scheduled
    job `cab4a9d3`, one-off).
  - **Fallback review round 1 is done** (workflow `wf_5f68c5e8-6ce`): 15 findings confirmed (1 high, 8 medium,
    6 low) and 18 refuted. Full detail: `.claude/plans/ledger-file-clashes/fallback-review-1.md`. Together with
    the lead's three remaining fixes, that makes 18 fixes.
  - **Fix round 1 is running** (workflow `fix-round-1-ledger-clashes`):
    - First, side by side: hook and tests (Sonnet), and the canonical rules with their dependents (Opus).
    - Then, side by side: the move-ledgers command (Sonnet), and README/CHANGELOG (Sonnet).
    - When it reports, rerun all checks, read the diffs, commit per builder with "not fully reviewed —
      Codex out of credit" in each message, push, and wait for the Codex catch-up review.
    - **Extra check after the fix round:** run `git grep -n "dev-template" -- . ':!.claude/'` and
      expect nothing. The `.claude/` folder is left out on purpose, because this note has to name the
      typo to describe it. The
      lead's fix brief mistyped the folder name as "dev-template" in three places (fixes B2, B3 and
      D8). Builders read the real files, so it is probably harmless, but the ledger-path audit would
      not catch that name if it were copied into a document. Any hit must be corrected to "dev-team".
  - **Fix round 1 result (workflow `wf_f1d2f362-737`):**
    - Finished: the hook + tests builder (56 tests), the canonical-rules builder (Opus) and the
      move-ledgers builder.
    - **The README/CHANGELOG builder FAILED on a Claude usage limit** ("session limit · resets 9:20pm").
      Claude hand-over event: rerun that builder after the reset (fixes D1–D8 in the workflow script),
      then commit.
    - **Update, 21:45:** usage credits are replenished and the owner asked to carry on.
      - **Committed and pushed:** 0a2f286 (hook + tests), e062725 (canonical rules + dependents),
        202bd2d (move-ledgers). Checks rerun by the lead: audit-ledger-paths OK, audit-model-ids OK,
        smoke OK, shellcheck clean, bats 56 of 56, no "dev-template" outside `.claude/`, and both
        refusal-prompt copies identical.
      - **README/CHANGELOG:** the failed builder had left sound partial edits (D1, D3–D7 mostly
        done). A fresh Sonnet builder is finishing D1–D8 in README.md, CHANGELOG.md and
        CONTRIBUTING.md.
      - **Codex:** a tiny test request returned OK, so Codex is available again. Its FULL catch-up
        review of the whole branch starts once the README/CHANGELOG fix is committed.
      - **Update, about 22:10:**
        - README/CHANGELOG are committed (daa25c7, all checks pass). The brief and the R1–R4 map are
          committed (786bee2).
        - **CORRECTION — Codex review round 2 did NOT happen.** The single high-effort run (started
          21:51) stopped at once with "You've hit your usage limit … try again at Sep 14th, 2026
          2:31 AM". An earlier commit (fa7b649) said this review "is running"; that was written before
          the check and is wrong. No announcement was posted on issue #41, because the check that
          guards it held it back.
        - **Hand-over again, per the owner's rule.** The review had not started, so the brief's
          12-hour "pause the phase and wait" rule does not apply. The next most independent reviewer
          is used now: workflow `fallback-verify-fix-round-1`. A fresh Fable reviewer checks whether
          fix round 1's 18 fixes really work and whether they introduced new problems, and an Opus
          refuter challenges each finding. It is read-only.
        - **Codex catch-up:** a one-off wake-up is booked for 02:37 BST on 14 September (job made by
          CronCreate; it exists only in this session). It runs ONE full review of the whole branch.
          If this session has been closed, start it by hand: `codex exec -c model_reasoning_effort='"high"'
          -s read-only` with the focused prompt (see memory note `codex-cli-review-gotchas`).
        - **Stand-in verification result (about 22:35):** all fixes from round 1 are confirmed fixed
          (one README guard description only partly). Six new problems were confirmed (1 medium, 5 low):
          - Rule 1 lost README.md protection;
          - an unbound-variable message under bash 3.2;
          - an absolute `/.dev-team/…` path is judged to be inside the project;
          - the move-ledgers decline is never committed and the rollback mishandles it;
          - one README row still describes only the Bash guard;
          - two tests do not prove the path resolver works.

          Saved at `.claude/plans/ledger-file-clashes/fallback-review-2-verify.md`. **Fix round 2 is
          running** (workflow `fix-round-2-ledger-clashes`): a Sonnet builder on the hook and tests,
          and a Sonnet builder on conventions, config-and-toggles, README, CHANGELOG and move-ledgers.
          When it reports, rerun all checks and probe the hook under /bin/bash, then commit per builder
          (stating "not fully reviewed"), push, and update #41.
        - **Fix round 2 DONE (about 23:15):** committed as two commits (hook + tests; then docs, rules
          and move-ledgers), pushed, and #41 updated.
          - Lead's checks: audit-ledger-paths OK, audit-model-ids OK, smoke OK, shellcheck clean,
            bats 63 of 63.
          - Hand probes under /bin/bash 3.2.57 and bash 5.3.15 are identical: empty-resolving paths
            exit 0 with empty stderr; top-level README.md with the marker exits 2;
            `/.dev-team/SECURITY.md` exits 2; an absolute path inside `<cwd>/.dev-team/` exits 0.
          - No "dev-template" outside `.claude/`.
          - **Verified (about 23:25):** tests now need bats ≥ 1.5.0 (`run --separate-stderr`).
            GitHub's `ubuntu-latest` is Ubuntu 24.04 (runner-images README), and Ubuntu 24.04
            "noble" ships `bats 1.10.0-1` (packages.ubuntu.com), so CI is fine. Caution: Ubuntu
            22.04 "jammy" ships bats 1.2.1, which is too old. If the workflow is ever pinned to
            `ubuntu-22.04`, the minimum-version line will fail it on purpose.
          - **#41 is now waiting only for Codex's catch-up review** (booked for 02:37 on 14 September).
        - **02:37, 14 September — Codex review round 3 STARTED and confirmed.** One `codex exec` run,
          high effort, read-only, focused prompt `codex-exec-prompt-2.md`, covering the whole branch
          against `main` (from commit 4a5530c). Its banner says `reasoning effort: high` and there is
          no limit error; it is actively reading. Output goes to the scratchpad files
          `codex-review-3-focused.md` and `.log`. #41 has been told. **Next:** read the final output,
          verify each finding against the files, have a Sonnet builder fix confirmed ones, rerun every
          check, commit (stating the review status), and run one more Codex review if the findings
          were substantive.
        - **02:39 — Codex review round 3 FAILED, but not on credit.** The configured model
          `gpt-6-astra` returned "ERROR: Selected model is at capacity. Please try a different model."
          after about 30,600 tokens of reading, and wrote no review (exit 1, no output file). This is a
          provider capacity problem (in the brief's terms a transient provider failure or brownout),
          not a usage limit. **No Codex review of this branch has happened yet.** The review had not
          produced anything, so the brief's pre-phase fallback applies: retry with an equivalent model
          from the same Codex runtime, chosen from `codex debug models`, not guessed. It is still
          cross-provider, since Claude built the work. #41 is updated once the retry is confirmed
          running.
        - **02:40 — Codex review round 3b STARTED on `gpt-5.6-sol` and confirmed** (02:41: banner
          shows that model, `reasoning effort: high`, `sandbox: read-only`, no capacity or limit
          error, log growing). #41 has been told. Output goes to the scratchpad files
          `codex-review-3b-sol.md` and `codex-review-3b-sol.log`. **If this session is interrupted:** do NOT
          start another Codex run until that log shows `CODEX EXIT`. If it finished, read the `.md`.
          If it failed, read the log tail for the cause, then retry once (next visible model by
          priority, or wait for a stated reset).
        - **02:51 — CODEX REVIEW ROUND 3 COMPLETED** (gpt-5.6-sol, high effort, exit 0). This is the
          first real cross-system review of #41. **14 findings (6 high, 5 medium, 3 low).** Saved at
          `.claude/plans/ledger-file-clashes/codex-review-3.md`, and #41 has been told.
          - High: move-ledgers mixed-file misclassification (1); a half-done move from an ignored or
            untracked source (2); `reset --hard` rollback can erase unrelated work (3); hook bypass
            when cwd is a repo subdirectory (5); the ownership rule applies line-2 markers to
            autopilot.json and .gitignore (8); bats cleanup deletes `.claude/agents` (11).
          - Medium: ignored config.yml on the no-move decline path (4); symlinks (6); legacy marker
            missing from Rule 1 (7); README bare ledger destinations plus audit blind spot (9);
            verdict schema allows impossible verdicts (12).
          - Low: check E too broad (10); critical-DRIFTED schema description (13); `guard: auto`
            comment (14).
          - Codex could not run bats (sandbox), so the lead must.
          - **Now:** workflow `verify-codex-review-3` — three Opus verifiers (move-ledgers 1–4; hook
            5–7; rules, README, audit, tests and schema 8–14), read-only. Each confirms or refutes,
            marks introduced vs pre-existing, and writes a fix spec. **Then:** Sonnet builders fix
            the confirmed findings; rerun every check; commit stating "Codex round 3 findings fixed,
            re-review pending"; run ONE more Codex review (use `-m gpt-5.6-sol` if gpt-6-astra is still
            at capacity; mind the allowance).
        - **About 03:10 — verification of Codex round 3 done** (`wf_3351eee1-ec9`, three Opus
          verifiers). 13 confirmed; #6 (symlinks) partly confirmed and recorded as a stated limit. #5 is
          worse than reported: from a subfolder the hook also refuses the plugin's own correct writes and
          ignores `guard: off`. #9, #11 and #14 were partly pre-existing on main. Saved at
          `codex-review-3-verification.md`, with the full fix specs. #41 has been told.
        - **Fix round 3 running** (workflow `fix-round-3-codex-findings`).
          - Stage 1, side by side:
            - move-ledgers 1–4 (Opus): rollback restores only its own paths, never a blanket
              reset --hard;
            - hook 5–7 (Opus): git --show-prefix for the repo top folder; the legacy marker; a symlink
              limit note;
            - docs, audit and schema 8–10 and 12–14 (Sonnet).
          - Stage 2: a Sonnet builder owns tests/scripts.bats and tests/README.md (#11's scratch-tree
            audit tests, plus new tests for the other findings).
          - **When it reports:** rerun every check and run bats yourself (Codex could not). Probe the
            hook from a subfolder under bash 3.2 and 5. Read the move-ledgers rollback text carefully.
            Commit per builder with the review status. Then ONE more Codex review (gpt-5.6-sol if astra
            is still busy).
        - **Stand-in verification of fix round 3 DONE** (`wf_0ba23093-a39`; record
          `standin-verify-fix-round-3.md`, committed after the model-id audit passed). All 14 Codex
          round-3 findings are confirmed fixed (#6 as a limit). **7 new problems confirmed:**
          - (high) the subfolder fix refuses writes to a session-folder `.dev-team/` and ignores
            `guard: off` there;
          - (medium) the rollback's single `git restore` aborts on a never-existing path;
          - (low) a half-failed stamp makes the rollback refuse;
          - (medium) the "never touches repo" tests catch too little;
          - (low) check-verdict.sh uses the wrong exit code for invalid JSON;
          - (low) a trailing-slash cwd;
          - (low) three missing pinning tests (symlink, check G, wrapped sentence copies).

          One claim was refuted (E/G heuristics).
          **Fix round 4 running** (`fix-round-4-standin-findings`):
          - stage 1: hook (Opus) and move-ledgers rollback (Sonnet);
          - stage 2: tests plus the check-verdict.sh exit code (Sonnet).
          **When it reports:** rerun every check and probe the hook from a subfolder yourself, then
          commit per builder. The Codex retry at 07:38 must not start while fix round 4 is mid-edit.
          If it fires first, wait for the commits, and update `codex-exec-prompt-4.md`'s "what is new"
          header to include rounds 3 and 4.
        - **About 04:10 — Fix round 4 DONE, committed and pushed** (`wf_85b8f0ab-fe0`):
          - 960ef64 hook: a session's own `<subfolder>/.dev-team/` counts as inside; `guard:` read from
            both configs ("off" wins, "on" in either); loop.lock in either place; one trailing slash
            stripped.
          - 6f9d1ab move-ledgers: rollback is per path, gated on `git cat-file -e <H0>:<path>`: restore if
            it was in H0, otherwise `git rm -qf --cached --ignore-unmatch` + `rm -f`. A failed git mv adds
            nothing to the list. A half-failed write clears its recorded id. The by-hand recovery text
            deliberately omits `-f`, so a person cannot discard someone else's staged work.
          - 8be396b tests + `check-verdict.sh` (invalid JSON now exits 2). Broadened "never touches repo"
            patterns, and 16 new tests.
          - **Lead's checks before committing:**
            - audit-ledger-paths, audit-model-ids and smoke all OK;
            - shellcheck clean;
            - bats **121 of 121**;
            - no "dev-template";
            - check-verdict gives exit 2 on `{not json`;
            - 7 hand probes of the hook from a subfolder, all correct under bash 3.2 and 5: its own abs/rel
              `.dev-team/` write allowed; `../SECURITY.md` and the `src/.dev-team/../SECURITY.md` trick
              refused; `guard: off` in the subfolder honoured; trailing slash plus top-level lock refused;
              a person's own notes.md allowed.
          - #41 updated. **Not reviewed by a second system** — fix rounds 3 and 4 both wait for Codex.
          - `codex-exec-prompt-4.md` header now lists fix round 4's commits and 121 tests.
          - **Next:** at 07:38, run ONE `codex exec -m gpt-5.6-sol -c model_reasoning_effort='"high"' -s
            read-only -C <repo> -o <scratchpad>/codex-review-4.md - < codex-exec-prompt-4.md`. Confirm
            the banner and that there is no limit error before telling #41. Verify each finding against the
            files, fix, and review again. Until then, nothing else on #41 needs doing. Orchestrator (#46)
            waits for the owner's D1–D4.
        - **07:38, 14 September — Codex review round 4 STARTED and confirmed** (attempt "4b").
          - At 07:38:27 the banner showed `model: gpt-5.6-sol`, `reasoning effort: high`,
            `sandbox: read-only`. At 07:38:45 there was no "You've hit your usage limit", "at capacity" or
            `ERROR:` line, the log was growing (361 KB → 398 KB) and the process was alive. #41 told.
          - Output goes to the scratchpad files `codex-review-4b.md` (final message) and `codex-review-4b.log`.
            The log ends with a `CODEX EXIT <code>` line when it finishes.
          - **Trap found:** a plain grep for "usage limit" in the log matches Codex printing this branch's
            own commit messages (9713e65 mentions a usage limit). Match the real error wording instead:
            "You've hit your usage limit", "Selected model is at capacity", or a line starting `ERROR:`.
          - **Do not commit while it runs.** This handover note is left uncommitted on purpose. Codex
            reviews `main...HEAD`, so a new commit mid-review would change what it is reading. Commit this
            note straight after `CODEX EXIT` appears.
          - **If this session is interrupted:** do NOT start another Codex run until the log shows
            `CODEX EXIT`. If the exit code is 0 and the `.md` exists, verify its findings. Otherwise read
            the log tail for the cause, record it here and on #41, and book one more single try after any
            stated reset.
        - **07:50 — Codex review round 4 did NOT finish. Usage limit hit mid-review.** It read for 12 minutes
          (284,405 tokens), then: "ERROR: You've hit your usage limit … try again at 12:35 PM". Exit 1, no
          `codex-review-4b.md`. **Codex has still not reviewed fix rounds 3 or 4.** #41 told.
          - **Salvaged from its log** (Codex's own progress messages; not a finished review, so unverified).
            It said it had confirmed two regressions by direct probes:
            - (lead A) with the guard active, a record id `F-001` is caught, but `F-1000` gets through. The
              pattern `[0-9]{3}\b` needs exactly three digits;
            - (lead B) a session rooted in a repo subfolder can write an `F-001` edit to that subfolder's own
              `SECURITY.md`, although fix round 4 now treats `<subfolder>/.dev-team/` as the session's
              legitimate plugin folder.

            It also noted that audits, smoke and shellcheck pass. It was still checking whether the verdict
            schema accepts a `FAIL` when neither failure condition holds.
          - **False lead, checked:** the README text about `HANDOFF.md` at a "repo-root path", which Codex
            was reading, is `main`'s old text. The current branch no longer has it (grep finds nothing).
          - **Hand-over, per the rule:** workflow `standin-verify-fix-round-4`, read-only. A fresh Fable
            reviewer checks fix round 4's seven fixes, tests leads A and B, checks the schema FAIL question,
            and looks for new problems. Then an Opus refuter challenges every finding. The record is to be
            saved as `.claude/plans/ledger-file-clashes/standin-verify-fix-round-4.md`, after the model-id
            audit passes.
          - **Codex retry:** ONE run booked for 12:40 on 14 September (CronCreate, this session only). Output
            goes to `codex-review-4c.md` / `.log`. Before it starts: no fix round may be mid-edit, and the
            prompt header must list any new commits. If this session was closed, start it by hand after 12:35.
        - **About 08:15 — stand-in check of fix round 4 DONE** (`wf_f635152a-33a`). Record:
          `.claude/plans/ledger-file-clashes/standin-verify-fix-round-4.md`.
          - Fixes 1–4, 6 and 7 are confirmed fixed. Fix 5 is only partly fixed: an EMPTY verdict.json still
            exits 1, because `jq empty` accepts empty input.
          - All three Codex leads were upheld, plus three new findings. The refuter confirmed or partly
            confirmed all six:
            - **B (medium):** in a subfolder session, Rule 2 guards only the git top's names, not
              `<sub>/SECURITY.md` etc. Yet round 4 treats `<sub>/.dev-team/` as the plugin's home, and
              the skills write relative paths. The underlying problem is a three-way disagreement: the
              documents say the git top, the skills effectively use the session folder, and the hook
              mixes both.
            - **A (low):** the id pattern `[0-9]{3}\b` misses F-1000. Fix: `{3,}`, matching the schema.
            - **C (low):** the verdict schema accepts FAIL with no cause. Add a 4th allOf rule plus fixtures.
            - **N1 (low):** the by-hand recovery text lacks `-f`. A FULLY stamped moved file needs it too,
              since the index holds git mv's copy until step 9's `git add`.
            - **N2 (low):** empty file or `{} {}` → use `jq -s -e 'length == 1 and (.[0] | type == "object")'`,
              exit 2.
            - **N3 (low):** the hygiene patterns miss `${MOVE_LEDGERS_MD}`, cp/mv onto it, `( cd "$REPO_ROOT"
              && write )`, sed -i, and git -C. The descriptions over-claim.
          - **Lead's decision on B (additive, no owner wait):** Rule 2 ALSO guards the session folder's own
            ledger names (not `<sub>/.github` or `<sub>/docs`). That only adds protection, so it is right
            whichever location the owner picks. **Owner question (asked, not blocking):** should a subfolder
            session's `.dev-team/` live in the subfolder (what skills do today) or at the git top (what
            conventions.md and /dev-team-move-ledgers say)? The lead suggests the subfolder, and
            /dev-team-move-ledgers then also looks there. The documents are not changed on that point until
            the owner answers.
          - **Fix round 5 running** (`fix-round-5-standin-findings`). Stage 1, side by side on separate files:
            hook A+B (Opus); schema, fixtures and check-verdict C+N2 (Sonnet); move-ledgers N1 plus Rule 2
            and id-width wording in docs and CHANGELOG (Sonnet). Stage 2: tests for everything, plus N3
            (Sonnet). **When it reports:** rerun every check, probe the hook from a subfolder yourself
            (session-folder SECURITY.md with F-001 and lock → refused; F-1000 → refused; `src/deep/` and
            `src/.github/` → allowed), commit per builder, push, update #41, update codex-exec-prompt-4.md's
            header. All of that must be finished before the 12:40 Codex retry starts.
        - **08:47 — Fix round 5 DONE, committed and pushed** (`wf_1faffad2-024`):
          - fc49383 hook (B additive subfolder names, sub name matched literally; A `{3,}`);
          - 8b0d080 schema 4th allOf rule, 2 new fixtures, and check-verdict `jq -s -e 'length == 1 and
            (.[0] | type == "object")'` → exit 2. Note: a bare `42` also exits 2 now, with the header
            changed to match;
          - 88d7d47 move-ledgers `-qf` in points 4 and 6, the Rule 2 wording in conventions,
            config-and-toggles and README, the id width sentence, and CHANGELOG;
          - 6414826 tests (the old subfolder test flipped to expect 2, plus the N3 hygiene checks). The
            test builder deliberately did NOT add sed/git to the command-word list: that gave false
            positives on the file's own read-only `git -C "$REPO_ROOT" branch` and `sed -n` lines, so it
            is a separate three-grep check. It also added a no-`cd`-into-$REPO_ROOT check that excludes
            two known read-only lines by exact text;
          - f646ff9 the verification record.
          - **Lead's checks:**
            - audits OK, shellcheck clean, bats **144 of 144**, no "dev-template";
            - check-verdict gives exit 2 on empty, whitespace, `{} {}`, `{not json` and `42`;
            - every fixture through both check-verdict and check-jsonschema (installed via Homebrew):
              every invalid one is rejected by at least one, every valid one passes both, and
              fail-without-cause is rejected by the schema only;
            - 9 hook probes from a subfolder, all correct under bash 3.2 and 5.
          - **Trap:** in a shell loop, `echo "$(basename "$f") -> $?"` prints basename's exit code, not the
            previous command's. Capture `rc=$?` first. The lead's first fixture loop showed all zeros for
            this reason.
          - #41 updated. `codex-exec-prompt-4.md`'s header now lists fix rounds 4 and 5, says Codex's own
            leads were confirmed, frames the subfolder-location question as an open owner question
            (report real damage, not the question), and says 144 tests.
          - **Next:** the 12:40 Codex retry (cron `911f360f`), output `codex-review-4c.md`. Nothing is
            mid-edit.
        - **03:29 — Codex review round 4 did NOT happen.** It started on gpt-5.6-sol (high effort,
          read-only) and stopped at once: "You've hit your usage limit … try again at 7:33 AM". No
          output was written.
          - **Hand-over:** workflow `standin-verify-fix-round-3` — a fresh Fable reviewer checks that
            each of the 14 round-3 findings is genuinely fixed and looks for new problems (the rollback,
            --show-prefix edge cases, schema and checker, rule copies, audit E/G, scratch-tree tests),
            and an Opus refuter challenges every claim. Read-only.
          - **Codex retry:** one run booked for 07:38 on 14 September (CronCreate; this session only).
            It uses gpt-5.6-sol and the prompt `codex-exec-prompt-4.md`. Update that prompt's "what is new"
            header if the stand-in round adds commits.
          - **Correction:** the fix round 3 entry below, the #41 comment and the commits said "about
            03:45". The clock showed about 03:28 when they were committed.
        - **About 03:28 (earlier written as 03:45) — fix round 3 finished and committed** (five commits: hook; move-ledgers;
          rules, docs, audit and schema; tests; the verification-record fix), pushed, #41 updated.
          - The lead reran every check before committing (all pass, including bats) and probed the
            hook from a subfolder by hand: 14 of 14 correct under bash 3.2 and 5.
          - Two lead-caught fixes:
            - the verification record contained a literal dated model id that failed audit-model-ids,
              now replaced with a placeholder. Lesson: run the audits before committing records;
            - README line 364 still described the rollback as `git reset --hard`, now replaced with
              exact text by a Haiku builder.
          - Deliberate cost of #1: CueRCode and Go2My.Link's unmarked PROJECT/FEATURES/SECURITY
            ledgers now sort as "mixed" and need their marker added by hand before
            /dev-team-move-ledgers will move them.
          - **Next:** ONE Codex review (round 4) of the whole branch, focused on round 3's fixes but
            reviewing everything. If gpt-6-astra is still at capacity, use `-m gpt-5.6-sol`. Watch
            the allowance: one run.
        - **02:40 — plan saved and posted.** `.claude/plans/orchestrator-v2/plan.md` and
          `plan-critique.md` are committed (2d58278, all checks OK, tail matches the returned text
          byte for byte, secret scan clean), and #46 has a summary. The plan is DRAFT until the owner
          answers D1–D4, then increment 0a hand-locks it.
        - **Orchestrator deep planning finished (about 23:00, 13 September)**, but the reviser's
          returned result was only the END of its plan (from partway through §5.2); the earlier
          sections were in earlier messages. The lead is rebuilding the full revised plan from the
          reviser's transcript. Draft (full, pre-critique) and critique are in the scratchpad as
          `orch-plan-draft.md` and `orch-plan-critique.md`. **Critique:** 3 blocking and 13
          important points, all applied by the reviser — the Claude pause cannot be recorded at the
          moment of exhaustion, so reclaim must always snapshot first; `git stash create` misses
          untracked files, so use a temporary-index snapshot; lock the plan by hand before any code;
          split increment 0 into 0a/0b; and others. Do not present or lock the plan until the full
          revised text is recovered and checked.
        - **Lesson:** on this ChatGPT plan, Codex's allowance runs out after about one high-effort
          whole-branch review, and the reset can be hours away. Plan Codex reviews as single, spaced
          runs, and save them for the most valuable check.
        - **The owner said to go ahead** with a thorough, sequential Fable analysis and then build the
          orchestrator features, integrated into the plugin. The lead will follow the checked
          recommendations for the five decisions, unless the owner objects. The engine language will be
          confirmed with the owner before building.
  - **The 21:37 Codex reminder fired.** The plan is to verify and commit the fix round, rerun the README
    builder, commit, and only then run Codex's full catch-up review. That way Codex's credit is spent on
    the finished branch, not on README errors already known. Codex availability was probed with a tiny
    request first.
  - **New owner request (about 21:40, 13 September):** a second standard prompt with ON/OFF defaults.
    - Its labels settle F13 (push after each task: ON) and F10 (Codex review loop: ON).
    - New features to map: R1 repo re-alignment (OFF), R2 issues and project-state sweep (ON), R3
      suggest new work (OFF unless a parameter is given), R4 evidence sources, no assumptions.
    - A read-only mapping is running (`owner-features-round-2`, sequential Fable map then verify).
    - **Question put to the owner:** should these defaults become the plugin's built-in defaults, or a
      named preset such as `profile: standard` in `.dev-team/config.yml`? The lead recommends the preset.
    - The lead decided, subject to the owner's objection: Codex review runs in addition to the Claude
      checker; analysis and planning run one agent after another; debates stay side by side.
  - **That booking exists only inside the Claude session that made it.** If the session was closed
    or restarted before 21:37, nothing will fire. A resuming session must start the Codex catch-up
    review itself, trying Codex first before anything else.
- **Known fixes the lead found**, deliberately NOT given to Codex so its review stays independent.
  Fix them in the same round as Codex's findings:
  1. CHANGELOG 1.5.0 says names are compared ignoring case "in the lookup order" too. Only Rule 2 of
     `hooks/guard-ledgers.sh` ignores case; its `.dev-team/` folder test is case-sensitive on purpose,
     and the lookup order says nothing about case.
  2. README "Upgrading from 1.4 or earlier" says "there's nothing you're required to do". That is wrong
     for old top-level files without the marker (CueRCode, Go2My.Link): the ownership rule makes a
     run stop and ask, and autopilot goes BLOCKED (`ledger-ownership`). Say so, and point to
     `/dev-team-move-ledgers`.
  3. The same section implies a hand-written `FEATURES.md` or `HANDOFF.md` is asked about. Under the
     command's rules, a file without a ledger's shape is "not ours" and left alone without a
     question; only look-alikes are asked about.
  4. README line ~141, the iterate skill's Cold-resume paragraph: "looks for a `PROJECT.md`" should
     be `.dev-team/PROJECT.md` (found through the lookup order).
- **When stage 3 reports,** follow the same steps as below, then run the Codex review loop:
  - `codex review --base main "<focus>"`;
  - fix what it finds with a Sonnet builder;
  - review again until a round comes back clean.
- **If Codex cannot run,** say so plainly in the commit message and report, use a fresh Opus reviewer that
  did not build anything, and treat the change as not fully reviewed.

The steps used after stage 2 (reuse them for stage 3):

1. Pull each builder's full report from the workflow's `journal.jsonl`, since the notification
   cuts long results short.
2. Rerun every check yourself:
   - `bash scripts/audit-model-ids.sh`
   - `bash tests/smoke-structure.sh`
   - `shellcheck scripts/*.sh hooks/*.sh tests/*.sh`
   - `bats tests/scripts.bats`
   - the scratchpad `check-ledger-mentions.sh` over every changed file
3. Read the diffs, not just the check results — at least the new `commands/dev-team-move-ledgers.md`,
   the hook fixes, and a sample of the document edits.
4. Commit each package on its own, adding only its files, in this order: the hook fixes, WP4, WP5a,
   WP5b, WP6, WP7. Then push.
5. Start stage 3: WP8 (README, CONTRIBUTING, tests/README, CHANGELOG, version 1.5.0), then WP3 (the
   self-check script and its tests), on Sonnet.

If the scratchpad has been cleared, the check script is gone. Its checks are described in plan.md
WP3 (checks C–F), so it can be recreated from there.

**WP3 moved to the end.** The self-check script's tests live in the same file as the hook's tests, and
they only pass once every document is updated. Building WP3 early would make each commit in between
fail its own tests, so it is built after WP8.

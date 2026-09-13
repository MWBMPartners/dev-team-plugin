---
description: Move dev-team ledgers written before v1.5.0 out of the top level of the project and into .dev-team/ — read-only preview by default, --apply to act. Moves only files proven to be the plugin's own, asks about look-alikes, never touches the project's own files or a file with dev-team records mixed into it.
argument-hint: [--apply]
---
Sort this repo's legacy root ledger files and, only with `--apply`, move the plugin's own ones into `.dev-team/`. Arguments: $ARGUMENTS (optional `--apply`; without it the command only reads and reports).

Every file the dev-team suite writes for itself lives in `.dev-team/` and carries the dev-team marker on line 2; a file at that path without the marker is never written to — the run stops and asks. See `dev-team-orchestrator/references/conventions.md`, "Where the plugin writes, and the ownership rule".

Read that section before acting — especially point 5 (files from before v1.5.0, the lookup order) and point 7 (the first write into `.dev-team/`). This command is point 5 done for all seven files at once. Where this file and `conventions.md` disagree, `conventions.md` is right and this file is the bug.

**Why the command exists.** Before v1.5.0 the suite wrote its ledgers in the legacy root location (the top level of the project). Projects keep their own files with the same names — a product feature list called `FEATURES.md`, a public security policy called `SECURITY.md`, a hand-written `HANDOFF.md` — and in one real project the plugin's findings were appended to the end of the project's public security policy. So this command must never decide by a file's name alone, and must never decide by "it looks like ours" alone either. Only the marker is proof. Everything else is a question for a person.

**What it looks at.** The seven names, at the top level of the repo only: `PROJECT.md`, `FEATURES.md`, `SECURITY.md`, `VERIFICATION.md`, `MIGRATION.md`, `HANDOFF.md`, `verdict.json`. Their new homes are `.dev-team/PROJECT.md`, `.dev-team/FEATURES.md`, `.dev-team/SECURITY.md`, `.dev-team/VERIFICATION.md`, `.dev-team/MIGRATION.md`, `.dev-team/HANDOFF.md` and `.dev-team/verdict.json`. It does not look in `docs/` or `.github/`: the suite never wrote ledgers there, and a `SECURITY.md` in either place is the project's public policy.

## 1. Safety checks before anything else

1. Find the top of the repo with `git rev-parse --show-toplevel` and work from there, so "top level" means the project's top level and not whichever subfolder the session happens to be in.
2. **Outside a git repo:** the preview (steps 2–3) still runs, because it only reads. `--apply` is refused, and the command says why: the move has to be a `git mv` in a commit so it can be seen and undone, and outside git there is no commit to undo.
3. **Dirty working tree** (`git status --porcelain` prints anything): `--apply` is refused, and the command says why: the move is made as one commit of its own, and uncommitted changes would either be swept into that commit or make it hard to tell the move apart from other work. Commit or stash first, then run it again. The preview still runs.
4. **On the default branch** (`main`, `master`, or `.dev-team/config.yml`'s `git.default-branch`): with `--apply`, say so and ask before committing there. The suite never merges to the default branch without asking, and committing straight onto it amounts to the same thing.
5. `--apply` is an explicit per-run argument, so it outranks `features.dry-run: on` in `.dev-team/config.yml` (the standard precedence chain in `config-and-toggles.md`). Without `--apply` nothing changes, whatever the config says.

## 2. Sort each file into one of four groups

Check the files in the order listed above. For each legacy root file that exists, decide its group with the tests below, **in this order** — the first test that matches decides. The tests are best-effort pattern matches. They only sort; they never give the command permission to move anything except group (a).

**Conflict first.** If `.dev-team/<name>` already exists as well, `.dev-team/<name>` wins (point 5, "Both exist"). Still sort the legacy root file so the report can describe it, but mark it **conflict — nothing will be moved** and leave both files exactly as they are. A person has to decide which one to keep.

**(a) Ours — will move.** The marker is there:
- For a markdown file: one of the first three lines contains `<!-- dev-team: ledger=<kind> schema=` where `<kind>` matches the file name (`project` for `PROJECT.md`, `features` for `FEATURES.md`, `security` for `SECURITY.md`, `verification` for `VERIFICATION.md`, `migration` for `MIGRATION.md`, `handoff` for `HANDOFF.md`), or one of the first three lines contains the legacy marker `<!-- dev-team-schema:`. Only the first three lines count, because the plugin's own documentation quotes marker lines further down inside examples, and a file that merely quotes the marker is not a ledger.
- For `verdict.json`: the file is valid JSON and has a top-level string field `"dev-team"` starting with `ledger=verdict `.
- A new-form marker that names a **different** kind (say `ledger=security` inside `FEATURES.md`) is not proof that this file is the ledger its name says. Put it in group (b) and show the mismatch in the question.

**(b) Looks like ours — ask.** No marker, but the file has the shape of the plugin's own ledger of that name, **and** nothing marks it as the project's own document. The shape tests (headings are matched ignoring case, heading level, numbering and emoji, because real ledgers decorate their headings, for example `## 🎯 Goal` or `## 6. 🎯 Findings register`):
- `PROJECT.md`: at least three `##` (or deeper) headings between them containing three different phrases from: "Goal", "Definition of done", "Stage plan", "Current status", "Decision log", "Checkpoint log", "Backlog", "Trajectory ledger".
- `FEATURES.md`: any feature-gap number (`FG-` followed by three digits), or a heading containing "In-scope gaps".
- `SECURITY.md`: a heading of any level containing "Findings" or "Coverage ledger", or a table row starting `| F-` followed by a digit.
- `VERIFICATION.md`: the text `OVERALL VERDICT`, or a table row starting `| V-` followed by three digits.
- `MIGRATION.md`: a heading containing "Stage Ledger".
- `HANDOFF.md`: a line starting `NEXT:` — the resume card's own line. A heading such as `## NEXT` does not count, because hand-written handovers use headings like that too.
- `verdict.json`: valid JSON whose top-level `overall` is `PASS`, `PASS_WITH_GAPS` or `FAIL`, with at least one of the top-level keys `claims`, `integration` or `counts`. (`counts` is there because verdict files written before the schema existed carry `counts` rather than `claims`.)

What marks a file as the project's own: its first level-one heading (the first line starting `# `) contains "Security Policy". That is the heading of a public security policy, which is exactly the file this rule exists to protect.

**(d) Mixed — needs a person; nothing will be touched.** Checked before (c). Either:
- the file passes a shape test above **but** is marked as the project's own (for example a public security policy with a `## Findings` register below it), or
- the file has **three or more lines** carrying a dev-team record number **of the kind that ledger holds** — `FG-` for `FEATURES.md`, `F-` for `SECURITY.md`, `V-` for `VERIFICATION.md`, `M-` for `MIGRATION.md`, `B-` or `G-` for `PROJECT.md`, each followed by three digits. `HANDOFF.md` and `verdict.json` have no record kind of their own, so this second test never applies to them.

Report the line number and text of the first line that passed a shape test or carries such a record number: that is roughly where the dev-team part probably starts, and it is where a person should look to cut it into `.dev-team/<name>` by hand.

- *Why the command refuses to cut it:* the boundary between the project's text and the plugin's records is a judgement about someone else's document. Getting it wrong either publishes security findings as policy or deletes part of the policy, and neither would be noticed until much later.
- *Rejected — counting any dev-team number, of any kind:* hand-written handovers and project notes legitimately mention record numbers in passing ("OIDC provider (G-001) built"). Counting every kind of number would call those files "mixed" and send a person looking for records that are not there. Only the numbers a ledger of that name actually holds suggest that records were appended to it.

**(c) Not ours — leave alone.** Everything else. The command writes nothing to it, moves nothing, and asks nothing.

Groups (c) and (d) are never moved, and nothing is ever written into them. If a person knows a (c) or (d) file really is a dev-team ledger, they can add the marker on line 2 by hand (or cut the dev-team part out into its own file) and run this command again.

## 3. Print the table

One row per legacy root file found: the file, its group, the reason (which test matched, or "no marker and no ledger shape"), the first three lines of the file, and, for (d), the line where the dev-team part probably starts. Then list:
- any `.dev-team/<name>` that already exists (and, for a legacy root file with the same name, the conflict);
- the `.dev-team/autopilot.json` values that step 5 would rewrite, before and after.

If no legacy root file with one of the seven names exists, say so plainly and stop — there is nothing to move.

**Without `--apply`, stop here.** Nothing on disk or in git has changed. Say what `--apply` would do.

## 4. With `--apply`: ask, then move

Ask every question **before** changing anything, so a "no" halfway through never leaves a half-done move.

1. **Each (b) file:** ask with exactly this prompt (fill in the angle brackets; the two choices, "(a)" and "(b)", are the prompt's own and are not the group letters above):

   > Found `<path>` but it has no dev-team marker, so I cannot tell whether it is this plugin's file or the project's own. First three lines: <lines>. Choose one: (a) "it is a dev-team file from before v1.5.0" — I will add the marker (and, for a top-level file, move it to `.dev-team/<name>`) and commit that on its own; (b) "leave it" — I will write nothing to it. I will not guess.

   Choice (a) → the file joins the move. Choice (b) → it is left exactly where and as it is, and never written to. There is no third answer: if the reply is unclear, treat it as "leave it" and say so.
2. **Pointer sentence (point 8 of the conventions section).** If `.dev-team/` does not exist yet, this run is the one that creates it, so offer to add this sentence, word for word, to each of `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md` and `GEMINI.md` that already exists:

   > Dev-team plugin state and the current handover live in `.dev-team/` — read `.dev-team/HANDOFF.md` first.

   Offer it; never add it silently. None of those files present → say so and do nothing; never create an instruction file just to hold the sentence.
3. If nothing is left to move (every file is (c), (d), a conflict, or a "leave it"), say so and stop without committing.

Then, for the files agreed to move (every (a), and every (b) answered with choice (a)), skipping any with a conflict:

4. **First write into `.dev-team/`** (conventions point 7): `mkdir -p .dev-team`; if `.dev-team/.gitignore` is absent, create it containing exactly one line, `loop.lock/`; if `.dev-team/README.md` is absent, create it with the fixed text from that section, copied from `conventions.md`, never retyped from memory. Never overwrite either file once it exists. Never edit the project's own `.gitignore`.
5. `git mv <name> .dev-team/<name>` for each file. Moving with `git mv`, rather than copying, keeps the file's history attached and makes the change show as a rename.
6. **Stamp the marker.** For a markdown file: if a marker (either form) is in the first three lines, remove that line; then make line 2 the new-form marker for its kind, exactly as listed in the conventions section (for example `<!-- dev-team: ledger=features schema=1.0 -->`), pushing the rest of the file down one line. Change nothing else in the file. For `verdict.json`: add the top-level field `"dev-team": "ledger=verdict schema=1.0"`, keep every other field and value, and confirm the result is valid JSON (`jq empty`). A verdict file written before `schemas/verdict.schema.json` existed may not match that schema; this command does not reshape it, because reshaping is the review skill's job on its next run.
7. **Rewrite `.dev-team/autopilot.json` values** (conventions point 5, last bullet). If the file exists and its `schema` major is `1` (or the field is missing, which counts as `1.0`): in the `queue` values, each `gate_ledger[].spec_ref`, and `trajectory_ref`, change each string value that is exactly one of the seven names, or starts with one of them followed by `#`, to the `.dev-team/` form — the legacy root value `PROJECT.md#Backlog` becomes `.dev-team/PROJECT.md#Backlog`. Only the value text changes; the schema stays `1.0`.
   - Rewrite a value only when its file now lives at `.dev-team/<name>` — moved in this commit, or already there. A value that names a file left at the legacy root (group (c), (d), a conflict, or "leave it") stays as it is and is listed in the report. *Why:* pointing it at a `.dev-team/` file that does not exist would quietly lose the reference to where those records actually are; the next autopilot RECORD resolves it through the lookup order, which asks rather than guessing.
   - Edit the values in place rather than re-writing the whole file through `jq`, so the diff shows only those values. Then check: the file is still valid JSON (`jq empty`), and apart from the rewritten values nothing changed (compare `jq -S .` of the old file, with the same rewrites applied, against `jq -S .` of the new one).
   - An unrecognised newer `schema` major → do not touch the file; say why (its shape may have changed underneath this command).
8. **Check what was written.** Re-read line 2 of every moved markdown file (for `verdict.json`, the `"dev-team"` field). If the marker is missing, report the move as failed and do not commit. Run `git check-ignore -q .dev-team/<file>` for each file; if one is ignored, add this warning to the report: "`.dev-team/<file>` is ignored by this repo's `.gitignore`, so it will not be committed and will not travel with the repo."
9. **One commit.** `git add` only the moved files, `.dev-team/.gitignore` and `.dev-team/README.md` if this run created them, `.dev-team/autopilot.json` if step 7 changed it, and any instruction file the user agreed to in question 2. Commit on the current branch with the message `dev-team: move ledgers into .dev-team/ (v1.5.0)`, and list every moved file in the message body. **Never push**; pushing stays the user's choice.

## 5. Report

What moved (from → to), what was left and why (group and reason), each (d) file with its line number and the words "needs a person to cut it by hand", each conflict, each `autopilot.json` value rewritten or left bare, any ignore-file warning, and the commit hash (or "nothing committed" and why).

## What this command cannot do

- **The shape tests are a best-effort pattern match, not proof.** A project's own file can happen to look like a ledger (it will be asked about, never moved without a yes), and a real ledger can fail every test (it will be left alone; a person can add the marker and run the command again). Only the marker is proof, which is why only (a) moves without asking.
- It does not look for ledgers anywhere except the top level of the repo, and does not follow submodules or nested repos.
- It does not cut a mixed file apart, merge a legacy root file into an existing `.dev-team/<name>`, or delete anything.
- It does not rewrite references to the old names inside the moved files or elsewhere in the project (for example a link in a project's own `README.md`); it lists none of them either. Readers accept both forms through the lookup order.

# Changelog

All notable changes to the dev-team plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Changed

- **The Bash guard now treats "a run is in progress" as "the folder `.dev-team/loop.lock/` exists"**
  (issue #44). It used to check for `.dev-team/autopilot.json`, but several projects keep that file in
  git, so the guard was on permanently there. The lock folder exists only while one cycle runs and is
  never committed. The ledger guard's second rule already used it. `DEV_TEAM_GUARD` and `guard: on` still
  force the guard on; `guard: off` still turns it off.
- **Wording fix (issue #48):** the text that said both guard hooks "fail open" was out of date. The ledger
  guard fails open; the Bash guard fails open too, except that it refuses a command it cannot finish
  checking (more than 10 pushes, or past its time limit). Fixed in `conventions.md`, the README and the
  pinned copy the tests compare against.

## [1.7.0] - <unreleased>

Adds the `dev-team-polish` skill. It was built on its own branch against 1.4.0, where it was numbered 1.5.0;
it is renumbered because 1.5.0 and 1.6.0 are already used by the ledger and language-policy work it ships with.

### Added

- **`dev-team-polish` skill** and **`/dev-team-polish`** command: find and fix the small details that make a
  web app look unfinished or AI-made. It boots the app, checks every public route in a headless browser at
  phone, tablet, desktop and odd viewports, and reports every finding with evidence and a severity under
  three headings: Blocked on me, Changed, Found. It covers default or preview domains; per-page titles,
  descriptions, favicons, Open Graph images and canonical URLs; 404, loading, empty and error states;
  heading order, alt text and sitemaps; console errors, leftover logs, exposed development files and
  oversized bundles; responsive layout and content edge cases; cross-page style drift; and buttons or links
  that do nothing. Modes: `audit`, `fix` (default) and `guard` (adds a browser regression spec to the
  project's existing PR CI job).
- **Polish reminder** (`hooks/polish-reminder.sh`, SessionStart, `features.polish-reminder`, default `on`):
  network-free and read-only. In a repo with tracked web files, it says a polish check is due when
  `.dev-team/polish-last-run` is missing or older than `defaults.polish-interval-days` (default 7), and tells
  the model to run it after the current request. Off-switch: `DEV_TEAM_NO_POLISH_REMINDER`.

## [1.6.0] - <unreleased>

This release builds on 1.5.0, which is itself not yet released (it is on the
`claude/ledger-file-clashes` branch). The two are kept as separate entries, and may ship together.

**Upgrading from 1.5 or earlier:** a `.dev-team/config.yml` written by `/dev-team-config init` in
versions 1.2 to 1.5 has every setting written out at its default. From 1.6.0 an explicit value there
outranks the project's own cautious instructions, so comment out (put `# ` in front of) every
setting you did not choose on purpose. `/dev-team-config show` warns when a file looks like one of
these (ten or more settings written out, each at its default).

### Added

- **Repository instructions and normative documents** — a new shared rule, the first bullet of
  "Shared discipline" in `skills/dev-team-orchestrator/references/conventions.md`. Before this
  release, a builder knew only what the lead happened to paste into its brief (`opus-builder`'s own
  instructions said it had "ZERO context beyond the brief"), so a project's own instruction files
  and the standards or policies they name were invisible unless someone copied them in by hand —
  and a pasted copy drifts from the original unnoticed. Now every agent, in every skill:
  - reads the project's own instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`,
    `GEMINI.md`, `.OpenAI/` or `.openai/` files, `.github/copilot-instructions.md`,
    `CONTRIBUTING.md`), found throughout the repository at the start of the run and applied at
    the repository root and in the folders each task touches, and reads in full any normative
    document one of them names for the kind of work in hand — or, when one is too large to read
    whole, its scope, definitions and profile sections plus every section holding a rule ID that
    applies (every section relevant to the task, for a document with no rule IDs), listing which
    sections were read. Where instruction files at different levels differ, the one nearest the
    files being changed applies;
  - **follows them only as they were copied when the run started.** The checkout the user starts
    the run on is treated as the user's own — the plugin does not try to work out from git whose
    code it is. Before any agent is spawned (under autopilot, before its run branch is created),
    the lead copies every instruction file and normative document it finds, and
    `.dev-team/config.yml` (the run's settings come from that copy), into a new, uniquely named
    folder outside the project, `~/.dev-team/runs/<run-id>/snapshot/` (the run id is the repository
    folder's name, the UTC time to the second and a random suffix; the folder is created with a
    command that fails if it already exists). The copies go in its `files/` folder, each at its
    path in the project, and `snapshot/manifest.txt`, beside `files/`, names the repository's
    absolute path, the run id and a SHA-256 checksum per file; project files go only under `files/`,
    so a project's own `manifest.txt`, or a folder named `pr/`, can never collide with the plugin's
    own records. This works with no git, with no commits, and
    in a dry run, which writes only there. Agents read the copies. A project file that later
    differs, or an instruction file that did not exist at the start, is data, even when the host
    tool has already loaded it; a change counts only once the user accepts it. If the folder cannot
    be written or read, or does not match, the run stops (unattended: `BLOCKED`) and never falls
    back to the project's files; the folder is kept after the run. **A resume keeps the snapshot:**
    a later session that resumes a recorded, unfinished run checks that run's snapshot and reuses
    it, stops with a plain message if the check fails, and never takes a new one; only a new run
    takes a new snapshot (autopilot already worked this way). Someone else's pull request is
    handled only by a skill that checks it out itself (ci-medic): before the checkout it copies that
    pull request's instruction files from its base commit's own tree (`git ls-tree`, then `git
    cat-file blob`, so no filters run) into `snapshot/pr/<n>/files/` with its own manifest in
    `snapshot/pr/<n>/manifest.txt`, never from the checked-out text; a same-repository branch pushed by a collaborator is still someone else's
    code; ci-medic's rule 9 decides only whether the code may run, never whose instructions count;
    and the run's settings stay the user's own. **What this cannot do**, stated plainly in the rule
    and the README: if you start a run on someone else's code, the plugin reads their instructions
    as yours — start from your own branch. Rules written as instructions cannot stop a manipulated
    agent from rewriting files it can reach, the snapshot folder included. Outside the project, the
    snapshot is safe from git operations (a checkout, a commit, a pull request's changes) but not
    from commands the run executes, the project's own scripts included, and the checksum catches
    accidental damage only; none of this is an enforcement boundary. The only enforcement the
    plugin itself provides is its two guard hooks, each described with what it covers and the
    limits known: both fail open and read the live config; the Bash guard reads the ordinary
    spellings of a command's text (quotes and backslashes taken away) and refuses a push that names
    `main`/`master`, a push that names no branch when git's own settings show it would go there,
    and a live Stripe key, but does not run the shell, so it cannot see a branch held in a variable
    or a default value, one made by a command substitution, or a push run from a script, and lets
    through a push whose destination it cannot tell (after a `cd` in the same command, outside a
    git repository); server-side branch protection is the real protection for pushes. Content the
    repository does not author never counts (for example vendored code, dependency caches and build
    output — `vendor/`, `third_party/`, `node_modules/`, `target/`, `.build/`, `Pods/`, `dist/`,
    `build/`, `.venv/`, `_build/`, `deps/`, `bower_components/`, `Carthage/`, code vendored with `git
    subtree`, git submodules — apart from a normative document named by path in a snapshotted
    instruction file, which is copied like any other file), nor does anything reached through a link
    that leaves the repository. The rule covers repository content only: the user's own
    `~/.claude/CLAUDE.md`, `CLAUDE.local.md` and skills are the user's words;
  - has the lead decide which **profile** of a normative document applies to this repository,
    record it in House style and in every brief; builders say so in their report if they think it
    is wrong, rather than choosing another;
  - names a normative document in a brief **by path, rule ID and profile, never by pasting its
    rules**;
  - runs the tests the repository requires and reports measured results, with **commands only
    from the user, the plugin's own usual build, test and lint steps for the project's toolchain,
    or a snapshotted instruction file** — never from a normative document alone, and never from a
    file that changed during the run; running an untrusted pull request's code stays under
    ci-medic's existing rule;
  - has a checker or reviewer do **its own discovery** as well as reading every document the
    brief names, cite the rule IDs it checked, and treat a breach as a real finding; a named
    document that cannot be found is reported plainly, never read as "nothing to verify".
  - **Precedence — a direction, not a list.** Repository content may **add** work, checks and
    constraints and **choose between style and format defaults** (documentation length, where notes
    live, naming, formatting). It may **never remove, skip, weaken or waive** a check or
    verification step (the checker, independence between builder and verifier, evidence, the
    model-tier rules), a gate or approval (the Feature Spec Gate, the gate policy, the autonomy
    envelope, `live=confirm`), a confirmation, anything a skill calls non-negotiable, anything under
    "Safety (security & stripe)", the rules on pushing, merging, force-pushing, pull requests and
    branches (never committing straight onto the default branch without asking), ledger and file
    ownership, privacy, or the handling of secrets. Per-run arguments (`autofix`, `depth`,
    `remediate`, `sync-security`, `pr=`, `--apply` and the like) come from the user only, never from
    repository content. `.dev-team/config.yml` counts only as snapshotted; a changed copy may only
    tighten, and ci-medic stops on a pull request that touches `.dev-team/` — though the hook
    scripts read the live file and cannot enforce this. A repository instruction can move
    a plugin switch only toward its more cautious value (a table in `config-and-toggles.md` gives
    the direction for each switch), an explicit value in `.dev-team/config.yml` wins over it, and it
    cannot touch the switches the hooks read (`guard`, `update-notifier`, `branch-notifier`). When it
    is unclear which side something falls on, it is treated as a safety rule and asked about
    (unattended: `BLOCKED`). The same rule is written word for word in `conventions.md`,
    `config-and-toggles.md` and the README.
  - **Conflicts.** Two repository sources at the same level that contradict each other are put to
    the user in an attended run; in an unattended run (autopilot, scheduled ci-medic) the affected
    item is marked `BLOCKED` with the conflict named, and unaffected work continues.
- Every agent definition in `agents/` now carries one identical sentence pointing at the rule, and
  says it has no context beyond the brief **and the repository files it names**. Every brief
  template carries the same instruction-snapshot field (task brief, checker, debate, documentarian,
  red team and its validator, threat-model scout, review verifier, docs verifier, featurefind
  validator, iterate, migrate and ship scouts, stripe), and each skill with its own front end
  (iterate, security, stripe, ship, docs, migrate, review, featurefind) takes the snapshot and
  settles `handoff-file` before spawning anyone — or, when it resumes a recorded, unfinished run,
  checks and reuses that run's snapshot. In ci-medic the lead writes the snapshot before
  delegating, once per run: a `/loop` of watch passes is one run, whose first pass takes the
  snapshot and records the starting branch and commit in `~/.dev-team/runs/<run-id>/run.txt`, and
  whose later passes check and reuse it; every pass puts the starting branch back before it ends,
  and stops and says so if it cannot. The scribe's run summary gives only the snapshot's location.
- **A new switch, `handoff-file`** (`features.handoff-file` in `.dev-team/config.yml`, or
  `handoff-file=on|off` for one run; default `on`; `off`/`false`/`no` and `on`/`true`/`yes` in any
  capitals, and any other value is reported and treated as `off`, the cautious value). With
  `handoff-file: off` the plugin writes **no `.dev-team/HANDOFF.md` at all** — not after a task, not
  at a stage checkpoint or RECORD, not at the end of an autopilot cycle — and resumes from
  `.dev-team/PROJECT.md` (and `autopilot.json` under autopilot) instead; `off` wins over
  `auto-handoff`, even a per-run `auto-handoff=on`. The `.dev-team/` pointer sentence is not offered,
  because it names that file, and no run — `/dev-team-move-ledgers` included — moves a legacy
  top-level `HANDOFF.md` into `.dev-team/`. A `.dev-team/HANDOFF.md` or pointer sentence left over
  is offered for removal in an attended run and reported in an unattended one. A project whose own
  instructions **explicitly** forbid a second handover gets `handoff-file: off` automatically,
  unless `.dev-team/config.yml` sets a value; an instruction that only says where notes live is
  asked about once (the answer is recorded in `.dev-team/config.yml`), or left at the default in an
  unattended run. The lead settles the value once per run and hands it to the scribe in its
  documentarian brief (a docs drafter's brief does not carry it). The same exception is written in
  conventions point 5 and the README's upgrade notes as well as in `/dev-team-move-ledgers`.
  The starter `.dev-team/config.yml` leaves the key commented out, like every other setting (see
  "Changed"), so `/dev-team-config init` does not write an explicit `on` that would overrule such a
  project; `/dev-team-config show` says
  plainly that it does not read instruction files. *Why:* turning auto-handoff off only stops the refresh after each task; the plugin
  still rewrote the file at every checkpoint, so a project that allows only one handover document
  still got a second one.

### Changed

- **`/dev-team-config init` writes an explicit value only for the keys the user chose** in that
  `init` conversation — a value they asked for, or their answer to the pointer-sentence or
  keep-`HANDOFF.md` question. Every other setting goes into the starter file commented out,
  showing its default; the starter schema in `config-and-toggles.md` now sets nothing but
  `version: 1`. *Why:* an explicit value in `.dev-team/config.yml` wins over the project's own
  instruction files, so writing every default out would let a freshly initialised config silently
  overrule a project's cautious instruction (a `CLAUDE.md` asking for a dry run first would have
  lost to an unchosen `dry-run: off`). `/dev-team-config show` still tags every value with where it
  came from; a commented-out line counts as not set, so it shows `(built-in default)`.
- **Where a project's own instructions explicitly forbid a second handover**, `handoff-file` is
  `off` for that repository (above), and the scribe never writes into the handover or
  session-notes file the project's own instructions name (that one file, not project documentation
  in general) — updating it is project work for a builder (`conventions.md`, "Auto-handoff";
  `documentarian-protocol.md`; `handoff-template.md`; `agents/sonnet-scribe.md`; autopilot's
  `loop-runtime.md`, `mission-and-done.md` and `SKILL.md`; the orchestrator's `SKILL.md`).
- The autopilot RECORD step now regenerates `.dev-team/HANDOFF.md` unless `handoff-file` is `off`.
  It used to say "when auto-handoff is on", which disagreed with the same file's own auto-handoff
  paragraph and with `conventions.md`, both of which say the RECORD regeneration happens either way.
- The fixed text of a newly created `.dev-team/README.md` now says "read HANDOFF.md first, or
  PROJECT.md if there is no HANDOFF.md". An existing `.dev-team/README.md` is never rewritten, so
  older copies keep the old sentence.
- **"Be concise"** in the docs skill's `doc-standards.md` now gives way when a project's own
  instructions ask for fuller explanations.
- The orchestrator reads a project's instruction files, and takes the snapshot, straight after its
  cold-resume check (it had said "before anything else", which clashed with the cold-resume check
  coming first).
- **The Bash guard (`hooks/guard-dev-team.sh`) reads a command the way the shell does.** It used
  to match the raw text and understood only double quotes, so `git push origin 'main'`,
  `git push origin \main` and `'git' push origin main` were all let through. It now takes quotes
  and backslashes away first (a quoted multi-word argument stays one word, so
  `git commit -m 'push to main'` is still allowed), reads a command string given to `sh -c` /
  `bash -c` or `eval` as well, and — for a push that names no branch (`git push`,
  `git push origin`, `git push origin HEAD`, `--all`, `--mirror`) — asks git, in the folder the
  command runs in, where it would push (the current branch, the branch it tracks, `push.default`,
  `remote.<name>.push`, and the command's own `-C` and `-c`), refusing it when that is `main` or
  `master`. Where it cannot tell (an earlier `cd` in the same command, a `GIT_*` variable set in
  it, not a git repository, a detached HEAD) it lets the push through, and its header, the README
  and `conventions.md` say so. The old raw-text check still runs, so nothing refused before is
  allowed now. Only the commands that need it are read word by word. (An earlier version of this
  entry said a long command was "still checked in about half a second"; that was measured on a
  short heredoc only. The stand-in review of 42bd45e..b39f40d measured about 21 seconds for a
  10,000-line heredoc, 5 to 9 seconds for a 129 KB commit message and 38 seconds for 200 bare
  pushes with macOS's bash 3.2 — see the next entry.)
- **The Bash guard is never abandoned for being slow.** Claude Code stops waiting for a hook after
  a while and runs the command anyway, so a slow guard is no guard. Its reader now works line by
  line and never builds up one long piece of text (the old one took the command apart one
  character at a time with a function that, in macOS's awk, measures the whole text on every
  call, so its time grew with the square of the command's length). It works out at most 10
  `git push` commands in one command, counting them before asking git anything; a command with
  more is refused with a message asking for it to be split. All its checking runs under a
  20-second limit (`DEV_TEAM_GUARD_TIME_LIMIT` can only make it shorter); past it the command is
  refused the same way, and whatever the check was waiting on is stopped. These two refusals fail
  closed on purpose. Measured (the middle of three runs each, on a Mac whose load average was
  12 to 25 on eight processors): with macOS's bash 3.2 and awk, a 10,000-line heredoc took 0.49
  seconds (21.8 before, with the load at 44), a 129 KB `git commit -m` message 0.39 to 0.44
  seconds (1.8 to 2.7 before, and 5 to 9 when the machine was busier), and 200 bare pushes were
  refused in 0.07 seconds (39.8 seconds, and allowed, before); on Linux (Ubuntu 24.04, mawk) the
  same took 0.20, 0.06 to 0.10 and 0.03 seconds, against 4.3, 0.7 to 1.0 and 14.1 before. A long
  git command was still slow on macOS after that: bash 3.2 saves a copy of a function's arguments
  on every function call made from inside it, so checking a `git add` that names 5,000 files took
  13 seconds and one naming 10,000 was refused on time. The guard now clears those arguments once
  it has them in a list, and calls its per-word helpers only for a word that could match (each
  of the two alone keeps it under the limit): the same commands now use 1.9 and 3.6 seconds of
  processor time, against 15 and 17 before, when both were refused at the 20-second limit. The
  test for a word that could be a shell is a `case` pattern, not `${word%sh}`: bash removes a
  suffix or prefix in time that grows with the square of the word's length (about 20 seconds for
  a 129 KB commit message), and a first version of this change that used it slowed that message
  from 0.7 to 6 seconds of processor time.
- **Every description of the guard hooks now says what they cover and the limits known.** (This
  entry first said "exactly what they cover"; the stand-in review of 42bd45e..b39f40d found
  spellings of main the Bash guard missed, so that claimed more than was true.) "This written rule is
  the real protection" is gone from `conventions.md`'s ownership rule (the written rule is what
  agents follow, not enforcement; the one hook enforces only the writes it can see), and ci-medic's
  rule 2 no longer says the hook "already blocks pushes to main".
- **The Bash guard reads more spellings of `main`, and says plainly what it cannot read.** Found by
  the stand-in review of 42bd45e..b39f40d, each let through before: bash's escapes inside `$'…'`
  (`git push origin $'\x6d\x61\x69\x6e'`, `$'\155ain'`, `$'\u006dain'` — the reader kept only the
  character after each backslash; it now works them out as bash does); a brace list
  (`git push origin {main,x}`); a push written out for a shell to read from its standard input
  (`echo 'git push origin main' | sh`, `sh <<< 'git push origin main'` — the check on the command
  text as written now treats single quotes and braces as separators too, and looks for the
  `git … push` through them); a `--` between `-c` and the command string
  (`bash -c -- 'git push'` — the shell's options are now read properly); and `/usr/bin/git` after
  a `cd`. The header, the README and `conventions.md` now say plainly that the guard reads the
  ordinary spellings of a command but does not run the shell, so anything the shell only works
  out while the command runs — a variable, a default value such as `${X:-main}`, a command
  substitution, braces that build a word from parts, a command string nested more than three
  deep — goes through; "quoted, escaped or not" and "lists exactly" are gone. The other way round,
  reading through quotes means a command that only spells out a push to main in single quotes
  (`git commit -m 'fix: push to main'`, `echo 'git push origin main'`) is now refused too, as the
  same text in double quotes already was; the header and the README say so.
- **The Bash guard follows git when a named branch has no destination.** `git push origin feature`
  does not always push to `feature`: git sends it through the remote's `remote.<name>.push`
  refspecs (the first whose source matches `refs/heads/feature`, or a `*` pattern), and failing
  those, under `push.default=upstream`, to the branch's upstream. The stand-in review of
  42bd45e..b39f40d found it let through while `remote.origin.push =
  refs/heads/feature:refs/heads/main` sent it to `main`; the guard now works the destination out
  the way git's own push command does (checked case by case against `git push --dry-run`) and
  refuses it when that is `main` or `master`. A negative refspec (`^…`) is not read, so a push it
  would exclude may still be refused.
- **Two misreadings in the Bash guard fixed** (the stand-in review of 42bd45e..b39f40d).
  `env -C <dir> git push` and `env --chdir=<dir> git push` run git in another folder, but the guard
  worked the push out in the folder the command started in; they are now treated exactly like a
  push after a `cd` — a push that names no branch is not worked out (a stated limit), and one that
  names `main` is still refused. And the reader's own marker lines could be spelled by a command:
  `git --work-tree @@SEP push` was read as two commands and let a bare push on `main` through.
  Every line the reader prints now starts with a letter saying what it is, and the marker for a
  redirection is a line break, which no word can contain.
- **ci-medic: an interrupted pass, and which repository a run belongs to** (the stand-in review of
  42bd45e..b39f40d). Before a pass checks out a pull request's branch it now writes
  `left checked out: <branch>` into the run record, `~/.dev-team/runs/<run-id>/run.txt`, and it
  removes that line once the starting branch is back. A new run first reads the run records for
  this repository: if one still names the branch that is checked out now, an earlier pass was
  interrupted part-way and this checkout is someone else's code, so the run does not start — it
  asks (unattended: `BLOCKED`). This reads the plugin's own records; it does not guess from git
  whose code a checkout is. The line that begins every pass report now names the repository
  (`ci-medic run <run-id> — started on <branch> at <commit> in <repository>`); a line for a
  different repository counts as no line, and the user can ask for a new run, which takes a new
  snapshot as a new run always does. "What this cannot do" now says plainly what an interrupted
  pass leaves behind, and that a missing or changed run record, or a branch checked out since,
  defeats the check — so check out your own branch after an interruption.
- **The short resume wording names the pre-1.6.0 case.** The eight skills' run-start lines, the
  orchestrator's setup step, `conventions.md`'s "Cold-resume" and the README's cold-resume bullet
  now add "(a run recorded before 1.6.0 has none: see step 1)" or the equivalent, so they agree with
  `conventions.md` step 1 and autopilot's `loop-runtime.md`: such a run has no snapshot to check —
  an attended run says so and takes one, an unattended one is marked `BLOCKED` (the stand-in review
  of 42bd45e..b39f40d).
- **Five more gaps in the Bash guard closed, and one over-block undone** (Codex's catch-up review
  of 748e87c..2f91439). A zero byte inside `$'…'` now ends that string, as it does in bash:
  `git push origin $'main\0ignored'` pushes to `main`, and the guard used to read "mainignored"
  and let it through. A remote set up as a mirror (`remote.<name>.mirror`, as
  `git remote add --mirror=push` writes it) is now read as pushing every branch, `main` included,
  so `git push backup` from a feature branch is refused when `backup` is such a remote. The
  20-second limit now covers everything the guard does once it is active — reading its input and
  asking `jq` included; before, a slow `jq` let a command through after the limit. Past the limit,
  whatever the check was waiting on is asked to stop and, one second later, made to (SIGKILL to
  its whole process group), so a program that ignores the request can no longer keep Claude Code
  waiting: the refusal arrives within the limit plus that second. And `git … push` is looked for
  inside one command only again, so `git status; echo 'push' 'main'` is allowed, as it was before
  the fourth round; every other refusal stays.
- **ci-medic never takes a new snapshot by accident** (Codex's catch-up review of
  748e87c..2f91439). If the conversation no longer shows the line that names a `/loop`'s run — for
  example after older messages have been summarised — a pass used to start a new run and take a
  new snapshot, so instruction files changed during the loop became instructions nobody accepted.
  Now it finds the run from the plugin's own run records: one open run for this repository is
  continued (the pass report says it was found that way), none means a new run, and more than one
  means it stops and asks (unattended: `BLOCKED`) rather than guess. The run record now says how
  the run was started; a run of one pass is marked `ended` when that pass ends, and a `/loop`'s run
  stays open until the user asks for a new run. The watch protocol, ci-medic's `SKILL.md` and the
  `/dev-team-watch-prs` command say the same, and "What this cannot do" says plainly what is left:
  after a `/loop` stops, a later session's first pass continues that run until you ask for a new
  one, and missing or changed run records leave nothing to find the run from.
- The iterate skill's audit gains a tenth dimension, **conformance** to the project's normative
  documents; the review skill gains a **conformance** claim type, and its reviewers do their own
  discovery even when House style recorded nothing.

### Files touched

`conventions.md`, `config-and-toggles.md`, `task-brief-template.md`, `checker-protocol.md`,
`documentarian-protocol.md`, `debate-protocol.md` and `SKILL.md` in the orchestrator skill; the
iterate skill's `SKILL.md` and `audit-and-backlog-protocol.md`; the security skill's `SKILL.md`,
`threat-model-and-surface-protocol.md` and `red-team-protocol.md`; the migrate skill's `SKILL.md`
and `migration-plan-protocol.md`; the ship skill's `SKILL.md` and `ci-setup-protocol.md`; the docs
skill's `SKILL.md`, `doc-standards.md` and `accuracy-verification-protocol.md`; the stripe skill's
`build-and-review-protocol.md`; the featurefind skill's `research-and-comparable-protocol.md`; the
review skill's `SKILL.md` and `claim-extraction-and-verification-protocol.md`; the orchestrator's
`handoff-template.md`; the autopilot skill's `SKILL.md` and `loop-runtime.md`; the
`/dev-team-config` and `/dev-team-move-ledgers` commands (the pointer-sentence offer, the starter
file, `show`, and a held-back `HANDOFF.md`); the `/dev-team-watch-prs` command; the ci-medic
skill's `SKILL.md`, `remediation-protocol.md` and `watch-and-schedule-protocol.md`; the autopilot
skill's `mission-and-done.md`; the stripe and featurefind skills' `SKILL.md`; all five files in
`agents/`; `hooks/guard-dev-team.sh` (the Bash guard) and a comment in `hooks/guard-ledgers.sh`;
`README.md`; `CONTRIBUTING.md`; `.claude-plugin/plugin.json` (version 1.5.0 → 1.6.0); and
`tests/scripts.bats`, `tests/fixtures/pinned-instructions.txt` and `tests/smoke-structure.sh`, with
`tests/README.md`.

### Tests

- Ten tests in `tests/scripts.bats` guard the rule, the `handoff-file` switch and the starter config
  file. Each earlier set passed a change that weakened the rule — headings only; then a few key
  sentences (words added passed); then brief fields by their opening words; then phrases inside the
  places that write `.dev-team/HANDOFF.md`; then, with whole passages pinned, text added NEXT to a
  pinned passage (a paragraph after a list, a new bullet before the next one, words appended to a
  neighbouring bullet). The pinned copies now live in `tests/fixtures/pinned-instructions.txt` and
  are checked three ways: 30 whole sections, each from its heading to the next heading outside a
  code fence (in `conventions.md` — its Cold-resume section included —, `config-and-toggles.md`,
  the README, the orchestrator, autopilot, ci-medic — its one-snapshot-per-run section included —,
  the documentarian protocol, the handoff template, the task-brief and checker templates,
  and `/dev-team-move-ledgers`); 11 passages inside larger sections, each compared whole together
  with the opening words of what follows it (the scribe's prompt, conventions point 5, autopilot's
  snapshot example, and the run-start line in eight skills); and the snapshot field as a whole list
  item in all 13 brief templates. Other tests check that the direction rule is written identically
  in three places, that no replaced wording or machinery remains (the trusted-base method, `git
  hash-object`, the seal, the old ledger section, guessed provenance, the old precedence wordings,
  "unless those instructions ask", the first snapshot layout's `snapshot/pr-<n>/` and "into the
  folder, keeping their paths"), the exact agent sentence in every file in `agents/`, the
  README's count of cross-cutting behaviours, the value rule for `handoff-file`, and a starter
  config file that sets nothing but `version: 1`. Every change listed in `tests/README.md` was made
  in a throwaway copy of the repository and made at least one of these tests fail. They check
  wording, not behaviour: they cannot show that an agent obeys the rule when it runs, and nothing
  enforces the rule except where a guard hook happens to cover it.
- Sixteen new tests for the Bash guard, each in a throwaway git repository with the machine's own
  git settings shut out: single quotes, backslashes, a quoted `git`, quoted refspecs, `sh -c` /
  `bash -c` / `eval`, and quoted text that only mentions `main` (allowed); a push that names no
  branch — bare, remote only, `HEAD` and `@`, `-C`, the hook input's `cwd`, `push.default=upstream`
  (also set with `-c` on the command), `matching`, `--all`, `--mirror`, `remote.origin.push` —
  refused when it would reach `main`, allowed when it would not, and the documented limits allowed;
  and a long command (2,000 simple commands, or a large heredoc) still read to the end. Twelve of
  the sixteen fail against the previous hook (the other four test allowed cases).
- Twenty-three more for the Bash guard after the stand-in review of 42bd45e..b39f40d, 39 in all:
  git's matching refspec; other spellings of `main` (`$'…'` escapes, brace lists, a push piped into
  a shell, `--` after `-c`) and the stated over-block; speed (a 10,000-line heredoc and a 129 KB
  message within the limit, a 5,000-file `git add`, the 10-push cap, a refusal on time with a slow
  stand-in `git`); a named branch mapped through `remote.<name>.push` or `push.default=upstream`;
  `env -C`; the reader's markers; one test for each planted fault that used to survive (nesting
  depth 3, the rule on the joined words, `pushRemote`/`pushDefault`, `--git-dir=`/`--work-tree=`,
  `/usr/bin/git`, `\"` inside double quotes, `master`); and three found by planting faults that
  undo this round's own fixes (an `eval` string with no other `git` word, a brace list quoted
  inside, and the push count taken before git is asked). Each fails against the hook before its
  fix. The speed tests judge the processor time the hook uses, not the clock, and a run the hook
  stopped at its time limit is skipped, never passed; `tests/README.md` explains.
- Six more after Codex's catch-up review of 748e87c..2f91439 (44 newer tests for the Bash guard
  in all, 52 with the eight older ones): a zero byte inside `$'…'`; a remote set up as a mirror
  (against a local bare repository, git's own dry run checked first); the time limit covering a
  slow `jq` and a slow read of the input; a program that ignores SIGTERM and holds the hook's
  output, which must not keep the caller waiting past the limit plus one second; `git` and `push`
  in separate commands (allowed) and in one (refused); and one checking that every place
  describing a ci-medic `/loop`'s run says a later pass finds its run from its run record. The
  three long-input tests now end with late cases that only the full reading catches
  (`ma"i"n`, and a bare push in a repository on `main`): with the reading cut off after 4,096
  characters, two of them used to pass. Each new test fails against the hook or the text before
  its fix, and with faults planted to undo it; `tests/README.md` lists them.
- `tests/smoke-structure.sh` now checks each required hook registration in `hooks/hooks.json`:
  Bash to `guard-dev-team.sh`, and Write, Edit and MultiEdit to `guard-ledgers.sh`, each by its
  exact command path. It used to ask only whether some matcher contained "Write", so removing the
  Bash registration or narrowing the ledger guard to Write alone still passed; both now fail.

### Fixed

- The README's count of cross-cutting behaviours: it said "Five" while listing six before this
  release; it now says "Seven" and lists seven, and says which apply to every agent and which to
  every building skill.

## [1.5.0] - <unreleased>

### Changed

- **Every file the plugin writes for itself now lives in `.dev-team/`.** `PROJECT.md`,
  `FEATURES.md`, `SECURITY.md`, `VERIFICATION.md` + `verdict.json`, `MIGRATION.md`, and now
  `HANDOFF.md` too, are all written to `.dev-team/<name>` instead of the top level of the project.
  The file names themselves are unchanged — the folder is what keeps them apart from a project's
  own files. Why: real projects keep their own files with these exact names — a product's own
  feature list called `FEATURES.md`, GitHub's public security policy (`SECURITY.md`, which GitHub
  reads from `.github/`, the top level, or `docs/` — never from `.dev-team/`), a hand-written
  `HANDOFF.md` — and before this release the plugin overwrote or appended to them without checking
  whose file it actually was. One real project had the plugin's security findings appended onto the
  end of its own public security policy. Rejected: renaming the files (fixes today's clash, not the
  next one with a name nobody has thought of yet); keeping them at the top level with a prefix on
  the name (still clutters the project, and a prefixed name can clash too); making the location a
  setting (a user only discovers the setting exists after the damage is already done). Full rule:
  `conventions.md`, "Where the plugin writes, and the ownership rule".
- **The ownership rule.** Every markdown ledger now carries a marker comment on line 2
  (`<!-- dev-team: ledger=<kind> schema=1.0 -->`), and `verdict.json` carries the same idea as a
  JSON field (`"dev-team": "ledger=verdict schema=1.0"`). Before writing anywhere in the ledger
  table, a skill reads the target file first: file absent → create it with the marker; marker
  present → it's the plugin's own, write it; **no marker → write nothing**, and ask a person which
  it is, rather than guess — guessing either way can damage a file the plugin does not own. An
  unattended autopilot cycle that hits this case goes `BLOCKED` (reason `ledger-ownership`) instead
  of guessing on its own. The security skill also now flatly refuses to write `SECURITY.md` at the
  top level, in `.github/`, or in `docs/` — the three places GitHub looks for a project's real
  security policy — even if asked to.
- **Files written before this release keep working.** A reader looks for `.dev-team/<name>` first
  and, only if that's absent, falls back to the old top-level `<name>`. A top-level file that
  already carries the marker is moved into `.dev-team/` and committed on its own — the first commit
  on the run's own branch, never straight onto the default branch without asking — the next time a
  run that actually writes ledgers touches it; one with no marker triggers the same ownership
  question above, and an unattended autopilot cycle that hits it goes `BLOCKED` (reason
  `ledger-ownership`) instead of guessing. **A read-only command or phase never does this move.**
  `/dev-team-status`, `/dev-team-report`, `/dev-team-approve`, the review skill's verification
  phase, and docs audit mode each promise to change nothing (or one named field); each of them now
  reads a marked legacy file exactly where it sits, moves and commits nothing, and reports the move
  as pending instead — "`<name>` is still at the top level of the project — run
  `/dev-team-move-ledgers` to move it into `.dev-team/`." Values inside `.dev-team/autopilot.json`
  written before this release (`queue`, `spec_ref`, `trajectory_ref`) that name a ledger without the
  `.dev-team/` folder in front are still accepted and are rewritten to the new form at the next
  RECORD step — but only once the file they name has actually moved; a value naming a file still at
  the top level is left as it is and called out in the report, rather than pointing at a
  `.dev-team/` file that doesn't exist yet.
- `hooks/guard-ledgers.sh`'s ledger-**name** matching (Rule 2, and now Rule 1's name test too)
  compares names **ignoring case**, because a filesystem that ignores case (macOS, by default)
  treats `security.md` and `SECURITY.md` as the exact same file on disk — matching capitals only
  would have let a write spelled in lower case walk straight past a check meant to protect that
  file. The hook's separate `.dev-team/` **folder** test stays case-sensitive on purpose: refusing
  a write to something that merely looks like `.DEV-TEAM/` is the safe direction to be wrong in.
  The lookup order (`.dev-team/<name>` first, then the legacy root `<name>`) is a plain, exact
  file-name match and says nothing about case either way.
- The `verdict.json` marker is recognised whether it's written with normal spacing
  (`"dev-team": "ledger=verdict schema=1.0"`) or as **compact JSON with no spaces at all**
  (`{"dev-team":"ledger=verdict schema=1.0"}`) — both are exactly the same content, and a stricter
  match would have missed the second, equally valid, form.
- The example `verdict.json` shown in the review skill's own protocol doc
  (`verdict-and-report-protocol.md`) is now real, valid JSON with real enum values that actually
  passes `schemas/verdict.schema.json`. The example was already valid JSON as written (`jq` parsed
  it fine) — the problem was that it used placeholder values (`PASS | PASS_WITH_GAPS | FAIL` and
  `V-0XX`) that the schema's enums and id patterns reject, so nobody could have copied it as a
  working starting point.
- The `HANDOFF.md` resume card's own Artifacts line now lists `MIGRATION.md` and `verdict.json`
  alongside the other ledgers, so a session resuming cold from the card can see at a glance whether
  those two exist for this project.

### Added

- `/dev-team-move-ledgers` (dry-run by default; `--apply` to act): sorts every legacy top-level
  ledger file into "ours — will move" (has the marker), "looks like ours — ask" (no marker, but has
  the shape of one), "not ours — leave alone", "mixed — needs a person" (a project's own document
  with dev-team records appended into it — the command refuses to cut that apart itself, because
  getting that boundary wrong either publishes findings as if they were policy or deletes part of
  the policy, and a person needs to make that call), or "conflict" (a `.dev-team/<name>` already
  exists — that copy wins, the legacy file is left exactly as it is, and it is never asked about,
  whatever else it also looks like). Files agreed to move are `git mv`d and, only once safely inside
  `.dev-team/`, stamped with the current marker form — moving first and stamping second, on purpose,
  because writing marker content to a file still at the top level is exactly what the ledger guard's
  Rule 1 refuses — then committed together in one commit, never pushed automatically. **Before
  touching anything**, it checks whether the project's own `.gitignore` would swallow any file it's
  about to move or create; if so, `--apply` refuses up front and reports which paths are ignored,
  rather than moving files somewhere git will never track. If the commit fails partway through, it
  rolls the whole attempt back (discarding only this command's own changes) rather than leaving a
  half-moved tree.
- **The `.dev-team/` pointer sentence.** Any interactive run that writes into `.dev-team/` —
  including autopilot's bootstrap and `/dev-team-config init` — offers, once per run, to add one
  fixed sentence — "Dev-team plugin state and the current handover live in `.dev-team/` — read
  `.dev-team/HANDOFF.md` first." — to whichever of `CLAUDE.md`, `.claude/CLAUDE.md`, `AGENTS.md` and
  `GEMINI.md` exist and don't already carry it. The trigger is "is the sentence actually missing
  from a file that exists", not "is this the run that first creates `.dev-team/`" — the rejected
  version of that trigger would have meant the offer could never come up again once the folder
  already existed, even on a project whose instruction files have never once seen the sentence. It
  only ever offers — it never adds the sentence silently — and a read-only command never offers it
  at all. **A decline is remembered**, so it isn't re-asked every run: choosing "no" sets
  `features.pointer-sentence: declined` in `.dev-team/config.yml` (creating a minimal file holding
  just `version: 1` and that key, if none exists yet) and says so; an unreadable config file counts
  as "not yet asked", so the offer can safely come back.
- `hooks/guard-ledgers.sh` (a new PreToolUse hook on `Write`, `Edit`, and `MultiEdit`), a second,
  independent layer behind the written rule above. Two separate checks, both best-effort and
  fail-open — never the guarantee, only a second line of defense:
  - **Rule 1** is on all the time unless `guard: off`: it refuses a `Write` only when **all three**
    hold — the new content carries the dev-team marker on one of its first three lines, the
    target's file name (ignoring capitals) is one of the seven ledger names **plus `README.md`**,
    and the path, once any `.`/`..` parts in it are worked out (`.dev-team/../SECURITY.md` starts
    with `.dev-team/` as plain text but names the top-level file), lands outside `.dev-team/` — an
    absolute path that does not resolve to somewhere inside the project is likewise treated as
    outside `.dev-team/`. `README.md` is on Rule 1's list because the plugin also writes a marked
    `.dev-team/README.md` (see "Where the plugin writes, and the ownership rule", point 7); without
    it in the list, a mistaken write of that fixed text — for example a stale or mistyped
    instruction that drops the `.dev-team/` prefix — could overwrite a project's own top-level
    `README.md` unchecked. Rule 2's name list is unchanged: the seven ledger names only, never
    `README.md`, because a project's own `README.md` mentioning a record-id-shaped string (like
    `F-001`) far more often reflects an ordinary project document than a plugin write. That's one
    narrow shape Rule 1 can block — for example a person pasting a copy of a ledger into
    `docs/FEATURES.md`, or the folder README landing at the wrong path — not a blanket guarantee
    that it can never touch a person's own file; to proceed, write the file under `.dev-team/`
    instead, or set `guard: off`.
  - **Rule 2** only activates while `.dev-team/loop.lock/` exists (an autopilot cycle is running
    right now), `guard: on` is set in `.dev-team/config.yml`, or `DEV_TEAM_GUARD` is set — and even
    then it only refuses a write to one of the seven ledger names at the top level (or `SECURITY.md`
    in `.github/`/`docs/`) when the incoming text itself carries the marker or a dev-team record id
    such as `F-001` or `FG-012` (the number can run to four digits or more, so `F-1000` is caught
    too, not just ids up to 999 — a long-lived project's counter never runs out of protection). When
    a session starts in a subfolder of the repository, Rule 2 guards that subfolder's own top-level
    ledger names the same way (never `<subfolder>/.github/` or `<subfolder>/docs/`) — every skill
    writes `.dev-team/<name>` relative to the folder the session starts in, so that subfolder can be
    the old top-level place a stale instruction means, and guarding both the repository's real top
    level and the session's own subfolder is safe whichever one is meant. It deliberately does
    **not** treat a committed `.dev-team/autopilot.json` as proof that a run is active: some real
    projects keep that file committed in git, so if presence-of-the-file were the signal, this rule
    would have been permanently on in those projects and would have stopped their owners editing
    their own top-level `HANDOFF.md` or `FEATURES.md` forever. `loop.lock/` is a real "right now"
    signal instead — it's created for the length of one cycle and removed at the end, and it's never
    committed to git.
  - **Path resolution**, used by both rules: before either one decides, the target path is worked
    out lexically — every `.` piece dropped, and every `..` piece cancels the piece right before it
    — so `.dev-team/../SECURITY.md` is correctly read as naming the top-level `SECURITY.md`, not a
    file inside `.dev-team/`, even though the raw text starts with `.dev-team/`. A path that tries
    to climb higher than it started (more `..` pieces than there is anything left to cancel) is
    treated as having left the project entirely: Rule 1 still judges it by file name, but Rule 2
    never matches it, since a path that has left the project cannot be "the project's own top-level
    file" Rule 2 exists to protect.
  - What it still can't do: it never sees a write made through `cat >>` or similar in Bash, and it's
    a best-effort pattern match, not a guarantee — a determined rewrite that avoids the marker and
    every id pattern won't be caught. The real protection stays the written rule plus a person
    reading what they're about to commit.
- `.dev-team/.gitignore` (containing exactly `loop.lock/`) and `.dev-team/README.md` are created
  once, the first time anything is written into the folder, and never overwritten after that; a
  warning is added to the run report if the project's own `.gitignore` would swallow the folder.
- `schemas/verdict.schema.json`, a JSON Schema describing `verdict.json`'s exact shape, with sample
  fixtures and `tests/scripts.bats` cases validating against it via `check-jsonschema` (skipped, not
  failed, when that tool isn't installed locally — CI always has it). Its rules reject a verdict
  whose overall result the rest of its own contents rule out: a PASS with a failed integration check
  or an unresolved critical claim, and now also a FAIL that names no cause of its own — no failed
  integration check and no claim marked FAILED at critical severity — since the review protocol
  defines FAIL as needing one of those two causes and nothing else.
- `scripts/check-verdict.sh`, a small script that checks a `verdict.json`'s numbers actually add up
  (the five per-claim counts match `checked`, the `claims` list holds exactly that many entries, ids
  are unique) — checks a shape-only schema can't make, because they need to count entries against
  each other rather than just look at one entry's shape. It exits 0 when everything adds up, 1 when
  the file is valid JSON but a rule fails, and 2 when the file cannot even be checked: not valid
  JSON, or empty, whitespace-only, or more than one JSON value in the file. That last group matters
  because a plain "is this JSON" test lets all of them through: an empty file — the ordinary result
  of a write getting interrupted partway — used to print eight misleading "rule failed" lines
  instead of saying plainly that the file could not be checked at all.

### Known gaps (follow-ups, not fixed in this release)

- **Security findings committed under `.dev-team/SECURITY.md` are still in the repository.** Moving
  them off the top level doesn't make them private — a public repository still publishes its
  findings and any proof-of-concept detail written alongside them. That's a separate decision, not
  a bug in this change. Tracked as issue #42.
- **`.dev-team/autopilot.json` has no schema file of its own**, unlike `verdict.json`. Its
  documented example contains `//` comments, so as written it can't even be validated against a
  schema yet. Tracked as issue #43.
- **The existing Bash guard (`hooks/guard-dev-team.sh`) still treats a committed `autopilot.json`
  as proof a run is in progress** — the same weakness this release fixed in the new ledger guard,
  left as-is here because that hook's own three rules (blocking a push to `main`, a force-push, and
  a live Stripe key) are mostly harmless even when it's on more often than it needs to be. Tracked
  as issue #44.

## [1.4.0] - <unreleased>

### Added

- **Single-PR policy** (`git.single-pr`, default `on`): a companion to the no-stack policy that keeps
  **one open PR per line of work**. When a run's branch already has an open PR to its base, the suite
  reuses that PR (pushes the branch to update it) instead of opening a duplicate, and a follow-up /
  cold-resume run continues on the same run branch so its commits flow into the existing PR. This
  prevents duplicate/parallel PRs racing to merge the same line of change (complementing `stack-prs`,
  which prevents *stacked* PRs). Scoped for safety to a PR whose head is the run branch (never pushes
  onto an unrelated PR); platform-agnostic (GitHub `gh` / GitLab `glab`, auto-detected from the
  remote); fail-open; and it never auto-opens or auto-merges a PR — each skill still hands the branch
  back for review. Turn off with `git.single-pr: false`. Full rule in `conventions.md`
  ("PR base, no-stack & single-PR policy").

## [1.3.0] - <unreleased>

### Added

- **Continuous handoff / auto-log** capability, driven by `.dev-team/config.yml`, fail-open, following
  the standard precedence chain (per-run arg > plain language > per-session env > repo config >
  built-in default):
  - `features.auto-handoff` (default `on`): regenerate `HANDOFF.md` after EVERY completed
    task/workstream, not only at stage checkpoints/RECORD. `HANDOFF.md` is now ASSISTANT-AGNOSTIC —
    a cold-readable resume card any LLM coding tool (Claude, Codex, Gemini, etc.) can pick up at a
    stable repo-root path, committed alongside the work it describes so it survives a fresh clone.
    Owned by `sonnet-scribe`. Per-session off-switch: `DEV_TEAM_NO_AUTO_HANDOFF`.
  - `features.auto-commit` (default `on`): commit each COMPLETED-AND-CHECKED task/workstream as its
    own LOCAL commit (NEVER push, NEVER open a PR). These are ADDITIONAL fine-grained rollback points
    BETWEEN the existing per-checkpoint/per-cycle commits — they never replace the checkpoint commit
    and only ever commit an integrated+checked unit, preserving the "never commit a broken/unverified
    state" discipline. Commit message names the task/workstream. Per-session off-switch:
    `DEV_TEAM_NO_AUTO_COMMIT`.
  - `defaults.issues` gains a third value: `off | sync | auto` (default stays **off** — opt-in).
    `auto` continuously reflects work in the tracker as each item completes/closes (per-task cadence)
    instead of only at the `sync` sync points. Still confirm-first on the FIRST sync per repo,
    security findings still require the separate `issues=sync-security` opt-in, still dedup-safe.
  - Issue sync now supports BOTH **GitHub (`gh`)** and **GitLab (`glab`)**, platform auto-detected
    from the git remote; a plain-git repo with no platform simply skips issues (handoff + commit
    still work).

### Changed

- `agents/sonnet-scribe.md` + `model-routing.md`: `HANDOFF.md` added to the documentarian's enumerated
  owned artifacts, reflecting continuous auto-handoff ownership.
- Autopilot crash-recovery (`loop-runtime.md`): a reclaimed stale cycle now resets the working tree to
  the run branch's current HEAD (keeping already-checked per-task auto-commits) rather than to
  `last_commit`; `autopilot.json` is still written only at RECORD (read-first/write-last unchanged).

## [1.2.0] - <unreleased>

### Added

- `.dev-team/config.yml`: a repo-scoped, committed config file for run defaults (`models`, `gates`,
  `cap`, `cycles`, `issues`) and feature toggles (`update-notifier`, `branch-notifier`, `guard`,
  `notifications`, `telemetry`, `dry-run`) plus a `git:` block (`stack-prs`, `default-branch`) —
  applies repo-wide, to every session and collaborator. Precedence: per-run argument > plain
  language > per-session env var > repo config > built-in default. Loading is best-effort and
  fail-open everywhere. Full schema in
  `skills/dev-team-orchestrator/references/config-and-toggles.md`.
- The **no-stack PR policy**: by default every run branches FROM and targets the default branch;
  stacking on another feature branch requires both `git.stack-prs: true` in the repo config AND an
  explicit per-run ask.
- `tests/smoke-structure.sh` + `tests/scripts.bats`: the plugin's own self-tests (structure a
  marketplace installer relies on, and behavior contracts for the hooks/scripts), run in CI as a new
  `test` job (job name `test`, the required-check context) alongside the existing `audit` job.
  `CONTRIBUTING.md` documents the repo layout and how to run both locally. State files
  (`.dev-team/autopilot.json`, `PROJECT.md`) carry an explicit schema-version marker so a consumer
  can tell a compatible file from a stale-format one before trusting its shape
  (`conventions.md`'s "Schema versioning").
- Run-end **telemetry**: an automatic run report (skill/mode + phases, cycles/stages, agents
  spawned by tier, commits, wall-clock, gate-ledger outcomes, and a rough spawn-count cost estimate
  — explicitly caveated as "not a bill") emitted at a run's terminal step, gated by the
  `features.telemetry` toggle (default `on`, fail-open). `/dev-team-report` (`[branch=<base>]`)
  computes the same report on demand, read-only, regardless of the toggle. Spec + the single source
  of truth for the per-tier cost weights: `skills/dev-team-orchestrator/references/run-report.md`.
- `dry-run=on|off` on every building skill (orchestrator, iterate, security, stripe, ship, migrate):
  produces the full plan and the briefs it WOULD issue, spawns no builders, and makes no file or
  git changes. Precedence and fail-open rules follow the standard config chain
  (`conventions.md`'s "Dry-run / plan-preview").
- **Generalized Cold-resume**: every skill now checks for its own prior owned artifact + run record
  at the front of a run (validated via a git-drift check plus a small spot-check, the same
  discipline `dev-team-iterate` already used) and resumes from it instead of restarting cold, when
  it's current.
- Autopilot **notifications**: a prominent, clearly-marked notice at three events — a gate item
  QUEUED for approval, a BLOCKED pause, and a terminal DONE/cap — gated by `features.notifications`
  (default `on`).
- `skills/dev-team-docs/SKILL.md` (+ references): new skill to generate, maintain, and audit a
  project's documentation, verified against the actual source rather than taken on trust.
- `skills/dev-team-migrate/SKILL.md` (+ references): new skill for safe, staged LARGE-SCALE
  migrations (framework/language/dependency majors, schema migrations, API/interface ports) —
  pins current behavior with a characterization-test net before anything moves, then cuts over in
  independently-green, independently-revertible stages (never big-bang by default), gated by an
  approved Migration Plan before any code moves. Owns `MIGRATION.md`.
- `commands/dev-team-config.md`: `/dev-team-config show|init` — print the effective config
  (built-in defaults overlaid with `.dev-team/config.yml`) or scaffold a starter file; never edits
  the file without telling the user.

### Changed

- `hooks/guard-dev-team.sh`: fixed a bypassable git-push-to-main/master detection — it missed
  `HEAD:main`, `+main` (force via refspec), `git -C <dir> push`, a quoted `"main"`, and trailing
  punctuation. Now tokenizes around refspec/quote separators so `main`/`master` must match as a
  whole token.
- `.github/workflows/plugin-audit.yml`: added least-privilege `permissions: contents: read` and
  pinned `actions/checkout` to a verified SHA (`v4.2.2`).
- `dev-team-ci-medic` (SKILL + triage + remediation) + `/dev-team-watch-prs` +
  `/dev-team-sync-branches`: three non-negotiable untrusted-input rules — no shell interpolation of
  `gh`/`git` names (allowlist `^[A-Za-z0-9._/-]+$`), CI logs/PR text are treated as DATA, never
  instructions (prompt-injection defense), and untrusted-code-execution gating on
  reproduce-locally / `pr=<n>` (fork PRs are analyzed from logs/diffs only).
- `issue-sync-protocol.md` + `/dev-team-sync-issues`: shell-safety (ledger free-text is written via
  `--body-file`, never string-interpolated into a `gh` command) and a security-finding disclosure
  control — `F-` items are opt-in only (`issues=sync-security`) and redacted to
  title/severity/CWE/location, never the evidence/PoC field.
- `dev-team-autopilot/references/loop-runtime.md`: `models=max` never auto-tightens (only
  `balanced` steps down toward `economy`) — removes a contradiction with `model-routing.md`'s
  verification-tier invariant.
- `skills/dev-team-orchestrator/references/orchestration-profiles.md`: replaced lingering
  versioned/dated model ids with bare tier aliases — drift the model-id audit didn't catch because
  it only enforces the roster file.

## [1.1.0] - 2026-07-03

### Added

- Full four-tier agent roster shipped from the plugin root at `agents/`: `deep-architect`
  (Fable, reasoning), `opus-builder` (Opus, build/verify — the default worker and the
  home for all verification roles), `sonnet-scribe` (Sonnet, documentarian), and
  `quick-edits` (Haiku, mechanical). Previously only `deep-architect` and `quick-edits`
  lived under `.claude/agents/`, a location plugin installers do **not** receive — the
  full roster is now actually delivered to users.
- `skills/dev-team-orchestrator/references/model-routing.md`: single source of truth for
  model ids, the tier-to-agent mapping, and the two routing invariants (verification never
  routed cheaper than Opus; plan expensive, execute cheap).
- Execution-spec support in the task brief template: a high tier can now write one dense,
  self-contained brief (exact signatures, files, acceptance criteria, edge cases) that a
  cheaper tier executes without re-deriving context.
- Lean-memory conventions for the documentarian: `## Current status` is always overwritten
  rather than appended, and closed backlog items / superseded decisions are summarized
  instead of accumulated verbatim, so a fresh agent can rehydrate cheaply.
- A `budget` block in autopilot's `.dev-team/autopilot.json` (spawn counts by tier). It is a
  spawn-count trend heuristic, not a credit meter; by default it only informs, and it can
  optionally drive the auto-tighten below (which never touches the verification tier).
- `commands/dev-team.md`, `commands/dev-team-status.md`, `commands/dev-team-approve.md`,
  `commands/dev-team-update.md`: command entrypoints for routing to a skill, viewing a
  read-only run dashboard, resolving a queued autopilot gate, and checking for plugin
  updates.
- `hooks/hooks.json` + `hooks/guard-dev-team.sh`: a scoped, opt-in guardrail hook that
  blocks only unrecoverable Bash actions (push or force-push to main/master, live Stripe
  keys) and only while a dev-team run is active (`.dev-team/autopilot.json` present), or
  when forced on via `DEV_TEAM_GUARD`. Fail-open by design.
- `hooks/check-update.sh`: a SessionStart auto-update notifier — cached for 24h, fail-open,
  silent when the plugin is already current; disable with `DEV_TEAM_NO_UPDATE_CHECK`.
- `/dev-team-sync-branches` + `scripts/branch-hygiene.sh` + `hooks/sync-branches-check.sh`:
  safely align local branches with their remotes. Prunes stale remote-tracking refs and, with
  confirmation, deletes local branches whose remote was merged/deleted — `git branch -d` for
  fully-merged branches and `git branch -D` only for branches whose PR is verified MERGED via
  `gh` (catches squash/rebase-merges). Remote-deleted branches with no merged PR are left alone
  (possible unpushed work); it never pushes or force-deletes unproven work. A network-free
  SessionStart notifier flags cleanup candidates; disable with `DEV_TEAM_NO_BRANCH_CHECK`.
- `.github/workflows/plugin-audit.yml` + `scripts/audit-model-ids.sh`: CI audit (job name
  `audit`, the required-check context) that fails the build if a dated `claude-*` model id
  appears outside the roster, either manifest is invalid JSON, an endpoint agent file is
  missing its `model:` field, or plugin components are misplaced under `.claude/`.
- `skills/dev-team-ship/SKILL.md` (+ references): new skill to take a working repo to a
  shipping one — CI, branch protection/rulesets with byte-for-byte required-check names,
  gitleaks-CLI secret scanning, and a release/versioning flow.
- Cost-posture `models=economy|balanced|max` knob plus a new `sonnet-builder` (Sonnet)
  economy build endpoint — verification stays on `opus-builder` in every posture
  (`model-routing.md`, "Cost posture").
- Autopilot budget auto-tighten (`budget-autotighten`): steps the build tier down one
  notch when frontier spend runs heavy, floored at `economy`, never downgrades
  verification, and surfaces the change in the iteration report.
- `HANDOFF.md`: a derived, always-regenerated one-glance resume card, never a source of
  truth.
- `skills/dev-team-orchestrator/references/orchestration-profiles.md`: optional taste-first
  orchestration profile — recommends a Fable/Opus (top-taste) orchestrator, with optional
  GPT-5.5 offload via Codex for bulk/mechanical grunt work (Claude fallback when Codex isn't
  installed), keeping all user-facing work and verification on Claude taste/frontier tiers.
- `skills/dev-team-ci-medic/SKILL.md` (+ references) and `commands/dev-team-watch-prs.md`:
  new skill to watch this repo's open PRs for failing CI checks and resolve them by class —
  auto-fixing SAFE-AUTO classes (formatters, autofix linters, import-sort, deterministically
  regenerable generated files/lockfiles) once the checker verifies and pushes to the PR
  branch, rerunning FLAKY failures, diagnosing and proposing REAL failures via a gated
  remediation cycle (the test under scrutiny is never edited to make it pass), and reporting
  BLOCKED ones outright. Runs interactively, via `/loop <interval> /dev-team-watch-prs`, or as
  a scheduled routine; only ever pushes to the PR branch it's watching, never `main`, and
  documents the `GITHUB_TOKEN` anti-recursion trap for scheduled/cloud pushes.
- Opt-in GitHub Issue sync (`issues=off|sync` on `dev-team-iterate`/`dev-team-security`/
  `dev-team-featurefind`/`dev-team-review`/`dev-team-autopilot`, plus `/dev-team-sync-issues`):
  exports the suite's ledgers (feature gaps, backlog, security findings, review verdicts,
  gate-deferred items) to GitHub Issues, owned by `sonnet-scribe`. Dedup-safe via a stored
  `issue:` ref plus a hidden `<!-- dev-team:<id> -->` marker, confirm-first on the first sync,
  and close-on-done when an item is resolved/built/verified/merged.

### Changed

- Fixed a stale, hardcoded Sonnet 4.6-era model id that had silently rotted across several
  skill files; all prose now points to the current roster (Sonnet tier / `sonnet-scribe`)
  instead of restating a dated id inline.
- `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`: version bumped to
  `1.1.0`, owner/author set to `MWBM Partners Ltd`, and descriptions rewritten to describe
  the tiered subagent roster (Fable/Opus/Sonnet/Haiku) and list the new `ship` skill.

### Removed

- `.claude/agents/deep-architect.md` and `.claude/agents/quick-edits.md` — superseded by
  the complete roster at `agents/` (plugin root); keeping both would have reintroduced
  drift between a shipped and an unshipped copy.

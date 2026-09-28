# Documentation Standards

What "good" looks like per doc type, and the one house rule that overrides all of it: **match
the project's existing style before applying any of the below.** These are defaults for a repo
with no established convention, or gaps in a convention that exists but doesn't cover
everything. Read this before the drafter writes anything; paste the relevant section into the
drafter's brief for the doc-area it's writing.

## The house rule: match, then fill the gaps

Before drafting, the scout reports the project's **own** conventions: heading structure and
tone already in use, the docstring style already in the codebase (JSDoc, Google/NumPy-style
Python, Rustdoc, godoc, XML doc comments, …), whatever README/CHANGELOG shape already exists,
and any doc-generation tooling already configured (TypeDoc, Sphinx, godoc, rustdoc, OpenAPI/
Swagger generation, Docusaurus, mkdocs, …). The drafter's job is to **extend that convention
seamlessly**, not import a different "best practice" that clashes with it. Only fall back to
the defaults below where the project has no precedent at all (e.g. `generate` mode on a repo
with zero existing docs).

Two constants regardless of house style:

- **Be concise** — unless the repository's own instructions ask for fuller explanations, in
  which case follow them and say so in the report (orchestrator `conventions.md`, "Repository
  instructions and normative documents", step 8). A shorter doc that says only true, useful
  things beats a long one padded to look thorough. Link to deeper material rather than inlining
  everything.
- **Be current.** A doc is a liability the moment it drifts from the code it describes. Prefer
  fewer doc surfaces kept accurate over many that silently rot. Where the convention supports
  it, prefer **generated** reference docs (from docstrings/schemas) over hand-duplicated prose
  that has to be remembered and kept in sync by hand.

## README anatomy

A README should let a new reader go from zero to "I understand what this is and can try it" in
under a minute of reading:

1. **Title + one-paragraph description** — what it does and who it's for, in plain language.
2. **Status/badges** — only if they're real (CI badge only if CI exists and is green; version
   badge only if a release flow exists). A fake or unmaintained badge is worse than none.
3. **Install / quickstart** — copy-pasteable commands that actually work, in order, with no
   assumed steps skipped.
4. **Usage** — the most common use case(s), with a real, runnable example — not a contrived
   toy that doesn't match how the thing is actually invoked.
5. **Configuration / options** — the surface a user is expected to touch; link to the full
   reference doc rather than duplicating it here.
6. **Where to go next** — pointers to deeper docs (API reference, architecture, contributing),
   not a full copy of them.
7. **License / contributing pointers** — brief, linking to the actual files.

Multi-package repos: a root README orienting the whole repo + a short README per package
covering only what's package-specific: don't repeat the root content.

## API / reference conventions

Reference docs are exhaustive and mechanical by design — they're a lookup surface, not prose
to read start-to-finish. Per public symbol / endpoint / CLI flag / config key:

- **Signature** — exact name, parameters (name, type, required/optional, default), return type
  or response shape, thrown errors / status codes.
- **A runnable example** — real usage, not a stub. Actually run it (see
  `accuracy-verification-protocol.md`).
- **Behavior notes** — anything non-obvious from the signature alone: side effects, ordering
  guarantees, idempotency, rate limits, deprecation notices.

Prefer **generating** this from source (docstrings, type annotations, an OpenAPI/GraphQL
schema) over hand-writing it whenever the project's stack supports it — a generated reference
can't drift from the signature it was generated from, whereas a hand-written one silently can.
When both a generated reference and a hand-written narrative reference exist, keep them
clearly separated (don't let the narrative duplicate — and diverge from — the generated
tables) and cross-link them.

## Docstring / inline-comment standards

- Match the language's/project's existing docstring convention exactly (don't introduce a
  second style alongside an established one).
- Cover: what it does (one line), parameters, return value, exceptions/errors it can raise or
  reject with, and any side effect a caller needs to know about (mutates input, has I/O, isn't
  thread-safe, etc.).
- Add a short example only where the usage isn't obvious from the signature — not on every
  function reflexively.
- **Skip trivial one-line accessors/getters/setters** unless the project's own convention
  already documents them uniformly — padding these is volume without value (see
  Anti-patterns in `SKILL.md`).
- Inline comments explain **why**, not what — the code already says what; a comment repeating
  it verbatim is noise. Reserve inline comments for non-obvious rationale, workarounds, or a
  warning about a subtlety a future editor would otherwise miss.

## CHANGELOG (Keep a Changelog)

Follow the [Keep a Changelog](https://keepachangelog.com) shape unless the project already
uses a different one — don't introduce a second format:

- Reverse-chronological, one section per released version (semver header + date), plus an
  `## Unreleased` section at the top for what's landed but not yet released.
- Subsections **only as needed**: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`,
  `Security`.
- Each entry is one line, user-facing (what changed for someone using the project, not an
  internal refactor note), and traceable to a real commit/PR — never an invented rationale for
  what a change "probably" did.
- Don't restate the diff; summarize the user-visible effect.

## Usage guides

Task-oriented, not a feature tour — start from what the reader is trying to accomplish, not
from the software's structure:

- One guide per distinct user-facing task or workflow ("deploy to production", "add a custom
  field", "set up SSO") — not one giant guide covering everything.
- Step-by-step and runnable: a reader should be able to follow it verbatim and get the stated
  result. Every command/step in the guide should be one the checker actually verified works.
- State prerequisites and the expected end-state up front.

## Architecture / onboarding docs

Oriented at "where do I start" and "why is it built this way", for a reader with no prior
context on the codebase:

- **The big picture** — a system diagram (even ASCII is fine), the major components, and how
  data/control flows between them.
- **Key design decisions and why** — link to the project's decision log/ADRs if one exists
  (e.g. `.dev-team/PROJECT.md`'s Decision log, from a prior `dev-team-orchestrator`/`iterate` run) rather
  than re-deriving the rationale from scratch.
- **Where to start reading the code** — the entry points a new contributor should open first,
  and the order that makes the rest make sense.
- Keep this doc **stable** relative to the day-to-day churn of the codebase — it should
  describe the shape of the system, not implementation details that change weekly. If it needs
  updating every other commit, it's pitched at the wrong altitude.

## Currency signal

Where the project convention supports it, make a doc's freshness legible: a "last verified
against commit `<sha>`" note, CI-generated reference docs (freshness is implicit — it's
regenerated every build), or a dated changelog entry. This isn't required everywhere, but
where the convention already has a mechanism for it, use it rather than leaving currency
unstated.

# HANDOFF template — the one-glance resume card

`.dev-team/HANDOFF.md` is a compact, always-regenerated card (owned by the `sonnet-scribe` agent) that
answers "what is the single next action, and where is the detail" in one screen. It is a DERIVED
convenience view, NEVER a source of truth: `.dev-team/PROJECT.md` is the human narrative and, under
`dev-team-autopilot`, `.dev-team/autopilot.json` is machine-authoritative. `HANDOFF.md` is
**assistant-agnostic** — a resume card ANY LLM coding tool (Claude, Codex, Gemini, …) can read cold,
written in plain tool-neutral markdown at the fixed path `.dev-team/HANDOFF.md`. A project's own
top-level `HANDOFF.md` — one that carries no dev-team marker — is never touched: no AI coding tool reads
a top-level `HANDOFF.md` automatically (this is why the legacy root location never bought discovery on
its own), and real projects keep a hand-written one there. It is **committed alongside the work it
describes** (it rides in the per-task auto-commit, or the checkpoint commit when auto-commit is off) so
it travels with the repo for the next session or teammate; these behaviors never auto-push it. Because it
is regenerated from those sources after **every completed task/workstream** when `auto-handoff` is on
(default; `config-and-toggles.md`) and at every checkpoint / RECORD (never hand-maintained), it cannot go
stale on its own.

Rules: overwrite on every update (never append); keep it under ~40 lines; regenerate after every
completed task/workstream when `auto-handoff` is on (default; per-session off-switch
`DEV_TEAM_NO_AUTO_HANDOFF` drops to checkpoint/RECORD-only), and always whenever `.dev-team/PROJECT.md`'s
`Current status` changes. Keep it assistant-agnostic — plain markdown any LLM coding tool can act on,
no Claude-only assumptions. If it would duplicate `Current status` nearly verbatim, that is fine — it
still earns its place as the at-a-glance card.

Template:

    # HANDOFF — <project>            (auto-generated; overwrite each update; <= ~40 lines)
    <!-- dev-team: ledger=handoff schema=1.0 -->
    Updated: <last commit sha> · <date>
    Goal:    <one line>
    Status:  <phase/stage> — <one line>
    NEXT:    <the single next action>
    Branch:  <run branch> · Last commit: <sha> "<subject>"
    Done:    <up to 5 bullets of what's complete>
    In flight: <up to 3 bullets>
    Blocked/awaiting: <bullets, or "none">
    Decisions: <up to 3 pointers, e.g. .dev-team/PROJECT.md#Decision-log>
    Artifacts (all in .dev-team/): PROJECT.md · FEATURES.md · SECURITY.md · VERIFICATION.md + verdict.json · MIGRATION.md · autopilot.json (those present)
    Cost posture: <balanced|economy|max> · spend_posture: <nominal|heavy|tighten>

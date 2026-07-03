# HANDOFF template — the one-glance resume card

`HANDOFF.md` is a compact, always-regenerated card (owned by the `sonnet-scribe` agent) that answers
"what is the single next action, and where is the detail" in one screen. It is a DERIVED convenience
view, NEVER a source of truth: `PROJECT.md` is the human narrative and, under `dev-team-autopilot`,
`.dev-team/autopilot.json` is machine-authoritative. Because it is regenerated from those sources at
every checkpoint / RECORD (never hand-maintained), it cannot go stale on its own.

Rules: overwrite on every update (never append); keep it under ~40 lines; regenerate whenever
`PROJECT.md`'s `Current status` changes. If it would duplicate `Current status` nearly verbatim, that
is fine — it still earns its place as the at-a-glance card.

Template:

    # HANDOFF — <project>            (auto-generated; overwrite each update; <= ~40 lines)
    Updated: <last commit sha> · <date>
    Goal:    <one line>
    Status:  <phase/stage> — <one line>
    NEXT:    <the single next action>
    Branch:  <run branch> · Last commit: <sha> "<subject>"
    Done:    <up to 5 bullets of what's complete>
    In flight: <up to 3 bullets>
    Blocked/awaiting: <bullets, or "none">
    Decisions: <up to 3 pointers, e.g. PROJECT.md#Decision-log>
    Artifacts: PROJECT.md · FEATURES.md · SECURITY.md · VERIFICATION.md · .dev-team/autopilot.json (those present)
    Cost posture: <balanced|economy|max> · spend_posture: <nominal|heavy|tighten>

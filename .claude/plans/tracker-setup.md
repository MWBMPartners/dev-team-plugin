# Milestones and project board — ready to set up

**Why this file exists.** On 17 November 2026 the session that wrote it could create and link
issues, but its GitHub tools could not create milestones, Projects boards or wiki pages. This file
holds everything needed to set them up in a few minutes by hand (or by a session with fuller access).
Rule 14 says the tracker is the source of truth, so once these exist, keep them current.

## Milestones (Issues → Milestones → New milestone)

| Milestone | Description | Issues to put in it |
| --- | --- | --- |
| Engine verification | Real-world checks that the built engine needs before it is trusted | #50 Codex review, #51 hand tests, #52 editor hand tests, #58 unverified facts |
| Engine wiring | Making the skills and commands actually call the engine | #53 wire the engine, #57 reword old agent names |
| Engine finish (2.0.0) | Remaining engine features and the release decision | #54 increment 10, #55 increment 8 rest, #56 increment 12, #46 (parent) |
| Catalogue service | The signed model catalogue service in the other repository | #59 |
| Housekeeping | Older open issues | #37, #41, #42, #43, #44, #45, #47, #48 |

Suggested order: Engine verification → Engine wiring → Engine finish (2.0.0). Catalogue service
can run alongside.

## Project board (Projects → New project → Board)

Name: **dev-team-plugin roadmap**. Columns: Backlog, Needs owner's machine, In progress,
In review, Done. Add every open issue. Suggested placement:

- **Needs owner's machine:** #50, #51, #52, #58
- **Backlog:** #53, #54 (blocked by #51), #55, #56, #57, #59
- **In progress / review:** #42, #44, #48 (built on branch `claude/busy-knuth-bc35ok`, not merged)

Useful fields: Status, Milestone, "Needs owner's machine" (yes/no), "Blocked by".

## Wiki

The wiki is a separate repository: `https://github.com/MWBMPartners/dev-team-plugin.wiki.git`
(it exists only once someone creates a first page in the Wiki tab). Ready-made pages are in
`docs/wiki-drafts/`. To publish: create the first page in the web interface, clone the wiki
repository, copy the files in, commit and push.

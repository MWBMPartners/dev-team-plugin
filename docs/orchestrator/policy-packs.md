# Policy packs

A policy pack (`policy-packs/<id>.json`) is a named set of extra rules for a kind of project: higher minimum tiers for
some tasks, reviews that must happen, rules that must always hold, stricter gates, and whether a plan must say how to
roll back. There are ten: `shared-hosting-php`, `native-macos`, `cross-platform-desktop`, `billing-financial`,
`security-sensitive`, `public-api`, `database-migration`, `accessibility-critical`, `release-critical` and
`mwbm-standard` (the owner's practices: plain English, current project documents, the tracker as the source of truth).

A pack can only make things stricter: a gate lower than the built-in level, or an unknown task type, makes the pack
invalid and it is refused. A plan for HIGH or CRITICAL risk work cannot be locked unless it has `rollbackRequirements`.
`engine.sh packs list|show` and `--pack id,id` on `gate check` and `invariants` use them.

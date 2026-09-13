# UX Rubric — capability-per-complexity

The UX goal of `dev-team-iterate` is **feature-dense but few steps / clicks / on-screen complexity**. Those only conflict when capability is added naively. The rubric optimizes a **ratio, not a single axis**:

> **Capability up OR flat. Interaction cost flat OR down. Never more steps or more clutter for the same capability.**

Adding capability without adding interaction cost is achieved through **progressive disclosure, sensible defaults, and contextual surfacing** — not new tabs, new always-on buttons, or extra steps.

Paste this file into the brief of any builder doing UI work, and name it in the checker's brief so conformance is verified, not assumed. A UI change that violates a guardrail is a **UX regression** — sent back, or moved to the Proposed-Features ledger if it's a feature that can't meet the bar.

## The guardrails (the checker enforces every one on UI-touching cycles)

1. **Steps-to-primary-action never increases.** Count the clicks/taps/keystrokes to complete each core user task (from `.dev-team/PROJECT.md`'s metrics). After the change the count is **flat or lower**. Ideally a cycle *reduces* it. An increase fails the cycle.

2. **Default-view clutter never increases.** The on-screen element count on the main/default views stays flat or drops, **even as features are added**. New capability lives behind progressive disclosure — an expandable "advanced" section, a command palette, a context menu, inline actions, a detail drawer — not new always-visible chrome.

3. **Navigation depth doesn't grow.** Prefer surfacing capability in-context over adding routes, tabs, or modals-on-modals. Adding a level of navigation to reach an existing task fails.

4. **Sensible defaults.** A new feature's common path requires **zero configuration** — the complexity is opt-in. The 80% case works with no choices; the power lives one disclosure deep.

5. **Consistency & reuse.** Reuse existing components and patterns; no bespoke UI for a job an existing pattern already does. A new one-off control that duplicates an existing pattern is both a UX and a code-redundancy fail.

6. **Accessibility holds.** No new a11y violations; everything keyboard-reachable; focus order sane; contrast preserved.

7. **Discoverable without clutter.** Power features are findable via palette/shortcuts/contextual hints rather than always-on buttons — capability you can reach, not capability shouting at you.

## IA / UX redundancy — single source of truth

The interface must not say the same thing twice or offer the same action several near-identical ways. Distinct from code DRY; this is about *surfaces*.

- **One canonical surface per piece of information.** No two tabs/views/cards showing overlapping data. The audit flags overlapping surfaces; a UX cycle **consolidates** them — usually the highest capability-per-complexity move available, because merging redundant surfaces cuts nav depth and clutter while keeping all capability.
- **One control per action.** The same action isn't reachable three near-identical ways — *unless* it's a deliberate accelerator (a keyboard shortcut for a menu item, a toolbar button for a context action). Deliberate accelerators are fine; accidental duplicate controls are not.
- **No new overlap.** A UI cycle must not *introduce* a second surface for existing information/actions.
- **The "don't over-prune" nuance.** Intentional derived summaries are allowed — a dashboard summary plus a detail page is fine **as long as the summary reads from the same source** and can't drift. The rule is: no *unjustified* duplication and no two surfaces that can fall out of sync — not "never show related info in two places."

## Evidence (required, not optional)

Like perf cycles need before/after numbers, UX cycles need **before/after evidence**:

- **Screenshots** of the affected default views, before and after, captured via the `verify` / `run` skill, attached to the cycle report. The checker (and the user, at the final report) eyeball that *density rose without clutter rising*.
- **The two UX metrics**, before → after, in the trajectory ledger: **steps-to-primary-action** (per core task) and **default-view element count**. A cycle claiming a UX win with these flat or worse is unverified.

## Quick decision test for a proposed UI change

Ask, in order:
1. Does it serve the inferred purpose? (No → it's scope creep, drop it.)
2. Does it add or hold capability? (Must be yes.)
3. Does it keep steps-to-primary-action and default-view clutter flat-or-down? (No → redesign behind progressive disclosure, or it's a regression.)
4. Does it create a second surface for existing info/actions? (Yes → consolidate instead.)
5. Is it small/isolated enough to build, or a substantial change/refactor to propose? (Per build-small/propose-big.)

Pass 1–4 and it's a real UX improvement. Fail any of 2–4 and it's change masquerading as progress — exactly what this loop must not ship.

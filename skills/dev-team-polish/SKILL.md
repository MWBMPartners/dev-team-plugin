---
name: dev-team-polish
description: Find and fix the small tells that make a shipped web app or site look unfinished or "vibe-coded". Covers default or preview domains; missing or duplicate per-page titles, meta descriptions, favicons, Open Graph images, canonical URLs and social previews; missing 404, loading, empty and error states; broken heading order, missing alt text, careless sitemaps; console errors, leftover console logs, exposed development files and oversized JavaScript; layouts that only work at one screen size; spacing, fonts, buttons, border radii, icons and components that drift from page to page; and buttons or links that look like they work but don't. It runs the app for real in a headless browser at phone, tablet, desktop and odd viewports. Modes are `audit` (report only), `fix` (the default: report, then fix the clear low-risk items) and `guard` (add a browser regression check to the project's CI so these checks run on every PR). Use when the user asks "does this look vibe-coded / AI-made", "polish pass", "pre-launch check", "make it look professional", "check SEO/meta/social previews", "check mobile/responsive", or "find dead buttons/links", and when the SessionStart polish reminder says a check is due. Sibling of dev-team-ship (delivery pipeline) and dev-team-iterate (UX improvement cycles). Not for redesigns, new features, or security audits of the application (dev-team-security).
---

# Dev Team Polish

Find every detail that would make someone look at the app for five seconds and think "this
was thrown together by an AI", and fix the ones that can be fixed safely. Report everything
you find, each with a severity. The owner does the filtering, so don't pre-filter to the big
ones.

## What done looks like

- Every public route has been loaded in a real browser at every viewport in the matrix
  (`references/polish-checklist.md`), and every checklist area has a recorded result. An
  area you could not check is listed as NOT RUN with the reason, never left out.
- Every finding is in the report with evidence (URL, viewport, `file:line`, screenshot path)
  and a severity.
- In `fix` mode, every finding is either FIXED (with the commit) or NOT FIXED (with the reason
  and a recommendation). The project's own lint and tests pass afterwards, and each fix has
  been re-checked in the browser.
- In `guard` mode, a regression spec is in the project's CI and passes on the current head.
- `.dev-team/polish-last-run` holds today's date (UTC, `YYYY-MM-DD`) and is committed with the
  work, so the SessionStart reminder resets for everyone.

## Run the app for real

Static reading misses most of these problems. Boot the app the way the project already does:
look for a browser or smoke test, a `dev`/`preview`/`start` script, a `php -S` router, or a
docker-compose file. If it needs a database, use the schema the project's CI uses. Seed real
content where that's cheap, so you see real pages and not only empty states. If the app can't
be booted, say so under **Blocked on me** and fall back to reading the code, with every runtime
check marked NOT RUN.

Use Playwright with Chromium. If the environment already ships a browser (for example, if
`PLAYWRIGHT_BROWSERS_PATH` is set), use it and don't run `playwright install`. Keep throwaway
scripts and screenshots out of the repo.

## The checklist

Load `references/polish-checklist.md`. It covers eight areas: domain, per-page metadata, the
boring pages, structure and accessibility basics, shipped-code hygiene, responsive behaviour,
cross-page consistency, and things that look clickable but do nothing. It also defines the
viewport matrix and the severity scale.

## Fixing (`fix` mode)

- Fix clear, low-risk issues directly, as small commits with Conventional-Commit subjects
  (`fix(web): …`, `chore(web): …`). Follow the project's own rules: its CLAUDE.md/AGENTS.md,
  shared layouts and partials, CSP, copy style, changelog conventions, and the branch policy
  in `dev-team-orchestrator/references/conventions.md`.
- Don't redesign, change product behaviour, or rewrite copy wholesale. When a fix needs a
  product or design decision, leave it, and list it under **Blocked on me** with your
  recommendation.
- Domain, DNS, hosting and secrets are the owner's to change. Report them with the exact steps
  to take, and never change them yourself.
- After fixing, run the project's lint and tests, then re-run the browser checks for each
  fixed item.

## Guarding (`guard` mode)

Load `references/polish-guard.md`. It adds one browser spec that asserts the checks that pass
today, wired into the CI job the project already runs on every PR, so a regression turns the PR
red. In `fix` mode, offer `guard` at the end if the project has no such spec.

## Delegation

Do the work yourself by default. Delegate only when the route list is large enough to split
into independent tracks (for example, more than about 30 distinct page types), and then use
no more than two or three subagents, routed through
`dev-team-orchestrator/references/model-routing.md` (`sonnet-builder` for mechanical fixes).
Don't use subagents to re-check your own findings.

## Report

Keep it short, and lead with the outcome. Use these three headings, in this order:

- **Blocked on me**: decisions or access only the owner can give, each with your
  recommendation. Write "Nothing" if there are none.
- **Changed**: each commit (SHA and subject), and test results.
- **Found**: every finding (area, page and viewport, what's wrong, evidence, severity,
  FIXED/NOT FIXED), then a NOT RUN list.

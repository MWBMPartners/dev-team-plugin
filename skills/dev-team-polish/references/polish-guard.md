# Polish guard: keep the checks running on every PR

Add one browser spec to the project that asserts the polish checks that pass today, and run it
in the CI job the project already runs on every pull request. A regression then turns the PR
red at the moment it is introduced.

## Rules

- Reuse what exists. If the project already has a Playwright (or similar) browser test and a
  CI job that boots the app, add the spec next to it and use the same server setup. Create a
  new job only when there is none, and say so in the report.
- Assert only what passes now. An item that can't pass yet goes in the report under
  **Found** with its finding, not into the spec as a skipped or expected-to-fail test.
- Keep it fast: aim for under about 30 seconds, using two viewports (320 px and 768 px wide)
  and the routes that render with the CI database.
- Give every assertion a plain-language failure message that names the page and the problem,
  so whoever sees a red PR knows what to fix without reading the spec.
- If a check is a required status on the default branch, don't rename the job. A renamed
  required check never reports and blocks every PR.

## What to assert, per route

- `document.title` is non-empty, and unique across the routes tested.
- `meta[name="description"]`, `link[rel="canonical"]`, `meta[property="og:title"]` and
  `meta[property="og:image"]` exist and are non-empty. The canonical and OG URLs don't use a
  preview or localhost host (other than the test server's own origin, if the app builds them
  from the request).
- Exactly one visible `h1`.
- No `img` without an `alt` attribute.
- No console errors (collect `page.on('console')` messages of type `error`, plus `pageerror`).
- No horizontal overflow: `document.documentElement.scrollWidth <= window.innerWidth`.

Once across the app:

- An unknown route returns HTTP 404 and renders the app's own 404 page.

## Done

The spec is committed, the CI job runs it, and it passes on the current head. The report lists
the spec path, the job name, the routes and viewports covered, and any checks left out (with
the reasons).

# Polish checklist

Visit every public route the router knows: home, list and detail pages, search with results
and with none, account and settings pages, help, legal pages, and an unknown URL. For a
single-page app, check both the first load of a deep link (what a crawler or link-unfurler
sees) and client-side navigation (whether the title and meta update).

## Viewport matrix

| Kind | Sizes (CSS px) |
|---|---|
| Phones | 320×640, 375×812, 414×896 |
| Tablets | 768×1024, 1024×768 |
| Desktop | 1280×800, 1440×900, 1920×1080 |
| Odd | 280×653 (fold), 600×900, 1024×500 (short), 2560×1080 (ultra-wide) |

At every size, look for horizontal scroll, overflow, clipped or overlapping text, tap targets
under 44×44 px, fixed bars covering content, and images that stretch or pixelate. Check light
and dark mode if the app has both.

## Severity

- **High**: visible to most visitors within seconds, or breaks a task. Examples: preview
  domain in a share link, a dead primary button, horizontal scroll on phones, a raw error or
  stack trace, "Lorem ipsum".
- **Medium**: noticed by a careful visitor, a crawler or a link preview. Examples: duplicate
  titles, a missing OG image, a 404 page that returns 200, missing alt text, console errors.
- **Low**: consistency or hygiene a reviewer would spot. Examples: two button heights, mixed
  icon sets, a leftover `console.log`, an unused large file shipped to the browser.

## 1. Domain

- No default or preview host anywhere a visitor or crawler can see it: `*.vercel.app`,
  `*.netlify.app`, `*.pages.dev`, `*.herokuapp.com`, `*.github.io`, `*.onrender.com`,
  `*.fly.dev`, `*.replit.app`, `localhost`, raw IPs, or staging/alpha/dev hosts.
- Check canonical URLs, OG/Twitter URLs, sitemap, robots, web manifest, emails, share links,
  hard-coded absolute URLs, and redirects (does the preview host redirect to the real one?).

## 2. Per-page metadata

Each page needs a unique, specific `<title>`; a meta description; a full favicon set (ico,
32px PNG, apple-touch-icon, manifest icons); Open Graph tags (`og:title`, `og:description`,
`og:image` at an absolute https URL around 1200×630, `og:url`, `og:type`); a Twitter card; a
canonical link; `lang` on `<html>`; and a theme colour. Check that a shared link would preview
well.

## 3. The boring pages

- **404**: a real page with a helpful way back, served with HTTP status 404 (not 200).
- **Loading states**: skeletons or spinners for slow data; no layout jump when data lands.
- **Empty states**: no results, empty lists, a first-time user with nothing saved. Each says
  what happened and what to do next.
- **Errors**: API down, offline, timeout, a bad form submission. Plain-language messages,
  never `undefined`, `[object Object]`, `NaN`, a stack trace or a raw status code alone.

## 4. Structure and accessibility basics

Exactly one `h1` per view, with no skipped heading levels. Every meaningful image has alt
text (decorative ones get `alt=""`). Every form control has a label, and every icon button has
an accessible name. Focus is visible. The sitemap is valid XML with real canonical URLs and
`lastmod`, and it leaves out private or admin routes. robots.txt allows what should be indexed
and points to the sitemap.

## 5. Shipped-code hygiene

- No console errors or warnings on any page, and no leftover `console.log`/`debugger` in
  shipped code.
- No exposed development files: `.env`, `.git/`, `*.sql`, backups (`*.bak`, `*~`), source
  maps you didn't mean to ship, `phpinfo`, test fixtures, README/notes served publicly, or
  directory listings. Check the production server config (for example, `.htaccess` or nginx
  rules) as well as the dev server.
- JavaScript and CSS size: flag any single file over about 300 KB gzipped, unused libraries,
  duplicate copies of the same library, and unminified production assets.

## 6. Content edge cases

Very long titles, names and search queries; empty data; a single item; huge numbers; non-Latin
and right-to-left text if the app is multilingual. Check each at a phone size and a desktop
size.

## 7. Cross-page consistency

Compare pages side by side: spacing scale, font families, sizes and weights, button styles and
heights, border radii, shadows, icon library and icon sizes, colours, link styles, and card or
list components. Two variants of the same component is a finding.

## 8. Looks functional but isn't

Click every button and link on every page. Flag anything that does nothing, links to `#` or a
dead route, 404s, opens the wrong thing, or has no hover/focus state. Flag placeholder content:
"Coming soon", "Lorem ipsum", "TODO", `example.com`, fake testimonials or stats, sample
avatars, and generic filler copy ("Built with ❤️", "Unlock your potential").

# ADR-015: CDN cache headers for the static export

**Status:** accepted  
**Date:** 2026-09-05

## Context

`vercel.json` applied `Cache-Control: public, max-age=0, must-revalidate` to `/(.*)`, and only
`/_next/static/(.*)` overrode it. Every other response therefore had to be revalidated with the
CDN on every page view — the bundled game art, the route prefetch payloads, and the favicon.

Vercel bills each of those revalidations as a CDN request (an "Edge Request" in the usage charts)
even though a `304` transfers no body, and its own guidance names repeated `304`s on the same path
as the first thing to look for when CDN requests are high.

Measured against production on 2026-09-05, counting only requests that crossed the wire (CDP
`responseReceivedExtraInfo`, so browser-cache hits and Chromium's merged status are excluded):

| Route | Cold visit | Repeat visit | of which `304` |
| --- | --- | --- | --- |
| `/` | 41 | 7 | 6 |
| `/farm` | 57 | 24 | 23 |
| `/download` | 43 | 10 | 9 |

On a repeat visit to `/farm`, 23 of 24 requests carried no content: 17 game-art sprites and 5
route prefetch payloads, plus the document.

The prefetch count is structural rather than incidental. The site header is sticky, so its links
are always in the viewport and the router prefetches all five sibling routes on load — and repeats
it after every reload, because the router's in-memory cache does not survive one.

## Decision

Three rules, added after the `/(.*)` rule so they override it (later matches win, which is how
`/_next/static/(.*)` already worked):

| Source | Value | Why this window |
| --- | --- | --- |
| `/wiki-assets/(.*)` | `max-age=2592000` | 30 days. The sprites are a mirror refreshed out of band, so staleness is bounded by how often that happens, not by deploys. |
| `/favicon.svg` | `max-age=2592000` | Same; fetched once per cold visit by every browser. |
| `/(.*).txt` | `max-age=300` | The route prefetch payloads. Deliberately short — see below. |

`max-age=300` on the payloads, not longer, because `output: 'export'` has no deployment-skew guard:
a deploy landing inside the window serves a payload up to five minutes older than the JS that
renders it. Five minutes removes the repeat-visit cost while keeping that window small.

`/og/(.*)` and `/og.png` are **left on the blanket rule on purpose.** They are fetched by link-preview
crawlers rather than by visitors, so the request volume is negligible, while a stale share card is
user-visible — the wrong side of that trade.

## Consequences

- Repeat visits stop paying for the game art and, within the five-minute window, for prefetch.
- Refreshed art can take up to 30 days to reach a returning visitor. The filenames are stable
  across a refresh, so nothing busts these caches; a refresh that must land immediately needs the
  version-prefix follow-up below.
- `robots.txt` also matches `/(.*).txt` and picks up the 300s window. Harmless.
- Cold visits are unchanged. They are dominated by 26 JS chunks and 2 CSS files, which are already
  correctly `immutable` and served from the browser cache on every later visit.

## Follow-ups

Considered and deliberately not done here:

- **`immutable` + a `/wiki-assets/v1` path segment**, which would remove the revalidation entirely
  and bust instantly on a bump. The art is generated into `public/` at build time rather than
  tracked, so this is a change to the two copy scripts and the shared base constant — but it also
  touches ~57 literal path assertions across seven test files, both hero-sprite frame modules, and
  the desktop smoke selectors. Deferred as a separate change.
- **`prefetch={false}` on the header links**, which would drop the five prefetch requests on cold
  visits too, at the cost of one request when a section is first clicked. In this Next version the
  App Router's `Link` gates the hover and touch handlers on the same flag, so this is "fetch on
  click", not "fetch on intent".
- **Merging the small JS chunks.** 12 of the 26 chunks on `/` are ≤5 KB and total 23 KB combined —
  a dozen requests for very little payload. Worth measuring a `splitChunks.minSize` change against,
  but chunk granularity has caching value and only cold visits are affected.

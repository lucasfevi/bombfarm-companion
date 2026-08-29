---
"@bombfarm/web": minor
---

Read the published market-price snapshot in the web planner, and cache it so a reload is free and
an offline session still prices items.

The planner is a static export with no server of its own, so it fetches the published snapshot
directly — the file is served cross-origin-readable, which Steam's own endpoints are not. The
parsed snapshot and its ETag are kept in `localStorage`; a refresh re-fetches past the HTTP cache
with `If-None-Match`, and a 304 means unchanged rather than gone. Nothing on this path throws at
its caller: a failed fetch keeps the cached snapshot and reports the failure alongside it, so a
dropped connection never blanks prices that were already on screen.

The price copy that comes with it distinguishes a native quote — the number on the listing page
the item links to — from one converted from USD, which will not match that page. Its staleness
line dates a price by that quote's own timestamp rather than by the snapshot's, because a
rate-limited run republishes the file while leaving an individual quote hours older.

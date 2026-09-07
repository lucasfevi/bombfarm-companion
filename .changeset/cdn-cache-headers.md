---
"@bombfarm/web": patch
---

Cache the bundled game art, the favicon and the route prefetch payloads at the CDN instead of revalidating every one of them on every page view.

`vercel.json` sent `max-age=0, must-revalidate` for everything except `/_next/static/**`, so a repeat visit re-asked the CDN about each sprite and each prefetch payload and got back a `304` carrying no content. Measured on `/farm`, 23 of the 24 requests a returning visitor made were exactly that. The art and favicon now hold for 30 days; the prefetch payloads hold for 5 minutes, kept short because a static export has no deployment-skew guard.

Nothing about a cold visit changes, and the share-card images stay on the old header on purpose — they are crawler traffic, where a stale preview would cost more than the requests save.

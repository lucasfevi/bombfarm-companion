---
"@bombfarm/contracts": minor
"@bombfarm/desktop": minor
---

Price items in the desktop app from the published market snapshot, and let a single item be
re-quoted live.

The main process reads the published snapshot with a conditional request and caches the accepted
body beside the flavor's other user data, so a cold start with no network still prices everything
the last good run knew about. A 304 costs no body and changes nothing; a failed check leaves the
snapshot in hand exactly where it was rather than blanking a screen that had prices on it.

The desktop app can additionally re-quote one item on demand, which the web planner cannot: Steam
sends no cross-origin header, and only the per-item endpoint honours a currency. Quotes are BRL,
paced to one call at a time with a floor of several seconds between them, and a rate-limited
answer widens an exponential backoff that the next success clears.

That endpoint under-reports — it has answered with no price for an item carrying a live listing —
so a refresh that comes back unquoted reports that it could not refresh and leaves the snapshot's
own price standing. It never overwrites a real price with an absence.

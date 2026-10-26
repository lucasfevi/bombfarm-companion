---
"@bombfarm/ui": patch
---

`DetailsMenu` now lives in its own module, so importing it no longer bundles Base UI's menu, and `InfoTip` loads its tooltip lazily, so rendering one no longer puts `motion` in a page's first load. `FactTile` likewise loads its tooltip only when it has a `note`. Names, props and markup are unchanged. The chart kit gains three opt-in props, `details`, `partial` and `integerTicks`, for extra tooltip and table detail, an in-progress final range, and whole-number ticks; charts that do not pass them are unchanged.

---
"@bombfarm/ui": patch
---

`DetailsMenu` now lives in its own module, so importing it no longer bundles Base UI's menu, and `InfoTip` loads its tooltip lazily, so rendering one no longer puts `motion` in a page's first load. `FactTile` likewise loads its tooltip only when it has a `note`. Names, props and markup are unchanged.

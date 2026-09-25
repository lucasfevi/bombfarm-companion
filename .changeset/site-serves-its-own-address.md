---
"@bombfarm/web": patch
"@bombfarm/ui": patch
---

The web planner now names its own address, bombfarm-companion.app, everywhere it describes itself: the canonical link and link-preview address on every page, the sitemap and `robots.txt`, and the address printed on every share-card image. They all still named the old hosting address, which keeps answering without redirecting, so search engines and link previews were being pointed away from the real site. The address and its bare host form now live in one module of the shared design-system package, so the desktop app can print the same address without keeping a second copy.

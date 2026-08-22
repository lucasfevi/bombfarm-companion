---
"@bombfarm/desktop": patch
---

Open the desktop app on Planning, and keep the raw payload view out of shipped builds

The app opened on Diagnostics — a dump of the raw account payload — so the first
thing anyone saw was JSON rather than their roster. It now opens on Planning.

Diagnostics itself is a maintainer's tool, and it is no longer offered at all in
the production flavor; the development flavors keep it. Until the flavor is
known it is treated as production, so a shipped build never flashes the tab into
its sidebar and then removes it.

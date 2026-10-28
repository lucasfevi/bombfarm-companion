---
"@bombfarm/ui": patch
---

`EmptyState`, `ErrorScreen` and `PanelHeader` now accept a node, not just a string, for their title and message, so copy that re-renders with the language can sit in the same heading and paragraph. `EmptyState` can also draw its heading as an `h1`, with the same look as the other levels. `StatusDot` takes a node label, passes `id` and `data-*` attributes to its root, and can colour its label by tone. `Banner` takes `body="sm"` so an `ok` banner can show small body lines like the other tones. Existing renderings are unchanged.

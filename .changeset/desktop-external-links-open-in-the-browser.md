---
"@bombfarm/desktop": patch
---

Open external links in the default browser instead of inside the desktop app.

A link to a third-party site — the market listings the inventory now points at — used to open an
in-app Chromium window with the app's own privileges, and a link without `target="_blank"` would
have navigated the app's own window away from the renderer with no way back. Both now hand the URL
to the system browser and leave the app where it was.

Only `https:` may leave the app. Every other scheme, a malformed URL included, is refused and
logged rather than handed to the operating system, and no in-app window is created for an external
page at all. The renderer's own bundle keeps navigating normally.

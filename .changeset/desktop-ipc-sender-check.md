---
"@bombfarm/desktop": patch
---

The desktop app now checks who is calling before it answers a request from a window: only the app's own top-level pages are served, and the compact Live window is limited to the requests it actually makes.

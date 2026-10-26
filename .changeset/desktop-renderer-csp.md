---
"@bombfarm/desktop": patch
---

The desktop app's window now runs under a strict Content-Security-Policy: it only runs the app's own scripts, and loads art, fonts and styles from the app itself.

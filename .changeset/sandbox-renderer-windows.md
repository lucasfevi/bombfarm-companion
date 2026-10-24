---
"@bombfarm/desktop": patch
---

Both app windows now run in Chromium's renderer sandbox, so the pages they show no longer share a process with any Node access.

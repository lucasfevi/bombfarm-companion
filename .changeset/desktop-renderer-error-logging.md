---
"@bombfarm/desktop": patch
"@bombfarm/contracts": patch
---

A screen that crashes in either window is now written to the app's log file, which it never was before; the compact Live window, which used to go blank, shows a retry prompt instead. Each report is checked, size-capped and rate-limited per window, so a crash loop cannot fill the disk.

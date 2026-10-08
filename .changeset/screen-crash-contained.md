---
"@bombfarm/desktop": patch
"@bombfarm/ui": patch
---

A screen that fails to load no longer takes down the whole window. If one tab hits a problem, it shows a short "This screen couldn't load" message with a Try again button while the menu and the other tabs keep working, and coming back to the tab tries it again. The details are saved to the log file.

---
"@bombfarm/web": minor
---

Add a `/download` section for the Windows desktop companion.

It carries the installer link, a walkthrough of the Windows SmartScreen warning that calls out the
hidden "More info" click, the two reasons a PC may object to the installer, the install and update
counts, and what each of the app's three screens does. A drawing of the Live screen runs a
fifteen-second loop beside the copy, so the app is visible before installing it.

The release is resolved from GitHub at runtime — version, filename, size and counts all come from
the newest published build, and the button falls back to the releases page when that call cannot be
made. Nothing about a release is written into the page.

Reached from a primary button in the header rather than a nav tab. Bilingual (EN / PT-BR) like the
rest of the planner.

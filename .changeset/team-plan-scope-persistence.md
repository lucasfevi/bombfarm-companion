---
"@bombfarm/web": patch
---

Fix the Team plan's hero scope (Optimize / Donate / Leave alone) silently resetting to its battleAllowed-derived defaults on every page reload. Scope choices are now persisted to storage and restored at boot, alongside the existing inventory/account persistence — a hero moved out of Optimize stays out after a refresh instead of being counted in the plan again.

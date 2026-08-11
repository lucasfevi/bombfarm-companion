---
"@bombfarm/web": patch
---

Team Plan hero panel: fix the "Hero sheet" grid always showing Luck last, regardless of the game's own stat order. It now follows the same Attack → Energy → Speed → Luck → Crit % → Crit dmg → Pen % → CDR order as the Planner sheet/points tables (`SHEET_PANEL_KEYS`), so the panel matches what the game shows.

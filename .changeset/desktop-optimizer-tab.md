---
"@bombfarm/desktop": minor
"@bombfarm/ui": patch
---

Optimizer tab: the roster gear and points planner, from the live account.

**A new tab, between Forge and Account.** The nav now reads Live · Farm · Heroes · Inventory ·
Forge · Optimizer · Account · Settings. It proposes the same forge list, move list and point
resets the website's optimizer does — from the account the app already holds, with no export and
no import. Like the Farm board it works from a snapshot taken when the tab opens: nothing on it
moves on a live tick, the Refresh control dates the numbers by the account read behind them, and
a plan the account has moved past is labelled rather than silently recomputed. The search runs in
a background worker; if that worker cannot start, the same search runs on the main page and the
summary says so.

**Your controls are remembered.** Objective, allowed changes, forge floor, crowding, target phase
and every hero's Optimize / Donate / Leave alone choice survive a relaunch. A plan never does.

**The Farm respec panel now points here** for item moves and forges.

**The top bar gives up its words a little sooner.** An eighth tab makes the worded strip about
105px wider and the glyph strip 36px wider, so all three widths the bar degrades at moved with it.
At the smallest window a player can drag to, the secondary actions now sit behind the overflow
button; the tabs and the brand mark still fit.

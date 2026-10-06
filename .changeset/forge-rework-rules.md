---
"@bombfarm/domain": patch
"@bombfarm/team-plan": patch
"@bombfarm/web": patch
"@bombfarm/desktop": patch
---

The Forge tab, the forge queue and the expected-cost figures follow the game's reworked Forge. Only
+1 to +4 always land now; from the roll for +12 up a miss drops the piece one level, never under +10,
and each miss in a row adds 5 points to the next roll. The old safe jump to +8 is gone, so every rung
is rolled one at a time, and the expected gold now comes with the expected essence, which follows
the game's lower essence and Protection Scroll prices. The desktop Forge tab lets you pick a Chance Stone for the whole climb or for up to four stretches of
targets, each shown with its art, its chance bonus and how many you own. Every rung of the odds ladder
shows the stone it uses and how the chance adds up, and the stones you will use are listed against the
ones you own. The app now uses your Chance Stones when it forges: it says before the start which kinds
it may spend and how many you hold, uses one on each roll that can miss, shows the stones used as the run
goes and on its result and ledger row, and stops when a kind runs out or the game does not take a stone
as asked. Stones that are locked, on the market or worn are not counted as yours to spend. Chance Stones
now show in the inventory under their own heading.
The bad-run gold figure is now read off the exact distribution instead of a sampled one, so it no longer
shifts by a percent or so between runs and stepping the target to +13 through +15 is instant.
The desktop Forge tab has a Protection Scroll switch for any climb that reaches +12 or higher: with it on, the
plan shows what the climb costs with the scroll, the price of the scroll on each level it covers, which rungs it
protects ("miss keeps the level"), and a one-line comparison with going without. When you forge, the app asks for
the scroll only on the rolls where the game offers it, stops if you do not have the essence or the game does not
charge it as asked, and counts the essence it cost on the result and in the run ledger. The queue and the Optimizer
never use the scroll. The Forge tab is also laid out in three columns on a wide window, with the bag narrowed to its
contents, so the item, the plan and the forecast fit on one screen; on a narrower window they stack beside the bag
as before. A run that stops for lack of essence now says "Out of gold or essence".
The Forge tab's forecast now shows a bad run (p90) for essence next to gold, the "Without the scroll" comparison carries the gold coin, and every forge confirmation says it spends gold and essence, with the queue's expected essence beside its expected gold.

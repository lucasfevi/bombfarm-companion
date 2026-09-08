---
"@bombfarm/web": minor
"@bombfarm/farm": minor
---

Let the Team plan search be scored for gold per hour, and make that the default.

The page has always maximised the roster's duty-weighted sustained damage. That quantity is not
what a farming account earns, and following the plan could leave a player farming worse than
before. The search has been able to score for gold for a while; nothing on screen could ask for
it. There is now a **Score for** control on the search setup panel with two settings, Gold and
Damage, and it starts on Gold.

Only the web planner's default changes. The shared search keeps damage as its own default, so
every other caller is byte-identical.

Changing the setting drops any plan already on screen rather than flagging it stale, and disowns a
search still running. A gold plan and a damage plan report different quantities in different
units, so leaving one under the other's heading would print a wrong number, not merely an old one.

Every string on the page that named the quantity being reported now exists twice, once per
setting, and a gold plan reports gold per hour throughout: the total gain reads `gold/h` rather
than `dps`, the results heading, the field-saturation notes, the temporarily-behind line and the
skipped-forge note all follow. Both languages. The page reads those strings only through a single
resolver, and a test fails if any component reaches around it or if a damage word appears in a
gold-mode string.

Scoring for gold needs the furthest phase the account has reached, and the search refuses to guess
it. A save that did not carry one now says so and offers damage instead of failing mid-search.

Separately, the Farm page's respec advisor now states its own scope: it moves stat points, and
never gear or forge work. The web planner adds that the Team plan page covers the rest. The
desktop app has no such page, so the shared panel names no destination there.

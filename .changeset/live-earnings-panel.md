---
"@bombfarm/desktop": patch
"@bombfarm/ui": patch
"@bombfarm/web": patch
"@bombfarm/contracts": patch
---

The Live tab now shows an Earnings panel above the heroes panel: the current gold balance (with the
in-game coin), gold rates for the last few minutes and the whole session, and the quieter XP
counterparts of both — one row of figures divided by thin rules, rather than a table. Every rate
the app has not measured yet reads as a dash, never a zero, and the session control that used to
read "Reset session" is now an icon button with the same accessible name.

The compact number formatter (`90200` → `90.2k`) moved from the web planner into the shared design
system so the desktop panel renders the exact same figures the web planner does — the web planner's
own import path is unchanged.

With the game closed and no live tick ever arriving, the current-gold cell now falls back to the
most recently stored account reading instead of showing a dash, with its age shown alongside it —
the same posture the panel already took for a balance that went stale mid-session. No new request
is made to refresh it; the displayed age simply grows while the game stays closed.

The panel has since been redesigned again: a single bordered headline band up top carries the
dominant gold-per-hour figure and a smaller XP-per-hour figure beside it on a shared text baseline,
with a context line underneath stating the true coverage of the recent window and the session
average rate, plus the reset control. Below the band, a reflowing grid of six tiles covers current
gold, elapsed session time, and both currencies' session totals and session rates. The two session
totals (`goldSessionTotal`/`xpSessionTotal` on `LiveEarnings`) are newly published by the live fold
— they were already tracked internally to compute the session rates, but never reached the
renderer before this change. Like every other figure on the panel, a total reads as a dash rather
than a zero before the session has anything to report, and is unaffected by the unrelated
10-minute rolling window's own eviction.

The very first account read after launch no longer waits out the full scheduled cadence: the app
now starts a read the moment the game is detected as running, instead of only on the next
scheduled cycle, so the waiting state on the Live tab clears sooner when the game was already open
at boot. That waiting state itself is also friendlier while it lasts — its sprite now renders at
twice the size, and a small rotating line of flavour text sits beneath it whenever a read is
genuinely in progress (never while consent is what is actually blocking), in both English and
Portuguese, and holding still under reduced motion.

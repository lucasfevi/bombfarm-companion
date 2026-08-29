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

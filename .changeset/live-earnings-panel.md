---
"@bombfarm/desktop": patch
"@bombfarm/ui": patch
"@bombfarm/web": patch
---

The Live tab now shows an Earnings panel above the heroes panel: gold balance and gold/XP rates
for the last few minutes and the whole session, plus a session-length readout and a control to
reset the session figures. Every rate the app has not measured yet reads as a dash, never a zero.

The compact number formatter (`90200` → `90.2k`) moved from the web planner into the shared design
system so the desktop panel renders the exact same figures the web planner does — the web planner's
own import path is unchanged.

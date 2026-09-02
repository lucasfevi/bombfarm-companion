---
"@bombfarm/pricing": patch
"@bombfarm/desktop": patch
---

Stop the inventory tooltip reporting a freshly refreshed Steam price as "quoted at an unknown time".

Two causes, both fixed. The desktop labels bound a single moment as their clock when they were
built, so every quote was dated against the render that made them: ages never advanced, and a
price refreshed after that render was stamped in the future and read as undatable. The clock is
now read each time a tooltip is asked for, and a quote that reads as later than it says "just
now" — matching the planner, which already clamped this.

Pricing no longer presents a native quote it cannot date. An undated native price is one whose
provenance is unknown, and the basis exists so a reader can click through and check the number
against the listing; converting from USD gives up a little exactness for a timestamp the entry
always carries. Every priced result now has a quote time.

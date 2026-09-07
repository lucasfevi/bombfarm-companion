---
"@bombfarm/ui": patch
"@bombfarm/desktop": minor
"@bombfarm/web": patch
---

Refresh moves to the bag it acts on, the toolbar reads as one row, and a table that does not
scroll stops drawing a scroller's header.

**Refresh stands over the bag, not among the filters.** It adopts a newer read of the account —
it does not narrow what the bag shows — so it now sits at the top right of the bag panel, in a
compact strip of its own, and has left the filter row entirely. The out-of-date warning sits
above it in bold with a gap between the two, and takes its own space now that the button no
longer shares a baseline with a row of inputs; the button keeps the warn border it gains when the
read is stale.

**The read age is a tooltip.** "Account read 14d ago" was a line of screen printed at all times to
answer a question that is only ever asked at the moment of pressing the button. It is now the
button's tooltip, and nothing else on the screen prints the read age.

**The filter row is grouped.** The search field grew to fill and sat in the middle, splitting the
row into two clumps of dropdowns that read as two rows sharing a line. The order is now hero
picker, equipped, slot, forged, search, Clear: the screen's primary axis leads, the three
fixed-width selects follow it as one group, and the one control that grows takes the width left
over at the end. Every control keeps the height it had.

**A run that starts below the fold comes into view.** The Forge screen is sized by its content, so
on a short window the run band could open under the fold — the reader confirmed the spend and
nothing appeared to happen. Starting a run now scrolls the band into view if any part of it is out
of view, smoothly, and instantly under reduced motion. A band that is already wholly visible does
not move the page at all, and nothing takes focus.

**The item panel drops a line it could not act on.** `Power 9 · in the bag` came out: the identity
block above it already names the piece, and where an unworn piece sits is not something this
screen does anything with.

**A table with no scrollport no longer draws sticky header chrome.** `DataTable` heads were always
pinned, fill and sealing shadow included, whether or not the table they sat in could scroll. That
shadow paints 12px of header fill above the `<thead>`: a scrollport clips it, and a table without
one let it spill into the gap above, so the head read as a 40px band over 29px rows. `DataTable`
now takes its head chrome from whether its own root is a scrollport, so the two small Forge tables
— the stat comparison and the run tally — draw a plain head that matches their rows, while the
bag, the ledger and every other scrolling table keep the pinned treatment unchanged.

---
"@bombfarm/desktop": minor
"@bombfarm/ui": minor
---

The PVP tab's Rivals table can now be searched by name and sorted by any column. A search box
above the table narrows it to the opponents whose name contains what you type — ignoring case and
accents — with a count of how many are shown; pressing a column header sorts by it, and pressing
it again flips the order. It still opens worst record first. The columns of both the Rivals and
the Duel History tables also keep their width while you scroll: they used to be sized from
whichever rows happened to be drawn, so they shifted as new rows scrolled in. The design system's
sortable table header gains an `aside` slot for an info tip beside the sort button.

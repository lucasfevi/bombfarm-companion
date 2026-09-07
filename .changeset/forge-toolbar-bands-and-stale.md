---
"@bombfarm/desktop": minor
---

The Forge toolbar picks a stretch of the ladder, clears with a real button, and says out loud when
what it is showing is old.

**The forge filter is a range, not a ceiling.** It offered `Forged up to +8` and its neighbours,
which answers "how far has this piece not got" rather than "which pieces are sitting where I am
working". It now offers seven: `Any forge`, `+0 only`, `+8 only`, `+8 to +10`, `+10 to +12`,
`+12 to +14` and `+14 and higher`. The bands share their endpoints on purpose — a piece at `+12`
is in both the band that ends there and the band that starts there — so a piece sitting on a
shoulder shows up whichever side of it you are reading.

**The order picker is gone from the Forge toolbar.** The bag's own Item, Slot and Forge headers
sort, and one screen does not need two ways to order the same rows. Ordering by rarity or by
level is no longer reachable here, which is the accepted cost of the columns those orders lost.
The Inventory list keeps its picker: its headers carry neither of those orders, so there the
picker is the only route to them.

**Clearing the filters is a button.** It was a chip among the rarity chips; it now stands at the
same height and weight as the selects and the search field it undoes, and still appears only while
a filter is on.

**An out-of-date read says so above the Refresh button.** A stale read used to tint the read-age
line, which is the quietest thing on the row. The age line now always prints the age, and when the
account has moved on since the screen pinned it, a bold `OUT OF DATE` hangs over the Refresh
button and the button itself takes a border. The label is positioned clear of the row, so every
control on it keeps one baseline whether the label is showing or not.

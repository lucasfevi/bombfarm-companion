---
"@bombfarm/pricing": patch
---

Keep every market price reachable when a snapshot run is cut short by Steam's quota.

The sweep tags rows one facet at a time, and a run that ran out of quota before the rarity pass
left every row without a rarity — so each one fell back to being keyed by its Steam hash name,
which no inventory item can look up. The merge with the previous snapshot restored each row's
def and rarity but kept the hash-name key it had already been given, publishing entries that knew
exactly what they were and were still unreachable. Every price on the Inventory board read
"Not on the market".

An entry's key is now derived from the identity it ends up with rather than the identity the run
happened to have when it wrote the row, so an inherited def and rarity restore the key too. The
rarity pass also runs before slot and set now: it is the cheapest of the three and the one every
key depends on, so a spent quota costs a facet instead of the whole board.

The job no longer publishes such a snapshot at all. A run that did not finish tagging cannot have
watched an item leave the market, so a key it drops for a row it is still carrying is the run
mis-deriving that key; it now exits non-zero without writing the file, leaving the last good
snapshot in place. Prices freeze at the previous run's rather than going to zero, and the failure
is visible on the run instead of arriving as a bug report.

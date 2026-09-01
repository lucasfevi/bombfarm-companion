---
"@bombfarm/pricing": patch
---

Price the items a player owns but the market board could not match.

Five items were listed on the Steam market, priced in the published snapshot, and unreachable
from an inventory: Topaz Gem, Gem Chest (Act 2), Time Chest (Act 3), and the Act 2 and Act 3
Skill Stone Chests. A player holding one saw no price for it, and nothing anywhere reported the
gap.

Both causes were the same mistake: a short list, written out by hand, where the answer was
already in the game data. Gems were named three at a time out of nine, so six could never link;
act chests were listed one entry per family per act, covering acts 1 and 2 of four families, so
act 3 of anything was invisible. Gem identity now comes from the committed game data — every gem,
including any a future patch adds — and an act chest is matched on its family alone, with the act
read off the market's own facet.

An item that still cannot be matched is now reported as an anomaly naming the item and its
category, rather than passing silently as all five of these did. Skins are excluded: a skin is a
field on a hero rather than something an inventory holds, so it has no owned copy to reach.

---
"@bombfarm/pricing": minor
"@bombfarm/domain": minor
---

Let an owned gem, stone, chest or cage find the price the market already had for it.

Sixteen of the market's rows were keyed by their Steam name because no catalog def described them.
An inventory looks a price up by def and rarity, so those rows were collected, priced and
published — and unreachable. On a real save that left 41 of 130 tradable items unpriced, and the
inventory total understated by every one of them.

Most of them were knowable after all, from a facet rather than the name: an item chest by its
level (`Item Chest (Lv 30)` is `chest_item_30`), a skill stone by its rarity, and the act-scoped
chests by their act, which IS their tier — `Hero Cage (Act 1)` is `chest_hero_1` and Incomum.
Gems and the chest families take a short explicit table, because nothing in the facets separates a
Sapphire from an Emerald or a cage from a time chest; naming them is honest where parsing the hash
would pretend Steam guarantees a format. Coverage on a real save goes 89/130 to 94/130, and every
item still unpriced is now one the market genuinely does not carry.

Heroes are priced too. They key on rarity alone — a listing carries nothing else — and the sweep
no longer treats Steam's `hero` category as an unknown tag, which had been recorded as an anomaly
and would have left any hero listing enumerated but unpriceable.

`chest_hero_N` now carries its tier in the inventory as the other tiered chests do. It was reading
as Comum whatever act it came from, which was wrong on the card, in the tier word, and in any sort
by rarity — not only in its price.

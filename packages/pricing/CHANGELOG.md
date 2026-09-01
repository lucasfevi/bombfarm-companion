# @bombfarm/pricing

## 0.1.3

### Patch Changes

- 5e2aa87: Repair a market row's key even on a run that never reaches it.

  Deriving a key from an entry's identity fixed the rows a run re-enumerated, and left the rows it
  did not. A run Steam blocks outright enumerates nothing, so every row falls into the carry-over
  path and keeps whatever key the previous snapshot recorded — which, once one bad run has written
  hash-name keys into the file, means no later run repairs it either. A snapshot could stay
  unpriceable indefinitely while every run reported success.

  Rows carried over untouched are now keyed by their own identity, the same as rows the run reached.
  A key is derived state, so a previous run's copy of it is worth only what that run knew. The
  practical effect is that a run making zero successful Steam calls still republishes a working
  snapshot, because the identity it needs is already in the file.

- Updated dependencies [b02478e]
  - @bombfarm/contracts@0.6.1

## 0.1.2

### Patch Changes

- fa1d5fa: Keep every market price reachable when a snapshot run is cut short by Steam's quota.

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

## 0.1.1

### Patch Changes

- Updated dependencies [3eb7026]
- Updated dependencies [c94648a]
- Updated dependencies [3233351]
  - @bombfarm/contracts@0.6.0

## 0.1.0

### Minor Changes

- 19a8c45: Publish a Steam Community Market snapshot the apps can price any owned item from.

  A scheduled job walks the market once with no filters — ten rows a call, complete by construction,
  so it finds categories nothing here has heard of — and then asks one facet-narrowed query per tag
  to learn what each row is. Steam returns no tags on a search, so set, slot, rarity, category,
  level and act are known only by having asked for them; nothing parses `market_hash_name`, whose
  format the game changed days after launch.

  Everything the market carries is priced, not just equipment. Gate Keys and Time Parts resolve to
  real `def_id`s from their prefix and rarity; chests, hero cages, gems, skill stones and skins key
  on their Steam category and hash, because two same-act chests share every facet they have and a
  facet-built key would have merged them.

  The published `market-prices.json` holds every row with its key, `def_id` where one exists,
  rarity, level, lowest USD listing and listing count, an index so an owned item resolves in one
  lookup, and FX rates so a client converts without another call. Where the post-launch rename left
  one item with two live hashes, the cheaper is quoted and the other is kept as an alternate.
  `resolveItemPrice` and `resolveKey` are the entry points for both the web planner and the desktop
  app; neither ever calls Steam.

- 48ae346: Quote market prices in the currency Steam itself prices in, so the figure matches the page it
  links to.

  The market sweep enumerates through `search/render`, which silently ignores its own `currency`
  parameter — asked for BRL it answers in USD, relabelled. Only `priceoverview` honours a currency,
  and the difference is real rather than rounding: Steam prices each region independently, so a
  native BRL quote ran 0.6-1.2% above the same item converted at the day's rate, varying per item.

  So a third pass asks `priceoverview` once per listed row and stores the answer in the entry's
  `lowestNative`. `resolveItemPrice` and `resolveKey` prefer it and report `basis: 'native'`; with no
  quote they convert from USD and report `basis: 'converted'`, which lets a UI mark that figure
  approximate instead of quietly disagreeing with the listing. Each resolved price also carries the
  `quotedUtc` of the number actually shown.

  That endpoint under-reports — it returns no price at all for items the search endpoint carries as
  live — so a missing quote never decides that an item is unlisted; the enumeration keeps that call.
  A quote is carried across a rate-limited run only while the USD price under it has not moved.

  Inventory sorting gains a `market` key, with unpriced entries sinking to the bottom in both
  directions rather than crowding out real prices on a cheapest-first sort.

- 48ae346: Let an owned gem, stone, chest or cage find the price the market already had for it.

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

### Patch Changes

- Updated dependencies [c3dd984]
- Updated dependencies [48ae346]
- Updated dependencies [b7d837a]
- Updated dependencies [b7d837a]
  - @bombfarm/contracts@0.5.0

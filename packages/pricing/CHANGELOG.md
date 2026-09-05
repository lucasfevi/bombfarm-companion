# @bombfarm/pricing

## 0.2.1

### Patch Changes

- Updated dependencies [2ab64c9]
- Updated dependencies [076fc40]
  - @bombfarm/contracts@0.7.0

## 0.2.0

### Minor Changes

- 006f970: Answer the question both apps could only half answer: what is this account actually worth?

  **A new figure — what this account could sell.** It adds up three things the market will take off
  your hands: the tradable items in your inventory, the heroes the game permits selling, and the bought
  skins your heroes are wearing. Each is broken out on its own line with its own count, so you can
  see at a glance that, say, forty of forty-three tradable items are priced and two of six sellable
  heroes are. It appears on the Account page of the web planner and on the desktop app's new Account
  screen, and it is the same computation on both — the two cannot disagree about the same inventory.

  Two things about that number are stated where you read it, because both would otherwise mislead.
  A hero listing is priced by rarity alone — level, gear and abilities count for nothing on the
  market — so the heroes line is a floor, never what a well built hero fetches. And a bought skin is
  an account-wide unlock: it counts once however many heroes wear it, and only while one of them
  still does, so dressing every hero back to a birth skin drops the figure with nothing sold.

  **It never guesses at a part it cannot see.** When one of the three cannot be read at all, that
  line says so instead of showing zero, and the heading changes to say the total covers only part of
  the account. A missing part is never quietly counted as nothing.

  **The desktop app has an Account screen.** It shows who the account belongs to and how far it has
  come, the House — its recovery cycle and how many heroes it refills at once, with the next House
  previewed at the level you get on unlocking it — the full skill tree as the game totals it, and
  the sell figure above. The tab sits between Inventory and Settings, so the nav now reads
  Live · Farm · Inventory · Account · Settings.

  **The inventory's own total is now named for what it is.** The header that read "Market value" on the
  Inventory screen of both apps now reads "What your inventory could sell". It was never the account's
  worth — it was always the inventory's, and now that the account has a figure of its own the old title
  was the wrong one on the wrong screen. The number itself is unchanged, and it is now taken from
  the same shared computation the Account screen uses.

  **On the web planner, heroes are counted only after a fresh import.** Whether a hero may be sold
  is something the game says in your save, and the planner has only just started carrying it. A
  roster imported before this change does not have that answer, so the heroes line is withheld —
  rather than reporting a whole roster as unsellable, which is what assuming an answer would do.
  Import a save again and the line fills in. The inventory and skins lines need no re-import.

### Patch Changes

- f06d68d: Let a snapshot say which rows the run stopped quoting, so their price is not labelled as the
  listing's own.

  The producer now spends its call budget only on rows that actually trade — about a third of the
  market has never reported a sale — and prices the rest from the enumeration it already pays for.
  A row dropped from the rotation presents the same shape as one a rate limit cut short: this run
  took no quote and the price has not moved, which is exactly the condition an inherited quote fires
  on. It is not the same claim. No later pass is coming for that row, so an inherited quote would age
  indefinitely behind a `basis: 'native'` label that says it is the number on the listing.

  `buildSnapshot` therefore takes the rows the run deliberately left to the enumeration, and those
  inherit nothing: they carry no native quote and resolve as `basis: 'converted'`, which is what
  they are. Native ran 0.6-1.2% from converted per item when both were measured, so the difference
  is real rather than presentational.

- 2a9dc62: Report the quotes the market answered for and carried no price on, apart from the ones that got
  no answer at all.

  `quoteNative` counted both as `unquoted`, which made them indistinguishable to a caller. They are
  different facts: `{"success":true}` with no `lowest_price` is the endpoint saying it has nothing
  to quote for that item — a reading, and the one that settles whether the item is worth a call of
  its own — while a failed, rate-limited or never-reached request says nothing about the item at
  all. `answeredUnpriced` now carries the first kind, with whatever the answer did hold.

  Deliberately kept out of `quotes`: a priceless entry there would stamp a quote time onto the
  snapshot row and defeat the inheritance a rate-limited pass depends on. The snapshot's
  absent-versus-null rule is unchanged.

- ff44b70: Stop the inventory tooltip reporting a freshly refreshed Steam price as "quoted at an unknown time".

  Two causes, both fixed. The desktop labels bound a single moment as their clock when they were
  built, so every quote was dated against the render that made them: ages never advanced, and a
  price refreshed after that render was stamped in the future and read as undatable. The clock is
  now read each time a tooltip is asked for, and a quote that reads as later than it says "just
  now" — matching the planner, which already clamped this.

  Pricing no longer presents a native quote it cannot date. An undated native price is one whose
  provenance is unknown, and the basis exists so a reader can click through and check the number
  against the listing; converting from USD gives up a little exactness for a timestamp the entry
  always carries. Every priced result now has a quote time.

## 0.1.7

### Patch Changes

- Updated dependencies [4b6d4ba]
  - @bombfarm/contracts@0.6.2

## 0.1.6

### Patch Changes

- 3110bde: Ask Steam what an item is only when the market has listed one nobody has identified yet.

  The market sweep runs in two halves. The first enumerates every listing, ten rows a call, which
  tells it what is on sale but nothing about what any of it is. The second learns that by asking:
  one narrowed query per tag there is, each answer naming the rows that carry it. That second half
  is sixty-odd calls a couple of seconds apart, and it was running on every pass — re-establishing
  the identity of a hundred rows already identified, every time, around a per-item rotation
  deliberately paced tens of seconds apart. Steam's per-address quota is cumulative, and the burst
  was most of what spent it.

  Item identity barely moves, so the sweep is now handed the identities the previous snapshot
  carries. A pass whose enumeration turns up nothing outside that set asks no narrowed query at all
  and stamps what it already knew; a pass that finds a row it cannot name runs the whole sweep, the
  same as before. That is the intended cost on the day an item is first listed, and it cannot be
  made cheaper — the sweep learns a tag by asking for it and reading back which rows answer, so
  identifying one new row still costs a sweep.

  An ordinary pass drops from about 167 calls to about 100, and the burst is gone from every pass
  that finds nothing new. Prices, keys and the published snapshot are unchanged.

  Identities are carried over only where they are complete. A row left half-identified by a pass
  Steam cut short is deliberately asked about again, so a gap repairs itself on the next pass rather
  than being inherited forever.

## 0.1.5

### Patch Changes

- bc88553: Keep the median and 24-hour volume Steam quotes alongside the lowest price.

  The market quote endpoint returns three numbers for every item it is asked about — the lowest live
  listing, the median of recent sales, and how many units sold in the last day — and the sweep read
  the first and discarded the other two, on calls it had already paid for. All three are now carried
  through the pass that fetches them.

  Nothing about the published snapshot moves: its entries still carry the lowest price per currency,
  its schema version is unchanged, and its bytes are identical for the same market. No app needs a
  change to read it, and none of this is visible in the planner or the desktop app yet — the extra
  numbers exist so that price history has something to record when it arrives.

  The desktop app's per-item refresh reads the lowest price out of the wider answer, and keeps
  treating Steam answering without a price as "not quoted" rather than as a price of nothing, so the
  snapshot's own figure still stands in that case.

## 0.1.4

### Patch Changes

- 7763419: Price the items a player owns but the market board could not match.

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

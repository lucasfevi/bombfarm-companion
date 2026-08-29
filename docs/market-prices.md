# The market price snapshot

The game's items trade on the Steam Community Market. `@bombfarm/pricing` turns that market into
one published JSON file so the planner and the desktop app can put a price on anything a player
owns — equipment, gate keys, time parts, gems, chests, hero cages, skill stones and skins.

The rule is the same one the wiki data follows: **no shipped app code talks to Steam.** One
scheduled job, [`.github/workflows/market-prices.yml`](../.github/workflows/market-prices.yml),
sweeps the market and publishes `market-prices.json`; the apps download that file. Steam sends no
`Access-Control-Allow-Origin`, so a browser could not call it directly even if we wanted to.

## Enumerate first, then ask what things are

The sweep is two passes, and the order is the whole design.

**One flat walk of `search/render` with no filters** enumerates the entire market, ten rows a
call, with each row's lowest listing and listing count. It is complete by construction: it finds
items nothing here has ever heard of. That is not hypothetical — skins appeared as a whole new
category days after launch, and a sweep that only asked for what the catalog knows would have
enumerated exactly none of them.

**Then one facet-narrowed query per tag** says what each row is. `search/render` returns no tags
at all, so a row's set, slot, rarity, category, level and act are only knowable by asking:
`category_<appid>_<facet>[]=tag_<value>` is the market UI's own filter, and every row a narrowed
query returns carries that tag by construction.

Nothing parses `market_hash_name`. Steam publishes no format for it, and the game has already
changed the one it uses: `Ember Amulet (Rare)` became `Ember Amulet Lv 10 (Rare)` days after
launch. A name parser would have broken on that; the facet queries did not notice it.

The tags to ask for come from Steam's `appfilters` first, because it is the only source for
facets the catalog knows nothing about. But it is a hint, not an authority — it was measured
omitting `slot=helmet` while `Gold Helmet (Rare)` was listed and sellable. So the sweep verifies
rather than trusts: if any equipment row is left without a set, slot or rarity, it tries the
catalog's own tags for the ones Steam did not list, and reports anything still bare.

A full live run costs **4 calls to enumerate and about 30 to tag**. The earlier design asked by
facet combination and cost roughly 250, which Steam's per-IP tolerance on this endpoint cut off
after six.

## What the file says

`MarketSnapshot` (`schemaVersion: 2`) carries every row the market had, plus the reconciliation
against the committed catalog in both directions.

Every entry has a `key`, and that is what an app prices by:

| Item | Key | Where the identity comes from |
| --- | --- | --- |
| Equipment | `ember_luva#2` | the catalog def its set and slot name, plus rarity |
| Gate Key, Time Part | `map_key_raro#2`, `time_part_epico#3` | a fixed `def_id` prefix plus the rarity's own token |
| Chest, cage, gem, stone, skin | `chest#Hero Cage (Act 1)` | its Steam category and hash, because nothing else identifies it |

The last row is the interesting one. `Hero Cage (Act 1)` and `Skill Stone Chest (Act 1)` carry
`category=chest, act=1` and nothing else — a key built from facets would have quietly merged two
different items into one price. A Steam hash never changes meaning, which makes it the only stable
identity available for an item the catalog does not describe.

Alongside the entries:

- `index` — `key` → the entry to quote
- `alternates` — `key` → the other entries sharing it. The rename left eight items with two live
  hashes each; both are kept, because hiding one would hide real supply
- `unlisted` — catalog def+rarity keys the market has never carried
- `anomalies` — a facet tag or category nothing here can map. An unmapped tag makes items quietly
  lose their price, so it is recorded and raised as a run annotation rather than guessed at
- `fx` — units per 1 USD, so a client converts without another network call

Both apps resolve through `resolveItemPrice(item, snapshot, currency)` for an owned
`InventoryItem`, or `resolveKey(key, …)` for anything else.

## Which of two hashes gets quoted

When a key has more than one live hash, the **cheapest** is quoted and the rest are listed as
alternates. A buyer can take the cheapest, so quoting the deeper book would overstate what the
item costs. Liquidity breaks ties, and a hash with no listing at all never wins over one that has
a price.

## Def and rarity are the whole market identity

Live listings carry `"commodity": 1` — Steam pools every unit under one order book and treats them
as interchangeable. No forja level and no stat roll appears in a listing's identity, which is why
`priceKey` is `(defId, rarity)` and why one hash can hold a dozen listings at one price.

What the price does **not** tell you is whether a particular owned item can be sold at all. An
item's own `tradable` flag answers that, and `resolveItemPrice` checks it before looking anything
up.

## Coverage survives a blocked run

The sweep backs off exponentially on 429 and trips a circuit breaker after six consecutive rate
limits. A run that stops early is not thrown away:

- a **completed** enumeration walked the whole market, so its row set is the truth and anything
  missing from it has genuinely been delisted
- a **cut-short** run keeps the rows it never reached, rather than publishing a snapshot that
  oscillates between full and partial every six hours
- a run that enumerated a row but stopped before tagging it inherits the identity the previous run
  established, so an item that had a price yesterday does not lose it today. Prices are never
  inherited that way: a null `lowestUsd` is the meaningful statement that nothing is listed now

## What is not settled yet

- **Which `ItemKind` the `chest`, `stone` and `skin` categories are.** `equip`, `gem`, `key` and
  `time` each match a rule in the inventory parser's `inferKind`, so those are copied rather than
  guessed. Nothing in the codebase classifies an Item Chest, a Hero Cage, a Skill Stone or a skin,
  so they carry a null `kind` — they are still keyed, still priced, and deliberately do not warn.
- **Gems have no `def_id`.** `inferKind` knows the `gem_` prefix but nothing says what follows it
  for an Emerald or an Aquamarine, so they key on their category and hash like the chests do.
- **Two rarity tags are still unwitnessed.** `uncommon`, `rare`, `epic` and `legendary` have been
  read off live listings; `common` and `mythic` complete the same series.

## The tests that hold this up

`live-market.test.ts` runs the reconciliation over every row the market actually carried and
asserts each one lands on the right identity — checked against real Steam rows, not a fake.

`tags.test.ts` pins each confirmed slot against the listing that witnessed it. Five of the eight
are not what an English reading of the catalog would produce (`armor` is the chestplate, `legs`
the leggings), so a tidy-up back to the obvious guesses is the regression most worth catching.

`tools/market-tags-catalog-parity.test.mjs` fails if the slot or rarity tables stop covering the
committed catalog.

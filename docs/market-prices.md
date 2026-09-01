# The market price snapshot

The game's items trade on the Steam Community Market. `@bombfarm/pricing` turns that market into
one published JSON file so the planner and the desktop app can put a price on anything a player
owns — equipment, gate keys, time parts, gems, chests, hero cages, skill stones and skins.

The rule is the same one the wiki data follows: **the sweep is the only thing that talks to
Steam.** It walks the market and publishes `market-prices.json`; both apps download that file and
price everything from it.

**One deliberate exception: the desktop app's per-item refresh.** A player who wants this item's
price now, rather than the snapshot's, gets one `priceoverview` call from the Electron main
process — which is Node, so the browser's same-origin rule does not apply to it. It is one call
for one item, it carries nothing about the account, and it never widens: everything else on both
apps still comes from the published file.

The web planner has no such affordance and cannot have one. Steam sends no
`Access-Control-Allow-Origin`, so a browser cannot call it at all, and the planner is a static
export with no server of its own to relay through. Its refresh re-downloads the snapshot, and the
UI dates each price by the quote behind it so "now" is never implied.

## The snapshot is produced continuously

Passes run back to back rather than on a clock. The delay between the calls inside a pass is
derived from a daily call budget rather than fixed: raising the budget tightens the rotation with
no code change, and a budget high enough to breach the delay a full pass was measured drawing zero
rate limits at is clamped rather than obeyed, and says so. A pass never starts sooner than five
minutes after the previous one began, because the published file is served with a five-minute
`max-age` and republishing inside that window reaches nobody. A pass that fails, or one whose
rotation the circuit breaker cut short, climbs a cool-down ladder before the next; and every pass
resumes from the snapshot the last good one published.

[`.github/workflows/market-prices.yml`](../.github/workflows/market-prices.yml) still builds and
publishes the same file to the same two targets, but it is a **manual rebuild lever** now — it
carries no schedule and runs only when a human asks. It is the one-click fallback for the routine
producer being stopped, and the two are not meant to run at once: both publish the same asset, so
a second producer on a timer would race the first and publish over it.

Every pass also records what it read — one row per priced item, plus a row for the pass itself
carrying its counts and any error. Readings are retained for 30 days and exposed to nobody:
nothing shipped reads them and no app has a route to them. They exist so that questions about how
the market moves over time have an answer a single current snapshot cannot give.

The published file's schema is unchanged, and so is everything below about how a pass builds it.

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

**The tag pass runs only when the enumeration turns up a row the previous snapshot cannot name.**
It is the large majority of a pass's search calls and it fires them a second or two apart — a
burst, wrapped around a per-item rotation deliberately paced tens of seconds apart. Item identity
barely moves, so re-establishing what a hundred already-identified rows are, every pass, learns
nothing and spends a quota Steam counts cumulatively; that is what got a collector's address
limited after a few hundred calls. So the sweep is handed the identities the previous snapshot
carries. A pass that finds nothing new stamps those and asks no narrowed query at all; a pass that
finds one unrecognised row runs the whole sweep, which is the intended cost on the day an item is
first listed. It cannot be made cheaper by asking about the new row alone — the sweep learns a tag
by asking for it and reading back which rows answer, so identifying one row still costs a sweep.

Identity is carried over only where it is complete. A row a cut-short pass left half-tagged, or
one whose facets cannot be spelled back as the Steam tags they came from, is withheld and asked
about again — so a gap repairs itself on the next pass instead of being inherited forever.

## The price shown is the price on the page

The number an app displays links straight to a Steam listing, so it has to be the number that
listing shows. Two measurements from 2026-08-29 decide how that is done.

**`search/render` ignores its own `currency` parameter.** Asked for BRL it answered `$3.65 USD` —
the same figures as a dollar request, relabelled. So the enumeration can only ever produce USD,
and no amount of parameter-tuning changes that.

**`priceoverview` honours it.** The same item, the same minute: `$4.80` against `R$ 25,00`. Steam
prices each region independently rather than converting, and it rounds to its own price points, so
converting through a rate does not reproduce it — native BRL ran **0.6-1.2% above** the converted
figure, varying per item.

So a third pass asks `priceoverview` once per listed row, per currency, and stores the answer in
the entry's `lowestNative`. `resolveKey` prefers it and reports `basis: 'native'`; with no quote it
converts and reports `basis: 'converted'`, which is a UI's cue to mark the figure approximate.

**The quote never overrides the enumeration on whether anything is listed.** This endpoint
under-reports: `Gold Gloves (Legendary)` answered `{"success":true}` with no price in either
currency while the search endpoint carried it at $14.99 with a live listing. An absent quote
therefore means "not quoted", never "no supply".

Coverage of a full pass: **42 of the 44 keys the index quotes**. Six of the eight raw misses are
the pre-rename hashes that only ever appear as `alternates`. It costs one call per listed row at a
**3.5s** spacing — the search pass's 1.5s is near double the rate this endpoint tolerates — and it
is the first thing a rate-limited run drops, which is why a quote carries `nativeQuotedUtc` of its
own rather than being dated by the run that published it.

A quote is inherited across a run that could not take its own, but **only while `lowestUsd` is
unchanged**. Once the book has visibly moved the old quote is known wrong: `Gold Ring Lv 20 (Rare)`
went $2.80 to $1.10 inside one six-hour window, and an inherited `R$ 14,46` would have gone on
being shown against a real `R$ 5,75`.

## What the file says

`MarketSnapshot` (`schemaVersion: 3`) carries every row the market had, plus the reconciliation
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
- `nativeCurrencies` — what the quote pass asked Steam for, named here so a run where every quote
  failed still says what it was trying to do

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
  oscillates between full and partial from one pass to the next
- a run that enumerated a row but stopped before tagging it inherits the identity the previous run
  established, so an item that had a price yesterday does not lose it today. Prices are never
  inherited that way: a null `lowestUsd` is the meaningful statement that nothing is listed now
- a key is **derived** from the identity an entry ends up with, inherited parts included, rather
  than fixed when the row was written. Keeping the key a half-tagged run wrote is how an entry
  ends up knowing its def and rarity and still being addressed by its hash name, which no owned
  item looks up

The enumeration is the cheap tenth of the sweep and usually finishes even when the quota kills the
run, so a full row set is no evidence that the run learned what the rows are. What says that is
`catalog keys carried` in the build log, and the sweep **refuses to publish** a snapshot that
drops a key whose row is still on the market, when it did not finish tagging. It exits non-zero
without writing the file, which leaves the last published snapshot standing: prices freeze at the
last good ones rather than going to zero, and the pass is recorded as failed instead of quietly
succeeding.

## What is not settled yet

- **Which `ItemKind` the `chest`, `stone` and `skin` categories are.** `equip`, `gem`, `key` and
  `time` each match a rule in the inventory parser's `inferKind`, so those are copied rather than
  guessed. Nothing in the codebase classifies an Item Chest, a Hero Cage, a Skill Stone or a skin,
  so they carry a null `kind` — they are still keyed, still priced, and deliberately do not warn.
- **Gems have no `def_id`.** `inferKind` knows the `gem_` prefix but nothing says what follows it
  for an Emerald or an Aquamarine, so they key on their category and hash like the chests do.
- **Whether a second native currency is worth its calls.** The pass is per-currency per row, so
  each one added multiplies the expensive half of the sweep. BRL is the only one asked for today.
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

`tools/market-item-linking.test.mjs` drives the builder's own catalog load against the built
reconciliation, over the real committed game data. The builder is `.mjs` and is not typechecked,
so this is the only thing that proves it still supplies the hash → `def_id` map every gem and act
chest is linked by.

`tools/market-snapshot/sweep-stats.test.mjs` holds the two seams no type reaches: that the
rate-limit counts still find the log lines they are read off — reword either message and the count
silently goes to zero — and that the expensive tag pass stays off an ordinary pass. Drop the
hand-off that keeps it off and every unit test stays green while the burst comes back every pass.

`tools/market-collector.test.mjs` drives the continuous producer with an injected clock, sweep and
transport, so its decisions are exercised without a market call. The two worth naming are that a
pass which throws still leaves a row saying so, and that the cool-down ladder resets after a pass
that completes — both asserted by observing the write rather than reading a value back.

`tools/market-prices-workflow.test.mjs` reads the workflow as text. It asserts the manual lever
runs only when a human asks — false if a cron is spliced back in, false if the manual trigger is
stripped — and that it is one time-boxed job which publishes whatever it got, never commits to a
branch this repository releases from, and never writes the source tree.

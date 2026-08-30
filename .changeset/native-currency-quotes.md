---
"@bombfarm/pricing": minor
"@bombfarm/domain": minor
---

Quote market prices in the currency Steam itself prices in, so the figure matches the page it
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

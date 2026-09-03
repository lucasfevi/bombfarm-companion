---
"@bombfarm/pricing": patch
---

Let a snapshot say which rows the run stopped quoting, so their price is not labelled as the
listing's own.

The producer now spends its call budget only on rows that actually trade — about half the market
has never reported a sale — and prices the rest from the enumeration it already pays for. A row
dropped from the rotation presents the same shape as one a rate limit cut short: this run took no
quote and the price has not moved, which is exactly the condition an inherited quote fires on. It
is not the same claim. No later pass is coming for that row, so an inherited quote would age
indefinitely behind a `basis: 'native'` label that says it is the number on the listing.

`buildSnapshot` therefore takes the rows the run deliberately left to the enumeration, and those
inherit nothing: they carry no native quote and resolve as `basis: 'converted'`, which is what
they are. Native ran 0.6-1.2% from converted per item when both were measured, so the difference
is real rather than presentational.

---
"@bombfarm/pricing": patch
---

Report the quotes the market answered for and carried no price on, apart from the ones that got
no answer at all.

`quoteNative` counted both as `unquoted`, which made them indistinguishable to a caller. They are
different facts: `{"success":true}` with no `lowest_price` is the endpoint saying it has nothing
to quote for that item — a reading, and the one that settles whether the item is worth a call of
its own — while a failed, rate-limited or never-reached request says nothing about the item at
all. `answeredUnpriced` now carries the first kind, with whatever the answer did hold.

Deliberately kept out of `quotes`: a priceless entry there would stamp a quote time onto the
snapshot row and defeat the inheritance a rate-limited pass depends on. The snapshot's
absent-versus-null rule is unchanged.

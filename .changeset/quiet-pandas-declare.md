---
"@bombfarm/domain": patch
---

Stop reporting the game's new `soulbound` flag as account drift on every refresh.

The game began emitting a `soulbound` boolean on hero and item records in late August. Nothing in
the fidelity layer declared it, so each account refresh reported it as an added key on both the
heroes and the items section — a standing false alarm that filled the log and would have kept
firing indefinitely.

The flag marks a hero or item as bound to the account and unsellable on the marketplace. It is now
declared as an optional escape and read by nothing else: `tradable` (items) and `marketable`
(heroes) already govern whether something can be sold, every soulbound record carries those as
`false`, and market pricing already withholds a price on that basis. Declaring it optional rather
than required matters because the game emits the key only on bound records — requiring it would
have converted the false alarm into a missing-key report and marked the sections degraded.

A capture taken after the field appeared is committed alongside it, so the new escape is witnessed
present and absent on both sections instead of being taken on trust, and the subset claim above is
checked over the whole corpus rather than stated in a comment.

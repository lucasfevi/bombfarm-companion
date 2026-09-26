---
"@bombfarm/pricing": minor
---

Identify market rows by generating the names the committed catalog says each item would be listed
under, and match the enumeration against that set. Equipment prices are back: every equipment row
has been priced and unidentifiable since 2026-09-23, so inventories showed no prices at all.

The pass that used to learn what each row was cost around 150 upstream calls a run against a ceiling
near 105, and had been failing outright — leaving no catalog key matched and 237 rows nothing owned
could look up. Identification now costs nothing upstream: it is a few thousand strings built once per
run from committed data, so a pass is the enumeration walk alone, about 30 calls where it was 180.

Generating a name is not parsing one. The generator starts from an identity it already knows and asks
whether the market is carrying it under the name it should have, so a name form the game changes
stops matching rather than being read wrong — the row goes unpriced and is reported, never wrongly
priced. Both known forms are emitted, because both are still listed: the pre-rename form
(`Ember Amulet (Rare)`) and the current one (`Ember Amulet Lv 10 (Rare)`) are separate live order
books for one item, and the second lands in `alternates` as it always should have.

Two things back that up. Steam's own per-row type is cross-checked against the slot each generated
name implies, and a disagreement is raised as an anomaly — the early warning that the naming has
moved, one change before the change that matches nothing. And the snapshot no longer inherits a row's
identity from the previous file, which is what let a cut-short run's partial identities read as
complete on the next run; the refusal to publish a snapshot that drops a catalog key whose row is
still listed now applies to every run rather than only to a cut-short one.

Rune chests are keyed too. They are listed by rank rather than by act, and unlike an act the rank
is not a rarity tier — an owned one reads rarity 0 — so the market row is keyed the way the owner's
copy keys rather than the way an act chest would.

A skin unpacked from the account to be sold now prices too. It is an inventory item with a def id
of its own, so it asked the market for a key the market does not carry, and an owner who unpacked a
skin precisely in order to sell it saw no price for it. Worn and unpacked now share one derivation.

The published snapshot's shape is unchanged, so no client needs to deploy and the web planner
benefits on the next run.

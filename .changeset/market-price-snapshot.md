---
"@bombfarm/pricing": minor
---

Publish a Steam Community Market snapshot the apps can price any owned item from.

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

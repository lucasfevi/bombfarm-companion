---
"@bombfarm/pricing": patch
---

Ask Steam what an item is only when the market has listed one nobody has identified yet.

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

---
"@bombfarm/pricing": patch
"@bombfarm/desktop": patch
---

Keep the median and 24-hour volume Steam quotes alongside the lowest price.

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

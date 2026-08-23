---
"@bombfarm/desktop": patch
---

Fix a self-healing gap in the live tap's hook discovery: a fresh scan that failed validation used
to retry the identical top-4 ranked candidates forever, so a future game rebuild that pushed the
real read function past rank 4 would leave the tap unable to attach no matter how long it waited.

Repeated fresh-discovery validation failures now widen the requested candidate window (4 → 8 → 16
→ 32, then plateau) instead of repeating the same slice. The window resets to 4 once a winner is
confirmed, and whenever the scanned build id changes, so a rebuild starts its own escalation rather
than inheriting the previous build's widened window. A cache-sourced failure keeps its existing
invalidate-and-retry behaviour unchanged.

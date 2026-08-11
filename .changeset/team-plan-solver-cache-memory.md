---
"@bombfarm/domain": patch
---

Stop the team plan exhausting browser memory on large inventories. The solver's memoisation cache was unbounded — its only ceiling was the 500,000-evaluation budget — and each key re-serialised the entire spare pool plus the point allocation, neither of which discriminates. On a real 441-item save that reached multiple gigabytes and killed the tab; the same run now peaks at 144 MB.

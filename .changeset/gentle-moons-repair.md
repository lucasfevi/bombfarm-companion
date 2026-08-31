---
"@bombfarm/pricing": patch
---

Repair a market row's key even on a run that never reaches it.

Deriving a key from an entry's identity fixed the rows a run re-enumerated, and left the rows it
did not. A run Steam blocks outright enumerates nothing, so every row falls into the carry-over
path and keeps whatever key the previous snapshot recorded — which, once one bad run has written
hash-name keys into the file, means no later run repairs it either. A snapshot could stay
unpriceable indefinitely while every run reported success.

Rows carried over untouched are now keyed by their own identity, the same as rows the run reached.
A key is derived state, so a previous run's copy of it is worth only what that run knew. The
practical effect is that a run making zero successful Steam calls still republishes a working
snapshot, because the identity it needs is already in the file.

---
"@bombfarm/domain": patch
---

Make the team plan finish in seconds rather than minutes. The gear search fully evaluated every candidate move — around 1,250 roster evaluations — to apply just one of them; it now ranks them with a screen that rescores only the heroes a move touches and fully evaluates the best twenty. Screening alone would have cost plan quality, so when the beam runs out of improving moves the search hands back to the exhaustive one and finishes from there, which means the plan it settles on is still a local optimum of the full candidate set. Measured across six real saves spanning 10–16 heroes and phases 151–600, this reaches the same plan DPS three to eight times faster (87 s to 22 s on the largest), and five of the six produce a byte-identical plan; the sixth differs only by two heroes trading equally-scoring rings. It also now converges on every one of those saves, where the exhaustive search previously ran out of evaluation budget mid-climb on three of them.

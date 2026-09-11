---
"@bombfarm/game-api": patch
"@bombfarm/desktop": patch
---

Declare the three keys the game added to the account body: `client_can_sell`, `sell_phase` and
`sell_mode`, the account-level gate on selling to the Steam market. The `/state` fingerprint names
a complete key set, so an undeclared addition was fatal to the shape check, and two things had
been quietly wrong since the game shipped them: every account refresh reported the section as
drifted, so its fidelity could never read `full`, and the wire tap discarded every `/state` body
the game client itself fetched as unidentifiable — 13 of the 24 bodies observed in a five-minute
session — instead of using them.

They are required keys, not an optional escape: every observed `/state` body carries all three,
so an absence is a real removal to report, not variance to tolerate. Nothing reads them yet.

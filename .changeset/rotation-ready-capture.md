---
"@bombfarm/domain": patch
"@bombfarm/game-api": patch
---

Prove the full-and-waiting rotation state against a real capture

The fourth hero state — fully recovered and waiting for a field slot — was
implemented against its documented shape but had never been seen in a committed
body. A capture now carries it, along with the other three states, and the
classification is asserted against that rather than against constructed heroes.

The capture confirms the shape the classification was built on: a hero in that
state is out of the house and off the field at once, which is the pairing that
makes it impossible to identify from either flag alone.

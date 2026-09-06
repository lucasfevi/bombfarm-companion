---
'@bombfarm/pricing': patch
---

The published market snapshot no longer carries a native price forward from the previous file. A
carried-over quote had no pass coming to replace it, and price resolution prefers a native figure
over a converted one, so those rows showed a price frozen the previous day beside rows that were
minutes old. Every published row is now the enumeration's own figure, converted and labelled as
converted, which is what the file already claimed to be.

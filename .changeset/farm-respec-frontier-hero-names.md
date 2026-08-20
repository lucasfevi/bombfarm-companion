---
"@bombfarm/web": patch
---

Fixed the Cheaper respecs rows naming every hero in your rotation. A row headed "1 hero" listed
the whole pool, and the "2 heroes" row listed exactly the same names, so the one thing those rows
exist to tell you — which hero is the cheap one to respec — was the thing missing. Each row now
names only the heroes that row actually respecs.

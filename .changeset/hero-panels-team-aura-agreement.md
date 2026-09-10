---
"@bombfarm/web": patch
---

Price heroes with the same team auras on both per-hero surfaces. The phases explorer read the
stored aura override alone, so an account whose carriers are deployed but whose override was
never set saw no team auras there and different combat figures than the hero workspace showed
for the same hero. Computation now reads a derived roster total; what is written to storage is
unchanged.

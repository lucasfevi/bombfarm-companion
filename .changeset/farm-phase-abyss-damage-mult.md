---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Import and expose the account's farm phase (`account.phase`) as an editable Account field, and model Abisso's damage multiplier (`abissoBase^currentPhase`) in the combat pipeline instead of dropping it silently.

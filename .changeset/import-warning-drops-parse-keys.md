---
"@bombfarm/domain": patch
---

The "missing account fields" import warning no longer prints the raw parse keys (`houseIdx`,
`houseLevel`, …). The app already names the missing fields in the player's own language, and the
machine-readable list of which fields are missing is unchanged — so this only removes the case
where the same finding showed up twice, once as internal keys and once as translated labels.

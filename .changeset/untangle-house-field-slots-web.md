---
"@bombfarm/web": patch
---

The Phases page's "Top N by solo DPS" squad panel and the Team Plan optimizer now size the squad
by how many heroes can be on the field at once (`skills.field_slots`), not how many the House
recovers at once (`casa.slots`) — the two can disagree on a real save (e.g. 3 vs 6), which was
under-reporting squad strength, over-reporting clear time on Phases, and making the optimizer stop
early on Team Plan with heroes sitting idle off-field.

---
'@bombfarm/domain': minor
'@bombfarm/web': minor
---

Team plan: stop banking gear a hero could be wearing, and say why the field is crowded

On a roster that wants more field time than it has slots, the plan used to tell you to take
items off and put them nowhere — trousers most of all, because a `calca` only rolls damage at
Lendária and is otherwise pure energy/speed/cooldown. On one 15-hero save it stripped six slots
bare while four spare pairs of trousers sat in the bag.

The cause is the contested-field objective: it is a duty-weighted mean, so its gradient in one
hero's uptime is `active - meanActive`. Every hero below that mean therefore scores as a loss
when they gain survivability, and the search was rewarded for undressing them. Measured: handing
two bare-legged heroes a spare pair raised total sustained DPS by 1,952 while the objective fell
by 885.

Plans are now held gear-complete — no item stays in the bag while a hero who could wear it has
that slot empty, and no slot is emptied unless nothing left fits that hero. Bare slots the
optimizer previously ignored get filled too. The dilution itself is now disclosed rather than
acted on: the Team plan's saturation callout explains the break-even, names the heroes sitting
under it, and leaves the decision to concentrate the field to the player.

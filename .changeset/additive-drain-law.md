---
"@bombfarm/domain": patch
"@bombfarm/web": patch
---

Fix field time under-counting for heroes with both a self and a team drain reduction

Energy drain reduction from a hero's own Bateria Extra and from the team's Fôlego de Mineiro aura
were combined multiplicatively — each caps at 20%, so a hero with both at max was treated as
draining at 0.80 × 0.80 = 0.64 energy/s. Measurement shows the two reductions add instead: 1 −
0.20 − 0.20 = 0.60 energy/s. A hero carrying both now shows about 6.7% more field time per
deployment, and every planner number derived from it (sustained DPS, farm rate, clear time) moves
with it. A hero with only one of the two reductions is unaffected.

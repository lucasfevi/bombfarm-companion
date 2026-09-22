---
"@bombfarm/domain": minor
"@bombfarm/team-plan": minor
"@bombfarm/desktop": minor
"@bombfarm/web": minor
---

The Optimizer scores for the same three things the Skill Tree does: gold per hour, a gate clear, or the PVP duel. The rotation "DPS" option is gone — a rotation rewards a stint that outlasts the rest, so it recommended energy to a player whose problem was a gate timer.

**Gate clear** scores the damage the squad lands inside the gate's timer (600 s down to 360 s by act) at the gate you pick, with the squad deploying in full as it opens. A gate picker replaces the phase control; it lists gates only and starts on the account's next one, independently of the phase the Farm board is set to.

**PVP** scores the damage the squad you field lands in the one-minute duel, at the phase the duel room is hardened to (the last duel's, else the tier floor, as the desktop last read it). The squad is picked on the scope board — Optimize and Leave alone both fight, Donate stays out — and the room seats nine: with more than nine fielded the plan refuses and says how many to move to Donate, and a squad of up to nine is scored with every hero on the field at once, whatever field slots the account has unlocked. The web planner offers no duel: a save carries no PVP state to read the room's phase from.

Under both, energy is priced for the field-seconds it buys **inside** the window and nothing past it: a hero whose stint already covers the minute gets no energy from the point pass, which goes to attack, crit and speed instead. Measured on a 7-hero capture at gate 60, the duel plan's point resets place zero energy while the rotation plan's still buy it.

For the domain, `sustainedDps` now averages over a finite horizon when the scoring context carries `windowSecs` — the rotation duty is the infinite-horizon case — so the roster objective, the point search and every per-hero figure agree on what a window means. `TeamPlanObjective` gains `'gateClear'` and `'pvp'`; `'dps'` remains the API's default for callers that never set one.

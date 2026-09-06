---
"@bombfarm/domain": minor
---

Give the Team Plan a second objective: gold per hour, alongside the damage one it has always had.

The plan has only ever maximised the roster's duty-weighted sustained damage, and that quantity is
not what a farming account earns. On the newest capture in the corpus the plan raises damage by
2.2% and moves gold per hour by **−0.08%**; on an older, much richer one it raises damage by 63.6%
across 120 gear moves and moves gold per hour by **−3.32%**. A player who farms, and who follows
the plan, can end up farming worse than before they started.

Under the new objective the same search maximises what the Farm Ranking board would print for the
squad at its own best phase. On that same newest capture it reaches +0.50% gold per hour where the
damage plan loses 0.08%; on the two richer older ones, +7.1% and +3.4% from gear alone, and +23.4%
and +14.5% once its point resets land too.

**Where those numbers come from.** The two double-digit figures are measured on captures taken
2026-08-23 and 2026-08-22, both of which predate the 2026-08-28 damage rebalance and are therefore
withdrawn as sources of a game-model number. They are quoted for scale, not as a promise. The
+0.50% / −0.08% pair is measured on the 2026-08-31 capture, which is in regime; the only other
in-regime capture is a fresh four-hero account with nothing worth moving, and it plans no change
under either objective. The gain assertions in the test suite run on the in-regime pair only, and
say so mechanically rather than by a hand-kept list.

The objective is threaded as a mode and **the default is unchanged**. A caller that says nothing,
and a caller that asks for damage, get byte-identical plans — same moves, same forges, same point
resets, same proposed loadouts — verified against the parent commit across every committed capture
at both forge floors and at the full evaluation budget. Nothing user-facing selects the new mode
yet. Three of those plans are now pinned as golden values, so a future drift in damage mode fails
a test rather than passing one that only compares the new code to itself.

The squad the farm objective prices is every hero the player will field, which is not the same set
as the heroes the search may re-gear: a hero left alone still farms, still takes a House slot and
still earns gold, and House allocation and field luck are nonlinear in who is present. With three
heroes left alone, pricing only the search's own scope reads 32% to 69% below the Farm board.
Donate-scope heroes do leave the squad, matching the estimator's own rule for a hero the game will
not field.

Gold per hour is computed through the farm estimator's own chain rather than a second copy of it,
and the two agree exactly (not within a tolerance) on an unchanged roster: same per-hero facts,
same recommended phase, same rate, on every committed capture and on mixed-scope rosters. Team
auras are priced by the estimator's rotation weighting and then frozen for the search, the same
approximation the respec optimizer already makes.

Farm mode requires the account's highest unlocked phase and refuses to plan without it, rather
than falling back to the 600-row phase table and optimising the squad for phases the account has
never reached.

The phase argmax is the overwhelming majority of a farm evaluation's cost, so the search's cheap
move screen prices the incumbent's phase alone instead of sweeping the table. That screen has been
checked rather than assumed: with the beam switched off entirely — every move fully evaluated, 13.5
to 30 times the evaluations — the plans are identical on the captures tried, and the screen's top
24 contained the globally best move every time. Measured at the default budget, a farm-mode run is
no slower than a damage-mode one; it costs more per evaluation and converges in far fewer.

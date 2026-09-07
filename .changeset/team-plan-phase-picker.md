---
"@bombfarm/domain": minor
"@bombfarm/web": minor
"@bombfarm/ui": minor
---

Team plan: plan for one phase, under either objective

The Team plan page gains a **Plan for phase** picker beside Score for, and both objectives now
answer the question for that phase and nowhere else. The objective options are relabelled to the
units they report — **Gold / hr** and **DPS**.

**What changes per objective.** With a phase named, gold per hour is priced at that phase instead
of at the best one the squad can hold, and the damage objective scores the roster against that
phase's own mitigation instead of the account's. With the picker on **None** nothing changes:
gold sweeps as before and the plan now says which phase it settled on and that it picked it
itself; damage stays on the account's own phase.

The picker holds all 600 phases and is searchable by the three things a player knows a phase by —
the difficulty word (`Normal`), the in-game coordinate (`Normal 2-1`) and the bare number (`151`).
It matches on the game's own coordinate label and never on the wiki's flavour names, which diverge
from the client past world 2. Fifty matching rows are drawn at a time with a note saying how many
more matched.

**It is also a large speed-up.** The phase argmax is ~96% of what one farm evaluation costs, and a
named phase collapses it to a single wiki row — measured at exactly 1 row per evaluation, against
19/28/35 for the same three accounts unpinned. Whole-plan wall clock, same machine, gold objective,
phase pinned to the one the sweep would have chosen:

| account | heroes | gold, no phase | gold, phase named |
| --- | --- | --- | --- |
| 7-hero capture | 7 | 0.83 s | 0.46 s |
| 13-hero capture | 13 | 11.6 s | 2.3 s |
| 13-hero capture (deeper) | 13 | 20.8 s | 10.6 s |
| 15-hero capture | 15 | 23.7 s | 11.4 s |

Gold mode used to cost 2.4x-6.2x what damage mode costs on the same account; with a phase named it
costs 1.1x-2.0x. The remainder is gear scoring, which both objectives share and which pinning a
phase cannot touch.

**Two smaller consequences.** A phase past the furthest one the account has reached is allowed and
labelled as such — "what would I earn if I could hold this" is a fair question. And gold scoring no
longer needs the save to carry a furthest phase at all, as long as a phase is named: that
requirement bounded a sweep, and there is no sweep left to bound. The toolbar warning and the
disabled Optimize button now appear only while the picker is on None.

---
"@bombfarm/domain": patch
---

The optimizer can now reach a stat cap in one step. It used to move points 10–50 at a time, and every step toward the crit-chance or cooldown cap lost a little gold before the cap paid off, so it never got there. It now also tries moving exactly the points a hero needs to hit a cap — crit chance at the ceiling the team's crit aura leaves, cooldown at 80%, penetration at 100 — and moves points sitting uselessly past a cap onto another stat.

It also starts from builds that buy the caps first, then Speed until the hero can walk to its next target before its last bomb goes off, then crit damage and attack. Only one of those keeps points in energy, for young accounts whose heroes still run short of field time.

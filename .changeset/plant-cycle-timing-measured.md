---
"@bombfarm/domain": patch
---

Heroes near the cooldown cap are now predicted to plant as fast as they really do. Frame captures showed that a hero with a short fuse wastes less time between bombs than the model assumed — both waiting for the fuse and walking to the next target — so heroes at the 80% cap read 7–38% too slow. The pause between bombs now shrinks from about 0.5 s at a 1.3 s fuse to about 0.3 s at the cap. A wave's first kill now comes 0.9 s after the squad's average fuse instead of at a fixed 3 s, so fast squads start clearing sooner. The Farm board and the Optimizer predict faster clears for high-cooldown heroes, and cooldown is worth more near the cap. Heroes with a fuse of 1.3 s or longer plant at the same rate as before.

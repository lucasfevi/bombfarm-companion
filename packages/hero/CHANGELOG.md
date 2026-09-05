# @bombfarm/hero

## 0.1.1

### Patch Changes

- d155a2f: Move the hero and roster user interface into a package of its own. Nothing a player sees changes:
  the same picker, switcher, sort header, per-hero combat panel and roster wording are drawn by the
  same two apps, from the same numbers.

  What moved is where those views live. They had grown up inside the farm package, which is where the
  farm screen happened to need them first, so the planner and the desktop app both reached through
  the farm screen to render a hero list that has nothing to do with farming. They are now their own
  package, and the farm package depends on it rather than the other way round — a one-way dependency
  a test in the new package enforces, naming the offending file if anything ever imports back.

  The guards that watched these components moved with them: the eight-prop component budget now
  covers the new package too, the desktop rule that only one module may reach the farm screen's
  wording covers both dictionaries, and the two applications' continuous-integration filters now list
  every package they actually compile, so a change to one of them can no longer skip the checks that
  would have caught it.

- Updated dependencies [a326087]
- Updated dependencies [2ab64c9]
  - @bombfarm/domain@0.12.0
  - @bombfarm/ui@0.10.1
  - @bombfarm/game-art@0.3.7

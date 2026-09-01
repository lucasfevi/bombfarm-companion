# @bombfarm/farm

## 0.2.1

### Patch Changes

- Updated dependencies [18a722d]
  - @bombfarm/ui@0.9.0
  - @bombfarm/game-art@0.3.4

## 0.2.0

### Minor Changes

- 4b76ad3: Give the desktop app the Farm screen the web planner has had: the map ranking board over every
  phase, and the per-map explorer beneath it. Same board, same explorer, same controls — at full
  screen the two read the same, and the layout falls to two columns on a narrow window exactly
  where the web does.

  It computes once, when you open the tab. The desktop reads your account from the running game
  every few seconds, and recomputing six hundred rows on every one of those reads would be both
  wasteful and unsettling to look at — figures moving while you are trying to compare them. So the
  board takes a snapshot when you arrive and holds it. Beside the board's heading, a refresh is
  always there, saying how long ago the numbers were worked out, so you can work them out again
  whenever you like. When the account moves on underneath, that same line says the numbers are out
  of date rather than quietly swapping them. It only says so when the account moved in a way the
  board would rank differently for — your gold balance ticking
  up is not one, and the board never reads a balance. Your own edits
  still apply immediately: changing the rotation pool or the return bonus recomputes there and then,
  because those are inputs you chose rather than a tick you did not.

  The screen shares its implementation with the web one rather than redrawing it. Both apps now
  render the same components from `@bombfarm/farm`, over the same compute, against the same strings;
  each supplies its own data and its own labels. A screen drawn twice drifts, and this one is far
  too large to keep honest by review.

  Two things differ from the web, both because the desktop has no roster to edit. The hero picker
  offers the heroes to inspect without the enable/disable switch that would have nowhere to save,
  and the empty-roster state points at the game rather than at a planner page. The respec advisor is
  present in full: it is advice about where to spend points, which is worth as much beside a live
  account as beside a plan.

  The advisor now says on every proposal that this is the best build the search found and not proof
  that no better one exists — on both surfaces. That was true of every answer it has ever given, but
  it only said so when the search had run out of room to keep looking, so the rest of the time its
  silence read as a guarantee it cannot make. The note about running out of room stays, saying only
  the narrower thing it knows: this search stopped at its limit on how many builds it may check,
  rather than because it had run out of improvements to make.

  The rotation pool now lays its hero cards out more densely when it is given a narrow column, so
  the ranking table stays visible on a small window instead of starting below the fold. The web
  planner's column is wide enough that its pool is unchanged.

### Patch Changes

- Updated dependencies [4b76ad3]
- Updated dependencies [b02478e]
- Updated dependencies [090f1ce]
- Updated dependencies [972e2d1]
  - @bombfarm/ui@0.8.0
  - @bombfarm/game-art@0.3.3
  - @bombfarm/domain@0.10.1

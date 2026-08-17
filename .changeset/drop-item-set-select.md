---
"@bombfarm/web": patch
"@bombfarm/domain": patch
---

Drops the item set selector from the gear slot editor — the level already determines the set.

Each slot showed four selects: level, set, rarity, forge. The set select was dead UI:
`catalog.setsByLevel` is a bijection (30 native levels, 30 sets, every entry a single-element
array), so it could only ever render one option. Picking a level had already picked the set.

- **The set select is gone**, and the set name moved into the level option's own label:
  `Level 300` + `Void` becomes `Level 300 - Void`, `Nível 300` + `Vazio` becomes
  `Nível 300 - Vazio`. That is one less control per slot across all eight slots, in both places
  the slot editor renders (the main gear grid and the compare panel), and it makes the level→set
  relationship visible instead of implied.
- **`itemLevelOpt` gains a `{set}` placeholder** in both languages; `itemSet` — which existed only
  as that control's accessible name — is retired with it. The level select keeps its own
  accessible name: the user still chooses a level, and the set that follows from it is spelled out
  in the option text.
- **New guards** cover the premise the combined label now depends on, from three sides. A catalog
  guard asserts the bijection itself — every level maps to exactly one set, no set is shared
  between two levels, and every catalog def's set is the one its native level resolves to. A
  fixture guard asserts that no committed test fixture holds an equipped item whose set disagrees
  with its level, so the planner is never fed data it could only render dishonestly. And the label
  itself is now asserted through the component's rendered output rather than its source text: the
  template helper resolves an unknown placeholder key to an empty string without throwing, so a
  mistyped key would have printed "Level 20 - " on every option while typecheck and every previous
  test stayed green.

No behaviour change beyond the removed control: the level select already selected the set's first
(and only) definition on change, and `setsForLevel` keeps its array return type so the bijection
stays a checked data fact rather than a hardcoded assumption.

Internal, no shipped behaviour attached: the end-to-end seed save carried two equipped items left
over from before the 2026-08-15 level→set re-key (a level-20 amulet and ring still pointing at
`steel`, which now lives at level 120). Both were repointed to their level's own set, `gold`,
keeping every other field. Dated captures were deliberately left alone — each records what the game
returned on its capture date, not what it returns today.

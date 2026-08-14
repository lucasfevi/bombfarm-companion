---
"@bombfarm/domain": minor
---

Re-synced the committed phase wiki bundle (`packages/domain/src/data/phase-wiki.json`) against
a fresh wiki pull, and it corrects tables the game had already moved out from under a
2026-08-03 export:

- **Phase gold (`goldComum`)** is about **25% lower** across all 600 phases (the game's own
  data, not a game-side nerf being applied here — the committed bundle was simply stale).
- **XP per prop** now starts at 18 and ends at 1800 for phase 600 (was 3 / 300 — roughly 6x
  higher across the curve).
- **Item-level drop bands** and **hero-chest rarity by difficulty** (act 3, 4, 5) are re-cut to
  match the live tables.

New constants, previously absent from the bundle entirely:

- Chest / key / gem-chest / time-chest drop rates, the gate key cost, and the Return Bonus pair
  (`DROP_RATES`, `KEY_GATE_COST`, `RETURN_BONUS_ADD`, `RETURN_BONUS_ADD_VIP`,
  `RETURN_BONUS_CAP_SECS`)
- Time-chest rarity by difficulty (`TIMECHEST_RARITY_BY_ATO`)
- The gem catalog, gem rank distribution by difficulty, and gem chest drop rate
  (`WIKI_GEMS`, `GEM_RANK_DIST_BY_ATO`, `GEM_LIST`)
- The three loot-affecting ability values — `veia_ouro`, `fortuna`, `olho_lapidador`
  (`LOOT_ABILITY_VALUES`)
- Two new freshness stamps, `WIKI_SOURCE_PULLED_AT` (the wiki pull date) and `WIKI_EMITTED_AT`
  (the bundle build date) — `WIKI_SYNCED_AT` now always reflects the pull date, never the emit
  date.

**Breaking (internal, within `@bombfarm/domain` only — no consumer shipped yet):** `JAULA`'s
shape changed. The game's cage mechanic no longer has a per-phase early-arrival ramp or a
per-difficulty guaranteed window; the wiki now reports a flat per-difficulty early-arrival
probability and a single guaranteed window (VIP and non-VIP). `JAULA` is now
`{ adiantaProbPorAto, janelaSecs, janelaSecsVip, hpMult }`. `jaulaEarlyCap(phase)` keeps its
name and signature — it now looks up the difficulty's flat probability instead of interpolating
a ramp that no longer exists in the data.

Every other export keeps its name and signature. No formula changed — this is a data refresh
and a new set of typed constants; the math that reads them ships separately.

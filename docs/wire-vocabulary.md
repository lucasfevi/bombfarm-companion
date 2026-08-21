# Rotation wire vocabulary

<!-- generated — do not edit by hand, run `pnpm generate:wire-vocabulary` -->

The `/rotation` route mixes Portuguese and English wire vocabulary. This is the one place that vocabulary is translated into this codebase's own English domain field names — see `packages/game-api/src/rotation/lexicon.ts`. It covers only the rotation boundary; the rest of the tree still carries pre-existing Portuguese identifiers that this table does not inventory.

## Keys

| Wire token | Domain field | Description | Origin |
| --- | --- | --- | --- |
| `field_size` | `fieldSize` | Number of field slots the account can deploy heroes into. | English |
| `heroes` | `heroes` | Per-hero rotation state, one entry per roster hero. | English |
| `casa` | `house` | The account's house / rotation-cycle object. | Portuguese |
| `rescues_left` | `rescuesLeft` | Rescue charges remaining this cycle. | English |
| `rescues_max` | `rescuesMax` | Maximum rescue charges the account can hold. | English |
| `id` | `id` | Hero id — joins against `/roster` for name and grade. | English |
| `level` | `level` | The hero's level. | English |
| `energia_atual` | `energy` | The hero's current energy. | Portuguese |
| `energia_max` | `energyMax` | The hero's maximum energy. | Portuguese |
| `energia_pct` | `energyFraction` | Energy as a fraction of maximum, in [0, 1]. | Portuguese |
| `state` | `activity` | The hero's rotation activity — see the state-value table below. | English |
| `in_field` | `onField` | Whether the hero is currently deployed to the field. | English |
| `in_casa` | `inHouse` | Whether the hero is at the house. | Portuguese |
| `recovering` | `recovering` | Whether the hero is recovering energy. | English |
| `battle_allowed` | `battleAllowed` | Whether the hero is eligible for battle. | English |
| `active_casa` | `activeHouseIndex` | 1-based index of the currently active house level on the wire — the snapshot field holds the 0-based equivalent, indexing directly into `houseLevels`. | Portuguese |
| `levels` | `houseLevels` | The level unlocked at each house index. | English |
| `cycle_secs` | `cycleSeconds` | Seconds per rotation cycle at the active house level. | English |
| `slots` | `slots` | Field slots granted at the active house level. | English |
| `slots_per_house` | `slotsPerHouse` | Field slots granted at each house level. | English |
| `cycle_secs_per_house` | `cycleSecondsPerHouse` | Rotation cycle seconds at each house level. | English |
| `upgrade_cost` | `upgradeCost` | Cost to upgrade from the active house level to the next. | English |

## `state` values

| Wire token | Domain field | Description | Origin |
| --- | --- | --- | --- |
| `DESCANSANDO` | `resting` | The hero is resting/recovering at the house. | Portuguese |
| `EM_CAMPO` | `inField` | The hero is deployed on the field. | Portuguese |
| `NO_BANCO` | `benched` | The hero is benched (not battle-eligible). | Portuguese |

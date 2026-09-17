# Wire vocabulary

<!-- generated — do not edit by hand, run `pnpm generate:wire-vocabulary` -->

This is the one place wire vocabulary — abbreviated keys, Portuguese-origin identifiers, or both — is translated into this codebase's own English domain field names. Each boundary below covers only the traffic this codebase actually decodes; neither table inventories the rest of the game's wire protocol.

## `/rotation` route

`/rotation`'s wire body mixes Portuguese and English keys (`casa` beside `cycle_secs`, `energia_atual` beside `battle_allowed`) — see `packages/game-api/src/rotation/lexicon.ts`.

### Keys

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

### `state` values

| Wire token | Domain field | Description | Origin |
| --- | --- | --- | --- |
| `DESCANSANDO` | `resting` | The hero is resting/recovering at the house. | Portuguese |
| `EM_CAMPO` | `inField` | The hero is deployed on the field. | Portuguese |
| `NO_BANCO` | `benched` | The hero is benched (not battle-eligible). | Portuguese |
| `PRONTO` | `ready` | The hero is fully recovered and waiting for a field slot. | Portuguese |


## Live combat frame (websocket `snap` tick)

The combat websocket packs its payload into single-letter and abbreviated keys beside a handful of Portuguese-origin ones (`jaula_*`, `seca_secs`) — see `packages/game-api/src/live-frame/lexicon.ts`. Several entries are declared for documentation only; the decoder does not yet read every one.

### Keys

| Wire token | Domain field | Description | Origin |
| --- | --- | --- | --- |
| `t` | `messageType` | Message-type discriminator on every frame this decoder recognizes. | English |
| `phase` | `phase` | Current phase number. | English |
| `wave` | `wave` | Current wave number within the phase. | English |
| `max_phase` | `maxPhase` | The account's highest unlocked phase number. | English |
| `gold` | `gold` | Current gold balance. Arrives on the wire as a digit string (observed "9724194"…"10294318"), not a number — a malformed value must be rejected rather than propagated. | English |
| `room_hp` | `roomHp` | Remaining room/encounter HP, observed on a 0–255 scale. | English |
| `idle` | `idle` | The server's own "nothing is being fought" flag. | English |
| `locked` | `locked` | Whether the room is currently locked. | English |
| `no_key` | `noKey` | Whether the account lacks the key needed for this room. | English |
| `gate` | `gate` | Numeric field observed alongside `gate_failed`. Meaning not established from this capture. | English |
| `gate_failed` | `gateFailed` | Whether the `gate` action failed. | English |
| `heroes` | `heroes` | Per-hero live state, one entry per hero currently on the field. | English |
| `bombs` | `bombs` | Live bomb state on the field. | English |
| `hits` | `hits` | Damage events landed this tick. | English |
| `explosions` | `explosions` | Bomb explosions this tick. | English |
| `loot` | `loot` | Props that paid out this tick. | English |
| `rot_events` | `rotEvents` | Rotation-related events this tick. | English |
| `auras` | `auras` | Active aura entries. Each entry's own fields (`c`, `m`, `n`) are not established from this capture. | English |
| `kinds` | `kinds` | Parallel array over map props, paired index-for-index with `hps`; `-1` marks a cleared slot. | English |
| `hps` | `hps` | Parallel array over map props, paired index-for-index with `kinds`; `-1` marks a cleared slot. | English |
| `boss` | `boss` | Meaning not established from this capture. | English |
| `swap_secs` | `swapSeconds` | A seconds value; what it counts down is not established from this capture. | English |
| `jaula_state` | `cageState` | Portuguese `jaula` = cage. Purpose within the live encounter not established from this capture. | Portuguese |
| `jaula_secs` | `cageSeconds` | Portuguese `jaula` = cage. Purpose within the live encounter not established from this capture. | Portuguese |
| `jaula_teto` | `cageCeiling` | Portuguese `jaula` = cage, `teto` = ceiling/cap. Purpose within the live encounter not established from this capture. | Portuguese |
| `jaula_ato` | `cageAto` | Portuguese `jaula` = cage. Purpose within the live encounter not established from this capture. | Portuguese |
| `seca_secs` | `droughtSeconds` | Portuguese `seca` = drought/dry spell. Purpose within the live encounter not established from this capture. | Portuguese |
| `id` | `id` | Hero id. | English |
| `e` | `energyFraction` | Fraction of the hero's own energy pool, in [0, 1] (observed 0.021–0.9998). | English |
| `x` | `x` | Map x position (0–18 observed). | English |
| `y` | `y` | Map y position (0–15 observed). | English |
| `s` | `actionState` | Action-state code (0–5 observed); `5` has been observed meaning walking. Other values not established. | English |
| `w` | `moveSpeed` | Move speed in x/y units per second (2.11–2.43 observed) — a speed, not a period; do not invert it. | English |
| `c` | `cell` | Map cell index the hero occupies — the same index space as `loot[].cell`, `hits[].cell`, `bombs[].cell`, `explosions[].cell`. | English |
| `z` | `z` | Boolean field. Meaning not established from this capture. | English |
| `sk` | `sk` | Numeric field (0–6 observed). Meaning not established from this capture. | English |
| `c` | `cell` | Index of the map cell the destroyed prop stood in. | English |
| `g` | `gold` | Gold this prop paid out. Arrives on the wire as a digit string (observed "1580"…"6636"), not a number — a malformed value must be rejected rather than propagated. | English |
| `c` | `cell` | Index of the map cell the hit landed in. | English |
| `d` | `damage` | Damage dealt (179–107101 observed). | English |
| `cr` | `critical` | Whether the hit was a critical. | English |
| `c` | `cell` | Index of the map cell the bomb sits in. | English |
| `f` | `fuseRemainingSeconds` | Fuse remaining, seconds (0.02–1.93 observed). | English |
| `ft` | `fuseTotalSeconds` | Fuse total, seconds (1.92–1.99 observed). | English |
| `r` | `radius` | Blast radius in cells (1–3 observed). | English |
| `c` | `cell` | Index of the map cell the explosion is centred on. | English |
| `r` | `radius` | Blast radius in cells. | English |
| `ev` | `event` | Rotation-event name. | English |
| `hero` | `heroId` | Hero id the event concerns. | English |
| `secs` | `seconds` | Seconds value carried by the event (20–840 observed). | English |
| `c` | `c` | Meaning not established from this capture. | English |
| `m` | `m` | Meaning not established from this capture. | English |
| `n` | `n` | Meaning not established from this capture. | English |
| `bonus_secs` | `bonusSeconds` | Seconds remaining in a gold-bonus window. Absent from the capture this lexicon is built from — it was taken outside a bonus window — but documented as arriving per tick during one. | English |
| `bonus_mult` | `bonusMultiplier` | Gold-bonus multiplier active during a bonus window. Absent from the capture this lexicon is built from — documented as arriving per tick during one, alongside `bonus_secs`. | English |

### `t` values

| Wire token | Domain field | Description | Origin |
| --- | --- | --- | --- |
| `snap` | `snapMessageType` | The only observed value of `t`: a live combat-frame snapshot tick. | English |


## PVP duel result and film

The duel result the client receives on Challenge and the film it fetches right after mix Portuguese keys (`venceu`, `fase`, `filme`) with English ones (`slots`, `squad`, `hz`) — see `packages/game-api/src/pvp/lexicon.ts`. The film’s per-frame keys are declared for documentation only; the desktop keeps a film whole and reads its header.

### Keys

| Wire token | Domain field | Description | Origin |
| --- | --- | --- | --- |
| `venceu` | `won` | Whether the attacker won the duel. | Portuguese |
| `fase` | `phase` | On a result: the combat phase the duel was fought in, not the tier floor. On the state and the film: see the row. | Portuguese |
| `filme` | `filmId` | The film id the server issued for the duel; 0 when none was. | Portuguese |
| `salas` | `rooms` | Room clears over the duel. | Portuguese |
| `segundos` | `seconds` | Duel length in seconds (60 observed). | Portuguese |
| `atacante` | `attacker` | The side that pressed Challenge — the player. | Portuguese |
| `defensor` | `defender` | The side that was challenged — the opponent. | Portuguese |
| `nome` | `name` | A side's display name. | Portuguese |
| `herois` | `heroes` | How many heroes a side fielded. | Portuguese |
| `dano` | `score` | A side's score: the HP it tore off the other side. | Portuguese |
| `pontos_antes` | `pointsBefore` | PVP points before the duel settled. | Portuguese |
| `pontos_depois` | `pointsAfter` | PVP points after the duel settled. | Portuguese |
| `duelos_restantes` | `duelsLeft` | Duels left in the quota. | Portuguese |
| `duelos_max` | `duelsMax` | The duel quota. | Portuguese |
| `premio` | `prize` | Whether the rune chest landed (`won`) or was lost to a full bag (`lost`). | Portuguese |
| `estado` | `state` | The full PVP state after the duel. | Portuguese |
| `pontos` | `points` | Current PVP points. | Portuguese |
| `faixa` | `tier` | The tier token (`r1`…`r6`). | Portuguese |
| `faixa_num` | `tierNumber` | The tier as a number. | Portuguese |
| `faixa_prox` | `tierNext` | Points to the next tier. | Portuguese |
| `slots` | `slots` | Squad slots available. | English |
| `squad` | `squad` | The squad, one entry per filled slot. | English |
| `slot` | `slot` | A squad entry’s slot index. | English |
| `hero_id` | `heroId` | A squad entry’s hero id. | English |
| `duelos_usados` | `duelsUsed` | Duels spent from the quota. | Portuguese |
| `enabled` | `enabled` | Whether PVP is open to the account. | English |
| `slots_max` | `slotsMax` | Squad slots at the top of the ladder. | English |
| `slots_all` | `slotsAll` | Squad slots granted at each squad level. | English |
| `active_tier` | `activeTier` | Meaning not established. | English |
| `level` | `level` | Squad level of the highest rarity house. Meaning not fully established. | English |
| `levels` | `levels` | Per-rarity squad house levels. | English |
| `max_level` | `maxLevel` | The squad house level cap (20 observed). | English |
| `upgrade_cost` | `upgradeCost` | The time items the next squad upgrade costs, per rarity. | English |
| `qtd` | `quantity` | How many of a rarity the upgrade costs. | Portuguese |
| `rarity` | `rarity` | The rarity an upgrade cost entry is priced in. | English |
| `by` | `by` | Which leaderboard the body is: `pvp`, `hero` or `power`. | English |
| `top` | `top` | The top hundred, one entry per rank. | English |
| `me` | `me` | The player's own entry, whatever their rank. | English |
| `rank` | `rank` | A leaderboard position, 1 at the top. | English |
| `name` | `name` | An entry's display name. | English |
| `value` | `value` | The figure the board ranks by, as a string of digits (PVP points on the `pvp` board). | English |
| `hero_skin` | `heroSkin` | An entry's shown skin index. | English |
| `badges` | `badges` | An entry's badge tokens. | English |
| `id` | `filmId` | The film’s own id — the value the result named in `filme`. | English |
| `fase_visual` | `visualPhase` | The phase the film draws its room as. | Portuguese |
| `hz` | `hz` | Frames per second the film was sampled at (12 observed). | English |
| `a` | `attackerHeroes` | Per-hero attacker entries, index = squad slot. | English |
| `d` | `defenderHeroes` | Per-hero defender entries, index = squad slot. | English |
| `sk` | `skill` | A film hero entry’s skill field. Meaning not established. | English |
| `t` | `t` | A film hero entry’s `t` field. Meaning not established. | English |
| `q` | `frames` | The film’s frames (721 observed for a 60 s duel at 12 Hz). | English |
| `t` | `time` | Frame time. | English |
| `hp` | `hp` | Room HP at the frame. | English |
| `da` | `attackerDamage` | Attacker damage so far. | English |
| `dd` | `defenderDamage` | Defender damage so far. | English |
| `k` | `k` | Optional per-frame field. Meaning not established. | English |
| `c` | `c` | Per-frame field. Meaning not established. | English |
| `h` | `heroes` | Per-frame hero entries. | English |
| `b` | `bombs` | Per-frame bomb entries. | English |
| `x` | `x` | Per-frame entities (one observed, with `a`, `k` and an `hp` on a 0–255 scale). Meaning not established. | English |
| `l` | `side` | A bomb’s or hero’s side: 0 attacker, 1 defender. | English |
| `ce` | `cell` | The cell a bomb sits in, or a hero stands on. | English |
| `r` | `radius` | A bomb’s blast radius in cells. | English |
| `f` | `fuseLeft` | Seconds of fuse a bomb has left at the frame. | English |
| `ft` | `fuseTotal` | A bomb’s whole fuse; with the side and cell it identifies one bomb across frames. | English |
| `l` | `side` | A frame hero’s side: 0 attacker, 1 defender. | English |
| `i` | `slot` | A frame hero’s squad slot. | English |
| `ce` | `cell` | The cell a frame hero stands on. | English |
| `st` | `state` | A frame hero’s state, 0–5 observed. Meaning not established. | English |

### `premio` values

| Wire token | Domain field | Description | Origin |
| --- | --- | --- | --- |
| `won` | `prize` | The rune chest landed in the bag. | English |
| `lost` | `prize` | The rune chest was lost to a full bag. | English |
| `pvp` | `by` | The PVP points leaderboard. | English |
| `hero` | `by` | The strongest-hero leaderboard. | English |
| `power` | `by` | The total-power leaderboard. | English |

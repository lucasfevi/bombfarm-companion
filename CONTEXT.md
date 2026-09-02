# Domain glossary — Bomb Farm Companion

Ubiquitous language for the companion's game model. Terms only — no implementation detail.

## Farming economics

- **Farm page** — the planner page (formerly "Phases") hosting the Farm Ranking and the
  per-phase explorer. Named "Farm" in both EN and PT.
- **Farm Ranking** — the per-phase table of estimated resource rates (gold/hr, chests/hr, …)
  for the player's current account, sorted best-first.
- **Farm rate** — an estimated resources-per-hour figure for one phase, assuming the player
  parks the squad there and farms continuously.
- **Rotation pool** — the set of heroes the player has enabled for farming estimation. Mirrors
  the game's auto-queue: enabled heroes cycle between field and Casa; disabled heroes are
  ignored entirely. Defaults to the save's `battle_allowed`.
- **Uptime** — the fraction of wall-clock time a hero is on the field rather than resting:
  field time / (field time + Casa rest time).
- **Push target** — a phase above the account's `max_phase` whose estimated farm rate beats
  every unlocked phase; shown locked, as a reason to push progression.
- **One-shot** — a hero's average hit destroys a prop in a single blast. When the whole
  rotation pool one-shots every prop type on a phase, throughput is plant-rate-bound, not
  damage-bound.
- **Cadence model** — the measured bomb-cycle model: cycle time ≈ max(fuse time, walk
  time between plants). Supersedes the serial fuse+constant model for farm-rate estimation
  only; the advisor keeps the serial model.
- **Return Bonus (Bônus de Retorno)** — banked offline time (cap 8h) during which gold, XP,
  and every drop chance are boosted (+40%, +80% VIP). Only multiplies what the player
  destroys while it runs.

## Loot

- **Sorte (field luck)** — the loot-chance multiplier: average luck of on-field heroes plus the
  skill tree's luck total. Multiplies chest/key/gem/time drop chances. **Gold ignores Sorte**;
  gold scales with the tree's coin (`team_coin`) total instead.
- **Item chest (baú de item/herói)** — per-prop drop, any phase; rarity rolled on open.
- **Key (chave)** — per-prop drop on **non-gate phases only**; falls ready (no chest); rarity
  matches the phase's difficulty. Entering a gate consumes one key of that difficulty.
- **Gate** — every X-10 phase: timed boss room. Gem chests and time chests drop **only**
  here; keys **never** drop here. Estimated clear time above the gate timer means a timeout
  loop — farming there is infeasible.
- **Gem chest (baú de gema)** — gate-only per-prop drop; rank distribution depends on
  difficulty; only source of gems (→ stars).
- **Time chest / time piece (baú/peça de tempo)** — gate-only per-prop drop; the Casa
  upgrade currency; piece rarity rolled by difficulty.
- **Hero chest (jaula)** — clock-driven (logged play time), not farm-rate-driven; excluded
  from per-phase rate columns. Per-phase facts shown instead: early-arrival chance cap and
  guaranteed-spawn window.
- **Skill stones (reroll items)** — the ability-reroll cost items. **No drop rate is known**
  (wiki/API silent); excluded from estimates until captured.

## Market value

- **Holdings** — what the account could liquidate on the Steam market right now: the bag, the
  sellable heroes, and the unlocked skins. Gold is not holdings — it never leaves the game, and
  summing the two would produce a number in no unit at all.
- **Sellable** — the game's own permission to list a thing on the market. Anything it refuses
  is not merely unpriced, it was never a candidate, and it stays out of both the value and the
  count that value is measured against.
- **Coverage** — how much of what *could* be priced actually is, right now. Every stated value
  is of a subset, because a sellable thing with no live listing has no price; a value without
  its coverage reads as a claim about the whole.
- **Hero floor** — a hero's market value. The market identifies a hero by rarity and nothing
  else, so a long-invested hero and a fresh one of the same rarity quote identically. The
  figure is a floor, never an appraisal.
- **Bought skin** — a cosmetic beyond the four a hero can be born wearing. Bought skins are
  unlocked **per account, not per hero**: one unlock dresses any number of heroes, so the
  account holds one of it however many heroes wear it.
- **Worn skin** — the skin a hero is currently wearing, and the only evidence the account owns
  that skin at all. Nothing enumerates skins another way, and a skin that has left every hero
  has left the account, so holdings count what is on someone's back and nothing else. A skin
  gone from the roster is gone from the value, and the screen says so rather than leaving the
  reader to notice a figure that dropped.

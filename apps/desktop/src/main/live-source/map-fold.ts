import type { LiveMap, LiveMapEconomy, LiveMapSize, LiveTick } from '@bombfarm/contracts';
import type { EconomyBoost } from '@bombfarm/domain/farm-rate';
import { mapSizeOfCells } from '@bombfarm/domain/model';

/** The wire reports room health and per-prop health as a byte, `255` meaning full. */
const WIRE_HEALTH_FULL = 255;

/** The multipliers the map's economy is worth under: the account's, from the slow authenticated
 *  read, and the running Boosts and field heroes' XP runes and Aprendiz, from the stream. */
export interface MapAccountBoosts {
  /** `skills.totals.xp_mult`. `1` is the identity; `null` (no usable multiplier read) withholds
   *  the XP estimate. */
  readonly xpMult: number | null;
  /** Team Coin, PERCENTAGE POINTS — `skills.totals.coin_add * 100`. `0` is the identity. */
  readonly teamCoinPct: number;
  /** The Collections gold bonus, percent — `skills.totals.colecao.ouro`. `0` is the identity. */
  readonly collectionGoldPct: number;
  /** The account owns the Pass right now — its always-on gold and XP add apply on every map. */
  readonly pass: boolean;
  /** The Boosts running, per axis, and the Pass Bonus. Absent, none. */
  readonly boost?: EconomyBoost;
  /** The field heroes' XP-rune multiplier, weighted equally across them. Absent, `1`. */
  readonly xpRuneMix?: number;
  /** Aprendiz over the heroes on the field, a factor on every prop's XP. Absent, `1`. */
  readonly apprenticeXpMult?: number;
}

export const NO_MAP_ACCOUNT_BOOSTS: MapAccountBoosts = { xpMult: null, teamCoinPct: 0, collectionGoldPct: 0, pass: false };

/** What one phase is worth under one set of boosts. `null` for a phase with no wiki row. */
export interface MapWikiFacts {
  readonly propsTotal: number;
  readonly economy: LiveMapEconomy;
}

export interface MapFoldDeps {
  readonly wikiFactsFor: (phase: number, boosts: MapAccountBoosts, returnWindow: boolean) => MapWikiFacts | null;
}

/**
 * The live map reading, folded from the tick stream and held as the latest value rather than
 * accumulated: unlike earnings, every figure here describes the present state of the map, so a
 * tick simply replaces the one before it.
 *
 * Each field is carried forward independently when a tick omits it. The stream sends a phase on
 * ticks whose grid is absent and vice versa, and blanking a figure the app still knows because
 * one tick left it out makes the panel flicker between a reading and an em dash.
 */
export class MapFold {
  readonly #deps: MapFoldDeps;
  #lastSequence = -1;
  #phase: number | undefined;
  #healthFraction: number | null = null;
  #propsAlive: number | null = null;
  #mapSize: LiveMapSize | null = null;
  #boosts: MapAccountBoosts = NO_MAP_ACCOUNT_BOOSTS;
  #returnWindow = false;
  #wikiFacts: { readonly key: string; readonly facts: MapWikiFacts | null } | null = null;

  constructor(deps: MapFoldDeps) {
    this.#deps = deps;
  }

  consumeTick(tick: LiveTick, sequence: number): void {
    if (sequence <= this.#lastSequence) return;
    this.#lastSequence = sequence;

    if (tick.phase !== undefined) this.#phase = tick.phase;
    if (tick.roomHp !== undefined) this.#healthFraction = clampFraction(tick.roomHp / WIRE_HEALTH_FULL);
    if (tick.kinds !== undefined) {
      this.#propsAlive = countPropsAlive(tick.kinds);
      this.#mapSize = mapSizeOfCells(tick.kinds.length) ?? this.#mapSize;
    }
    this.#returnWindow = (tick.bonusMultiplier ?? 1) > 1;
  }

  /** The account's own multipliers, from the slow authenticated read. Applying them is what makes
   *  the economy figures the player's rather than the wiki's. */
  setAccountBoosts(boosts: MapAccountBoosts): void {
    this.#boosts = boosts;
  }

  /** Drops what the STREAM said, not what the account said: the boosts are owned by
   *  {@link setAccountBoosts} and its caller re-supplies them on every read, so clearing them
   *  here would only ever report an unboosted economy for a while. */
  reset(): void {
    this.#lastSequence = -1;
    this.#phase = undefined;
    this.#healthFraction = null;
    this.#propsAlive = null;
    this.#mapSize = null;
    this.#returnWindow = false;
    this.#wikiFacts = null;
  }

  /** `null` until a phase has been reported: every other figure describes a map, and there is
   *  nothing to attach them to before the stream has said which one is being played. */
  get current(): LiveMap | null {
    if (this.#phase === undefined) return null;
    const facts = this.#factsFor(this.#phase);
    return {
      phase: this.#phase,
      healthFraction: this.#healthFraction,
      propsAlive: this.#propsAlive,
      propsTotal: facts?.propsTotal ?? null,
      mapSize: this.#mapSize,
      economy: facts?.economy ?? null,
    };
  }

  /** Memoized on the phase, the boosts and the Return Bonus window together — this getter is read on every fast-channel
   *  poll, and the wiki lookup behind it walks the whole prop mix. All of them move rarely
   *  (a map change, an account read, a Boost or a field change, a window opening or closing), so
   *  one cached entry covers the common case. */
  #factsFor(phase: number): MapWikiFacts | null {
    const boosts = this.#boosts;
    const boost = boosts.boost;
    const key = [
      phase,
      boosts.xpMult,
      boosts.teamCoinPct,
      boosts.collectionGoldPct,
      boosts.pass,
      boost?.gold ?? false,
      boost?.xp ?? false,
      boost?.drop ?? false,
      boost?.passBonus?.gold ?? 0,
      boost?.passBonus?.xp ?? 0,
      boosts.xpRuneMix ?? 1,
      boosts.apprenticeXpMult ?? 1,
      this.#returnWindow,
    ].map(String).join('|');
    if (this.#wikiFacts?.key === key) return this.#wikiFacts.facts;
    const facts = this.#deps.wikiFactsFor(phase, this.#boosts, this.#returnWindow);
    this.#wikiFacts = { key, facts };
    return facts;
  }
}

/** Occupancy is read from `kinds` alone — see {@link LiveTick.hps} for why the parallel HP array
 *  cannot answer this question. */
function countPropsAlive(kinds: readonly number[]): number {
  let alive = 0;
  for (const kind of kinds) {
    if (kind >= 0) alive += 1;
  }
  return alive;
}

/** The wire has been observed to exceed `255` on the tick a map resets. A fraction above 1 would
 *  render as a health bar overflowing its own track, so it is clamped rather than trusted. */
function clampFraction(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

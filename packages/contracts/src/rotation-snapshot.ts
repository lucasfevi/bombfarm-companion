/**
 * The normalized `/rotation` boundary. English domain field
 * names only — `@bombfarm/game-api`'s `normalizeRotation` (`packages/game-api/src/rotation/
 * normalize.ts`) is the one place the wire's mixed-language vocabulary gets translated into this
 * shape; everything downstream, including across IPC, reads only these names.
 */

/** A hero's rotation activity. Every member here is the English rendering of one wire `state`
 *  token declared in `packages/game-api/src/rotation/lexicon.ts` — `resting`/`inField`/`benched`. */
export type RotationHeroActivity = 'resting' | 'inField' | 'benched';

/** One field a normalizer dropped, and why. `path` names the field's WIRE location (e.g. a
 *  specific hero's energy field, or the house's cycle-time field) so a report is diagnosable
 *  without a debugger, the same reasoning `SectionFidelity`'s `missingKeys`/`addedKeys` already
 *  follows. */
export interface FieldDrop {
  readonly path: string;
  readonly reason: 'missing' | 'wrong_type' | 'out_of_range' | 'duplicate';
}

export interface RotationHeroSnapshot {
  /** The only non-optional field: a hero with no usable id cannot be represented at all, so it
   *  is dropped whole rather than carried with a hole here. */
  readonly id: string;
  readonly level?: number;
  readonly energy?: number;
  readonly energyMax?: number;
  /** In [0, 1]. Ordinarily the wire's own reported fraction; forced to exactly `1` when `energy`
   *  exceeds `energyMax` (both are kept in that case — see `normalize.ts`). */
  readonly energyFraction?: number;
  readonly activity?: RotationHeroActivity;
  readonly onField?: boolean;
  readonly inHouse?: boolean;
  readonly recovering?: boolean;
  readonly battleAllowed?: boolean;
  /** Joined from `/roster` by id. Absent — never a placeholder like `"Unknown"` — when no
   *  matching roster entry exists yet; `/roster` refreshes on a slower clock, so this is a
   *  routine, non-error state. */
  readonly name?: string;
  /** The roster entry's `rank` field. Same absence rule as `name`. */
  readonly grade?: string;
}

export interface HouseSnapshot {
  /** 0-based index into {@link houseLevels}. Deliberately NOT the wire's own 1-based house
   *  index — the `Index` suffix marks the convention change so a caller cannot mistakenly reuse
   *  the wire's numbering. */
  readonly activeHouseIndex?: number;
  readonly houseLevels?: readonly number[];
  readonly cycleSeconds?: number;
  readonly slots?: number;
  readonly slotsPerHouse?: readonly number[];
  readonly cycleSecondsPerHouse?: readonly number[];
  readonly upgradeCost?: readonly number[];
}

export interface RotationSnapshot {
  readonly fieldSize?: number;
  /** Always an array, never absent — an unusable or missing wire `heroes` list normalizes to
   *  `[]` plus a drop event, rather than making this field optional. */
  readonly heroes: readonly RotationHeroSnapshot[];
  readonly house?: HouseSnapshot;
  readonly rescuesLeft?: number;
  readonly rescuesMax?: number;
}

export interface RotationNormalizeResult {
  readonly snapshot: RotationSnapshot;
  readonly drops: readonly FieldDrop[];
}

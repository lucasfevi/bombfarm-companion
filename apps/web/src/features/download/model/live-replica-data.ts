/**
 * One mid-game session, played back on a loop.
 *
 * Every reading is derived from the elapsed second by `replicaFrameAt`, so the drawing has no
 * accumulating state: it is the same at second 3 of the first pass and second 3 of the hundredth,
 * it renders identically on the server and after hydration, and a test can ask for any instant.
 *
 * The readings are derived from each other rather than picked one by one. Clearing the map is what
 * pays, so gold and XP climb out of the same map health that is draining and the same props that
 * are dying — a viewer who checks whether the numbers agree finds that they do. It runs faster
 * than a real clear because fifteen seconds has to show visible movement; the *relationships* are
 * honest even though the pace is not.
 */
export const LOOP_SECONDS = 15;

/**
 * Which of the two Live windows a panel is being drawn for: the full-size tab, or the compact
 * second window. It selects the figure set and the type scale, and nothing else — both densities
 * read the same frame.
 */
export type ReplicaDensity = 'full' | 'compact';

export type ReplicaRowState = 'on-field' | 'recovering' | 'queued' | 'benched';

export interface ReplicaHeroSeed {
  readonly id: string;
  readonly name: string;
  readonly skin: number;
  readonly rarity: number;
  readonly grade: string;
  readonly stars: number;
  readonly level: number;
  readonly state: ReplicaRowState;
  readonly energyPercent: number;
  /** Per second, signed: a hero on the field spends energy, a resting one recovers it. */
  readonly energyRate: number;
  readonly countdownSeconds?: number;
}

/** Names, skins, rarities and levels from a real account, so the drawing shows a real roster. */
const HERO_SEEDS: readonly ReplicaHeroSeed[] = [
  { id: 'bellatrix', name: 'Bellatrix', skin: 5, rarity: 1, grade: 'S', stars: 2, level: 106, state: 'on-field', energyPercent: 71, energyRate: -0.35, countdownSeconds: 252 },
  { id: 'jon', name: 'Jon', skin: 5, rarity: 2, grade: 'A', stars: 2, level: 96, state: 'on-field', energyPercent: 54, energyRate: -0.3, countdownSeconds: 108 },
  { id: 'minato', name: 'Minato', skin: 5, rarity: 2, grade: 'A', stars: 2, level: 95, state: 'recovering', energyPercent: 24, energyRate: 0.5, countdownSeconds: 161 },
  { id: 'buff-s-1', name: 'Buff S #1', skin: 6, rarity: 2, grade: 'B', stars: 1, level: 85, state: 'queued', energyPercent: 100, energyRate: 0 },
  { id: 'wb-1', name: 'WB #1', skin: 3, rarity: 0, grade: 'B', stars: 1, level: 84, state: 'queued', energyPercent: 100, energyRate: 0 },
  { id: 'wb-2', name: 'WB #2', skin: 3, rarity: 0, grade: 'C', stars: 1, level: 77, state: 'benched', energyPercent: 88, energyRate: 0 },
];

export interface ReplicaHero extends Omit<ReplicaHeroSeed, 'energyRate'> {
  readonly countdown?: string;
}

export interface ReplicaDamageAmounts {
  readonly damage: number;
  readonly props: number;
  readonly gold: number;
}

export interface ReplicaDamageHero
  extends Pick<ReplicaHeroSeed, 'id' | 'name' | 'skin' | 'rarity' | 'grade' | 'stars' | 'level'>,
    ReplicaDamageAmounts {
  readonly fieldSeconds: number;
  /** Damage over the seconds the hero stood on the field. */
  readonly dps: number;
}

export interface ReplicaDamage {
  readonly teamDps10: number;
  readonly teamDpsSession: number;
  /** The damage the ten-minute figure divides, and the seconds it divides it by. */
  readonly window10: { readonly damage: number; readonly seconds: number };
  readonly sessionSeconds: number;
  readonly coverageMinutes: number;
  readonly team: ReplicaDamageAmounts;
  /** Sorted by damage, largest first. */
  readonly heroes: readonly ReplicaDamageHero[];
  /** What could not be tied to one hero: heroes plus this always add up to the team figures. */
  readonly unattributed: ReplicaDamageAmounts;
}

/**
 * Numbers, not strings — the components format them with the reader's own separator convention,
 * the way every other figure on the site is written.
 */
export interface ReplicaFrame {
  readonly earnings: {
    readonly goldPerHour: number;
    readonly xpPerHour: number;
    readonly currentGold: number;
    readonly goldSession: number;
    readonly goldSessionTotal: number;
    readonly elapsed: string;
    readonly xpSession: number;
    readonly xpSessionTotal: number;
    /** The rolling gold-rate window the trend line draws, oldest sample first. */
    readonly goldSeries: readonly number[];
    readonly seriesMinutes: number;
  };
  /**
   * Counted from what dropped, as against the map card's estimates. `goldPerPropDelta` is the
   * signed deviation from the map's own estimate, so the two cards agree the way the app's do.
   */
  readonly measured: {
    readonly goldPerProp: number;
    readonly goldPerPropDeltaPercent: number;
    readonly propsPerMinute: number;
    readonly propsSession: number;
  };
  readonly map: {
    /** The phase itself — the card names it with the domain's own helpers, as the desktop does. */
    readonly phase: number;
    readonly healthPercent: number;
    readonly propsAlive: number;
    readonly propsTotal: number;
    readonly xpPerProp: number;
    readonly goldPerProp: number;
    readonly goldPerClear: number;
  };
  readonly summary: {
    readonly onField: string;
    readonly resting: string;
    readonly idle: string;
    readonly benched: string;
  };
  readonly heroes: readonly ReplicaHero[];
  readonly damage: ReplicaDamage;
}

const BASE_SESSION_SECONDS = 12_005;
const REPLICA_PHASE = 126;
const PROPS_TOTAL = 240;
const BASE_PROPS_ALIVE = 214;
const BASE_MAP_HEALTH = 38;
const BASE_CURRENT_GOLD = 4_210_000;
const BASE_GOLD_TOTAL = 1_210_000;
const BASE_XP_TOTAL = 287_000;

const GOLD_PER_CLEAR = 1_840_000;
const XP_PER_PROP = 41;
const GOLD_PER_PROP = 173;
const MEASURED_GOLD_PER_PROP = 168;
const MEASURED_PROPS_PER_MINUTE = 41;
const BASE_PROPS_SESSION = 8_940;
const SERIES_MINUTES = 10;
const SERIES_POINTS = 24;

/**
 * A gold-rate window that wanders the way a real one does — fixed, because the drawing has to be
 * the same on the server and after hydration, and `Math.random()` would make it neither.
 */
const GOLD_SERIES_BASE: readonly number[] = [
  318, 331, 342, 336, 351, 364, 358, 372, 381, 375, 389, 396, 384, 371, 366, 379, 392, 401, 394,
  386, 377, 368, 359, 364, 373, 385, 397, 405, 398, 388, 376, 369, 361, 355, 367, 380, 391, 399,
];

const BASE_TEAM_DPS = 150_000;
const TEAM_DAMAGE_PER_SECOND = 152_000;
const WINDOW_SECONDS = 600;
const WINDOW_DAMAGE_BASE = 94_800_000;
const SHARE_DENOMINATOR = 10_000;

interface DamageShare {
  readonly id: string;
  /** In basis points of the team figure, so the split is integer and the remainder is exact. */
  readonly damageShare: number;
  readonly propsShare: number;
  readonly goldShare: number;
  readonly fieldSecondsBase: number;
}

/**
 * Who carried the farm, from the roster above. Each share is a slice of the team figure; what the
 * shares leave over is the Unattributed row, so the table always adds up to the team line the way
 * the app's own does.
 */
const DAMAGE_SHARES: readonly DamageShare[] = [
  { id: 'bellatrix', damageShare: 3800, propsShare: 3600, goldShare: 3700, fieldSecondsBase: 11_400 },
  { id: 'jon', damageShare: 2900, propsShare: 2800, goldShare: 2700, fieldSecondsBase: 9_800 },
  { id: 'minato', damageShare: 1700, propsShare: 1500, goldShare: 1600, fieldSecondsBase: 6_200 },
  { id: 'buff-s-1', damageShare: 900, propsShare: 900, goldShare: 850, fieldSecondsBase: 3_000 },
  { id: 'wb-1', damageShare: 500, propsShare: 450, goldShare: 400, fieldSecondsBase: 1_700 },
];

function shareOf(total: number, basisPoints: number): number {
  return Math.floor((total * basisPoints) / SHARE_DENOMINATOR);
}

function damageAt(whole: number, teamProps: number, teamGold: number): ReplicaDamage {
  const sessionSeconds = BASE_SESSION_SECONDS + whole;
  const teamDamage = BASE_TEAM_DPS * BASE_SESSION_SECONDS + TEAM_DAMAGE_PER_SECOND * whole;
  const window10Damage = WINDOW_DAMAGE_BASE + TEAM_DAMAGE_PER_SECOND * whole;

  const heroes = DAMAGE_SHARES.map((share): ReplicaDamageHero => {
    const seed = HERO_SEEDS.find((candidate) => candidate.id === share.id);
    if (seed === undefined) throw new Error(`damage share names an unknown hero: ${share.id}`);
    const damage = shareOf(teamDamage, share.damageShare);
    const fieldSeconds = share.fieldSecondsBase + (seed.state === 'on-field' ? whole : 0);
    return {
      id: seed.id,
      name: seed.name,
      skin: seed.skin,
      rarity: seed.rarity,
      grade: seed.grade,
      stars: seed.stars,
      level: seed.level,
      damage,
      props: shareOf(teamProps, share.propsShare),
      gold: shareOf(teamGold, share.goldShare),
      fieldSeconds,
      dps: damage / fieldSeconds,
    };
  });

  const attributed = heroes.reduce(
    (sum, hero) => ({
      damage: sum.damage + hero.damage,
      props: sum.props + hero.props,
      gold: sum.gold + hero.gold,
    }),
    { damage: 0, props: 0, gold: 0 },
  );

  return {
    teamDps10: window10Damage / WINDOW_SECONDS,
    teamDpsSession: teamDamage / sessionSeconds,
    window10: { damage: window10Damage, seconds: WINDOW_SECONDS },
    sessionSeconds,
    coverageMinutes: SERIES_MINUTES,
    team: { damage: teamDamage, props: teamProps, gold: teamGold },
    heroes: [...heroes].sort((left, right) => right.damage - left.damage || left.id.localeCompare(right.id)),
    unattributed: {
      damage: teamDamage - attributed.damage,
      props: teamProps - attributed.props,
      gold: teamGold - attributed.gold,
    },
  };
}

/** At least a point a second, so the bar visibly empties inside one pass of the loop. */
const HEALTH_DROP_PER_SECOND = 1.2;

/** H:MM:SS, matching the desktop's own elapsed reading — which is why the clock visibly ticks. */
function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours)}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function replicaFrameAt(elapsedSeconds: number): ReplicaFrame {
  const seconds = Math.max(0, Math.min(LOOP_SECONDS, elapsedSeconds));
  const whole = Math.floor(seconds);

  const healthPercent = clampPercent(BASE_MAP_HEALTH - seconds * HEALTH_DROP_PER_SECOND);
  const clearedFraction = (BASE_MAP_HEALTH - healthPercent) / 100;

  // What the clear has paid so far, from the map's own per-clear value and prop count.
  const propsDestroyed = Math.round(BASE_PROPS_ALIVE * (clearedFraction / (BASE_MAP_HEALTH / 100)));
  const goldEarned = Math.round(GOLD_PER_CLEAR * clearedFraction);
  const xpEarned = propsDestroyed * XP_PER_PROP;

  const heroes = HERO_SEEDS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    skin: seed.skin,
    rarity: seed.rarity,
    grade: seed.grade,
    stars: seed.stars,
    level: seed.level,
    state: seed.state,
    energyPercent: Math.round(clampPercent(seed.energyPercent + seed.energyRate * seconds)),
    countdown:
      seed.countdownSeconds === undefined
        ? undefined
        : formatCountdown(seed.countdownSeconds - whole),
  }));

  return {
    earnings: {
      goldPerHour: 371_200,
      xpPerHour: 88_400,
      currentGold: BASE_CURRENT_GOLD + goldEarned,
      goldSession: 362_900,
      goldSessionTotal: BASE_GOLD_TOTAL + goldEarned,
      elapsed: formatElapsed(BASE_SESSION_SECONDS + whole),
      xpSession: 86_100,
      xpSessionTotal: BASE_XP_TOTAL + xpEarned,
      goldSeries: Array.from(
        { length: SERIES_POINTS },
        (_unused, index) => GOLD_SERIES_BASE[(whole + index) % GOLD_SERIES_BASE.length] * 1000,
      ),
      seriesMinutes: SERIES_MINUTES,
    },
    measured: {
      goldPerProp: MEASURED_GOLD_PER_PROP,
      goldPerPropDeltaPercent:
        Math.round(((MEASURED_GOLD_PER_PROP - GOLD_PER_PROP) / GOLD_PER_PROP) * 1000) / 10,
      propsPerMinute: MEASURED_PROPS_PER_MINUTE,
      propsSession: BASE_PROPS_SESSION + propsDestroyed,
    },
    map: {
      phase: REPLICA_PHASE,
      healthPercent: Math.round(healthPercent * 10) / 10,
      propsAlive: BASE_PROPS_ALIVE - propsDestroyed,
      propsTotal: PROPS_TOTAL,
      xpPerProp: XP_PER_PROP,
      goldPerProp: GOLD_PER_PROP,
      goldPerClear: GOLD_PER_CLEAR,
    },
    summary: { onField: '2/4', resting: '1/3', idle: '2', benched: '1' },
    heroes,
    damage: damageAt(whole, BASE_PROPS_SESSION + propsDestroyed, BASE_GOLD_TOTAL + goldEarned),
  };
}

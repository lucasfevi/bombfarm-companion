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

export type ReplicaRowState = 'on-field' | 'recovering' | 'queued' | 'benched';

export interface ReplicaHeroSeed {
  readonly id: string;
  readonly name: string;
  readonly skin: number;
  readonly rarity: number;
  readonly grade: string;
  readonly level: number;
  readonly state: ReplicaRowState;
  readonly energyPercent: number;
  /** Per second, signed: a hero on the field spends energy, a resting one recovers it. */
  readonly energyRate: number;
  readonly countdownSeconds?: number;
}

/** Names, skins, rarities and levels from a real account, so the drawing shows a real roster. */
const HERO_SEEDS: readonly ReplicaHeroSeed[] = [
  { id: 'bellatrix', name: 'Bellatrix', skin: 5, rarity: 1, grade: 'S', level: 106, state: 'on-field', energyPercent: 71, energyRate: -0.35, countdownSeconds: 252 },
  { id: 'jon', name: 'Jon', skin: 5, rarity: 2, grade: 'A', level: 96, state: 'on-field', energyPercent: 54, energyRate: -0.3, countdownSeconds: 108 },
  { id: 'minato', name: 'Minato', skin: 5, rarity: 2, grade: 'A', level: 95, state: 'recovering', energyPercent: 24, energyRate: 0.5, countdownSeconds: 161 },
  { id: 'buff-s-1', name: 'Buff S #1', skin: 6, rarity: 2, grade: 'B', level: 85, state: 'queued', energyPercent: 100, energyRate: 0 },
  { id: 'wb-1', name: 'WB #1', skin: 3, rarity: 0, grade: 'B', level: 84, state: 'queued', energyPercent: 100, energyRate: 0 },
  { id: 'wb-2', name: 'WB #2', skin: 3, rarity: 0, grade: 'C', level: 77, state: 'benched', energyPercent: 88, energyRate: 0 },
];

export interface ReplicaHero extends Omit<ReplicaHeroSeed, 'energyRate'> {
  readonly countdown?: string;
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
  };
}

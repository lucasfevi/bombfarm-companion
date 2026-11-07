import type { LiveBomb, LiveBoost, LiveBoostAxis, LiveExplosion, LiveHit, LiveLootPop, LiveTick, LiveTickHero } from '@bombfarm/contracts';
import { isPlainObject } from '../type-guards.js';
import { wireKey } from './lexicon.js';

function readNumber(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(raw: Record<string, unknown>, key: string): boolean | undefined {
  const value = raw[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readString(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Gold arrives on the wire as a digit string (observed `"9724194"`…`"10294318"` for the account
 * total, `"1580"`…`"6636"` for a single loot payout), not a number — `LiveTick.gold` and
 * `LiveLootPop.gold` are both typed `number`, so a value that is not a well-formed digit string is
 * dropped here rather than reaching either as `NaN`.
 */
function readWireMoney(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readArray(raw: Record<string, unknown>, key: string): readonly unknown[] {
  const value = raw[key];
  return Array.isArray(value) ? value : [];
}

/** `undefined` when the wire omitted the array entirely, so a tick with no loot/hits this tick is
 *  told apart from one where the field was simply absent — matching the optional `readonly … []`
 *  contract fields these feed. */
function readOptionalArray(raw: Record<string, unknown>, key: string): readonly unknown[] | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function mapHero(raw: unknown): LiveTickHero | undefined {
  if (!isPlainObject(raw)) return undefined;
  const id = readString(raw, wireKey('heroId'));
  if (id === undefined) return undefined;

  const energyFraction = readNumber(raw, wireKey('heroEnergyFraction'));
  const x = readNumber(raw, wireKey('heroX'));
  const y = readNumber(raw, wireKey('heroY'));
  const cell = readNumber(raw, wireKey('heroCell'));
  const actionState = readNumber(raw, wireKey('heroActionState'));

  return {
    id,
    ...(energyFraction !== undefined ? { energyFraction } : {}),
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
    ...(cell !== undefined ? { cell } : {}),
    ...(actionState !== undefined ? { actionState } : {}),
  };
}

function mapBomb(raw: unknown): LiveBomb | undefined {
  if (!isPlainObject(raw)) return undefined;
  const cell = readNumber(raw, wireKey('bombCell'));
  const radius = readNumber(raw, wireKey('bombRadius'));
  const fuseRemainingSeconds = readNumber(raw, wireKey('bombFuseRemainingSeconds'));
  const fuseTotalSeconds = readNumber(raw, wireKey('bombFuseTotalSeconds'));
  if (cell === undefined || radius === undefined || fuseRemainingSeconds === undefined || fuseTotalSeconds === undefined) {
    return undefined;
  }
  return { cell, radius, fuseRemainingSeconds, fuseTotalSeconds };
}

function mapExplosion(raw: unknown): LiveExplosion | undefined {
  if (!isPlainObject(raw)) return undefined;
  const cell = readNumber(raw, wireKey('explosionCell'));
  const radius = readNumber(raw, wireKey('explosionRadius'));
  if (cell === undefined || radius === undefined) return undefined;

  const secondBlast = readBoolean(raw, wireKey('explosionSecondBlast')) === true;
  return { cell, radius, ...(secondBlast ? { secondBlast: true as const } : {}) };
}

function mapLoot(raw: unknown): LiveLootPop | undefined {
  if (!isPlainObject(raw)) return undefined;
  const cell = readNumber(raw, wireKey('lootCell'));
  if (cell === undefined) return undefined;

  const gold = readWireMoney(raw, wireKey('lootGold'));
  return { cell, ...(gold !== undefined ? { gold } : {}) };
}

function mapHit(raw: unknown): LiveHit | undefined {
  if (!isPlainObject(raw)) return undefined;
  const cell = readNumber(raw, wireKey('hitCell'));
  const damage = readNumber(raw, wireKey('hitDamage'));
  if (cell === undefined || damage === undefined) return undefined;

  const critical = readBoolean(raw, wireKey('hitCritical'));
  const secondBlast = readBoolean(raw, wireKey('hitSecondBlast')) === true;
  const shardOrigin = readNumber(raw, wireKey('hitShardOrigin'));
  return {
    cell,
    damage,
    ...(critical !== undefined ? { critical } : {}),
    ...(secondBlast ? { secondBlast: true as const } : {}),
    ...(shardOrigin !== undefined ? { shardOrigin } : {}),
  };
}

const BOOST_AXES: ReadonlySet<string> = new Set<LiveBoostAxis>(['gold', 'xp', 'drop']);

function isBoostAxis(value: string | undefined): value is LiveBoostAxis {
  return value !== undefined && BOOST_AXES.has(value);
}

function mapBoost(raw: unknown): LiveBoost | undefined {
  if (!isPlainObject(raw)) return undefined;
  const axis = readString(raw, wireKey('boostAxis'));
  const secondsLeft = readNumber(raw, wireKey('boostSecondsLeft'));
  const mult = readNumber(raw, wireKey('boostMultiplier'));
  if (!isBoostAxis(axis) || secondsLeft === undefined || mult === undefined) return undefined;
  return { axis, secondsLeft, mult };
}

export function toLiveTick(raw: Record<string, unknown>): LiveTick {
  const phase = readNumber(raw, wireKey('phase'));
  const wave = readNumber(raw, wireKey('wave'));
  const gold = readWireMoney(raw, wireKey('gold'));
  const roomHp = readNumber(raw, wireKey('roomHp'));
  const idle = readBoolean(raw, wireKey('idle'));
  const lootRaw = readOptionalArray(raw, wireKey('lootList'));
  const hitsRaw = readOptionalArray(raw, wireKey('hitsList'));
  const bonusSeconds = readNumber(raw, wireKey('bonusSeconds'));
  const bonusMultiplier = readNumber(raw, wireKey('bonusMultiplier'));
  const xpGained = readNumber(raw, wireKey('xpGained'));
  const boostsRaw = readOptionalArray(raw, wireKey('boostsList'));
  const kindsRaw = readOptionalArray(raw, wireKey('kindsList'));
  const hpsRaw = readOptionalArray(raw, wireKey('hpsList'));
  const bombsRaw = readOptionalArray(raw, wireKey('bombsList'));
  const explosionsRaw = readOptionalArray(raw, wireKey('explosionsList'));

  return {
    heroes: readArray(raw, wireKey('heroesList')).map(mapHero).filter(isDefined),
    ...(phase !== undefined ? { phase } : {}),
    ...(wave !== undefined ? { wave } : {}),
    ...(gold !== undefined ? { gold } : {}),
    ...(roomHp !== undefined ? { roomHp } : {}),
    ...(idle !== undefined ? { idle } : {}),
    ...(lootRaw !== undefined ? { loot: lootRaw.map(mapLoot).filter(isDefined) } : {}),
    ...(hitsRaw !== undefined ? { hits: hitsRaw.map(mapHit).filter(isDefined) } : {}),
    ...(bonusSeconds !== undefined ? { bonusSeconds } : {}),
    ...(bonusMultiplier !== undefined ? { bonusMultiplier } : {}),
    ...(xpGained !== undefined ? { xpGained } : {}),
    ...(boostsRaw !== undefined ? { boosts: boostsRaw.map(mapBoost).filter(isDefined) } : {}),
    ...(kindsRaw !== undefined ? { kinds: kindsRaw.filter((value): value is number => typeof value === 'number') } : {}),
    ...(hpsRaw !== undefined ? { hps: hpsRaw.filter((value): value is number => typeof value === 'number') } : {}),
    ...(bombsRaw !== undefined ? { bombs: bombsRaw.map(mapBomb).filter(isDefined) } : {}),
    ...(explosionsRaw !== undefined ? { explosions: explosionsRaw.map(mapExplosion).filter(isDefined) } : {}),
  };
}

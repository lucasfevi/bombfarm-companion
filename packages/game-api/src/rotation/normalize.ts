import type {
  FieldDrop,
  HouseSnapshot,
  RotationHeroSnapshot,
  RotationNormalizeResult,
  RotationSnapshot,
} from '@bombfarm/contracts';
import { stateSymbolForToken, wireKey } from './lexicon.js';
import { isPlainObject } from '../type-guards.js';

/**
 * Every rotation cycle observed so far runs well under half an hour (the committed fixture's
 * slowest house level is ~1190s). This ceiling exists only to catch an accidental unit change —
 * a game update that starts sending milliseconds instead of seconds would land here comfortably
 * above a day, while every real cycle length stays far below it.
 */
const CYCLE_SECONDS_PLAUSIBILITY_CEILING = 86_400;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

interface Validated<T> {
  readonly value?: T;
  readonly drop?: FieldDrop;
}

interface NumberRules {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

function validateNumber(raw: unknown, path: string, rules: NumberRules = {}): Validated<number> {
  if (raw === undefined) return { drop: { path, reason: 'missing' } };
  if (!isFiniteNumber(raw)) return { drop: { path, reason: 'wrong_type' } };
  if (rules.integer === true && !Number.isInteger(raw)) return { drop: { path, reason: 'wrong_type' } };
  if (rules.min !== undefined && raw < rules.min) return { drop: { path, reason: 'out_of_range' } };
  if (rules.max !== undefined && raw > rules.max) return { drop: { path, reason: 'out_of_range' } };
  return { value: raw };
}

function validateBoolean(raw: unknown, path: string): Validated<boolean> {
  if (raw === undefined) return { drop: { path, reason: 'missing' } };
  if (typeof raw !== 'boolean') return { drop: { path, reason: 'wrong_type' } };
  return { value: raw };
}

function validateNumberList(raw: unknown, path: string): Validated<readonly number[]> {
  if (raw === undefined) return { drop: { path, reason: 'missing' } };
  if (!Array.isArray(raw)) return { drop: { path, reason: 'wrong_type' } };
  return { value: raw.filter(isFiniteNumber) };
}

function collectDrop<T>(validated: Validated<T>, drops: FieldDrop[]): T | undefined {
  if (validated.drop) drops.push(validated.drop);
  return validated.value;
}

interface RosterEntry {
  readonly name?: string;
  readonly grade?: string;
}

/** `/roster`'s own wire keys (`id`, `name`, `rank`) — a different route's vocabulary, outside
 *  this lexicon's declared rotation key sets, so they are plain literals here rather than routed
 *  through `wireKey()`. None is Portuguese-origin. */
function buildRosterIndex(roster: unknown): ReadonlyMap<string, RosterEntry> {
  const index = new Map<string, RosterEntry>();
  if (!Array.isArray(roster)) return index;

  for (const candidate of roster) {
    if (!isPlainObject(candidate)) continue;
    const id = candidate['id'];
    if (typeof id !== 'string') continue;
    const name = candidate['name'];
    const grade = candidate['rank'];
    index.set(id, {
      ...(typeof name === 'string' ? { name } : {}),
      ...(typeof grade === 'string' ? { grade } : {}),
    });
  }
  return index;
}

function heroPath(index: number, symbolPath: string): string {
  return `heroes[${String(index)}]${symbolPath}`;
}

function normalizeHero(
  raw: unknown,
  index: number,
  rosterIndex: ReadonlyMap<string, RosterEntry>,
  seenIds: Set<string>,
  drops: FieldDrop[],
): RotationHeroSnapshot | undefined {
  if (!isPlainObject(raw)) {
    drops.push({ path: heroPath(index, ''), reason: 'wrong_type' });
    return undefined;
  }

  const idPath = heroPath(index, `.${wireKey('heroId')}`);
  const idRaw = raw[wireKey('heroId')];
  if (idRaw === undefined) {
    drops.push({ path: idPath, reason: 'missing' });
    return undefined;
  }
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    drops.push({ path: idPath, reason: typeof idRaw === 'string' ? 'out_of_range' : 'wrong_type' });
    return undefined;
  }
  if (seenIds.has(idRaw)) {
    drops.push({ path: idPath, reason: 'duplicate' });
    return undefined;
  }
  seenIds.add(idRaw);

  const level = collectDrop(
    validateNumber(raw[wireKey('heroLevel')], heroPath(index, `.${wireKey('heroLevel')}`), {
      min: 0,
      integer: true,
    }),
    drops,
  );

  const energy = collectDrop(
    validateNumber(raw[wireKey('heroEnergy')], heroPath(index, `.${wireKey('heroEnergy')}`), { min: 0 }),
    drops,
  );

  const energyMax = collectDrop(
    validateNumber(raw[wireKey('heroEnergyMax')], heroPath(index, `.${wireKey('heroEnergyMax')}`), { min: 0 }),
    drops,
  );

  const energyFraction = collectDrop(
    validateNumber(raw[wireKey('heroEnergyFraction')], heroPath(index, `.${wireKey('heroEnergyFraction')}`), {
      min: 0,
      max: 1,
    }),
    drops,
  );

  // A hero whose current energy exceeds its own ceiling is still self-consistent enough to
  // render: keep both raw values, but the reported fraction cannot honestly be < 1 here.
  const resolvedFraction =
    energy !== undefined && energyMax !== undefined && energy > energyMax ? 1 : energyFraction;

  const statePath = heroPath(index, `.${wireKey('heroState')}`);
  const stateRaw = raw[wireKey('heroState')];
  let activity: RotationHeroSnapshot['activity'];
  if (stateRaw === undefined) {
    drops.push({ path: statePath, reason: 'missing' });
  } else if (typeof stateRaw !== 'string') {
    drops.push({ path: statePath, reason: 'wrong_type' });
  } else {
    const symbol = stateSymbolForToken(stateRaw);
    if (symbol === undefined) {
      drops.push({ path: statePath, reason: 'out_of_range' });
    } else {
      activity = symbol;
    }
  }

  const onField = collectDrop(
    validateBoolean(raw[wireKey('heroOnField')], heroPath(index, `.${wireKey('heroOnField')}`)),
    drops,
  );

  const inHouse = collectDrop(
    validateBoolean(raw[wireKey('heroInHouse')], heroPath(index, `.${wireKey('heroInHouse')}`)),
    drops,
  );

  const recovering = collectDrop(
    validateBoolean(raw[wireKey('heroRecovering')], heroPath(index, `.${wireKey('heroRecovering')}`)),
    drops,
  );

  const battleAllowed = collectDrop(
    validateBoolean(raw[wireKey('heroBattleAllowed')], heroPath(index, `.${wireKey('heroBattleAllowed')}`)),
    drops,
  );

  const rosterEntry = rosterIndex.get(idRaw);

  return {
    id: idRaw,
    ...(level !== undefined ? { level } : {}),
    ...(energy !== undefined ? { energy } : {}),
    ...(energyMax !== undefined ? { energyMax } : {}),
    ...(resolvedFraction !== undefined ? { energyFraction: resolvedFraction } : {}),
    ...(activity !== undefined ? { activity } : {}),
    ...(onField !== undefined ? { onField } : {}),
    ...(inHouse !== undefined ? { inHouse } : {}),
    ...(recovering !== undefined ? { recovering } : {}),
    ...(battleAllowed !== undefined ? { battleAllowed } : {}),
    ...(rosterEntry?.name !== undefined ? { name: rosterEntry.name } : {}),
    ...(rosterEntry?.grade !== undefined ? { grade: rosterEntry.grade } : {}),
  };
}

function normalizeHouse(raw: unknown, drops: FieldDrop[]): HouseSnapshot | undefined {
  const housePath = wireKey('house');
  if (raw === undefined) {
    drops.push({ path: housePath, reason: 'missing' });
    return undefined;
  }
  if (!isPlainObject(raw)) {
    drops.push({ path: housePath, reason: 'wrong_type' });
    return undefined;
  }

  const houseLevels = collectDrop(
    validateNumberList(raw[wireKey('houseLevels')], `${housePath}.${wireKey('houseLevels')}`),
    drops,
  );

  const activePath = `${housePath}.${wireKey('houseActive')}`;
  const activeValue = collectDrop(validateNumber(raw[wireKey('houseActive')], activePath, { integer: true }), drops);
  let activeHouseIndex: number | undefined;
  if (activeValue !== undefined) {
    const zeroBased = activeValue - 1;
    const withinBounds = houseLevels === undefined || zeroBased < houseLevels.length;
    if (zeroBased < 0 || !withinBounds) {
      drops.push({ path: activePath, reason: 'out_of_range' });
    } else {
      activeHouseIndex = zeroBased;
    }
  }

  const cycleSecondsPath = `${housePath}.${wireKey('houseCycleSeconds')}`;
  const cycleSecondsValue = collectDrop(validateNumber(raw[wireKey('houseCycleSeconds')], cycleSecondsPath), drops);
  let cycleSeconds: number | undefined;
  if (cycleSecondsValue !== undefined) {
    if (cycleSecondsValue <= 0 || cycleSecondsValue > CYCLE_SECONDS_PLAUSIBILITY_CEILING) {
      drops.push({ path: cycleSecondsPath, reason: 'out_of_range' });
    } else {
      cycleSeconds = cycleSecondsValue;
    }
  }

  const slots = collectDrop(
    validateNumber(raw[wireKey('houseSlots')], `${housePath}.${wireKey('houseSlots')}`, { min: 0, integer: true }),
    drops,
  );

  const slotsPerHouse = collectDrop(
    validateNumberList(raw[wireKey('houseSlotsPerHouse')], `${housePath}.${wireKey('houseSlotsPerHouse')}`),
    drops,
  );

  const cycleSecondsPerHouse = collectDrop(
    validateNumberList(
      raw[wireKey('houseCycleSecondsPerHouse')],
      `${housePath}.${wireKey('houseCycleSecondsPerHouse')}`,
    ),
    drops,
  );

  const upgradeCost = collectDrop(
    validateNumberList(raw[wireKey('houseUpgradeCost')], `${housePath}.${wireKey('houseUpgradeCost')}`),
    drops,
  );

  return {
    ...(activeHouseIndex !== undefined ? { activeHouseIndex } : {}),
    ...(houseLevels !== undefined ? { houseLevels } : {}),
    ...(cycleSeconds !== undefined ? { cycleSeconds } : {}),
    ...(slots !== undefined ? { slots } : {}),
    ...(slotsPerHouse !== undefined ? { slotsPerHouse } : {}),
    ...(cycleSecondsPerHouse !== undefined ? { cycleSecondsPerHouse } : {}),
    ...(upgradeCost !== undefined ? { upgradeCost } : {}),
  };
}

function normalizeRescues(
  body: Record<string, unknown>,
  drops: FieldDrop[],
): { readonly rescuesLeft?: number; readonly rescuesMax?: number } {
  const maxPath = wireKey('rescuesMax');
  const max = collectDrop(validateNumber(body[wireKey('rescuesMax')], maxPath, { min: 0, integer: true }), drops);

  const leftPath = wireKey('rescuesLeft');
  const leftValue = collectDrop(
    validateNumber(body[wireKey('rescuesLeft')], leftPath, { min: 0, integer: true }),
    drops,
  );
  let rescuesLeft: number | undefined;
  if (leftValue !== undefined) {
    if (max !== undefined && leftValue > max) {
      drops.push({ path: leftPath, reason: 'out_of_range' });
    } else {
      rescuesLeft = leftValue;
    }
  }

  return {
    ...(rescuesLeft !== undefined ? { rescuesLeft } : {}),
    ...(max !== undefined ? { rescuesMax: max } : {}),
  };
}

/**
 * Translates a raw `/rotation` route body (plus the `/roster` heroes array for name/grade
 * identity) into {@link RotationSnapshot}. Every field is independently validated and dropped on
 * its own — a failure never cascades into dropping a sibling, a hero, or a section. Pure: no
 * logging, no clock, no I/O; drop events are returned, never emitted anywhere.
 */
export function normalizeRotation(body: unknown, roster: unknown): RotationNormalizeResult {
  const drops: FieldDrop[] = [];

  if (!isPlainObject(body)) {
    drops.push({ path: '(root)', reason: body === undefined ? 'missing' : 'wrong_type' });
    return { snapshot: { heroes: [] }, drops };
  }

  const rosterIndex = buildRosterIndex(roster);

  const fieldSize = collectDrop(
    validateNumber(body[wireKey('fieldSize')], wireKey('fieldSize'), { min: 0, integer: true }),
    drops,
  );

  const heroesPath = wireKey('heroesList');
  const heroesRaw = body[wireKey('heroesList')];
  const heroes: RotationHeroSnapshot[] = [];
  if (heroesRaw === undefined) {
    drops.push({ path: heroesPath, reason: 'missing' });
  } else if (!Array.isArray(heroesRaw)) {
    drops.push({ path: heroesPath, reason: 'wrong_type' });
  } else {
    const seenIds = new Set<string>();
    heroesRaw.forEach((rawHero, index) => {
      const hero = normalizeHero(rawHero, index, rosterIndex, seenIds, drops);
      if (hero) heroes.push(hero);
    });
  }

  const house = normalizeHouse(body[wireKey('house')], drops);
  const rescues = normalizeRescues(body, drops);

  const snapshot: RotationSnapshot = {
    ...(fieldSize !== undefined ? { fieldSize } : {}),
    heroes,
    ...(house !== undefined ? { house } : {}),
    ...rescues,
  };

  return { snapshot, drops };
}

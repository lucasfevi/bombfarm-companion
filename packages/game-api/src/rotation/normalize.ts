import type {
  FieldDrop,
  HouseSnapshot,
  RotationHeroSnapshot,
  RotationNormalizeResult,
  RotationSnapshot,
} from '@bombfarm/contracts';
import { stateSymbolForToken, wireKey } from './lexicon.js';

/**
 * Every rotation cycle observed so far runs well under half an hour (the committed fixture's
 * slowest house level is ~1190s). This ceiling exists only to catch an accidental unit change —
 * a game update that starts sending milliseconds instead of seconds would land here comfortably
 * above a day, while every real cycle length stays far below it.
 */
const CYCLE_SECONDS_PLAUSIBILITY_CEILING = 86_400;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

  const level = validateNumber(raw[wireKey('heroLevel')], heroPath(index, `.${wireKey('heroLevel')}`), {
    min: 0,
    integer: true,
  });
  if (level.drop) drops.push(level.drop);

  const energy = validateNumber(raw[wireKey('heroEnergy')], heroPath(index, `.${wireKey('heroEnergy')}`), {
    min: 0,
  });
  if (energy.drop) drops.push(energy.drop);

  const energyMax = validateNumber(raw[wireKey('heroEnergyMax')], heroPath(index, `.${wireKey('heroEnergyMax')}`), {
    min: 0,
  });
  if (energyMax.drop) drops.push(energyMax.drop);

  const energyFraction = validateNumber(
    raw[wireKey('heroEnergyFraction')],
    heroPath(index, `.${wireKey('heroEnergyFraction')}`),
    { min: 0, max: 1 },
  );
  if (energyFraction.drop) drops.push(energyFraction.drop);

  // A hero whose current energy exceeds its own ceiling is still self-consistent enough to
  // render: keep both raw values, but the reported fraction cannot honestly be < 1 here.
  const resolvedFraction =
    energy.value !== undefined && energyMax.value !== undefined && energy.value > energyMax.value
      ? 1
      : energyFraction.value;

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

  const onField = validateBoolean(raw[wireKey('heroOnField')], heroPath(index, `.${wireKey('heroOnField')}`));
  if (onField.drop) drops.push(onField.drop);

  const inHouse = validateBoolean(raw[wireKey('heroInHouse')], heroPath(index, `.${wireKey('heroInHouse')}`));
  if (inHouse.drop) drops.push(inHouse.drop);

  const recovering = validateBoolean(raw[wireKey('heroRecovering')], heroPath(index, `.${wireKey('heroRecovering')}`));
  if (recovering.drop) drops.push(recovering.drop);

  const battleAllowed = validateBoolean(
    raw[wireKey('heroBattleAllowed')],
    heroPath(index, `.${wireKey('heroBattleAllowed')}`),
  );
  if (battleAllowed.drop) drops.push(battleAllowed.drop);

  const rosterEntry = rosterIndex.get(idRaw);

  return {
    id: idRaw,
    ...(level.value !== undefined ? { level: level.value } : {}),
    ...(energy.value !== undefined ? { energy: energy.value } : {}),
    ...(energyMax.value !== undefined ? { energyMax: energyMax.value } : {}),
    ...(resolvedFraction !== undefined ? { energyFraction: resolvedFraction } : {}),
    ...(activity !== undefined ? { activity } : {}),
    ...(onField.value !== undefined ? { onField: onField.value } : {}),
    ...(inHouse.value !== undefined ? { inHouse: inHouse.value } : {}),
    ...(recovering.value !== undefined ? { recovering: recovering.value } : {}),
    ...(battleAllowed.value !== undefined ? { battleAllowed: battleAllowed.value } : {}),
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

  const houseLevels = validateNumberList(raw[wireKey('houseLevels')], `${housePath}.${wireKey('houseLevels')}`);
  if (houseLevels.drop) drops.push(houseLevels.drop);

  const activePath = `${housePath}.${wireKey('houseActive')}`;
  const activeRaw = raw[wireKey('houseActive')];
  let activeHouseIndex: number | undefined;
  if (activeRaw === undefined) {
    drops.push({ path: activePath, reason: 'missing' });
  } else if (!isFiniteNumber(activeRaw) || !Number.isInteger(activeRaw)) {
    drops.push({ path: activePath, reason: 'wrong_type' });
  } else {
    const zeroBased = activeRaw - 1;
    const withinBounds = houseLevels.value === undefined || zeroBased < houseLevels.value.length;
    if (zeroBased < 0 || !withinBounds) {
      drops.push({ path: activePath, reason: 'out_of_range' });
    } else {
      activeHouseIndex = zeroBased;
    }
  }

  const cycleSecondsPath = `${housePath}.${wireKey('houseCycleSeconds')}`;
  const cycleSecondsRaw = raw[wireKey('houseCycleSeconds')];
  let cycleSeconds: number | undefined;
  if (cycleSecondsRaw === undefined) {
    drops.push({ path: cycleSecondsPath, reason: 'missing' });
  } else if (!isFiniteNumber(cycleSecondsRaw)) {
    drops.push({ path: cycleSecondsPath, reason: 'wrong_type' });
  } else if (cycleSecondsRaw <= 0 || cycleSecondsRaw > CYCLE_SECONDS_PLAUSIBILITY_CEILING) {
    drops.push({ path: cycleSecondsPath, reason: 'out_of_range' });
  } else {
    cycleSeconds = cycleSecondsRaw;
  }

  const slots = validateNumber(raw[wireKey('houseSlots')], `${housePath}.${wireKey('houseSlots')}`, {
    min: 0,
    integer: true,
  });
  if (slots.drop) drops.push(slots.drop);

  const slotsPerHouse = validateNumberList(
    raw[wireKey('houseSlotsPerHouse')],
    `${housePath}.${wireKey('houseSlotsPerHouse')}`,
  );
  if (slotsPerHouse.drop) drops.push(slotsPerHouse.drop);

  const cycleSecondsPerHouse = validateNumberList(
    raw[wireKey('houseCycleSecondsPerHouse')],
    `${housePath}.${wireKey('houseCycleSecondsPerHouse')}`,
  );
  if (cycleSecondsPerHouse.drop) drops.push(cycleSecondsPerHouse.drop);

  const upgradeCost = validateNumberList(raw[wireKey('houseUpgradeCost')], `${housePath}.${wireKey('houseUpgradeCost')}`);
  if (upgradeCost.drop) drops.push(upgradeCost.drop);

  return {
    ...(activeHouseIndex !== undefined ? { activeHouseIndex } : {}),
    ...(houseLevels.value !== undefined ? { houseLevels: houseLevels.value } : {}),
    ...(cycleSeconds !== undefined ? { cycleSeconds } : {}),
    ...(slots.value !== undefined ? { slots: slots.value } : {}),
    ...(slotsPerHouse.value !== undefined ? { slotsPerHouse: slotsPerHouse.value } : {}),
    ...(cycleSecondsPerHouse.value !== undefined ? { cycleSecondsPerHouse: cycleSecondsPerHouse.value } : {}),
    ...(upgradeCost.value !== undefined ? { upgradeCost: upgradeCost.value } : {}),
  };
}

function normalizeRescues(
  body: Record<string, unknown>,
  drops: FieldDrop[],
): { readonly rescuesLeft?: number; readonly rescuesMax?: number } {
  const maxPath = wireKey('rescuesMax');
  const max = validateNumber(body[wireKey('rescuesMax')], maxPath, { min: 0, integer: true });
  if (max.drop) drops.push(max.drop);

  const leftPath = wireKey('rescuesLeft');
  const leftRaw = body[wireKey('rescuesLeft')];
  let rescuesLeft: number | undefined;
  if (leftRaw === undefined) {
    drops.push({ path: leftPath, reason: 'missing' });
  } else if (!isFiniteNumber(leftRaw) || !Number.isInteger(leftRaw)) {
    drops.push({ path: leftPath, reason: 'wrong_type' });
  } else if (leftRaw < 0 || (max.value !== undefined && leftRaw > max.value)) {
    drops.push({ path: leftPath, reason: 'out_of_range' });
  } else {
    rescuesLeft = leftRaw;
  }

  return {
    ...(rescuesLeft !== undefined ? { rescuesLeft } : {}),
    ...(max.value !== undefined ? { rescuesMax: max.value } : {}),
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

  const fieldSize = validateNumber(body[wireKey('fieldSize')], wireKey('fieldSize'), { min: 0, integer: true });
  if (fieldSize.drop) drops.push(fieldSize.drop);

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
    ...(fieldSize.value !== undefined ? { fieldSize: fieldSize.value } : {}),
    heroes,
    ...(house !== undefined ? { house } : {}),
    ...rescues,
  };

  return { snapshot, drops };
}

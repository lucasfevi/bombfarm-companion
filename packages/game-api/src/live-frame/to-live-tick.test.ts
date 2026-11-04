import { describe, expect, it } from 'vitest';
import { wireKey } from './lexicon.js';
import { toLiveTick } from './to-live-tick.js';

describe('toLiveTick: wire money is dropped unless it is a well-formed digit string', () => {
  const NOT_A_WELL_FORMED_DIGIT_STRING = [
    { label: 'exponential notation', value: '1e5' },
    { label: 'a leading plus sign', value: '+123' },
    { label: 'leading whitespace', value: ' 123' },
    { label: 'trailing whitespace', value: '123 ' },
    { label: 'hex notation', value: '0x10' },
    { label: 'the literal string Infinity', value: 'Infinity' },
    { label: 'an empty string', value: '' },
    { label: 'a non-numeric string', value: 'not-a-number' },
  ];

  it.each(NOT_A_WELL_FORMED_DIGIT_STRING)('drops tick.gold when the wire sends $label ($value)', ({ value }) => {
    const tick = toLiveTick({ [wireKey('gold')]: value });

    expect(tick.gold).toBeUndefined();
    expect('gold' in tick).toBe(false);
  });

  it('drops tick.gold when the wire sends a genuine number instead of a digit string', () => {
    const tick = toLiveTick({ [wireKey('gold')]: 123 });

    expect('gold' in tick).toBe(false);
  });

  it('keeps a well-formed digit string as a finite number, for control', () => {
    const tick = toLiveTick({ [wireKey('gold')]: '123' });

    expect(tick.gold).toBe(123);
  });

  it.each(NOT_A_WELL_FORMED_DIGIT_STRING)('drops loot[].gold when the wire sends $label ($value), never NaN', ({ value }) => {
    const raw = {
      [wireKey('lootList')]: [{ [wireKey('lootCell')]: 1, [wireKey('lootGold')]: value }],
    };

    const tick = toLiveTick(raw);

    expect(tick.loot).toHaveLength(1);
    expect(tick.loot?.[0]).toEqual({ cell: 1 });
  });
});

describe('toLiveTick: kinds/hps are absent, not empty arrays, when the wire omits them', () => {
  it('leaves both undefined when the wire carries neither token', () => {
    const tick = toLiveTick({});

    expect(tick.kinds).toBeUndefined();
    expect(tick.hps).toBeUndefined();
    expect('kinds' in tick).toBe(false);
    expect('hps' in tick).toBe(false);
  });

  it('decodes kinds alone and leaves hps undefined when only kinds arrives', () => {
    const tick = toLiveTick({ [wireKey('kindsList')]: [0, -1, 3] });

    expect(tick.kinds).toEqual([0, -1, 3]);
    expect(tick.hps).toBeUndefined();
    expect('hps' in tick).toBe(false);
  });

  it('decodes hps alone and leaves kinds undefined when only hps arrives', () => {
    const tick = toLiveTick({ [wireKey('hpsList')]: [10, -1, 20] });

    expect(tick.hps).toEqual([10, -1, 20]);
    expect(tick.kinds).toBeUndefined();
    expect('kinds' in tick).toBe(false);
  });
});

describe('toLiveTick: bombs and explosions', () => {
  function wireBomb(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      [wireKey('bombCell')]: 42,
      [wireKey('bombRadius')]: 2,
      [wireKey('bombFuseRemainingSeconds')]: 1.5,
      [wireKey('bombFuseTotalSeconds')]: 1.9,
      ...overrides,
    };
  }

  function wireExplosion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { [wireKey('explosionCell')]: 7, [wireKey('explosionRadius')]: 3, ...overrides };
  }

  it('carries a bomb with its cell, radius, remaining fuse and total fuse', () => {
    const tick = toLiveTick({ [wireKey('bombsList')]: [wireBomb()] });

    expect(tick.bombs).toEqual([{ cell: 42, radius: 2, fuseRemainingSeconds: 1.5, fuseTotalSeconds: 1.9 }]);
  });

  it('drops a bomb missing its total fuse and keeps the frame and its other bombs', () => {
    const tick = toLiveTick({
      [wireKey('phase')]: 9,
      [wireKey('bombsList')]: [wireBomb({ [wireKey('bombFuseTotalSeconds')]: undefined }), wireBomb({ [wireKey('bombCell')]: 43 })],
    });

    expect(tick.phase).toBe(9);
    expect(tick.bombs).toEqual([{ cell: 43, radius: 2, fuseRemainingSeconds: 1.5, fuseTotalSeconds: 1.9 }]);
  });

  it('drops a bomb whose remaining fuse is not a number', () => {
    const tick = toLiveTick({ [wireKey('bombsList')]: [wireBomb({ [wireKey('bombFuseRemainingSeconds')]: '1.5' })] });

    expect(tick.bombs).toEqual([]);
  });

  it('drops a bomb entry that is not an object', () => {
    const tick = toLiveTick({ [wireKey('bombsList')]: [null, 'bomb', wireBomb()] });

    expect(tick.bombs).toHaveLength(1);
  });

  it.each([
    { entry: 'bomb', key: 'bombCell' },
    { entry: 'bomb', key: 'bombRadius' },
    { entry: 'bomb', key: 'bombFuseRemainingSeconds' },
    { entry: 'bomb', key: 'bombFuseTotalSeconds' },
    { entry: 'explosion', key: 'explosionCell' },
    { entry: 'explosion', key: 'explosionRadius' },
  ] as const)('drops a $entry missing $key and keeps the frame and its other entries', ({ entry, key }) => {
    const missing = { [wireKey(key)]: undefined };
    const list = entry === 'bomb' ? 'bombsList' : 'explosionsList';
    const broken = entry === 'bomb' ? wireBomb(missing) : wireExplosion(missing);
    const intact = entry === 'bomb' ? wireBomb() : wireExplosion();

    const tick = toLiveTick({ [wireKey('phase')]: 9, [wireKey(list)]: [broken, intact] });

    expect(tick.phase).toBe(9);
    expect(entry === 'bomb' ? tick.bombs : tick.explosions).toHaveLength(1);
  });

  it('carries an ordinary explosion with only its cell and radius', () => {
    const tick = toLiveTick({ [wireKey('explosionsList')]: [wireExplosion()] });

    expect(tick.explosions).toEqual([{ cell: 7, radius: 3 }]);
  });

  it('drops an explosion missing its radius and keeps the frame and its other explosions', () => {
    const tick = toLiveTick({
      [wireKey('phase')]: 9,
      [wireKey('explosionsList')]: [wireExplosion({ [wireKey('explosionRadius')]: undefined }), wireExplosion({ [wireKey('explosionCell')]: 8 })],
    });

    expect(tick.phase).toBe(9);
    expect(tick.explosions).toEqual([{ cell: 8, radius: 3 }]);
  });

  it('marks an explosion secondBlast when the wire sends the second-blast flag true', () => {
    const tick = toLiveTick({ [wireKey('explosionsList')]: [wireExplosion({ [wireKey('explosionSecondBlast')]: true })] });

    expect(tick.explosions).toEqual([{ cell: 7, radius: 3, secondBlast: true }]);
  });

  it('leaves secondBlast off an explosion whose second-blast flag is false', () => {
    const tick = toLiveTick({ [wireKey('explosionsList')]: [wireExplosion({ [wireKey('explosionSecondBlast')]: false })] });

    expect(tick.explosions).toEqual([{ cell: 7, radius: 3 }]);
    expect(tick.explosions?.[0] && 'secondBlast' in tick.explosions[0]).toBe(false);
  });

  it('leaves secondBlast off an explosion whose second-blast marker is the number 1', () => {
    const tick = toLiveTick({
      [wireKey('phase')]: 9,
      [wireKey('explosionsList')]: [wireExplosion({ [wireKey('explosionSecondBlast')]: 1 })],
    });

    expect(tick.phase).toBe(9);
    expect(tick.explosions).toEqual([{ cell: 7, radius: 3 }]);
    expect(tick.explosions?.[0] && 'secondBlast' in tick.explosions[0]).toBe(false);
  });

  it('carries empty bombs and explosions arrays as empty arrays when the wire sends them empty', () => {
    const tick = toLiveTick({ [wireKey('bombsList')]: [], [wireKey('explosionsList')]: [] });

    expect(tick.bombs).toEqual([]);
    expect(tick.explosions).toEqual([]);
  });

  it('yields a tick with neither bombs nor explosions key when the wire carries neither', () => {
    const tick = toLiveTick({});

    expect('bombs' in tick).toBe(false);
    expect('explosions' in tick).toBe(false);
  });
});

describe('toLiveTick: hit markers', () => {
  function wireHit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { [wireKey('hitCell')]: 10, [wireKey('hitDamage')]: 500, [wireKey('hitCritical')]: false, ...overrides };
  }

  it('marks a hit secondBlast when the wire sends the second-blast flag true', () => {
    const tick = toLiveTick({ [wireKey('hitsList')]: [wireHit({ [wireKey('hitSecondBlast')]: true })] });

    expect(tick.hits).toEqual([{ cell: 10, damage: 500, critical: false, secondBlast: true }]);
  });

  it('leaves secondBlast off a hit whose second-blast flag is false', () => {
    const tick = toLiveTick({ [wireKey('hitsList')]: [wireHit({ [wireKey('hitSecondBlast')]: false })] });

    expect(tick.hits).toEqual([{ cell: 10, damage: 500, critical: false }]);
    expect(tick.hits?.[0] && 'secondBlast' in tick.hits[0]).toBe(false);
  });

  it('leaves secondBlast off a hit that carries no second-blast flag', () => {
    const tick = toLiveTick({ [wireKey('hitsList')]: [wireHit()] });

    expect(tick.hits?.[0] && 'secondBlast' in tick.hits[0]).toBe(false);
  });

  it.each([1, 'true'])('leaves secondBlast off a hit whose second-blast marker is %j, not a boolean', (marker) => {
    const tick = toLiveTick({
      [wireKey('phase')]: 9,
      [wireKey('hitsList')]: [wireHit({ [wireKey('hitSecondBlast')]: marker })],
    });

    expect(tick.phase).toBe(9);
    expect(tick.hits).toEqual([{ cell: 10, damage: 500, critical: false }]);
    expect(tick.hits?.[0] && 'secondBlast' in tick.hits[0]).toBe(false);
  });

  it('carries a numeric shard origin as shardOrigin', () => {
    const tick = toLiveTick({ [wireKey('hitsList')]: [wireHit({ [wireKey('hitShardOrigin')]: 77 })] });

    expect(tick.hits).toEqual([{ cell: 10, damage: 500, critical: false, shardOrigin: 77 }]);
  });

  it('keeps the hit and omits shardOrigin when the shard origin is not a number', () => {
    const tick = toLiveTick({ [wireKey('hitsList')]: [wireHit({ [wireKey('hitShardOrigin')]: '77' })] });

    expect(tick.hits).toEqual([{ cell: 10, damage: 500, critical: false }]);
    expect(tick.hits?.[0] && 'shardOrigin' in tick.hits[0]).toBe(false);
  });
});

describe('toLiveTick: hero cell and action state', () => {
  it('carries a hero cell and action state', () => {
    const tick = toLiveTick({
      [wireKey('heroesList')]: [{ [wireKey('heroId')]: 'h1', [wireKey('heroCell')]: 61, [wireKey('heroActionState')]: 5 }],
    });

    expect(tick.heroes).toEqual([{ id: 'h1', cell: 61, actionState: 5 }]);
  });

  it('leaves cell and actionState off a hero whose wire entry omits them', () => {
    const tick = toLiveTick({ [wireKey('heroesList')]: [{ [wireKey('heroId')]: 'h1' }] });

    expect(tick.heroes.map((hero) => Object.keys(hero))).toEqual([['id']]);
  });
});

describe('toLiveTick: the XP the server awarded this tick', () => {
  it('reads it as one number beside the loot it was paid for', () => {
    const tick = toLiveTick({
      [wireKey('phase')]: 186,
      [wireKey('lootList')]: [{ [wireKey('lootCell')]: 12, [wireKey('lootGold')]: '6636' }],
      [wireKey('xpGained')]: 2_926.1,
    });

    expect(tick.xpGained).toBe(2_926.1);
    expect(tick.loot).toHaveLength(1);
  });

  it('is absent, not zero, on a tick that does not send it', () => {
    expect(toLiveTick({ [wireKey('phase')]: 186 })).not.toHaveProperty('xpGained');
  });

  it('drops a value that is not a finite number', () => {
    expect(toLiveTick({ [wireKey('xpGained')]: '2926' })).not.toHaveProperty('xpGained');
  });
});

describe('toLiveTick: Boosts', () => {
  function wireBoost(axis: unknown, secondsLeft: unknown, mult: unknown): Record<string, unknown> {
    return { [wireKey('boostAxis')]: axis, [wireKey('boostSecondsLeft')]: secondsLeft, [wireKey('boostMultiplier')]: mult };
  }

  it('reads one entry per running Boost', () => {
    const tick = toLiveTick({ [wireKey('boostsList')]: [wireBoost('xp', 20_412, 2), wireBoost('gold', 311, 2)] });

    expect(tick.boosts).toEqual([
      { axis: 'xp', secondsLeft: 20_412, mult: 2 },
      { axis: 'gold', secondsLeft: 311, mult: 2 },
    ]);
  });

  it('is absent when no Boost runs', () => {
    expect(toLiveTick({ [wireKey('phase')]: 186 })).not.toHaveProperty('boosts');
  });

  it('drops an entry on an axis it does not know, or with a field missing', () => {
    const tick = toLiveTick({
      [wireKey('boostsList')]: [wireBoost('luck', 60, 2), wireBoost('drop', undefined, 2), wireBoost('drop', 60, 2)],
    });

    expect(tick.boosts).toEqual([{ axis: 'drop', secondsLeft: 60, mult: 2 }]);
  });
});

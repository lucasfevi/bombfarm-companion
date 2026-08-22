import { describe, expect, it } from 'vitest';
import { ROUTE_FINGERPRINTS } from '../fingerprints.js';
import { ROTATION_WIRE_LEXICON } from './lexicon.js';

const rotationLevel = ROUTE_FINGERPRINTS.casa.level;
const heroesChild = rotationLevel.children?.heroes;
const houseChild = rotationLevel.children?.casa;

if (!heroesChild || heroesChild.kind !== 'array') {
  throw new Error('[lexicon-fingerprint-parity] ROUTE_FINGERPRINTS.casa no longer declares an array "heroes" child');
}
if (!houseChild || houseChild.kind !== 'object') {
  throw new Error('[lexicon-fingerprint-parity] ROUTE_FINGERPRINTS.casa no longer declares an object "casa" (house) child');
}

const FINGERPRINT_KEYS = new Set<string>([...rotationLevel.keys, ...heroesChild.element.keys, ...houseChild.level.keys]);
const LEXICON_KEYS = new Set<string>(
  ROTATION_WIRE_LEXICON.filter((entry) => entry.kind === 'key').map((entry) => entry.wireToken),
);

describe('rotation lexicon vs fingerprint key sets — bidirectional parity', () => {
  it('every key the rotation fingerprints declare has a lexicon entry', () => {
    const missing = [...FINGERPRINT_KEYS].filter((key) => !LEXICON_KEYS.has(key));
    expect(
      missing,
      `wire key(s) declared by ROTATION_LEVEL/ROTATION_HERO_LEVEL/CASA_LEVEL but with no lexicon.ts entry: ${JSON.stringify(missing)}`,
    ).toEqual([]);
  });

  it('every lexicon wire key is declared by a rotation fingerprint level', () => {
    const extra = [...LEXICON_KEYS].filter((key) => !FINGERPRINT_KEYS.has(key));
    expect(
      extra,
      `lexicon.ts wire key(s) not declared by ROTATION_LEVEL, ROTATION_HERO_LEVEL, or CASA_LEVEL: ${JSON.stringify(extra)}`,
    ).toEqual([]);
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COLLECTION_AXES, type CollectionsSnapshot } from '@bombfarm/contracts';
import { buildCollectionBoard, collectionCents } from '@bombfarm/domain/model';
import { ROUTE_FINGERPRINTS } from '../fingerprints.js';
import { identifyObservedBody } from '../identify-observed-body.js';
import { identifyPvpBody } from '../pvp/identify.js';
import { wireKey as pvpWireKey } from '../pvp/lexicon.js';
import { withAccountId } from '../request.js';
import { checkShape } from '../shape.js';
import { loadFixtureJson, required } from '../test-fixtures.js';
import { isCollectionsStateBody } from './identify.js';
import { COLLECTION_AXIS_SYMBOLS, COLLECTIONS_WIRE_LEXICON, wireKey } from './lexicon.js';
import { parseCollectionsState, readCollectionsState } from './parse.js';
import { isCollectionsSnapshot } from './snapshot-shape.js';
import { COLLECTIONS_STATE_PATH } from './routes.js';

type Wire = Record<string, unknown>;

function loadCollectionsBody(): Wire {
  const path = fileURLToPath(new URL('../__fixtures__/collections-state.json', import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as Wire;
}

function parsedFixture(): CollectionsSnapshot {
  const snapshot = parseCollectionsState(loadCollectionsBody());
  if (snapshot === null) throw new Error('the committed body does not parse');
  return snapshot;
}

function firstSet(body: Wire): Wire {
  return required((body[wireKey('sets')] as Wire[])[0], 'the fixture has a first set');
}

function firstEffect(body: Wire): Wire {
  return required((firstSet(body)[wireKey('setEffects')] as Wire[])[0], 'the first set has an effect');
}

function firstPiece(body: Wire): Wire {
  return required((body[wireKey('pieces')] as Wire[])[0], 'the fixture has a first piece');
}

const LEVELS: ReadonlyArray<{ readonly name: string; readonly target: (body: Wire) => Wire }> = [
  { name: 'the top level', target: (body) => body },
  { name: 'the caps record', target: (body) => body[wireKey('caps')] as Wire },
  { name: 'the totals record', target: (body) => body[wireKey('totals')] as Wire },
  { name: 'the raw record', target: (body) => body[wireKey('raw')] as Wire },
  { name: 'a set', target: firstSet },
  { name: 'an effect', target: firstEffect },
  { name: 'a piece', target: firstPiece },
];

describe('isCollectionsStateBody', () => {
  it('accepts the committed synthetic body', () => {
    expect(isCollectionsStateBody(loadCollectionsBody())).toBe(true);
  });

  for (const level of LEVELS) {
    it(`refuses the body with one key added to ${level.name}`, () => {
      const body = loadCollectionsBody();
      level.target(body)['added_by_a_patch'] = 1;
      expect(isCollectionsStateBody(body)).toBe(false);
    });

    it(`refuses the body with one key removed from ${level.name}`, () => {
      const body = loadCollectionsBody();
      const target = level.target(body);
      Reflect.deleteProperty(target, required(Object.keys(target)[0], 'the level has a key'));
      expect(isCollectionsStateBody(body)).toBe(false);
    });
  }

  it('refuses a body whose sets are not a list of objects', () => {
    expect(isCollectionsStateBody({ ...loadCollectionsBody(), [wireKey('sets')]: {} })).toBe(false);
    expect(isCollectionsStateBody({ ...loadCollectionsBody(), [wireKey('pieces')]: [1] })).toBe(false);
  });

  it('refuses the five account-read bodies', () => {
    const bodies = loadFixtureJson('api-bodies.json');
    expect(Object.keys(bodies)).toHaveLength(5);
    for (const [route, body] of Object.entries(bodies)) {
      expect(isCollectionsStateBody(body), route).toBe(false);
    }
  });

  it('refuses the PVP bodies', () => {
    const state = {
      [pvpWireKey('statePoints')]: 205,
      [pvpWireKey('stateTier')]: 'r2',
      [pvpWireKey('phase')]: 50,
      [pvpWireKey('stateSquad')]: [],
    };
    const duel = { [pvpWireKey('won')]: true, [pvpWireKey('filmId')]: 1 };
    const ranking = {
      [pvpWireKey('rankingBy')]: 'pvp',
      [pvpWireKey('rankingTop')]: [],
      [pvpWireKey('rankingMe')]: {},
    };
    for (const body of [state, duel, ranking]) {
      expect(isCollectionsStateBody(body)).toBe(false);
    }
  });

  it('refuses a non-object without throwing', () => {
    for (const body of [null, undefined, 'x', 4, [loadCollectionsBody()]]) {
      expect(isCollectionsStateBody(body)).toBe(false);
    }
  });

  it('is told apart from every PVP route and every account section, and the PVP identifier does not take it', () => {
    const body = loadCollectionsBody();
    expect(identifyPvpBody(body)).toBeNull();
    for (const fingerprint of Object.values(ROUTE_FINGERPRINTS)) {
      expect(checkShape(body, fingerprint).ok).toBe(false);
    }
  });

  it('is its own verdict when observed on the tap, ahead of the section fingerprints', () => {
    expect(identifyObservedBody(loadCollectionsBody())).toEqual({ kind: 'collections' });
  });

  it('is not a verdict for a body that merely carries a key the game added', () => {
    const body = loadCollectionsBody();
    body['added_by_a_later_patch'] = 1;
    expect(identifyObservedBody(body)).toEqual({ kind: 'unidentified' });
  });
});

describe('parseCollectionsState', () => {
  const snapshot = parsedFixture();

  it('reads the partial-page share and the three axis records under the contract axis names', () => {
    expect(snapshot.partialPct).toBe(60);
    expect(snapshot.caps.damage).toBe(30);
    expect(snapshot.totals.damage).toBe(30);
    expect(snapshot.raw.damage).toBe(42.13);
    expect(snapshot.totals.gold).toBe(7.74);
    expect(snapshot.caps.cooldown).toBe(22.5);
    expect(Object.keys(snapshot.caps)).toEqual([...COLLECTION_AXES]);
  });

  it('reads all thirty sets and all two hundred and forty pieces', () => {
    expect(snapshot.sets).toHaveLength(30);
    expect(snapshot.pieces).toHaveLength(240);
  });

  it('reads a set with its per-rarity piece counts and its effect', () => {
    const gold = required(
      snapshot.sets.find((set) => set.code === 'gold'),
      'the fixture has the gold set',
    );
    expect(gold.level).toBe(20);
    expect(gold.piecesByPage).toEqual([8, 8, 5, 0, 0, 0]);
    expect(gold.effects).toEqual([{ axis: 'gold', pageValues: [3.3, 6.5, 9.8, 14.6, 19.5, 26], now: 7.74 }]);
  });

  it('reads the highest set as three effects, in the order the server lists them', () => {
    const top = required(
      snapshot.sets.find((set) => set.code === 'void'),
      'the fixture has the void set',
    );
    expect(top.effects.map((effect) => effect.axis)).toEqual(['damage', 'critDamage', 'cooldown']);
  });

  it('reads a piece with its masks', () => {
    expect(snapshot.pieces[0]).toEqual({
      defId: 'ember_arma',
      set: 'ember',
      slot: 0,
      level: 10,
      sacrificedMask: 63,
      pendingMask: 0,
    });
  });

  it('keeps the sets in the order the server sends them', () => {
    expect(snapshot.sets.map((set) => set.level)).toEqual([...snapshot.sets.map((set) => set.level)].sort((a, b) => a - b));
  });

  it('reads a set whose pieces are missing from the piece list', () => {
    const body = loadCollectionsBody();
    body[wireKey('pieces')] = [];
    expect(parseCollectionsState(body)?.pieces).toEqual([]);
  });

  for (const level of LEVELS) {
    it(`ignores a key the game added to ${level.name}`, () => {
      const body = loadCollectionsBody();
      level.target(body)['added_by_a_later_patch'] = 1;
      expect(parseCollectionsState(body)).toEqual(snapshot);
    });
  }

  it('ignores an axis key the contract does not name in an axis record', () => {
    const body = loadCollectionsBody();
    (body[wireKey('raw')] as Wire)['sabor'] = 1;
    expect(parseCollectionsState(body)).toEqual(snapshot);
  });

  it('skips an effect on an axis the contract does not name and keeps the rest of the book', () => {
    const body = loadCollectionsBody();
    const effects = firstSet(body)[wireKey('setEffects')] as Wire[];
    effects.push({ ...firstEffect(body), [wireKey('effectAxis')]: 'sabor' });
    expect(parseCollectionsState(body)).toEqual(snapshot);
  });

  it('skips an unknown-axis effect whatever shape it has, and keeps the rest of the book', () => {
    const body = loadCollectionsBody();
    const effects = firstSet(body)[wireKey('setEffects')] as unknown[];
    effects.push({ [wireKey('effectAxis')]: 'sabor', something: 'else entirely' });
    expect(parseCollectionsState(body)).toEqual(snapshot);
  });

  it('counts nothing as ignored for a body of the exact shape', () => {
    expect(readCollectionsState(loadCollectionsBody())?.ignored).toBe(0);
  });

  for (const level of LEVELS) {
    it(`counts a key added to ${level.name} as ignored`, () => {
      const body = loadCollectionsBody();
      level.target(body)['added_by_a_later_patch'] = 1;
      expect(readCollectionsState(body)?.ignored).toBe(1);
    });
  }

  it('counts an unknown axis key in an axis record as ignored', () => {
    const body = loadCollectionsBody();
    (body[wireKey('raw')] as Wire)['sabor'] = 1;
    expect(readCollectionsState(body)?.ignored).toBe(1);
  });

  it('counts an unknown-axis effect as ignored even though the strict identifier still takes the body', () => {
    const body = loadCollectionsBody();
    (firstSet(body)[wireKey('setEffects')] as unknown[]).push({ ...firstEffect(body), [wireKey('effectAxis')]: 'sabor' });
    expect(isCollectionsStateBody(body)).toBe(true);
    expect(readCollectionsState(body)?.ignored).toBe(1);
  });

  it('produces a snapshot the stored-row check accepts', () => {
    expect(isCollectionsSnapshot(snapshot)).toBe(true);
  });

  const malformed: ReadonlyArray<readonly [string, (body: Wire) => void]> = [
    ['a non-finite axis total', (body) => ((body[wireKey('totals')] as Wire)[wireKey(COLLECTION_AXIS_SYMBOLS.gold)] = Number.NaN)],
    ['an infinite cap', (body) => ((body[wireKey('caps')] as Wire)[wireKey(COLLECTION_AXIS_SYMBOLS.xp)] = Infinity)],
    ['an axis missing from the totals record', (body) => Reflect.deleteProperty(body[wireKey('totals')] as Wire, wireKey(COLLECTION_AXIS_SYMBOLS.luck))],
    ['a missing partial-page share', (body) => Reflect.deleteProperty(body, wireKey('partialPct'))],
    ['a set with five per-page counts', (body) => ((firstSet(body)[wireKey('setPerPage')] as number[]).length = 5)],
    ['a set with seven per-page counts', (body) => (firstSet(body)[wireKey('setPerPage')] as number[]).push(0)],
    ['a page holding nine pieces', (body) => ((firstSet(body)[wireKey('setPerPage')] as number[])[0] = 9)],
    ['a page holding a fraction of a piece', (body) => ((firstSet(body)[wireKey('setPerPage')] as number[])[0] = 2.5)],
    ['an effect with five page values', (body) => ((firstEffect(body)[wireKey('effectPages')] as number[]).length = 5)],
    ['an effect with a non-finite page value', (body) => ((firstEffect(body)[wireKey('effectPages')] as number[])[2] = Number.NaN)],
    ['an effect with no axis', (body) => Reflect.deleteProperty(firstEffect(body), wireKey('effectAxis'))],
    ['an effect whose current bonus is a string', (body) => (firstEffect(body)[wireKey('effectNow')] = '12.8')],
    ['a set with a numeric code', (body) => (firstSet(body)[wireKey('setCode')] = 7)],
    ['a piece with a string slot', (body) => (firstPiece(body)[wireKey('pieceSlot')] = 'weapon')],
    ['a piece with a negative mask', (body) => (firstPiece(body)[wireKey('pieceMask')] = -1)],
    ['a piece with a missing definition id', (body) => Reflect.deleteProperty(firstPiece(body), wireKey('pieceDefId'))],
    ['sets that are not a list', (body) => (body[wireKey('sets')] = {})],
    ['a negative set level', (body) => (firstSet(body)[wireKey('setLevel')] = -1)],
    ['a negative current bonus', (body) => (firstEffect(body)[wireKey('effectNow')] = -0.5)],
    ['a negative page value', (body) => ((firstEffect(body)[wireKey('effectPages')] as number[])[0] = -3.3)],
    ['a negative cap', (body) => ((body[wireKey('caps')] as Wire)[wireKey(COLLECTION_AXIS_SYMBOLS.gold)] = -1)],
    ['a negative total', (body) => ((body[wireKey('totals')] as Wire)[wireKey(COLLECTION_AXIS_SYMBOLS.gold)] = -1)],
    ['a negative uncapped sum', (body) => ((body[wireKey('raw')] as Wire)[wireKey(COLLECTION_AXIS_SYMBOLS.gold)] = -1)],
    ['a negative partial-page share', (body) => (body[wireKey('partialPct')] = -1)],
    ['a partial-page share above a hundred', (body) => (body[wireKey('partialPct')] = 101)],
    ['a negative piece count on a page', (body) => ((firstSet(body)[wireKey('setPerPage')] as number[])[0] = -1)],
    ['a negative pending mask', (body) => (firstPiece(body)[wireKey('piecePending')] = -1)],
    ['a fractional mask', (body) => (firstPiece(body)[wireKey('pieceMask')] = 1.5)],
    ['a negative piece level', (body) => (firstPiece(body)[wireKey('pieceLevel')] = -1)],
    ['pieces that are not a list', (body) => (body[wireKey('pieces')] = null)],
  ];

  for (const [name, corrupt] of malformed) {
    it(`returns null for ${name}`, () => {
      const body = loadCollectionsBody();
      corrupt(body);
      expect(parseCollectionsState(body)).toBeNull();
    });
  }

  it('returns null, without throwing, for anything that is not an object', () => {
    for (const body of [null, undefined, 'x', 4, [], [loadCollectionsBody()]]) {
      expect(parseCollectionsState(body)).toBeNull();
    }
  });
});

describe('the Collections route', () => {
  it('is requested with the account id the way every other account read is', () => {
    expect(withAccountId(COLLECTIONS_STATE_PATH, '486')).toBe('/colecao?account_id=486');
  });
});

describe('the Collections lexicon', () => {
  it('declares a wire key for every contract axis', () => {
    for (const axis of COLLECTION_AXES) {
      expect(wireKey(COLLECTION_AXIS_SYMBOLS[axis])).toBeTruthy();
    }
  });

  it('declares each wire token with a description', () => {
    expect(COLLECTIONS_WIRE_LEXICON.every((entry) => entry.description.length > 0)).toBe(true);
  });
});

describe('the board built from the committed synthetic body', () => {
  const snapshot = parsedFixture();
  const board = buildCollectionBoard(snapshot);

  it("recomputes every effect's current bonus from its pages to the figure the server states", () => {
    for (const set of board.sets) {
      set.effects.forEach((effect, index) => {
        const fromPages = set.pages.reduce(
          (total, page) => total + collectionCents(required(page.effects[index], 'a page row per effect').granted),
          0,
        );
        expect(fromPages, `${set.code} ${effect.axis}`).toBe(collectionCents(effect.now));
      });
    }
  });

  it('sums the current bonuses of every book on an axis to the uncapped total the server states', () => {
    for (const row of board.axes) {
      const fromBooks = board.sets
        .flatMap((set) => set.effects.filter((effect) => effect.axis === row.axis))
        .reduce((total, effect) => total + collectionCents(effect.now), 0);
      expect(fromBooks, row.axis).toBe(collectionCents(row.raw));
    }
  });

  it('holds only the Damage axis at its cap', () => {
    expect(board.axes.filter((row) => row.atCap).map((row) => row.axis)).toEqual(['damage']);
  });

  it('counts the books started and complete and the pieces sacrificed', () => {
    expect(board.summary).toEqual({
      booksStarted: 10,
      booksComplete: 2,
      booksTotal: 30,
      piecesSacrificed: 262,
      piecesTotal: 1440,
      readyInBag: 0,
    });
  });

  it('names the two complete books', () => {
    expect(board.sets.filter((set) => set.status === 'complete').map((set) => set.code)).toEqual(['ember', 'steel']);
  });
});

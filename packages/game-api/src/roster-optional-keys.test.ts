/**
 * The hero level declares three `optional` keys — `runas`, `soulbound`, `export_lock_secs` — keys
 * the game emits only in some states. Until this fixture existed, no `/roster` body in this
 * directory carried a single one of them: the "a key may be omitted but is not nonexistent" rule
 * was proven synthetically in `packages/domain`, and on export bodies for `soulbound` alone. So
 * the one thing nobody had checked was whether a ROSTER body carrying what the game actually
 * sends still passes `checkShape` — rather than having its optional keys reported as ADDED, which
 * the shape checker treats as a break and which would degrade the heroes section on every refresh
 * of any account with a runed or bound hero.
 *
 * `roster-optional-keys.json` is HAND-AUTHORED, not captured. Its hero shapes are copies of the
 * committed calibration roster bodies; the three optional keys and their values were written here.
 * It claims no capture date and nothing in it was scrubbed from a real account — its own
 * `_provenance` block says the same, and the assertion below keeps that block from being quietly
 * dropped. What it can therefore prove is a schema fact, not a numeric one: that the declared
 * optional keys pass the shape check in both their present and absent forms.
 *
 * The keys are read off `SCHEMA_LEVELS.hero.optional` rather than retyped, so a fourth optional
 * hero key added later is not quietly exempt — it fails here until this fixture witnesses it too.
 */
import { SCHEMA_LEVELS, assertNonEmptyCorpusArray, assertOptionalKeyWitnessedBothWays } from '@bombfarm/domain/save-schema';
import { describe, expect, it } from 'vitest';
import { ROUTE_FINGERPRINTS } from './fingerprints.js';
import { checkShape } from './shape.js';
import { fixturePath, loadFixtureJson, required, requireFixture } from './test-fixtures.js';

const FIXTURE = 'roster-optional-keys.json';
const present = requireFixture(fixturePath(FIXTURE), 'the hero level’s optional keys on a roster body');
const fixture = present ? loadFixtureJson(FIXTURE) : null;

const OPTIONAL_HERO_KEYS = SCHEMA_LEVELS.hero.optional ?? [];

function rosterBody(): Record<string, unknown> {
  return required(fixture?.['/roster'], `no /roster body in ${FIXTURE}`);
}

function heroes(): Record<string, unknown>[] {
  return rosterBody().heroes as Record<string, unknown>[];
}

describe('a roster body carrying the hero level’s optional keys', () => {
  it('says in the file itself that it is hand-authored rather than captured', () => {
    if (!fixture) return;
    const provenance = required(fixture['_provenance'], `${FIXTURE} has lost its _provenance block`);
    expect(
      provenance['authored'],
      `${FIXTURE} must keep saying it was not captured — every other body in this directory was, ` +
        'and a reader who assumes this one was too would treat its values as observed.',
    ).toMatch(/hand-authored/);
  });

  it('non-vacuity: the roster carries heroes, and the hero level declares optional keys to witness', () => {
    if (!fixture) return;
    assertNonEmptyCorpusArray(heroes(), '/roster.heroes');
    expect(OPTIONAL_HERO_KEYS.length, 'the hero level declares no optional keys to witness').toBeGreaterThan(0);
  });

  it.each([...OPTIONAL_HERO_KEYS])('witnesses %s both present and absent across the roster', (key) => {
    if (!fixture) return;
    assertOptionalKeyWitnessedBothWays(heroes(), key, `/roster.heroes[].${key}`);
  });

  it('passes the heroes fingerprint — the optional keys are declared, not reported as added', () => {
    if (!fixture) return;
    const result = checkShape(rosterBody(), ROUTE_FINGERPRINTS.heroes);
    expect(
      result,
      'an optional key reported as added is a shape break, which degrades the heroes section on ' +
        'every refresh of an account with a runed or bound hero.',
    ).toEqual({ ok: true });
  });

  it('still fails on a hero carrying a key the fingerprint does not declare', () => {
    if (!fixture) return;
    const [first, ...rest] = heroes();
    const corrupted = {
      ...rosterBody(),
      heroes: [{ ...required(first, 'no first hero'), a_key_the_game_never_sent: 1 }, ...rest],
    };

    const result = checkShape(corrupted, ROUTE_FINGERPRINTS.heroes);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.addedKeys).toEqual(['heroes.heroes[0].a_key_the_game_never_sent']);
      expect(result.missingKeys).toEqual([]);
    }
  });

  it('carries the three keys in the value shapes the model reads', () => {
    if (!fixture) return;
    const runed = heroes().filter((hero) => 'runas' in hero);
    expect(runed.length).toBeGreaterThan(0);
    for (const hero of runed) {
      const runes = hero.runas as { e: unknown; p: unknown; s: unknown; r: unknown }[];
      assertNonEmptyCorpusArray(runes, '/roster.heroes[].runas');
      for (const rune of runes) {
        // The wire form `readHeroRunes` parses: axis, strength as a fraction, play-seconds left,
        // rarity index. A rune missing any of these is dropped on its own, so a fixture carrying a
        // malformed one would witness the key while proving nothing about the value.
        expect(typeof rune.e).toBe('string');
        expect(typeof rune.p).toBe('number');
        expect(rune.p as number).toBeGreaterThan(0);
        expect(rune.s as number).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(rune.r)).toBe(true);
      }
    }

    // The game emits `soulbound` only on bound records, always literal `true` — never `false`.
    for (const hero of heroes()) {
      if ('soulbound' in hero) expect(hero.soulbound).toBe(true);
      if ('export_lock_secs' in hero) expect(hero.export_lock_secs as number).toBeGreaterThan(0);
    }
  });
});

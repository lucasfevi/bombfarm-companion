import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AccountPayload, AccountSection } from '@bombfarm/contracts';
import { createAccountStore } from './account-store.js';
import type { SqliteDb } from './index.js';
import {
  createLogSpy,
  detectAvailableBindings,
  openTestAccountDb,
  warnForUnavailableBindings,
} from './test-support.js';

function seedSectionRow(db: SqliteDb, key: string, section: AccountSection, body: unknown, capturedAt: string): void {
  db.prepare(
    'INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?)',
  ).run(key, section, JSON.stringify(body), capturedAt);
}

function sectionField(payload: AccountPayload, section: AccountSection): unknown {
  return (payload as unknown as Record<string, unknown>)[section];
}

function seedBoundAccountId(db: SqliteDb, key: string): void {
  db.prepare(
    'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
  ).run('account_id', key);
}

/** A post-patch `skills.totals` — used as the base for both clean and stale skills fixtures
 *  below (MP5 F4, T10). */
function cleanSkillsTotals(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    team_dmg_add: 1,
    crit_chance_add: 1,
    crit_dmg_add: 1,
    speed_add: 1,
    coin_add: 1,
    luck_add: 1,
    energia_add: 1,
    xp_mult: 1,
    geo_mult: 1,
    dmg_static: 1,
    vagas_campo: 1,
    bag_tabs_bonus: 1,
    ...overrides,
  };
}

function cleanSkillsBody(totalsOverrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    levels: {},
    refunds: {},
    field_slots: 5,
    bag_tabs: 2,
    gold: 100,
    max_phase: 50,
    totals: cleanSkillsTotals(totalsOverrides),
  };
}

/** A post-patch `account` section body (`SECTION_FINGERPRINTS.account`'s 13 `STATE_LEVEL` keys)
 *  — MP5 F4's schema gate (`MSG-19`/`MSG-20`) now drops a stored section whose body doesn't
 *  match its fingerprint, so every fixture below that predates this file's F4 tests had to move
 *  off the old `{phase: N}` shorthand onto a schema-conforming body. Each test still puts its
 *  adversarial VALUE (a huge integer, an empty string, a non-boolean, …) into a real declared
 *  key — decodeStoredSection's "no normalization" contract is about VALUES, not about which key
 *  NAMES a section is allowed to carry. */
function cleanAccountBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    gold: 100,
    crystals: 10,
    phase: 5,
    max_phase: 50,
    locked: false,
    checkpoint_at: '2026-08-01T00:00:00.000Z',
    chests: 0,
    chest_stash: 0,
    item_stash: 0,
    vip_until: 0,
    bag_tabs: 1,
    bag_capacity: 100,
    items_count: 0,
    ...overrides,
  };
}

function cleanCasaBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    active_casa: 0,
    levels: [],
    cycle_secs: [],
    slots: 1,
    slots_per_house: [],
    cycle_secs_per_house: [],
    upgrade_cost: [],
    ...overrides,
  };
}

/** `stats` is a plain (non-`children`) `ITEM_LEVEL` key — any value round-trips through it
 *  untouched, which is why the deeply-nested-array adversarial test uses it below. */
function cleanItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'i1',
    def_id: 'd1',
    set: 'set1',
    rarity: 1,
    category: 1,
    level: 1,
    stats: [{ stat: 1, value: 0, effective: 0 }],
    power: 100,
    sell_value: 10,
    sellable: true,
    upgrade: 0,
    tradable: true,
    market_state: 0,
    locked: false,
    equipped_on: null,
    equip_slot: null,
    in_stash: true,
    ...overrides,
  };
}

function cleanHero(id: string, name: string): Record<string, unknown> {
  return {
    id,
    name,
    level: 1,
    xp: 0,
    rarity: 1,
    rank: 1,
    stars: 0,
    skin: 0,
    skin_birth: 0,
    in_field: true,
    battle_allowed: true,
    marketable: false,
    in_market: false,
    slots: {},
    stats: {},
    birth_stats: {},
    stat_ranges: {},
    abilities: {},
    ability_points_total: 0,
    ability_points_spent: 0,
    ability_reroll_cost: 0,
    ability_reroll_stone: 0,
    stat_points_available: 0,
  };
}

/** Wraps a real `SqliteDb` so every `DELETE FROM account_section` statement throws on `run()` —
 *  simulates the `MSG-24` "store failure during the drop's own cleanup" edge case without
 *  touching the real file. Every other statement passes through untouched. */
function wrapFailingDelete(db: SqliteDb): SqliteDb {
  return {
    exec: (sql) => {
      db.exec(sql);
    },
    prepare: (sql) => {
      const real = db.prepare(sql);
      if (sql.includes('DELETE FROM account_section')) {
        return {
          run: () => {
            throw new Error('simulated disk I/O error');
          },
          get: (...args: unknown[]) => real.get(...args),
          all: (...args: unknown[]) => real.all(...args),
        };
      }
      return real;
    },
    close: () => {
      db.close();
    },
  };
}

const AVAILABLE_BINDINGS = detectAvailableBindings();

beforeAll(() => {
  warnForUnavailableBindings(AVAILABLE_BINDINGS);
});

describe('createAccountStore().restore()', () => {
  it('ran against at least one SQLite binding', () => {
    expect(AVAILABLE_BINDINGS.length).toBeGreaterThan(0);
  });

  describe.each(AVAILABLE_BINDINGS.map((binding) => ({ binding })))('binding: $binding', ({ binding }) => {
    it('reports unavailable with an empty payload when nothing was ever stored', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      const restored = store.restore();

      expect(restored.status).toBe('unavailable');
      expect(restored.reason).toBe('empty');
      expect(restored.gameRunning).toBe(false);
      for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as AccountSection[]) {
        expect(restored.payload.fidelity[section]).toEqual({ status: 'missing' });
        expect(sectionField(restored.payload, section)).toBeUndefined();
        expect(sectionField(restored.payload, section)).not.toEqual({});
        expect(sectionField(restored.payload, section)).not.toEqual([]);
        expect(sectionField(restored.payload, section)).not.toBe(0);
        expect(sectionField(restored.payload, section)).not.toBeNull();
      }
      store.close();
    });

    it('serves a cold-start restore as not running with every stored section stale', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'account', cleanAccountBody({ phase: 5 }), '2026-08-12T00:00:00.000Z');
      seedSectionRow(open.db, '', 'heroes', [cleanHero('h1', 'Bellatrix')], '2026-08-12T00:00:01.000Z');

      const store = createAccountStore(open);
      const restored = store.restore();

      expect(restored.gameRunning).toBe(false);
      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:00.000Z' });
      expect(restored.payload.fidelity.heroes).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:01.000Z' });
      for (const section of Object.values(restored.payload.fidelity)) {
        expect(section.status).not.toBe('resolved');
      }
      store.close();
    });

    it('round-trips every section unchanged across a close/reopen, including adversarial bodies', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-account-store-'));
      const dbPath = path.join(dir, 'account.db');
      try {
        // MP5 F4's schema gate (MSG-19/20) now drops a section whose body carries an
        // unrecognized KEY, so "adversarial" here means an adversarial VALUE in a real declared
        // key, not an arbitrary shape — schema conformance and value-fidelity are different
        // concerns, and this test is only about the second one.
        const bodies: Record<AccountSection, unknown> = {
          account: cleanAccountBody({ phase: 123456789012345, checkpoint_at: 'ünïcödé — 日本語 — 0' }),
          heroes: [cleanHero('h1', 'ünïcödé — 日本語 — emoji 🎉')],
          skills: cleanSkillsBody({ crit_dmg_add: 0 }),
          casa: cleanCasaBody({ active_casa: '' }),
          items: [cleanItem({ stats: [[1, 2], [3, { deep: true }]] })],
        };
        const capturedAt: Record<AccountSection, string> = {
          account: '2026-08-12T00:00:00.000Z',
          heroes: '2026-08-12T00:00:01.000Z',
          skills: '2026-08-12T00:00:02.000Z',
          casa: '2026-08-12T00:00:03.000Z',
          items: '2026-08-12T00:00:04.000Z',
        };

        const first = openTestAccountDb(binding, dbPath);
        if (!first.db) throw new Error('expected a usable db');
        for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as AccountSection[]) {
          seedSectionRow(first.db, '', section, bodies[section], capturedAt[section]);
        }
        createAccountStore(first).close();

        const second = openTestAccountDb(binding, dbPath);
        const store = createAccountStore(second);
        const restored = store.restore();

        for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as AccountSection[]) {
          expect(sectionField(restored.payload, section)).toEqual(bodies[section]);
          expect(restored.payload.fidelity[section]).toEqual({ status: 'stale', capturedAt: capturedAt[section] });
        }
        store.close();
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('serves two sections with the two timestamps they were written with, no account-level capture time', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'account', cleanAccountBody({ phase: 1 }), '2026-08-01T00:00:00.000Z');
      seedSectionRow(open.db, '', 'skills', cleanSkillsBody(), '2026-08-05T12:30:00.000Z');

      const store = createAccountStore(open);
      const restored = store.restore();

      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2026-08-01T00:00:00.000Z' });
      expect(restored.payload.fidelity.skills).toEqual({ status: 'stale', capturedAt: '2026-08-05T12:30:00.000Z' });
      expect(restored).not.toHaveProperty('capturedAt');
      expect(restored.payload).not.toHaveProperty('capturedAt');
      store.close();
    });

    it('discards an undecodable row, logs it, and reports the section missing', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      open.db.prepare(
        'INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?)',
      ).run('', 'skills', 'not even json{{{', '2026-08-12T00:00:00.000Z');
      seedSectionRow(open.db, '', 'account', cleanAccountBody({ phase: 1 }), '2026-08-12T00:00:00.000Z');

      const { log, records } = createLogSpy();
      const store = createAccountStore(open, { log });
      const restored = store.restore();

      expect(restored.payload.fidelity.skills).toEqual({ status: 'missing' });
      expect(sectionField(restored.payload, 'skills')).toBeUndefined();
      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:00.000Z' });
      expect(
        records.some(
          (r) => r.record.event === 'account.row_discarded' && r.record.section === 'skills' && r.record.scope === 'storage',
        ),
      ).toBe(true);
      store.close();
    });

    it('performs no normalization of its own — recognized-key bodies round-trip byte-equal, values and key order both', () => {
      // MP5 F4's schema gate (MSG-19/20) now drops a section whose body carries an unrecognized
      // KEY — that is a different concern (schema conformance) from what this test asserts (no
      // coercion/defaulting/reordering of VALUES `decodeStoredSection` recognizes). A wrong-typed
      // value in a real declared key still proves no value-level normalization happens.
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const body = cleanAccountBody({ locked: 'not-a-boolean', gold: -5, checkpoint_at: null });
      seedSectionRow(open.db, '', 'account', body, '2026-08-12T00:00:00.000Z');

      const store = createAccountStore(open);
      const restored = store.restore();

      expect(Object.keys(sectionField(restored.payload, 'account') as object)).toEqual(Object.keys(body));
      expect(sectionField(restored.payload, 'account')).toEqual(body);
      store.close();
    });

    it('serves every section missing when a different account is running, without touching the other key\'s rows', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedBoundAccountId(open.db, 'account-A');
      seedSectionRow(open.db, 'account-A', 'account', { phase: 1 }, '2026-08-12T00:00:00.000Z');

      const store = createAccountStore(open);
      const restored = store.restore('account-B');

      expect(restored.status).toBe('unavailable');
      expect(restored.reason).toBe('account_mismatch');
      for (const section of ['account', 'heroes', 'skills', 'casa', 'items'] as AccountSection[]) {
        expect(restored.payload.fidelity[section]).toEqual({ status: 'missing' });
      }

      const stillThere = open.db
        .prepare('SELECT body FROM account_section WHERE account_key = ? AND section = ?')
        .get('account-A', 'account') as { body: string } | undefined;
      expect(stillThere?.body).toBe(JSON.stringify({ phase: 1 }));
      store.close();
    });

    it('gameRunning is false on every restore path', () => {
      const empty = createAccountStore(openTestAccountDb(binding));
      expect(empty.restore().gameRunning).toBe(false);
      empty.close();
    });

    it('reports status ok with a null reason when at least one section resolved something to restore', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'account', { phase: 1 }, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restored = store.restore();
      expect(restored.status).toBe('ok');
      expect(restored.reason).toBeNull();
      store.close();
    });

    it('restore() is idempotent — two calls in a row return deep-equal results', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'account', cleanAccountBody({ phase: 1 }), '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      expect(store.restore()).toEqual(store.restore());
      store.close();
    });

    it('adversarial body: unicode text round-trips exactly', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      // `name` is a real declared hero key — schema-conforming, unicode VALUE is the point.
      const body = [cleanHero('h1', 'ünïcödé — 日本語 — emoji 🎉')];
      seedSectionRow(open.db, '', 'heroes', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      expect(sectionField(store.restore().payload, 'heroes')).toEqual(body);
      store.close();
    });

    it('adversarial body: deeply nested arrays round-trip exactly', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      // `stats` is a plain (non-schema-checked) ITEM_LEVEL key — any value round-trips through it.
      const body = [cleanItem({ stats: [[1, 2], [3, [4, [5, { deep: true }]]]] })];
      seedSectionRow(open.db, '', 'items', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      expect(sectionField(store.restore().payload, 'items')).toEqual(body);
      store.close();
    });

    it('adversarial body: a zero-valued field round-trips as 0, not as absent or falsy-stripped', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const body = cleanSkillsBody({ dmg_static: 0 });
      body.gold = 0;
      seedSectionRow(open.db, '', 'skills', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restoredBody = sectionField(store.restore().payload, 'skills') as { gold: number };
      expect(restoredBody.gold).toBe(0);
      store.close();
    });

    it('adversarial body: an empty-string field round-trips as "", not as absent or null', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const body = cleanCasaBody({ active_casa: '' });
      seedSectionRow(open.db, '', 'casa', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restoredBody = sectionField(store.restore().payload, 'casa') as { active_casa: string };
      expect(restoredBody.active_casa).toBe('');
      store.close();
    });

    it('adversarial body: a 15-digit integer round-trips without precision loss', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const body = cleanAccountBody({ phase: 123456789012345 });
      seedSectionRow(open.db, '', 'account', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restoredBody = sectionField(store.restore().payload, 'account') as { phase: number };
      expect(restoredBody.phase).toBe(123456789012345);
      store.close();
    });

    it('capturedAt with a non-UTC offset round-trips as the exact same string, never reformatted', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'account', cleanAccountBody({ phase: 1 }), '2026-08-12T00:00:00.000-03:00');
      const store = createAccountStore(open);
      const restored = store.restore();
      expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:00.000-03:00' });
      store.close();
    });

    it('a first bind to a never-before-seen account id reads its own (empty) rows, not the default key\'s', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      // Data exists under the unbound default key, but the store has never bound any account yet.
      seedSectionRow(open.db, '', 'account', cleanAccountBody({ phase: 1 }), '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restored = store.restore('brand-new-account');
      expect(restored.status).toBe('unavailable');
      expect(restored.reason).toBe('empty');
      store.close();
    });

    it('restore(expectedAccountId) reads the real bound key\'s rows when it matches the binding', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedBoundAccountId(open.db, 'account-A');
      const body = cleanAccountBody({ phase: 7 });
      seedSectionRow(open.db, 'account-A', 'account', body, '2026-08-12T00:00:00.000Z');
      const store = createAccountStore(open);
      const restored = store.restore('account-A');
      expect(restored.status).toBe('ok');
      expect(sectionField(restored.payload, 'account')).toEqual(body);
      store.close();
    });

    it('discards a wrong-container row (valid JSON, wrong shape) distinctly from invalid JSON', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      // heroes must be an array; a plain object is valid JSON but the wrong container.
      open.db
        .prepare('INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?)')
        .run('', 'heroes', '{"not":"an array"}', '2026-08-12T00:00:00.000Z');

      const { log, records } = createLogSpy();
      const store = createAccountStore(open, { log });
      const restored = store.restore();

      expect(restored.payload.fidelity.heroes).toEqual({ status: 'missing' });
      expect(
        records.some(
          (r) => r.record.event === 'account.row_discarded' && r.record.section === 'heroes' && r.record.reason === 'wrong_container',
        ),
      ).toBe(true);
      store.close();
    });

    // --- MP5 F4 (T10): the stale-section drop (`MSG-19`, `MSG-20`, `MSG-23`…`MSG-26`, `MSG-28`) ---

    it('MSG-19/20/25 per-section: a keystone-carrying skills row is dropped and its row deleted; a clean sibling heroes row survives byte-identical', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const staleSkillsBody = cleanSkillsBody({ keystones: [], abisso_base: 1.05, crit_dmg_mult: 2 });
      const cleanHeroesBody = [cleanHero('h1', 'Bellatrix')];
      seedSectionRow(open.db, '', 'skills', staleSkillsBody, '2026-08-12T00:00:00.000Z');
      seedSectionRow(open.db, '', 'heroes', cleanHeroesBody, '2026-08-12T00:00:01.000Z');

      const { log, records } = createLogSpy();
      const store = createAccountStore(open, { log });
      const restored = store.restore();

      expect(restored.payload.fidelity.skills).toEqual({ status: 'missing' });
      expect(sectionField(restored.payload, 'skills')).toBeUndefined();
      expect(restored.payload.fidelity.heroes).toEqual({ status: 'stale', capturedAt: '2026-08-12T00:00:01.000Z' });
      expect(sectionField(restored.payload, 'heroes')).toEqual(cleanHeroesBody);

      expect(
        records.some((r) => r.record.event === 'account.row_dropped' && r.record.section === 'skills'),
      ).toBe(true);

      const skillsRow = open.db
        .prepare('SELECT body FROM account_section WHERE account_key = ? AND section = ?')
        .get('', 'skills');
      expect(skillsRow).toBeUndefined();

      const heroesRow = open.db
        .prepare('SELECT body FROM account_section WHERE account_key = ? AND section = ?')
        .get('', 'heroes') as { body: string } | undefined;
      expect(heroesRow?.body).toBe(JSON.stringify(cleanHeroesBody));
      store.close();
    });

    it('MSG-23 idempotent: a second restore() after a drop reports the same result and drops nothing further', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'skills', cleanSkillsBody({ crit_dmg_mult: 1 }), '2026-08-12T00:00:00.000Z');
      seedSectionRow(open.db, '', 'heroes', [cleanHero('h1', 'Bellatrix')], '2026-08-12T00:00:01.000Z');

      const { log, records } = createLogSpy();
      const store = createAccountStore(open, { log });
      const first = store.restore();
      records.length = 0;
      const second = store.restore();

      expect(second).toEqual(first);
      expect(second.payload.fidelity.skills).toEqual({ status: 'missing' });
      expect(records.some((r) => r.record.event === 'account.row_dropped')).toBe(false);
      store.close();
    });

    it('MSG-24 store failure ≠ drop: a failing DELETE during cleanup still reports the section missing and never throws', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      seedSectionRow(open.db, '', 'skills', cleanSkillsBody({ crit_dmg_mult: 1 }), '2026-08-12T00:00:00.000Z');
      const realDb = open.db;
      const wrappedOpen = { ...open, db: wrapFailingDelete(realDb) };

      const { log, records } = createLogSpy();
      const store = createAccountStore(wrappedOpen, { log });

      let restored: ReturnType<typeof store.restore> | undefined;
      expect(() => {
        restored = store.restore();
      }).not.toThrow();
      expect(restored?.payload.fidelity.skills).toEqual({ status: 'missing' });
      expect(restored ? sectionField(restored.payload, 'skills') : undefined).toBeUndefined();
      expect(records.some((r) => r.level === 'error' && r.record.event === 'account.row_drop_delete_failed')).toBe(
        true,
      );

      // The delete failed, so the row is still on disk — read it back with the real (unwrapped) db.
      const stillThere = realDb
        .prepare('SELECT body FROM account_section WHERE account_key = ? AND section = ?')
        .get('', 'skills');
      expect(stillThere).toBeDefined();
      store.close();
    });

    it('MSG-28: the row_dropped log payload names field paths only — a seeded gold sentinel never appears in it', () => {
      const open = openTestAccountDb(binding);
      if (!open.db) throw new Error('expected a usable db');
      const sentinelGold = 918273645;
      seedSectionRow(
        open.db,
        '',
        'skills',
        cleanSkillsBody({ crit_dmg_mult: 1, dmg_static: sentinelGold }),
        '2026-08-12T00:00:00.000Z',
      );

      const { log, records } = createLogSpy();
      const store = createAccountStore(open, { log });
      store.restore();

      const dropped = records.find((r) => r.record.event === 'account.row_dropped');
      expect(dropped).toBeDefined();
      const payload = JSON.stringify(dropped?.record);
      expect(payload).not.toContain(String(sentinelGold));
      store.close();
    });
  });

  it('propagates schema_too_new from openAccountDatabase with an empty payload', () => {
    const store = createAccountStore({ status: 'unavailable', db: null, binding: null, reason: 'schema_too_new' });
    const restored = store.restore();
    expect(restored.status).toBe('unavailable');
    expect(restored.reason).toBe('schema_too_new');
    for (const section of Object.values(restored.payload.fidelity)) {
      expect(section.status).toBe('missing');
    }
  });

  it('propagates no_sqlite_binding from openAccountDatabase with an empty payload', () => {
    const store = createAccountStore({ status: 'unavailable', db: null, binding: null, reason: 'no_sqlite_binding' });
    const restored = store.restore();
    expect(restored.status).toBe('unavailable');
    expect(restored.reason).toBe('no_sqlite_binding');
  });

  it('propagates degraded/not_writable from openAccountDatabase without reading anything', () => {
    const store = createAccountStore({ status: 'degraded', db: null, binding: null, reason: 'not_writable' });
    const restored = store.restore();
    expect(restored.status).toBe('degraded');
    expect(restored.reason).toBe('not_writable');
    expect(restored.gameRunning).toBe(false);
  });

  it('close() never throws when the store failed to open (db is null)', () => {
    const store = createAccountStore({ status: 'unavailable', db: null, binding: null, reason: 'no_sqlite_binding' });
    expect(() => {
      store.close();
    }).not.toThrow();
  });

  it('never constructs a resolved status literal in its source (AD-025 guard)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'account-store.ts'), 'utf8');
    expect(source).not.toMatch(/status:\s*['"]resolved['"]/);
  });
});

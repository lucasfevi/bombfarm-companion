import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildInventoryView } from '@bombfarm/domain/inventory-view';
import { SCHEMA_LEVELS, assertOptionalKeyWitnessedBothWays } from '@bombfarm/domain/save-schema';
import { ROUTE_FINGERPRINTS, SECTION_FINGERPRINTS, checkSectionShape } from './fingerprints.js';
import { identifyObservedBody } from './identify-observed-body.js';
import { createPacingGate, type PacingClock } from './pacing.js';
import { ROUTES, readSection } from './routes.js';
import { SessionToken, grantSession } from './session.js';
import { fixturePath, grantedConsent, loadFixtureJson, required } from './test-fixtures.js';

const postPatch = JSON.parse(readFileSync(fixturePath('inventory-post-patch.json'), 'utf8')) as {
  items: Record<string, unknown>[];
  chests: unknown[];
};
const preSale = required(loadFixtureJson('api-bodies.json')['/inventory'], 'no /inventory fixture body');

const clock: PacingClock = { now: () => 0, sleep: () => Promise.resolve() };
const session = grantSession(grantedConsent('2026-10-07T00:00:00.000Z'), {
  accountId: '486',
  token: SessionToken.create('sentinel-inventory-post-patch'),
});
const itemsRoute = required(
  ROUTES.find((route) => route.section === 'items'),
  'no items route',
);

describe('the /inventory body since the game stopped selling items for gold', () => {
  it('carries neither sell key on any item, and a chests key beside the items', () => {
    expect(postPatch.items.length).toBeGreaterThan(0);
    for (const item of postPatch.items) {
      expect(item).not.toHaveProperty('sell_value');
      expect(item).not.toHaveProperty('sellable');
    }
    expect(postPatch).toHaveProperty('chests');
  });

  it('is identified as the items route, as the pre-sale body still is', () => {
    expect(identifyObservedBody(postPatch)).toEqual({ kind: 'identified', section: 'items' });
    expect(identifyObservedBody(preSale)).toEqual({ kind: 'identified', section: 'items' });
  });

  it('resolves as a clean read rather than drift, so nothing sends the app back to a stored row', async () => {
    const outcome = await readSection(
      session,
      () => Promise.resolve({ status: 200, body: JSON.stringify(postPatch) }),
      createPacingGate(clock),
      itemsRoute,
    );

    expect(outcome).toEqual({ kind: 'ok', body: postPatch.items });
  });

  it('passes the stored-row check, so a section persisted from it restores', () => {
    expect(checkSectionShape(postPatch.items, SECTION_FINGERPRINTS.items)).toEqual({ ok: true });
  });

  it('still reports an item that lost a key the game does send', () => {
    const { power: _power, ...withoutPower } = postPatch.items[0] ?? {};
    const body = { ...postPatch, items: [withoutPower, ...postPatch.items.slice(1)] };

    expect(identifyObservedBody(body)).toEqual({ kind: 'unidentified' });
  });

  it('reaches the inventory view with every row, the chest among them', () => {
    const view = buildInventoryView(postPatch.items);

    expect(view.skipped).toBe(0);
    expect(view.items).toHaveLength(postPatch.items.length);
    expect(view.items.map((item) => item.kind)).toContain('chest');
  });

  it('declares both sell keys optional, so exports and fixtures that still carry them keep passing', () => {
    const corpus = [...(preSale.items as Record<string, unknown>[]), ...postPatch.items];
    assertOptionalKeyWitnessedBothWays(corpus, 'sell_value', '/inventory.items[].sell_value');
    assertOptionalKeyWitnessedBothWays(corpus, 'sellable', '/inventory.items[].sellable');
    expect(SCHEMA_LEVELS.apiItem.keys).not.toContain('sell_value');
    expect(SCHEMA_LEVELS.apiItem.keys).not.toContain('sellable');
    expect(SCHEMA_LEVELS.apiItem.optional).toEqual(expect.arrayContaining(['sell_value', 'sellable']));
    expect(ROUTE_FINGERPRINTS.items.level.keys).toContain('chests');
  });
});

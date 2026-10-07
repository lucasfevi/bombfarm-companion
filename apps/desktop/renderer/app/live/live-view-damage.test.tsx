import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UNATTRIBUTED_REASONS } from '@bombfarm/contracts';
import type { CreditAmounts, LiveDamage, UnattributedReason } from '@bombfarm/contracts';
import { EMPTY_LIVE_FAST_MODEL, type LiveModel } from '../../lib/live/live-model';

const none: CreditAmounts = { damage: 0, props: 0, gold: 0 };

const DAMAGE: LiveDamage = {
  teamDps10: 2_400,
  teamDpsSession: 1_900,
  coverageSeconds: 120,
  sessionSeconds: 600,
  heroes: [{ heroId: 'astra', dps: 1_500, damage: 900_000, props: 120, gold: 45_000, fieldSeconds: 450, uptime: 0.75, onField: true }],
  unattributed: { damage: 50_000, props: 9, gold: 3_000, dps: 80 },
  unattributedReasons: Object.fromEntries(UNATTRIBUTED_REASONS.map((reason) => [reason, none])) as Record<
    UnattributedReason,
    CreditAmounts
  >,
  team: { damage: 950_000, props: 129, gold: 48_000 },
};

const MODEL: LiveModel = {
  freshness: { kind: 'live' },
  slow: {
    onField: [{ id: 'astra', name: 'Astra' }],
    recovering: [],
    queued: [],
    benched: [],
    unclassifiedCount: 0,
    fieldExitPendingCount: 0,
    occupancy: { occupied: 1, fieldSize: 6 },
    house: {},
  },
  fast: EMPTY_LIVE_FAST_MODEL,
  earnings: null,
  map: null,
  damage: DAMAGE,
};

vi.mock('../../lib/live/use-live-model', () => ({ useLiveModel: () => MODEL }));

describe('LiveView — the damage slice', () => {
  it('hands the model damage to the Live panel, so the Damage panel draws the slice it holds', async () => {
    const { LiveView } = await import('./live-view');
    const html = renderToStaticMarkup(createElement(LiveView, {}));

    expect(html).toMatch(/data-testid="live-damage-team-dps-session"[^>]*>1\.9k</);
    expect(html).toMatch(/data-testid="live-damage-row-astra-name"[^>]*>Astra</);
  });
});

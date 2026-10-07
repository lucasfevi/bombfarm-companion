import { describe, expect, it } from 'vitest';
import { isIpcChannel, isIpcEventChannel, IPC_CHANNELS, IPC_EVENT_CHANNELS } from './index.js';
import {
  energyDisplayPercent,
  isActionableGap,
  liveGap,
  LIVE_DISPLAY_REFRESH_MS,
  sameLiveDamage,
  UNATTRIBUTED_REASONS,
  type LiveDamage,
  type LiveDamageHeroRow,
  type LiveEvent,
  type LiveGapReason,
  type UnattributedReason,
} from './live-source.js';

/** Exhaustive over `LiveGapReason` via a `satisfies` record: adding a reason without adding it
 *  here is a compile error, not a silently-actionable gap. */
const EXPECTED_ACTIONABLE = {
  clientNotStreaming: false,
  neverAttached: true,
  consentMissing: true,
  runtimeUnavailable: true,
  attachFailed: true,
  detached: true,
  hookSilent: true,
} satisfies Record<LiveGapReason, boolean>;

const ALL_REASONS = Object.keys(EXPECTED_ACTIONABLE) as readonly LiveGapReason[];

describe('isActionableGap', () => {
  it('is false only for clientNotStreaming', () => {
    for (const reason of ALL_REASONS) {
      expect(isActionableGap(reason)).toBe(EXPECTED_ACTIONABLE[reason]);
    }
  });
});

describe('liveGap', () => {
  it('derives actionable from isActionableGap for every reason', () => {
    const sinceAt = '2026-08-22T00:00:00.000Z';
    for (const reason of ALL_REASONS) {
      const gap = liveGap(reason, sinceAt);
      expect(gap.kind).toBe('gap');
      if (gap.kind !== 'gap') {
        throw new Error('liveGap must always return the gap variant');
      }
      expect(gap.reason).toBe(reason);
      expect(gap.actionable).toBe(isActionableGap(reason));
      expect(gap.sinceAt).toBe(sinceAt);
    }
  });

  it('carries likelyQuarantine through for runtimeUnavailable', () => {
    const sinceAt = '2026-08-22T00:00:00.000Z';
    const gap = liveGap('runtimeUnavailable', sinceAt, { likelyQuarantine: true });
    expect(gap.kind).toBe('gap');
    if (gap.kind === 'gap') {
      expect(gap.likelyQuarantine).toBe(true);
    }
  });

  it('leaves likelyQuarantine undefined when not passed', () => {
    const sinceAt = '2026-08-22T00:00:00.000Z';
    const gap = liveGap('attachFailed', sinceAt);
    expect(gap.kind).toBe('gap');
    if (gap.kind === 'gap') {
      expect(gap.likelyQuarantine).toBeUndefined();
    }
  });

  it('carries the runtime detail through for attachFailed, and omits the key when not passed', () => {
    const sinceAt = '2026-08-22T00:00:00.000Z';
    const withDetail = liveGap('attachFailed', sinceAt, { detail: 'Error creating directory: Permission denied' });
    expect(withDetail).toMatchObject({ kind: 'gap', detail: 'Error creating directory: Permission denied' });
    expect(liveGap('attachFailed', sinceAt)).not.toHaveProperty('detail');
  });
});

describe('live IPC surface', () => {
  it('registers live:get as an invoke channel', () => {
    expect(isIpcChannel('live:get')).toBe(true);
    expect(IPC_CHANNELS).toContain('live:get');
  });

  it('registers live:event as an event channel', () => {
    expect(isIpcEventChannel('live:event')).toBe(true);
    expect(IPC_EVENT_CHANNELS).toContain('live:event');
  });

  it('registers live:dumpDiagnostics as an invoke channel', () => {
    expect(isIpcChannel('live:dumpDiagnostics')).toBe(true);
    expect(IPC_CHANNELS).toContain('live:dumpDiagnostics');
  });

  it('keeps the pre-existing channels the live seam does not retire', () => {
    expect(isIpcChannel('consent:get')).toBe(true);
    expect(isIpcChannel('consent:accept')).toBe(true);
    expect(isIpcChannel('consent:decline')).toBe(true);
    expect(isIpcChannel('consent:revoke')).toBe(true);
  });
});

describe('LIVE_DISPLAY_REFRESH_MS', () => {
  it('is the one constant both the main process and the renderer pace the fast channel to', () => {
    expect(LIVE_DISPLAY_REFRESH_MS).toBe(250);
  });
});

describe('energyDisplayPercent — one definition of what a visible change is', () => {
  it('floors rather than rounds, so only a hero at exactly full energy reads 100%', () => {
    expect(energyDisplayPercent(1)).toBe(100);
    expect(energyDisplayPercent(0.996)).toBe(99);
    expect(energyDisplayPercent(0.999999)).toBe(99);
  });

  it('prints every exact hundredth as itself — flooring a binary float loses 29, 57 and 58', () => {
    for (let percent = 0; percent <= 100; percent += 1) {
      expect(energyDisplayPercent(percent / 100)).toBe(percent);
    }
  });

  it('clamps outside [0, 1] rather than reporting a percentage the bar cannot draw', () => {
    expect(energyDisplayPercent(-0.5)).toBe(0);
    expect(energyDisplayPercent(2)).toBe(100);
  });

  it('collapses a run of raw wire readings that all draw the same bar', () => {
    // Four consecutive readings off the live tap, drifting in the 15th decimal place.
    const drifting = [0.28425594587099745, 0.2838965614344286, 0.283776766622239, 0.28365697181004934];
    expect(new Set(drifting).size).toBe(4);
    expect(new Set(drifting.map(energyDisplayPercent)).size).toBe(1);
    expect(energyDisplayPercent(drifting[0] as number)).toBe(28);
  });
});

describe('LiveEvent — the fastUpdate variant', () => {
  it('carries field, recovery, per-hero energy, the live on-field id set, earnings, the map, and damage, and nothing else', () => {
    const event: LiveEvent = {
      type: 'fastUpdate',
      field: [],
      recovery: [],
      energies: [],
      onFieldHeroIds: [],
      earnings: null,
      map: null,
      damage: null,
    };
    expect(Object.keys(event).sort()).toEqual(['damage', 'earnings', 'energies', 'field', 'map', 'onFieldHeroIds', 'recovery', 'type']);
  });
});

describe('UNATTRIBUTED_REASONS', () => {
  it('lists every reason exactly once', () => {
    const everyReason: Exclude<UnattributedReason, (typeof UNATTRIBUTED_REASONS)[number]> extends never ? true : never = true;
    expect(everyReason).toBe(true);
    expect(new Set(UNATTRIBUTED_REASONS).size).toBe(UNATTRIBUTED_REASONS.length);
    expect([...UNATTRIBUTED_REASONS].sort()).toEqual([
      'explosionWithoutBomb',
      'explosionlessWithoutFantasma',
      'noHitOnLootCell',
      'noOwnerAtBirth',
      'sharedOrUnattributedKill',
      'streamDiscontinuity',
      'unresolvedOverlap',
    ]);
  });
});

describe('sameLiveDamage', () => {
  const REASONS: readonly UnattributedReason[] = [
    'noOwnerAtBirth',
    'explosionWithoutBomb',
    'streamDiscontinuity',
    'unresolvedOverlap',
    'explosionlessWithoutFantasma',
    'sharedOrUnattributedKill',
    'noHitOnLootCell',
  ];

  const damage = (overrides: Partial<LiveDamage> = {}): LiveDamage => ({
    teamDps10: 120,
    teamDpsSession: 100,
    coverageSeconds: 300,
    sessionSeconds: 900,
    heroes: [
      { heroId: 'a', dps: 80, damage: 800, props: 4, gold: 400, onField: true },
      { heroId: 'b', dps: null, damage: 100, props: 1, gold: 50, onField: false },
    ],
    unattributed: { damage: 50, props: 2, gold: 90, dps: 0.05 },
    unattributedReasons: Object.fromEntries(REASONS.map((reason) => [reason, { damage: 0, props: 0, gold: 0 }])) as LiveDamage['unattributedReasons'],
    team: { damage: 950, props: 7, gold: 540 },
    ...overrides,
  });

  const withRow = (index: number, change: Partial<LiveDamageHeroRow>): LiveDamage => {
    const base = damage();
    return damage({ heroes: base.heroes.map((row, at) => (at === index ? { ...row, ...change } : row)) });
  };

  it('treats two absent slices as equal', () => {
    expect(sameLiveDamage(null, null)).toBe(true);
  });

  it('treats an absent slice and a present one as different, either way round', () => {
    expect(sameLiveDamage(null, damage())).toBe(false);
    expect(sameLiveDamage(damage(), null)).toBe(false);
  });

  it('treats equal content in distinct objects as equal', () => {
    expect(sameLiveDamage(damage(), damage())).toBe(true);
  });

  it.each([
    ['teamDps10', damage({ teamDps10: 121 })],
    ['teamDps10 going absent', damage({ teamDps10: null })],
    ['teamDpsSession', damage({ teamDpsSession: 101 })],
    ['teamDpsSession going absent', damage({ teamDpsSession: null })],
    ['coverageSeconds', damage({ coverageSeconds: 301 })],
    ['sessionSeconds', damage({ sessionSeconds: 901 })],
    ['team damage', damage({ team: { damage: 951, props: 7, gold: 540 } })],
    ['team props', damage({ team: { damage: 950, props: 8, gold: 540 } })],
    ['team gold', damage({ team: { damage: 950, props: 7, gold: 541 } })],
    ['unattributed going absent', damage({ unattributed: null })],
    ['unattributed damage', damage({ unattributed: { damage: 51, props: 2, gold: 90, dps: 0.05 } })],
    ['unattributed props', damage({ unattributed: { damage: 50, props: 3, gold: 90, dps: 0.05 } })],
    ['unattributed gold', damage({ unattributed: { damage: 50, props: 2, gold: 91, dps: 0.05 } })],
    ['unattributed dps', damage({ unattributed: { damage: 50, props: 2, gold: 90, dps: 0.06 } })],
    ['unattributed dps going absent', damage({ unattributed: { damage: 50, props: 2, gold: 90, dps: null } })],
    ['a hero id', withRow(0, { heroId: 'z' })],
    ['a hero dps', withRow(0, { dps: 81 })],
    ['a hero dps going absent', withRow(0, { dps: null })],
    ['a hero dps appearing', withRow(1, { dps: 5 })],
    ['a hero damage', withRow(1, { damage: 101 })],
    ['a hero props', withRow(1, { props: 2 })],
    ['a hero gold', withRow(1, { gold: 51 })],
    ['a hero onField flag', withRow(1, { onField: true })],
    ['hero order', damage({ heroes: [...damage().heroes].reverse() })],
    ['a hero row removed', damage({ heroes: damage().heroes.slice(0, 1) })],
    ['a hero row added', damage({ heroes: [...damage().heroes, { heroId: 'c', dps: 1, damage: 1, props: 0, gold: 0, onField: true }] })],
  ])('reports a difference in %s', (_field, changed) => {
    expect(sameLiveDamage(damage(), changed)).toBe(false);
    expect(sameLiveDamage(changed, damage())).toBe(false);
  });

  it.each(REASONS.flatMap((reason) => (['damage', 'props', 'gold'] as const).map((amount) => [reason, amount] as const)))(
    'reports a difference in the %s %s amount',
    (reason, amount) => {
      const base = damage();
      const changed = damage({
        unattributedReasons: { ...base.unattributedReasons, [reason]: { damage: 0, props: 0, gold: 0, [amount]: 1 } },
      });
      expect(sameLiveDamage(base, changed)).toBe(false);
    },
  );

  it('reports a reason missing from one side', () => {
    const { noHitOnLootCell: _dropped, ...rest } = damage().unattributedReasons;
    expect(sameLiveDamage(damage(), damage({ unattributedReasons: rest as LiveDamage['unattributedReasons'] }))).toBe(false);
  });
});

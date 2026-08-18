import { describe, expect, it } from 'vitest';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { STRINGS } from '@/shared/i18n';
import {
  dropItems,
  economyItems,
  jaulaChestOdds,
  jaulaItems,
  mapFactItems,
} from '@/features/phases/model/phase-fact-items';

// Account-486, phase-51/60 live-tooltip witness (also pinned in
// `packages/domain/tests/phase-intel-486-witness.test.ts` at the domain layer) — reused here to
// pin the UI-facing row builders' labels/ids/values against the same numbers.
const PHASE_NON_GATE = 51;
const PHASE_GATE = 60;
const XP_MULT = 1.56;
const LUCK_FRACTION = 0.1723005;

describe('phase-fact-items', () => {
  const t = STRINGS.pt;
  const fmt = (n: number, d = 0) => n.toFixed(d);

  it('mapFactItems returns the frozen nine row ids', () => {
    const intel = computePhaseIntelGlobal(1, { teamCoinPct: 0 })!;
    const items = mapFactItems(intel, t, fmt, 'pt');
    expect(items.map((row) => row.id)).toEqual([
      'mapName',
      'stone',
      'mit',
      'props',
      'avgHp',
      'mapHp',
      'boss',
      'gateTimer',
      'gateKey',
    ]);
  });

  it('economyItems returns the frozen nine row ids', () => {
    const intel = computePhaseIntelGlobal(1, { teamCoinPct: 0 })!;
    const items = economyItems(intel, t, fmt);
    expect(items.map((row) => row.id)).toEqual([
      'drops',
      'xpWiki',
      'xpActual',
      'goldWiki',
      'goldActual',
      'avgGoldWiki',
      'avgGoldActual',
      'mapGoldWiki',
      'mapGoldActual',
    ]);
  });

  it('jaulaItems returns the frozen four row ids', () => {
    const intel = computePhaseIntelGlobal(1, { teamCoinPct: 0 })!;
    const items = jaulaItems(intel, t, fmt, 'pt');
    expect(items.map((row) => row.id)).toEqual(['early', 'window', 'hp', 'chest']);
  });

  it('jaulaChestOdds returns em dash when all probabilities are zero', () => {
    expect(jaulaChestOdds([0, 0, 0], fmt, 'pt')).toBe('—');
  });

  it('economyItems XP pair matches the account-486 live-tooltip witness (xp_mult 1.56)', () => {
    const nonGate = computePhaseIntelGlobal(PHASE_NON_GATE, { xpMult: XP_MULT })!;
    const nonGateItems = economyItems(nonGate, t, fmt);
    expect(nonGateItems.find((row) => row.id === 'xpWiki')!.value).toBe('167');
    expect(nonGateItems.find((row) => row.id === 'xpActual')!.value).toBe('261');

    const gate = computePhaseIntelGlobal(PHASE_GATE, { xpMult: XP_MULT })!;
    const gateItems = economyItems(gate, t, fmt);
    expect(gateItems.find((row) => row.id === 'xpWiki')!.value).toBe('194');
    expect(gateItems.find((row) => row.id === 'xpActual')!.value).toBe('303');
  });

  it('economyItems XP pair is unchanged when xpMult is absent (defaults to 1)', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, {})!;
    const items = economyItems(intel, t, fmt);
    expect(items.find((row) => row.id === 'xpWiki')!.value).toBe(
      items.find((row) => row.id === 'xpActual')!.value,
    );
  });
});

describe('dropItems', () => {
  const t = STRINGS.pt;
  const fmt = (n: number, d = 0) => n.toFixed(d);

  it('phase 51 (non-gate): only chest and key rows are emitted, wiki/yours matching the witness', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    expect(items.map((row) => row.id)).toEqual(['chestWiki', 'chestActual', 'keyWiki', 'keyActual']);
    expect(items.find((row) => row.id === 'chestActual')!.value).toBe('0.117%');
  });

  it('phase 60 (gate): chest, time, gem, stone rows are emitted (no key), wiki/yours matching the witness', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    expect(items.map((row) => row.id)).toEqual([
      'chestWiki',
      'chestActual',
      'timeWiki',
      'timeActual',
      'gemWiki',
      'gemActual',
      'stoneWiki',
      'stoneActual',
    ]);
    expect(items.find((row) => row.id === 'chestActual')!.value).toBe('0.117%');
    expect(items.find((row) => row.id === 'timeActual')!.value).toBe('0.176%');
    expect(items.find((row) => row.id === 'gemActual')!.value).toBe('0.006%');
    expect(items.find((row) => row.id === 'stoneActual')!.value).toBe('0.006%');
  });

  it('three-decimal precision keeps gem and stone distinguishable from a coarser rounding', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    // At two decimals both would read "0.01%" — three decimals is what the witness requires.
    expect(items.find((row) => row.id === 'gemActual')!.value).not.toBe('0.01%');
  });

  it('every "yours" row carries the luck/gate explainer tip', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    for (const row of items.filter((r) => r.id.endsWith('Actual'))) {
      expect(row.tip).toBe(t.phasesDropActualHint);
    }
  });
});

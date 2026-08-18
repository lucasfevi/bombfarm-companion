/**
 * The account-486, phase-51/60 live-tooltip witness for `computePhaseIntelGlobal`'s XP and
 * drop-chance boosts.
 *
 * The account's `skills.totals` carries `xp_mult: 1.56` and, with two specific heroes on field,
 * an average final `luck` of `0.1723005`. In-game tooltips at two phases were compared against
 * the app's Economy panel and the wiki bundle's own per-phase values; both comparisons are held
 * out of band, not in this repo. The numbers pinned below are exactly what those tooltips showed:
 *
 *  - XP per prop: wiki 167 (phase 51, non-gate) / 194 (phase 60, gate); game showed 261 / 303.
 *    `167 * 1.56 = 260.52 -> round 261` and `194 * 1.56 = 302.64 -> round 303` — the boosted term
 *    is `xpPerPropWiki * xp_mult`, the same shape gold already used for `coin_add`.
 *  - Drop chances: with the two on-field heroes' luck averaging 0.1723005, the tooltip showed
 *    "0,117%" (item/hero chest), "0,176%" (time chest), and "0,006%" (gem chest, stone chest) —
 *    each base fraction times `(1 + 0.1723005)`. Phase 51 is non-gate (only chest + key show in
 *    the live tooltip; time/gem/stone do not apply); phase 60 is gate (chest + time + gem + stone
 *    show; key does not apply).
 */
import { describe, expect, it } from 'vitest';
import { computePhaseIntelGlobal, type DropChanceRow } from '@bombfarm/domain/phase-intel';

const PHASE_NON_GATE = 51;
const PHASE_GATE = 60;
const XP_MULT = 1.56;
const LUCK_FRACTION = 0.1723005;

/** Percent, rounded to 3 decimals — the precision the in-game tooltip displays. */
function pct3(fraction: number): string {
  return (fraction * 100).toFixed(3);
}

function findRow(rows: DropChanceRow[], id: DropChanceRow['id']): DropChanceRow {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`no dropChances row for "${id}"`);
  return row;
}

describe('phase-intel — account-486 XP witness (phase 51 / 60, xp_mult 1.56)', () => {
  it('phase 51 (non-gate): xpPerPropActual rounds to 261, matching the live tooltip', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, { xpMult: XP_MULT })!;
    expect(intel.xpPerPropWiki).toBe(167);
    expect(Math.round(intel.xpPerPropActual)).toBe(261);
    // The deprecated alias must still read the unboosted wiki value.
    expect(intel.xpPerProp).toBe(intel.xpPerPropWiki);
  });

  it('phase 60 (gate): xpPerPropActual rounds to 303, matching the live tooltip', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { xpMult: XP_MULT })!;
    expect(intel.xpPerPropWiki).toBe(194);
    expect(Math.round(intel.xpPerPropActual)).toBe(303);
  });

  it('xpMult defaults to 1 (no boost) when omitted', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, {})!;
    expect(intel.xpPerPropActual).toBe(intel.xpPerPropWiki);
  });
});

describe('phase-intel — account-486 drop-chance witness (phase 51 / 60, luck 0.1723005)', () => {
  it('phase 51 (non-gate): chest actual rounds to 0.117%; time/gem/stone do not apply', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, { luckFraction: LUCK_FRACTION })!;
    expect(intel.gate).toBe(false);

    const chest = findRow(intel.dropChances, 'chest');
    expect(pct3(chest.actual)).toBe('0.117');
    expect(chest.applies).toBe(true);

    const key = findRow(intel.dropChances, 'key');
    expect(key.applies).toBe(true);

    for (const id of ['time', 'gem', 'stone'] as const) {
      const row = findRow(intel.dropChances, id);
      expect(row.applies).toBe(false);
    }
  });

  it('phase 60 (gate): time rounds to 0.176%, gem/stone round to 0.006%; key does not apply', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction: LUCK_FRACTION })!;
    expect(intel.gate).toBe(true);

    const chest = findRow(intel.dropChances, 'chest');
    expect(pct3(chest.actual)).toBe('0.117');
    expect(chest.applies).toBe(true);

    const time = findRow(intel.dropChances, 'time');
    expect(pct3(time.actual)).toBe('0.176');
    expect(time.applies).toBe(true);

    const gem = findRow(intel.dropChances, 'gem');
    expect(pct3(gem.actual)).toBe('0.006');
    expect(gem.applies).toBe(true);

    const stone = findRow(intel.dropChances, 'stone');
    expect(pct3(stone.actual)).toBe('0.006');
    expect(stone.applies).toBe(true);

    const key = findRow(intel.dropChances, 'key');
    expect(key.applies).toBe(false);
  });

  it('dropChances is always emitted in the stable order chest, key, time, gem, stone', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, { luckFraction: LUCK_FRACTION })!;
    expect(intel.dropChances.map((row) => row.id)).toEqual(['chest', 'key', 'time', 'gem', 'stone']);
  });

  it('luckFraction defaults to 0 (no boost) when omitted — actual === wiki', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, {})!;
    for (const row of intel.dropChances) {
      expect(row.actual).toBe(row.wiki);
    }
  });
});

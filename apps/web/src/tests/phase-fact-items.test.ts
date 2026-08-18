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

/**
 * A merged row's value is a two-line node — boosted total, then the wiki base and the boost that
 * produced it — or a bare string when nothing boosts it. These read the two lines back out so the
 * witness numbers below stay asserted as NUMBERS, rather than degrading to "the node exists".
 */
function flatText(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatText).join('');
  if (typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    return flatText((node as { props: { children?: unknown } }).props.children);
  }
  return '';
}

function lines(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  const kids = (value as { props?: { children?: unknown } })?.props?.children;
  return (Array.isArray(kids) ? kids : [kids]).map(flatText);
}

/** The boosted total — the figure the row leads with. */
const total = (value: unknown) => lines(value)[0] ?? '';
/** The "base +N% source" subtext, or `null` on an unboosted row that prints no second line. */
const subtext = (value: unknown) => lines(value)[1] ?? null;

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

  it('economyItems returns the frozen five row ids, one per figure', () => {
    const intel = computePhaseIntelGlobal(1, { teamCoinPct: 0 })!;
    const items = economyItems(intel, t, fmt);
    // Was nine: each of xp/gold/avgGold/mapGold used to print a wiki row and a yours row.
    expect(items.map((row) => row.id)).toEqual(['drops', 'xp', 'gold', 'avgGold', 'mapGold']);
  });

  it('marks the three gold rows with the coin, and leaves XP unmarked', () => {
    const intel = computePhaseIntelGlobal(1, { teamCoinPct: 0 })!;
    const items = economyItems(intel, t, fmt);
    const withIcon = items.filter((row) => row.icon != null).map((row) => row.id);
    expect(withIcon).toEqual(['gold', 'avgGold', 'mapGold']);
  });

  it('jaulaItems returns the frozen four row ids', () => {
    const intel = computePhaseIntelGlobal(1, { teamCoinPct: 0 })!;
    const items = jaulaItems(intel, t, fmt, 'pt');
    expect(items.map((row) => row.id)).toEqual(['early', 'window', 'hp', 'chest']);
  });

  it('jaulaChestOdds returns em dash when all probabilities are zero', () => {
    expect(jaulaChestOdds([0, 0, 0], fmt, 'pt')).toBe('—');
  });

  it('economyItems XP row matches the account-486 live-tooltip witness (xp_mult 1.56)', () => {
    const nonGate = computePhaseIntelGlobal(PHASE_NON_GATE, { xpMult: XP_MULT })!;
    const xp = economyItems(nonGate, t, fmt).find((row) => row.id === 'xp')!.value;
    // Same two numbers the wiki/yours pair used to print, now one leading the row and one in
    // its subtext — 167 x 1.56 -> 261, matching the in-game tooltip.
    expect(total(xp)).toBe('261');
    expect(subtext(xp)).toBe('167 +56% mult. XP');

    const gate = computePhaseIntelGlobal(PHASE_GATE, { xpMult: XP_MULT })!;
    const gateXp = economyItems(gate, t, fmt).find((row) => row.id === 'xp')!.value;
    expect(total(gateXp)).toBe('303');
    expect(subtext(gateXp)).toBe('194 +56% mult. XP');
  });

  it('economyItems XP row drops the subtext entirely when xpMult is absent (defaults to 1)', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, {})!;
    const xp = economyItems(intel, t, fmt).find((row) => row.id === 'xp')!.value;
    // Unboosted the row is the bare wiki figure: a "167 +0% mult. XP" subtext would restate the
    // total and imply a boost that is not there.
    expect(xp).toBe('167');
    expect(subtext(xp)).toBeNull();
  });
});

describe('dropItems', () => {
  const t = STRINGS.pt;
  const fmt = (n: number, d = 0) => n.toFixed(d);

  it('phase 51 (non-gate): one chest row and one key row, totals matching the witness', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    // Was four rows: every drop printed a wiki row and a yours row.
    expect(items.map((row) => row.id)).toEqual(['chest', 'key']);
    expect(total(items[0].value)).toBe('0.117%');
    expect(subtext(items[0].value)).toBe('0.100% +17% sorte');
  });

  it('phase 60 (gate): chest, time, gem, stone rows (no key), totals matching the witness', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    expect(items.map((row) => row.id)).toEqual(['chest', 'time', 'gem', 'stone']);
    const byId = (id: string) => items.find((row) => row.id === id)!.value;
    expect(total(byId('chest'))).toBe('0.117%');
    expect(total(byId('time'))).toBe('0.176%');
    expect(total(byId('gem'))).toBe('0.006%');
    expect(total(byId('stone'))).toBe('0.006%');
    // The base each total was boosted from stays on the row, so the pair's second number is
    // still readable without re-deriving it from the luck multiplier.
    expect(subtext(byId('time'))).toBe('0.150% +17% sorte');
  });

  it('three-decimal precision keeps gem and stone distinguishable from a coarser rounding', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    // At two decimals both would read "0.01%" — three decimals is what the witness requires.
    expect(total(items.find((row) => row.id === 'gem')!.value)).not.toBe('0.01%');
  });

  it('drops the subtext when no squad luck is applied', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, {})!;
    const chest = dropItems(intel, t, fmt).find((row) => row.id === 'chest')!.value;
    expect(chest).toBe('0.100%');
    expect(subtext(chest)).toBeNull();
  });

  it('every row carries the luck/gate explainer tip', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    // Non-vacuity: this assertion used to select rows by an `id.endsWith('Actual')` filter, which
    // the merge left matching nothing — the loop kept passing while checking zero rows.
    expect(items.length, 'gate-phase drop rows').toBe(4);
    for (const row of items) {
      expect(row.tip, `tip on ${row.id}`).toBe(t.phasesDropActualHint);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { STRINGS } from '@/shared/i18n';
import { TipLabel } from '@bombfarm/ui/stat-list-tip-label';
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
 *
 * The subtext line's text now lives on `TipLabel`'s `label` prop rather than plain `children` —
 * the tooltip trigger moved from the row's label onto this line (see `boostedValue` in
 * `phase-fact-items.tsx`), and `TipLabel` takes its visible text as `label`, not `children`. A
 * `TipLabel` element is special-cased here for that reason; everything else still descends via
 * `props.children` as before.
 */
function flatText(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flatText).join('');
  if (typeof node === 'object' && 'type' in (node as Record<string, unknown>)) {
    const el = node as { type: unknown; props: { children?: unknown; label?: unknown } };
    if (el.type === TipLabel) return flatText(el.props.label);
    return flatText(el.props.children);
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
/** The "base + N% + M%" subtext, or `null` on an unboosted row that prints no second line. */
const subtext = (value: unknown) => lines(value)[1] ?? null;

/**
 * Walks a row's `value` node to find the `TipLabel` wrapping the subtext (see `boostedValue` in
 * `phase-fact-items.tsx`) and returns its `tip` prop, or `null` when the row has no subtext (an
 * unboosted row prints a bare string total with nothing to hover). These are still unrendered
 * React elements — `.type`/`.props` reads the element tree directly, no testing-library render.
 */
function subtextTip(value: unknown): string | null {
  if (value == null || typeof value !== 'object') return null;
  const el = value as { type?: unknown; props?: { tip?: unknown; children?: unknown } };
  if (el.type === TipLabel) return typeof el.props?.tip === 'string' ? el.props.tip : null;
  const kids = el.props?.children;
  if (Array.isArray(kids)) {
    for (const kid of kids) {
      const found = subtextTip(kid);
      if (found != null) return found;
    }
    return null;
  }
  return subtextTip(kids);
}

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
    // its subtext — 167 x 1.56 -> 261, matching the in-game tooltip. XP has only one contributing
    // source in this model (the skill tree's xp_mult — no squad share), so the subtext is a
    // single term, and the trailing source word ("mult. XP") is gone: the explanation moved to
    // the tooltip on this same subtext (see the "tooltip lives on the subtext" test below).
    expect(total(xp)).toBe('261');
    expect(subtext(xp)).toBe('167 + 56%');
    expect(subtextTip(xp)).toBe(t.phasesXpActualHint);

    const gate = computePhaseIntelGlobal(PHASE_GATE, { xpMult: XP_MULT })!;
    const gateXp = economyItems(gate, t, fmt).find((row) => row.id === 'xp')!.value;
    expect(total(gateXp)).toBe('303');
    expect(subtext(gateXp)).toBe('194 + 56%');
  });

  it('economyItems XP row label carries no tooltip — it moved to the subtext', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, { xpMult: XP_MULT })!;
    const xp = economyItems(intel, t, fmt).find((row) => row.id === 'xp')!;
    expect(xp.tip).toBeUndefined();
  });

  it('economyItems gold rows explain the same skill-tree math via the subtext tooltip', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, { teamCoinPct: 40 })!;
    const items = economyItems(intel, t, fmt);
    for (const id of ['gold', 'avgGold', 'mapGold'] as const) {
      const row = items.find((r) => r.id === id)!;
      expect(row.tip, `label tip on ${id}`).toBeUndefined();
      expect(subtextTip(row.value), `subtext tip on ${id}`).toBe(t.phasesGoldActualHint);
    }
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

  it('phase 51 (non-gate): all five rows, chest and key live, the gate-only three dashed and dimmed', () => {
    const intel = computePhaseIntelGlobal(PHASE_NON_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    // Was two rows: the panel used to skip whichever drops do not apply on this phase.
    expect(items.map((row) => row.id)).toEqual(['chest', 'key', 'time', 'gem', 'stone']);
    expect(total(items[0].value)).toBe('0.117%');
    // `intel` here only carries the COMBINED `luckFraction` (no `treeLuckFlatPct`/`squadLuckPct`
    // split — the live-tooltip witness measured the two on-field heroes' average, not a
    // tree/squad breakdown), so `dropBoostTerms` falls back to one combined term. See the
    // "decomposes into base + skill tree + squad" test below for the split case.
    expect(subtext(items[0].value)).toBe('0.100% + 17%');
    expect(items[0].muted, 'chest applies on every phase').toBeFalsy();
    expect(items[1].muted, 'key applies on non-gate phases').toBeFalsy();

    const byId = (id: string) => items.find((row) => row.id === id)!;
    for (const id of ['time', 'gem', 'stone'] as const) {
      const row = byId(id);
      expect(row.muted, `${id} is gate-only`).toBe(true);
      expect(total(row.value), `${id} value`).toBe('—');
      expect(subtext(row.value), `${id} note`).toBe(t.phasesDropGateOnly);
    }
  });

  it('phase 60 (gate): all five rows, chest/time/gem/stone live, key dashed and dimmed', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    expect(items.map((row) => row.id)).toEqual(['chest', 'key', 'time', 'gem', 'stone']);
    const byId = (id: string) => items.find((row) => row.id === id)!;
    expect(total(byId('chest').value)).toBe('0.117%');
    expect(total(byId('time').value)).toBe('0.117%');
    expect(total(byId('gem').value)).toBe('0.006%');
    // Three decimals still separate every rare-chest row: the 2026-08-23 patch raised the stone
    // chest tenfold, so it prints 0.059% where the gem chest stays at 0.006%.
    expect(total(byId('stone').value)).toBe('0.059%');
    // The base each total was boosted from stays on the row, so the pair's second number is
    // still readable without re-deriving it from the luck multiplier.
    expect(subtext(byId('time').value)).toBe('0.100% + 17%');
    expect(subtext(byId('stone').value)).toBe('0.050% + 17%');
    for (const id of ['chest', 'time', 'gem', 'stone'] as const) {
      expect(byId(id).muted, `${id} applies on a gate phase`).toBeFalsy();
    }

    const key = byId('key');
    expect(key.muted, 'key is non-gate-only').toBe(true);
    expect(total(key.value)).toBe('—');
    expect(subtext(key.value)).toBe(t.phasesDropNonGateOnly);
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

  it('every applicable row explains its boost via a tooltip on the subtext, not the label', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction: LUCK_FRACTION })!;
    const items = dropItems(intel, t, fmt);
    const applicable = items.filter((row) => !row.muted);
    // Non-vacuity: this assertion used to select rows by an `id.endsWith('Actual')` filter, which
    // the merge left matching nothing — the loop kept passing while checking zero rows. The panel
    // now always emits five rows, one of which (`key`) is gate-phase-inapplicable, so the count
    // pinned here is four, not `items.length`.
    expect(applicable.length, 'applicable gate-phase drop rows').toBe(4);
    for (const row of applicable) {
      expect(row.tip, `label tip on ${row.id}`).toBeUndefined();
      expect(subtextTip(row.value), `subtext tip on ${row.id}`).toBe(t.phasesDropActualHint);
    }

    const key = items.find((row) => row.id === 'key')!;
    expect(key.muted, 'key does not apply on a gate phase').toBe(true);
    expect(subtextTip(key.value), 'the dashed key row carries no boost tooltip').toBeNull();
  });

  it('decomposes into base + skill tree luck + squad luck, in that order, when intel carries the split', () => {
    // `luckFraction` is the SUM of the two components — that is what `phases-explorer.tsx`
    // guarantees by construction (see its own comment), so this mirrors a real caller rather
    // than inventing an inconsistent split.
    const intel = computePhaseIntelGlobal(PHASE_GATE, {
      luckFraction: 0.25,
      treeLuckFlatPct: 20,
      squadLuckPct: 5,
    })!;
    const chest = dropItems(intel, t, fmt).find((row) => row.id === 'chest')!.value;
    expect(subtext(chest)).toBe('0.100% + 20% + 5%');
  });

  it('shows only the squad term when the skill tree contributes nothing, and vice versa', () => {
    const squadOnly = computePhaseIntelGlobal(PHASE_GATE, {
      luckFraction: 0.05,
      treeLuckFlatPct: 0,
      squadLuckPct: 5,
    })!;
    expect(
      subtext(dropItems(squadOnly, t, fmt).find((row) => row.id === 'chest')!.value),
    ).toBe('0.100% + 5%');

    const treeOnly = computePhaseIntelGlobal(PHASE_GATE, {
      luckFraction: 0.2,
      treeLuckFlatPct: 20,
      squadLuckPct: 0,
    })!;
    expect(
      subtext(dropItems(treeOnly, t, fmt).find((row) => row.id === 'chest')!.value),
    ).toBe('0.100% + 20%');
  });
});

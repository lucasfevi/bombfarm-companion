import { describe, expect, it } from 'vitest';
import { FORGE_MAX } from '@bombfarm/domain/forge';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import {
  BLANK,
  forgeButtonReason,
  forgeLabels,
  forgeLevel,
  forgeMinForgeText,
  forgeReasonText,
  forgeStatRows,
} from './forge-labels';

const ROWS = [
  {
    id: 'g1',
    def_id: 'steel_luva',
    category: 0,
    set: 'steel',
    rarity: 2,
    level: 20,
    upgrade: 12,
    power: 41.6,
    equipped_on: 'h1',
    stats: [
      { stat: 0, value: 55, effective: 107.8 },
      { stat: 5, value: 0.4, effective: 0.784 },
    ],
  },
  { id: 'g2', def_id: 'steel_elmo', category: 0, set: 'steel', rarity: 4, level: 20, upgrade: 0, power: 12, in_stash: true },
  { id: 'g3', def_id: 'steel_bota', category: 0, set: 'steel', rarity: 0, level: 20, upgrade: 8, power: 9 },
];

function item(id: string): InventoryViewItem {
  const found = buildInventoryView(ROWS).items.find((entry) => entry.id === id);
  if (!found) throw new Error(`no test row ${id}`);
  return found;
}

describe('forgeButtonReason', () => {
  it('ranks the reasons: maxed, then no server, then the switch, then the release', () => {
    expect(forgeButtonReason({ upgrade: FORGE_MAX, accountSource: 'fixture', forgeWritesEnabled: false })).toBe('maxed');
    expect(forgeButtonReason({ upgrade: 12, accountSource: 'fixture', forgeWritesEnabled: true })).toBe('fixture');
    expect(forgeButtonReason({ upgrade: 12, accountSource: 'server', forgeWritesEnabled: false })).toBe('switch-off');
    expect(forgeButtonReason({ upgrade: 12, accountSource: 'server', forgeWritesEnabled: true })).toBe('not-yet');
  });

  it('treats an environment not yet answered as a server, so the switch line still shows', () => {
    expect(forgeButtonReason({ upgrade: 12, accountSource: null, forgeWritesEnabled: false })).toBe('switch-off');
  });

  it('names the Settings switch by the same copy the Settings screen prints', () => {
    expect(forgeReasonText('switch-off', en)).toContain(en.settingsForgeWritesLabel);
    expect(forgeReasonText('switch-off', ptBR)).toContain(ptBR.settingsForgeWritesLabel);
    expect(forgeReasonText('maxed', en)).toBe('Already at +15 — nothing left to forge');
    expect(forgeReasonText('fixture', en)).toBe('No server to forge on');
  });
});

describe('forgeMinForgeText', () => {
  it('reads the floor the way the brief spells it', () => {
    expect(forgeMinForgeText(0, en)).toBe('Any forge');
    expect(forgeMinForgeText(1, en)).toBe('+1 and up');
    expect(forgeMinForgeText(12, en)).toBe('+12 and up');
    expect(forgeMinForgeText(15, en)).toBe('+15 only');
  });
});

describe('forgeStatRows', () => {
  it('scales every roll by the ratio of the two multipliers and prints the change signed', () => {
    const rows = forgeStatRows(item('g1').stats, 12, 13, 'en', 'en');
    expect(rows.map((row) => row.now)).toEqual(['107.8', '78.40%']);
    // 107.8 × 2.04 / 1.96 = 112.2
    expect(rows[0]?.target).toBe('112.2');
    expect(rows[0]?.change).toBe('+4.4');
    expect(rows[0]?.direction).toBe('up');
    expect(rows[1]?.change).toBe('+3.20%');
  });

  it('prints no change as a dash', () => {
    const rows = forgeStatRows(item('g1').stats, 12, 12, 'en', 'en');
    expect(rows.map((row) => row.change)).toEqual([BLANK, BLANK]);
    expect(rows.map((row) => row.direction)).toEqual(['none', 'none']);
  });

  it('follows the locale for separators', () => {
    const rows = forgeStatRows(item('g1').stats, 12, 13, 'pt', 'pt-BR');
    expect(rows[0]?.target).toBe('112,2');
    expect(rows[1]?.now).toBe('78,40%');
  });
});

describe('forgeLabels', () => {
  const labels = forgeLabels(en, 'en', 'en');

  it('names the piece the way the Inventory screen does', () => {
    expect(labels.itemName(item('g1'))).toBe('Steel · Gloves');
    expect(labels.itemMeta(item('g1'))).toBe('Rare · Gloves · nv20 · +12');
  });

  it('says where the piece is', () => {
    expect(labels.whereabouts(item('g1'), 'Kendo')).toBe('Power 42 · worn by Kendo');
    expect(labels.whereabouts(item('g2'), null)).toBe('Power 12 · in the stash');
    expect(labels.whereabouts(item('g3'), null)).toBe('Power 9 · in the bag');
  });

  it('builds the buys tooltip from the delta, the next rung\'s cost and its chance', () => {
    // (120 + 8 × 20 + 100 × 2) × 14² ÷ 4 — the wiki's own cost for a level-20 rare piece at +13.
    expect(labels.buysTip(item('g1'), 0.031)).toBe('+3.1% DPS · 23,520 gold for +13 (40%)');
  });

  it('describes the span and the warning by the target', () => {
    expect(labels.span(8)).toBe('safe span — every step lands');
    expect(labels.span(13)).toBe('risky span — 40% at the top');
    expect(labels.warning(13, 1.2)).toBe(
      'A failed roll at +9…+14 drops the piece back to +8 and the gold is charged either way.',
    );
    expect(labels.warning(15, 2.34)).toBe(
      '+15 is the only rung that wipes the piece to +0. Expect to rebuild from the safe floor about 2.3 times on the way.',
    );
  });

  it('prints the factor line with both multipliers', () => {
    expect(labels.statsNote(11, 13)).toBe(
      'Every roll scales by the same factor — ×2.04 at +13 against ×1.88 now — so this is what the piece becomes if the climb lands, not an average of where it might stop.',
    );
  });

  it('formats the figures the facts print', () => {
    expect(labels.gold(127595)).toBe('127,595');
    expect(labels.rolls(2.5)).toBe('2.5');
    expect(labels.chance(0.5)).toBe('50%');
    expect(labels.gain(0.031)).toBe('+3.1%');
    expect(labels.multiplier(13)).toBe('2.04');
    expect(forgeLevel(0)).toBe('+0');
  });
});

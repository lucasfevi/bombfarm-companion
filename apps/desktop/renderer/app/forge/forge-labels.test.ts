import { describe, expect, it } from 'vitest';
import { FORGE_MAX } from '@bombfarm/domain/forge';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import type { AccountReadRefusal, ForgeRunResult } from '@bombfarm/contracts';
import { FORGE_BANDS } from '../../lib/forge/forge-rows';
import {
  BLANK,
  forgeBandText,
  forgeButtonReason,
  forgeLabels,
  forgeLevel,
  forgeReasonText,
  forgeRefreshRefusalText,
  forgeResultHeading,
  forgeRungLabel,
  forgeStartRefusalText,
  forgeSpendVerdict,
  forgeSpendVerdictText,
  forgeStatRows,
  forgeStopText,
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

const IDLE = { running: false, cancelRequested: false };

describe('forgeButtonReason', () => {
  it('ranks the reasons: a run in flight, then maxed, then no server, then the switch, then ready', () => {
    expect(forgeButtonReason({ upgrade: FORGE_MAX, accountSource: 'fixture', forgeWritesEnabled: false, running: true, cancelRequested: false })).toBe('running');
    expect(forgeButtonReason({ upgrade: FORGE_MAX, accountSource: 'fixture', forgeWritesEnabled: false, ...IDLE })).toBe('maxed');
    expect(forgeButtonReason({ upgrade: 12, accountSource: 'fixture', forgeWritesEnabled: true, ...IDLE })).toBe('fixture');
    expect(forgeButtonReason({ upgrade: 12, accountSource: 'server', forgeWritesEnabled: false, ...IDLE })).toBe('switch-off');
    expect(forgeButtonReason({ upgrade: 12, accountSource: 'server', forgeWritesEnabled: true, ...IDLE })).toBe('ready');
  });

  it('says the cancel landed once it has been asked for, and only while a run is in flight', () => {
    expect(forgeButtonReason({ upgrade: 12, accountSource: 'server', forgeWritesEnabled: true, running: true, cancelRequested: true })).toBe('cancelling');
    expect(forgeButtonReason({ upgrade: 12, accountSource: 'server', forgeWritesEnabled: true, running: false, cancelRequested: true })).toBe('ready');
  });

  it('treats an environment not yet answered as a server, so the switch line still shows', () => {
    expect(forgeButtonReason({ upgrade: 12, accountSource: null, forgeWritesEnabled: false, ...IDLE })).toBe('switch-off');
  });

  it('names the Settings switch by the same copy the Settings screen prints', () => {
    expect(forgeReasonText('switch-off', en)).toContain(en.settingsForgeWritesLabel);
    expect(forgeReasonText('switch-off', ptBR)).toContain(ptBR.settingsForgeWritesLabel);
    expect(forgeReasonText('maxed', en)).toBe('Already at +15 — nothing left to forge');
    expect(forgeReasonText('fixture', en)).toBe('No server to forge on');
    expect(forgeReasonText('ready', en)).toBe(en.forgeReasonReady);
    expect(forgeReasonText('running', en)).toBe(en.forgeReasonRunning);
    expect(forgeReasonText('cancelling', en)).toBe(en.forgeReasonCancelling);
    expect(forgeReasonText('cancelling', ptBR)).toBe(ptBR.forgeReasonCancelling);
  });
});

describe('forgeStartRefusalText', () => {
  it('says what main could not do, reusing the fixture and switch lines where they already say it', () => {
    expect(forgeStartRefusalText('offline', en)).toBe(en.forgeReasonFixture);
    expect(forgeStartRefusalText('writes_disabled', en)).toContain(en.settingsForgeWritesLabel);
    expect(forgeStartRefusalText('busy', en)).toBe(en.forgeStartBusy);
    expect(forgeStartRefusalText('not_consented', en)).toBe(en.forgeStartNotConsented);
    expect(forgeStartRefusalText('game_not_running', en)).toBe(en.forgeStartGameNotRunning);
    expect(forgeStartRefusalText('token_unavailable', en)).toBe(en.forgeStartTokenUnavailable);
    expect(forgeStartRefusalText('unknown_item', en)).toBe(en.forgeStartUnknownItem);
    expect(forgeStartRefusalText('bad_target', en)).toBe(en.forgeStartBadTarget);
    expect(forgeStartRefusalText('unavailable', en)).toBe(en.forgeStartUnavailable);
  });
});

describe('forgeRefreshRefusalText', () => {
  const REASONS: AccountReadRefusal[] = [
    'rate_limited',
    'offline',
    'not_consented',
    'game_not_running',
    'token_unavailable',
    'unavailable',
  ];

  it('has words for every reason a read can be refused, in both locales', () => {
    for (const reason of REASONS) {
      expect(forgeRefreshRefusalText(reason, en).length, `en is silent about ${reason}`).toBeGreaterThan(0);
      expect(forgeRefreshRefusalText(reason, ptBR).length, `pt-BR is silent about ${reason}`).toBeGreaterThan(0);
      expect(forgeRefreshRefusalText(reason, ptBR)).not.toBe(forgeRefreshRefusalText(reason, en));
    }
  });

  it('tells the floor apart from the four reasons a read cannot happen at all', () => {
    expect(forgeRefreshRefusalText('rate_limited', en)).toBe(en.forgeRefreshRecent);
    expect(forgeRefreshRefusalText('offline', en)).toBe(en.forgeRefreshFixture);
    expect(forgeRefreshRefusalText('not_consented', en)).toBe(en.forgeRefreshNotConsented);
    expect(forgeRefreshRefusalText('game_not_running', en)).toBe(en.forgeRefreshGameNotRunning);
    expect(forgeRefreshRefusalText('token_unavailable', en)).toBe(en.forgeStartTokenUnavailable);
    expect(forgeRefreshRefusalText('unavailable', en)).toBe(en.forgeStartUnavailable);
  });

  it('says the floor in plain words rather than however many milliseconds are left on it', () => {
    expect(forgeRefreshRefusalText('rate_limited', en)).not.toMatch(/\d/);
    expect(forgeRefreshRefusalText('rate_limited', ptBR)).not.toMatch(/\d/);
  });
});

function result(overrides: Partial<ForgeRunResult>): ForgeRunResult {
  return {
    itemId: 'g1',
    from: 8,
    to: 12,
    target: 12,
    stop: 'target',
    reached: true,
    rolls: 7,
    fails: 1,
    crits: 0,
    safeJumps: 0,
    spent: 100,
    walletAfter: null,
    durationMs: 1000,
    ...overrides,
  };
}

describe('forgeResultHeading', () => {
  it('reads every stop in the player\'s terms, tinted by whose decision it was', () => {
    expect(forgeResultHeading(result({}), en)).toEqual({ text: 'Reached +12', tone: 'up' });
    expect(forgeResultHeading(result({ stop: 'cancelled', to: 11, rolls: 14 }), en)).toEqual({
      text: 'Stopped at +11 — cancelled after roll 14',
      tone: 'warn',
    });
    expect(forgeResultHeading(result({ stop: 'shortfall', to: 9 }), en)).toEqual({ text: 'Out of gold at +9', tone: 'down' });
    expect(forgeResultHeading(result({ stop: 'budget' }), en)).toEqual({ text: 'Stopped by the gold budget at +12', tone: 'warn' });
    expect(forgeResultHeading(result({ stop: 'attempts' }), en)).toEqual({ text: 'Stopped by the attempt limit at +12', tone: 'warn' });
    expect(forgeResultHeading(result({ stop: 'cooldown' }), en)).toEqual({ text: 'Server cooldown at +12', tone: 'down' });
    expect(forgeResultHeading(result({ stop: 'missing' }), en)).toEqual({ text: 'Server refused the item', tone: 'down' });
    expect(forgeResultHeading(result({ stop: 'error', to: 8 }), en)).toEqual({ text: 'Stopped by an error at +8', tone: 'down' });
    expect(forgeResultHeading(result({}), ptBR).text).toBe('Chegou a +12');
  });
});

describe('forgeStopText', () => {
  it('names every stop in a word or two, leaving the rung to the ledger\'s own climb column', () => {
    expect(forgeStopText('target', en)).toBe('Reached');
    expect(forgeStopText('cancelled', en)).toBe('Cancelled');
    expect(forgeStopText('shortfall', en)).toBe('Out of gold');
    expect(forgeStopText('budget', en)).toBe('Gold budget');
    expect(forgeStopText('attempts', en)).toBe('Attempt limit');
    expect(forgeStopText('cooldown', en)).toBe('Server cooldown');
    expect(forgeStopText('missing', en)).toBe('Item refused');
    expect(forgeStopText('error', en)).toBe('Error');
    expect(forgeStopText('target', ptBR)).toBe('Chegou');
  });
});

describe('forgeRungLabel', () => {
  it('spans a merged row and stands alone otherwise', () => {
    expect(forgeRungLabel({ from: 9, to: 11 })).toBe('+9…+11');
    expect(forgeRungLabel({ from: 12, to: 12 })).toBe('+12');
  });
});

describe('forgeBandText', () => {
  it('names a single rung as itself, a closed band by both ends, and the top band by where it starts', () => {
    expect(forgeBandText(null, en)).toBe('Any forge');
    expect(forgeBandText('at0', en)).toBe('+0 only');
    expect(forgeBandText('at8', en)).toBe('+8 only');
    expect(forgeBandText('8to10', en)).toBe('+8 to +10');
    expect(forgeBandText('10to12', en)).toBe('+10 to +12');
    expect(forgeBandText('12to14', en)).toBe('+12 to +14');
    expect(forgeBandText('from14', en)).toBe('+14 and higher');
    expect(forgeBandText('8to10', ptBR)).toBe('De +8 a +10');
    expect(forgeBandText('from14', ptBR)).toBe('+14 ou mais');
  });

  it('has stopped reading as a ceiling in either language', () => {
    for (const band of [null, ...FORGE_BANDS]) {
      expect(forgeBandText(band, en)).not.toContain('up to');
      expect(forgeBandText(band, ptBR)).not.toContain('até');
    }
  });
});

describe('forgeSpendVerdict', () => {
  const forecast = { gold: 1_000, badRunGold: 2_000 };

  it('reads under the expected figure as a gain, over it as a warning, and past the bad run as a loss', () => {
    expect(forgeSpendVerdict(400, forecast)).toBe('under');
    expect(forgeSpendVerdict(990, forecast)).toBe('under');
    expect(forgeSpendVerdict(1_010, forecast)).toBe('over');
    expect(forgeSpendVerdict(2_000, forecast)).toBe('over');
    expect(forgeSpendVerdict(2_001, forecast)).toBe('worse');
  });

  it('calls a spend the printed percentage cannot tell apart from the plan neither under nor over', () => {
    expect(forgeSpendVerdict(996, forecast)).toBe('exact');
    expect(forgeSpendVerdict(1_004, forecast)).toBe('exact');
  });

  it('picks a side again the moment the percentage prints a digit, at half a percent either way', () => {
    expect(forgeSpendVerdict(995, forecast)).toBe('under');
    expect(forgeSpendVerdict(1_005, forecast)).toBe('over');
  });

  it('is reachable against a forecast no whole spend can equal', () => {
    const measured = { gold: 486_379.99999993795, badRunGold: 1_327_900 };
    expect(forgeSpendVerdict(486_380, measured)).toBe('exact');
    expect(forgeSpendVerdict(488_000, measured)).toBe('exact');
    expect(forgeSpendVerdict(489_000, measured)).toBe('over');
  });

  it('says exact for exactly the spends whose percentage the result block would print as a zero', () => {
    const printed = forgeLabels(en, 'en', 'en').signedPercent;
    for (let spent = 900; spent <= 1_100; spent += 1) {
      const gap = printed((spent - forecast.gold) / forecast.gold);
      expect([forgeSpendVerdict(spent, forecast) === 'exact', spent]).toEqual([
        gap === '+0%' || gap === '−0%',
        spent,
      ]);
    }
  });

  it('says all four outcomes in both languages, and never the same words for two of them', () => {
    for (const words of [en, ptBR]) {
      const said = (['exact', 'under', 'over', 'worse'] as const).map((verdict) =>
        forgeSpendVerdictText(verdict, words),
      );
      expect(new Set(said).size).toBe(said.length);
      for (const phrase of said) expect(phrase.length).toBeGreaterThan(0);
    }
  });
});

describe('the difference against the plan', () => {
  it('prints a whole signed percent, with a real minus sign, in both languages', () => {
    const english = forgeLabels(en, 'en', 'en');
    const portuguese = forgeLabels(ptBR, 'pt', 'pt-BR');
    expect(english.signedPercent(0.234)).toBe('+23%');
    expect(english.signedPercent(-0.121)).toBe('−12%');
    expect(english.signedPercent(0)).toBe('+0%');
    expect(portuguese.signedPercent(-0.5)).toBe('−50%');
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

  it('identifies the piece the way the Inventory screen does', () => {
    expect(labels.itemName(item('g1'))).toBe('Steel · Gloves');
    expect(labels.itemRarity(item('g1'))).toBe('Rare');
    expect(labels.itemLevel(item('g1'))).toBe('Lv 20');
    expect(labels.itemForge(item('g1'))).toBe('+12');
    expect(labels.itemForge(item('g2'))).toBe('');
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
    expect(labels.multiplier(13)).toBe('2.04');
    expect(forgeLevel(0)).toBe('+0');
  });
});

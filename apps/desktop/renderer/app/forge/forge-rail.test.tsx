import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EMPTY_FORGE_HISTORY, type ForgeHistoryResult, type ForgeHistoryRow, type ForgeStepEvent } from '@bombfarm/contracts';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { forgeRunReducer, IDLE_FORGE_RUN, type ForgeRunState } from '../../lib/forge/forge-run-reducer';
import { forgeLabels } from './forge-labels';
import { ForgeLedger } from './forge-ledger';
import { ForgePlanPanel } from './forge-plan-panel';
import { ForgeRail, forgeRailState } from './forge-rail';

const labels = forgeLabels(en, 'en', 'en');

function step(attempt: number, from: number, to: number, outcome: ForgeStepEvent['outcome'] = 'success'): ForgeStepEvent {
  return { runId: 'r1', itemId: 'g1', attempt, kind: 'roll', target: outcome === 'fail' ? from + 1 : to, from, to, outcome, cost: 100, spent: 100 * attempt, wallet: 5_000 };
}

function running(): ForgeRunState {
  let state = forgeRunReducer(IDLE_FORGE_RUN, {
    kind: 'start',
    runId: 'r1',
    itemId: 'g1',
    target: 12,
    from: 8,
    plan: { forecast: { rolls: 6.5, safeJumps: 0, gold: 650, badRunGold: 1_200 } },
  });
  const path: [number, number, ForgeStepEvent['outcome']][] = [
    [8, 9, 'success'],
    [9, 10, 'success'],
    [10, 11, 'success'],
    [11, 8, 'fail'],
    [8, 9, 'success'],
    [9, 10, 'success'],
    [10, 11, 'success'],
    [11, 12, 'success'],
  ];
  path.forEach(([from, to, outcome], index) => {
    state = forgeRunReducer(state, { kind: 'step', event: step(index + 1, from, to, outcome), adopt: null });
  });
  return state;
}

function finished(): ForgeRunState {
  return forgeRunReducer(running(), {
    kind: 'done',
    event: {
      runId: 'r1',
      result: { itemId: 'g1', from: 8, to: 12, target: 12, stop: 'target', reached: true, rolls: 8, fails: 1, crits: 0, safeJumps: 0, spent: 800, walletAfter: 5_000, durationMs: 12_000 },
    },
  });
}

function renderRail(run: ForgeRunState): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgeRail, {
        run,
        gold: labels.gold,
        labels,
        onCancel: () => {},
        onDone: () => {},
      }),
    }),
  );
}

function stateOf(html: string): string | undefined {
  return /data-testid="forge-rail" data-state="([a-z]+)"/.exec(html)?.[1];
}

function railCancelTag(html: string): string {
  return /<button[^>]*data-testid="forge-rail-cancel"[^>]*>/.exec(html)?.[0] ?? '';
}

describe('forgeRailState', () => {
  it('names the three states the rail can be in — a live run, a just-finished one, or nothing', () => {
    expect(forgeRailState(IDLE_FORGE_RUN)).toBe('collapsed');
    expect(forgeRailState({ status: 'dismissed' })).toBe('collapsed');
    expect(forgeRailState(running())).toBe('running');
    expect(forgeRailState(finished())).toBe('finished');
  });
});

describe('ForgeRail', () => {
  it('collapses to no height with no run to draw — the ledger is what reads between runs', () => {
    const html = renderRail(IDLE_FORGE_RUN);
    expect(stateOf(html)).toBe('collapsed');
    expect(html).toContain('height:0');
    expect(html).not.toContain('data-testid="forge-result"');
    expect(html).not.toContain('data-testid="forge-chart"');
  });

  it('running, shows the level against the target, the chart, the recent strip, the collapsed tally and the cancel', () => {
    const html = renderRail(running());
    expect(stateOf(html)).toBe('running');
    expect(html).toContain('data-testid="forge-rail-level"');
    expect(html).toMatch(/forge-rail-level[^>]*>\+12</);
    expect(html).toContain('8 rolls');
    expect(html).toContain('800 gold');
    expect(html).toContain('wallet 5,000');
    expect(html).toContain('data-testid="forge-chart"');
    expect((html.match(/data-testid="forge-recent"/g) ?? []).length).toBe(1);
    const rungs = [...html.matchAll(/data-testid="forge-tally-rung"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(rungs).toEqual(['+9…+11', '+12']);
    expect(html).toContain('Cancel after this roll');
    expect(railCancelTag(html)).not.toContain(' disabled=""');
  });

  it('says the cancel landed and stops taking presses once it has been asked for', () => {
    const html = renderRail(forgeRunReducer(running(), { kind: 'cancel' }));
    expect(html).toContain(en.forgeButtonCancelPending);
    expect(html).not.toContain('>Cancel after this roll<');
    expect(railCancelTag(html)).toContain(' disabled=""');
    expect(railCancelTag(html)).toContain('data-pending="true"');
  });

  it('finished, shows the result block with its heading, the plan bar and the done control, and no wallet-after fact', () => {
    const html = renderRail(finished());
    expect(stateOf(html)).toBe('finished');
    expect(html).toMatch(/forge-result-heading[^>]*>Reached \+12</);
    expect(html).toMatch(/forge-result-climb[^>]*>\+8 → \+12</);
    expect(html).toMatch(/forge-result-rolls[^>]*>8 · 1 · 0</);
    expect(html).toContain('spent 800');
    expect(html).toContain('expected 650');
    expect(html).toContain('a bad run 1,200');
    expect(html).toContain('data-testid="forge-done"');
    expect(html).not.toContain('data-testid="forge-result-wallet"');
    expect(html).not.toContain('data-testid="forge-bought"');
  });
});

function historyRow(overrides: Partial<ForgeHistoryRow> & { id: number }): ForgeHistoryRow {
  return {
    startedAt: '2026-09-05T10:00:00.000Z',
    finishedAt: new Date().toISOString(),
    accountId: 'a1',
    itemId: 'g1',
    defId: 'steel_luva',
    rarity: 2,
    slot: 2,
    itemLevel: 20,
    fromUpgrade: 8,
    toUpgrade: 12,
    target: 12,
    stop: 'target',
    reached: true,
    rolls: 8,
    fails: 1,
    crits: 0,
    safeJumps: 0,
    spent: 8_000,
    walletAfter: 214_054_630,
    durationMs: 14_000,
    ...overrides,
  };
}

const HISTORY: ForgeHistoryResult = {
  rows: [
    historyRow({ id: 2, finishedAt: '2026-09-05T12:00:00.000Z' }),
    historyRow({ id: 1, finishedAt: '2026-09-05T10:00:00.000Z', defId: 'steel_bota', stop: 'budget', toUpgrade: 10, spent: 2_400 }),
  ],
  totals: { runs: 2, spent: 10_400, rolls: 13, fails: 2 },
};

function renderLedger(history: ForgeHistoryResult, defaultOpen = true): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgeLedger, { history, labels, onClearHistory: () => {}, defaultOpen }),
    }),
  );
}

describe('ForgeLedger', () => {
  it('reads its two figures with the table shut, so the section is worth having closed', () => {
    const html = renderLedger(HISTORY, false);
    expect(html).toMatch(/forge-ledger-summary[^>]*>2 runs · 10,400 gold</);
    expect(html).toContain('Run ledger');
    expect(html).not.toContain('data-testid="forge-ledger-body"');
  });

  it('says so rather than drawing an empty table with no runs', () => {
    const html = renderLedger(EMPTY_FORGE_HISTORY);
    expect(html).toContain('data-state="empty"');
    expect(html).toContain('No runs yet');
    expect(html).not.toContain('data-testid="forge-ledger-body"');
  });

  it('names each piece from the run\'s own def id, prints the climb and the stop, and never a wallet column', () => {
    const html = renderLedger(HISTORY);
    expect(html).toContain('data-state="runs"');
    const names = [...html.matchAll(/data-testid="forge-ledger-item"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(names).toEqual(['Steel · Gloves', 'Steel · Boots']);
    const climbs = [...html.matchAll(/data-testid="forge-ledger-climb"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(climbs).toEqual(['+8 → +12', '+8 → +10']);
    const outcomes = [...html.matchAll(/data-testid="forge-ledger-outcome"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(outcomes).toEqual(['Reached', 'Gold budget']);
    expect(html).toMatch(/forge-ledger-totals[^>]*>2 runs · 10,400 gold · 13 rolls · 2 fails</);
    expect(html).not.toContain('Wallet after');
  });
});

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
    stats: [{ stat: 0, value: 55, effective: 107.8 }],
  },
];

function item(): InventoryViewItem {
  const found = buildInventoryView(ROWS).items[0];
  if (!found) throw new Error('no test row');
  return found;
}

function renderPanel(
  reason: 'ready' | 'running' | 'cancelling' | 'switch-off',
  startRefusal: 'busy' | null = null,
): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgePlanPanel, {
        item: item(),
        plan: { itemId: 'g1', target: 13, maxGold: null, attempts: null },
        forecast: null,
        walletGold: null,
        reason,
        startRefusal,
        labels,
        onStepTarget: () => {},
        onMaxGoldChange: () => {},
        onAttemptsChange: () => {},
        onForge: () => {},
        onCancel: () => {},
      }),
    }),
  );
}

function buttonTag(html: string): string {
  return /<button[^>]*data-testid="forge-button"[^>]*>/.exec(html)?.[0] ?? '';
}

describe('ForgePlanPanel — the button', () => {
  it('is enabled and reads the target when the run is ready to arm', () => {
    const html = renderPanel('ready');
    expect(html).toMatch(/data-testid="forge-button"[^>]*>Forge to \+13</);
    expect(buttonTag(html)).not.toContain(' disabled=""');
    expect(html).toContain(en.forgeReasonReady);
    expect(html).not.toMatch(/<fieldset disabled=""/);
  });

  it('becomes the cancel, and freezes the target and the limits, while a run is in flight', () => {
    const html = renderPanel('running');
    expect(html).toMatch(/data-testid="forge-button"[^>]*>Cancel after this roll</);
    expect(buttonTag(html)).not.toContain(' disabled=""');
    expect(html).toMatch(/<fieldset disabled=""[^>]*data-testid="forge-plan-controls"/);
    expect(html).toContain(en.forgeReasonRunning);
  });

  it('says the same thing as the rail once the cancel has been asked for, and takes no second press', () => {
    const html = renderPanel('cancelling');
    expect(html).toMatch(/data-testid="forge-button"[^>]*>Cancelling after this roll…</);
    expect(buttonTag(html)).toContain(' disabled=""');
    expect(html).toContain(en.forgeReasonCancelling);
    expect(html).toMatch(/<fieldset disabled=""[^>]*data-testid="forge-plan-controls"/);
  });

  it('stays disabled with the switch off, and prints main\'s refusal under the button when there is one', () => {
    expect(buttonTag(renderPanel('switch-off'))).toContain(' disabled=""');
    expect(renderPanel('ready', 'busy')).toContain(en.forgeStartBusy);
  });

  it('ends its facts at the wallet — nothing on this panel prints a DPS delta any more', () => {
    const html = renderPanel('ready');
    expect(html).toContain(en.forgeFactWallet);
    expect(html).not.toContain('data-testid="forge-fact-buys"');
  });
});

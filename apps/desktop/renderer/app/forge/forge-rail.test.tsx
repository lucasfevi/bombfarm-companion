import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ForgeStepEvent } from '@bombfarm/contracts';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { forgeRunReducer, IDLE_FORGE_RUN, type ForgeRunState } from '../../lib/forge/forge-run-reducer';
import { forgeLabels } from './forge-labels';
import { ForgePlanPanel } from './forge-plan-panel';
import { ForgeRail, forgeRailState, type ForgeRailIdle } from './forge-rail';

const labels = forgeLabels(en, 'en', 'en');
const NO_RUNS: ForgeRailIdle = { lastRun: null, totals: null };
const IDLE: ForgeRailIdle = {
  lastRun: { itemLabel: 'Steel · Gloves', fromUpgrade: 8, toUpgrade: 12, rolls: 8, fails: 1, spent: 800, at: new Date().toISOString() },
  totals: { runs: 3, spent: 2_400 },
};

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
    plan: { forecast: { rolls: 6.5, safeJumps: 0, gold: 650, badRunGold: 1_200 }, deltaToTarget: 0.04 },
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

function renderRail(run: ForgeRunState, idle: ForgeRailIdle): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgeRail, {
        idle,
        run,
        gold: labels.gold,
        labels,
        wearerName: 'Kendo',
        realisedDelta: 0.035,
        onCancel: () => {},
        onDone: () => {},
        onClearHistory: () => {},
      }),
    }),
  );
}

function stateOf(html: string): string | undefined {
  return /data-testid="forge-rail" data-state="([a-z]+)"/.exec(html)?.[1];
}

describe('forgeRailState', () => {
  it('names the four states the rail can be in', () => {
    expect(forgeRailState(IDLE_FORGE_RUN, NO_RUNS)).toBe('collapsed');
    expect(forgeRailState(IDLE_FORGE_RUN, IDLE)).toBe('idle');
    expect(forgeRailState({ status: 'dismissed' }, IDLE)).toBe('idle');
    expect(forgeRailState(running(), NO_RUNS)).toBe('running');
    expect(forgeRailState(finished(), IDLE)).toBe('finished');
  });
});

describe('ForgeRail', () => {
  it('collapses to no height with nothing to show', () => {
    const html = renderRail(IDLE_FORGE_RUN, NO_RUNS);
    expect(stateOf(html)).toBe('collapsed');
    expect(html).toContain('height:0');
    expect(html).not.toContain('forge-rail-last-run');
  });

  it('idle, prints the last run\'s line, the totals and the clear control', () => {
    const html = renderRail(IDLE_FORGE_RUN, IDLE);
    expect(stateOf(html)).toBe('idle');
    expect(html).toContain('Last run: Steel · Gloves +8 → +12 · 8 rolls, 1 fails · 800 gold · just now');
    expect(html).toContain('3 runs · 2,400 gold spent');
    expect(html).toContain('data-testid="forge-rail-clear"');
  });

  it('running, shows the level against the target, the chart, the recent strip, the collapsed tally and the cancel', () => {
    const html = renderRail(running(), NO_RUNS);
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
  });

  it('finished, shows the result block with its heading, the plan bar and the bought line, and the done control', () => {
    const html = renderRail(finished(), NO_RUNS);
    expect(stateOf(html)).toBe('finished');
    expect(html).toMatch(/forge-result-heading[^>]*>Reached \+12</);
    expect(html).toMatch(/forge-result-climb[^>]*>\+8 → \+12</);
    expect(html).toMatch(/forge-result-rolls[^>]*>8 · 1 · 0</);
    expect(html).toContain('spent 800');
    expect(html).toContain('expected 650');
    expect(html).toContain('a bad run 1,200');
    expect(html).toContain('+3.5% DPS for Kendo, against the +4.0% the plan promised');
    expect(html).toContain('+12 keeps its stats; the next roll for +13 is 40%');
    expect(html).toContain('data-testid="forge-done"');
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

function renderPanel(reason: 'ready' | 'running' | 'switch-off', startRefusal: 'busy' | null = null): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgePlanPanel, {
        item: item(),
        plan: { itemId: 'g1', target: 13, maxGold: null, attempts: null },
        forecast: null,
        wearerName: 'Kendo',
        deltaToTarget: null,
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

  it('stays disabled with the switch off, and prints main\'s refusal under the button when there is one', () => {
    expect(buttonTag(renderPanel('switch-off'))).toContain(' disabled=""');
    expect(renderPanel('ready', 'busy')).toContain(en.forgeStartBusy);
  });
});

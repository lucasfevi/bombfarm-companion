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

/** The run's plan expects 650 and calls 1,200 a bad run, so the spend picks the tone. */
function finished(spent = 800): ForgeRunState {
  return forgeRunReducer(running(), {
    kind: 'done',
    event: {
      runId: 'r1',
      result: { itemId: 'g1', from: 8, to: 12, target: 12, stop: 'target', reached: true, rolls: 8, fails: 1, crits: 0, safeJumps: 0, spent, walletAfter: 5_000, durationMs: 12_000 },
    },
  });
}

function gapTag(html: string): string {
  return /<span[^>]*data-testid="forge-against-gap"[^>]*>/.exec(html)?.[0] ?? '';
}

function verdictOf(html: string): string | undefined {
  return /data-testid="forge-against-plan"[^>]*data-verdict="([a-z]+)"/.exec(html)?.[1];
}

function gapOf(html: string): string | undefined {
  return /data-testid="forge-against-gap"[^>]*>([^<]+)</.exec(html)?.[1];
}

function verdictTextOf(html: string): string | undefined {
  return /data-testid="forge-against-verdict"[^>]*>([^<]+)</.exec(html)?.[1];
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

function ghostTag(html: string): string {
  return /<g[^>]*data-testid="forge-chart-ghost"[^>]*>/.exec(html)?.[0] ?? '';
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
    expect(html).not.toContain('data-testid="forge-climb"');
    expect(html).not.toContain('data-testid="forge-chart"');
  });

  it('running, shows the level against the target, the chart, the collapsed tally and the cancel', () => {
    const html = renderRail(running());
    expect(stateOf(html)).toBe('running');
    expect(html).toContain('data-testid="forge-rail-level"');
    expect(html).toMatch(/forge-rail-level[^>]*>\+12</);
    expect(html).toContain('8 rolls');
    expect(html).toMatch(/forge-rail-spent[^>]*>.*?800 gold/);
    expect(html).toContain('wallet 5,000');
    expect(html).toContain('data-testid="forge-chart"');
    expect(html).not.toContain('data-testid="forge-recent"');
    const rungs = [...html.matchAll(/data-testid="forge-tally-rung"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(rungs).toEqual(['+9…+11', '+12']);
    expect(html).toContain('Cancel after this roll');
    expect(railCancelTag(html)).not.toContain(' disabled=""');
  });

  it('says nothing in the header about the gap between rolls — the chart carries it now', () => {
    const html = renderRail(forgeRunReducer(running(), { kind: 'pause', event: { runId: 'r1', ms: 9_000 } }));
    expect(html).not.toContain('data-testid="forge-rail-pausing"');
    expect(html).not.toContain('pausing');
  });

  it('marks where the roll in flight will land, pulsing, and draws nothing there once it has landed', () => {
    expect(ghostTag(renderRail(running()))).toBe('');
    const html = renderRail(forgeRunReducer(running(), { kind: 'pause', event: { runId: 'r1', ms: 40 } }));
    expect(ghostTag(html)).toContain('motion-safe:animate-forge-ghost');
    expect(ghostTag(html)).toContain('text-accent');
    expect(ghostTag(html)).toContain('fill="none"');
    expect(html).toContain(`aria-label="${en.forgeMarkPending}"`);
  });

  it('marks the very first roll too, before the run has anything else to draw', () => {
    const started = forgeRunReducer(IDLE_FORGE_RUN, {
      kind: 'start',
      runId: 'r1',
      itemId: 'g1',
      target: 12,
      from: 8,
      plan: null,
    });
    const html = renderRail(forgeRunReducer(started, { kind: 'pause', event: { runId: 'r1', ms: 0 } }));
    expect(ghostTag(html)).toContain('motion-safe:animate-forge-ghost');
    expect(html).not.toContain('data-outcome=');
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
    expect(html).toMatch(/forge-result-spent[^>]*>.*?icon_gold\.png.*?>800</);
    expect(html).toMatch(/forge-against-expected[^>]*>expected .*?650/);
    expect(html).toMatch(/forge-against-bad-run[^>]*>a bad run .*?1,200/);
    expect(html).toContain('data-testid="forge-done"');
    expect(html).not.toContain('data-testid="forge-result-wallet"');
    expect(html).not.toContain('data-testid="forge-bought"');
  });

  it('keeps the climb and its rolls-by-rung tally under the finished result, drawn the same way the live run drew them', () => {
    const html = renderRail(finished());
    expect(html).toContain('data-testid="forge-climb"');
    expect(html).toContain('data-testid="forge-chart"');
    const rungs = [...html.matchAll(/data-testid="forge-tally-rung"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(rungs).toEqual(['+9…+11', '+12']);
    const fails = [...html.matchAll(/data-testid="forge-tally-fails"[^>]*>([^<]+)</g)].map((match) => match[1]);
    expect(fails).toEqual(['0', '1']);
  });

  it('breaks its two rows on the same edge — the plan over the chart, the facts over the tally', () => {
    const html = renderRail(finished());
    const columns = [...html.matchAll(/class="(grid gap-3 md:grid-cols-\[[^"]+)"/g)].map((match) => match[1]);
    expect(columns).toHaveLength(2);
    expect(columns[0]).toBe(columns[1]);
    expect(html.indexOf('data-testid="forge-against-plan"')).toBeLessThan(html.indexOf('<dl'));
    expect(html.indexOf('data-testid="forge-chart"')).toBeLessThan(html.indexOf('data-testid="forge-tally"'));
  });

  it('holds no roll open on the finished climb — the run is over, so nothing is still in flight', () => {
    const paused = forgeRunReducer(running(), { kind: 'pause', event: { runId: 'r1', ms: 9_000 } });
    expect(ghostTag(renderRail(paused))).toContain('motion-safe:animate-forge-ghost');
    const html = renderRail(
      forgeRunReducer(paused, {
        kind: 'done',
        event: {
          runId: 'r1',
          result: { itemId: 'g1', from: 8, to: 12, target: 12, stop: 'cancelled', reached: false, rolls: 8, fails: 1, crits: 0, safeJumps: 0, spent: 800, walletAfter: 5_000, durationMs: 12_000 },
        },
      }),
    );
    expect(html).toContain('data-testid="forge-chart"');
    expect(ghostTag(html)).toBe('');
  });

  it('reads the spend among the run\'s own facts, between the rolls and how long they took, and not under the plan\'s bar', () => {
    const html = renderRail(finished());
    expect(html).toMatch(/forge-result-spent[^>]*>.*?icon_gold\.png.*?>800</);
    expect(html).not.toContain('data-testid="forge-against-spent"');
    const labels = [...html.matchAll(/<dt>([^<]+)<\/dt>/g)].map((match) => match[1]);
    expect(labels).toEqual([en.forgeResultClimb, en.forgeResultRolls, en.forgeResultSpent, en.forgeResultDuration]);
    const figures = /data-testid="forge-against-figures"[^>]*>(.*?)<\/p>/s.exec(html)?.[1] ?? '';
    expect(figures).toContain(en.forgeAgainstExpected);
    expect(figures).toContain(en.forgeAgainstBadRun);
  });

  it('leads with the percentage, says what it means, and tints both by which of the plan\'s two figures the spend passed', () => {
    const under = renderRail(finished(520));
    expect(verdictOf(under)).toBe('under');
    expect(gapOf(under)).toBe('−20%');
    expect(verdictTextOf(under)).toBe(en.forgeAgainstUnder);
    expect(gapTag(under)).toContain('text-up');

    const over = renderRail(finished(800));
    expect(verdictOf(over)).toBe('over');
    expect(gapOf(over)).toBe('+23%');
    expect(verdictTextOf(over)).toBe(en.forgeAgainstOver);
    expect(gapTag(over)).toContain('text-warn');

    const past = renderRail(finished(1_950));
    expect(verdictOf(past)).toBe('worse');
    expect(gapOf(past)).toBe('+200%');
    expect(verdictTextOf(past)).toBe(en.forgeAgainstWorse);
    expect(gapTag(past)).toContain('text-down');
  });

  it('prints no percentage at all when the difference would round to a zero, on either side of the plan', () => {
    const short = renderRail(finished(648));
    expect(verdictOf(short)).toBe('exact');
    expect(short).not.toContain('data-testid="forge-against-gap"');
    expect(verdictTextOf(short)).toBe(en.forgeAgainstExact);

    const long = renderRail(finished(652));
    expect(verdictOf(long)).toBe('exact');
    expect(long).not.toContain('data-testid="forge-against-gap"');
    expect(verdictTextOf(long)).toBe(en.forgeAgainstExact);
  });

  it('still reads as an outcome for a run cut short after one cheap roll, where the percentage nears −100%', () => {
    const html = renderRail(finished(7));
    expect(verdictOf(html)).toBe('under');
    expect(gapOf(html)).toBe('−99%');
    expect(verdictTextOf(html)).toBe(en.forgeAgainstUnder);
  });

  it('has no plan to compare against for a run it did not start, and prints no difference', () => {
    const adopted = forgeRunReducer(
      forgeRunReducer(IDLE_FORGE_RUN, { kind: 'step', event: step(1, 8, 9), adopt: null }),
      {
        kind: 'done',
        event: {
          runId: 'r1',
          result: { itemId: 'g1', from: 8, to: 9, target: 9, stop: 'target', reached: true, rolls: 1, fails: 0, crits: 0, safeJumps: 0, spent: 100, walletAfter: 5_000, durationMs: 900 },
        },
      },
    );
    const html = renderRail(adopted);
    expect(html).toContain('data-state="none"');
    expect(html).not.toContain('data-testid="forge-against-gap"');
    expect(html).not.toContain('data-testid="forge-against-verdict"');
    // What the run cost is a fact about the run, so it still reads with no plan to compare to.
    expect(html).toMatch(/forge-result-spent[^>]*>.*?icon_gold\.png.*?>100</);
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
    expect(html).toMatch(/forge-ledger-summary"[^>]*>2 runs</);
    expect(html).toMatch(/forge-ledger-summary-gold[^>]*>.*?10,400 gold/);
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
    expect(html).toMatch(/forge-ledger-totals"[^>]*>2 runs · 13 rolls · 2 fails</);
    expect(html).toMatch(/forge-ledger-totals-gold[^>]*>.*?10,400 gold/);
    expect(html).not.toContain('Wallet after');
  });

  it('marks every gold figure with the coin and leaves the counts beside them bare', () => {
    const html = renderLedger(HISTORY);
    // One coin in each row's gold cell, one in the totals, one in the header summary — and
    // nowhere near the run, roll and fail counts standing beside them.
    const coins = [...html.matchAll(/<img [^>]*icon_gold\.png/g)].length;
    expect(coins).toBe(HISTORY.rows.length + 2);
    expect(html).toMatch(/forge-ledger-gold[^>]*>.*?icon_gold\.png/);
    expect(html).toMatch(/forge-ledger-totals"[^>]*>[^<]*<\/span>/);
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

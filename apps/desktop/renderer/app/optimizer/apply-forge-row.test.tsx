import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { ForgeAction } from '@bombfarm/domain/team-plan/types';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { EMPTY_FORGE_QUEUE, type ForgeQueueState } from '../../lib/forge/forge-queue-reducer';
import { planForgeQueueBatch } from '../../lib/forge/forge-queue-batch';
import type { StepRecord } from '../../lib/optimizer/apply-progress-reducer';
import { forgeLabels } from '../forge/forge-labels';
import { ApplyForgeRow, describeForgeRow } from './apply-forge-row';

function wrap(node: React.ReactNode): string {
  return renderToStaticMarkup(createElement(CopyProvider, { locale: 'en', children: node }));
}

/** The opening tag carrying this test id, order-independent over its attributes. */
function tagOf(html: string, testid: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`).exec(html)?.[0] ?? '';
}

function item(id: string, upgrade: number, level = 30): InventoryViewItem {
  return { id, upgrade, level, rarityIdx: 1, defId: `def-${id}` } as unknown as InventoryViewItem;
}

function action(itemId: string, to: number): ForgeAction {
  return { itemId, defId: `def-${itemId}`, from: 0, to };
}

const labels = forgeLabels(en, 'en', 'en');
const IDLE_RECORD: StepRecord = { status: 'idle' };

function renderRow(props: {
  forgeList: readonly ForgeAction[];
  queue?: ForgeQueueState;
  gear?: readonly InventoryViewItem[];
  gate?: null | { reason: string };
  record?: StepRecord | undefined;
}) {
  const onDone: (result: { made: number; skipped: number }) => void = () => undefined;
  return wrap(
    createElement(ApplyForgeRow, {
      forgeList: props.forgeList,
      planRunId: 'run-1',
      queue: props.queue ?? EMPTY_FORGE_QUEUE,
      gear: props.gear ?? [],
      labels,
      gate: props.gate ?? null,
      record: props.record ?? IDLE_RECORD,
      onDone,
    }),
  );
}

describe('describeForgeRow — pure state selection', () => {
  it('reads nothing when the plan forges no piece', () => {
    const batch = planForgeQueueBatch([], EMPTY_FORGE_QUEUE, new Map());
    expect(describeForgeRow(batch, IDLE_RECORD)).toEqual({ kind: 'nothing' });
  });

  it('reads ready when the batch has something to add', () => {
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 12 }], EMPTY_FORGE_QUEUE, new Map([['a', 8]]));
    expect(describeForgeRow(batch, IDLE_RECORD)).toEqual({ kind: 'ready' });
  });

  it('reads done from the record, by its own made count, once a run finished this plan', () => {
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 12 }], EMPTY_FORGE_QUEUE, new Map([['a', 8]]));
    const record: StepRecord = { status: 'done', made: 5, skipped: 1, total: 6, skips: [] };
    expect(describeForgeRow(batch, record)).toEqual({ kind: 'done', count: 5 });
  });

  it('reads done from the batch alone when nothing is left to add but pieces are already queued (A-7)', () => {
    const queue: ForgeQueueState = { ...EMPTY_FORGE_QUEUE, pieces: [{ itemId: 'a', target: 12 }] };
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 12 }], queue, new Map([['a', 8]]));
    expect(describeForgeRow(batch, IDLE_RECORD)).toEqual({ kind: 'done', count: 1 });
  });

  it('reads exhausted when every piece is left out and none is queued (A-8)', () => {
    const batch = planForgeQueueBatch([{ itemId: 'a', to: 12 }], EMPTY_FORGE_QUEUE, new Map([['a', 12]]));
    expect(describeForgeRow(batch, IDLE_RECORD)).toEqual({ kind: 'exhausted' });
  });
});

describe('ApplyForgeRow — nothing', () => {
  it('reads Nothing to do and carries no press when the plan forges nothing', () => {
    const html = renderRow({ forgeList: [] });
    expect(html).toContain(en.applyStepNothing);
    expect(html).not.toContain('data-testid="apply-step-forge-press"');
  });
});

describe('ApplyForgeRow — ready', () => {
  it('prints the facts line with pieces, already-queued and the priced gold, enabled', () => {
    const queue: ForgeQueueState = { ...EMPTY_FORGE_QUEUE, pieces: [{ itemId: 'q', target: 5 }] };
    const html = renderRow({
      forgeList: [action('a', 12), action('q', 5)],
      queue,
      gear: [item('a', 8), item('q', 3)],
    });
    expect(html).toContain('1 pieces');
    expect(html).toContain('1 already queued');
    expect(html).not.toContain('no estimate');
    expect(html).toContain('data-testid="apply-step-forge-press"');
    expect(tagOf(html, 'apply-step-forge-press')).not.toContain('disabled=""');
  });

  it('carries the targets-updated note when a piece already queued retargets', () => {
    const queue: ForgeQueueState = { ...EMPTY_FORGE_QUEUE, pieces: [{ itemId: 'a', target: 5 }] };
    const html = renderRow({ forgeList: [action('a', 12)], queue, gear: [item('a', 8)] });
    expect(html).toContain('data-testid="apply-step-forge-note"');
    expect(html).toContain(en.applyStepForgeTargets.replace('{count}', '1'));
  });

  it('carries the will-skip line, in a -skips span, naming a missing piece and one already at its target', () => {
    const html = renderRow({
      forgeList: [action('missing', 12), action('atTarget', 5), action('add', 12)],
      gear: [item('atTarget', 5), item('add', 8)],
    });
    expect(html).toContain('data-testid="apply-step-forge-skips"');
    expect(html).toContain('2 of 3 will be skipped');
    expect(html).toContain(en.applySkipItemMissing);
    expect(html).toContain(en.applySkipForgeAtTarget);
  });

  it('prints the no-estimate facts line when the piece to add cannot be forecast (its level is off the forge table)', () => {
    const html = renderRow({ forgeList: [action('a', 12)], gear: [item('a', 8, 999)] });
    expect(html).toContain('no estimate');
    expect(html).toContain('data-testid="apply-step-forge-press"');
  });

  it('is disabled with the panel-wide gate reason while its facts still print', () => {
    const html = renderRow({ forgeList: [action('a', 12)], gear: [item('a', 8)], gate: { reason: 'the account moved' } });
    expect(html).toContain('1 pieces');
    expect(html).toContain('the account moved');
    expect(tagOf(html, 'apply-step-forge-press')).toContain('disabled=""');
  });
});

describe('ApplyForgeRow — done', () => {
  it('reads Done with the record’s own made count once a run finished this plan', () => {
    const record: StepRecord = { status: 'done', made: 7, skipped: 2, total: 9, skips: [] };
    const html = renderRow({ forgeList: [action('a', 12)], gear: [item('a', 8)], record });
    expect(html).toContain(en.applyStepDoneForge.replace('{count}', '7'));
    expect(html).not.toContain('data-testid="apply-step-forge-press"');
  });

  it('reads as done when everything applicable is already queued and no press ever ran', () => {
    const queue: ForgeQueueState = { ...EMPTY_FORGE_QUEUE, pieces: [{ itemId: 'a', target: 12 }] };
    const html = renderRow({ forgeList: [action('a', 12)], queue, gear: [item('a', 8)] });
    expect(html).toContain(en.applyStepForgeAllQueued);
    expect(html).toContain('data-state="done"');
    expect(html).not.toContain('data-testid="apply-step-forge-press"');
  });
});

describe('ApplyForgeRow — exhausted', () => {
  it('reads Nothing left to apply when every piece is left out and none is queued (A-8)', () => {
    const html = renderRow({ forgeList: [action('a', 12)], gear: [item('a', 12)] });
    expect(html).toContain(en.applyStepNothingLeft);
    expect(html).not.toContain('data-testid="apply-step-forge-press"');
  });
});

describe('ApplyForgeRow — the confirm opens with the same N the row is about to add', () => {
  it('two addable pieces put "2 pieces" on the facts line — the same N the confirm receives as its count', () => {
    const html = renderRow({ forgeList: [action('a', 12), action('b', 12)], gear: [item('a', 8), item('b', 8)] });
    expect(html).toContain('2 pieces');
  });
});

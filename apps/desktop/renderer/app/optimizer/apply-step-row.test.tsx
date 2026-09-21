import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import type { StepFacts, StepGate } from '../../lib/optimizer/apply-panel-model';
import type { StepRecord } from '../../lib/optimizer/apply-progress-reducer';
import type { ApplyUnitLabel } from '../../lib/optimizer/apply-labels';
import { ApplyEquipRow, ApplyPointsRow, ApplyStepRow, type ApplyStepRowAction } from './apply-step-row';

function wrap(node: React.ReactNode): string {
  return renderToStaticMarkup(createElement(CopyProvider, { locale: 'en', children: node }));
}

/** The opening tag carrying this test id, order-independent over its attributes. */
function tagOf(html: string, testid: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`).exec(html)?.[0] ?? '';
}

const UNIT: ApplyUnitLabel = { index: 0, call: 'equip', subject: 'Crimson Weapon +5', from: null, to: 'Orin', points: null, gold: 0 };

function unitsFacts(overrides: Partial<Extract<StepFacts, { kind: 'units' }>> = {}): StepFacts {
  return {
    kind: 'units',
    units: [UNIT],
    pending: [0],
    done: [],
    skips: [],
    calls: 1,
    aboutMs: 2_500,
    gold: 0,
    heroes: 0,
    respecs: 0,
    ...overrides,
  };
}

const READY_GATE: StepGate = { enabled: true, notes: [] };
const IDLE_RECORD: StepRecord = { status: 'idle' };

describe('ApplyStepRow — the shared shell', () => {
  it('renders the press variant with its test ids and the disabled attribute', () => {
    const action: ApplyStepRowAction = { label: 'Equip', onPress: () => {}, disabled: true, reason: 'because' };
    const html = wrap(
      createElement(ApplyStepRow, { index: 1, title: 'Equip', facts: 'x calls', notes: ['a note'], action, testId: 'apply-step-equip' }),
    );
    expect(html).toContain('data-testid="apply-step-equip"');
    expect(html).toContain('data-testid="apply-step-equip-press"');
    expect(html).toContain('data-testid="apply-step-equip-facts"');
    expect(html).toContain('data-testid="apply-step-equip-note"');
    expect(html).toContain('data-testid="apply-step-equip-reason"');
    expect(tagOf(html, 'apply-step-equip-press')).toContain('disabled=""');
    expect(html).toContain('data-state="ready"');
  });

  it('renders the done variant under the -done test id', () => {
    const action: ApplyStepRowAction = { done: 'Done — 3 of 3 calls made, 0 skipped' };
    const html = wrap(createElement(ApplyStepRow, { index: 1, title: 'Equip', facts: 'x', action, testId: 'apply-step-equip' }));
    expect(html).toContain('data-testid="apply-step-equip-done"');
    expect(html).toContain('Done — 3 of 3 calls made, 0 skipped');
    expect(html).not.toContain('data-testid="apply-step-equip-press"');
  });

  it('renders the nothing variant under the -done test id, disabled by construction (no button at all)', () => {
    const action: ApplyStepRowAction = { nothing: 'Nothing to do' };
    const html = wrap(createElement(ApplyStepRow, { index: 1, title: 'Equip', facts: 'x', action, testId: 'apply-step-equip' }));
    expect(html).toContain('data-testid="apply-step-equip-done"');
    expect(html).toContain('Nothing to do');
    expect(html).not.toContain('<button');
  });
});

describe('ApplyEquipRow', () => {
  const t = en;

  it('is ready with its facts line when units are pending', () => {
    const html = wrap(
      createElement(ApplyEquipRow, {
        t,
        facts: unitsFacts(),
        gate: READY_GATE,
        record: IDLE_RECORD,
        otherStepTitle: null,
        onPress: () => {},
      }),
    );
    expect(html).toContain('1 calls');
    expect(html).toContain('data-testid="apply-step-equip-press"');
    expect(tagOf(html, 'apply-step-equip-press')).not.toContain('disabled=""');
  });

  it('prints the will-skip line, grouped and counted, when the preflight finds conflicts', () => {
    const facts = unitsFacts({ skips: [{ index: 0, reason: 'itemMoved' }, { index: 1, reason: 'itemMoved' }] });
    const html = wrap(createElement(ApplyEquipRow, { t, facts, gate: READY_GATE, record: IDLE_RECORD, otherStepTitle: null, onPress: () => {} }));
    expect(html).toContain('2 of 1 will be skipped');
    expect(html).toContain(en.applySkipItemMoved);
  });

  it('carries the pauses-queue note when the queue is running', () => {
    const gate: StepGate = { enabled: true, notes: ['pausesQueue'] };
    const html = wrap(createElement(ApplyEquipRow, { t, facts: unitsFacts(), gate, record: IDLE_RECORD, otherStepTitle: null, onPress: () => {} }));
    expect(html).toContain(en.applyStepPausesQueue);
  });

  it('reads Nothing to do, disabled, when the plan has no unit for this step', () => {
    const gate: StepGate = { enabled: false, reason: 'nothing' };
    const html = wrap(
      createElement(ApplyEquipRow, { t, facts: { kind: 'nothing' }, gate, record: IDLE_RECORD, otherStepTitle: null, onPress: () => {} }),
    );
    expect(html).toContain(en.applyStepNothing);
    expect(html).not.toContain('data-testid="apply-step-equip-press"');
  });

  it('reads Done, disabled, when every unit is already done', () => {
    const facts = unitsFacts({ pending: [], done: [0] });
    const gate: StepGate = { enabled: false, reason: 'allDone' };
    const html = wrap(createElement(ApplyEquipRow, { t, facts, gate, record: IDLE_RECORD, otherStepTitle: null, onPress: () => {} }));
    expect(html).toContain('Done — 1 of 1 calls made, 0 skipped');
    expect(html).not.toContain('data-testid="apply-step-equip-press"');
  });

  it('reads Nothing left to apply, disabled, when nothing is pending but not everything is done', () => {
    const gate: StepGate = { enabled: false, reason: 'nothingLeft' };
    const html = wrap(createElement(ApplyEquipRow, { t, facts: unitsFacts({ pending: [] }), gate, record: IDLE_RECORD, otherStepTitle: null, onPress: () => {} }));
    expect(html).toContain(en.applyStepNothingLeft);
  });

  it('names the switch when disabled by the writes switch', () => {
    const gate: StepGate = { enabled: false, reason: 'switchOff' };
    const html = wrap(createElement(ApplyEquipRow, { t, facts: unitsFacts(), gate, record: IDLE_RECORD, otherStepTitle: null, onPress: () => {} }));
    expect(html).toContain(en.settingsForgeWritesLabel);
    expect(tagOf(html, 'apply-step-equip-press')).toContain('disabled=""');
  });

  it('is disabled without a reason of its own when a change breaks the plan — the panel says so once, over everything', () => {
    const gate: StepGate = { enabled: false, reason: 'stale' };
    const html = wrap(createElement(ApplyEquipRow, { t, facts: unitsFacts(), gate, record: IDLE_RECORD, otherStepTitle: null, onPress: () => {} }));
    expect(tagOf(html, 'apply-step-equip-press')).toContain('disabled=""');
    expect(html).not.toContain('data-testid="apply-step-equip-reason"');
  });

  it('names the other step running, disabled', () => {
    const gate: StepGate = { enabled: false, reason: 'otherRunning' };
    const html = wrap(
      createElement(ApplyEquipRow, { t, facts: unitsFacts(), gate, record: IDLE_RECORD, otherStepTitle: en.applyStepPointsTitle, onPress: () => {} }),
    );
    expect(html).toContain(en.applyStepPointsTitle);
  });

  it('reads Running…, with no press, while this row is the one running', () => {
    const gate: StepGate = { enabled: false, reason: 'running' };
    const html = wrap(
      createElement(ApplyEquipRow, { t, facts: unitsFacts(), gate, record: { status: 'running' }, otherStepTitle: null, onPress: () => {} }),
    );
    expect(html).toContain(en.applyStepRunning);
    expect(html).not.toContain('data-testid="apply-step-equip-press"');
  });

  it('reads as done once the run finished — the run’s own counts as its facts, no press, a reveal only when something was skipped', () => {
    const record: StepRecord = { status: 'done', made: 3, skipped: 1, total: 4, skips: [{ index: 0, reason: 'heroLevel' }] };
    const html = wrap(createElement(ApplyEquipRow, { t, facts: unitsFacts(), gate: READY_GATE, record, otherStepTitle: null, onPress: () => {} }));
    expect(tagOf(html, 'apply-step-equip')).toContain('data-state="done"');
    expect(html).toContain('Done — 3 of 4 calls made, 1 skipped');
    expect(html).toContain(en.applyStepDoneLabel);
    expect(html).toContain(en.applyStepShowSkips);
    expect(html).not.toContain('data-testid="apply-step-equip-press"');

    const clean: StepRecord = { status: 'done', made: 4, skipped: 0, total: 4, skips: [] };
    const cleanHtml = wrap(createElement(ApplyEquipRow, { t, facts: unitsFacts(), gate: READY_GATE, record: clean, otherStepTitle: null, onPress: () => {} }));
    expect(cleanHtml).not.toContain(en.applyStepShowSkips);
  });

  it('reads Stopped with a Run again press once the run stopped short', () => {
    const record: StepRecord = { status: 'stopped', reason: { kind: 'run', stop: 'stopped' }, made: 1, skipped: 0, total: 4, skips: [] };
    const html = wrap(createElement(ApplyEquipRow, { t, facts: unitsFacts(), gate: READY_GATE, record, otherStepTitle: null, onPress: () => {} }));
    expect(html).toContain(en.applyStopStopped);
    expect(html).toContain(en.applyStepRunAgain);
  });
});

describe('ApplyPointsRow — the wallet-short line', () => {
  const t = en;

  it('names the hero the live wallet cannot cover, with needed and on-hand', () => {
    const facts = unitsFacts({ heroes: 1, respecs: 1, calls: 2, gold: 500 });
    const html = wrap(
      createElement(ApplyPointsRow, {
        t,
        facts,
        gate: READY_GATE,
        record: IDLE_RECORD,
        otherStepTitle: null,
        onPress: () => {},
        walletShort: [{ heroId: 'h1', name: 'Bram', needed: 500, onHand: 100 }],
      }),
    );
    expect(html).toContain('Bram');
    expect(html).toContain('500');
    expect(html).toContain('100');
  });
});

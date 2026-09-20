import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import type { ApplyModalState } from '../../lib/optimizer/apply-progress-reducer';
import { beginRun } from '../../lib/optimizer/apply-run-reducer';
import type { ApplyUnitLabel } from '../../lib/optimizer/apply-labels';
import { ApplyModalBody, applyModalTitle } from './apply-modal';

/** `renderToStaticMarkup` HTML-escapes both quote kinds in text: "can't" -> "can&#x27;t" —
 *  `consent-modal.test.tsx`'s own reasoning. */
function asRenderedText(text: string): string {
  return text.replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
}

const UNITS: readonly ApplyUnitLabel[] = [
  { index: 0, call: 'equip', subject: 'Crimson Weapon +5', from: null, to: 'Orin', points: null, gold: 0 },
  { index: 1, call: 'unequip', subject: 'Old Blade +2', from: 'Bram', to: null, points: null, gold: 0 },
];

function render(modal: ApplyModalState, overrides: { nowMs?: number; queuePaused?: boolean; hasNext?: boolean } = {}): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ApplyModalBody, {
        modal,
        queuePaused: overrides.queuePaused ?? false,
        onStop: () => {},
        onClose: () => {},
        onContinue: () => {},
        hasNext: overrides.hasNext ?? false,
        nowMs: overrides.nowMs ?? 1_000,
      }),
    }),
  );
}

const WAITING: ApplyModalState = { step: 'equip', phase: 'waitingQueue', run: null, stopRequested: false, planRunId: 'r1' };

function runningState(overrides: Partial<ReturnType<typeof beginRun>> = {}): ApplyModalState {
  const run = { ...beginRun('equip', 'r1', UNITS, 0), ...overrides };
  return { step: 'equip', phase: 'running', run, stopRequested: false, planRunId: 'r1' };
}

describe('ApplyModalBody — waiting phase', () => {
  it('shows the waiting-for-the-forge sentence', () => {
    expect(render(WAITING)).toContain(en.applyModalWaitingForge);
  });
});

describe('applyModalTitle', () => {
  it('titles the window by the step it is applying', () => {
    expect(applyModalTitle('equip', en)).toBe(en.applyModalEquipTitle);
    expect(applyModalTitle('points', en)).toBe(en.applyModalPointsTitle);
  });
});

describe('ApplyModalBody — running phase', () => {
  it('shows the progress line, the bar with aria-valuenow, one ledger line per unit and the footer counts', () => {
    const html = render(runningState({ status: ['ok', 'next'], current: 1 }));
    expect(html).toContain('data-testid="apply-modal-progress"');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('aria-valuemax="2"');
    expect((html.match(/data-testid="apply-modal-ledger-line"/g) ?? []).length).toBe(2);
    expect(html).toContain('1 done');
  });

  it('prints the current unit on the in-flight card', () => {
    const html = render(runningState({ status: ['ok', 'sent'], current: 1 }));
    expect(html).toContain('data-testid="apply-modal-card"');
    expect(html).toContain('Old Blade +2');
  });

  it('prints Forge queue paused only when the store paused it', () => {
    expect(render(runningState(), { queuePaused: true })).toContain(en.applyModalQueuePaused);
    expect(render(runningState(), { queuePaused: false })).not.toContain(en.applyModalQueuePaused);
  });

  it('offers Stop, enabled, and reads Stopping after this call… once requested', () => {
    const html = render(runningState());
    expect(html).toContain(en.applyModalStop);
    const stopped: ApplyModalState = { ...runningState(), stopRequested: true };
    const stoppingHtml = render(stopped);
    expect(stoppingHtml).toContain(en.applyModalStopping);
    const stopTag = new RegExp('<button[^>]*data-testid="apply-modal-stop"[^>]*>').exec(stoppingHtml)?.[0] ?? '';
    expect(stopTag).toContain('disabled=""');
  });

  it('shows the cooldown sentence with the countdown and marks the bar with data-cooldown', () => {
    const state = runningState({ cooldown: { index: 1, resumeAtMs: 5_000 } });
    const html = render(state, { nowMs: 1_000 });
    expect(html).toContain('data-cooldown="true"');
    expect(html).toContain(en.applyModalCooldown.split('{')[0]);
  });
});

describe('ApplyModalBody — done phase', () => {
  function doneState(
    overrides: Partial<{ made: number; total: number; skipped: readonly { index: number; reason: 'heroLevel' }[]; stop: 'finished' | 'stopped' | 'error' }> = {},
  ): ApplyModalState {
    const run = beginRun('equip', 'r1', UNITS, 0);
    return {
      step: 'equip',
      phase: 'done',
      run: {
        ...run,
        result: {
          step: 'equip',
          total: overrides.total ?? 2,
          made: overrides.made ?? 1,
          skipped: (overrides.skipped ?? [{ index: 1, reason: 'heroLevel' }]).map((s) => ({ index: s.index, reason: s.reason })),
          failed: null,
          stop: overrides.stop ?? 'finished',
          stopCode: null,
          goldSpent: 0,
          durationMs: 1_000,
        },
      },
      stopRequested: false,
      planRunId: 'r1',
    };
  }

  it('shows the made-of-total count and the skip list keyed by unit', () => {
    const html = render(doneState());
    expect(html).toContain('1 of 2 calls made, 1 skipped');
    expect(html).toContain(en.applyModalSkippedTitle);
    expect(html).toContain('Old Blade +2');
    expect(html).toContain(asRenderedText(en.applySkipHeroLevel));
  });

  it('shows the stop reason when the run stopped short', () => {
    const html = render(doneState({ stop: 'stopped' }));
    expect(html).toContain('data-testid="apply-modal-stop-reason"');
    expect(html).toContain(en.applyStopStopped);
  });

  it('shows the plain-language error sentence when a run ends on an unexpected throw', () => {
    const html = render(doneState({ stop: 'error' }));
    expect(html).toContain('data-testid="apply-modal-stop-reason"');
    expect(html).toContain(en.applyStopError);
  });

  it('offers Close always, and Continue only with hasNext', () => {
    const withoutNext = render(doneState(), { hasNext: false });
    expect(withoutNext).toContain('data-testid="apply-modal-close"');
    expect(withoutNext).not.toContain('data-testid="apply-modal-continue"');
    const withNext = render(doneState(), { hasNext: true });
    expect(withNext).toContain('data-testid="apply-modal-continue"');
  });
});

describe('ApplyModal — source pins (Dialog.Portal is invisible to renderToStaticMarkup)', () => {
  const source = readFileSync(path.join(__dirname, 'apply-modal.tsx'), 'utf8');

  it('passes disablePointerDismissal to Dialog.Root', () => {
    expect(source).toMatch(/<Dialog\.Root[\s\S]*?disablePointerDismissal/);
  });

  it('ignores a close request unless the phase is done', () => {
    expect(source).toContain("if (!next && modal.phase === 'done') onClose();");
  });

  it('renders no Dialog.Close anywhere — Close is this file\'s own button', () => {
    expect(source).not.toContain('Dialog.Close');
  });
});

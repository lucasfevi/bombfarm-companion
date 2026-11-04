import { firstHideTextFor } from '@bombfarm/game-api';
import { describe, expect, it, vi } from 'vitest';
import {
  createFirstHideAnnouncer,
  decideFirstHideAnnouncement,
  type NoticePort,
} from './first-hide-notice.js';

describe('decideFirstHideAnnouncement', () => {
  const cases: ReadonlyArray<
    [boolean, boolean, boolean, 'announced' | 'already-shown' | 'not-supported' | 'no-hide']
  > = [
    // windowWasHidden, alreadyShown, notificationsSupported, outcome
    [true, false, true, 'announced'],
    [true, true, true, 'already-shown'],
    [true, true, false, 'already-shown'],
    [true, false, false, 'not-supported'],
    [false, false, true, 'no-hide'],
    [false, true, true, 'no-hide'],
    [false, false, false, 'no-hide'],
    [false, true, false, 'no-hide'],
  ];
  it.each(cases)('hidden=%s shown=%s supported=%s -> %s', (hidden, shown, supported, outcome) => {
    expect(
      decideFirstHideAnnouncement({
        windowWasHidden: hidden,
        alreadyShown: shown,
        notificationsSupported: supported,
      }),
    ).toBe(outcome);
  });
});

function setup(opts: { supported?: boolean; shown?: boolean; throws?: boolean } = {}) {
  const calls: string[] = [];
  let shown = opts.shown ?? false;
  const shownArgs: Array<{ title: string; body: string; onClick: () => void }> = [];
  const notice: NoticePort = {
    isSupported: () => opts.supported ?? true,
    show: (n) => {
      calls.push('show');
      if (opts.throws) throw new Error('toast failed');
      shownArgs.push(n);
    },
  };
  const latch = {
    hasShown: () => shown,
    markShown: vi.fn(() => {
      calls.push('mark');
      shown = true;
    }),
  };
  let locale: 'en' | 'pt-BR' = 'en';
  const show = vi.fn();
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const announcer = createFirstHideAnnouncer({
    notice,
    latch,
    text: () => firstHideTextFor(locale),
    show,
    log,
  });
  return {
    announcer,
    calls,
    latch,
    show,
    log,
    shownArgs,
    setLocale: (l: 'en' | 'pt-BR') => {
      locale = l;
    },
  };
}

describe('createFirstHideAnnouncer', () => {
  it('shows once and marks once across two hides', () => {
    const s = setup();
    expect(s.announcer.announceIfFirst(true)).toBe('announced');
    expect(s.announcer.announceIfFirst(true)).toBe('already-shown');
    expect(s.shownArgs).toHaveLength(1);
    expect(s.latch.markShown).toHaveBeenCalledTimes(1);
  });

  it('shows, then marks', () => {
    const s = setup();
    s.announcer.announceIfFirst(true);
    expect(s.calls).toEqual(['show', 'mark']);
  });

  it('does nothing when the window was really closed', () => {
    const s = setup();
    expect(s.announcer.announceIfFirst(false)).toBe('no-hide');
    expect(s.calls).toEqual([]);
    expect(s.latch.markShown).not.toHaveBeenCalled();
  });

  it('leaves the latch untouched and logs one line when unsupported', () => {
    const s = setup({ supported: false });
    expect(s.announcer.announceIfFirst(true)).toBe('not-supported');
    expect(s.calls).toEqual([]);
    expect(s.latch.markShown).not.toHaveBeenCalled();
    expect(s.log.info.mock.calls.length + s.log.warn.mock.calls.length).toBe(1);
  });

  it('catches a throwing notifier, reports failed and leaves the latch untouched', () => {
    const s = setup({ throws: true });
    expect(s.announcer.announceIfFirst(true)).toBe('failed');
    expect(s.latch.markShown).not.toHaveBeenCalled();
    expect(s.log.error).toHaveBeenCalledTimes(1);
  });

  it('reads the text at announce time', () => {
    const a = setup();
    a.announcer.announceIfFirst(true);
    expect(a.shownArgs[0]).toMatchObject(firstHideTextFor('en'));

    const b = setup();
    b.setLocale('pt-BR');
    b.announcer.announceIfFirst(true);
    expect(b.shownArgs[0]).toMatchObject(firstHideTextFor('pt-BR'));
    expect(b.shownArgs[0]?.title).not.toBe(firstHideTextFor('en').title);
  });

  it('calls the injected show when the notice is clicked', () => {
    const s = setup();
    s.announcer.announceIfFirst(true);
    expect(s.show).not.toHaveBeenCalled();
    s.shownArgs[0]?.onClick();
    expect(s.show).toHaveBeenCalledTimes(1);
  });
});

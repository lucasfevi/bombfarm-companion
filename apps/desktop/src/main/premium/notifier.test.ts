import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ Notification: vi.fn() }));

import { createPremiumNotifier, type NotificationClass } from './notifier.js';

function fakeNotification(supported: boolean, showThrows = false) {
  const made: { title: string; body: string; silent: boolean }[] = [];
  const clicks: (() => void)[] = [];
  let shown = 0;
  class Fake {
    static isSupported(): boolean {
      return supported;
    }
    constructor(options: { title: string; body: string; silent: boolean }) {
      made.push(options);
    }
    show(): void {
      if (showThrows) throw new Error('refused');
      shown += 1;
    }
    on(_event: 'click', listener: () => void): this {
      clicks.push(listener);
      return this;
    }
  }
  return { port: Fake as NotificationClass, made, clicks, shown: () => shown };
}

describe('the Premium notifier', () => {
  it('shows one system toast with the given strings and calls back when it is clicked', () => {
    const fake = fakeNotification(true);
    const onClick = vi.fn();

    const outcome = createPremiumNotifier(fake.port)({ title: 'T', body: 'B', onClick });

    expect(outcome).toBe('shown');
    expect(fake.made).toEqual([{ title: 'T', body: 'B', silent: false }]);
    expect(fake.shown()).toBe(1);
    fake.clicks[0]?.();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('says unavailable, creating nothing, when notifications are unsupported', () => {
    const fake = fakeNotification(false);

    const outcome = createPremiumNotifier(fake.port)({ title: 'T', body: 'B', onClick: () => undefined });

    expect(outcome).toBe('unavailable');
    expect(fake.made).toEqual([]);
  });

  it('says unavailable when the system refuses to show the toast', () => {
    const fake = fakeNotification(true, true);

    expect(createPremiumNotifier(fake.port)({ title: 'T', body: 'B', onClick: () => undefined })).toBe('unavailable');
  });
});

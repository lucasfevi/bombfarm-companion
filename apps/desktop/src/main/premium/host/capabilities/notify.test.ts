import { PREMIUM_NOTIFICATIONS, type AppLocale } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { CapabilityError } from '../capability-channel.js';
import { createNotifyCapability, NOTIFY_DAY_MS, NOTIFY_MIN_GAP_MS, type PremiumToast } from './notify.js';

function setup(over: { locale?: AppLocale; outcome?: 'shown' | 'unavailable' } = {}) {
  const clock = { ms: 1_000_000 };
  const toasts: PremiumToast[] = [];
  const records: Record<string, unknown>[] = [];
  const openPremiumTab = vi.fn();
  const call = createNotifyCapability({
    locale: () => over.locale ?? 'en',
    now: () => clock.ms,
    show: (toast) => {
      toasts.push(toast);
      return over.outcome ?? 'shown';
    },
    openPremiumTab,
    log: { info: (r) => records.push(r), warn: (r) => records.push(r), error: (r) => records.push(r) },
  });
  return { clock, toasts, records, openPremiumTab, call };
}

function refusal(run: () => unknown): string {
  try {
    run();
  } catch (thrown) {
    if (thrown instanceof CapabilityError) return thrown.code;
    throw thrown;
  }
  return 'none';
}

const TEST_ID = { id: 'premium.test' };

describe('the notify capability', () => {
  it.each([
    ['en', 'Premium is working', 'This is a test notification from Premium.'],
    ['pt-BR', 'O Premium está funcionando', 'Esta é uma notificação de teste do Premium.'],
  ] as const)('shows the shipped notification in %s', (locale, title, body) => {
    const { toasts, call, records } = setup({ locale });

    expect(call(TEST_ID)).toBeNull();

    expect(toasts.map(({ title: t, body: b }) => ({ title: t, body: b }))).toEqual([{ title, body }]);
    expect(records).toEqual([{ scope: 'premium', event: 'premium.notify', outcome: 'shown' }]);
  });

  it('holds both locales for every shipped id', () => {
    for (const strings of Object.values(PREMIUM_NOTIFICATIONS)) {
      for (const locale of ['en', 'pt-BR'] as const) {
        expect(strings[locale].title).not.toBe('');
        expect(strings[locale].body).not.toBe('');
      }
    }
  });

  it.each([
    ['an unknown id', { id: 'premium.other' }],
    ['an inherited name', { id: 'constructor' }],
    ['an id that is not a string', { id: 3 }],
    ['no id', {}],
    ['the old key pair', { titleKey: 'premium.test.title', bodyKey: 'premium.test.body' }],
    ['no args', undefined],
  ])('refuses %s as bad_args and shows nothing', (_name, args) => {
    const { toasts, call } = setup();

    expect(refusal(() => call(args))).toBe('bad_args');
    expect(toasts).toEqual([]);
  });

  it('refuses a second call within 30 seconds as rate_limited, and takes one at 30 seconds', () => {
    const { clock, toasts, call } = setup();
    call(TEST_ID);

    clock.ms += NOTIFY_MIN_GAP_MS - 1;
    expect(refusal(() => call(TEST_ID))).toBe('rate_limited');
    expect(toasts).toHaveLength(1);

    clock.ms += 1;
    call(TEST_ID);
    expect(toasts).toHaveLength(2);
  });

  it('refuses the 21st in a rolling day as rate_limited and takes one when the first has left the day', () => {
    const { clock, toasts, call } = setup();
    for (let i = 0; i < 20; i += 1) {
      call(TEST_ID);
      clock.ms += NOTIFY_MIN_GAP_MS;
    }
    expect(toasts).toHaveLength(20);

    expect(refusal(() => call(TEST_ID))).toBe('rate_limited');
    expect(toasts).toHaveLength(20);

    // The first of the twenty was shown at the start; one day on, it no longer counts.
    clock.ms = 1_000_000 + NOTIFY_DAY_MS;
    call(TEST_ID);
    expect(toasts).toHaveLength(21);
  });

  it('answers unavailable and logs the outcome when the system cannot show a toast, without using the budget', () => {
    const { toasts, records, call } = setup({ outcome: 'unavailable' });

    expect(refusal(() => call(TEST_ID))).toBe('unavailable');
    expect(refusal(() => call(TEST_ID))).toBe('unavailable');

    expect(toasts).toHaveLength(2);
    expect(records).toEqual([
      { scope: 'premium', event: 'premium.notify', outcome: 'unavailable' },
      { scope: 'premium', event: 'premium.notify', outcome: 'unavailable' },
    ]);
  });

  it('opens the Premium tab once when the toast is clicked, and not before', () => {
    const { toasts, call, openPremiumTab } = setup();
    call(TEST_ID);
    expect(openPremiumTab).not.toHaveBeenCalled();

    toasts[0]?.onClick();

    expect(openPremiumTab).toHaveBeenCalledTimes(1);
  });
});

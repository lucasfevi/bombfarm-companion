import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signedOutPremiumView } from '@bombfarm/contracts';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T>(initial: T | (() => T)) => [typeof initial === 'function' ? (initial as () => T)() : initial, () => {}],
    useEffect: (effect: () => unknown) => {
      effect();
    },
  };
});

const invoked: string[] = [];

beforeEach(() => {
  invoked.length = 0;
  vi.stubGlobal('window', {
    bfc: {
      invoke: (channel: string) => {
        invoked.push(channel);
        return Promise.resolve(channel === 'premium:get' ? signedOutPremiumView : { ok: true });
      },
      on: () => () => {},
    },
  });
  vi.resetModules();
});

describe('what mounting a Premium surface asks the main process', () => {
  it('refreshes exactly once when a surface that shows the status mounts', async () => {
    const { usePremium } = await import('./use-premium');

    usePremium();

    expect(invoked.filter((channel) => channel === 'premium:refresh')).toHaveLength(1);
  });

  it('never refreshes when only the tab visibility is read', async () => {
    const { usePremiumVisible } = await import('./use-premium');

    expect(usePremiumVisible(true)).toBe(signedOutPremiumView.visible);
    expect(invoked).not.toContain('premium:refresh');
  });

  it('reads the status once and subscribes when Premium is on', async () => {
    const { usePremiumVisible } = await import('./use-premium');

    usePremiumVisible(true);

    expect(invoked).toEqual(['premium:get']);
  });

  it('invokes no premium channel and reports the tab hidden when Premium is off', async () => {
    const { usePremiumVisible } = await import('./use-premium');

    expect(usePremiumVisible(false)).toBe(false);
    expect(invoked).toEqual([]);
  });
});

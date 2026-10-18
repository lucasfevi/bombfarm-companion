import { describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { signedOutPremiumView, type PremiumView } from '@bombfarm/contracts';
import { en } from '../../lib/copy/en';
import { PremiumSectionView } from './premium-section';

vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  sub: (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (fallback: string, key: string) => values[key] ?? fallback),
  PREMIUM_SIGN_IN_END_COPY_KEY: {
    cancelled: null,
    'timed-out': 'settingsPremiumEndTimedOut',
    declined: 'settingsPremiumEndDeclined',
    refused: 'settingsPremiumEndRefused',
    unreachable: 'settingsPremiumEndUnreachable',
    'bad-response': 'settingsPremiumEndBadResponse',
    'port-unavailable': 'settingsPremiumEndPortUnavailable',
    'browser-unavailable': 'settingsPremiumEndBrowserUnavailable',
  },
}));

vi.mock('../../lib/premium/use-premium', () => ({ usePremium: () => ({}) }));

type Node = ReactElement<{ children?: ReactNode; onClick?: () => void; 'data-testid'?: string }>;

function findByTestId(node: ReactNode, testId: string): Node | null {
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTestId(child as ReactNode, testId);
      if (found) return found;
    }
    return null;
  }
  const element = node as Node;
  if (element.props['data-testid'] === testId) return element;
  return findByTestId(element.props.children, testId);
}

function press(view: PremiumView, testId: string) {
  const handlers = { onSignIn: vi.fn(), onCancel: vi.fn(), onSignOut: vi.fn() };
  const button = findByTestId(PremiumSectionView({ view, ...handlers }), testId);
  button?.props.onClick?.();
  return handlers;
}

describe('the Premium section — each button is wired to its action', () => {
  it('Sign in calls onSignIn once and nothing else', () => {
    const { onSignIn, onCancel, onSignOut } = press(signedOutPremiumView, 'settings-premium-sign-in');

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('Cancel calls onCancel once and nothing else', () => {
    const { onSignIn, onCancel, onSignOut } = press(
      { ...signedOutPremiumView, session: 'signing-in' },
      'settings-premium-cancel',
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSignIn).not.toHaveBeenCalled();
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('Sign out calls onSignOut once and nothing else', () => {
    const { onSignIn, onCancel, onSignOut } = press(
      { ...signedOutPremiumView, session: 'signed-in' },
      'settings-premium-sign-out',
    );

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onSignIn).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

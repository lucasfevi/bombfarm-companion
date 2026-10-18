import { describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { signedOutPremiumView, type PremiumView } from '@bombfarm/contracts';
import { en } from '../../lib/copy/en';
import { PremiumScreenView } from './premium-view';

vi.mock('../../lib/copy', () => ({
  useCopy: () => en,
  useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }),
  sub: (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (fallback: string, key: string) => values[key] ?? fallback),
}));

vi.mock('../../lib/premium/use-premium', () => ({ usePremium: () => ({}) }));

type Node = ReactElement<{ children?: ReactNode; action?: ReactNode; onClick?: () => void; 'data-testid'?: string }>;

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
  return findByTestId(element.props.children, testId) ?? findByTestId(element.props.action, testId);
}

const signedIn: PremiumView = { ...signedOutPremiumView, session: 'signed-in', visible: true };

function press(view: PremiumView, testId: string) {
  const handlers = { onSignIn: vi.fn(), onRefresh: vi.fn(), onManage: vi.fn() };
  findByTestId(PremiumScreenView({ view, notice: null, ...handlers }), testId)?.props.onClick?.();
  return handlers;
}

describe('the Premium tab — each button is wired to its action', () => {
  it('Sign in calls onSignIn once and nothing else', () => {
    const { onSignIn, onRefresh, onManage } = press({ ...signedOutPremiumView, visible: true }, 'premium-sign-in');

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(onManage).not.toHaveBeenCalled();
  });

  it('Refresh calls onRefresh once and nothing else', () => {
    const { onSignIn, onRefresh, onManage } = press(signedIn, 'premium-refresh');

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onSignIn).not.toHaveBeenCalled();
    expect(onManage).not.toHaveBeenCalled();
  });

  it('Manage Premium calls onManage once and nothing else', () => {
    const { onSignIn, onRefresh, onManage } = press(signedIn, 'premium-manage');

    expect(onManage).toHaveBeenCalledTimes(1);
    expect(onSignIn).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { ConsentSection } from './consent-section';

// `useCopy()` is a hook, so it needs an active React dispatcher; mocking it lets `ConsentSection`
// be called directly as a plain function (no renderer, no jsdom) and its returned element tree
// walked for the rendered Button's real `onClick` prop — proving which callback is actually
// wired, not just which data-testid string appears in markup (`consent-section.test.tsx` already
// covers that).
vi.mock('../../lib/copy', () => ({ useCopy: () => en }));

function buttonElement(props: { onRevoke: () => void }) {
  const section = ConsentSection(props) as unknown as { props: { children: { props: { children: unknown } } } };
  return section.props.children.props.children as {
    props: { onClick: () => void; 'data-testid': string };
  };
}

describe('ConsentSection — the rendered control is wired to onRevoke', () => {
  it('calling it invokes onRevoke exactly once', () => {
    const onRevoke = vi.fn();
    const button = buttonElement({ onRevoke });

    expect(button.props['data-testid']).toBe('settings-consent-revoke');
    expect(button.props.onClick).toBe(onRevoke);

    button.props.onClick();
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });
});

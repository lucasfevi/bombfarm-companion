import { describe, expect, it, vi } from 'vitest';
import { en } from '../../lib/copy/en';
import { ConsentSection } from './consent-section';

// `useCopy()` is a hook, so it needs an active React dispatcher; mocking it lets `ConsentSection`
// be called directly as a plain function (no renderer, no jsdom) and its returned element tree
// walked for the rendered Button's real `onClick` prop — proving which callback is actually
// wired, not just which data-testid string appears in markup (`consent-section.test.tsx` already
// covers that).
vi.mock('../../lib/copy', () => ({ useCopy: () => en }));

function buttonElement(props: { granted: boolean; onRevoke: () => void; onReallow: () => void }) {
  const section = ConsentSection(props) as unknown as { props: { children: { props: { children: unknown } } } };
  return section.props.children.props.children as {
    props: { onClick: () => void; 'data-testid': string };
  };
}

describe('ConsentSection — granted invokes the revoke path', () => {
  it('the rendered control is wired to onRevoke, and calling it never touches onReallow', () => {
    const onRevoke = vi.fn();
    const onReallow = vi.fn();
    const button = buttonElement({ granted: true, onRevoke, onReallow });

    expect(button.props['data-testid']).toBe('settings-consent-revoke');
    expect(button.props.onClick).toBe(onRevoke);

    button.props.onClick();
    expect(onRevoke).toHaveBeenCalledTimes(1);
    expect(onReallow).not.toHaveBeenCalled();
  });
});

describe('ConsentSection — not-granted invokes the re-allow path', () => {
  it('the rendered control is wired to onReallow, and calling it never touches onRevoke', () => {
    const onRevoke = vi.fn();
    const onReallow = vi.fn();
    const button = buttonElement({ granted: false, onRevoke, onReallow });

    expect(button.props['data-testid']).toBe('settings-consent-reallow');
    expect(button.props.onClick).toBe(onReallow);

    button.props.onClick();
    expect(onReallow).toHaveBeenCalledTimes(1);
    expect(onRevoke).not.toHaveBeenCalled();
  });
});

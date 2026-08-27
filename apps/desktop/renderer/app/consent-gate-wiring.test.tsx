import { describe, expect, it, vi } from 'vitest';
import { en } from '../lib/copy/en';
import { ConsentGate } from './consent-gate';

// `useCopy()` is a hook, so it needs an active React dispatcher; mocking it lets `ConsentGate` be
// called directly as a plain function (no renderer, no jsdom) and its returned element tree
// walked for the real `onClick`/`onChange` props — the same technique as
// `settings/consent-section-wiring.test.tsx`. Kept in its own file, separate from
// `consent-gate.test.tsx`'s real-`CopyProvider` locale-rendering tests, so this module-wide mock
// never shadows those.
vi.mock('../lib/copy', () => ({ useCopy: () => en }));

function renderTree(props: {
  locale: 'en' | 'pt-BR';
  onLocaleChange: (next: 'en' | 'pt-BR') => void;
  onReadAgain: () => void;
}) {
  const root = ConsentGate(props) as unknown as { props: { children: unknown } };
  const emptyState = root.props.children as {
    props: { action: { props: { onClick: () => void; 'data-testid': string } }; children: unknown };
  };
  const settingsRow = emptyState.props.children as { props: { children: unknown } };
  const select = settingsRow.props.children as {
    props: { onChange: (event: { target: { value: string } }) => void };
  };
  return { button: emptyState.props.action, select };
}

describe('ConsentGate — the read-again control opens the disclosure', () => {
  it('calling the rendered control invokes onReadAgain exactly once', () => {
    const onReadAgain = vi.fn();
    const { button } = renderTree({ locale: 'en', onLocaleChange: vi.fn(), onReadAgain });

    expect(button.props['data-testid']).toBe('consent-gate-read-again');
    expect(button.props.onClick).toBe(onReadAgain);

    button.props.onClick();
    expect(onReadAgain).toHaveBeenCalledTimes(1);
  });
});

describe('ConsentGate — the language control changes the language', () => {
  it('selecting pt-BR calls onLocaleChange with pt-BR', () => {
    const onLocaleChange = vi.fn();
    const { select } = renderTree({ locale: 'en', onLocaleChange, onReadAgain: vi.fn() });

    select.props.onChange({ target: { value: 'pt-BR' } });

    expect(onLocaleChange).toHaveBeenCalledWith('pt-BR');
  });

  it('selecting en calls onLocaleChange with en', () => {
    const onLocaleChange = vi.fn();
    const { select } = renderTree({ locale: 'pt-BR', onLocaleChange, onReadAgain: vi.fn() });

    select.props.onChange({ target: { value: 'en' } });

    expect(onLocaleChange).toHaveBeenCalledWith('en');
  });
});

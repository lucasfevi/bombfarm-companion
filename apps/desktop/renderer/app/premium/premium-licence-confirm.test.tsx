// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import type { LicenceState, PremiumLicenceView } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { PremiumLicenceLine } from './premium-licence-line';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Locale = 'en' | 'pt-BR';

// The approved wording, written out rather than read from the copy table under test.
const WORDS = {
  en: {
    title: 'Use Premium on this PC?',
    body: 'Premium will be removed from the other PC. Your drop history stays on that PC, and this PC starts with an empty history.',
    confirm: 'Use Premium on this PC',
    cancel: 'Cancel',
  },
  'pt-BR': {
    title: 'Usar o Premium neste PC?',
    body: 'O Premium será removido do outro PC. Seu histórico de drops fica naquele PC, e este PC começa com o histórico vazio.',
    confirm: 'Usar o Premium neste PC',
    cancel: 'Cancelar',
  },
} as const;

const licence = (state: LicenceState, rest: Partial<PremiumLicenceView> = {}): PremiumLicenceView => ({
  state,
  moveInFlight: false,
  moveFailed: false,
  removalDone: true,
  holderName: 'Workshop',
  ...rest,
});

let container: HTMLDivElement;
let root: ReturnType<typeof import('react-dom/client').createRoot>;
let onUseHere: ReturnType<typeof vi.fn<() => void>>;

beforeEach(async () => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const { createRoot } = await import('react-dom/client');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  onUseHere = vi.fn<() => void>();
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function mount(l: PremiumLicenceView, locale: Locale): void {
  const node: ReactNode = (
    <CopyProvider locale={locale}>
      <PremiumLicenceLine licence={l} onUseHere={onUseHere} />
    </CopyProvider>
  );
  act(() => { root.render(node); });
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const buttonReading = (scope: ParentNode, text: string): HTMLElement => {
  const found = [...scope.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === text);
  if (!found) throw new Error(`no button reading "${text}"`);
  return found;
};
const useHere = (): HTMLElement => {
  const found = container.querySelector<HTMLElement>('[data-testid="premium-use-here"]');
  if (!found) throw new Error('no Use Premium button');
  return found;
};
const openDialog = (): HTMLElement => {
  const found = dialog();
  if (!found) throw new Error('dialog is not open');
  return found;
};
const click = (el: HTMLElement) => { act(() => { el.click(); }); };

describe.each(['en', 'pt-BR'] as const)('moving Premium to this PC asks first (%s)', (locale) => {
  const words = WORDS[locale];

  it.each(['elsewhere', 'mismatch', 'moved', 'released'] as const)(
    '%s: the button opens the dialog and invokes nothing',
    (state) => {
      mount(licence(state), locale);
      expect(dialog()).toBeNull();

      click(useHere());

      const d = openDialog();
      expect(d.textContent).toContain(words.title);
      expect(d.textContent).toContain(words.body);
      expect(buttonReading(d, words.cancel)).toBeTruthy();
      expect(buttonReading(d, words.confirm)).toBeTruthy();
      expect(onUseHere).not.toHaveBeenCalled();
    },
  );

  it('confirming invokes onUseHere exactly once and closes the dialog', () => {
    mount(licence('released'), locale);
    click(useHere());

    click(buttonReading(openDialog(), words.confirm));

    expect(onUseHere).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it('cancelling invokes nothing and closes the dialog', () => {
    mount(licence('elsewhere'), locale);
    click(useHere());

    click(buttonReading(openDialog(), words.cancel));

    expect(onUseHere).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });
});

describe('no way to move without the dialog', () => {
  it('a disabled button (move limit, Move in flight) opens nothing and invokes nothing', () => {
    mount(licence('move_limit'), 'en');
    click(useHere());
    expect(dialog()).toBeNull();

    mount(licence('elsewhere', { moveInFlight: true }), 'en');
    click(useHere());
    expect(dialog()).toBeNull();
    expect(onUseHere).not.toHaveBeenCalled();
  });
});

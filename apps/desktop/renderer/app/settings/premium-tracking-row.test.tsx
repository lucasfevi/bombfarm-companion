// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { TrackingHistoryView } from '@bombfarm/contracts';
import { signedOutPremiumView, type PremiumView } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { PremiumSectionView } from './premium-section';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Locale = 'en' | 'pt-BR';
type ClearReply = { ok: true } | { ok: false; error: 'busy' | 'failed' };

// The approved wording, written out rather than read from the copy table under test.
const WORDS = {
  en: {
    label: 'Drop history',
    size: '1.5 MB stored on this PC',
    unavailable: "Drop history isn't available on this PC (the database engine is missing).",
    clear: 'Clear drop history',
    title: 'Clear drop history?',
    body: 'This deletes the drop history stored on this PC. It cannot be recovered.',
    confirm: 'Clear',
    cancel: 'Cancel',
    cleared: 'Drop history cleared.',
    busy: 'Drop history is busy right now — try again in a moment.',
    failed: "Couldn't clear drop history — try again.",
  },
  'pt-BR': {
    label: 'Histórico de drops',
    size: '1,5 MB guardados neste PC',
    unavailable: 'O histórico de drops não está disponível neste PC (o mecanismo de banco de dados não foi encontrado).',
    clear: 'Limpar histórico de drops',
    title: 'Limpar o histórico de drops?',
    body: 'Isso apaga o histórico de drops guardado neste PC. Ele não pode ser recuperado.',
    confirm: 'Limpar',
    cancel: 'Cancelar',
    cleared: 'Histórico de drops limpo.',
    busy: 'O histórico de drops está ocupado agora — tente de novo em instantes.',
    failed: 'Não foi possível limpar o histórico de drops — tente de novo.',
  },
} as const;

const MB_AND_A_HALF = 1.5 * 1024 * 1024;
const signedIn: PremiumView = { ...signedOutPremiumView, session: 'signed-in' };

let container: HTMLDivElement;
let root: ReturnType<typeof import('react-dom/client').createRoot>;
let invoke: ReturnType<typeof vi.fn<(channel: string) => Promise<unknown>>>;

function bridge(history: TrackingHistoryView, clearReply: ClearReply = { ok: true }): void {
  invoke = vi.fn<(channel: string) => Promise<unknown>>((channel) =>
    Promise.resolve(channel === 'premium:trackingHistory' ? history : clearReply),
  );
  (window as unknown as { bfc: unknown }).bfc = { invoke };
}

beforeEach(async () => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const { createRoot } = await import('react-dom/client');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  delete (window as unknown as { bfc?: unknown }).bfc;
});

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function mount(locale: Locale, view: PremiumView = signedIn): Promise<void> {
  act(() => {
    root.render(
      <CopyProvider locale={locale}>
        <PremiumSectionView view={view} onSignIn={vi.fn()} onCancel={vi.fn()} onSignOut={vi.fn()} />
      </CopyProvider>,
    );
  });
  await settle();
}

async function click(el: HTMLElement | null): Promise<void> {
  act(() => { el?.click(); });
  await settle();
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const clearButton = () =>
  container.querySelector<HTMLElement>('[data-testid="settings-premium-tracking-clear"]');
const buttonReading = (scope: ParentNode, text: string): HTMLElement => {
  const found = [...scope.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === text);
  if (!found) throw new Error(`no button reading "${text}"`);
  return found;
};
const text = () => container.textContent.replace(/\s+/g, ' ');
const clearCalls = () => invoke.mock.calls.filter(([channel]) => channel === 'premium:clearTrackingHistory');

describe.each(['en', 'pt-BR'] as const)('the Drop history row (%s)', (locale) => {
  const words = WORDS[locale];

  it.each([
    ['signed in', signedIn],
    ['signed out', signedOutPremiumView],
  ] as const)('is hidden when there is no history (%s)', async (_name, view) => {
    bridge({ state: 'none' });
    await mount(locale, view);

    expect(invoke).toHaveBeenCalledWith('premium:trackingHistory');
    expect(text()).not.toContain(words.label);
    expect(clearButton()).toBeNull();
  });

  it('shows the formatted size when history is present, even signed out', async () => {
    bridge({ state: 'present', bytes: MB_AND_A_HALF });
    await mount(locale, signedOutPremiumView);

    expect(text()).toContain(words.label);
    expect(text()).toContain(words.size);
    expect(text()).not.toContain(words.unavailable);
    expect(clearButton()?.textContent).toBe(words.clear);
  });

  it('names the reason when the engine is unavailable, with the size', async () => {
    bridge({ state: 'engine_unavailable', bytes: MB_AND_A_HALF, reason: 'binding_missing' });
    await mount(locale);

    expect(text()).toContain(words.size);
    expect(text()).toContain(words.unavailable);
    expect(clearButton()).not.toBeNull();
  });

  it('shows the unavailable line without a size when the size is unknown', async () => {
    bridge({ state: 'engine_unavailable', bytes: null, reason: 'binding_missing' });
    await mount(locale);

    expect(text()).toContain(words.unavailable);
    expect(text()).not.toContain('MB');
  });

  it('opens the dialog on click and invokes nothing; cancel keeps it that way', async () => {
    bridge({ state: 'present', bytes: MB_AND_A_HALF });
    await mount(locale);
    await click(clearButton());

    const open = dialog();
    expect(open?.textContent).toContain(words.title);
    expect(open?.textContent).toContain(words.body);
    expect(clearCalls()).toHaveLength(0);

    await click(buttonReading(open as HTMLElement, words.cancel));
    expect(clearCalls()).toHaveLength(0);
    expect(text()).toContain(words.size);
  });

  it('confirm clears once, then shows the result and drops the size', async () => {
    bridge({ state: 'present', bytes: MB_AND_A_HALF }, { ok: true });
    await mount(locale);
    await click(clearButton());
    await click(buttonReading(dialog() as HTMLElement, words.confirm));

    expect(clearCalls()).toHaveLength(1);
    expect(text()).toContain(words.cleared);
    expect(text()).not.toContain(words.size);
    expect(clearButton()).toBeNull();
  });

  it.each(['busy', 'failed'] as const)(
    'a %s refusal shows its line and keeps the history and the button',
    async (error) => {
      bridge({ state: 'present', bytes: MB_AND_A_HALF }, { ok: false, error });
      await mount(locale);
      await click(clearButton());
      await click(buttonReading(dialog() as HTMLElement, words.confirm));

      expect(clearCalls()).toHaveLength(1);
      expect(text()).toContain(words[error]);
      expect(text()).toContain(words.size);
      expect(clearButton()).not.toBeNull();
    },
  );

  it('a clear that rejects shows the failed line and keeps the history and the button', async () => {
    bridge({ state: 'present', bytes: MB_AND_A_HALF });
    invoke.mockImplementation((channel) =>
      channel === 'premium:trackingHistory'
        ? Promise.resolve({ state: 'present', bytes: MB_AND_A_HALF })
        : Promise.reject(new Error('ipc down')),
    );
    await mount(locale);
    await click(clearButton());
    await click(buttonReading(dialog() as HTMLElement, words.confirm));

    expect(clearCalls()).toHaveLength(1);
    expect(text()).toContain(words.failed);
    expect(text()).toContain(words.size);
    expect(clearButton()).not.toBeNull();
  });
});

describe('the unavailable reasons', () => {
  it.each([
    ['binding_missing', 'the database engine is missing'],
    ['extension_missing', 'the engine extension is missing'],
    ['probe_failed', 'the engine failed its start-up check'],
  ] as const)('%s reads as its own sentence', async (reason, phrase) => {
    bridge({ state: 'engine_unavailable', bytes: 10, reason });
    await mount('en');
    expect(text()).toContain(`Drop history isn't available on this PC (${phrase}).`);
  });

  it.each([
    ['binding_missing', 'o mecanismo de banco de dados não foi encontrado'],
    ['extension_missing', 'a extensão do mecanismo não foi encontrada'],
    ['probe_failed', 'o mecanismo falhou na verificação de início'],
  ] as const)('%s reads as its own sentence in pt-BR', async (reason, phrase) => {
    bridge({ state: 'engine_unavailable', bytes: 10, reason });
    await mount('pt-BR');
    expect(text()).toContain(`O histórico de drops não está disponível neste PC (${phrase}).`);
  });
});

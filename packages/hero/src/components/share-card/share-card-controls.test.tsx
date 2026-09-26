// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { defaultShareCardSettings, type RosterHeroRow, type ShareCardSettings } from '../../model';
import { rowFixture } from '../../model/showcase.test-fixture';
import { ShareCardControls, type SharePhaseBounds, type ShareCopyStatus } from './share-card-controls';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROSTER: readonly RosterHeroRow[] = [
  rowFixture({ id: 'ada', name: 'Ada', power: 500, rarity: 'Mítico' }),
  rowFixture({ id: 'adao', name: 'Adão', power: 400, rarity: 'Épico' }),
  rowFixture({ id: 'bo', name: 'Bo', power: 300, rarity: 'Épico' }),
  rowFixture({ id: 'cy', name: 'Cy', power: 200, rarity: 'Comum', battleAllowed: false }),
];

const PHASES: SharePhaseBounds = {
  accountPhase: 51,
  lastKnownPhase: 310,
  options: [
    { value: '51', label: 'Normal 1-1 (#51)' },
    { value: '137', label: 'Normal 5-7 (#137)' },
  ],
};

let latest: ShareCardSettings;

function Harness({ status }: { status: ShareCopyStatus }) {
  const [settings, setSettings] = useState(() => defaultShareCardSettings(ROSTER, 51, 310));
  latest = settings;
  return (
    <ShareCardControls
      rows={ROSTER}
      settings={settings}
      onSettings={(patch) => {
        setSettings((current) => ({ ...current, ...patch }));
      }}
      phaseBounds={PHASES}
      copyControl={{ status, onCopy: () => undefined }}
      lang="en"
    />
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function mount(status: ShareCopyStatus = 'idle') {
  act(() => {
    root.render(<Harness status={status} />);
  });
}

const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement;

function listed(): string[] {
  return [...container.querySelectorAll('[data-testid^="share-card-pick-hero-"]')].map((node) =>
    (node.getAttribute('data-testid') ?? '').replace('share-card-pick-hero-', ''),
  );
}

function typeFilter(text: string) {
  const input = byTestId('share-card-picker-filter') as HTMLInputElement;
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  act(() => {
    descriptor?.set?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function rarityChip(label: string): HTMLButtonElement {
  const chip = [...container.querySelectorAll('[data-testid^="share-card-picker-rarity-"]')].find(
    (node) => node.textContent === label,
  );
  expect(chip, `a ${label} chip`).toBeDefined();
  return chip as HTMLButtonElement;
}

describe('ShareCardControls', () => {
  it('offers no feature choice: the card always features the strongest three', () => {
    mount();
    expect(container.textContent).not.toContain('Best birth rolls');
    expect(container.textContent).not.toContain('Strongest three');
  });

  it('narrows the list by name without taking anyone off the card', () => {
    mount();
    const before = new Set(latest.picked);
    typeFilter('ada');
    expect(listed()).toEqual(['ada', 'adao']);
    expect(latest.picked).toEqual(before);
    typeFilter('zzz');
    expect(listed()).toEqual([]);
    expect(byTestId('share-card-picker-empty').textContent).toBe('No hero matches the filter.');
    expect(latest.picked).toEqual(before);
  });

  it('narrows the list by the rarity chips, and a second press lets everyone back', () => {
    mount();
    const before = new Set(latest.picked);
    const epic = rarityChip('Epic');
    act(() => {
      epic.click();
    });
    expect(epic.getAttribute('aria-pressed')).toBe('true');
    expect(listed()).toEqual(['adao', 'bo']);
    expect(latest.picked).toEqual(before);
    act(() => {
      epic.click();
    });
    expect(listed()).toEqual(['ada', 'adao', 'bo', 'cy']);
  });

  it('picks the squad, everyone or nobody with real buttons, over the whole roster whatever the filter', () => {
    mount();
    const everyone = byTestId('share-card-pick-everyone');
    expect(everyone.tagName).toBe('BUTTON');
    expect(everyone.className).not.toContain('uppercase');
    typeFilter('ada');
    act(() => {
      everyone.click();
    });
    expect([...latest.picked].sort()).toEqual(['ada', 'adao', 'bo', 'cy']);
    act(() => {
      byTestId('share-card-pick-none').click();
    });
    expect(latest.picked.size).toBe(0);
    act(() => {
      byTestId('share-card-pick-squad').click();
    });
    expect([...latest.picked].sort()).toEqual(['ada', 'adao', 'bo']);
  });

  it('shows the chosen phase in the picker, and offers the way back to the account phase', () => {
    mount();
    expect(byTestId('share-card-phase').textContent).toContain('Normal 1-1 (#51)');
    const reset = byTestId('share-card-phase-reset') as HTMLButtonElement;
    expect(reset.textContent).toBe('Use my current phase (51)');
    expect(reset.disabled).toBe(true);
  });

  it('says Copied beside a check once the image is on the clipboard', () => {
    mount('copied');
    const status = byTestId('share-card-copy-status');
    expect(status.textContent).toBe('Copied');
    expect(status.querySelector('[data-testid="share-card-copied-icon"] svg')).not.toBeNull();
  });

  it('keeps the error message when the copy fails', () => {
    mount('failed');
    expect(byTestId('share-card-copy-status').textContent).toBe('The image could not be copied. Try again.');
  });
});

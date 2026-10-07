import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildInventoryView, type InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { DEFAULT_FORGE_QUEUE_SETTINGS, type ForgeQueueSettings } from '../../lib/forge/forge-queue-settings';
import { EMPTY_FORGE_QUEUE, type ForgeQueueState } from '../../lib/forge/forge-queue-reducer';
import { priceForgeQueue, resolveForgeQueue } from '../../lib/forge/forge-queue-view';
import { forgeLabels } from './forge-labels';

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return { ...actual, useCopy: () => en, useLocale: () => ({ locale: 'en', lang: 'en', bcp47: 'en-US' }) };
});

vi.mock('../../lib/forge/forge-run-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/forge/forge-run-store')>();
  return { ...actual, useForgeRun: () => ({ status: 'idle' }) };
});

vi.mock('../../lib/deconstruct/deconstruct-run-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/deconstruct/deconstruct-run-store')>();
  return { ...actual, useDeconstructRun: () => ({ status: 'idle' }) };
});

const { ForgeQueuePanel } = await import('./forge-queue-panel');
const { ForgeQueueConfirmBody } = await import('./forge-queue-confirm-body');

const labels = forgeLabels(en, 'en', 'en');
const NO_STONES = [0, 0, 0, 0, 0, 0];

function piece(id: string, upgrade: number): InventoryViewItem {
  const found = buildInventoryView([
    { id, def_id: 'steel_luva', category: 0, set: 'steel', rarity: 2, level: 20, upgrade, power: 1, stats: [] },
  ]).items[0];
  if (!found) throw new Error('no test row');
  return found;
}

const COMMON_FROM_TEN: ForgeQueueSettings = {
  ranges: [
    { upTo: 9, rarity: null },
    { upTo: 15, rarity: 0 },
  ],
  stopWhenOutOfStones: true,
  scroll: false,
};

const gear = [piece('g1', 9), piece('g2', 9)];
const rows = resolveForgeQueue(
  [
    { itemId: 'g1', target: 15 },
    { itemId: 'g2', target: 15 },
  ],
  gear,
);

function stonesForOnePiece(): number {
  const lone = priceForgeQueue(resolveForgeQueue([{ itemId: 'g1', target: 15 }], gear), COMMON_FROM_TEN, [1000, 0, 0, 0, 0, 0]);
  return lone.stonesNeeded[0] ?? 0;
}

function renderPanel(settings: ForgeQueueSettings, owned: number[], status: ForgeQueueState['status'] = 'idle'): string {
  return renderToStaticMarkup(
    createElement(ForgeQueuePanel, {
      queue: { ...EMPTY_FORGE_QUEUE, pieces: rows.map((row) => row.piece), status },
      rows,
      pricing: priceForgeQueue(rows, settings, owned),
      settings,
      ownedStones: owned,
      labels,
      onRemove: () => undefined,
      forgeWritesEnabled: true,
      accountSource: null,
    }),
  );
}

function tagWithId(html: string, id: string): string {
  return new RegExp(`<[^>]*id="${id}"[^>]*>`).exec(html)?.[0] ?? '';
}

function settingsFieldset(html: string): string {
  return /<fieldset[^>]*data-testid="forge-queue-settings"[^>]*>/.exec(html)?.[0] ?? '';
}

describe('ForgeQueuePanel settings', () => {
  it('shows the stone range editor and both switches, the stop on and the scroll off by default', () => {
    const html = renderPanel(DEFAULT_FORGE_QUEUE_SETTINGS, NO_STONES);
    expect(html).toContain('data-testid="forge-queue-settings"');
    expect(html).toContain('data-testid="forge-stones"');
    expect(html).toContain(en.forgeQueueStopLabel);
    expect(html).toContain(en.forgeQueueScrollLabel);
    expect(tagWithId(html, 'forge-queue-stop-switch')).toContain('checked=""');
    expect(tagWithId(html, 'forge-queue-scroll-switch')).not.toContain('checked=""');
  });

  it('explains itself through info tips', () => {
    const html = renderPanel(DEFAULT_FORGE_QUEUE_SETTINGS, NO_STONES);
    expect(html).toContain(`aria-label="${en.forgeQueueSettingsTitle}: ${en.forgeQueueSettingsTip}`);
    expect(html).toContain(`aria-label="${en.forgeQueueStopLabel}: ${en.forgeQueueStopTip}`);
  });

  it('reads the switches from the settings it is given', () => {
    const html = renderPanel({ ...DEFAULT_FORGE_QUEUE_SETTINGS, stopWhenOutOfStones: false, scroll: true }, NO_STONES);
    expect(tagWithId(html, 'forge-queue-stop-switch')).not.toContain('checked=""');
    expect(tagWithId(html, 'forge-queue-scroll-switch')).toContain('checked=""');
  });

  it('is editable while the queue waits and locked while it runs or stands aside', () => {
    expect(settingsFieldset(renderPanel(DEFAULT_FORGE_QUEUE_SETTINGS, NO_STONES, 'idle'))).not.toContain('disabled=""');
    for (const status of ['running', 'paused'] as const) {
      expect(settingsFieldset(renderPanel(DEFAULT_FORGE_QUEUE_SETTINGS, NO_STONES, status))).toContain('disabled=""');
    }
  });

  it('prints nothing about stones when none is chosen', () => {
    const html = renderPanel(DEFAULT_FORGE_QUEUE_SETTINGS, [5, 0, 0, 0, 0, 0]);
    expect(html).not.toContain('data-testid="forge-queue-stones"');
  });

  it('prints the stones the queue should use against the ones owned, with no warning while they cover it', () => {
    const html = renderPanel(COMMON_FROM_TEN, [Math.ceil(stonesForOnePiece() * 3), 0, 0, 0, 0, 0]);
    expect(html).toContain('data-testid="forge-queue-stones-kind"');
    expect(html).not.toContain('data-testid="forge-queue-stones-runs-out"');
  });

  it('says the queue stops where the stones are expected to run out when the stop is on', () => {
    const html = renderPanel(COMMON_FROM_TEN, [Math.ceil(stonesForOnePiece() * 1.2), 0, 0, 0, 0, 0]);
    expect(html).toContain('data-testid="forge-queue-stones-runs-out"');
    expect(html).toContain('the queue stops there');
  });

  it('says the pieces from there roll without stones when the stop is off', () => {
    const html = renderPanel({ ...COMMON_FROM_TEN, stopWhenOutOfStones: false }, [Math.ceil(stonesForOnePiece() * 1.2), 0, 0, 0, 0, 0]);
    expect(html).toContain('roll without them');
    expect(html).not.toContain('the queue stops there');
  });

  it('says so even when no stone is owned at all', () => {
    const html = renderPanel(COMMON_FROM_TEN, NO_STONES);
    expect(html).toContain('data-testid="forge-queue-stones-runs-out"');
  });
});

describe('ForgeQueueConfirmBody', () => {
  const render = (settings: ForgeQueueSettings, owned: number[]) =>
    renderToStaticMarkup(
      createElement(ForgeQueueConfirmBody, { rows, pricing: priceForgeQueue(rows, settings, owned), settings, labels }),
    );

  it('prints the expected stones the queue uses, by kind, when it uses any', () => {
    const html = render(COMMON_FROM_TEN, [1000, 0, 0, 0, 0, 0]);
    expect(html).toContain('data-testid="forge-queue-confirm-stones"');
    expect(html).toContain('Common');
    expect(html).not.toContain('data-testid="forge-queue-confirm-runs-out"');
  });

  it('prints nothing about stones when none is chosen', () => {
    const html = render(DEFAULT_FORGE_QUEUE_SETTINGS, NO_STONES);
    expect(html).not.toContain('data-testid="forge-queue-confirm-stones"');
  });

  it('warns where the stones are expected to run out', () => {
    expect(render(COMMON_FROM_TEN, [1, 0, 0, 0, 0, 0])).toContain('the queue stops there');
    expect(render({ ...COMMON_FROM_TEN, stopWhenOutOfStones: false }, [1, 0, 0, 0, 0, 0])).toContain('roll without them');
  });
});

describe('forge queue copy', () => {
  it('has Portuguese for every new line', () => {
    for (const key of [
      'forgeQueueSettingsTitle',
      'forgeQueueSettingsTip',
      'forgeQueueStopLabel',
      'forgeQueueStopTip',
      'forgeQueueScrollLabel',
      'forgeQueueScrollTip',
      'forgeQueueStonesStop',
      'forgeQueueStonesRoll',
      'forgeQueueConfirmStones',
      'forgeFactWalletEssence',
    ] as const) {
      expect(ptBR[key]).not.toBe(en[key]);
    }
  });
});

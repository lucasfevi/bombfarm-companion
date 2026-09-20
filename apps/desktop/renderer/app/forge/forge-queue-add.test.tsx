import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountViewState } from '../../lib/account/use-account-view';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { EMPTY_FORGE_QUEUE, type ForgeQueueState } from '../../lib/forge/forge-queue-reducer';

const accountState = vi.hoisted(() => ({ current: null as unknown as AccountViewState }));
const queueState = vi.hoisted(() => ({ current: null as unknown as ForgeQueueState }));

vi.mock('../../lib/account/use-account-view', () => ({
  useAccountView: () => accountState.current,
}));

vi.mock('../../lib/forge/forge-queue-store', () => ({
  useForgeQueue: () => queueState.current,
  addToForgeQueue: () => {},
}));

const { ForgeQueueAdd } = await import('./forge-queue-add');

function loadedBag(upgrade: number): AccountViewState {
  return {
    status: 'loaded',
    view: { payload: { items: [{ id: 'ring', def_id: 'ash_ring', upgrade }] } } as never,
    applied: 1,
    key: 'account',
  };
}

function render(queue: ForgeQueueState, account: AccountViewState): string {
  queueState.current = queue;
  accountState.current = account;
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ForgeQueueAdd, { itemId: 'ring', target: 12, itemName: 'Ash Ring' }),
    }),
  );
}

const QUEUED: ForgeQueueState = { ...EMPTY_FORGE_QUEUE, pieces: [{ itemId: 'ring', target: 12 }] };

describe('ForgeQueueAdd reads the piece off the live bag before it reads the queue', () => {
  it('offers the press while the bag still holds the piece short of the target', () => {
    const html = render(EMPTY_FORGE_QUEUE, loadedBag(0));
    expect(html).toContain(`>${en.forgeQueueAdd}<`);
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('data-forged');
  });

  it('says the piece is queued once the queue holds it at that target', () => {
    const html = render(QUEUED, loadedBag(9));
    expect(html).toContain(`>${en.forgeQueueAdded}<`);
    expect(html).toContain('data-queued="true"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('disabled=""');
  });

  it('says the piece is forged, and takes no press, once the bag holds it at or past the target', () => {
    for (const upgrade of [12, 15]) {
      const html = render(EMPTY_FORGE_QUEUE, loadedBag(upgrade));
      expect(html).toContain(`>${en.forgeQueueAlreadyForged}<`);
      expect(html).toContain('data-forged="true"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('Ash Ring is already forged to +12');
      expect(html).not.toContain('data-queued');
    }
  });

  it('the bag wins over a stale queue entry for the same piece', () => {
    const html = render(QUEUED, loadedBag(12));
    expect(html).toContain(`>${en.forgeQueueAlreadyForged}<`);
    expect(html).not.toContain('data-queued');
    expect(html).not.toContain('aria-pressed');
  });

  it('without a loaded account, only the queue speaks', () => {
    expect(render(EMPTY_FORGE_QUEUE, { status: 'loading', applied: 0, key: null })).toContain(`>${en.forgeQueueAdd}<`);
    expect(render(QUEUED, { status: 'loading', applied: 0, key: null })).toContain(`>${en.forgeQueueAdded}<`);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EMPTY_COLLECTIONS_VIEW, type AccountReadRefusal, type AccountView, type SectionFidelity } from '@bombfarm/contracts';
import { accountReadRefusalText } from '../../lib/account-read-labels';
import type { AccountReadRequestState } from '../../lib/account/use-account-read-request';
import type { CollectionsState } from '../../lib/collections/collections-store';
import { collectionsSnapshotFixture } from '../../lib/collections/collections-test-fixture';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';

const language = vi.hoisted((): { current: 'en' | 'pt-BR' } => ({ current: 'en' }));

vi.mock('../../lib/copy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/copy')>();
  return {
    ...actual,
    useCopy: () => actual.STRINGS[language.current],
    useLocale: () => ({
      locale: language.current,
      lang: language.current === 'en' ? 'en' : 'pt',
      bcp47: language.current === 'en' ? 'en-US' : 'pt-BR',
    }),
  };
});

const collections = vi.hoisted((): { current: CollectionsState } => ({ current: { status: 'loading', applied: 0, view: { snapshot: null, capturedAt: null } } }));
const refreshRequest = vi.hoisted((): { current: AccountReadRequestState } => ({ current: { kind: 'idle' } }));
const account = vi.hoisted((): { current: unknown } => ({ current: { status: 'loading' } }));

// A static render runs no effects, so the read the screen asks for on open is a no-op here; the
// reader's own tests prove what the call does.
vi.mock('../../lib/collections/use-collections', () => ({
  useCollections: () => collections.current,
  refreshCollections: () => undefined,
}));

vi.mock('../../lib/collections/use-collections-refresh', () => ({
  useCollectionsRefresh: () => ({ state: refreshRequest.current, request: () => undefined }),
}));

vi.mock('../../lib/account/use-account-view', () => ({
  useAccountView: () => account.current,
}));

const { CollectionsView } = await import('./collections-view');

const RESOLVED: SectionFidelity = { status: 'resolved', capturedAt: '2026-10-02T10:00:00.000Z' };

function accountWith(items: unknown[], itemsFidelity: SectionFidelity = RESOLVED) {
  const view = {
    payload: {
      items,
      fidelity: { account: RESOLVED, heroes: RESOLVED, skills: RESOLVED, casa: RESOLVED, items: itemsFidelity },
    },
  } as unknown as AccountView;
  return { status: 'loaded', view, applied: 1, key: 'account' };
}

const ready: CollectionsState = {
  status: 'ready',
  applied: 1,
  view: { snapshot: collectionsSnapshotFixture(), capturedAt: '2026-10-02T10:00:00.000Z' },
};

function render(
  state: CollectionsState,
  options: { locale?: 'en' | 'pt-BR'; refresh?: AccountReadRequestState; account?: unknown } = {},
): string {
  collections.current = state;
  language.current = options.locale ?? 'en';
  refreshRequest.current = options.refresh ?? { kind: 'idle' };
  account.current = options.account ?? { status: 'loading' };
  return renderToStaticMarkup(createElement(CollectionsView));
}

const waiting: CollectionsState = { status: 'loading', applied: 0, view: EMPTY_COLLECTIONS_VIEW };
const noRead: CollectionsState = { status: 'ready', applied: 1, view: EMPTY_COLLECTIONS_VIEW };

describe('CollectionsView', () => {
  it('shows a quiet placeholder while the store has not answered', () => {
    const html = render(waiting);
    expect(html).toContain('data-testid="collections-view" data-state="loading"');
    expect(html).toContain(en.shellLoadingLabel);
    expect(html).not.toContain('data-testid="collections-bonuses"');
    expect(html).not.toContain('data-testid="collections-read-now"');
  });

  it('says so when the preload bridge is missing', () => {
    const html = render({ status: 'bridge-unavailable', applied: 0, view: EMPTY_COLLECTIONS_VIEW });
    expect(html).toContain('data-state="bridge-unavailable"');
    expect(html).toContain(en.emptyBridgeUnavailableTitle);
  });

  it('offers to read now when nothing has been read, and says when the tab reads on its own', () => {
    const html = render(noRead);
    expect(html).toContain('data-state="ready"');
    expect(html).toContain(en.collectionsEmptyTitle);
    expect(html).toContain(en.collectionsEmptyDescription);
    expect(html).toMatch(/<button[^>]*data-testid="collections-read-now"[^>]*>Read now<\/button>/);
    expect(html).not.toContain('data-testid="collections-refused"');
    expect(html).not.toContain('data-testid="collections-bonuses"');
  });

  it('offers the same retry when the stored view could not be fetched', () => {
    const html = render({ status: 'unavailable', applied: 0, view: EMPTY_COLLECTIONS_VIEW });
    expect(html).toContain('data-state="unavailable"');
    expect(html).toContain('data-testid="collections-read-now"');
  });

  it('disables the button and says it is reading while a read is in flight', () => {
    const html = render(noRead, { refresh: { kind: 'working' } });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="collections-read-now"|<button[^>]*data-testid="collections-read-now"[^>]*disabled=""/);
    expect(html).toContain(en.collectionsReading);
  });

  it.each<AccountReadRefusal>(['offline', 'not_consented', 'game_not_running', 'token_unavailable', 'rate_limited', 'unavailable'])(
    'says why a refused read started nothing, in the same words the account refresh uses (%s)',
    (reason) => {
      const html = render(noRead, { refresh: { kind: 'refused', reason } });
      expect(html).toMatch(/data-testid="collections-refused"[^>]*>([^<]*)</);
      const said = /data-testid="collections-refused"[^>]*>([^<]*)</.exec(html)?.[1] ?? '';
      expect(said.replace(/&#x27;/g, "'").replace(/&amp;/g, '&')).toBe(accountReadRefusalText(reason, en));
    },
  );

  it('draws the bonuses panel above the books panel once a snapshot is held', () => {
    const html = render(ready);
    expect(html).toContain('data-testid="collections-view" data-state="ready"');
    expect(html.indexOf('data-testid="collections-bonuses"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="collections-books"')).toBeGreaterThan(html.indexOf('data-testid="collections-bonuses"'));
    expect(html.match(/data-testid="collections-axis"/g)).toHaveLength(10);
    expect(html.match(/data-testid="collections-book-row"/g)).toHaveLength(30);
  });

  it('draws no detail panel until a book is chosen', () => {
    expect(render(ready)).not.toContain('data-testid="collections-book-detail"');
  });

  it('keeps a held snapshot on screen even when the last read was refused', () => {
    const html = render(ready, { refresh: { kind: 'refused', reason: 'game_not_running' } });
    expect(html).toContain('data-testid="collections-bonuses"');
    expect(html).not.toContain('data-testid="collections-read-now"');
  });

  it('has no bag until the account read is usable: the ready switch is off and no row has a chip', () => {
    for (const waitingAccount of [{ status: 'loading' }, accountWith([], { status: 'missing' })]) {
      const html = render(ready, { account: waitingAccount });
      expect(html).toContain('data-available="false"');
      expect(html).not.toContain('data-testid="collections-ready"');
    }
  });

  it('reads the bag from the account’s items and shows what is ready to sacrifice', () => {
    const items = [{ def_id: 'gold_elmo', rarity: 3, equipped_on: null, locked: false, market_state: 0, in_stash: false }];
    const html = render(ready, { account: accountWith(items) });
    expect(html).toContain('data-available="true"');
    expect(html).toContain('1 ready in your bag');
    expect(html.match(/data-testid="collections-ready"/g)).toHaveLength(1);
    expect(html).toContain('1 in bag');
  });

  it('leaves out a piece the bag holds but the player has equipped', () => {
    const items = [{ def_id: 'gold_elmo', rarity: 3, equipped_on: '862212', locked: false, market_state: 0, in_stash: false }];
    const html = render(ready, { account: accountWith(items) });
    expect(html).not.toContain('data-testid="collections-ready"');
    expect(html).toContain('data-available="true"');
  });

  it('renders in both languages', () => {
    const portuguese = render(ready, { locale: 'pt-BR' });
    expect(portuguese).toContain(ptBR.collectionsBonusesTitle);
    expect(portuguese).toContain(ptBR.collectionsBooksTitle);
    expect(render(noRead, { locale: 'pt-BR' })).toContain(ptBR.collectionsReadNow);
    expect(render(noRead, { locale: 'pt-BR' })).toContain(ptBR.collectionsEmptyTitle);
  });

  it('puts the open book beside the table only from the wide breakpoint, and under it everywhere else', () => {
    const source = readFileSync(join(__dirname, 'collections-view.tsx'), 'utf8');
    expect(source).toContain("'wide:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]'");
    expect(source).not.toMatch(/(?:xl|2xl|lg):grid-cols-\[/);
  });
});

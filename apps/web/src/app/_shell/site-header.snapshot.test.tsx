// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STRINGS, type Lang } from '@/shared/i18n';
import { SiteHeader } from './site-header';
import { renderSettledShellHtml, stubViewport } from './shell-snapshot-harness';

vi.mock('next/navigation', () => ({
  usePathname: () => '/farm',
  useRouter: () => ({ prefetch: () => undefined, push: () => undefined }),
}));

beforeEach(() => {
  document.body.innerHTML = '';
});

describe.each<Lang>(['en', 'pt'])('site header (%s)', (lang) => {
  it.each([
    ['wide', false],
    ['phone', true],
  ])('renders the %s shape', async (shape, phone) => {
    stubViewport(phone);
    const html = await renderSettledShellHtml(
      <SiteHeader t={STRINGS[lang]} lang={lang} onImport={() => undefined} onLangChange={() => undefined} />,
    );
    await expect(html).toMatchFileSnapshot(`./__snapshots__/site-header.${lang}.${shape}.html`);
  });
});

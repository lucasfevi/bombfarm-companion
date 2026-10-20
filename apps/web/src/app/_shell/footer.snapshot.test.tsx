// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STRINGS, type Lang } from '@/shared/i18n';
import { Footer } from './footer';
import { renderSettledShellHtml } from './shell-snapshot-harness';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '1.2.3');
  vi.stubEnv('NEXT_PUBLIC_APP_IS_PRODUCTION', 'true');
  vi.stubEnv('NEXT_PUBLIC_APP_COMMIT_SHA', '');
  vi.stubEnv('NEXT_PUBLIC_APP_VERSION_LABEL_OVERRIDE', '');
  document.body.innerHTML = '';
});

describe.each<Lang>(['en', 'pt'])('footer (%s)', (lang) => {
  it('renders the footer', async () => {
    const html = await renderSettledShellHtml(<Footer t={STRINGS[lang]} />);
    await expect(html).toMatchFileSnapshot(`./__snapshots__/footer.${lang}.html`);
  });
});

// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { AppShellInner } from './app-shell-inner';
import { renderSettledShellHtml, stubViewport } from './shell-snapshot-harness';

const nav = vi.hoisted(() => ({ pathname: '/farm' }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ prefetch: () => undefined, push: () => undefined }),
}));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '1.2.3');
  vi.stubEnv('NEXT_PUBLIC_APP_IS_PRODUCTION', 'true');
  vi.stubEnv('NEXT_PUBLIC_APP_COMMIT_SHA', '');
  vi.stubEnv('NEXT_PUBLIC_APP_VERSION_LABEL_OVERRIDE', '');
  localStorage.setItem('bf_referral_notice_hidden', '1');
  resetPlannerStoreForTests();
  stubViewport(false);
  document.body.innerHTML = '';
});

describe.each([
  ['a section page', '/farm'],
  ['the planner', '/heroes'],
])('page frame on %s', (_label, pathname) => {
  it.each(['en', 'pt'] as const)('renders the frame (%s)', async (lang) => {
    nav.pathname = pathname;
    usePlannerStore.setState({ lang });
    const html = await renderSettledShellHtml(
      <AppShellInner planner={<main data-fixture="planner">planner slot</main>}>
        <main data-fixture="page">page children</main>
      </AppShellInner>,
    );
    const slug = pathname === '/farm' ? 'section' : 'planner';
    await expect(html).toMatchFileSnapshot(`./__snapshots__/app-shell-inner.${slug}.${lang}.html`);
  });
});

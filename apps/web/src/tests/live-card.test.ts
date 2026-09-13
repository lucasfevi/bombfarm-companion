import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { RELEASES_URL } from '@/features/download';
import type { LatestRelease } from '@/features/download/model/latest-release';
import { LiveCard } from '@/features/home/components/live-card';
import { STRINGS, sub, type Lang } from '@/shared/i18n';
import { normalizeHero } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore, type PlannerStore } from '@/shared/stores';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

vi.mock('@/shared/stores/planner-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/stores/planner-store')>();
  const live = Object.assign(
    (selector: (state: PlannerStore) => unknown) => selector(real.usePlannerStore.getState()),
    real.usePlannerStore,
  );
  return { ...real, usePlannerStore: live };
});

let release: LatestRelease | null = null;

vi.mock('@/features/download', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/download')>();
  return { ...real, useLatestRelease: () => release };
});

const LANGS: readonly Lang[] = ['en', 'pt'];

const RELEASE: LatestRelease = {
  version: '0.7.0',
  fileName: 'bombfarm-companion-0.7.0-setup.exe',
  downloadUrl:
    'https://github.com/lucasfevi/bombfarm-companion/releases/download/v0.7.0/bombfarm-companion-0.7.0-setup.exe',
  sizeLabel: '212 MB',
  installs: 6,
  updates: 3,
};

const HOME_COMPONENTS = join(WEB_PACKAGE_ROOT, 'src/features/home/components');

function hero(id: string) {
  const stats = { attack: 100, energy: 100, speed: 50, critChance: 0, critDmg: 10, penetration: 0, cdr: 0, luck: 0 };
  return normalizeHero({
    id,
    name: `Hero ${id}`,
    sourceId: `src-${id}`,
    updatedAt: 1,
    rarity: 'Raro',
    level: 10,
    stars: 1,
    naked: stats,
    gearedOverride: stats,
    loadout: emptyLoadout(),
    pts: ZERO_PTS(),
  });
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const render = () => renderToStaticMarkup(createElement(LiveCard));
const textOf = (html: string) => html.replace(/<[^>]+>/g, '');
const openingOf = (html: string, testId: string) =>
  html.lastIndexOf('<div', html.indexOf(`data-testid="${testId}"`));
const body = (html: string) =>
  html.slice(openingOf(html, 'home-card-body'), openingOf(html, 'home-card-footer'));
const footer = (html: string) => textOf(html.slice(openingOf(html, 'home-card-footer')));
const anchor = (html: string) => {
  const start = html.indexOf('data-testid="home-live-download"');
  return html.slice(html.lastIndexOf('<a ', start), html.indexOf('</a>', start));
};
const trustLines = (html: string) =>
  [...body(html).matchAll(/<li[^>]*>.*?<span>([^<]*)<\/span><\/li>/g)].map((match) => match[1]);

describe('the front page live card', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    release = null;
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it("prints the download page's pending line and the releases link when GitHub has not answered", () => {
    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const strings = STRINGS[lang];
      const html = render();

      expect(html).toContain('data-home-card-state="ready"');
      expect(html).toContain(`>${strings.homeCardLiveContext}<`);
      expect(body(html)).toContain(`<p class="m-0 text-sm">${strings.homeCardLiveBody}</p>`);
      expect(trustLines(html)).toEqual([
        strings.homeCardLiveTrustReads,
        strings.downloadTrustPermission,
        strings.downloadTrustUpdates,
      ]);
      expect(anchor(html)).toContain(`href="${RELEASES_URL}"`);
      expect(textOf(anchor(html))).toBe(strings.downloadCta);
      expect(anchor(html)).not.toMatch(/v\d/);
      expect(footer(html)).toBe(strings.downloadFileMetaPending);
      expect(html.match(/<a /g)).toHaveLength(2);
    }
  });

  it('prints the version, file and size from the release', () => {
    release = RELEASE;

    for (const lang of LANGS) {
      usePlannerStore.setState({ lang });
      const strings = STRINGS[lang];
      const html = render();

      expect(anchor(html)).toContain(`href="${RELEASE.downloadUrl}"`);
      expect(textOf(anchor(html))).toBe(`${strings.downloadCta}v${RELEASE.version}`);
      expect(footer(html)).toBe(
        sub(strings.downloadFileMeta, { file: RELEASE.fileName, size: RELEASE.sizeLabel }),
      );
    }
  });

  it('renders the same text with an empty store and with a full one', () => {
    release = RELEASE;
    usePlannerStore.setState({ lang: 'en' });
    const empty = render();

    usePlannerStore.getState().hydrateRoster(Array.from({ length: 13 }, (_, index) => hero(`h${index}`)), 'h0');
    usePlannerStore.getState().applyAccountImport({ tree: null, houseIdx: 1, houseLevel: 3, phase: 51, maxPhase: 137 });
    usePlannerStore.getState().setPhasesViewPhase(60);
    expect(usePlannerStore.getState().heroes).toHaveLength(13);
    expect(render()).toBe(empty);

    const source = readFileSync(join(HOME_COMPONENTS, 'live-card.tsx'), 'utf8');
    const specifiers = Array.from(source.matchAll(/from '([^']+)'/g), (match) => match[1]);
    expect(specifiers).toContain('@/features/download');
    expect(specifiers.filter((specifier) => specifier.includes('@/shared/stores'))).toEqual([]);
    expect(specifiers.filter((specifier) => /features\/download\/components\/(live|mini-live)/.test(specifier))).toEqual([]);
    expect(specifiers.filter((specifier) => specifier.includes('/components/'))).toEqual([]);
  });

  it('no version, file name or size literal appears under the home feature', () => {
    const files = walk(join(WEB_PACKAGE_ROOT, 'src/features/home'));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\d+\.\d+\.\d+/);
      expect(source, file).not.toMatch(/setup\.exe/);
      expect(source, file).not.toMatch(/\d+\s?MB/);
    }
  });
});

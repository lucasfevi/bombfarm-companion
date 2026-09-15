import { describe, expect, it } from 'vitest';
import {
  LATEST_RELEASE_API,
  RELEASES_API,
  fetchDownloadCounts,
  fetchLatestRelease,
  nextPageUrl,
  parseDownloadCounts,
  parseLatestRelease,
  type FetchJson,
} from '@/features/download/model/latest-release';

describe('resolving the newest build', () => {
  const asset = (name: string, downloads: number) => ({
    name,
    size: 221_979_203,
    download_count: downloads,
    browser_download_url: `https://example.invalid/${name}`,
  });

  const stable = {
    tag_name: 'v0.7.0',
    published_at: '2026-08-31T09:00:00Z',
    assets: [
      asset('bombfarm-companion-0.7.0-setup.exe.blockmap', 99),
      asset('builder-debug.yml', 99),
      asset('bombfarm-companion-0.7.0-setup.exe', 1),
    ],
  };

  /**
   * Stable is the only thing this page serves. It carries no channel word in its filename —
   * beta's does — so the installer is recognised by the version starting straight after the
   * product name, and picked out from the blockmap and build log beside it.
   */
  it('serves the stable build GitHub names as latest', () => {
    const parsed = parseLatestRelease(stable);
    expect(parsed?.version).toBe('0.7.0');
    expect(parsed?.fileName).toBe('bombfarm-companion-0.7.0-setup.exe');
    expect(parsed?.downloadUrl).toBe('https://example.invalid/bombfarm-companion-0.7.0-setup.exe');
  });

  it('reports the asset size in MB', () => {
    expect(parseLatestRelease(stable)?.sizeLabel).toBe('212 MB');
  });

  /**
   * `/releases/latest` excludes pre-releases itself, so a beta only reaches here if one was
   * published without the flag. It must still not take the button.
   */
  it('resolves nothing when the latest release is a beta', () => {
    const beta = {
      tag_name: 'v0.7.0-beta.163',
      published_at: '2026-08-30T23:37:27Z',
      assets: [asset('bombfarm-companion-beta-0.7.0-beta.163-setup.exe', 2)],
    };
    expect(parseLatestRelease(beta)).toBeNull();
  });

  it('gives up rather than guessing when the payload is unusable', () => {
    expect(parseLatestRelease(null)).toBeNull();
    expect(parseLatestRelease({ message: 'Not Found' })).toBeNull();
    expect(parseLatestRelease({ ...stable, draft: true })).toBeNull();
    expect(parseLatestRelease({ tag_name: 'v1', assets: [] })).toBeNull();
    expect(parseLatestRelease([stable])).toBeNull();
  });

  it('asks GitHub for the latest release, not for the list', async () => {
    const asked: string[] = [];
    const fetchJson: FetchJson = (url) => {
      asked.push(url);
      return Promise.resolve({
        ok: true,
        headers: { get: () => null },
        json: () => Promise.resolve(stable),
      });
    };
    expect((await fetchLatestRelease(fetchJson))?.version).toBe('0.7.0');
    expect(asked).toEqual([LATEST_RELEASE_API]);
    expect(LATEST_RELEASE_API).toBe(
      'https://api.github.com/repos/lucasfevi/bombfarm-companion/releases/latest',
    );
  });

  it('resolves nothing when GitHub refuses the call', async () => {
    const refused: FetchJson = () =>
      Promise.resolve({
        ok: false,
        headers: { get: () => null },
        json: () => Promise.resolve({ message: 'API rate limit exceeded' }),
      });
    expect(await fetchLatestRelease(refused)).toBeNull();
  });
});

describe('counting downloads', () => {
  const asset = (name: string, downloads: number) => ({ name, size: 1, download_count: downloads });

  const betas = [
    {
      tag_name: 'v0.6.0-beta.161',
      assets: [asset('bombfarm-companion-beta-0.6.0-beta.161-setup.exe', 4)],
    },
    {
      tag_name: 'v0.7.0-beta.163',
      assets: [
        asset('bombfarm-companion-beta-0.7.0-beta.163-setup.exe', 2),
        asset('bombfarm-companion-beta-0.7.0-beta.163-setup.exe.blockmap', 7),
      ],
    },
  ];

  const stable = {
    tag_name: 'v0.7.0',
    assets: [
      asset('bombfarm-companion-0.7.0-setup.exe', 1),
      asset('bombfarm-companion-0.7.0-setup.exe.blockmap', 3),
      asset('builder-debug.yml', 99),
      asset('latest.yml', 99),
    ],
  };

  /**
   * Installs count every installer on every channel; updates count only `.blockmap` fetches,
   * which nothing but electron-updater asks for. Mixing them would inflate installs with the
   * same people coming back. The install figure is deliberately not stable-only: it is a tally
   * of people who installed the app, not a property of the build on offer.
   */
  it('counts installs and updates across every channel and version', () => {
    expect(parseDownloadCounts([...betas, stable])).toEqual({ installs: 7, updates: 10 });
  });

  it('ignores drafts and build logs', () => {
    const noisy = [
      { tag_name: 'v9.9.9', draft: true, assets: [asset('bombfarm-companion-9.9.9-setup.exe', 50)] },
      stable,
    ];
    expect(parseDownloadCounts(noisy)).toEqual({ installs: 1, updates: 3 });
  });

  it('counts nothing from a payload that is not a release list', () => {
    expect(parseDownloadCounts(null)).toBeNull();
    expect(parseDownloadCounts({ message: 'API rate limit exceeded' })).toBeNull();
    expect(parseDownloadCounts([])).toEqual({ installs: 0, updates: 0 });
  });

  it('reads the next page out of the Link header, and stops without one', () => {
    const link =
      '<https://api.github.com/repositories/1/releases?per_page=100&page=2>; rel="next", ' +
      '<https://api.github.com/repositories/1/releases?per_page=100&page=3>; rel="last"';
    expect(nextPageUrl(link)).toBe(
      'https://api.github.com/repositories/1/releases?per_page=100&page=2',
    );
    expect(
      nextPageUrl('<https://api.github.com/repositories/1/releases?page=1>; rel="prev"'),
    ).toBeNull();
    expect(nextPageUrl(null)).toBeNull();
  });

  const paged = (pages: readonly unknown[][], failAt?: number): FetchJson => {
    const pageUrl = (n: number) =>
      `https://api.github.com/repositories/1/releases?per_page=100&page=${String(n)}`;
    return (requested) => {
      const n =
        requested === RELEASES_API ? 1 : Number(new URL(requested).searchParams.get('page'));
      const link =
        n < pages.length
          ? `<${pageUrl(n + 1)}>; rel="next", <${pageUrl(pages.length)}>; rel="last"`
          : null;
      return Promise.resolve({
        ok: n !== failAt,
        headers: { get: (name: string) => (name === 'link' ? link : null) },
        json: () =>
          Promise.resolve(n === failAt ? { message: 'API rate limit exceeded' } : pages[n - 1]),
      });
    };
  };

  /**
   * GitHub lists thirty releases a page by default and the rail cuts a beta on every merge, so
   * within days the newest stable — and most of the downloads — sit past the first page. The
   * page went dark for a week on exactly that. Every page is walked, and the first is asked
   * for at the largest size GitHub allows.
   */
  it('walks every page of the release list', async () => {
    const pages = [[betas[0]], [betas[1]], [stable]];
    expect(await fetchDownloadCounts(paged(pages))).toEqual({ installs: 7, updates: 10 });
    expect(new URL(RELEASES_API).searchParams.get('per_page')).toBe('100');
  });

  it('reports no total rather than a partial one when a page cannot be read', async () => {
    const pages = [[betas[0]], [betas[1]], [stable]];
    expect(await fetchDownloadCounts(paged(pages, 2))).toBeNull();
  });
});

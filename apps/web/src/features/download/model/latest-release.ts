import { INSTALLER_SUFFIX, REPO_URL, isStableInstaller } from './release';

const REPO_API = REPO_URL.replace('https://github.com/', 'https://api.github.com/repos/');

/**
 * GitHub's own "newest release that is neither a draft nor a pre-release". The release rail marks
 * every beta a pre-release, so this is the stable build without reading the list — which matters
 * because the list is paginated, and a week of merges puts thirty-odd betas ahead of the newest
 * stable. The page went blank once for exactly that reason.
 */
export const LATEST_RELEASE_API = `${REPO_API}/releases/latest`;

/** The first page of the full list; `nextPageUrl` walks the rest. */
export const RELEASES_API = `${REPO_API}/releases?per_page=100`;

export const GITHUB_ACCEPT = 'application/vnd.github+json';

export interface LatestRelease {
  readonly version: string;
  readonly fileName: string;
  readonly downloadUrl: string;
  readonly sizeLabel: string;
}

export interface DownloadCounts {
  /** Every installer ever downloaded, every channel, every version. */
  readonly installs: number;
  /**
   * Differential updates applied by installed apps. electron-updater fetches an asset's
   * `.blockmap` only when it is patching an existing install, so nothing but the updater asks
   * for these — which makes them the one figure here that counts updates rather than installs.
   */
  readonly updates: number;
}

interface RawAsset {
  readonly name?: unknown;
  readonly size?: unknown;
  readonly browser_download_url?: unknown;
  readonly download_count?: unknown;
}

interface RawRelease {
  readonly tag_name?: unknown;
  readonly draft?: unknown;
  readonly assets?: unknown;
}

/** Any channel's installer — what "installs" counts. */
function isInstaller(asset: RawAsset): boolean {
  return typeof asset.name === 'string' && asset.name.endsWith(INSTALLER_SUFFIX);
}

function isUpdatePatch(asset: RawAsset): boolean {
  return typeof asset.name === 'string' && asset.name.endsWith(`${INSTALLER_SUFFIX}.blockmap`);
}

function downloadsOf(asset: RawAsset): number {
  return typeof asset.download_count === 'number' ? asset.download_count : 0;
}

function assetsOf(release: unknown): RawAsset[] {
  if (typeof release !== 'object' || release === null) return [];
  const { assets } = release as RawRelease;
  return Array.isArray(assets) ? (assets as RawAsset[]) : [];
}

/** Mebibytes, the unit the installer's own properties dialog reports. */
function sizeLabel(bytes: number): string {
  return `${String(Math.round(bytes / 1024 / 1024))} MB`;
}

/** `v0.7.0-beta.163` → `0.7.0-beta.163`. */
function versionOf(release: RawRelease): string {
  const tag = typeof release.tag_name === 'string' ? release.tag_name : '';
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

/**
 * The build the page offers, from one `/releases/latest` payload.
 *
 * GitHub already excludes drafts and pre-releases there, but the installer's name is checked all
 * the same: a beta published without the pre-release flag must fall back to the releases page,
 * never take the button.
 */
export function parseLatestRelease(payload: unknown): LatestRelease | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const release = payload as RawRelease;
  if (release.draft === true) return null;

  const asset = assetsOf(release).find(
    (candidate) => isInstaller(candidate) && isStableInstaller(String(candidate.name)),
  );
  if (asset === undefined) return null;
  if (typeof asset.browser_download_url !== 'string' || typeof asset.name !== 'string') return null;

  return {
    version: versionOf(release),
    fileName: asset.name,
    downloadUrl: asset.browser_download_url,
    sizeLabel: typeof asset.size === 'number' ? sizeLabel(asset.size) : '',
  };
}

/** The tallies on one page of `/releases`; `null` when the page is not a release list. */
export function parseDownloadCounts(payload: unknown): DownloadCounts | null {
  if (!Array.isArray(payload)) return null;

  let installs = 0;
  let updates = 0;
  for (const release of payload) {
    if (typeof release === 'object' && release !== null && (release as RawRelease).draft === true) {
      continue;
    }
    for (const asset of assetsOf(release)) {
      if (isUpdatePatch(asset)) updates += downloadsOf(asset);
      else if (isInstaller(asset)) installs += downloadsOf(asset);
    }
  }
  return { installs, updates };
}

export function addDownloadCounts(left: DownloadCounts, right: DownloadCounts): DownloadCounts {
  return { installs: left.installs + right.installs, updates: left.updates + right.updates };
}

/**
 * The `rel="next"` target of a GitHub `Link` header, or `null` on the last page. The header
 * reads `<url>; rel="next", <url>; rel="last"`, and is absent when the list fits in one page.
 */
export function nextPageUrl(linkHeader: string | null): string | null {
  if (linkHeader === null) return null;
  for (const part of linkHeader.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
    if (match !== null) return match[1];
  }
  return null;
}

/** The narrowest slice of `fetch` this module uses, so tests can script it without a network. */
export type FetchJson = (url: string) => Promise<{
  readonly ok: boolean;
  readonly headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

/**
 * Every installer download across the whole release list, walked page by page. `null` if any
 * page could not be read: a partial total would be a wrong number, and the strip hides on `null`
 * rather than print one.
 */
export async function fetchDownloadCounts(fetchJson: FetchJson): Promise<DownloadCounts | null> {
  let total: DownloadCounts = { installs: 0, updates: 0 };
  let url: string | null = RELEASES_API;
  while (url !== null) {
    const response = await fetchJson(url);
    if (!response.ok) return null;
    const page = parseDownloadCounts(await response.json());
    if (page === null) return null;
    total = addDownloadCounts(total, page);
    url = nextPageUrl(response.headers.get('link'));
  }
  return total;
}

export async function fetchLatestRelease(fetchJson: FetchJson): Promise<LatestRelease | null> {
  const response = await fetchJson(LATEST_RELEASE_API);
  if (!response.ok) return null;
  return parseLatestRelease(await response.json());
}

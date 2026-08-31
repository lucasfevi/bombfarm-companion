import { CHANNELS, INSTALLER_SUFFIX, REPO_URL, channelOfInstaller, type Channel } from './release';

export const RELEASES_API = `${REPO_URL.replace('https://github.com/', 'https://api.github.com/repos/')}/releases`;

export interface LatestRelease {
  /** Which channel this build came from — the page says so rather than implying stable. */
  readonly channel: Channel;
  readonly version: string;
  readonly fileName: string;
  readonly downloadUrl: string;
  readonly sizeLabel: string;
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
  readonly published_at?: unknown;
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

function assetsOf(release: RawRelease): RawAsset[] {
  return Array.isArray(release.assets) ? (release.assets as RawAsset[]) : [];
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

interface Candidate {
  readonly channel: Channel;
  readonly release: RawRelease;
  readonly asset: RawAsset;
  readonly published: number;
}

/**
 * The newest published build on the best channel that has one, plus the running install total.
 *
 * Newest by `published_at` rather than by list position or by parsing the tag: the API's order is
 * not a promise, and `0.7.0-beta.163` versus `0.6.0-beta.161` is a semver comparison this page has
 * no reason to reimplement.
 */
export function parseLatestRelease(payload: unknown): LatestRelease | null {
  if (!Array.isArray(payload)) return null;

  const releases = payload as RawRelease[];
  let installs = 0;
  let updates = 0;
  const newestPerChannel = new Map<Channel, Candidate>();

  for (const release of releases) {
    if (release.draft === true) continue;
    for (const asset of assetsOf(release)) {
      if (isUpdatePatch(asset)) {
        updates += downloadsOf(asset);
        continue;
      }
      if (!isInstaller(asset)) continue;
      installs += downloadsOf(asset);

      const channel = channelOfInstaller(String(asset.name));
      if (channel === null) continue;
      const published =
        typeof release.published_at === 'string' ? Date.parse(release.published_at) : Number.NaN;
      if (Number.isNaN(published)) continue;
      const newest = newestPerChannel.get(channel);
      if (newest === undefined || published > newest.published) {
        newestPerChannel.set(channel, { channel, release, asset, published });
      }
    }
  }

  const best = CHANNELS.map((channel) => newestPerChannel.get(channel)).find(
    (candidate): candidate is Candidate => candidate !== undefined,
  );
  if (best === undefined) return null;
  const { asset, release } = best;
  if (typeof asset.browser_download_url !== 'string' || typeof asset.name !== 'string') return null;

  return {
    channel: best.channel,
    version: versionOf(release),
    fileName: asset.name,
    downloadUrl: asset.browser_download_url,
    sizeLabel: typeof asset.size === 'number' ? sizeLabel(asset.size) : '',
    installs,
    updates,
  };
}

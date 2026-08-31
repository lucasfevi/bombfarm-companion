/**
 * Nothing about a release is written down here.
 *
 * The first version of this page hardcoded the version, the installer filename and its size. All
 * three were wrong within a day — the published builds are `bombfarm-companion-beta-<v>-setup.exe`
 * at ~212 MB, and the newest tag ran ahead of `apps/desktop/package.json` — and a download button
 * pointing at a file that does not exist is the worst defect this page can have. So the release is
 * resolved at runtime and the only fallback is the releases page, which cannot 404.
 *
 * Stable builds publish as ordinary GitHub releases and beta builds as *prereleases*, so
 * `/releases/latest` is no use for the second: the page reads the whole list and picks per channel.
 */
export const REPO_URL = 'https://github.com/lucasfevi/bombfarm-companion';
export const ISSUES_URL = `${REPO_URL}/issues`;
export const RELEASES_URL = `${REPO_URL}/releases`;

/**
 * The distributed channels, best first. The page serves the highest one that has a published
 * build, so a stable release takes the download button the moment one exists and beta carries it
 * until then — or again, if stable publishing ever breaks.
 */
export const CHANNELS = ['prod', 'beta'] as const;
export type Channel = (typeof CHANNELS)[number];

/** The installer asset, as electron-builder names it. */
export const INSTALLER_SUFFIX = '-setup.exe';

const INSTALLER_PREFIX = 'bombfarm-companion-';

/**
 * Which channel published an installer, read off the name electron-builder gave it.
 *
 * Stable carries no channel word at all — `bombfarm-companion-0.7.0-setup.exe` against beta's
 * `bombfarm-companion-beta-0.7.0-beta.166-setup.exe` — so it is recognised by the version starting
 * immediately after the product name rather than by a marker. Anything else (a `dev` build, a
 * channel added later) reads as neither and never reaches the button.
 */
export function channelOfInstaller(assetName: string): Channel | null {
  if (!assetName.startsWith(INSTALLER_PREFIX) || !assetName.endsWith(INSTALLER_SUFFIX)) return null;

  const afterProductName = assetName.slice(INSTALLER_PREFIX.length);
  if (afterProductName.startsWith('beta-')) return 'beta';
  return /^\d/.test(afterProductName) ? 'prod' : null;
}

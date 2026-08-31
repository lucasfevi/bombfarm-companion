/**
 * Nothing about a release is written down here.
 *
 * The first version of this page hardcoded the version, the installer filename and its size. All
 * three were wrong within a day — the published builds are `bombfarm-companion-<v>-setup.exe` at
 * ~212 MB, and the newest tag ran ahead of `apps/desktop/package.json` — and a download button
 * pointing at a file that does not exist is the worst defect this page can have. So the release is
 * resolved at runtime and the only fallback is the releases page, which cannot 404.
 */
export const REPO_URL = 'https://github.com/lucasfevi/bombfarm-companion';
export const ISSUES_URL = `${REPO_URL}/issues`;
export const RELEASES_URL = `${REPO_URL}/releases`;

/** The installer asset, as electron-builder names it. */
export const INSTALLER_SUFFIX = '-setup.exe';

const INSTALLER_PREFIX = 'bombfarm-companion-';

/**
 * Whether an installer is a stable build — the only kind this page offers.
 *
 * Stable carries no channel word at all — `bombfarm-companion-0.7.1-setup.exe` against beta's
 * `bombfarm-companion-beta-0.7.1-beta.170-setup.exe` — so it is recognised by the version starting
 * immediately after the product name, not by a marker. Written as a positive match rather than as
 * "not one of the other channels" so a channel added later is never mistaken for stable: this page
 * says nothing about which channel a build came from, and it may only ever serve the one it means.
 */
export function isStableInstaller(assetName: string): boolean {
  if (!assetName.startsWith(INSTALLER_PREFIX) || !assetName.endsWith(INSTALLER_SUFFIX)) return false;
  return /^\d/.test(assetName.slice(INSTALLER_PREFIX.length));
}

/**
 * Nothing about a release is written down here.
 *
 * The first version of this page hardcoded the version, the installer filename and its size. All
 * three were wrong within a day — the published builds are `bombfarm-companion-beta-<v>-setup.exe`
 * at ~212 MB, and the newest tag ran ahead of `apps/desktop/package.json` — and a download button
 * pointing at a file that does not exist is the worst defect this page can have. So the release is
 * resolved at runtime and the only fallback is the releases page, which cannot 404.
 *
 * Beta builds are published as GitHub *prereleases*, so `/releases/latest` does not find them:
 * it resolves to the newest non-prerelease and would 404 while beta is the only live channel.
 */
export const REPO_URL = 'https://github.com/lucasfevi/bombfarm-companion';
export const ISSUES_URL = `${REPO_URL}/issues`;
export const RELEASES_URL = `${REPO_URL}/releases`;

export const CHANNEL = 'beta';

/** The installer asset, as electron-builder names it for this channel. */
export const INSTALLER_SUFFIX = '-setup.exe';
export const INSTALLER_CHANNEL_MARKER = `-${CHANNEL}-`;

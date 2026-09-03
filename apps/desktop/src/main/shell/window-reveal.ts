/**
 * Whether windows should skip the reveal they normally do the moment they are created.
 *
 * This exists for the desktop smoke suite, which drives a real Electron GUI: every spec launches a
 * window that takes focus off whatever the developer was doing and paints over their screen for
 * the length of the run. Electron ships no headless mode and Playwright's `_electron.launch` has
 * no `headless` option, so never revealing the window is the closest available thing — and it
 * costs the suite nothing, because a never-shown window still lays out and still runs
 * `requestAnimationFrame`.
 *
 * It suppresses only the automatic reveal. An explicit `show()` — the tray's Show, a second
 * instance surfacing the window — is untouched, so the paths whose whole subject is making a
 * window appear stay observable under the flag.
 *
 * `isPackaged` is a parameter rather than something read here, and the gate is closed whenever it
 * is true, so no environment can talk a shipped build into starting with a window the player
 * cannot find. Both parameters are required: there is no default a caller can omit into an
 * invisible state.
 */
const HIDE_WINDOWS_ENV_VAR = 'BFC_HIDE_WINDOWS';

export function isWindowRevealSuppressed(
  env: Readonly<Record<string, string | undefined>>,
  isPackaged: boolean,
): boolean {
  return !isPackaged && env[HIDE_WINDOWS_ENV_VAR] === '1';
}

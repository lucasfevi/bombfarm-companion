/**
 * A dev-only record of every REST body and live frame the tap observes — including the bodies the
 * app refuses to identify and therefore discards, which is the whole reason this exists. The
 * output is newline-delimited JSON so a session survives a crash mid-write and is greppable
 * without tooling.
 */

const CAPTURE_ENV_VAR = 'BFC_OBSERVATION_CAPTURE';

/**
 * `isPackaged` is a parameter rather than something read here, so the caller has to pass
 * Electron's real answer and a packaged build cannot be talked into recording live account
 * traffic by its environment — the same fail-closed shape `sessionCfgPath` uses for its token
 * override. Both parameters are required: there is no default a caller can omit into an unsafe
 * state.
 */
export function isObservationCaptureEnabled(
  env: Readonly<Record<string, string | undefined>>,
  isPackaged: boolean,
): boolean {
  return !isPackaged && env[CAPTURE_ENV_VAR] === '1';
}

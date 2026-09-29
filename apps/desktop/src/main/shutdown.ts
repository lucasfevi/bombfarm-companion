/**
 * `before-quit` is the single shutdown path in this app, reached identically whether it fires
 * directly or via `window-all-closed`'s `app.quit()`; there is no separate `will-quit` handler and
 * none is needed. The order below is load-bearing, not incidental: every producer that can call
 * `accountStore.commit()` — the game reader's fixture-mode ticker and the game-API account-refresh
 * cycle — must be told to stop *before* the SQLite handles are closed. Closing storage while the
 * fixture ticker still ran produced an uncaught "database is not open" exception on quit.
 * `GameReaderService.stop()` clears its own timer and latches a `stopped` flag so a tick already in
 * flight can never reach the store afterward; `AccountStore.close()` is additionally defensive (a
 * closed-store guard) in case a producer's shutdown ever races it anyway.
 *
 * The steps live here; their bodies stay with the caller, because each one also releases a
 * module-level binding that no function outside that module can assign.
 */
export const SHUTDOWN_STEPS = [
  'markQuitting',
  'stopUpdateService',
  'stopGameReader',
  'stopGameKeepAlive',
  'stopUsagePing',
  'stopAccountRefresh',
  'stopLiveFastPublisher',
  'stopMarketService',
  'releaseForgeService',
  'releaseForgeInjector',
  'releaseApplyService',
  'releaseApplyInjector',
  'releaseForgeHistory',
  'releasePvpReader',
  'releasePvpRecorder',
  'releasePvpHistory',
  'releaseTriggeredRefresh',
  'teardownLiveSource',
  'stopObservationMarkWatch',
  'closeObservationCapture',
  'releaseRotationIngestMemo',
  'releaseConsentStore',
  'persistMainWindowLayout',
  'clearLayoutPersistTimer',
  'clearMiniLayoutPersistTimer',
  'destroyTray',
  'clearShellSmokeBridge',
  'releaseShellLifecycle',
  'disposeMiniLiveController',
  'releaseSettingsStore',
  'releaseWindowLayoutStore',
  'closeStorage',
  'closeAccountStore',
  'flushLog',
] as const;

export type ShutdownStep = (typeof SHUTDOWN_STEPS)[number];

export interface ShutdownDeps {
  steps: Readonly<Record<ShutdownStep, () => void>>;
  onStepFailed: (step: ShutdownStep, error: unknown) => void;
}

export function shutdownInOrder(deps: ShutdownDeps): void {
  for (const step of SHUTDOWN_STEPS) {
    try {
      deps.steps[step]();
    } catch (error) {
      deps.onStepFailed(step, error);
    }
  }
}

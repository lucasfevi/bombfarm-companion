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
  'stopOnlinePlayersService',
  'stopGamePingService',
  'stopPremium',
  'releaseForgeService',
  'releaseForgeInjector',
  'releaseApplyService',
  'releaseApplyInjector',
  'releaseDeconstructService',
  'releaseDeconstructInjector',
  'releaseForgeHistory',
  'releasePvpReader',
  'releasePvpRecorder',
  'releasePvpHistory',
  'releaseCollectionsReader',
  'releaseCollectionsRecorder',
  'releaseCollectionsStore',
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

/** The longest quitting waits for the tap to leave the game. Past it the app exits anyway: a
 *  wedged instrumentation runtime must never make the app impossible to close. */
export const LIVE_SOURCE_RELEASE_DEADLINE_MS = 8_000;

/** Resolves once `task` settles or `deadlineMs` passes, whichever is first; never rejects. */
export function settleWithin(
  task: Promise<unknown>,
  deadlineMs: number,
  timers: { setTimeout(callback: () => void, ms: number): unknown; clearTimeout(handle: unknown): void },
): Promise<'settled' | 'deadline'> {
  return new Promise((resolve) => {
    const timer = timers.setTimeout(() => {
      resolve('deadline');
    }, deadlineMs);
    const finish = (): void => {
      timers.clearTimeout(timer);
      resolve('settled');
    };
    task.then(finish, finish);
  });
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

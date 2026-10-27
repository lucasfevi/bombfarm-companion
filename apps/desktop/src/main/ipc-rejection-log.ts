import type { IpcSenderRefusal, SenderWindow } from './ipc-sender-policy.js';
import { createKeyedLogGate } from './log-gate.js';

/** Looser than the renderer-error allowance: a refusal is one line of fixed shape. */
export const IPC_REJECTION_BURST = 10;
export const IPC_REJECTION_REFILL_MS = 10_000;
export const IPC_REJECTION_REPORT_MS = 60_000;

export interface IpcRejectionLogGateDeps {
  now?: () => number;
  warn: (record: Record<string, unknown>) => void;
  schedule?: (callback: () => void, delayMs: number) => void;
}

export interface IpcRejectionLogGate {
  /** `false` when this window has logged its share of refusals for this reason. Only the log line
   *  is limited; the call is refused whatever this answers. */
  admit(window: SenderWindow | null, reason: IpcSenderRefusal): boolean;
}

interface Source {
  readonly window: SenderWindow | 'unknown';
  readonly reason: IpcSenderRefusal;
}

/** Keyed by the sending window and the reason, never by the channel string: a page that varies the
 *  channel on every call would otherwise get a line each. A sender with no window is keyed by its
 *  reason alone, so it is bounded too. */
export function createIpcRejectionLogGate(deps: IpcRejectionLogGateDeps): IpcRejectionLogGate {
  const gate = createKeyedLogGate<Source>({
    burst: IPC_REJECTION_BURST,
    refillMs: IPC_REJECTION_REFILL_MS,
    reportMs: IPC_REJECTION_REPORT_MS,
    now: deps.now,
    schedule: deps.schedule,
    onSuppressed: ({ window, reason }, suppressed) => {
      deps.warn({ scope: 'main', event: 'ipc.sender_rejections_suppressed', window, reason, suppressed });
    },
  });
  return {
    admit: (window, reason) => {
      const source: Source = { window: window ?? 'unknown', reason };
      return gate.admit(`${source.window}:${reason}`, source);
    },
  };
}

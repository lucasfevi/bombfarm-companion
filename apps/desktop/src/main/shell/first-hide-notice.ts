import type { FirstHideText } from '@bombfarm/game-api';

export interface NoticePort {
  isSupported(): boolean;
  show(n: { title: string; body: string; onClick: () => void }): void;
}

export interface LogPort {
  info(record: Record<string, unknown>): void;
  warn(record: Record<string, unknown>): void;
  error(record: Record<string, unknown>): void;
}

export type AnnounceOutcome =
  | 'announced'
  | 'already-shown'
  | 'not-supported'
  | 'no-hide'
  | 'failed';

export function decideFirstHideAnnouncement(s: {
  windowWasHidden: boolean;
  alreadyShown: boolean;
  notificationsSupported: boolean;
}): Exclude<AnnounceOutcome, 'failed'> {
  if (!s.windowWasHidden) {
    return 'no-hide';
  }
  if (s.alreadyShown) {
    return 'already-shown';
  }
  if (!s.notificationsSupported) {
    return 'not-supported';
  }
  return 'announced';
}

export function createFirstHideAnnouncer(deps: {
  notice: NoticePort;
  latch: { hasShown(): boolean; markShown(): void };
  text: () => FirstHideText;
  show: () => void;
  log: LogPort;
}): { announceIfFirst(windowWasHidden: boolean): AnnounceOutcome } {
  return {
    announceIfFirst(windowWasHidden) {
      const outcome = decideFirstHideAnnouncement({
        windowWasHidden,
        alreadyShown: windowWasHidden ? deps.latch.hasShown() : false,
        notificationsSupported: windowWasHidden ? deps.notice.isSupported() : false,
      });
      if (outcome === 'not-supported') {
        deps.log.info({ event: 'shell.first_hide.not_supported' });
      }
      if (outcome !== 'announced') {
        return outcome;
      }
      try {
        const { title, body } = deps.text();
        deps.notice.show({ title, body, onClick: deps.show });
      } catch (err) {
        deps.log.error({ event: 'shell.first_hide.failed', err: String(err) });
        return 'failed';
      }
      deps.latch.markShown();
      return 'announced';
    },
  };
}

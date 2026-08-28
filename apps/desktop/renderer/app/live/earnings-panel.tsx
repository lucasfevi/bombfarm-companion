import type { ReactNode } from 'react';
import type { LiveEarnings } from '@bombfarm/contracts';
import { Button, formatCompactNumber, HelpTip, Panel, PanelHeader } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { formatCapturedAt } from '../../lib/format';
import type { ReachedLiveFreshness } from './freshness-line';
import { formatLiveDurationSeconds } from './format-live-duration';

const EM_DASH = '—';

/** The rolling window is capped at 600s (10 real minutes) and starts shorter — floored, not
 *  rounded up, so the label never claims more coverage than the figures actually rest on. */
function coverageMinutesLabel(coverageSeconds: number): number {
  return Math.min(10, Math.max(1, Math.floor(coverageSeconds / 60)));
}

function rateCell(value: number | null | undefined): ReactNode {
  return value == null ? EM_DASH : `${formatCompactNumber(value, 1)}/h`;
}

export function EarningsPanel({
  freshness,
  earnings,
  onReset,
}: {
  freshness: ReachedLiveFreshness;
  earnings: LiveEarnings | null;
  onReset: () => void;
}) {
  const t = useCopy();

  const sessionSeconds = earnings?.sessionSeconds ?? 0;
  const coverageSeconds = earnings?.coverageSeconds ?? 0;
  const recentLabel = sub(t.liveEarningsColumnRecent, { minutes: coverageMinutesLabel(coverageSeconds) });

  const balance = earnings?.goldBalance ?? null;
  // While the stream is live, the balance comes straight from the tick. Otherwise it is the
  // frozen last-known reading — shown alongside how long it has been frozen for, the same
  // posture the app already takes with restored data (`formatCapturedAt`).
  const currentGold: ReactNode =
    balance === null
      ? EM_DASH
      : freshness.kind === 'live'
        ? formatCompactNumber(balance, 1)
        : `${formatCompactNumber(balance, 1)} · ${formatCapturedAt(freshness.sinceAt, t)}`;

  return (
    <Panel data-testid="live-earnings">
      <PanelHeader title={t.liveEarningsTitle}>
        <span className="flex items-center gap-3 text-xs text-muted">
          <span data-testid="live-earnings-session-duration">
            {sub(t.liveEarningsSessionDurationValue, { duration: formatLiveDurationSeconds(sessionSeconds) })}
          </span>
          <Button type="button" variant="ghost" data-testid="live-earnings-reset" onClick={onReset}>
            {t.liveEarningsResetAction}
          </Button>
        </span>
      </PanelHeader>
      <table className="w-full table-fixed border-collapse text-sm">
        <caption className="sr-only">{t.liveEarningsTitle}</caption>
        <colgroup>
          <col />
          <col className="w-20" />
          <col className="w-48" />
          <col className="w-20" />
        </colgroup>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" />
            <th scope="col" data-testid="live-earnings-column-current">
              {t.liveEarningsColumnCurrent}
            </th>
            <th scope="col" data-testid="live-earnings-column-recent">
              {recentLabel}
            </th>
            <th scope="col" data-testid="live-earnings-column-session">
              {t.liveEarningsColumnSession}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="text-left font-normal">
              {t.liveEarningsRowGold}
            </th>
            <td data-testid="live-earnings-gold-current" className="tabular-nums">
              {currentGold}
            </td>
            <td data-testid="live-earnings-gold-10" className="tabular-nums">
              {rateCell(earnings?.gold10)}
            </td>
            <td data-testid="live-earnings-gold-session" className="tabular-nums">
              {rateCell(earnings?.goldSession)}
            </td>
          </tr>
          <tr>
            <th scope="row" className="text-left font-normal">
              <span className="inline-flex items-center gap-1">
                {t.liveEarningsRowXp}
                <HelpTip label={t.liveEarningsXpHelpLabel}>{t.liveEarningsXpHelpBody}</HelpTip>
              </span>
            </th>
            <td data-testid="live-earnings-xp-current" className="tabular-nums">
              {EM_DASH}
            </td>
            <td data-testid="live-earnings-xp-10" className="tabular-nums">
              {rateCell(earnings?.xp10)}
            </td>
            <td data-testid="live-earnings-xp-session" className="tabular-nums">
              {rateCell(earnings?.xpSession)}
            </td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

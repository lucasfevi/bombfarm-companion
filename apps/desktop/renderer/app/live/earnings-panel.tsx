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
  const balanceCapturedAt = earnings?.goldBalanceCapturedAt ?? null;
  // A stored-reading fallback ages by its own capture time; a tick-frozen balance instead ages by
  // the stream's own gap (`freshness.sinceAt`). The two never both apply — the main process only
  // ever populates one of `goldBalance`'s two sources at a time.
  const currentGold: ReactNode =
    balance === null
      ? EM_DASH
      : balanceCapturedAt !== null
        ? `${formatCompactNumber(balance, 1)} · ${formatCapturedAt(balanceCapturedAt, t)}`
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
      <table className="w-full min-w-[28rem] table-fixed border-collapse text-sm">
        <caption className="sr-only">{t.liveEarningsTitle}</caption>
        {/* Percentage widths, not content-fitted px: no column may resize as the coverage label
            grows from its shortest form toward "Last 10 min" / "Últimos 10 min", or as the
            current-balance cell gains an age suffix once the stream gaps (docs/no-layout-shift.md
            rule 7, docs/content-fit-ui.md rule 1 — sized for the longer of the two languages and
            the longest realistic value, a compact balance plus its age). */}
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[30%]" />
          <col className="w-[26%]" />
          <col className="w-[20%]" />
        </colgroup>
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" />
            <th scope="col" data-testid="live-earnings-column-current" className="whitespace-nowrap">
              {t.liveEarningsColumnCurrent}
            </th>
            <th scope="col" data-testid="live-earnings-column-recent" className="whitespace-nowrap">
              {recentLabel}
            </th>
            <th scope="col" data-testid="live-earnings-column-session" className="whitespace-nowrap">
              {t.liveEarningsColumnSession}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="text-left font-normal whitespace-nowrap">
              {t.liveEarningsRowGold}
            </th>
            <td data-testid="live-earnings-gold-current" className="tabular-nums whitespace-nowrap">
              {currentGold}
            </td>
            <td data-testid="live-earnings-gold-10" className="tabular-nums whitespace-nowrap">
              {rateCell(earnings?.gold10)}
            </td>
            <td data-testid="live-earnings-gold-session" className="tabular-nums whitespace-nowrap">
              {rateCell(earnings?.goldSession)}
            </td>
          </tr>
          <tr>
            <th scope="row" className="text-left font-normal whitespace-nowrap">
              <span className="inline-flex items-center gap-1">
                {t.liveEarningsRowXp}
                <HelpTip label={t.liveEarningsXpHelpLabel}>{t.liveEarningsXpHelpBody}</HelpTip>
              </span>
            </th>
            <td data-testid="live-earnings-xp-current" className="tabular-nums whitespace-nowrap">
              {EM_DASH}
            </td>
            <td data-testid="live-earnings-xp-10" className="tabular-nums whitespace-nowrap">
              {rateCell(earnings?.xp10)}
            </td>
            <td data-testid="live-earnings-xp-session" className="tabular-nums whitespace-nowrap">
              {rateCell(earnings?.xpSession)}
            </td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

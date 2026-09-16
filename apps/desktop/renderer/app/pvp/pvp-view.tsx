'use client';

/**
 * The PVP screen: every duel the app saw settle while it was open, newest first, and whether each
 * one's film is held. The list is what the game reported — nothing on it is predicted, and a duel
 * the app was closed for is not on it, because the tap was not there to see it.
 */
import type { PvpDuelRow, PvpHistoryResult } from '@bombfarm/contracts';
import { cn, colClass, DataTable, EmptyState, HelpTip, Panel, PanelHeader } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCapturedAt, formatCount } from '../../lib/format';
import { formatPointsDelta, latestQuota } from '../../lib/pvp/pvp-rows';
import { usePvpHistory } from '../../lib/pvp/use-pvp-history';

/** Twelve rows under the sticky header before the table scrolls: a session's quota several
 *  times over, and the screen still keeps its footnote in view. */
const TABLE_MAX_ROWS = 12;

export function PvpView() {
  const state = usePvpHistory();
  const history = state.status === 'ready' ? state.history : null;

  return (
    <div data-testid="pvp-view" data-state={state.status} className={colClass}>
      <DuelHistoryPanel history={history} />
    </div>
  );
}

function DuelHistoryPanel({ history }: { history: PvpHistoryResult | null }) {
  const t = useCopy();
  const { locale } = useLocale();
  const quota = history === null ? null : latestQuota(history);
  const empty = history === null || history.rows.length === 0;

  return (
    <Panel data-testid="pvp-history" data-state={empty ? 'empty' : 'duels'}>
      <PanelHeader title={t.pvpTitle}>
        {history !== null && !empty ? (
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-xs tabular-nums text-muted">
            <span data-testid="pvp-summary">
              {sub(t.pvpSummary, {
                duels: formatCount(history.totals.duels, locale),
                won: formatCount(history.totals.won, locale),
                films: formatCount(history.totals.films, locale),
              })}
            </span>
            {quota !== null ? (
              <span data-testid="pvp-quota">{sub(t.pvpQuota, { left: quota.left, max: quota.max })}</span>
            ) : null}
          </span>
        ) : null}
      </PanelHeader>
      {empty ? (
        <EmptyState title={t.pvpEmptyTitle} description={t.pvpEmptyDescription} headingLevel={3} />
      ) : (
        <div className="flex flex-col gap-2">
          <DataTable.Root scrollable maxRows={TABLE_MAX_ROWS}>
            <DataTable.Table>
              <DataTable.Caption>{t.pvpCaption}</DataTable.Caption>
              <DataTable.Head>
                <DataTable.Row>
                  <DataTable.Header scope="col">{t.pvpColumnWhen}</DataTable.Header>
                  <DataTable.Header scope="col">{t.pvpColumnOpponent}</DataTable.Header>
                  <DataTable.Header scope="col">{t.pvpColumnResult}</DataTable.Header>
                  <DataTable.Header scope="col" align="right">
                    <span className="inline-flex items-center gap-1">
                      {t.pvpColumnScore}
                      <HelpTip label={t.pvpColumnScore}>{t.pvpScoreHint}</HelpTip>
                    </span>
                  </DataTable.Header>
                  <DataTable.Header scope="col" align="right">
                    <span className="inline-flex items-center gap-1">
                      {t.pvpColumnPhase}
                      <HelpTip label={t.pvpColumnPhase}>{t.pvpPhaseHint}</HelpTip>
                    </span>
                  </DataTable.Header>
                  <DataTable.Header scope="col" align="right">
                    {t.pvpColumnPoints}
                  </DataTable.Header>
                  <DataTable.Header scope="col">{t.pvpColumnPrize}</DataTable.Header>
                  <DataTable.Header scope="col">{t.pvpColumnFilm}</DataTable.Header>
                </DataTable.Row>
              </DataTable.Head>
              <DataTable.Body data-testid="pvp-history-body">
                {history.rows.map((row) => (
                  <DuelRow key={row.id} row={row} />
                ))}
              </DataTable.Body>
            </DataTable.Table>
          </DataTable.Root>
          <p className="m-0 text-xs text-muted" data-testid="pvp-film-note">
            {t.pvpFilmNote}
          </p>
        </div>
      )}
    </Panel>
  );
}

function DuelRow({ row }: { row: PvpDuelRow }) {
  const t = useCopy();
  const { locale } = useLocale();

  return (
    <DataTable.Row data-testid="pvp-duel-row" data-duel-id={row.id} data-film-stored={row.filmStored ? 'true' : 'false'}>
      <DataTable.RowHeader>{formatCapturedAt(row.recordedAt, t)}</DataTable.RowHeader>
      <DataTable.Cell nowrap={false}>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="truncate" data-testid="pvp-opponent">
            {row.defender.name}
          </span>
          <span className="shrink-0 text-xs text-muted">{sub(t.pvpOpponentHeroes, { n: row.defender.heroes })}</span>
        </span>
      </DataTable.Cell>
      <DataTable.Cell>
        <span data-testid="pvp-result" className={cn('font-semibold', row.won ? 'text-up' : 'text-down')}>
          {row.won ? t.pvpResultWon : t.pvpResultLost}
        </span>
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric data-testid="pvp-score">
        {sub(t.pvpScore, {
          yours: formatCount(row.attacker.score, locale),
          theirs: formatCount(row.defender.score, locale),
        })}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        <span className="flex flex-col items-end">
          <span data-testid="pvp-phase">{formatCount(row.phase, locale)}</span>
          <span className="font-sans text-xs text-muted" data-testid="pvp-tier-floor">
            {sub(t.pvpTierFloor, { tier: row.tier, floor: formatCount(row.tierFloor, locale) })}
          </span>
        </span>
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        <span className="flex items-baseline justify-end gap-2">
          <span data-testid="pvp-points">
            {sub(t.pvpPoints, {
              before: formatCount(row.pointsBefore, locale),
              after: formatCount(row.pointsAfter, locale),
            })}
          </span>
          <span
            data-testid="pvp-points-delta"
            className={cn('text-xs', row.pointsAfter >= row.pointsBefore ? 'text-up' : 'text-down')}
          >
            {formatPointsDelta(row, locale)}
          </span>
        </span>
      </DataTable.Cell>
      <DataTable.Cell nowrap={false} data-testid="pvp-prize" className={row.prize === 'lost' ? 'text-warn' : undefined}>
        {row.prize === 'won' ? t.pvpPrizeWon : t.pvpPrizeLost}
      </DataTable.Cell>
      <DataTable.Cell data-testid="pvp-film" className={row.filmStored ? undefined : 'text-muted'}>
        {row.filmStored ? t.pvpFilmStored : t.pvpFilmMissing}
      </DataTable.Cell>
    </DataTable.Row>
  );
}

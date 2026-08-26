import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import type { LiveFastModel, LiveHeroFact, LiveRecoveringHeroFact, LiveSlowModel } from '../../lib/live/live-model';
import { FieldCountdown } from './field-countdown';
import { FreshnessLine, type ReachedLiveFreshness } from './freshness-line';
import { HeroList } from './hero-list';
import { HousePanel } from './house-panel';
import { OccupancyReadout } from './occupancy-readout';
import { RecoveryCountdown } from './recovery-countdown';

export function LivePanel({
  freshness,
  slow,
  fast,
  onReopenConsent,
}: {
  freshness: ReachedLiveFreshness;
  slow: LiveSlowModel;
  fast: LiveFastModel;
  onReopenConsent?: () => void;
}) {
  const t = useCopy();
  const { locale } = useLocale();

  return (
    <div data-testid="live-panel" className="flex flex-col gap-4">
      <FreshnessLine freshness={freshness} onReopenConsent={onReopenConsent} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HousePanel house={slow.house} />
        <OccupancyReadout occupancy={slow.occupancy} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HeroList
          testId="live-list-on-field"
          title={t.liveListOnFieldTitle}
          emptyLine={t.liveListEmptyLine}
          heroes={slow.onField}
          renderTrailing={(hero: LiveHeroFact) => (
            <span className="flex items-center gap-1">
              <span className="sr-only">{t.liveFieldCountdownLabel}</span>
              <FieldCountdown testId={`live-countdown-field-${hero.id}`} model={fast.field[hero.id]} />
            </span>
          )}
        />
        <HeroList
          testId="live-list-recovering"
          title={t.liveListRecoveringTitle}
          emptyLine={t.liveListEmptyLine}
          heroes={slow.recovering}
          renderTrailing={(hero: LiveRecoveringHeroFact) => (
            <span className="flex items-center gap-1">
              <span className="sr-only">{t.liveRecoveryCountdownLabel}</span>
              <RecoveryCountdown testId={`live-countdown-recovery-${hero.id}`} model={fast.recovery[hero.id]} />
            </span>
          )}
        />
        <HeroList testId="live-list-queued" title={t.liveListQueuedTitle} emptyLine={t.liveListEmptyLine} heroes={slow.queued} />
        <HeroList testId="live-list-benched" title={t.liveListBenchedTitle} emptyLine={t.liveListEmptyLine} heroes={slow.benched} />
      </div>
      {slow.unclassifiedCount > 0 ? (
        <p data-testid="live-unclassified-count" className="m-0 text-xs text-muted">
          {sub(t.liveUnclassifiedCount, { n: formatCount(slow.unclassifiedCount, locale) })}
        </p>
      ) : null}
      {slow.fieldExitPendingCount > 0 ? (
        <p data-testid="live-field-exit-pending-count" className="m-0 text-xs text-muted">
          {sub(t.liveFieldExitPendingCount, { n: formatCount(slow.fieldExitPendingCount, locale) })}
        </p>
      ) : null}
      <p data-testid="live-countdown-legend" className="m-0 text-xs text-muted">
        {t.liveCountdownLegend}
      </p>
    </div>
  );
}

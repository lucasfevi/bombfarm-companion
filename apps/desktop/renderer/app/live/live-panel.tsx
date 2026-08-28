import { Panel, PanelHeader } from '@bombfarm/ui';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import type { LiveEarnings } from '@bombfarm/contracts';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import type { LiveFastModel, LiveHeroFact, LiveRecoveringHeroFact, LiveSlowModel } from '../../lib/live/live-model';
import { EarningsPanel } from './earnings-panel';
import { FieldCountdown } from './field-countdown';
import { FreshnessLine, type ReachedLiveFreshness } from './freshness-line';
import { HeroSection } from './hero-section';
import { RecoveryCountdown } from './recovery-countdown';
import { restingFacts, restingSlotsCount, restingSlotsHint } from './resting-facts';

export function LivePanel({
  freshness,
  slow,
  fast,
  earnings = null,
  onResetEarnings = () => undefined,
  onReopenConsent,
}: {
  freshness: ReachedLiveFreshness;
  slow: LiveSlowModel;
  fast: LiveFastModel;
  earnings?: LiveEarnings | null;
  onResetEarnings?: () => void;
  onReopenConsent?: () => void;
}) {
  const t = useCopy();
  const { locale } = useLocale();

  const { occupied, fieldSize } = slow.occupancy;
  const onFieldCount =
    fieldSize !== undefined
      ? `${formatCount(occupied, locale)}/${formatCount(fieldSize, locale)}`
      : formatCount(occupied, locale);
  // Silent when the field size was never sent: a hint to buy more slots, beside a cap the app
  // does not actually know, is advice given without the fact it rests on.
  const fieldSlotsHint = fieldSize !== undefined && fieldSize < FIELD_SLOTS_MAX ? t.liveFieldSlotsHint : undefined;

  return (
    <div data-testid="live-panel" className="flex flex-col gap-4">
      <FreshnessLine freshness={freshness} onReopenConsent={onReopenConsent} />
      <EarningsPanel freshness={freshness} earnings={earnings} onReset={onResetEarnings} />
      <Panel data-testid="live-heroes">
        <PanelHeader title={t.liveHeroesTitle} />
        <div className="flex flex-col gap-4">
          <HeroSection
            testId="live-list-on-field"
            title={t.liveListOnFieldTitle}
            count={onFieldCount}
            hint={fieldSlotsHint}
            emptyLine={t.liveListEmptyLine}
            heroes={slow.onField}
            renderTrailing={(hero: LiveHeroFact) => (
              <span className="flex items-center gap-1">
                <span className="sr-only">{t.liveFieldCountdownLabel}</span>
                <FieldCountdown testId={`live-countdown-field-${hero.id}`} model={fast.field[hero.id]} />
              </span>
            )}
          />
          <HeroSection
            testId="live-list-recovering"
            title={t.liveListRecoveringTitle}
            count={restingSlotsCount(slow.recovering.length, slow.house, locale)}
            hint={restingSlotsHint(slow.house, t)}
            facts={restingFacts(slow.house, t, locale)}
            emptyLine={t.liveListEmptyLine}
            heroes={slow.recovering}
            renderTrailing={(hero: LiveRecoveringHeroFact) => (
              <span className="flex items-center gap-1">
                <span className="sr-only">{t.liveRecoveryCountdownLabel}</span>
                <RecoveryCountdown testId={`live-countdown-recovery-${hero.id}`} model={fast.recovery[hero.id]} />
              </span>
            )}
          />
          <HeroSection testId="live-list-queued" title={t.liveListQueuedTitle} emptyLine={t.liveListEmptyLine} heroes={slow.queued} />
          <HeroSection testId="live-list-benched" title={t.liveListBenchedTitle} emptyLine={t.liveListEmptyLine} heroes={slow.benched} muted />
        </div>
      </Panel>
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
    </div>
  );
}

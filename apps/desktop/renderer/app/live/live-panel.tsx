import { Panel, PanelHeader } from '@bombfarm/ui';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import type { LiveEarnings } from '@bombfarm/contracts';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import type { LiveFastModel, LiveHeroFact, LiveSlowModel } from '../../lib/live/live-model';
import { EarningsPanel } from './earnings-panel';
import { FieldCountdown } from './field-countdown';
import { FreshnessLine, type ReachedLiveFreshness } from './freshness-line';
import { HeroRow, type LiveRotationRowState } from './hero-row';
import { RecoveryCountdown } from './recovery-countdown';
import { restingFacts, restingSlotsCount, restingSlotsHint } from './resting-facts';
import { StateSummaryBar } from './state-summary-bar';

interface LiveRow {
  readonly id: string;
  readonly state: LiveRotationRowState;
  readonly hero: LiveHeroFact;
}

/** One list in state order — field, then resting, then idle, then benched — concatenating each
 *  group without re-sorting inside it, so the classifier's own within-group order survives. */
function buildRows(slow: LiveSlowModel): readonly LiveRow[] {
  return [
    ...slow.onField.map((hero): LiveRow => ({ id: hero.id, state: 'on-field', hero })),
    ...slow.recovering.map((hero): LiveRow => ({ id: hero.id, state: 'recovering', hero })),
    ...slow.queued.map((hero): LiveRow => ({ id: hero.id, state: 'queued', hero })),
    ...slow.benched.map((hero): LiveRow => ({ id: hero.id, state: 'benched', hero })),
  ];
}

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

  const rows = buildRows(slow);

  return (
    <div data-testid="live-panel" className="flex flex-col gap-4">
      <FreshnessLine freshness={freshness} onReopenConsent={onReopenConsent} />
      {/* The earnings panel's own reserved content is ~587px now that its headline column's own
          overflow fix narrowed it by 8px (140px to 132px); at this grid's 16px gap and the
          shell's 48px of side padding, a column only clears that once the window itself is at
          least 1334px (587 * 2 + 16 + 48 = 1238, rounded up for headroom — 16px below the
          previous 1350, the same 8px the column narrowed by, counted on both sides of the split)
          — `lg`'s 1024px default promoted it to half-width some 200+px too early, which is what
          let it overflow. */}
      <div className="grid grid-cols-1 gap-4 min-[1334px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <EarningsPanel freshness={freshness} earnings={earnings} onReset={onResetEarnings} />
      </div>
      <Panel data-testid="live-heroes">
        <PanelHeader title={t.liveHeroesTitle} />
        <div className="flex flex-col gap-3">
          <StateSummaryBar
            onFieldCount={onFieldCount}
            onFieldHint={fieldSlotsHint}
            recoveringCount={restingSlotsCount(slow.recovering.length, slow.house, locale)}
            recoveringHint={restingSlotsHint(slow.house, t)}
            recoveringFacts={restingFacts(slow.house, t, locale)}
            queuedCount={formatCount(slow.queued.length, locale)}
            benchedCount={formatCount(slow.benched.length, locale)}
          />
          {rows.length === 0 ? (
            <p data-testid="live-hero-list-empty" className="m-0 text-sm text-muted">
              {t.liveListEmptyLine}
            </p>
          ) : (
            <ul data-testid="live-hero-list" className="m-0 flex list-none flex-col gap-1 p-0">
              {rows.map((row) => (
                <HeroRow
                  key={row.id}
                  state={row.state}
                  hero={row.hero}
                  muted={row.state === 'benched'}
                  trailing={
                    row.state === 'on-field' ? (
                      <>
                        <span className="sr-only">{t.liveFieldCountdownLabel}</span>
                        <FieldCountdown testId={`live-countdown-field-${row.hero.id}`} model={fast.field[row.hero.id]} />
                      </>
                    ) : row.state === 'recovering' ? (
                      <>
                        <span className="sr-only">{t.liveRecoveryCountdownLabel}</span>
                        <RecoveryCountdown testId={`live-countdown-recovery-${row.hero.id}`} model={fast.recovery[row.hero.id]} />
                      </>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
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

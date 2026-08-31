import { useMemo } from 'react';
import { Panel, PanelHeader } from '@bombfarm/ui';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import type { LiveEarnings, LiveMap } from '@bombfarm/contracts';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import type { LiveFastModel, LiveHeroFact, LiveSlowModel } from '../../lib/live/live-model';
import { EarningsPanel } from './earnings-panel';
import { FieldCountdown } from './field-countdown';
import { FreshnessLine, type ReachedLiveFreshness } from './freshness-line';
import { HeroRow, type LiveRotationRowState } from './hero-row';
import { MapPanel } from './map-panel';
import { RecoveryCountdown } from './recovery-countdown';
import { restingFacts, restingSlotsCount, restingSlotsHint } from './resting-facts';
import { StateSummaryBar } from './state-summary-bar';

interface LiveRow {
  readonly id: string;
  readonly state: LiveRotationRowState;
  readonly hero: LiveHeroFact;
  /** The fast channel's reading for this hero, when it has one — see `HeroRow`'s own prop for why
   *  it travels beside the hero rather than merged into it. */
  readonly energyFraction: number | undefined;
}

/**
 * How far the measured gold-per-prop sits from what this map is modelled to pay, as a signed
 * fraction. Computed here because this is the one place holding both panels' data — the earnings
 * panel is not handed the map to reach into.
 *
 * `null` unless both figures exist and the estimate is positive: dividing by a zero estimate is
 * not a deviation of any size, and the comparison is only worth printing when there are two
 * numbers to compare.
 */
function goldPerPropDeltaOf(earnings: LiveEarnings | null, map: LiveMap | null): number | null {
  const measured = earnings?.goldPerProp10 ?? null;
  const estimated = map?.economy?.averageGoldPerProp ?? null;
  if (measured === null || estimated === null || estimated <= 0) return null;
  return measured / estimated - 1;
}

/** One list in state order — field, then resting, then idle, then benched — concatenating each
 *  group without re-sorting inside it, so the classifier's own within-group order survives. */
function buildRows(slow: LiveSlowModel, fast: LiveFastModel): readonly LiveRow[] {
  const row = (hero: LiveHeroFact, state: LiveRotationRowState): LiveRow => ({
    id: hero.id,
    state,
    hero,
    energyFraction: fast.energy[hero.id],
  });
  return [
    ...slow.onField.map((hero) => row(hero, 'on-field')),
    ...slow.recovering.map((hero) => row(hero, 'recovering')),
    ...slow.queued.map((hero) => row(hero, 'queued')),
    ...slow.benched.map((hero) => row(hero, 'benched')),
  ];
}

export function LivePanel({
  freshness,
  slow,
  fast,
  earnings = null,
  map = null,
  onResetEarnings = () => undefined,
  onReopenConsent,
}: {
  freshness: ReachedLiveFreshness;
  slow: LiveSlowModel;
  fast: LiveFastModel;
  earnings?: LiveEarnings | null;
  map?: LiveMap | null;
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

  const rows = useMemo(() => buildRows(slow, fast), [slow, fast]);

  return (
    <div data-testid="live-panel" className="flex flex-col gap-4">
      <FreshnessLine freshness={freshness} onReopenConsent={onReopenConsent} />
      {/* `max-content` on the first track, not an equal split: everything in the earnings panel is
          fixed-width and `whitespace-nowrap`, so an equal split had to make BOTH columns as wide
          as that panel's ~566px, and the pair only fitted past 1334px — wider than the window's
          own default, which is why these two started life stacked on first launch. Sized to its
          content instead, the pair floors at ~945px in Portuguese (the wider of the two
          languages), under the 960px minimum window width, so this row is two columns at every
          size the window can take and needs no breakpoint at all. The map takes the remainder:
          its health bar and economy figures are the two that read better with the extra width. */}
      <div className="grid grid-cols-[max-content_minmax(0,1fr)] gap-4">
        <EarningsPanel
          freshness={freshness}
          earnings={earnings}
          goldPerPropDelta={goldPerPropDeltaOf(earnings, map)}
          onReset={onResetEarnings}
        />
        <MapPanel map={map} />
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
                  energyFraction={row.energyFraction}
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

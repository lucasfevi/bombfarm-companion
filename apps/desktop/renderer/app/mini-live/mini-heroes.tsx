import { useMemo } from 'react';
import { HeroAvatar, rarityTextClass } from '@bombfarm/game-art';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import { useCopy, useLocale } from '../../lib/copy';
import { formatCount, formatEnergyPercent } from '../../lib/format';
import type { LiveFastModel, LiveHeroFact, LiveSlowModel } from '../../lib/live/live-model';
import { FieldCountdown } from '../live/field-countdown';
import { RecoveryCountdown } from '../live/recovery-countdown';
import { restingFacts, restingSlotsCount, restingSlotsHint } from '../live/resting-facts';
import { StateSummaryBar } from '../live/state-summary-bar';
import type { LiveRotationRowState } from '../live/hero-row';

const NEUTRAL_RARITY_IDX = 2;

function energyDirectionOf(state: LiveRotationRowState): 'rising' | 'falling' | 'steady' {
  if (state === 'on-field') return 'falling';
  if (state === 'recovering') return 'rising';
  return 'steady';
}

function MiniEnergyBar({ testId, fraction }: { testId: string; fraction: number | undefined }) {
  const t = useCopy();
  const percent = fraction !== undefined ? Math.round(fraction * 100) : 0;

  return (
    <div data-testid={testId} className="min-w-0">
      <span className="sr-only">{t.liveEnergyLabel}</span>
      <div className="h-1 min-w-0 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-[color-mix(in_oklch,var(--accent)_55%,var(--bg-2))]"
          style={{ width: `${String(percent)}%` }}
        />
      </div>
    </div>
  );
}

function MiniHeroRow({
  state,
  hero,
  energyFraction,
  trailing,
}: {
  state: LiveRotationRowState;
  hero: LiveHeroFact;
  energyFraction: number | undefined;
  trailing?: React.ReactNode;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  const direction = energyDirectionOf(state);
  const name = hero.name ?? hero.id;
  const rarityClass = hero.rarity !== undefined ? rarityTextClass(hero.rarity) : 'text-ink';

  return (
    <li data-testid={`live-hero-row-${hero.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_3.5rem_4.5rem_auto] items-center gap-2 py-0.5">
      <HeroAvatar skin={hero.skin ?? 0} rarityIdx={hero.rarity ?? NEUTRAL_RARITY_IDX} size="xs" name={name} />
      <span data-testid={`live-hero-row-${hero.id}-name`} className={`truncate text-[11px] ${rarityClass}`}>
        {name}
      </span>
      <span data-testid={`live-hero-row-${hero.id}-energy`} className="text-right font-mono text-[10px] tabular-nums text-ink">
        {energyFraction === undefined ? t.valueNotAvailable : formatEnergyPercent(energyFraction, locale)}
      </span>
      <MiniEnergyBar testId={`live-hero-row-${hero.id}-energy-bar`} fraction={energyFraction} />
      <div className="min-w-[3.5rem] text-right font-mono text-[10px] tabular-nums text-muted">
        {direction === 'falling' ? <span aria-hidden>▾</span> : direction === 'rising' ? <span aria-hidden>▴</span> : null}
        {trailing}
      </div>
    </li>
  );
}

function buildRows(slow: LiveSlowModel, fast: LiveFastModel) {
  const row = (hero: LiveHeroFact, state: LiveRotationRowState) => ({
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

export function MiniHeroes({ slow, fast }: { slow: LiveSlowModel | null; fast: LiveFastModel }) {
  const t = useCopy();
  const { locale } = useLocale();

  if (slow === null) {
    return (
      <section data-testid="mini-heroes" aria-label={t.liveHeroesTitle} className="min-h-0 min-w-0 overflow-auto rounded-md border border-line/55 bg-surface p-2">
        <p data-testid="live-hero-list-empty" className="m-0 text-sm text-muted">
          {t.liveListEmptyLine}
        </p>
      </section>
    );
  }

  const { occupied, fieldSize } = slow.occupancy;
  const onFieldCount =
    fieldSize !== undefined
      ? `${formatCount(occupied, locale)}/${formatCount(fieldSize, locale)}`
      : formatCount(occupied, locale);
  const fieldSlotsHint = fieldSize !== undefined && fieldSize < FIELD_SLOTS_MAX ? t.liveFieldSlotsHint : undefined;
  const rows = useMemo(() => buildRows(slow, fast), [slow, fast]);

  return (
    <section
      data-testid="mini-heroes"
      aria-label={t.liveHeroesTitle}
      className="min-h-0 min-w-0 overflow-auto rounded-md border border-line/55 bg-surface p-2"
    >
      <div className="flex flex-col gap-2">
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
          <ul data-testid="live-hero-list" className="m-0 flex list-none flex-col gap-0.5 p-0">
            {rows.map((row) => (
              <MiniHeroRow
                key={row.id}
                state={row.state}
                hero={row.hero}
                energyFraction={row.energyFraction}
                trailing={
                  row.state === 'on-field' ? (
                    <FieldCountdown testId={`live-countdown-field-${row.hero.id}`} model={fast.field[row.hero.id]} />
                  ) : row.state === 'recovering' ? (
                    <RecoveryCountdown testId={`live-countdown-recovery-${row.hero.id}`} model={fast.recovery[row.hero.id]} />
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

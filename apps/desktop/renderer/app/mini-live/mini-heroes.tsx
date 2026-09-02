import { useMemo, type ReactNode } from 'react';
import { HeroAvatar, rarityTextClass } from '@bombfarm/game-art';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import { heroLevelLabel } from '@bombfarm/domain/game-labels';
import { useCopy, useLocale } from '../../lib/copy';
import { formatCount, formatEnergyPercent } from '../../lib/format';
import type { LiveFastModel, LiveHeroFact, LiveSlowModel } from '../../lib/live/live-model';
import { EnergyBar } from '../live/energy-bar';
import { FieldCountdown } from '../live/field-countdown';
import type { LiveRotationRowState } from '../live/hero-row';
import { RecoveryCountdown } from '../live/recovery-countdown';
import { restingFacts, restingSlotsCount, restingSlotsHint } from '../live/resting-facts';
import { StateSummaryBar } from '../live/state-summary-bar';

const NEUTRAL_RARITY_IDX = 2;
const EM_DASH = '—';

/**
 * Which rotation list the hero is in, as shape and colour together with the word carried for a
 * screen reader — the treatment `RowStateDot` gets on the full-size row, drawn in CSS shapes
 * rather than glyphs so nothing depends on font coverage at 8px. The colours match the summary
 * bar above, which is the legend, and at this width that bar scrolls out of view, so colour alone
 * would strand the reader with four indistinguishable dots. One literal per state, because the
 * shell's untranslated-prose guard reads a looked-up class string as player-facing text.
 */
function MiniStateMark({ state }: { state: LiveRotationRowState }) {
  const t = useCopy();

  if (state === 'on-field') {
    return (
      <>
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-up" />
        <span className="sr-only">{t.liveListOnFieldTitle}</span>
      </>
    );
  }
  if (state === 'recovering') {
    return (
      <>
        <span aria-hidden className="size-2 shrink-0 rounded-full border-2 border-info bg-transparent" />
        <span className="sr-only">{t.liveListRecoveringTitle}</span>
      </>
    );
  }
  if (state === 'queued') {
    return (
      <>
        <span aria-hidden className="size-2 shrink-0 rounded-[1px] bg-warn" />
        <span className="sr-only">{t.liveListQueuedTitle}</span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden className="h-0.5 w-2 shrink-0 rounded-full bg-muted" />
      <span className="sr-only">{t.liveListBenchedTitle}</span>
    </>
  );
}

/**
 * Two lines at a fixed height, so a row whose energy or countdown has not arrived is exactly as
 * tall as one whose has. Every absent reading prints a dash and hands the words to a screen
 * reader: this window gives each of those columns about four characters, and the absent-value
 * sentence wraps them onto a second line, which is the one thing a fixed height cannot absorb.
 *
 * The energy figure sits at the head of the bar it describes, in a slot wide enough for `100%`,
 * rather than at the row's right edge. Pinned to the edge it drifted away from its own hero as the
 * window widened — measured at 409px of empty space on a 557px window — and no two readings shared
 * a column to be compared down. Here it is a fixed distance from the meter it labels at every
 * width, and every row puts it in the same place.
 */
function MiniHeroRow({
  state,
  hero,
  energyFraction,
  trailing,
}: {
  state: LiveRotationRowState;
  hero: LiveHeroFact;
  energyFraction: number | undefined;
  trailing?: ReactNode;
}) {
  const t = useCopy();
  const { locale, lang } = useLocale();
  const name = hero.name ?? hero.id;
  // Rank, name and rarity arrive on one roster join, so a rank printed beside a bare hero id
  // would be half a join rendered as though it were whole.
  const rank = hero.name === undefined ? undefined : hero.grade?.trim();
  const rarityClass = hero.rarity !== undefined ? (rarityTextClass(hero.rarity) ?? 'text-ink') : 'text-ink';

  return (
    <li
      data-testid={`live-hero-row-${hero.id}`}
      className="grid h-9 grid-cols-[1.75rem_minmax(0,1fr)] grid-rows-2 items-center gap-x-1.5 rounded-sm px-1 odd:bg-[color-mix(in_oklch,var(--ink)_5%,transparent)]"
    >
      <span className="row-span-2">
        <HeroAvatar skin={hero.skin ?? 0} rarityIdx={hero.rarity ?? NEUTRAL_RARITY_IDX} size="xs" name={name} />
      </span>

      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="min-w-3 shrink-0 text-[10px] leading-none font-bold text-accent">{rank ?? ''}</span>
        <span
          data-testid={`live-hero-row-${hero.id}-name`}
          className="min-w-0 flex-1 truncate text-[11px] leading-none"
        >
          <span className={rarityClass}>{name}</span>
        </span>
        <span className="shrink-0">{trailing}</span>
      </span>

      <span className="flex min-w-0 items-center gap-1.5">
        <MiniStateMark state={state} />
        <span className="w-10 shrink-0 font-mono text-[10px] leading-none tabular-nums text-muted">
          {hero.level === undefined ? EM_DASH : heroLevelLabel(hero.level, lang)}
        </span>
        <span
          data-testid={`live-hero-row-${hero.id}-energy`}
          className="w-8 shrink-0 text-right font-mono text-[10px] leading-none tabular-nums text-ink"
        >
          {energyFraction === undefined ? (
            <>
              <span aria-hidden>{EM_DASH}</span>
              <span className="sr-only">{t.valueNotAvailable}</span>
            </>
          ) : (
            formatEnergyPercent(energyFraction, locale)
          )}
        </span>
        <span className="min-w-8 flex-1">
          <EnergyBar testId={`live-hero-row-${hero.id}-energy-bar`} fraction={energyFraction} />
        </span>
      </span>
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

  const { occupied, fieldSize } = slow?.occupancy ?? { occupied: 0, fieldSize: undefined };
  const onFieldCount =
    slow && fieldSize !== undefined
      ? `${formatCount(occupied, locale)}/${formatCount(fieldSize, locale)}`
      : formatCount(occupied, locale);
  const fieldSlotsHint =
    slow && fieldSize !== undefined && fieldSize < FIELD_SLOTS_MAX ? t.liveFieldSlotsHint : undefined;
  const rows = useMemo(() => (slow ? buildRows(slow, fast) : []), [slow, fast]);

  if (slow === null) {
    return (
      <section data-testid="mini-heroes" aria-label={t.liveHeroesTitle} className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md border border-line/55 bg-surface p-2">
        <p data-testid="live-hero-list-empty" className="m-0 text-sm text-muted">
          {t.liveListEmptyLine}
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="mini-heroes"
      aria-label={t.liveHeroesTitle}
      className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md border border-line/55 bg-surface p-2"
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
          <ul data-testid="live-hero-list" className="m-0 flex list-none flex-col p-0">
            {rows.map((row) => (
              <MiniHeroRow
                key={row.id}
                state={row.state}
                hero={row.hero}
                energyFraction={row.energyFraction}
                trailing={
                  row.state === 'on-field' ? (
                    <FieldCountdown
                      testId={`live-countdown-field-${row.hero.id}`}
                      model={fast.field[row.hero.id]}
                      size="compact"
                    />
                  ) : row.state === 'recovering' ? (
                    <RecoveryCountdown
                      testId={`live-countdown-recovery-${row.hero.id}`}
                      model={fast.recovery[row.hero.id]}
                      size="compact"
                    />
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

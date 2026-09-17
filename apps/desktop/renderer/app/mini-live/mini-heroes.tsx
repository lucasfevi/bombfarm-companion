import { useMemo, type ReactNode } from 'react';
import { HeroIdentity, type HeroPeekData } from '@bombfarm/game-art';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import { useCopy, useLocale } from '../../lib/copy';
import { formatCount, formatEnergyPercent } from '../../lib/format';
import type { LiveFastModel, LiveHeroFact, LiveSlowModel } from '../../lib/live/live-model';
import { useLiveHeroPeeks } from '../../lib/live/use-live-hero-peeks';
import { EnergyBar } from '../live/energy-bar';
import { FieldCountdown } from '../live/field-countdown';
import type { LiveRotationRowState } from '../live/hero-row';
import { RecoveryCountdown } from '../live/recovery-countdown';
import { restingFacts, restingSlotsCount, restingSlotsHint } from '../live/resting-facts';
import { StateSummaryBar } from '../live/state-summary-bar';

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
 * The identity block every roster surface draws, spanning two lines at a fixed height, with the
 * countdown above the state mark, the energy figure and its bar. Fixed, so a row whose energy or
 * countdown has not arrived is exactly as tall as one whose has: every absent reading prints a
 * dash and hands the words to a screen reader, because the absent-value sentence wraps a
 * four-character slot onto a second line, which is the one thing a fixed height cannot absorb.
 *
 * The energy figure sits at the head of the bar it describes, in a slot wide enough for `100%`,
 * and the bar is a fixed width so the pair sits at the same distance from the row's edge however
 * wide the window is dragged. Pinned to the edge on its own the reading drifted away from its own
 * hero as the window widened — measured at 409px of empty space on a 557px window — and no two
 * readings shared a column to be compared down.
 */
function MiniHeroRow({
  state,
  hero,
  energyFraction,
  peek,
  trailing,
}: {
  state: LiveRotationRowState;
  hero: LiveHeroFact;
  energyFraction: number | undefined;
  peek: HeroPeekData | undefined;
  trailing?: ReactNode;
}) {
  const t = useCopy();
  const { locale, lang } = useLocale();
  // Rank, name and rarity arrive on one roster join, so a rank printed beside a bare hero id
  // would be half a join rendered as though it were whole.
  const rank = hero.name === undefined ? undefined : hero.grade?.trim();

  return (
    <li
      data-testid={`live-hero-row-${hero.id}`}
      className="grid h-9 grid-cols-[minmax(0,1fr)_auto] grid-rows-2 items-center gap-x-1.5 rounded-sm px-1 odd:bg-[color-mix(in_oklch,var(--ink)_5%,transparent)]"
    >
      <span className="row-span-2 min-w-0">
        <HeroIdentity
          name={hero.name ?? hero.id}
          rank={rank}
          rarityIdx={hero.rarity}
          stars={hero.stars}
          level={hero.level}
          skin={hero.skin}
          lang={lang}
          size="xs"
          showRarity={false}
          nameTestId={`live-hero-row-${hero.id}-name`}
          peek={peek}
        />
      </span>

      <span className="flex justify-end">{trailing}</span>

      <span className="flex items-center justify-end gap-1.5">
        <MiniStateMark state={state} />
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
        <span className="w-14 shrink-0">
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
  const peekFor = useLiveHeroPeeks();

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
                peek={peekFor(row.hero.id)}
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

import { memo, type ReactNode } from 'react';
import { HeroAvatar, rarityTextClass } from '@bombfarm/game-art';
import { sub, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatEnergyPercent } from '../../lib/format';
import type { LiveHeroFact } from '../../lib/live/live-model';
import { EnergyBar } from './energy-bar';

export type LiveRotationRowState = 'on-field' | 'recovering' | 'queued' | 'benched';

/** `ArtFrame`'s own middle-of-the-road default — tints the avatar frame when the roster join has
 *  not caught up to this hero's rarity yet. */
const NEUTRAL_RARITY_IDX = 2;

/**
 * One literal per state rather than a computed class name: the shell's untranslated-prose guard
 * only tolerates a Tailwind string written directly as `className="…"`, so a class built from an
 * interpolated or looked-up token is reported as player-facing text.
 */
function RowStateDot({ state }: { state: LiveRotationRowState }) {
  if (state === 'on-field') return <span aria-hidden className="size-2 shrink-0 rounded-full bg-up" />;
  if (state === 'recovering') return <span aria-hidden className="size-2 shrink-0 rounded-full bg-info" />;
  if (state === 'queued') return <span aria-hidden className="size-2 shrink-0 rounded-full bg-warn" />;
  return <span aria-hidden className="size-2 shrink-0 rounded-full bg-muted" />;
}

/** The dot above is colour-only; this is what actually reaches a screen reader on every row —
 *  the summary bar above the list is the legend, but the state must still announce per row. */
function rowStateLabel(state: LiveRotationRowState, t: Copy): string {
  if (state === 'on-field') return t.liveListOnFieldTitle;
  if (state === 'recovering') return t.liveListRecoveringTitle;
  if (state === 'queued') return t.liveListQueuedTitle;
  return t.liveListBenchedTitle;
}

type EnergyDirection = 'rising' | 'falling' | 'steady';

/**
 * Which way a hero's energy is travelling, taken from the one thing that decides it: the list the
 * hero is in. On the field it is spent, resting it is recovered, and in every other state it holds
 * where it is.
 *
 * Read from the state rather than from consecutive readings. The fast channel republishes four
 * times a second while a whole percent takes seconds to move, so the difference between two frames
 * is zero far more often than it is the truth — a marker fed by it would sit at "steady" through
 * most of a drain it was drawn to report.
 */
function energyDirectionOf(state: LiveRotationRowState): EnergyDirection {
  if (state === 'on-field') return 'falling';
  if (state === 'recovering') return 'rising';
  return 'steady';
}

/**
 * The caret in front of the reading. Glyph and colour together, never colour alone, with the word
 * itself carried for a screen reader — the same three-part treatment `RowStateDot` gets, and one
 * literal per direction for the same reason it writes one per state.
 */
function EnergyDirectionMark({ direction }: { direction: EnergyDirection }) {
  const t = useCopy();

  if (direction === 'rising') {
    return (
      <>
        <span aria-hidden className="text-[13px] leading-none text-up">
          ▴
        </span>
        <span className="sr-only">{t.liveEnergyRisingLabel}</span>
      </>
    );
  }
  if (direction === 'falling') {
    return (
      <>
        <span aria-hidden className="text-[13px] leading-none text-down">
          ▾
        </span>
        <span className="sr-only">{t.liveEnergyFallingLabel}</span>
      </>
    );
  }
  return null;
}

/**
 * The energy reading beside the bar — its own fixed grid column (see `HeroRow`) rather than part
 * of `EnergyBar`, so this column's width never depends on whether the row also has a countdown.
 *
 * The caret sits inside this column but outside the reading's own element: the reading is the
 * figure and nothing else, and hanging the marker to its left keeps every percentage on the list
 * aligned on the same right edge whether or not its row has a direction to report.
 *
 * The figure is drawn in the mono face inside a slot as wide as its longest value, and that pair
 * is what holds the caret still. Neither half is optional. `DM Sans` ships no tabular figures —
 * `1` is barely half the width of `8`, and `font-variant-numeric: tabular-nums` has nothing to
 * switch on — so in the sans face the digits themselves change width as they count; and even in
 * the mono face `99%` is one character narrower than `100%`. Right-aligning a fixed slot pins the
 * left edge the caret sits against, so a hero crossing 100% moves nothing.
 *
 * No caret without a reading — direction is known for a hero the energy figure never arrived for,
 * but a marker printed against "not available" annotates a number that is not there. That branch
 * keeps the plain block: the absent-value copy is prose, and squeezing it into a four-character
 * slot would wrap it down the row.
 */
function EnergyReading({
  testId,
  fraction,
  direction,
}: {
  testId: string;
  fraction: number | undefined;
  direction: EnergyDirection;
}) {
  const t = useCopy();
  const { locale } = useLocale();

  if (fraction === undefined) {
    return (
      <span data-testid={testId} className="block text-right text-[10px] leading-none text-muted">
        {t.valueNotAvailable}
      </span>
    );
  }

  return (
    <span className="flex items-center justify-end gap-1 text-[10px] leading-none text-muted">
      <EnergyDirectionMark direction={direction} />
      <span data-testid={testId} className="inline-block w-[4ch] text-right font-mono">
        {formatEnergyPercent(fraction, locale)}
      </span>
    </span>
  );
}

/**
 * Everything in the row that the hero itself decides — the state dot, the identity block, the
 * energy bar and its reading. Split out and memoised because the fast channel republishes four
 * times a second while a hero's own facts move on the authenticated cycle, up to a minute apart:
 * without this, a tick that changed nothing but the gold balance re-rendered all of this for every
 * hero on the list. A Fragment, not a wrapper element — these are grid items of the `<li>` above
 * and an element around them would collapse five tracks into one.
 *
 * Memoising is only half of it, and was the half that bought nothing on its own: the props have to
 * be stable for it to bite. `energyFraction` arriving as a number rather than merged into the hero
 * is what makes that true here, and the store's per-slice identity rule is what makes the hero
 * itself survive a tick unchanged.
 */
const HeroRowBody = memo(function HeroRowBody({
  state,
  hero,
  energyFraction,
}: {
  state: LiveRotationRowState;
  hero: LiveHeroFact;
  energyFraction: number | undefined;
}) {
  const t = useCopy();
  // Name and grade arrive from the same roster join, so a grade without a name is half a join —
  // rendering it would put a rank letter beside a bare id as though both were known.
  const rank = hero.name !== undefined ? hero.grade?.trim() : undefined;
  const name = hero.name ?? hero.id;
  const nameColorClass = hero.rarity !== undefined ? (rarityTextClass(hero.rarity) ?? 'text-ink') : 'text-ink';
  const energyTestId = `live-energy-${hero.id}`;

  return (
    <>
      <span className="flex items-center">
        <RowStateDot state={state} />
        <span className="sr-only">{rowStateLabel(state, t)}</span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <HeroAvatar skin={hero.skin ?? 0} rarityIdx={hero.rarity ?? NEUTRAL_RARITY_IDX} size="xs" name={name} />
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <span className="flex min-w-0 items-baseline gap-1">
            {rank ? (
              <span className="shrink-0 text-[11px] leading-none font-black tracking-tight text-accent">{rank}</span>
            ) : (
              <span className="shrink-0 text-[11px] leading-none font-black tracking-tight text-muted">—</span>
            )}
            <span className="min-w-0 flex-1 truncate text-[12px] leading-none font-bold">
              <span data-testid={`live-hero-row-${hero.id}-name`} className={nameColorClass}>
                {name}
              </span>
            </span>
          </span>
          <span className="text-[10px] leading-none text-muted tabular-nums">
            {sub(t.liveHeroLevelValue, { level: hero.level ?? 0 })}
          </span>
        </span>
      </span>
      <EnergyBar testId={energyTestId} fraction={energyFraction} />
      <EnergyReading
        testId={`${energyTestId}-value`}
        fraction={energyFraction}
        direction={energyDirectionOf(state)}
      />
    </>
  );
});

export function HeroRow({
  state,
  hero,
  energyFraction,
  muted = false,
  trailing,
}: {
  state: LiveRotationRowState;
  hero: LiveHeroFact;
  /**
   * The live reading from the fast channel, which supersedes the hero's own. The snapshot's figure
   * is only replaced on the authenticated cycle — up to a minute apart — while the countdown drawn
   * beside it in this row moves four times a second; left to the snapshot, a hero whose rest has
   * finished would sit at `0:00` beside a bar still reading 99%.
   *
   * A separate prop rather than a hero merged with a fresh energy, because a number compares by
   * value and a merged hero compares by identity: passing the reading here is what lets one hero's
   * energy move without re-rendering the twelve rows around it.
   *
   * Omitted for a hero the fast channel does not reach — queued, benched — which keeps the
   * snapshot's own figure.
   */
  energyFraction?: number | undefined;
  /** Drains the row's colour — a hero who is out of the rotation entirely, not resting inside it. */
  muted?: boolean | undefined;
  trailing?: ReactNode;
}) {
  return (
    <li
      data-testid={`live-hero-row-${hero.id}`}
      data-muted={muted ? '' : undefined}
      className="grid grid-cols-[0.5rem_8rem_minmax(0,1fr)_3rem_4rem] items-center gap-2 rounded-sm border border-line bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-2 py-1 data-[muted]:opacity-60 data-[muted]:grayscale"
    >
      <HeroRowBody state={state} hero={hero} energyFraction={energyFraction ?? hero.energyFraction} />
      {trailing !== undefined ? <span className="flex items-center gap-1">{trailing}</span> : null}
    </li>
  );
}

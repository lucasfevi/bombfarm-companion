'use client';

/**
 * The roster as a rail of names beside the hero it is selecting.
 *
 * The board's counterpart, and the reason the two are one control rather than two: a rail answers
 * "who am I looking at" in a 19rem column, so it prints identity and one figure and nothing else.
 * Everything that decides WHICH heroes it prints, and in what order, is the toolbar's — this draws
 * the rows it is given.
 */
import { HeroIdentityChip, rosterInactiveChromeClass } from '@bombfarm/game-art';
import { Panel, cn, panelHClass, panelTitleClass } from '@bombfarm/ui';
import type { Lang, RosterBoardCopy } from '../../copy';
import { rollQualityText, type RosterHeroRow } from '../../model';

export function RosterRail({
  rows,
  selectedId,
  onSelectHeroId,
  t,
  lang,
}: {
  /** Already filtered and ordered, exactly as the board's are. */
  rows: readonly RosterHeroRow[];
  selectedId: string;
  onSelectHeroId: (heroId: string) => void;
  t: RosterBoardCopy;
  lang: Lang;
}) {
  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.heroesRosterTitle}</h2>
        <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">
          {t.heroesRollQualityLabel}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0" aria-label={t.heroesRosterListLabel}>
        {rows.map((row) => (
          <RosterRailRow
            key={row.id}
            row={row}
            lang={lang}
            selected={row.id === selectedId}
            onSelectHeroId={onSelectHeroId}
          />
        ))}
      </ul>
    </Panel>
  );
}

function RosterRailRow({
  row,
  lang,
  selected,
  onSelectHeroId,
}: {
  row: RosterHeroRow;
  lang: Lang;
  selected: boolean;
  onSelectHeroId: (heroId: string) => void;
}) {
  const inactiveChrome = row.hero.battleAllowed === false ? rosterInactiveChromeClass : undefined;

  return (
    <li>
      <button
        type="button"
        data-testid={`heroes-roster-row-${row.id}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => {
          onSelectHeroId(row.id);
        }}
        className={cn(
          'flex',
          'w-full',
          'min-w-0',
          'cursor-pointer',
          'items-center',
          'justify-between',
          'gap-2',
          'rounded-sm',
          'px-1.5',
          'py-1',
          'text-left',
          selected
            ? 'bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] shadow-[inset_3px_0_0_var(--accent)]'
            : 'hover:bg-[color-mix(in_oklch,var(--accent)_6%,transparent)]',
        )}
      >
        {/* A shelved hero is greyed here exactly as it is on the board and in the picker. The
            mute rides on the row's contents, never on the row's own selection chrome. */}
        <span className={cn('flex', 'min-w-0', 'flex-1', 'items-center', 'gap-2', inactiveChrome)}>
          <HeroIdentityChip hero={row.hero} fallbackName={row.hero.name} lang={lang} />
        </span>
        {/* Roll quality is a column players read down, and the sans face this app ships has no
            tabular figures — so the mono face is what actually keeps the digits in line. */}
        <span className={cn('shrink-0', 'font-mono', 'text-xs', 'tabular-nums', 'text-muted', inactiveChrome)}>
          {rollQualityText(row, lang)}
        </span>
      </button>
    </li>
  );
}

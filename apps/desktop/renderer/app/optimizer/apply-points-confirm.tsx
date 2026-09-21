'use client';

/**
 * The Reset points confirm — every hero of the plan on its own row, the ones the plan resets
 * switchable in and out, the ones it leaves alone said so. The primary press names the gold the
 * chosen respecs spend, which moves with the switches.
 *
 * The rows are their own component so a test can render them outside the dialog's portal, which
 * `renderToStaticMarkup` skips (no jsdom in this project).
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { HeroIdentityChip } from '@bombfarm/game-art';
import { Button, Dialog, Icon, Switch, cn, dialogDescClass } from '@bombfarm/ui';
import { sub, subNodes, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import type { RowSkipReason } from '../../lib/optimizer/apply-labels';
import { ForgeGold } from '../forge/forge-gold';

/** One hero of the plan as the confirm lists it. `index` is the points unit the hero maps to, or
 *  `null` when the plan resets nothing on this hero; `skipReason` is set when the preflight will
 *  skip the unit. Only a hero with a unit and no skip reason can be chosen. */
export type ApplyPointsConfirmHero = {
  readonly index: number | null;
  readonly hero: HeroRecord | undefined;
  readonly name: string;
  readonly needsRespec: boolean;
  readonly points: number;
  readonly gold: number;
  readonly skipReason: RowSkipReason | null;
};

export function isPointsConfirmHeroSelectable(hero: ApplyPointsConfirmHero): boolean {
  return hero.index !== null && hero.skipReason === null;
}

/** Every selectable hero, chosen — what the confirm opens with. */
export function initialPointsSelection(heroes: readonly ApplyPointsConfirmHero[]): ReadonlySet<number> {
  return new Set(heroes.filter(isPointsConfirmHeroSelectable).map((hero) => hero.index as number));
}

/** The gold the chosen respecs spend — a hero that only places unspent points adds nothing. */
export function pointsSelectionGold(heroes: readonly ApplyPointsConfirmHero[], selected: ReadonlySet<number>): number {
  return heroes
    .filter((hero) => hero.index !== null && selected.has(hero.index) && hero.needsRespec)
    .reduce((sum, hero) => sum + hero.gold, 0);
}

function rowSkipText(reason: RowSkipReason, t: Copy): string {
  switch (reason) {
    case 'itemMissing':
      return t.applySkipItemMissing;
    case 'heroMissing':
      return t.applySkipHeroMissing;
    case 'itemMoved':
      return t.applySkipItemMoved;
    case 'allocationChanged':
      return t.applySkipAllocationChanged;
    case 'notEnoughGold':
      return t.applySkipNotEnoughGold;
    case 'forgeAtTarget':
      return t.applySkipForgeAtTarget;
  }
}

function heroOutcome(hero: ApplyPointsConfirmHero, t: Copy, gold: (amount: number) => string): ReactNode {
  if (hero.skipReason !== null) {
    return <span className="text-warn">{sub(t.applyConfirmPointsSkipped, { reason: rowSkipText(hero.skipReason, t) })}</span>;
  }
  if (hero.index === null) return <span className="text-muted">{t.applyConfirmPointsNoRespec}</span>;
  if (!hero.needsRespec) {
    return (
      <span className="text-muted">
        {sub(t.applyConfirmPointsPlace, { points: hero.points })} · <span className="text-up">{t.applyLedgerFree}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-ink">
      {t.applyConfirmPointsRespec}
      <ForgeGold>{gold(hero.gold)}</ForgeGold>
    </span>
  );
}

export function ApplyPointsConfirmRows({
  heroes,
  selected,
  onToggle,
}: {
  heroes: readonly ApplyPointsConfirmHero[];
  selected: ReadonlySet<number>;
  onToggle: (index: number, checked: boolean) => void;
}) {
  const t = useCopy();
  const { lang, locale } = useLocale();
  const gold = (amount: number) => formatCount(amount, locale);
  return (
    <ul data-testid="apply-points-confirm-rows" className="m-0 flex list-none flex-col p-0">
      {heroes.map((hero) => {
        const selectable = isPointsConfirmHeroSelectable(hero);
        const checked = hero.index !== null && selected.has(hero.index);
        return (
          <li
            key={hero.index ?? `plain-${hero.name}`}
            data-testid="apply-points-confirm-row"
            data-selectable={selectable}
            data-selected={checked}
            className={cn('grid', 'grid-cols-[auto_minmax(0,1fr)_auto]', 'items-center', 'gap-x-3', 'border-t', 'border-line', 'py-2', 'first:border-t-0', selectable ? null : 'opacity-70')}
          >
            <Switch
              checked={checked}
              disabled={!selectable}
              onCheckedChange={(next) => {
                if (hero.index !== null) onToggle(hero.index, next);
              }}
              aria-label={sub(t.applyConfirmPointsSelectAria, { hero: hero.name })}
            />
            <HeroIdentityChip hero={hero.hero} fallbackName={hero.name} lang={lang} />
            <span className="text-[13px] tabular-nums">{heroOutcome(hero, t, gold)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ApplyPointsConfirm({
  open,
  heroes,
  queueRunning,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  heroes: readonly ApplyPointsConfirmHero[];
  queueRunning: boolean;
  onConfirm: (selected: ReadonlySet<number>) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => initialPointsSelection(heroes));

  useEffect(() => {
    if (open) setSelected(initialPointsSelection(heroes));
  }, [open, heroes]);

  const gold = pointsSelectionGold(heroes, selected);
  const chosen = heroes.filter((hero) => hero.index !== null && selected.has(hero.index)).length;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup className="!w-[min(92vw,34rem)]" data-testid="apply-points-confirm">
          <span className="absolute top-2 right-2">
            <Dialog.Close aria-label={t.applyConfirmCancel}>
              <Icon name="x-mark" />
            </Dialog.Close>
          </span>
          <Dialog.Head className="pr-6">
            <Dialog.Title>{t.applyConfirmPointsTitle}</Dialog.Title>
          </Dialog.Head>
          <p className={dialogDescClass}>
            {t.applyConfirmPointsBody}
            {queueRunning ? ` ${t.applyConfirmQueuePauses}` : null}
          </p>
          <Dialog.Body>
            <ApplyPointsConfirmRows
              heroes={heroes}
              selected={selected}
              onToggle={(index, checked) => {
                setSelected((current) => {
                  const next = new Set(current);
                  if (checked) next.add(index);
                  else next.delete(index);
                  return next;
                });
              }}
            />
          </Dialog.Body>
          <Dialog.Footer>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t.applyConfirmCancel}
            </Button>
            <Button
              type="button"
              variant="primary"
              data-testid="apply-points-confirm-press"
              disabled={chosen === 0}
              onClick={() => {
                onConfirm(selected);
                onOpenChange(false);
              }}
            >
              {subNodes(t.applyConfirmPoints, { gold: <ForgeGold>{formatCount(gold, locale)}</ForgeGold> })}
            </Button>
          </Dialog.Footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

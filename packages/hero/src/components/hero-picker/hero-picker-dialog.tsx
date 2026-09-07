'use client';

import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { Dialog, Icon, dialogDescClass } from '@bombfarm/ui';
import { sub, type Lang, type RosterCopy } from '../../copy';
import { HeroPickerTable } from './hero-picker-table';

/** Hero roster picker — wider than default import dialog for gear + ability icon columns. */
const heroPickerPopupClass = '!w-[min(96vw,1240px)]';

/**
 * Grouped rather than spread flat: the roster and the two writes over it are nine values, and the
 * picker is one control, not a screen. The same shape the board's own view takes.
 */
export type HeroPickerData = {
  heroes: HeroRecord[];
  heroId: string | null;
  formatNumber: (n: number, d?: number) => string;
};

export type HeroPickerActions = {
  onSelectHero: (hero: HeroRecord) => void;
  /**
   * Persisting a hero's planner enable/disable is the host's write, not the picker's — so a host
   * that has nowhere to persist it omits this, and the Status column disappears with it: no
   * header, no cell, no disabled switch standing in for a control that was never wired. The
   * picker is then what is left, which is a way to choose which hero to look at.
   */
  onSetBattleAllowed?: ((heroId: string, enabled: boolean) => void) | undefined;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Lang;
  t: RosterCopy;
  data: HeroPickerData;
  actions: HeroPickerActions;
};

export function HeroPickerDialogView({ open, onOpenChange, lang, t, data, actions }: Props) {
  const { heroes, heroId, formatNumber } = data;

  function pick(hero: HeroRecord) {
    actions.onSelectHero(hero);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup className={heroPickerPopupClass}>
          <Dialog.Head>
            <Dialog.Title>{t.switchHero}</Dialog.Title>
            <Dialog.Close aria-label={t.importClose}>
              <Icon name="x-mark" size="sm" />
            </Dialog.Close>
          </Dialog.Head>
          <p className={dialogDescClass}>{sub(t.switchHeroDesc, { n: heroes.length })}</p>
          <HeroPickerTable
            heroes={heroes}
            heroId={heroId}
            lang={lang}
            t={t}
            formatNumber={formatNumber}
            onPick={pick}
            onSetBattleAllowed={actions.onSetBattleAllowed}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

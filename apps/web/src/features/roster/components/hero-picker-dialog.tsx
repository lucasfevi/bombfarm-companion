'use client';

import { HiMiniXMark } from 'react-icons/hi2';
import type { HeroRecord } from '@/shared/lib/storage';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { Dialog } from '@bombfarm/ui';
import { dialogDescClass } from '@bombfarm/ui/panel-field.recipe';
import { HeroPickerTable } from './hero-picker-table';

/** Hero roster picker — wider than default import dialog for gear + ability icon columns. */
const heroPickerPopupClass = '!w-[min(94vw,980px)]';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  heroes: HeroRecord[];
  heroId: string | null;
  lang: Lang;
  t: Strings;
  formatNumber: (n: number, d?: number) => string;
  onSelectHero: (h: HeroRecord) => void;
};

export function HeroPickerDialog({
  open,
  onOpenChange,
  heroes,
  heroId,
  lang,
  t,
  formatNumber,
  onSelectHero,
}: Props) {
  function pick(hero: HeroRecord) {
    onSelectHero(hero);
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
              <HiMiniXMark size={16} aria-hidden="true" />
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
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

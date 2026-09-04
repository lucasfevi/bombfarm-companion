'use client';

import { HeroPickerDialogView } from '@bombfarm/hero/components';
import type { HeroRecord } from '@/shared/lib/storage';
import type { Lang, Strings } from '@/shared/i18n';
import { usePlannerStore } from '@/shared/stores';

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

/**
 * This app's connector for the shared picker. The picker's rows carry the planner enable/disable
 * switch, which is a store write; the view itself is prop-driven so the desktop app can render the
 * same dialog against its own state. Callers keep the props they always passed.
 */
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
  const setHeroBattleAllowedOnHero = usePlannerStore((state) => state.setHeroBattleAllowedOnHero);

  return (
    <HeroPickerDialogView
      open={open}
      onOpenChange={onOpenChange}
      lang={lang}
      t={t}
      data={{ heroes, heroId, formatNumber }}
      actions={{ onSelectHero, onSetBattleAllowed: setHeroBattleAllowedOnHero }}
    />
  );
}

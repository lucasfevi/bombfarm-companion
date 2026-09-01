'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useShallow } from 'zustand/react/shallow';
import { PhasesExplorerView, type HeroPickerSlotProps } from '@bombfarm/farm/components';
import { HeroPickerDialog } from '@/features/roster';
import type { HeroRecord } from '@/shared/lib/storage';
import type { Lang, Strings } from '@/shared/i18n';
import {
  usePlannerStore,
  selectHeroes,
  selectActiveHeroId,
  selectAccountShared,
  selectFarmBoardRows,
  selectPhasesViewPhase,
  commitActiveHero,
} from '@/shared/stores';

/**
 * This app's connector for the shared explorer. Every store read the subtree needs happens here
 * and nowhere below: `@bombfarm/farm/components` is prop-driven so the desktop app can render the
 * identical screen from its own state.
 *
 * `selectFarmBoardRows` is read WITHOUT `useShallow` — the same carve-out the board itself relies
 * on, since it returns a stable identity on a cache hit.
 */
export function PhasesExplorer({ t, lang }: { t: Strings; lang: Lang }) {
  const phase = usePlannerStore(selectPhasesViewPhase);
  const setPhasesViewPhase = usePlannerStore((state) => state.setPhasesViewPhase);
  const heroes = usePlannerStore(selectHeroes);
  const activeHeroId = usePlannerStore(selectActiveHeroId);
  const account = usePlannerStore(useShallow(selectAccountShared));
  const farmRows = usePlannerStore(selectFarmBoardRows);

  const selectHero = useCallback((hero: HeroRecord) => {
    commitActiveHero(hero);
  }, []);

  const slots = useMemo(
    () => ({
      emptyRosterAction: (
        <Link href="/" className="text-accent underline-offset-2 hover:underline">
          {t.navPlanner}
        </Link>
      ),
      renderPicker: (picker: HeroPickerSlotProps) => (
        <HeroPickerDialog {...picker} lang={lang} t={t} />
      ),
    }),
    [t, lang],
  );

  return (
    <PhasesExplorerView
      t={t}
      lang={lang}
      data={{ phase, heroes, activeHeroId, account, farmRows }}
      actions={{ setPhasesViewPhase, onSelectHero: selectHero }}
      slots={slots}
    />
  );
}

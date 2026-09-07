'use client';

import { useCallback, useMemo } from 'react';
import { HeroAbilitiesPanel, HeroIdentityRollPanel } from '@bombfarm/hero/components';
import { heroCopyFor } from '@bombfarm/hero/copy';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { colClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import {
  usePlannerStore,
  selectDraftHeroRecord,
  selectHeroAbilityGains,
  selectHeroRollQuality,
} from '@/shared/stores';
import { HeroAbilitiesTab } from './hero-abilities-tab';

/**
 * The workspace's Hero tab: who the hero is and how its birth roll landed, the ability editor it
 * has always carried, and what one more level of each ability is worth.
 *
 * The two shared panels are read-only by construction — they take no editing callbacks, so the
 * ability ranks stay editable in exactly one place.
 */
export function HeroTab() {
  const { t, lang } = useAppLang();
  const hero = usePlannerStore(selectDraftHeroRecord);
  const rollQuality = usePlannerStore(selectHeroRollQuality);
  const abilityGains = usePlannerStore(selectHeroAbilityGains);

  const heroCopy = useMemo(() => heroCopyFor(lang), [lang]);
  const statLabel = useCallback((key: SheetKey) => t.statFull[key], [t]);

  return (
    <div className={colClass}>
      <HeroIdentityRollPanel
        hero={hero}
        rollQuality={rollQuality}
        t={heroCopy}
        lang={lang}
        statLabel={statLabel}
      />
      <HeroAbilitiesTab />
      <HeroAbilitiesPanel hero={hero} abilityGains={abilityGains} t={heroCopy} lang={lang} />
    </div>
  );
}

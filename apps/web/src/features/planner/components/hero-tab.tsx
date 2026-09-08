'use client';

import { useCallback, useMemo } from 'react';
import { HeroAbilitiesPanel, HeroIdentityRollPanel } from '@bombfarm/hero/components';
import { heroCopyFor } from '@bombfarm/hero/copy';
import { RARITIES, type SheetKey } from '@bombfarm/domain/planner-constants';
import { colClass } from '@bombfarm/ui/panel-field.recipe';
import { resolveHeroPrice } from '@bombfarm/pricing';
import { useAppLang } from '@/shared/context/app-lang';
import { useMarketSnapshot } from '@/shared/hooks/use-market-snapshot';
import { formatMoney } from '@/shared/i18n';
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

  // A hero's market identity is its rarity alone, so this needs no item def — and the panel is
  // told the number, never the snapshot, so it stays free of the market vocabulary entirely.
  const { snapshot } = useMarketSnapshot();
  const marketPrice = useMemo(
    () => (hero == null ? null : resolveHeroPrice(
            { rarity: RARITIES.indexOf(hero.rarity), marketable: hero.marketable ?? false },
            snapshot,
          )),
    [hero, snapshot],
  );
  const formatAmount = useCallback(
    (value: number, currency: string) => formatMoney(value, lang, currency),
    [lang],
  );

  return (
    <div className={colClass}>
      <HeroIdentityRollPanel
        hero={hero}
        rollQuality={rollQuality}
        t={heroCopy}
        lang={lang}
        statLabel={statLabel}
        marketPrice={marketPrice}
        formatAmount={formatAmount}
      />
      <HeroAbilitiesTab />
      <HeroAbilitiesPanel hero={hero} abilityGains={abilityGains} t={heroCopy} lang={lang} />
    </div>
  );
}

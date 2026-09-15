'use client';

import { useCallback, useMemo } from 'react';
import { HeroAbilitiesPanel, HeroIdentityRollPanel } from '@bombfarm/hero/components';
import { heroCopyFor } from '@bombfarm/hero/copy';
import { RARITIES, type SheetKey } from '@bombfarm/domain/planner-constants';
import { colClass } from '@bombfarm/ui/panel-field.recipe';
import { resolveHeroPrice } from '@bombfarm/pricing';
import { useAppLang } from '@/shared/context/app-lang';
import { useMarketSnapshot } from '@/shared/hooks/use-market-snapshot';
import { MARKET_CURRENCY, formatMoney } from '@/shared/i18n';
import {
  usePlannerStore,
  selectDraftHeroRecord,
  selectHeroAbilityGains,
  selectHeroRollQuality,
} from '@/shared/stores';
import { useHeroBuildActions } from '../hooks/use-hero-build-actions';

/**
 * The workspace's Hero tab: who the hero is and how its birth roll landed, and one abilities panel
 * that both prices each ability's next level and lets you buy it.
 *
 * The abilities panel is the desktop's own, handed the editing callbacks the desktop does not
 * supply — so both apps draw one panel from one implementation, and only this one can write.
 */
export function HeroTab() {
  const { t, lang } = useAppLang();
  const { setAbilityLevel, resetAbilities } = useHeroBuildActions();
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
            MARKET_CURRENCY,
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
      <HeroAbilitiesPanel
        hero={hero}
        abilityGains={abilityGains}
        t={heroCopy}
        lang={lang}
        editing={{
          onAbilityLevel: setAbilityLevel,
          onReset: resetAbilities,
          resetLabel: t.reset,
          levelAbbrev: t.rankLv,
          tip: t.abilitiesTip,
        }}
      />
    </div>
  );
}

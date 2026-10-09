'use client';

import { useMemo, type ReactNode } from 'react';
import { HeroDataFlagProvider, type HeroDataFlagResolver } from '@bombfarm/game-art';
import { sub, useCopy, type Copy } from '../copy';
import { heroDataReasonsOf, type HeroDataReason } from './data-notices';
import { useAccountView } from './use-account-view';

const FIELD_COPY: Readonly<Record<string, keyof Copy>> = {
  level: 'dataFieldLevel',
  stars: 'dataFieldStars',
  stat_points_available: 'dataFieldStatPoints',
  birth_stats: 'dataFieldBirthStats',
  stats: 'dataFieldStats',
  rarity: 'dataFieldRarity',
  upgrade: 'dataFieldForgeLevel',
};

function fieldNames(fields: readonly string[], t: Copy): string {
  return fields.map((field) => (FIELD_COPY[field] === undefined ? field : t[FIELD_COPY[field]])).join(', ');
}

/** Every hero portrait in the window wears a flag when the game stopped sending a field that hero is built from. */
export function AccountHeroDataFlags({ children }: { children: ReactNode }) {
  const account = useAccountView();
  const t = useCopy();
  const payload = account.status === 'loaded' ? account.view.payload : null;
  const resolve = useMemo<HeroDataFlagResolver>(() => {
    const reasons: ReadonlyMap<string, HeroDataReason> = payload === null ? new Map() : heroDataReasonsOf(payload);
    return (heroId) => {
      const reason = reasons.get(heroId);
      if (reason === undefined) return undefined;
      const tip =
        reason.heroFields.length > 0
          ? sub(t.heroFlagFieldsTip, { fields: fieldNames(reason.heroFields, t) })
          : sub(t.heroFlagGearTip, { fields: fieldNames(reason.gearFields, t) });
      return { label: t.heroFlagLabel, tip };
    };
  }, [payload, t]);
  return <HeroDataFlagProvider resolve={resolve}>{children}</HeroDataFlagProvider>;
}

'use client';

import { sub } from '@/shared/i18n';
import { useAppLang } from '@/shared/context/app-lang';
import { Banner } from '@bombfarm/ui';
import { usePlannerStore, selectHeroesWithResetAdvice } from '@/shared/stores';

function joinHeroLabels(labels: string[], lang: 'en' | 'pt'): string {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) {
    return lang === 'pt' ? `${labels[0]} e ${labels[1]}` : `${labels[0]} and ${labels[1]}`;
  }
  const head = labels.slice(0, -1).join(', ');
  const last = labels[labels.length - 1];
  return lang === 'pt' ? `${head} e ${last}` : `${head}, and ${last}`;
}

/** Roster-wide Tier-1 reset gate — lists every hero that may benefit from Optimize build. */
export function ResetAdviceRosterBanner() {
  const { t, lang } = useAppLang();
  const rows = usePlannerStore(selectHeroesWithResetAdvice);
  if (rows.length === 0) return null;

  const names = joinHeroLabels(
    rows.map((row) => sub(t.resetAdviceRosterHero, { name: row.heroName, level: row.level })),
    lang,
  );

  return (
    <Banner layout="embedded" tone="warn">
      {sub(t.resetAdviceRosterBanner, { names })}
    </Banner>
  );
}

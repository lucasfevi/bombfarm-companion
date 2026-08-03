'use client';

import Link from 'next/link';
import { Panel } from '@bombfarm/ui';
import { phasesBoardRosterSpanClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';

export function PhasesEmptyRoster() {
  const { t } = useAppLang();

  return (
    <Panel className={phasesBoardRosterSpanClass}>
      <p className="m-0 text-sm text-muted">{t.phasesNoHeroes}</p>
      <p className="mt-2 mb-0 text-sm">
        <Link href="/" className="text-accent underline-offset-2 hover:underline">
          {t.navPlanner}
        </Link>
        {' — '}
        {t.phasesNoHeroesLink}
      </p>
    </Panel>
  );
}

'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { FarmRankingBoard, PhasesExplorer } from '@/features/phases';
import { workspaceClass } from '@bombfarm/ui/panel-field.recipe';

export default function PhasesPage() {
  const { t, lang } = useAppLang();

  return (
    <div className={workspaceClass}>
      <FarmRankingBoard t={t} lang={lang} />
      <PhasesExplorer t={t} lang={lang} />
    </div>
  );
}

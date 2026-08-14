'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { PhasesExplorer } from '@/features/phases';
import { workspaceClass } from '@bombfarm/ui/panel-field.recipe';

export default function PhasesPage() {
  const { t, lang } = useAppLang();

  return (
    <div className={workspaceClass}>
      <PhasesExplorer t={t} lang={lang} />
    </div>
  );
}

'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { TeamPlanPage } from '@/features/team-plan';
import { usePlannerStore } from '@/shared/stores';

export default function TeamPlanRoutePage() {
  const { t, lang } = useAppLang();
  const openImportDialog = usePlannerStore((state) => state.openImportDialog);

  return <TeamPlanPage t={t} lang={lang} onImport={openImportDialog} />;
}

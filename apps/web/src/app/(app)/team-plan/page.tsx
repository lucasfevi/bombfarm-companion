'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { GearPlanPage } from '@/features/gear-plan';
import { usePlannerStore } from '@/shared/stores';

export default function TeamPlanRoutePage() {
  const { t, lang } = useAppLang();
  const openImportDialog = usePlannerStore((state) => state.openImportDialog);

  return <GearPlanPage t={t} lang={lang} onImport={openImportDialog} />;
}

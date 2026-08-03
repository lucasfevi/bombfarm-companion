'use client';

import { Toast } from '@bombfarm/ui';
import { useAppLang } from '@/shared/context/app-lang';
import { EmptyWorkspace } from './empty-workspace';
import { PlannerTabs } from './planner-tabs';
import { ExplainSection } from './explain-section';
import { useHeroPersistEffects } from '../hooks/use-hero-persistence';
import { useHeroDraftActions } from '../hooks/use-hero-draft-actions';
import {
  usePlannerStore,
  selectToast,
  selectShouldShowEmptyState,
} from '@/shared/stores';

import {
  workspaceClass,
  workspaceDimmedClass,
} from '@bombfarm/ui/panel-field.recipe';

export default function HeroPlanner() {
  const { t } = useAppLang();
  const toast = usePlannerStore(selectToast);
  const noHeroYet = usePlannerStore(selectShouldShowEmptyState);
  const openImportDialog = usePlannerStore((state) => state.openImportDialog);

  const { applyHero } = useHeroDraftActions();

  useHeroPersistEffects({ applyHero });

  return (
    <>
      <Toast message={toast} />
      {noHeroYet && <EmptyWorkspace t={t} onImport={openImportDialog} />}
      <div
        className={`${workspaceClass}${noHeroYet ? ` ${workspaceDimmedClass}` : ''}`}
        inert={noHeroYet}
        aria-hidden={noHeroYet}
      >
        <PlannerTabs />
      </div>

      <ExplainSection />
    </>
  );
}

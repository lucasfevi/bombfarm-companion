'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAppLang } from '@/shared/context/app-lang';
import { SiteHeader } from './site-header';
import { GuideSection } from './guide-section';
import { ImportHeroesDialog } from '@/features/import';
import { Footer } from './footer';
import type { HeroRecord } from '@/shared/lib/storage';
import { pickHeroAfterImport } from '@bombfarm/domain/pick-hero-after-import';
import type { AccountImportData } from '@bombfarm/domain/import-save';
import { sub } from '@/shared/i18n';
import { workspaceShellClass } from '@bombfarm/ui/panel-field.recipe';
import { usePlannerStore, selectStrings, commitActiveHero } from '@/shared/stores';

export function AppShellInner({
  children,
  planner,
}: {
  children: ReactNode;
  planner: ReactNode;
}) {
  const pathname = usePathname();
  const onPhases = pathname.startsWith('/phases');
  const { lang, setLang, t } = useAppLang();
  const importDialogOpen = usePlannerStore((state) => state.importDialogOpen);
  const setImportDialogOpen = usePlannerStore((state) => state.setImportDialogOpen);
  const openImportDialog = usePlannerStore((state) => state.openImportDialog);
  const setHeroes = usePlannerStore((state) => state.setHeroes);
  const applyAccountImport = usePlannerStore((state) => state.applyAccountImport);
  const flashToast = usePlannerStore((state) => state.flashToast);

  /** Snapshot taken when the dialog opens — avoids reading a mutating roster mid-dialog. */
  const [importExisting, setImportExisting] = useState<HeroRecord[]>([]);
  const [showGuide, setShowGuide] = useState(() => {
    try {
      return localStorage.getItem('bf_guide_hidden') !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (importDialogOpen) {
      setImportExisting(usePlannerStore.getState().heroes);
    }
  }, [importDialogOpen]);

  const handleImported = useCallback(
    (result: {
      heroes: HeroRecord[];
      created: number;
      updated: number;
      account?: AccountImportData | null;
    }) => {
      const { heroes: merged, created, updated, account } = result;
      setHeroes(merged);
      const picked = pickHeroAfterImport(merged, usePlannerStore.getState().activeHeroId);
      if (picked) commitActiveHero(picked);
      if (account) applyAccountImport(account);
      const strings = selectStrings(usePlannerStore.getState());
      flashToast(sub(strings.importResultToast, { created, updated }));
      setImportDialogOpen(false);
    },
    [applyAccountImport, flashToast, setHeroes, setImportDialogOpen],
  );

  function toggleGuide(next: boolean) {
    setShowGuide(next);
    try {
      localStorage.setItem('bf_guide_hidden', next ? '0' : '1');
    } catch {
      /* private mode */
    }
  }

  return (
    <div className="min-h-screen pb-10">
      <SiteHeader
        t={t}
        lang={lang}
        showGuide={onPhases ? undefined : showGuide}
        onImport={openImportDialog}
        onToggleGuide={onPhases ? undefined : toggleGuide}
        onLangChange={setLang}
      />

      <ImportHeroesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        existing={importExisting}
        t={t}
        lang={lang}
        onImported={handleImported}
      />

      {!onPhases && showGuide ? <GuideSection t={t} onHide={() => toggleGuide(false)} /> : null}

      <div className={workspaceShellClass}>
        {onPhases ? children : null}
        <div hidden={onPhases} aria-hidden={onPhases} inert={onPhases ? true : undefined}>
          {planner}
        </div>
      </div>

      <Footer t={t} />
    </div>
  );
}

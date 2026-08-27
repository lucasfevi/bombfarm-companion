'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAppLang } from '@/shared/context/app-lang';
import { SiteHeader } from './site-header';
import { GuideSection } from './guide-section';
import { ReferralNotice } from './referral-notice';
import { readReferralNoticeHidden, writeReferralNoticeHidden } from './referral-notice-storage';
import { ImportHeroesDialog } from '@/features/import';
import { Footer } from './footer';
import type { HeroRecord } from '@/shared/lib/storage';
import { pickHeroAfterImport } from '@bombfarm/domain/pick-hero-after-import';
import type { AccountImportData } from '@bombfarm/domain/import-save';
import type { RequiredAccountField } from '@bombfarm/domain/account-required-fields';
import { AccountMissingFieldsBanner } from '@/features/account';
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
  const onFarm = pathname.startsWith('/farm');
  const onTeamPlan = pathname.startsWith('/team-plan');
  const onAccount = pathname.startsWith('/account');
  const onSectionPage = onFarm || onTeamPlan || onAccount;
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
  const [showReferralNotice, setShowReferralNotice] = useState(() => !readReferralNoticeHidden());

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
      accountMissingRequired?: readonly RequiredAccountField[];
    }) => {
      const { heroes: merged, created, updated, account, accountMissingRequired } = result;
      setHeroes(merged);
      const picked = pickHeroAfterImport(merged, usePlannerStore.getState().activeHeroId);
      if (picked) commitActiveHero(picked);
      if (account) applyAccountImport(account, accountMissingRequired);
      const strings = selectStrings(usePlannerStore.getState());
      flashToast(sub(strings.importResultToast, { created, updated }));
      setImportDialogOpen(false);
    },
    [applyAccountImport, flashToast, setHeroes, setImportDialogOpen],
  );

  function dismissReferralNotice() {
    setShowReferralNotice(false);
    writeReferralNoticeHidden();
  }

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
        showGuide={onSectionPage ? undefined : showGuide}
        onImport={openImportDialog}
        onToggleGuide={onSectionPage ? undefined : toggleGuide}
        onLangChange={setLang}
      />

      {showReferralNotice ? <ReferralNotice t={t} onDismiss={dismissReferralNotice} /> : null}

      <AccountMissingFieldsBanner />

      <ImportHeroesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        existing={importExisting}
        t={t}
        lang={lang}
        onImported={handleImported}
      />

      {!onSectionPage && showGuide ? <GuideSection t={t} onHide={() => toggleGuide(false)} /> : null}

      <div className={workspaceShellClass}>
        {onSectionPage ? children : null}
        <div hidden={onSectionPage} aria-hidden={onSectionPage} inert={onSectionPage ? true : undefined}>
          {planner}
        </div>
      </div>

      <Footer t={t} />
    </div>
  );
}

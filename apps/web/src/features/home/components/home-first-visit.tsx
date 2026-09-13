'use client';

import { Button } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore } from '@/shared/stores';

export function HomeFirstVisit() {
  const { t } = useAppLang();
  const openImportDialog = usePlannerStore((state) => state.openImportDialog);

  return (
    <div className="flex flex-col items-start gap-3 py-4" data-testid="home-first-visit">
      <p className="m-0 font-mono text-[11px] tracking-[0.17em] text-accent uppercase">
        {t.homeFirstVisitEyebrow}
      </p>
      <h2 className="m-0 text-xl font-extrabold tracking-tight text-balance text-ink">
        {t.homeFirstVisitTitle}
      </h2>
      <p className="m-0 max-w-[46ch] text-muted">{t.homeFirstVisitBody}</p>
      <Button variant="primary" onClick={openImportDialog}>
        {t.homeFirstVisitButton}
      </Button>
      <p className={`m-0 ${mutedClass}`}>{t.homeFirstVisitHint}</p>
    </div>
  );
}

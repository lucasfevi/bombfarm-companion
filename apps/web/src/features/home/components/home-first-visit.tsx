'use client';

import { buttonRecipe, cn } from '@bombfarm/ui';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore } from '@/shared/stores';

export function HomeFirstVisit() {
  const { t } = useAppLang();
  const openImportDialog = usePlannerStore((state) => state.openImportDialog);

  return (
    <section
      className="grid items-center gap-6 rounded-xl border border-[color-mix(in_oklch,var(--accent)_35%,var(--line))] bg-[color-mix(in_oklch,var(--accent)_7%,var(--surface))] px-7 py-6 min-[720px]:grid-cols-[minmax(0,1fr)_auto]"
      data-testid="home-first-visit"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <p className="m-0 font-mono text-[11px] tracking-[0.17em] text-accent uppercase">
          {t.homeFirstVisitEyebrow}
        </p>
        <h1 className="m-0 text-[34px] leading-tight font-extrabold tracking-tight text-balance text-ink">
          {t.homeFirstVisitTitle} <span className="text-accent">{t.homeFirstVisitTitleAccent}</span>
        </h1>
        <p className="m-0 max-w-[64ch] text-[14.5px] leading-normal text-muted">{t.homeFirstVisitBody}</p>
      </div>
      <div className="flex flex-col items-start gap-2 min-[720px]:items-end">
        <button
          type="button"
          className={cn(buttonRecipe({ variant: 'primary' }), 'h-auto px-6 py-4 text-base')}
          onClick={openImportDialog}
        >
          {t.homeFirstVisitButton}
        </button>
        <p className="m-0 font-mono text-[11px] text-muted">{t.homeFirstVisitHint}</p>
      </div>
    </section>
  );
}

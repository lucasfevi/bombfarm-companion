'use client';

import type { Strings } from '@/shared/i18n';

import { Button } from '@bombfarm/ui';

export function EmptyWorkspace({
  t,
  onImport,
}: {
  t: Strings;
  onImport: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-5 flex justify-center bg-[color-mix(in_oklch,var(--bg)_55%,transparent)] px-4 py-6 backdrop-blur-[2px]"
      role="region"
      aria-label={t.emptyTitle}
    >
      <div className="sticky top-[calc(var(--top)+24px)] h-fit w-[min(480px,100%)] border border-[color-mix(in_oklch,var(--accent)_35%,var(--line))] bg-surface px-6 py-[22px] text-center shadow-[0_8px_28px_color-mix(in_oklch,var(--ink)_14%,transparent)]">
        <h2 className="m-0 mb-2 text-base">{t.emptyTitle}</h2>
        <p className="m-0 mb-4 text-[12.5px] text-muted">{t.emptyBody}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="primary" onClick={onImport}>
            {t.emptyImportCta}
          </Button>
        </div>
      </div>
    </div>
  );
}

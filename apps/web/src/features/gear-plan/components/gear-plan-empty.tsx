'use client';

import { Button } from '@bombfarm/ui';

export function GearPlanEmptyPanel({
  title,
  body,
  cta,
  onImport,
}: {
  title: string;
  body: string;
  cta: string;
  onImport: () => void;
}) {
  return (
    <div className="border border-line bg-surface px-6 py-5 text-center shadow-[0_4px_18px_color-mix(in_oklch,var(--ink)_8%,transparent)]">
      <h2 className="m-0 mb-2 text-base font-semibold text-ink">{title}</h2>
      <p className="m-0 mb-4 text-[13px] text-muted">{body}</p>
      <Button type="button" variant="primary" onClick={onImport}>
        {cta}
      </Button>
    </div>
  );
}

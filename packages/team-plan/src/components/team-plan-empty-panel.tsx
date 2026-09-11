'use client';

import { Button } from '@bombfarm/ui';

export function TeamPlanEmptyPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <div className="border border-line bg-surface px-6 py-5 text-center shadow-[0_4px_18px_color-mix(in_oklch,var(--ink)_8%,transparent)]">
      <h2 className="m-0 mb-2 text-base font-semibold text-ink">{title}</h2>
      <p className="m-0 mb-4 text-[13px] text-muted">{body}</p>
      {action ? (
        <Button type="button" variant="primary" onClick={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

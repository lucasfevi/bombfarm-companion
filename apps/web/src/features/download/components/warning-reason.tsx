import type { ReactNode } from 'react';

export function WarningReason({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-bg-2 p-5">
      <h3 className="m-0 mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
        {title}
      </h3>
      <p className="m-0 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  );
}

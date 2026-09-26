import type { ReactNode } from 'react';

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-5">
      <h2 className="m-0 text-base font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

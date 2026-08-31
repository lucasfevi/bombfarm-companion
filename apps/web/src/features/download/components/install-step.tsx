import type { ReactNode } from 'react';
import { EmphasizedCopy } from './emphasized-copy';

export function InstallStep({
  index,
  title,
  body,
  children,
}: {
  index: number;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <li className="rounded-xl border border-line bg-bg-2 p-5">
      <span className="mb-3 grid size-6 place-items-center rounded-sm bg-accent font-mono text-[11px] font-semibold text-accent-ink">
        {index}
      </span>
      <h3 className="m-0 mb-2 text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
      <p className="m-0 text-sm leading-relaxed text-muted">
        <EmphasizedCopy text={body} />
      </p>
      {children}
    </li>
  );
}

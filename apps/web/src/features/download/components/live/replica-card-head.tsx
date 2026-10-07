import type { ReactNode } from 'react';

const TITLE_CLASS = 'm-0 font-mono text-[10px] tracking-[0.14em] text-muted uppercase';

export function ReplicaCardHead({ title, info }: { title: string; info?: ReactNode }) {
  if (info === undefined) return <p className={`${TITLE_CLASS} mb-2`}>{title}</p>;
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <p className={TITLE_CLASS}>{title}</p>
      {info}
    </div>
  );
}

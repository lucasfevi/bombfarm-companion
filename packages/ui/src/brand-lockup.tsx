import type { ReactNode } from 'react';
import { BrandMark } from './brand-mark';
import { brandLockupMarkClass, brandLockupTagClass, brandLockupTitleClass } from './brand-lockup.recipe';

export interface BrandLockupProps {
  title: ReactNode;
  tag?: ReactNode;
  /** Replaces the default mark, for a consumer that draws its own (for example with an image component). */
  mark?: ReactNode;
}

/** Renders as the children of the consumer's own link, so it works with any router. */
export function BrandLockup({ title, tag, mark }: BrandLockupProps) {
  return (
    <>
      {mark ?? <BrandMark tone="web" size={34} className={brandLockupMarkClass} />}
      <div>
        <div className={brandLockupTitleClass}>{title}</div>
        {tag != null ? <div className={brandLockupTagClass}>{tag}</div> : null}
      </div>
    </>
  );
}

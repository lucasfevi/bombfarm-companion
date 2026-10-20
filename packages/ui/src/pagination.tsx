import type { ElementType } from 'react';
import { TextLink } from './text-link';

export type PaginationProps = {
  /** The current page, 1-based; clamped into the range. */
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  /** A link component to render the previous and next links with — a router link, for example. */
  linkAs?: ElementType;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  formatStatus?: (page: number, pageCount: number) => string;
};

const defaultStatus = (page: number, pageCount: number) => `Page ${page} of ${pageCount}`;

export function Pagination({
  page,
  pageCount,
  hrefFor,
  linkAs,
  label = 'Pages',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  formatStatus = defaultStatus,
}: PaginationProps) {
  const last = Math.max(1, Math.floor(pageCount) || 1);
  const current = Math.min(last, Math.max(1, Math.floor(page) || 1));
  const linkProps = linkAs ? { as: linkAs } : {};

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
      <span className="text-muted tabular-nums">{formatStatus(current, last)}</span>
      {current > 1 ? (
        <TextLink {...linkProps} href={hrefFor(current - 1)} rel="prev">
          {previousLabel}
        </TextLink>
      ) : (
        <span className="text-muted" aria-disabled="true">
          {previousLabel}
        </span>
      )}
      {current < last ? (
        <TextLink {...linkProps} href={hrefFor(current + 1)} rel="next">
          {nextLabel}
        </TextLink>
      ) : (
        <span className="text-muted" aria-disabled="true">
          {nextLabel}
        </span>
      )}
    </nav>
  );
}

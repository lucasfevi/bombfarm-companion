/** Inline glossary trigger — dotted underline, no chrome box. */
export const glossaryTermTriggerClass = [
  'inline cursor-help border-0 border-b border-dotted bg-transparent p-0',
  'border-[color-mix(in_oklch,var(--accent)_55%,var(--muted))]',
  'font-inherit font-semibold text-ink',
  'hover:border-accent hover:text-accent',
  'focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
].join(' ');

/** Compact tooltip surface — reuses the help-tip token language. */
export const glossaryTermPopupClass =
  'z-50 max-w-64 rounded-sm border border-line bg-surface px-2.5 py-2 text-[11px] leading-snug text-ink shadow-md outline-none';

export const glossaryTermPositionerClass = 'z-50';

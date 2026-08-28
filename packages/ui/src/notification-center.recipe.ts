/**
 * NotificationCenter chrome — fixed layout bundle, no genuine
 * variants beyond the shared per-variant icon color already defined for the
 * toast system (`toast-system.recipe.ts`'s `toastIconClassByVariant`).
 */

export const notificationCenterRootClass = 'flex min-w-0 flex-col gap-2';

export const notificationHeaderClass = 'flex items-center justify-end';

export const notificationClearButtonClass =
  'rounded-sm px-2 py-1 text-xs font-semibold text-muted transition-colors hover:text-ink';

/** TST-22 — scrolls internally, never grows the container unbounded (NFR-2). */
export const notificationListClass = 'flex max-h-96 min-w-0 flex-col gap-1 overflow-y-auto';

export const notificationRowClass =
  'flex items-start gap-2.5 rounded-sm border border-line bg-surface p-2.5 text-[13px]';

export const notificationBodyClass = 'flex min-w-0 flex-1 flex-col gap-0.5';
export const notificationTitleRowClass = 'flex items-baseline justify-between gap-2';
export const notificationTitleClass = 'font-semibold text-ink';
export const notificationTimeClass = 'shrink-0 text-xs text-muted';
export const notificationDescriptionClass = 'text-muted';
export const notificationDismissButtonClass =
  'ml-auto shrink-0 self-start rounded-sm p-0.5 text-muted transition-colors hover:text-ink';

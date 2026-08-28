import { cva, type VariantProps } from 'class-variance-authority';
import type { ToastVariant } from './toast-queue';

/**
 * Toast system chrome. No base-ui toast primitive backs this — see
 * `toast-system.tsx`'s module doc for why (base-ui's `Toast.Root` requires
 * every rendered toast to be a live entry in its own internal store, which
 * would fight this feature's pure-reducer source of truth). Card shell
 * mirrors `panel-field.recipe.ts`'s `bg-surface`/`border-line` idiom; the
 * left accent border + icon color are the only variant-dependent bits, so
 * `variant` shares one base rather than emitting full per-variant strings.
 */

export const toastViewportClass =
  'pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2';

const toastItemBase =
  'pointer-events-auto flex items-start gap-2.5 rounded-sm border border-line bg-surface p-3 text-[13px] shadow-[0_8px_24px_color-mix(in_oklch,var(--ink)_18%,transparent)] motion-safe:animate-toast-in';

export const toastItemRecipe = cva(toastItemBase, {
  variants: {
    variant: {
      success: 'border-l-[3px] border-l-up',
      error: 'border-l-[3px] border-l-down',
      warning: 'border-l-[3px] border-l-warn',
      info: 'border-l-[3px] border-l-info',
      progress: 'border-l-[3px] border-l-accent',
    } satisfies Record<ToastVariant, string>,
  },
  defaultVariants: { variant: 'info' },
});

export type ToastItemVariant = NonNullable<VariantProps<typeof toastItemRecipe>['variant']>;

/** Icon color per variant — paired with a distinct icon glyph, never color alone (§6). */
export const toastIconClassByVariant: Record<ToastVariant, string> = {
  success: 'text-up',
  error: 'text-down',
  warning: 'text-warn',
  info: 'text-info',
  progress: 'text-accent',
};

export const toastBodyClass = 'flex min-w-0 flex-1 flex-col gap-1';
export const toastTitleClass = 'font-semibold text-ink';
export const toastDescriptionClass = 'text-muted';
export const toastFooterRowClass = 'mt-1 flex items-center gap-3';
export const toastActionButtonClass =
  'rounded-sm border border-line bg-bg px-2 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent';
export const toastCloseButtonClass =
  'ml-auto shrink-0 self-start rounded-sm p-0.5 text-muted transition-colors hover:text-ink';
export const toastProgressTrackClass = 'mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-2';
export const toastProgressFillClass =
  'h-full rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-[160ms]';
export const toastSrOnlyClass = 'sr-only';

export const toastOverflowButtonClass =
  'pointer-events-auto self-center rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted transition-colors hover:text-ink';

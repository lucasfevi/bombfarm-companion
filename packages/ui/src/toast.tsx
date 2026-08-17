import { toastClass } from './toast.recipe';

/**
 * @deprecated Legacy single-toast shim, kept byte-compatible for
 * `apps/web/src/features/planner/components/hero-planner.tsx`'s planner
 * toast. New consumers should use `ToastProvider` / `useToast()` /
 * `ToastViewport` from `toast-system.tsx` instead.
 */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className={toastClass} role="status" aria-live="polite">
      {message}
    </div>
  );
}

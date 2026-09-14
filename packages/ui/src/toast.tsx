import { toastClass } from './toast.recipe';

/**
 * @deprecated Legacy single-toast shim, kept byte-compatible for the web planner's shell toast
 * (`apps/web/src/app/_shell/app-shell-inner.tsx`). New consumers should use `ToastProvider` /
 * `useToast()` / `ToastViewport` from `toast-system.tsx` instead.
 */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className={toastClass} role="status" aria-live="polite">
      {message}
    </div>
  );
}

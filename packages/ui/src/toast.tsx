import { toastClass } from './toast.recipe';

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className={toastClass} role="status" aria-live="polite">
      {message}
    </div>
  );
}

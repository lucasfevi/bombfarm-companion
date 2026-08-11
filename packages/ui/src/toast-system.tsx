'use client';

/**
 * Toast system — provider, hook, viewport, item.
 *
 * ## Why this isn't a base-ui `Toast` wrap (T1 finding)
 *
 * `docs/base-ui-first.md` requires checking base-ui before rolling a custom
 * primitive, so this was read before writing any of this file:
 * `node_modules/@base-ui/react/toast` (`useToastManager`, `createToastManager`,
 * `ToastProvider`, `ToastRoot`, `ToastViewport`, `ToastAction`, …).
 *
 * base-ui's `Toast.Provider` owns a private `ToastStore` (`toasts: []`,
 * `timeout`, `limit`) and is the *only* source of truth for what's on screen
 * — `useToastManager().add/update/close` are the sole way to mutate it.
 * Critically, `Toast.Root` reads `store.useState('toastIndex' | 'toastVisibleIndex'
 * | 'toastOffsetY', toast.id)` internally, so a toast can only be rendered
 * through `Toast.Root` if it is a *live entry inside that same store* — it
 * cannot be handed an arbitrary object derived from external state on each
 * render. The store also schedules its own per-toast `setTimeout` for
 * auto-dismiss and its own `limit`-based overflow (toasts beyond `limit` are
 * flagged `data-limited`, not removed — no "+N more" concept).
 *
 * That is a second, competing source of truth and a second timer engine,
 * directly contradicting this feature's design (`design.md`: the pure
 * reducer in `toast-queue.ts` is the single source of truth for coalescing /
 * overflow / expiry / threshold-announcement policy, and the provider owns
 * *exactly one* `setTimeout`). Using `Toast.Root` would mean mirroring every
 * reducer transition into base-ui's store via `add`/`update`/`close` while
 * suppressing its own timeout/limit logic to keep it inert — fighting the
 * primitive rather than composing it.
 *
 * Per the explicit fallback this feature's spec/design allow ("if base-ui's
 * toast turns out to be unusable headlessly, fall back to a plain portal +
 * our reducer and document why"), this file uses `createPortal` instead and
 * keeps `role="status"`/`aria-live` semantics inline — the same manual a11y
 * approach the legacy `Toast` (`toast.tsx`) already uses. `Slider` (T7) has
 * no such conflict and wraps `@base-ui/react/slider` directly.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { Icon } from './icon';
import {
  toastQueueReducer,
  initialToastQueueState,
  nextExpiryDeadline,
  type ToastEntry,
  type ToastInput,
  type ToastQueueAction,
  type ToastQueueState,
  type ToastVariant,
} from './toast-queue';
import {
  toastActionButtonClass,
  toastBodyClass,
  toastCloseButtonClass,
  toastDescriptionClass,
  toastFooterRowClass,
  toastIconClassByVariant,
  toastItemRecipe,
  toastOverflowButtonClass,
  toastProgressFillClass,
  toastProgressTrackClass,
  toastSrOnlyClass,
  toastTitleClass,
  toastViewportClass,
} from './toast-system.recipe';

/** Fixed icon per variant — meaning is never carried by color alone (§6, TST-13). */
const TOAST_VARIANT_ICON = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'exclamation-triangle',
  info: 'information-circle',
  progress: 'arrow-path',
} as const satisfies Record<ToastVariant, string>;

export type ToastContextValue = {
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
  visible: ToastEntry[];
  overflow: ToastEntry[];
  overflowCount: number;
  buffer: ToastQueueState['buffer'];
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Throws when called outside `ToastProvider` (TST-11) — mirrors `useTooltipCtx`'s convention. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
}

export type ToastProviderProps = {
  children?: ReactNode;
};

/**
 * Owns the reducer state and the single `setTimeout` that drives auto-dismiss
 * (TST-11). Render `<ToastViewport />` once anywhere inside the provider tree
 * to actually display toasts — the provider itself renders only `children`.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [state, setState] = useState<ToastQueueState>(initialToastQueueState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: ToastQueueAction): ToastQueueState => {
    const next = toastQueueReducer(stateRef.current, action);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const push = useCallback(
    (toast: ToastInput): string => {
      const next = dispatch({ type: 'push', toast, now: Date.now() });
      // Coalescing preserves id, so this always resolves to the live entry for `toast.key`.
      return next.all.find((entry) => entry.key === toast.key)!.id;
    },
    [dispatch],
  );

  const dismiss = useCallback((id: string) => dispatch({ type: 'dismiss', id }), [dispatch]);
  const clear = useCallback(() => dispatch({ type: 'clear' }), [dispatch]);

  // The provider's one and only setTimeout — recomputed from the next deadline in state.
  useEffect(() => {
    const deadline = nextExpiryDeadline(state);
    if (deadline === null) return undefined;
    const delay = Math.max(0, deadline - Date.now());
    const timer = setTimeout(() => {
      dispatch({ type: 'expire', now: Date.now() });
    }, delay);
    return () => clearTimeout(timer);
  }, [state, dispatch]);

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      dismiss,
      clear,
      visible: state.visible,
      overflow: state.overflow,
      overflowCount: state.overflowCount,
      buffer: state.buffer,
    }),
    [push, dismiss, clear, state],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export type ToastItemProps = {
  toast: ToastEntry;
  onDismiss: (id: string) => void;
  className?: string;
};

/**
 * A single toast — pure function of `toast`, no context/portal dependency,
 * so it renders identically via `renderToStaticMarkup` (structural coverage
 * for TST-13/14/15/16). `toast.action` is a single optional object per
 * `ToastInput`'s type, not an array — passing more than one action is a
 * compile-time type error (TST-15), not a runtime truncation.
 */
export function ToastItem({ toast, onDismiss, className }: ToastItemProps) {
  const isError = toast.variant === 'error';
  const isProgress = toast.variant === 'progress';
  const progress = isProgress ? Math.max(0, Math.min(100, toast.progress ?? 0)) : undefined;
  // Buckets the live-region text by announcement threshold (0/50/100, §11) so
  // its content — and thus what a screen reader re-announces — only changes
  // when `toast-queue.ts`'s `announce` policy would flag a crossing, without
  // needing to thread the transient `announce` flag through props.
  const announceBucket = progress === undefined ? undefined : Math.min(2, Math.floor(progress / 50));

  return (
    <div
      className={cn(toastItemRecipe({ variant: toast.variant }), className)}
      role="status"
      aria-live={isError ? 'assertive' : 'polite'}
      data-toast-variant={toast.variant}
    >
      <Icon
        name={TOAST_VARIANT_ICON[toast.variant]}
        size="md"
        className={cn('mt-0.5 shrink-0', toastIconClassByVariant[toast.variant])}
      />
      <div className={toastBodyClass}>
        <p className={toastTitleClass}>{toast.title}</p>
        {toast.description ? <p className={toastDescriptionClass}>{toast.description}</p> : null}

        {isProgress ? (
          <>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={toast.title}
              className={toastProgressTrackClass}
            >
              <div className={toastProgressFillClass} style={{ width: `${progress}%` }} />
            </div>
            <span key={announceBucket} className={toastSrOnlyClass}>
              {progress}% complete
            </span>
          </>
        ) : null}

        {toast.action ? (
          <div className={toastFooterRowClass}>
            <button type="button" className={toastActionButtonClass} onClick={toast.action.onAction}>
              {toast.action.label}
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={toastCloseButtonClass}
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
      >
        <Icon name="x-mark" size="sm" />
      </button>
    </div>
  );
}

/**
 * Renders the visible stack (newest-on-top — `visible` is already
 * newest-first) plus a "+N more" affordance that expands to the full
 * overflow list (TST-12). Portals to `document.body` so a transformed
 * ancestor (Motion-driven panels elsewhere in this package) can never trap
 * `position: fixed` toasts inside its own stacking context. Needs a client
 * mount check for `document`; verified via Storybook (`toast-system.stories.tsx`)
 * rather than the node-only Vitest suite, which cannot exercise a portal.
 */
export function ToastViewport({ className }: { className?: string }) {
  const { visible, overflow, overflowCount, dismiss } = useToast();
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const extra = expanded ? overflow : [];

  return createPortal(
    <div className={cn(toastViewportClass, className)}>
      {visible.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
      {overflowCount > 0 ? (
        <button
          type="button"
          className={toastOverflowButtonClass}
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Show less' : `+${overflowCount} more`}
        </button>
      ) : null}
      {extra.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>,
    document.body,
  );
}

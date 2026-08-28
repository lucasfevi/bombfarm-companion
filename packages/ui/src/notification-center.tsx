import { cn } from './cn';
import { EmptyState } from './empty-state';
import { Icon } from './icon';
import { toastIconClassByVariant } from './toast-system.recipe';
import type { ToastVariant } from './toast-queue';
import {
  notificationBodyClass,
  notificationCenterRootClass,
  notificationClearButtonClass,
  notificationDescriptionClass,
  notificationDismissButtonClass,
  notificationHeaderClass,
  notificationListClass,
  notificationRowClass,
  notificationTimeClass,
  notificationTitleClass,
  notificationTitleRowClass,
} from './notification-center.recipe';

/** Same fixed icon-per-variant mapping as `ToastItem` (that rule extends to the history view). */
const NOTIFICATION_VARIANT_ICON = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'exclamation-triangle',
  info: 'information-circle',
  progress: 'arrow-path',
} as const satisfies Record<ToastVariant, string>;

export type NotificationCenterItem = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  /** Preformatted (e.g. "3m ago") — locale/relative-time formatting is M5's, not this package's. */
  timeLabel: string;
};

export type NotificationCenterProps = {
  items: NotificationCenterItem[];
  onDismiss: (id: string) => void;
  onClearAll?: () => void;
  /** Caller-supplied, already-translated text for the empty state (EmptyState's `title`). */
  emptyLabel: string;
  clearAllLabel?: string;
  dismissLabel?: string;
  className?: string;
};

/**
 * NotificationCenter — fully controlled ring-buffer *view*. The
 * ring buffer itself (capping, persistence) is `toast-queue.ts`'s
 * `NOTIFICATION_BUFFER_LIMIT` / M5's NotificationService; this component only
 * renders whatever `items` it's given.
 */
export function NotificationCenter({
  items,
  onDismiss,
  onClearAll,
  emptyLabel,
  clearAllLabel = 'Clear all',
  dismissLabel = 'Dismiss',
  className,
}: NotificationCenterProps) {
  if (items.length === 0) {
    // The shared EmptyState, not a bespoke empty message.
    return <EmptyState title={emptyLabel} className={className} />;
  }

  return (
    <div className={cn(notificationCenterRootClass, className)}>
      {onClearAll ? (
        <div className={notificationHeaderClass}>
          <button type="button" className={notificationClearButtonClass} onClick={onClearAll}>
            {clearAllLabel}
          </button>
        </div>
      ) : null}
      <ul className={notificationListClass}>
        {items.map((item) => (
          <li key={item.id} className={notificationRowClass}>
            <Icon
              name={NOTIFICATION_VARIANT_ICON[item.variant]}
              size="md"
              className={cn('mt-0.5 shrink-0', toastIconClassByVariant[item.variant])}
            />
            <div className={notificationBodyClass}>
              <div className={notificationTitleRowClass}>
                <p className={notificationTitleClass}>{item.title}</p>
                <span className={notificationTimeClass}>{item.timeLabel}</span>
              </div>
              {item.description ? <p className={notificationDescriptionClass}>{item.description}</p> : null}
            </div>
            <button
              type="button"
              aria-label={dismissLabel}
              className={notificationDismissButtonClass}
              onClick={() => onDismiss(item.id)}
            >
              <Icon name="x-mark" size="sm" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { Notification } from 'electron';
import type { PremiumToast } from './host/capabilities/notify.js';

/** The part of Electron's `Notification` the notifier uses; the class itself fits. */
export interface NotificationClass {
  isSupported(): boolean;
  new (options: { title: string; body: string; silent: boolean }): {
    show(): void;
    on(event: 'click', listener: () => void): unknown;
  };
}

/**
 * The thin Electron side of `notify`: a system toast that calls back when clicked. It says
 * `unavailable` when notifications are unsupported or the system refuses to show one.
 */
export function createPremiumNotifier(
  port: NotificationClass = Notification,
): (toast: PremiumToast) => 'shown' | 'unavailable' {
  return (toast) => {
    if (!port.isSupported()) return 'unavailable';
    try {
      const notification = new port({ title: toast.title, body: toast.body, silent: false });
      notification.on('click', () => {
        toast.onClick();
      });
      notification.show();
      return 'shown';
    } catch {
      return 'unavailable';
    }
  };
}

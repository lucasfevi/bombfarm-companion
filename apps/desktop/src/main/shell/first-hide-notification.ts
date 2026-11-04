import type { NoticePort } from './first-hide-notice.js';

/** The part of Electron's `Notification` the adapter uses; the class itself fits. */
export interface NotificationClass {
  isSupported(): boolean;
  new (options: { title: string; body: string; silent: boolean }): {
    show(): void;
    on(event: 'click', listener: () => void): unknown;
  };
}

/** The Electron side of the first-hide notice: a system toast that calls back when clicked. */
export function createNotificationNoticePort(port: NotificationClass): NoticePort {
  return {
    isSupported: () => port.isSupported(),
    show({ title, body, onClick }) {
      const notification = new port({ title, body, silent: false });
      notification.on('click', () => {
        onClick();
      });
      notification.show();
    },
  };
}

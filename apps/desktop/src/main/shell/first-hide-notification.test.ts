import { describe, expect, it, vi } from 'vitest';
import { createNotificationNoticePort, type NotificationClass } from './first-hide-notification.js';

function fakeNotification(supported: boolean) {
  const shown: Array<{ options: { title: string; body: string; silent: boolean }; click: () => void }> = [];
  const port = class {
    static isSupported(): boolean {
      return supported;
    }
    private listener: () => void = () => undefined;
    constructor(private readonly options: { title: string; body: string; silent: boolean }) {}
    on(_event: 'click', listener: () => void): this {
      this.listener = listener;
      return this;
    }
    show(): void {
      shown.push({ options: this.options, click: this.listener });
    }
  };
  return { port: port as unknown as NotificationClass, shown };
}

describe('createNotificationNoticePort', () => {
  it('reports support from the platform', () => {
    expect(createNotificationNoticePort(fakeNotification(true).port).isSupported()).toBe(true);
    expect(createNotificationNoticePort(fakeNotification(false).port).isSupported()).toBe(false);
  });

  it('shows the title and body as given, not silent', () => {
    const { port, shown } = fakeNotification(true);
    createNotificationNoticePort(port).show({ title: 'T', body: 'B', onClick: () => undefined });
    expect(shown).toHaveLength(1);
    expect(shown[0]?.options).toEqual({ title: 'T', body: 'B', silent: false });
  });

  it('calls onClick when the notice is clicked, and not before', () => {
    const { port, shown } = fakeNotification(true);
    const onClick = vi.fn();
    createNotificationNoticePort(port).show({ title: 'T', body: 'B', onClick });
    expect(onClick).not.toHaveBeenCalled();
    shown[0]?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

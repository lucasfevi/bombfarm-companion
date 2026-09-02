export interface EventWindow {
  isDestroyed(): boolean;
  webContents: {
    send(channel: string, payload: unknown): void;
  };
}

export function broadcastEventToWindows(
  windows: readonly EventWindow[],
  channel: string,
  payload: unknown,
): void {
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

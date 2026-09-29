import { ipcEventName, type IpcEventChannel, type IpcEvents } from '@bombfarm/contracts';
import { broadcastEventToWindows, type EventWindow } from './shell/broadcast-event.js';

export interface EventEmitterDeps {
  /** A getter, never a captured list: the window set changes for the whole life of the app. */
  getWindows: () => readonly EventWindow[];
}

export type EmitEvent = <C extends IpcEventChannel>(channel: C, payload: IpcEvents[C]) => void;

export function createEventEmitter(deps: EventEmitterDeps): EmitEvent {
  return (channel, payload) => {
    broadcastEventToWindows(deps.getWindows(), ipcEventName(channel), payload);
  };
}

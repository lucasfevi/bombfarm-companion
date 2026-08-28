/**
 * The localStorage read/write primitives, split out of `storage.ts` so that module and the
 * one-shot migrations can both use them without importing each other (a cycle).
 *
 * `storage.ts` re-exports everything public here, so `@/shared/lib/storage` remains the single
 * import site for the rest of the app — this split is internal.
 */

export type StorageWriteErrorListener = (info: { key: string; error: unknown }) => void;

const writeErrorListeners = new Set<StorageWriteErrorListener>();

/**
 * Register a listener for localStorage write failures (quota / private mode).
 * Returns an unsubscribe function. Each listener invocation is individually
 * try/caught so one bad listener cannot break the save path (ASM-11).
 */
export function onStorageWriteError(listener: StorageWriteErrorListener): () => void {
  writeErrorListeners.add(listener);
  return () => {
    writeErrorListeners.delete(listener);
  };
}

/** Vitest helper — clears the write-error listener set. */
export function clearStorageWriteErrorListenersForTests(): void {
  writeErrorListeners.clear();
}

function notifyWriteError(key: string, error: unknown): void {
  for (const listener of writeErrorListeners) {
    try {
      listener({ key, error });
    } catch {
      // Contain listener failures — do not break the save path.
    }
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Returns true on success, false on any setItem throw — never rethrows. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    notifyWriteError(key, error);
    return false;
  }
}

export const AUTOSAVE_MS = 700;

export type DebouncedWriter = {
  schedule: () => void;
  cancel: () => void;
  flushForTests: () => void;
};

export function createDebouncedWriter(delayMs: number, run: () => void): DebouncedWriter {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule: () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delayMs);
    },
    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    flushForTests: () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      run();
    },
  };
}

/**
 * Lets a developer annotate a capture while playing. The game window has focus during a session,
 * so the annotation cannot come from the app's own UI — it arrives as a line typed into the
 * launcher's terminal, which writes it to a file this watch polls.
 *
 * Content identity decides whether a mark fired, not mtime: a rewrite inside the same millisecond
 * is invisible to mtime on Windows. Polling rather than `fs.watch` for the same reason — `fs.watch`
 * duplicates events there, and a predictable interval beats a fast but unreliable signal for
 * something whose only job is to drop a label into a stream.
 */

export interface MarkWatchDeps {
  readonly path: string;
  /** Returns the file's content, or `null` when it does not exist. May throw; the watch swallows. */
  readonly readFile: (path: string) => string | null;
  readonly onMark: (label: string) => void;
  readonly intervalMs?: number;
}

export interface MarkWatch {
  start(): void;
  stop(): void;
}

const DEFAULT_INTERVAL_MS = 500;

/** The launcher prefixes each line with an incrementing ordinal so that typing the same label
 *  twice still changes the file. The ordinal has done its job by the time the content differs, and
 *  the record already carries a sequence number, so it is not repeated into the label. */
function labelFrom(content: string): string {
  return content.replace(/^\d+\s/, '').trim();
}

export function createMarkWatch(deps: MarkWatchDeps): MarkWatch {
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastContent: string | null = null;

  function read(): string | null {
    try {
      return deps.readFile(deps.path);
    } catch {
      // A lost annotation, never a lost recording.
      return null;
    }
  }

  function poll(): void {
    const content = read();
    if (content === null || content === lastContent) return;
    lastContent = content;
    const label = labelFrom(content);
    if (label !== '') deps.onMark(label);
  }

  return {
    /** The mark file outlives a run, so the content already there is adopted without firing —
     *  replaying the previous session's last annotation into this one would be a false record,
     *  which is worse than missing a mark typed before the app finished starting. */
    start(): void {
      if (timer !== null) return;
      lastContent = read();
      timer = setInterval(poll, deps.intervalMs ?? DEFAULT_INTERVAL_MS);
    },

    stop(): void {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },
  };
}

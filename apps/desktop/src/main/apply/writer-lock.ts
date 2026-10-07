/**
 * One writer, ever. The forge run, an apply run and a deconstruct run all write through the
 * account's one write session, and none may start while another holds this.
 */
export interface WriterLock {
  readonly holder: string | null;
  acquire(owner: string): boolean;
  release(owner: string): void;
}

export function createWriterLock(): WriterLock {
  let holder: string | null = null;
  return {
    get holder(): string | null {
      return holder;
    },
    acquire(owner: string): boolean {
      if (holder !== null) return false;
      holder = owner;
      return true;
    },
    release(owner: string): void {
      if (holder === owner) holder = null;
    },
  };
}

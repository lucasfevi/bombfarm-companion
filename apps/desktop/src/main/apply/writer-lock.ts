/**
 * One writer, ever. The forge run and an apply run both spend the player's gold through the
 * account's one write session, and neither may start while the other holds this.
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

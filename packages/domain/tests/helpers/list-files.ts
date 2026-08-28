import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export function listFiles(dir: string, predicate: (name: string) => boolean, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, predicate, acc);
    } else if (entry.isFile() && predicate(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

export const isJson = (name: string): boolean => name.endsWith('.json');

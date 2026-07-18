import fs from 'node:fs';
import path from 'node:path';
import type { GameSnapshotPayload } from '@bombfarm/contracts';

const SNAPSHOT_FILE = 'last-snapshot.json';

export class SnapshotStore {
  private payload: GameSnapshotPayload | null = null;

  constructor(private readonly userDataDir: string) {}

  load(): void {
    const filePath = path.join(this.userDataDir, SNAPSHOT_FILE);
    if (!fs.existsSync(filePath)) return;
    try {
      this.payload = JSON.parse(fs.readFileSync(filePath, 'utf8')) as GameSnapshotPayload;
    } catch {
      this.payload = null;
    }
  }

  get(): GameSnapshotPayload | null {
    return this.payload;
  }

  save(payload: GameSnapshotPayload): void {
    this.payload = payload;
    fs.mkdirSync(this.userDataDir, { recursive: true });
    fs.writeFileSync(path.join(this.userDataDir, SNAPSHOT_FILE), JSON.stringify(payload, null, 2), 'utf8');
  }
}

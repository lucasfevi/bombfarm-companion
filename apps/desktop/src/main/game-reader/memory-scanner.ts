/* koffi FFI returns loosely typed handles/structs — keep lint scoped to this boundary. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion */
import crypto from 'node:crypto';
import koffi from 'koffi';
import {
  classifyInventoryBag,
  MAX_CANDIDATES,
  parseGameState,
  pickHighestGoldCandidate,
  type MemoryCandidate,
} from '@bombfarm/game-data';
import type { RawGameState, RawInventoryBag } from '@bombfarm/contracts';

const kernel32 = koffi.load('kernel32.dll');
const OpenProcess = kernel32.func('__stdcall', 'OpenProcess', 'void *', ['uint32', 'bool', 'uint32']);
const CloseHandle = kernel32.func('__stdcall', 'CloseHandle', 'bool', ['void *']);
const ReadProcessMemory = kernel32.func('__stdcall', 'ReadProcessMemory', 'bool', [
  'void *',
  'void *',
  'uint8_t *',
  'uint64',
  koffi.out(koffi.pointer('uint64')),
]);
const MBI = koffi.struct('MEMORY_BASIC_INFORMATION', {
  BaseAddress: 'void *',
  AllocationBase: 'void *',
  AllocationProtect: 'uint32',
  RegionSize: 'uint64',
  State: 'uint32',
  Protect: 'uint32',
  Type: 'uint32',
});
const VirtualQueryEx = kernel32.func('__stdcall', 'VirtualQueryEx', 'uint64', [
  'void *',
  'void *',
  koffi.out(koffi.pointer(MBI)),
  'uint64',
]);

/** koffi 2.x returns Externals for `void *`; use `koffi.address` (BigInt/`number` also accepted). */
const ptrToBig = (p: unknown): bigint => {
  if (p === null || p === undefined) return 0n;
  if (typeof p === 'bigint') return p;
  if (typeof p === 'number') return BigInt(p);
  const address = koffi.address(p as object);
  return typeof address === 'bigint' ? address : BigInt(address);
};
const PROCESS_VM_READ = 0x0010;
const PROCESS_QUERY_INFORMATION = 0x0400;
const MEM_COMMIT = 0x1000;
const PAGE_READWRITE = 0x04;
const PAGE_READONLY = 0x02;
const PAGE_WRITECOPY = 0x08;
const PAGE_GUARD = 0x100;

export interface ScanTarget {
  addr: bigint;
  size: number;
}

export interface MemoryReadResult {
  state: RawGameState | null;
  inventory: RawInventoryBag | null;
  hash: string | null;
  suspectStale: boolean;
}

function tryExtractJson(buf: Buffer, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < buf.length; i++) {
    const b = buf[i];
    if (b === undefined) return null;
    if (inStr) {
      if (esc) esc = false;
      else if (b === 0x5c) esc = true;
      else if (b === 0x22) inStr = false;
      else if (b < 0x20) return null;
      continue;
    }
    if (b === 0x22) {
      inStr = true;
      continue;
    }
    if (b === 0x7b) depth++;
    else if (b === 0x7d) {
      depth--;
      if (depth === 0) return buf.toString('utf8', start, i + 1);
      if (depth < 0) return null;
    }
  }
  return null;
}

function sha1(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 12);
}

export class MemoryScanner {
  private handle: unknown = null;
  private readBuf: Buffer | null = null;
  private inventoryTarget: ScanTarget | null = null;
  private lastGold: number | null = null;

  constructor(private readonly pid: number) {}

  open(): boolean {
    this.close();
    this.handle = OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, false, this.pid);
    return this.handle != null;
  }

  close(): void {
    if (this.handle) {
      CloseHandle(this.handle);
      this.handle = null;
    }
    this.readBuf = null;
    this.inventoryTarget = null;
  }

  findStateTarget(anchor = '{"t":"snap"'): ScanTarget | null {
    const candidates = this.collectStateCandidates(anchor);
    const picked = pickHighestGoldCandidate(candidates);
    if (!picked) return null;
    return { addr: picked.addr, size: picked.size };
  }

  findInventoryTarget(): ScanTarget | null {
    if (!this.handle) return null;
    const needle = Buffer.from('"bag_tabs"', 'utf8');
    let addr = 0n;
    const maxAddr = 0x7fffffffffffn;
    const chunkSize = 4 * 1024 * 1024;
    const readBuf = Buffer.alloc(chunkSize);

    while (addr < maxAddr) {
      const mbi: Record<string, unknown> = {};
      const ok = VirtualQueryEx(this.handle, addr, mbi, koffi.sizeof(MBI));
      if (!ok) break;
      const regionSize = ptrToBig(mbi.RegionSize);
      if (regionSize === 0n) break;
      const committed = mbi.State === MEM_COMMIT;
      const readableProtect =
        mbi.Protect === PAGE_READWRITE || mbi.Protect === PAGE_READONLY || mbi.Protect === PAGE_WRITECOPY;
      const notGuarded = ((mbi.Protect as number) & PAGE_GUARD) === 0;
      if (committed && readableProtect && notGuarded) {
        const base = ptrToBig(mbi.BaseAddress);
        let off = 0n;
        while (off < regionSize) {
          const toRead = regionSize - off < BigInt(chunkSize) ? Number(regionSize - off) : chunkSize;
          const bytesReadOut = [0n];
          const okRead = ReadProcessMemory(
            this.handle,
            base + off,
            readBuf,
            BigInt(toRead),
            bytesReadOut,
          );
          const got = okRead ? Number(bytesReadOut[0]) : 0;
          if (got > 0) {
            for (let searchFrom = 0; ; ) {
              const idx = readBuf.indexOf(needle, searchFrom, 'utf8');
              if (idx === -1 || idx >= got) break;
              searchFrom = idx + 1;
              const start = readBuf.lastIndexOf('{', idx);
              if (start === -1) continue;
              const json = tryExtractJson(readBuf.subarray(0, got), start);
              if (!json || json.length < 100) continue;
              try {
                const parsed: unknown = JSON.parse(json);
                if (classifyInventoryBag(parsed)) {
                  return {
                    addr: base + off + BigInt(start),
                    size: Buffer.byteLength(json, 'utf8') + 4096,
                  };
                }
              } catch {
                // keep scanning
              }
            }
          }
          off += BigInt(toRead);
        }
      }
      addr = ptrToBig(mbi.BaseAddress) + regionSize;
    }
    return null;
  }

  relocate(stateTarget: ScanTarget | null): ScanTarget | null {
    const found = this.findStateTarget();
    this.inventoryTarget = this.findInventoryTarget();
    if (found) {
      this.readBuf = Buffer.alloc(Math.max(found.size, 16384));
      return found;
    }
    return stateTarget;
  }

  readAt(target: ScanTarget): MemoryReadResult {
    if (!this.handle || !this.readBuf) {
      return { state: null, inventory: null, hash: null, suspectStale: false };
    }

    const bytesReadOut = [0n];
    const okRead = ReadProcessMemory(
      this.handle,
      target.addr,
      this.readBuf,
      BigInt(this.readBuf.length),
      bytesReadOut,
    );
    const got = okRead ? Number(bytesReadOut[0]) : 0;
    const json = got > 0 ? tryExtractJson(this.readBuf.subarray(0, got), 0) : null;
    if (!json) {
      return { state: null, inventory: null, hash: null, suspectStale: false };
    }

    let state: RawGameState | null = null;
    const parsed = parseGameState(JSON.parse(json) as unknown);
    if (parsed.ok) {
      state = parsed.state;
    }

    let inventory: RawInventoryBag | null = null;
    if (this.inventoryTarget) {
      inventory = this.readInventoryAt(this.inventoryTarget);
    }

    const goldNum = state?.gold != null ? Number(state.gold) : null;
    let suspectStale = false;
    if (goldNum != null && this.lastGold != null && goldNum < this.lastGold) {
      suspectStale = true;
    }
    if (goldNum != null) {
      this.lastGold = Math.max(this.lastGold ?? goldNum, goldNum);
    }

    return {
      state,
      inventory,
      hash: sha1(json),
      suspectStale,
    };
  }

  private readInventoryAt(target: ScanTarget): RawInventoryBag | null {
    if (!this.handle) return null;
    const buf = Buffer.alloc(Math.max(target.size, 16384));
    const bytesReadOut = [0n];
    const okRead = ReadProcessMemory(
      this.handle,
      target.addr,
      buf,
      BigInt(buf.length),
      bytesReadOut,
    );
    const got = okRead ? Number(bytesReadOut[0]) : 0;
    const json = got > 0 ? tryExtractJson(buf.subarray(0, got), 0) : null;
    if (!json) return null;
    try {
      const parsed = JSON.parse(json) as unknown;
      return classifyInventoryBag(parsed) ? (parsed as RawInventoryBag) : null;
    } catch {
      return null;
    }
  }

  private collectStateCandidates(needleStr: string): MemoryCandidate[] {
    if (!this.handle) return [];
    const needle = Buffer.from(needleStr, 'utf8');
    let addr = 0n;
    const maxAddr = 0x7fffffffffffn;
    const chunkSize = 4 * 1024 * 1024;
    const readBuf = Buffer.alloc(chunkSize);
    const candidates: MemoryCandidate[] = [];

    while (addr < maxAddr && candidates.length < MAX_CANDIDATES) {
      const mbi: Record<string, unknown> = {};
      const ok = VirtualQueryEx(this.handle, addr, mbi, koffi.sizeof(MBI));
      if (!ok) break;
      const regionSize = ptrToBig(mbi.RegionSize);
      if (regionSize === 0n) break;
      const committed = mbi.State === MEM_COMMIT;
      const readableProtect =
        mbi.Protect === PAGE_READWRITE || mbi.Protect === PAGE_READONLY || mbi.Protect === PAGE_WRITECOPY;
      const notGuarded = ((mbi.Protect as number) & PAGE_GUARD) === 0;
      if (committed && readableProtect && notGuarded) {
        const base = ptrToBig(mbi.BaseAddress);
        let off = 0n;
        while (off < regionSize && candidates.length < MAX_CANDIDATES) {
          const toRead = regionSize - off < BigInt(chunkSize) ? Number(regionSize - off) : chunkSize;
          const bytesReadOut = [0n];
          const okRead = ReadProcessMemory(
            this.handle,
            base + off,
            readBuf,
            BigInt(toRead),
            bytesReadOut,
          );
          const got = okRead ? Number(bytesReadOut[0]) : 0;
          if (got > 0) {
            let searchFrom = 0;
            while (candidates.length < MAX_CANDIDATES) {
              const idx = readBuf.indexOf(needle, searchFrom, 'utf8');
              if (idx === -1 || idx >= got) break;
              searchFrom = idx + 1;
              const json = tryExtractJson(readBuf.subarray(0, got), idx);
              if (!json || json.length <= 200) continue;
              let gold: number | null = null;
              try {
                gold = Number(JSON.parse(json).gold);
              } catch {
                gold = null;
              }
              candidates.push({
                addr: base + off + BigInt(idx),
                size: Buffer.byteLength(json, 'utf8') + 4096,
                gold,
                json,
              });
            }
          }
          off += BigInt(toRead);
        }
      }
      addr = ptrToBig(mbi.BaseAddress) + regionSize;
    }
    return candidates;
  }
}

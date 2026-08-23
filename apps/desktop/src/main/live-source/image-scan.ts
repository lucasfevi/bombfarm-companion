/**
 * Locates a function inside a PE image by what it *references*, never by what it contains.
 *
 * The target function is identified by three anchor string literals that sit in `.rdata` and are
 * only ever loaded (via `lea reg, [rip+disp32]`) from inside it. This module finds those literals,
 * finds every rip-relative `lea` in `.text` that targets one of them, and uses the PE exception
 * table to turn each referencing instruction address into the function it belongs to. A hardcoded
 * offset would silently point at the wrong instruction the moment the binary is rebuilt; anchoring
 * on the debug-log strings and the PE's own metadata survives a rebuild by construction.
 *
 * `parsePe` and everything below it operate on a `Buffer` — the executable read from disk — so the
 * algorithm can be run, and its answer checked, without a live process to attach to.
 */

const DOS_HEADER_SIZE = 0x40;
const PE_SIGNATURE = 0x00004550;
const OPTIONAL_HEADER_MAGIC_PE32 = 0x10b;
const OPTIONAL_HEADER_MAGIC_PE32_PLUS = 0x20b;
const IMAGE_DIRECTORY_ENTRY_EXCEPTION = 3;
const SECTION_HEADER_SIZE = 40;
const RUNTIME_FUNCTION_SIZE = 12;
const UNW_FLAG_CHAININFO = 0x4;
const MAX_CHAIN_DEPTH = 8;
const REX_PREFIX_MIN = 0x40;
const REX_PREFIX_MAX = 0x4f;
const OPCODE_LEA = 0x8d;
const MODRM_RIP_RELATIVE_MASK = 0xc7;
const MODRM_RIP_RELATIVE_VALUE = 0x05;

export const READ_HOOK_ANCHORS = ['=> read', 'bad application data message', '<= read'] as const;

export interface PeSection {
  readonly name: string;
  readonly virtualAddress: number;
  readonly rawData: Buffer;
}

export interface RuntimeFunctionEntry {
  readonly beginAddress: number;
  readonly endAddress: number;
  readonly unwindInfoAddress: number;
}

export interface ParsedPe {
  readonly buildId: string;
  readonly sections: readonly PeSection[];
  readonly exceptionTable: readonly RuntimeFunctionEntry[];
}

export interface HookCandidate {
  readonly rva: number;
  readonly anchors: readonly string[];
}

function align(value: number, alignment: number): number {
  return value % alignment === 0 ? value : value + (alignment - (value % alignment));
}

export function parsePe(image: Buffer): ParsedPe {
  if (image.length < DOS_HEADER_SIZE || image.readUInt16LE(0) !== 0x5a4d) {
    throw new Error('image-scan: not a PE image (missing MZ header)');
  }
  const peHeaderOffset = image.readUInt32LE(0x3c);
  if (peHeaderOffset + 24 > image.length || image.readUInt32LE(peHeaderOffset) !== PE_SIGNATURE) {
    throw new Error('image-scan: not a PE image (missing PE signature)');
  }

  const coffHeaderOffset = peHeaderOffset + 4;
  const numberOfSections = image.readUInt16LE(coffHeaderOffset + 2);
  const timeDateStamp = image.readUInt32LE(coffHeaderOffset + 4);
  const sizeOfOptionalHeader = image.readUInt16LE(coffHeaderOffset + 16);

  const optionalHeaderOffset = coffHeaderOffset + 20;
  const magic = image.readUInt16LE(optionalHeaderOffset);
  if (magic !== OPTIONAL_HEADER_MAGIC_PE32 && magic !== OPTIONAL_HEADER_MAGIC_PE32_PLUS) {
    throw new Error(`image-scan: unsupported optional header magic 0x${magic.toString(16)}`);
  }
  const isPe32Plus = magic === OPTIONAL_HEADER_MAGIC_PE32_PLUS;

  const addressOfEntryPoint = image.readUInt32LE(optionalHeaderOffset + 16);
  const sizeOfImage = image.readUInt32LE(optionalHeaderOffset + 56);
  const dataDirectoryOffset = optionalHeaderOffset + (isPe32Plus ? 112 : 96);
  const exceptionDirOffset = dataDirectoryOffset + IMAGE_DIRECTORY_ENTRY_EXCEPTION * 8;
  const exceptionTableRva = image.readUInt32LE(exceptionDirOffset);
  const exceptionTableSize = image.readUInt32LE(exceptionDirOffset + 4);

  const sectionHeadersOffset = optionalHeaderOffset + sizeOfOptionalHeader;
  const sections: PeSection[] = [];
  for (let i = 0; i < numberOfSections; i += 1) {
    const base = sectionHeadersOffset + i * SECTION_HEADER_SIZE;
    const name = image.subarray(base, base + 8).toString('latin1').replace(/\0+$/, '');
    const virtualSize = image.readUInt32LE(base + 8);
    const virtualAddress = image.readUInt32LE(base + 12);
    const sizeOfRawData = image.readUInt32LE(base + 16);
    const pointerToRawData = image.readUInt32LE(base + 20);
    const rawLength = Math.min(virtualSize || sizeOfRawData, sizeOfRawData);
    sections.push({
      name,
      virtualAddress,
      rawData: image.subarray(pointerToRawData, pointerToRawData + rawLength),
    });
  }

  const exceptionTable: RuntimeFunctionEntry[] = [];
  if (exceptionTableRva !== 0 && exceptionTableSize > 0) {
    const raw = readAtRva(sections, exceptionTableRva, exceptionTableSize);
    const count = Math.floor(exceptionTableSize / RUNTIME_FUNCTION_SIZE);
    for (let i = 0; i < count; i += 1) {
      const base = i * RUNTIME_FUNCTION_SIZE;
      exceptionTable.push({
        beginAddress: raw.readUInt32LE(base),
        endAddress: raw.readUInt32LE(base + 4),
        unwindInfoAddress: raw.readUInt32LE(base + 8),
      });
    }
  }
  exceptionTable.sort((a, b) => a.beginAddress - b.beginAddress);

  const buildId = `${timeDateStamp.toString(16)}-${sizeOfImage.toString(16)}-${addressOfEntryPoint.toString(16)}`;

  return { buildId, sections, exceptionTable };
}

/** `parsePe` throwing (a truncated download, a process that never mapped) must never surface a
 * stale build stamp to the cache layer — the caller keys cache entries on this, and a wrong key
 * on a read failure would be worse than no key. */
export function tryReadBuildId(image: Buffer): string | null {
  try {
    return parsePe(image).buildId;
  } catch {
    return null;
  }
}

function findSection(sections: readonly PeSection[], name: string): PeSection | undefined {
  return sections.find((section) => section.name === name);
}

function readAtRva(sections: readonly PeSection[], rva: number, length: number): Buffer {
  for (const section of sections) {
    const start = section.virtualAddress;
    const end = start + section.rawData.length;
    if (rva >= start && rva + length <= end) {
      const offset = rva - start;
      return section.rawData.subarray(offset, offset + length);
    }
  }
  throw new Error(`image-scan: rva 0x${rva.toString(16)} is not mapped in any section`);
}

function findLiteralOccurrences(section: PeSection, literal: string): number[] {
  // The needle carries its own trailing NUL, so a longer string that merely starts with the
  // anchor's bytes (e.g. "=> read more") can never match: its byte after the anchor is a
  // character, not 0x00.
  const needle = Buffer.from(`${literal}\0`, 'latin1');
  const occurrences: number[] = [];
  let from = 0;
  for (;;) {
    const index = section.rawData.indexOf(needle, from);
    if (index === -1) break;
    occurrences.push(section.virtualAddress + index);
    from = index + 1;
  }
  return occurrences;
}

interface LeaHit {
  readonly instrRva: number;
  readonly targetRva: number;
}

function scanLeaRipRelative(section: PeSection): LeaHit[] {
  const buf = section.rawData;
  const hits: LeaHit[] = [];
  for (let i = 0; i < buf.length; i += 1) {
    const maybeRex = buf[i];
    const hasRex = maybeRex !== undefined && maybeRex >= REX_PREFIX_MIN && maybeRex <= REX_PREFIX_MAX;
    const opcodeIndex = hasRex ? i + 1 : i;
    if (buf[opcodeIndex] !== OPCODE_LEA) continue;

    const modrm = buf[opcodeIndex + 1];
    if (modrm === undefined || (modrm & MODRM_RIP_RELATIVE_MASK) !== MODRM_RIP_RELATIVE_VALUE) continue;

    const dispOffset = opcodeIndex + 2;
    if (dispOffset + 4 > buf.length) continue;

    const disp = buf.readInt32LE(dispOffset);
    const nextInstrRva = section.virtualAddress + dispOffset + 4;
    hits.push({ instrRva: section.virtualAddress + i, targetRva: nextInstrRva + disp });
  }
  return hits;
}

function readUnwindInfoFlags(sections: readonly PeSection[], unwindInfoRva: number): { flags: number; countOfCodes: number } {
  const header = readAtRva(sections, unwindInfoRva, 4);
  const versionAndFlags = header.readUInt8(0);
  return { flags: versionAndFlags >> 3, countOfCodes: header.readUInt8(2) };
}

function readChainedRuntimeFunction(
  sections: readonly PeSection[],
  unwindInfoRva: number,
  countOfCodes: number,
): RuntimeFunctionEntry {
  const codesBytes = countOfCodes * 2;
  const paddedCodesBytes = align(codesBytes, 4);
  const chain = readAtRva(sections, unwindInfoRva + 4 + paddedCodesBytes, RUNTIME_FUNCTION_SIZE);
  return {
    beginAddress: chain.readUInt32LE(0),
    endAddress: chain.readUInt32LE(4),
    unwindInfoAddress: chain.readUInt32LE(8),
  };
}

function findRuntimeFunction(table: readonly RuntimeFunctionEntry[], rva: number): RuntimeFunctionEntry | undefined {
  let lo = 0;
  let hi = table.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const entry = table[mid];
    if (!entry) break;
    if (rva < entry.beginAddress) hi = mid - 1;
    else if (rva >= entry.endAddress) lo = mid + 1;
    else return entry;
  }
  return undefined;
}

/**
 * Resolves an address inside a function to that function's real start, chasing
 * `UNW_FLAG_CHAININFO` links. The toolchain splits some functions into fragments whose own
 * `RUNTIME_FUNCTION.BeginAddress` points into the middle of the real function; returning a
 * fragment start instead of following the chain would hook a mid-function address and crash the
 * game the moment that hook fires. Depth is capped at `MAX_CHAIN_DEPTH` so a malformed or cyclic
 * chain fails closed instead of looping forever.
 */
function resolveFunctionStart(
  sections: readonly PeSection[],
  exceptionTable: readonly RuntimeFunctionEntry[],
  rva: number,
): number | undefined {
  let entry = findRuntimeFunction(exceptionTable, rva);
  if (!entry) return undefined;

  for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth += 1) {
    const { flags, countOfCodes } = readUnwindInfoFlags(sections, entry.unwindInfoAddress);
    if ((flags & UNW_FLAG_CHAININFO) === 0) {
      return entry.beginAddress;
    }
    entry = readChainedRuntimeFunction(sections, entry.unwindInfoAddress, countOfCodes);
  }
  return undefined;
}

/**
 * Ranks every function in `.text` by how many of `anchors` it references, highest first. A
 * function referencing all of them is the read function; nothing else in a normal build
 * legitimately references the second anchor at all, but ranking by count rather than assuming
 * uniqueness keeps the result meaningful even if a future rebuild adds an incidental reference
 * elsewhere.
 */
export function discoverHookCandidates(pe: ParsedPe, anchors: readonly string[] = READ_HOOK_ANCHORS): HookCandidate[] {
  const rdata = findSection(pe.sections, '.rdata');
  const text = findSection(pe.sections, '.text');
  if (!rdata || !text) return [];

  const rvaToAnchor = new Map<number, string>();
  for (const anchor of anchors) {
    for (const rva of findLiteralOccurrences(rdata, anchor)) {
      rvaToAnchor.set(rva, anchor);
    }
  }

  const anchorsByFunction = new Map<number, Set<string>>();
  for (const hit of scanLeaRipRelative(text)) {
    const anchor = rvaToAnchor.get(hit.targetRva);
    if (!anchor) continue;

    const functionStart = resolveFunctionStart(pe.sections, pe.exceptionTable, hit.instrRva);
    if (functionStart === undefined) continue;

    const set = anchorsByFunction.get(functionStart) ?? new Set<string>();
    set.add(anchor);
    anchorsByFunction.set(functionStart, set);
  }

  return [...anchorsByFunction.entries()]
    .map(([rva, anchorSet]) => ({ rva, anchors: [...anchorSet].sort() }))
    .sort((a, b) => b.anchors.length - a.anchors.length || a.rva - b.rva);
}

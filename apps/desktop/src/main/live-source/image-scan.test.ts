import { describe, expect, it } from 'vitest';
import { READ_HOOK_ANCHORS, discoverHookCandidates, parsePe, tryReadBuildId } from './image-scan.js';

const ANCHOR1 = '=> read';
const ANCHOR2 = 'bad application data message';
const ANCHOR3 = '<= read';
const NUL_LOOKALIKE = '=> read more';

const TEXT_VA = 0x1000;
const SECTION_ALIGN = 0x1000;
const FILE_ALIGN = 0x200;
const LEA_LEN = 7; // REX prefix + 0x8D opcode + ModRM + 4-byte rip-relative displacement

function align(value: number, alignment: number): number {
  return value % alignment === 0 ? value : value + (alignment - (value % alignment));
}

function withNul(literal: string): Buffer {
  return Buffer.from(`${literal}\0`, 'latin1');
}

interface Fixture {
  readonly image: Buffer;
  readonly timeDateStamp: number;
  readonly sizeOfImage: number;
  readonly addressOfEntryPoint: number;
  readonly realFuncRva: number;
  readonly decoyFuncRva: number;
  readonly fragFuncRva: number;
  readonly nulFuncRva: number;
}

/**
 * Assembles a minimal-but-real PE32+ image by hand: DOS/COFF/optional headers, two sections, and
 * an x64 exception table. `.rdata` carries the three anchor literals plus a decoy string that only
 * starts with an anchor's bytes; `.text` carries genuine `lea reg, [rip+disp32]` encodings —
 * "real" function referencing anchors 1 and 2 directly, a "decoy" function referencing anchor 1
 * again, a cold-path "fragment" whose `RUNTIME_FUNCTION` is `UNW_FLAG_CHAININFO`-chained back to
 * the real function and which references anchor 3, and a function referencing the decoy string.
 */
function buildFixtureImage(): Fixture {
  const realFuncOff = 0;
  const realFuncLen = LEA_LEN + LEA_LEN + 4; // two leas, then NOP NOP NOP RET
  const decoyFuncOff = realFuncOff + realFuncLen;
  const decoyFuncLen = LEA_LEN + 1; // one lea, then RET
  const fragFuncOff = decoyFuncOff + decoyFuncLen;
  const fragFuncLen = LEA_LEN + 1;
  const nulFuncOff = fragFuncOff + fragFuncLen;
  const nulFuncLen = LEA_LEN + 1;
  const textLen = nulFuncOff + nulFuncLen;

  const RDATA_VA = TEXT_VA + align(textLen, SECTION_ALIGN);

  const anchor1Buf = withNul(ANCHOR1);
  const anchor2Buf = withNul(ANCHOR2);
  const anchor3Buf = withNul(ANCHOR3);
  const decoyBuf = withNul(NUL_LOOKALIKE);

  const anchor1Off = 0;
  const anchor2Off = anchor1Off + anchor1Buf.length;
  const anchor3Off = anchor2Off + anchor2Buf.length;
  const decoyOff = anchor3Off + anchor3Buf.length;
  const excTableOff = decoyOff + decoyBuf.length;
  const excTableLen = 3 * 12;
  const realUnwindOff = excTableOff + excTableLen;
  const decoyUnwindOff = realUnwindOff + 4;
  const fragUnwindOff = decoyUnwindOff + 4;
  const fragChainOff = fragUnwindOff + 4;
  const rdataLen = fragChainOff + 12;

  const anchor1Rva = RDATA_VA + anchor1Off;
  const anchor2Rva = RDATA_VA + anchor2Off;
  const anchor3Rva = RDATA_VA + anchor3Off;
  const decoyRva = RDATA_VA + decoyOff;
  const excTableRva = RDATA_VA + excTableOff;
  const realUnwindRva = RDATA_VA + realUnwindOff;
  const decoyUnwindRva = RDATA_VA + decoyUnwindOff;
  const fragUnwindRva = RDATA_VA + fragUnwindOff;

  const realFuncRva = TEXT_VA + realFuncOff;
  const realFuncEndRva = TEXT_VA + decoyFuncOff;
  const decoyFuncRva = TEXT_VA + decoyFuncOff;
  const decoyFuncEndRva = TEXT_VA + fragFuncOff;
  const fragFuncRva = TEXT_VA + fragFuncOff;
  const fragFuncEndRva = TEXT_VA + nulFuncOff;
  const nulFuncRva = TEXT_VA + nulFuncOff;

  const text = Buffer.alloc(textLen);
  function writeLea(offset: number, targetRva: number): void {
    text.writeUInt8(0x48, offset);
    text.writeUInt8(0x8d, offset + 1);
    text.writeUInt8(0x05, offset + 2);
    const nextInstrRva = TEXT_VA + offset + LEA_LEN;
    text.writeInt32LE(targetRva - nextInstrRva, offset + 3);
  }
  writeLea(0, anchor1Rva);
  writeLea(7, anchor2Rva);
  text.writeUInt8(0x90, 14);
  text.writeUInt8(0x90, 15);
  text.writeUInt8(0x90, 16);
  text.writeUInt8(0xc3, 17);
  writeLea(decoyFuncOff, anchor1Rva);
  text.writeUInt8(0xc3, decoyFuncOff + LEA_LEN);
  writeLea(fragFuncOff, anchor3Rva);
  text.writeUInt8(0xc3, fragFuncOff + LEA_LEN);
  writeLea(nulFuncOff, decoyRva);
  text.writeUInt8(0xc3, nulFuncOff + LEA_LEN);

  const rdata = Buffer.alloc(rdataLen);
  anchor1Buf.copy(rdata, anchor1Off);
  anchor2Buf.copy(rdata, anchor2Off);
  anchor3Buf.copy(rdata, anchor3Off);
  decoyBuf.copy(rdata, decoyOff);

  function writeRuntimeFunction(offset: number, begin: number, end: number, unwind: number): void {
    rdata.writeUInt32LE(begin, offset);
    rdata.writeUInt32LE(end, offset + 4);
    rdata.writeUInt32LE(unwind, offset + 8);
  }
  writeRuntimeFunction(excTableOff, realFuncRva, realFuncEndRva, realUnwindRva);
  writeRuntimeFunction(excTableOff + 12, decoyFuncRva, decoyFuncEndRva, decoyUnwindRva);
  writeRuntimeFunction(excTableOff + 24, fragFuncRva, fragFuncEndRva, fragUnwindRva);

  // UNWIND_INFO: byte0 = Version(3 bits) | Flags(5 bits) << 3. Version 1, no codes, so the header
  // is exactly 4 bytes; the real and decoy functions carry no chain (flags 0), the fragment
  // carries UNW_FLAG_CHAININFO (0x4) followed immediately by the chained RUNTIME_FUNCTION.
  rdata.writeUInt8(0x01, realUnwindOff);
  rdata.writeUInt8(0x01, decoyUnwindOff);
  rdata.writeUInt8(0x21, fragUnwindOff);
  writeRuntimeFunction(fragChainOff, realFuncRva, realFuncEndRva, realUnwindRva);

  const headerSize = align(0x198, FILE_ALIGN);
  const textFileOff = headerSize;
  const textRawLen = align(textLen, FILE_ALIGN);
  const rdataFileOff = textFileOff + textRawLen;
  const rdataRawLen = align(rdataLen, FILE_ALIGN);
  const imageSize = rdataFileOff + rdataRawLen;
  const sizeOfImage = align(RDATA_VA + rdataLen, SECTION_ALIGN);
  const timeDateStamp = 0x63a1b2c3;

  const image = Buffer.alloc(imageSize);

  image.writeUInt16LE(0x5a4d, 0);
  image.writeUInt32LE(0x40, 0x3c);

  image.writeUInt32LE(0x00004550, 0x40);
  image.writeUInt16LE(0x8664, 0x44);
  image.writeUInt16LE(2, 0x46);
  image.writeUInt32LE(timeDateStamp, 0x48);
  image.writeUInt32LE(0, 0x4c);
  image.writeUInt32LE(0, 0x50);
  image.writeUInt16LE(0xf0, 0x54);
  image.writeUInt16LE(0x0022, 0x56);

  const optOff = 0x58;
  image.writeUInt16LE(0x20b, optOff);
  image.writeUInt8(14, optOff + 2);
  image.writeUInt8(0, optOff + 3);
  image.writeUInt32LE(textRawLen, optOff + 4);
  image.writeUInt32LE(rdataRawLen, optOff + 8);
  image.writeUInt32LE(0, optOff + 12);
  image.writeUInt32LE(realFuncRva, optOff + 16);
  image.writeUInt32LE(TEXT_VA, optOff + 20);
  image.writeBigUInt64LE(0x140000000n, optOff + 24);
  image.writeUInt32LE(SECTION_ALIGN, optOff + 32);
  image.writeUInt32LE(FILE_ALIGN, optOff + 36);
  image.writeUInt16LE(6, optOff + 40);
  image.writeUInt16LE(0, optOff + 42);
  image.writeUInt16LE(0, optOff + 44);
  image.writeUInt16LE(0, optOff + 46);
  image.writeUInt16LE(6, optOff + 48);
  image.writeUInt16LE(0, optOff + 50);
  image.writeUInt32LE(0, optOff + 52);
  image.writeUInt32LE(sizeOfImage, optOff + 56);
  image.writeUInt32LE(headerSize, optOff + 60);
  image.writeUInt32LE(0, optOff + 64);
  image.writeUInt16LE(3, optOff + 68);
  image.writeUInt16LE(0, optOff + 70);
  image.writeBigUInt64LE(0x100000n, optOff + 72);
  image.writeBigUInt64LE(0x1000n, optOff + 80);
  image.writeBigUInt64LE(0x100000n, optOff + 88);
  image.writeBigUInt64LE(0x1000n, optOff + 96);
  image.writeUInt32LE(0, optOff + 104);
  image.writeUInt32LE(16, optOff + 108);

  const dataDirOff = optOff + 112;
  image.writeUInt32LE(excTableRva, dataDirOff + 3 * 8);
  image.writeUInt32LE(excTableLen, dataDirOff + 3 * 8 + 4);

  const sectionHeadersOff = optOff + 0xf0;
  function writeSectionHeader(
    offset: number,
    name: string,
    virtualSize: number,
    virtualAddress: number,
    rawSize: number,
    rawPointer: number,
    characteristics: number,
  ): void {
    image.write(name, offset, 8, 'latin1');
    image.writeUInt32LE(virtualSize, offset + 8);
    image.writeUInt32LE(virtualAddress, offset + 12);
    image.writeUInt32LE(rawSize, offset + 16);
    image.writeUInt32LE(rawPointer, offset + 20);
    image.writeUInt32LE(0, offset + 24);
    image.writeUInt32LE(0, offset + 28);
    image.writeUInt16LE(0, offset + 32);
    image.writeUInt16LE(0, offset + 34);
    image.writeUInt32LE(characteristics, offset + 36);
  }
  writeSectionHeader(sectionHeadersOff, '.text', textLen, TEXT_VA, textRawLen, textFileOff, 0x60000020);
  writeSectionHeader(sectionHeadersOff + 40, '.rdata', rdataLen, RDATA_VA, rdataRawLen, rdataFileOff, 0x40000040);

  text.copy(image, textFileOff);
  rdata.copy(image, rdataFileOff);

  return {
    image,
    timeDateStamp,
    sizeOfImage,
    addressOfEntryPoint: realFuncRva,
    realFuncRva,
    decoyFuncRva,
    fragFuncRva,
    nulFuncRva,
  };
}

describe('parsePe', () => {
  it('parses both sections and computes the build stamp from the header fields alone', () => {
    const fixture = buildFixtureImage();

    const parsed = parsePe(fixture.image);

    expect(parsed.sections.map((section) => section.name)).toEqual(['.text', '.rdata']);
    expect(parsed.buildId).toBe(
      `${fixture.timeDateStamp.toString(16)}-${fixture.sizeOfImage.toString(16)}-${fixture.addressOfEntryPoint.toString(16)}`,
    );
  });
});

describe('discoverHookCandidates', () => {
  it('resolves all three anchors to exactly one function, ranked above a partial match', () => {
    const fixture = buildFixtureImage();
    const candidates = discoverHookCandidates(parsePe(fixture.image));

    const fullMatches = candidates.filter((candidate) => candidate.anchors.length === READ_HOOK_ANCHORS.length);
    expect(fullMatches).toHaveLength(1);
    expect(fullMatches[0]?.rva).toBe(fixture.realFuncRva);
    expect(fullMatches[0]?.anchors).toEqual([...READ_HOOK_ANCHORS].sort());
    expect(candidates[0]).toEqual(fullMatches[0]);

    const partial = candidates.find((candidate) => candidate.rva === fixture.decoyFuncRva);
    expect(partial?.anchors).toEqual([ANCHOR1]);
    expect(candidates[1]).toEqual(partial);
  });

  it('follows the chain to the real function start instead of letting the fragment win', () => {
    const fixture = buildFixtureImage();
    const candidates = discoverHookCandidates(parsePe(fixture.image));

    expect(candidates.some((candidate) => candidate.rva === fixture.fragFuncRva)).toBe(false);

    const winner = candidates.find((candidate) => candidate.rva === fixture.realFuncRva);
    expect(winner?.anchors).toContain(ANCHOR3);
  });

  it('does not match a literal that only starts with an anchor (missing the trailing NUL)', () => {
    const fixture = buildFixtureImage();
    const candidates = discoverHookCandidates(parsePe(fixture.image));

    expect(candidates.some((candidate) => candidate.rva === fixture.nulFuncRva)).toBe(false);
  });
});

describe('tryReadBuildId', () => {
  it('returns null for an image that cannot be parsed as a PE', () => {
    expect(tryReadBuildId(Buffer.from('not a pe image at all', 'latin1'))).toBeNull();
    expect(tryReadBuildId(Buffer.alloc(4))).toBeNull();
  });

  it('returns the same stamp parsePe computes for a valid image', () => {
    const fixture = buildFixtureImage();

    expect(tryReadBuildId(fixture.image)).toBe(parsePe(fixture.image).buildId);
  });
});

import type { Ctx } from './tls-stream.js';

/**
 * The on-disk shape of a live frame capture: a 5-byte header followed by a stream of
 * self-describing records, each carrying the {@link Ctx} the byte-demuxer needs to route it back
 * to the right connection on replay. Pure and fs-free so both the writer (`frame-capture.ts`) and
 * a future replay harness can share one definition of the format without either dragging the
 * other's I/O concerns along.
 *
 * Record layout, all integers little-endian:
 *   ctxType: uint8 (0 = number, 1 = string)
 *   ctxLength: uint32
 *   ctxBytes: ctxLength bytes, UTF-8
 *   payloadLength: uint32
 *   payloadBytes: payloadLength bytes, byte-identical to what was captured
 */

export const CAPTURE_MAGIC = 'BFCC';
export const CAPTURE_VERSION = 1;

const CTX_TYPE_NUMBER = 0;
const CTX_TYPE_STRING = 1;

export const CAPTURE_HEADER_BYTES = CAPTURE_MAGIC.length + 1;

export class CaptureFormatError extends Error {}

export interface CaptureRecord {
  readonly ctx: Ctx;
  readonly bytes: Uint8Array;
}

export function encodeCaptureHeader(): Uint8Array {
  const header = Buffer.alloc(CAPTURE_HEADER_BYTES);
  header.write(CAPTURE_MAGIC, 0, 'ascii');
  header.writeUInt8(CAPTURE_VERSION, CAPTURE_MAGIC.length);
  return header;
}

export function encodeCaptureRecord(ctx: Ctx, bytes: Uint8Array): Uint8Array {
  const ctxBytes = Buffer.from(String(ctx), 'utf8');
  const payload = Buffer.from(bytes);
  const record = Buffer.alloc(1 + 4 + ctxBytes.length + 4 + payload.length);

  let offset = 0;
  record.writeUInt8(typeof ctx === 'number' ? CTX_TYPE_NUMBER : CTX_TYPE_STRING, offset);
  offset += 1;
  record.writeUInt32LE(ctxBytes.length, offset);
  offset += 4;
  ctxBytes.copy(record, offset);
  offset += ctxBytes.length;
  record.writeUInt32LE(payload.length, offset);
  offset += 4;
  payload.copy(record, offset);

  return record;
}

function readHeader(data: Buffer): void {
  if (data.length < CAPTURE_HEADER_BYTES) {
    throw new CaptureFormatError('capture-format: header_truncated');
  }
  const magic = data.toString('ascii', 0, CAPTURE_MAGIC.length);
  if (magic !== CAPTURE_MAGIC) {
    throw new CaptureFormatError(`capture-format: magic_unrecognised ${JSON.stringify(magic)}`);
  }
  const version = data.readUInt8(CAPTURE_MAGIC.length);
  if (version !== CAPTURE_VERSION) {
    throw new CaptureFormatError(`capture-format: version_unsupported ${String(version)}`);
  }
}

/**
 * Yields every complete record in arrival order. A hard app exit can truncate the file mid-record
 * — this stops at the last complete record instead of throwing, since everything up to that point
 * is still valid capture data. Only a missing or wrong header is rejected outright: that means the
 * file was never this format to begin with, not that it ended early.
 */
export function* readCaptureRecords(data: Uint8Array): Generator<CaptureRecord, void, undefined> {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  readHeader(buffer);

  let offset = CAPTURE_HEADER_BYTES;
  while (offset < buffer.length) {
    const recordStart = offset;

    if (offset + 1 + 4 > buffer.length) break;
    const ctxType = buffer.readUInt8(offset);
    const ctxLength = buffer.readUInt32LE(offset + 1);
    const ctxStart = offset + 1 + 4;
    if (ctxStart + ctxLength + 4 > buffer.length) {
      offset = recordStart;
      break;
    }
    const ctxBytes = buffer.subarray(ctxStart, ctxStart + ctxLength);

    const payloadLengthOffset = ctxStart + ctxLength;
    const payloadLength = buffer.readUInt32LE(payloadLengthOffset);
    const payloadStart = payloadLengthOffset + 4;
    if (payloadStart + payloadLength > buffer.length) {
      offset = recordStart;
      break;
    }
    const payloadBytes = buffer.subarray(payloadStart, payloadStart + payloadLength);

    const ctxString = ctxBytes.toString('utf8');
    const ctx: Ctx = ctxType === CTX_TYPE_NUMBER ? Number(ctxString) : ctxString;
    yield { ctx, bytes: new Uint8Array(payloadBytes) };

    offset = payloadStart + payloadLength;
  }
}

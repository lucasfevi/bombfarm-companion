import { describe, expect, it } from 'vitest';
import {
  CaptureFormatError,
  encodeCaptureHeader,
  encodeCaptureRecord,
  readCaptureRecords,
  type CaptureRecord,
} from './capture-format.js';

function concat(...chunks: Uint8Array[]): Buffer {
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

/** `toEqual` treats a plain `Uint8Array` and a `Buffer` (a `Uint8Array` subclass) as unequal, so
 *  every comparison against a `Buffer`-typed fixture goes through this to normalize the reader's
 *  output first. */
function toBuffers(records: readonly CaptureRecord[]): { ctx: string | number; bytes: Buffer }[] {
  return records.map((record) => ({ ctx: record.ctx, bytes: Buffer.from(record.bytes) }));
}

describe('capture-format: round trip', () => {
  it('reads back several records across two ctx values, in order, with byte-identical payloads', () => {
    const first = Buffer.from([0x81, 0x05, 0x01, 0x02, 0x03, 0x04, 0x05]);
    const second = Buffer.from('rest-response-body', 'utf8');
    const third = Buffer.from([0x00, 0xff, 0x10]);

    const file = concat(
      encodeCaptureHeader(),
      encodeCaptureRecord('conn-a', first),
      encodeCaptureRecord('conn-b', second),
      encodeCaptureRecord('conn-a', third),
    );

    const records = toBuffers([...readCaptureRecords(file)]);

    expect(records).toEqual([
      { ctx: 'conn-a', bytes: first },
      { ctx: 'conn-b', bytes: second },
      { ctx: 'conn-a', bytes: third },
    ]);
  });

  it('round-trips a numeric ctx as a number, not as its string form', () => {
    const file = concat(encodeCaptureHeader(), encodeCaptureRecord(4_242, Buffer.from('payload', 'utf8')));

    const [record] = [...readCaptureRecords(file)];

    expect(record?.ctx).toBe(4_242);
    expect(typeof record?.ctx).toBe('number');
  });

  it('round-trips a string ctx as a string, not coerced to a number', () => {
    const file = concat(encodeCaptureHeader(), encodeCaptureRecord('12', Buffer.from('payload', 'utf8')));

    const [record] = [...readCaptureRecords(file)];

    expect(record?.ctx).toBe('12');
    expect(typeof record?.ctx).toBe('string');
  });

  it('yields nothing but does not throw for a header-only file', () => {
    const file = encodeCaptureHeader();

    expect([...readCaptureRecords(file)]).toEqual([]);
  });
});

describe('capture-format: truncation', () => {
  const kept = Buffer.from('kept-record', 'utf8');
  const header = Buffer.from(encodeCaptureHeader());
  const keptRecord = Buffer.from(encodeCaptureRecord('conn', kept));
  const nextRecord = Buffer.from(encodeCaptureRecord('a-longer-ctx-value', Buffer.from('never arrives', 'utf8')));
  const full = concat(header, keptRecord, nextRecord);

  it('stops cleanly when the next record header (type + length prefix) is incomplete', () => {
    // Only 2 of the 5 header bytes (1 type + 4 length) of the next record are present.
    const truncated = full.subarray(0, header.length + keptRecord.length + 2);

    let records: { ctx: string | number; bytes: Buffer }[] = [];
    expect(() => {
      records = toBuffers([...readCaptureRecords(truncated)]);
    }).not.toThrow();
    expect(records).toEqual([{ ctx: 'conn', bytes: kept }]);
  });

  it('stops cleanly when the next record header is complete but its ctx bytes are cut short', () => {
    // The 5-byte type+length header is present, but only 3 of the 19 ctx bytes it promises are.
    const truncated = full.subarray(0, header.length + keptRecord.length + 5 + 3);

    const records = toBuffers([...readCaptureRecords(truncated)]);
    expect(records).toEqual([{ ctx: 'conn', bytes: kept }]);
  });

  it('stops cleanly when ctx is complete but the payload length prefix is cut short', () => {
    const ctxBytes = Buffer.from('a-longer-ctx-value', 'utf8');
    const upToCtx = header.length + keptRecord.length + 5 + ctxBytes.length;
    const truncated = full.subarray(0, upToCtx + 2);

    const records = toBuffers([...readCaptureRecords(truncated)]);
    expect(records).toEqual([{ ctx: 'conn', bytes: kept }]);
  });

  it('stops cleanly when ctx and payload length are complete but the payload bytes are cut short', () => {
    const truncated = full.subarray(0, full.length - 4);

    const records = toBuffers([...readCaptureRecords(truncated)]);
    expect(records).toEqual([{ ctx: 'conn', bytes: kept }]);
  });
});

describe('capture-format: header validation', () => {
  it('rejects a file with the wrong magic bytes instead of misparsing it', () => {
    const bogus = concat(Buffer.from('NOPE', 'ascii'), Buffer.from([1]), encodeCaptureRecord('conn', Buffer.from('x')));

    expect(() => [...readCaptureRecords(bogus)]).toThrow(CaptureFormatError);
  });

  it('rejects a file with a recognised magic but an unsupported version', () => {
    const header = Buffer.from(encodeCaptureHeader());
    header.writeUInt8(99, header.length - 1);

    expect(() => [...readCaptureRecords(header)]).toThrow(CaptureFormatError);
  });

  it('rejects a file shorter than the header entirely', () => {
    const tooShort = Buffer.from([0x42, 0x46]);

    expect(() => [...readCaptureRecords(tooShort)]).toThrow(CaptureFormatError);
  });

  it('rejects an empty file', () => {
    expect(() => [...readCaptureRecords(Buffer.alloc(0))]).toThrow(CaptureFormatError);
  });
});

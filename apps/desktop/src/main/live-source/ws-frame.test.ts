import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOversized64BitLengthFrame } from './fixtures/generate-replay-stream.js';
import { DecodedFrame, FrameDecodeError, FrameDecoder, OPCODE } from './ws-frame.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;

function xorMask(payload: Buffer, maskKey: Buffer): Buffer {
  const out = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i += 1) {
    out.writeUInt8(payload.readUInt8(i) ^ maskKey.readUInt8(i % 4), i);
  }
  return out;
}

function buildFrame(opts: { fin: boolean; opcode: number; payload: Buffer; maskKey?: Buffer }): Buffer {
  const masked = opts.maskKey !== undefined;
  const byte0 = Buffer.from([(opts.fin ? 0x80 : 0) | (opts.opcode & 0x0f)]);

  let lengthBytes: Buffer;
  if (opts.payload.length <= 125) {
    lengthBytes = Buffer.from([opts.payload.length | (masked ? 0x80 : 0)]);
  } else if (opts.payload.length <= 0xffff) {
    lengthBytes = Buffer.alloc(3);
    lengthBytes.writeUInt8(126 | (masked ? 0x80 : 0), 0);
    lengthBytes.writeUInt16BE(opts.payload.length, 1);
  } else {
    throw new Error('test helper: payload too large for this suite');
  }

  const payload = opts.maskKey ? xorMask(opts.payload, opts.maskKey) : opts.payload;
  return Buffer.concat([byte0, lengthBytes, ...(opts.maskKey ? [opts.maskKey] : []), payload]);
}

describe('FrameDecoder', () => {
  it('decodes a frame split across three pushes once it is whole', () => {
    const frame = buildFrame({ fin: true, opcode: OPCODE.text, payload: Buffer.from('{"t":"snap"}') });
    const decoder = new FrameDecoder();

    const first = decoder.push(frame.subarray(0, 3));
    const second = decoder.push(frame.subarray(3, 8));
    const third = decoder.push(frame.subarray(8));

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(third).toHaveLength(1);
    expect(third[0]?.opcode).toBe(OPCODE.text);
    expect(third[0]?.payload.toString('utf8')).toBe('{"t":"snap"}');
  });

  it('decodes two frames delivered in one push as two frames', () => {
    const a = buildFrame({ fin: true, opcode: OPCODE.text, payload: Buffer.from('one') });
    const b = buildFrame({ fin: true, opcode: OPCODE.text, payload: Buffer.from('two') });
    const decoder = new FrameDecoder();

    const decoded = decoder.push(Buffer.concat([a, b]));

    expect(decoded).toHaveLength(2);
    expect(decoded[0]?.payload.toString('utf8')).toBe('one');
    expect(decoded[1]?.payload.toString('utf8')).toBe('two');
  });

  it('reassembles a fragmented message under the original opcode', () => {
    const start = buildFrame({ fin: false, opcode: OPCODE.text, payload: Buffer.from('ab') });
    const middle = buildFrame({ fin: false, opcode: OPCODE.continuation, payload: Buffer.from('cd') });
    const end = buildFrame({ fin: true, opcode: OPCODE.continuation, payload: Buffer.from('ef') });
    const decoder = new FrameDecoder();

    const decoded = decoder.push(Buffer.concat([start, middle, end]));

    expect(decoded).toHaveLength(1);
    expect(decoded[0]?.opcode).toBe(OPCODE.text);
    expect(decoded[0]?.payload.toString('utf8')).toBe('abcdef');
  });

  it('passes a ping interleaved inside a fragmented message through without corrupting reassembly', () => {
    const start = buildFrame({ fin: false, opcode: OPCODE.text, payload: Buffer.from('ab') });
    const ping = buildFrame({ fin: true, opcode: OPCODE.ping, payload: Buffer.from('PING') });
    const end = buildFrame({ fin: true, opcode: OPCODE.continuation, payload: Buffer.from('cd') });
    const decoder = new FrameDecoder();

    const decoded = decoder.push(Buffer.concat([start, ping, end]));

    expect(decoded).toHaveLength(2);
    expect(decoded[0]).toEqual<DecodedFrame>({ opcode: OPCODE.ping, payload: Buffer.from('PING') });
    expect(decoded[1]?.opcode).toBe(OPCODE.text);
    expect(decoded[1]?.payload.toString('utf8')).toBe('abcd');
  });

  it('unmasks a masked frame to the original payload', () => {
    const maskKey = Buffer.from([0x12, 0x34, 0x56, 0x78]);
    const payload = Buffer.from('{"gold":"42"}');
    const frame = buildFrame({ fin: true, opcode: OPCODE.text, payload, maskKey });
    const decoder = new FrameDecoder();

    const decoded = decoder.push(frame);

    expect(decoded).toHaveLength(1);
    expect(decoded[0]?.payload).toEqual(payload);
  });

  it('throws on a 64-bit payload length above Number.MAX_SAFE_INTEGER', () => {
    const decoder = new FrameDecoder();
    expect(() => decoder.push(buildOversized64BitLengthFrame())).toThrow();
  });

  it('carries the frames already decoded in the same push on the thrown error, instead of losing them', () => {
    const a = buildFrame({ fin: true, opcode: OPCODE.text, payload: Buffer.from('one') });
    const b = buildFrame({ fin: true, opcode: OPCODE.text, payload: Buffer.from('two') });
    const malformed = buildOversized64BitLengthFrame();
    const decoder = new FrameDecoder();

    let caught: unknown;
    try {
      decoder.push(Buffer.concat([a, b, malformed]));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(FrameDecodeError);
    const decoded = (caught as FrameDecodeError).decoded;
    expect(decoded).toHaveLength(2);
    expect(decoded[0]?.payload.toString('utf8')).toBe('one');
    expect(decoded[1]?.payload.toString('utf8')).toBe('two');
  });

  it('carries a remainder on the thrown error that starts at the malformed frame and still holds the frame trailing it', () => {
    const a = buildFrame({ fin: true, opcode: OPCODE.text, payload: Buffer.from('one') });
    const malformed = buildOversized64BitLengthFrame();
    const b = buildFrame({ fin: true, opcode: OPCODE.text, payload: Buffer.from('two') });
    const decoder = new FrameDecoder();

    let caught: unknown;
    try {
      decoder.push(Buffer.concat([a, malformed, b]));
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(FrameDecodeError);
    const frameError = caught as FrameDecodeError;
    expect(frameError.decoded).toHaveLength(1);
    expect(frameError.decoded[0]?.payload.toString('utf8')).toBe('one');
    expect(frameError.remainder).toEqual(Buffer.concat([malformed, b]));
  });

  it('imports nothing that can open a network connection', () => {
    const source = readFileSync(resolve(HERE, 'ws-frame.ts'), 'utf8');
    const importSpecifiers = [...source.matchAll(/(?:import|export)\s+(?:type\s+)?[^'";]*?from\s+['"]([^'"]+)['"]/g)].map(
      (match) => match[1],
    );

    const networkCapable = /^node:(net|tls|http2?|dgram|https)$|^(ws|net|tls|http2?|dgram|https|node-fetch)$/;
    const offenders = importSpecifiers.filter((specifier) => specifier !== undefined && networkCapable.test(specifier));

    expect(offenders).toEqual([]);
  });
});

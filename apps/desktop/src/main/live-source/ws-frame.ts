/**
 * A rolling RFC 6455 frame decoder with no socket underneath it.
 *
 * This module imports nothing but the global `Buffer` — no `node:net`, `node:tls`, `node:http`,
 * `ws`, or any other module that can open a connection. It decodes bytes a hook inside the game
 * client hands the app *after* the client's own TLS layer has already decrypted them; the read
 * path this module serves is only ever allowed to look at traffic the client already carries, and
 * a decoder on that path has to be structurally unable to speak to the server, not merely
 * disciplined about it. `ws-frame.test.ts` reads this file's own source text and asserts it
 * imports no network-capable module.
 */

export const OPCODE = { continuation: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xa } as const;

export interface DecodedFrame {
  readonly opcode: number;
  readonly payload: Buffer;
}

interface ParsedHeader {
  readonly fin: boolean;
  readonly opcode: number;
  readonly masked: boolean;
  readonly payloadLength: number;
  /** Bytes from the start of the frame up to (not including) the payload. */
  readonly headerLength: number;
  readonly maskKey?: Buffer;
}

function parseHeader(buf: Buffer): ParsedHeader | undefined {
  if (buf.length < 2) return undefined;

  const byte0 = buf.readUInt8(0);
  const byte1 = buf.readUInt8(1);
  const fin = (byte0 & 0x80) !== 0;
  const opcode = byte0 & 0x0f;
  const masked = (byte1 & 0x80) !== 0;
  const lenField = byte1 & 0x7f;

  let offset = 2;
  let payloadLength: number;
  if (lenField <= 125) {
    payloadLength = lenField;
  } else if (lenField === 126) {
    if (buf.length < offset + 2) return undefined;
    payloadLength = buf.readUInt16BE(offset);
    offset += 2;
  } else {
    if (buf.length < offset + 8) return undefined;
    const high = buf.readUInt32BE(offset);
    const low = buf.readUInt32BE(offset + 4);
    const value = (BigInt(high) << 32n) | BigInt(low);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`ws-frame: 64-bit payload length ${value.toString()} exceeds Number.MAX_SAFE_INTEGER`);
    }
    payloadLength = Number(value);
    offset += 8;
  }

  let maskKey: Buffer | undefined;
  if (masked) {
    if (buf.length < offset + 4) return undefined;
    maskKey = buf.subarray(offset, offset + 4);
    offset += 4;
  }

  return {
    fin,
    opcode,
    masked,
    payloadLength,
    headerLength: offset,
    ...(maskKey !== undefined ? { maskKey } : {}),
  };
}

function unmask(payload: Buffer, maskKey: Buffer): Buffer {
  const out = Buffer.allocUnsafe(payload.length);
  for (let i = 0; i < payload.length; i += 1) {
    out.writeUInt8(payload.readUInt8(i) ^ maskKey.readUInt8(i % 4), i);
  }
  return out;
}

/**
 * Decodes a byte stream into whole WebSocket frames, holding whatever a frame is still missing
 * across calls. Fragmented text/binary messages are reassembled into one {@link DecodedFrame}
 * carrying the original (non-continuation) opcode; control frames (opcode >= 0x8) may legally
 * interleave inside a fragmented message and are passed straight through without touching the
 * fragment buffer, since RFC 6455 forbids fragmenting them.
 */
export class FrameDecoder {
  #buffer: Buffer = Buffer.alloc(0);
  #fragments: Buffer[] = [];
  #fragmentedOpcode: number | undefined;

  push(chunk: Uint8Array): DecodedFrame[] {
    this.#buffer = Buffer.concat([this.#buffer, Buffer.from(chunk)]);

    const decoded: DecodedFrame[] = [];
    for (;;) {
      const header = parseHeader(this.#buffer);
      if (!header) break;

      const frameLength = header.headerLength + header.payloadLength;
      if (this.#buffer.length < frameLength) break;

      const rawPayload = this.#buffer.subarray(header.headerLength, frameLength);
      const payload =
        header.masked && header.maskKey ? unmask(rawPayload, header.maskKey) : Buffer.from(rawPayload);
      this.#buffer = Buffer.from(this.#buffer.subarray(frameLength));

      this.#consume(header, payload, decoded);
    }
    return decoded;
  }

  #consume(header: ParsedHeader, payload: Buffer, decoded: DecodedFrame[]): void {
    if (header.opcode >= OPCODE.close) {
      decoded.push({ opcode: header.opcode, payload });
      return;
    }

    if (header.opcode === OPCODE.continuation) {
      this.#fragments.push(payload);
      if (header.fin) {
        decoded.push({ opcode: this.#fragmentedOpcode ?? OPCODE.continuation, payload: Buffer.concat(this.#fragments) });
        this.#fragments = [];
        this.#fragmentedOpcode = undefined;
      }
      return;
    }

    if (!header.fin) {
      this.#fragments = [payload];
      this.#fragmentedOpcode = header.opcode;
      return;
    }

    decoded.push({ opcode: header.opcode, payload });
  }
}

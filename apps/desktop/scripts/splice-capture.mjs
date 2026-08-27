/**
 * Removes heroes from a recorded `.bfcc` capture WITHOUT re-serialising anything.
 *
 * The obvious implementation — parse each frame, drop entries, `JSON.stringify` — does not
 * survive contact with the capture: the game writes whole floats with a trailing `.0`
 * (`"gate":-1.0`) and `JSON.stringify` writes `-1`, so a round-trip that changes nothing at all
 * still rewrites all 58 frames. Matching that formatting would mean reimplementing the game's
 * encoder from its output, which is the belief-duplication this repo refuses: our encoder and our
 * decoder would agree with each other while both drifted from the game, and every test would stay
 * green through it.
 *
 * So this deletes byte ranges instead. Every byte that survives is the byte the game sent. The
 * only thing authored here is the cut, and `spliceCaptureHeroes(bytes, [])` returning its input
 * unchanged is the proof that the cutting machinery adds nothing — see the guard test.
 *
 * Safe because a hero entry is self-contained: it is a flat object of scalars, and nothing else in
 * a frame addresses heroes. `bombs`, `hits`, `explosions` and `loot` are all keyed by grid cell,
 * and `kinds`/`hps` are whole-grid arrays — so removing a hero shifts no index anything else reads.
 */

/** Written as a code point so no layer of quoting between here and the file can eat it. */
const BACKSLASH = 92;
const WS_TEXT_FIRST_BYTE = 0x81;
const CAPTURE_MAGIC = 'BFCC';
const CAPTURE_HEADER_BYTES = CAPTURE_MAGIC.length + 1;

/** Byte span of the flat `{...}` starting at `start`, string-aware so a brace inside a string
 *  cannot end it early. Throws on a nested object rather than guessing: this file's whole claim is
 *  that a hero entry is flat, and a nested one would mean that stopped being true. */
function flatObjectEnd(text, start) {
  let inString = false;
  let escaped = false;
  for (let i = start + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
    } else if (ch.charCodeAt(0) === BACKSLASH) {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString && ch === '{') {
      throw new Error(`splice-capture: hero entry at ${String(start)} is not flat`);
    } else if (!inString && ch === '}') {
      return i + 1;
    }
  }
  throw new Error(`splice-capture: unterminated hero entry at ${String(start)}`);
}

/** Each element's byte span inside the `"heroes":[` array that starts at `arrayStart`. */
function heroEntrySpans(text, arrayStart) {
  const spans = [];
  let i = arrayStart + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ']') return spans;
    if (ch === '{') {
      const end = flatObjectEnd(text, i);
      spans.push({ start: i, end });
      i = end;
      continue;
    }
    i += 1;
  }
  throw new Error('splice-capture: unterminated heroes array');
}

const HEROES_KEY = '"heroes":[';

/**
 * The frame text with every entry whose `"id"` is in `dropIds` cut out.
 *
 * Kept entries are copied together with the separator bytes that already stood between them, not
 * re-joined with a fresh `','`. Re-joining would normalise any whitespace the game happens to put
 * between entries — a byte changed outside the cut, which is the one thing this module promises not
 * to do, and which the "leaves every byte outside the heroes array alone" guard masks out by
 * construction and so could never catch.
 */
export function spliceFrameText(text, dropIds) {
  const keyAt = text.indexOf(HEROES_KEY);
  if (keyAt === -1) return text;
  if (text.indexOf(HEROES_KEY, keyAt + 1) !== -1) {
    throw new Error('splice-capture: frame carries more than one heroes array');
  }

  const arrayStart = keyAt + HEROES_KEY.length - 1;
  const spans = heroEntrySpans(text, arrayStart);
  if (spans.length === 0) return text;

  const dropped = (span) => {
    const id = /"id":"([^"]*)"/.exec(text.slice(span.start, span.end))?.[1];
    return id !== undefined && dropIds.has(id);
  };
  if (!spans.some(dropped)) return text;

  // Separators are copied one at a time from the bytes that followed the PREVIOUS kept entry, not
  // taken as the whole run between two kept entries: that run contains the dropped entries, and
  // copying it wholesale keeps the very heroes this is removing.
  const keptIndices = spans.map((span, index) => (dropped(span) ? -1 : index)).filter((index) => index !== -1);

  let body = keptIndices.length > 0 ? text.slice(arrayStart + 1, spans[0].start) : '';
  for (const [position, index] of keptIndices.entries()) {
    if (position > 0) {
      const previous = keptIndices[position - 1];
      body += text.slice(spans[previous].end, spans[previous + 1].start);
    }
    body += text.slice(spans[index].start, spans[index].end);
  }

  return `${text.slice(0, arrayStart + 1)}${body}${text.slice(spans[spans.length - 1].end)}`;
}

export function readFrame(payload) {
  if (payload[0] !== WS_TEXT_FIRST_BYTE) return null;
  const short = payload[1] & 0x7f;
  if (short === 126) return { offset: 4, length: payload.readUInt16BE(2), lengthForm: 126 };
  if (short === 127) return { offset: 10, length: Number(payload.readBigUInt64BE(2)), lengthForm: 127 };
  return { offset: 2, length: short, lengthForm: short };
}

/**
 * A WS text frame carrying `text`, in the SAME length form the frame it replaces used.
 *
 * Not the shortest form that fits, which is what a fresh encoder would pick: a 16-bit frame whose
 * spliced body drops to 125 bytes or fewer would come back re-headered as a 7-bit one, and every
 * byte-identity check here would still pass because none of them re-encodes an untouched frame.
 * Preserving the form means the only bytes this function can change are the ones that were cut.
 */
function frameText(text, lengthForm) {
  const body = Buffer.from(text, 'utf8');
  if (lengthForm <= 125) {
    if (body.length > 125) throw new Error('splice-capture: body outgrew its 7-bit length form');
    return Buffer.concat([Buffer.from([WS_TEXT_FIRST_BYTE, body.length]), body]);
  }
  if (lengthForm === 126) {
    if (body.length > 0xffff) throw new Error('splice-capture: body outgrew its 16-bit length form');
    const header = Buffer.alloc(4);
    header.writeUInt8(WS_TEXT_FIRST_BYTE, 0);
    header.writeUInt8(126, 1);
    header.writeUInt16BE(body.length, 2);
    return Buffer.concat([header, body]);
  }
  const header = Buffer.alloc(10);
  header.writeUInt8(WS_TEXT_FIRST_BYTE, 0);
  header.writeUInt8(127, 1);
  header.writeBigUInt64BE(BigInt(body.length), 2);
  return Buffer.concat([header, body]);
}

/** Re-encodes a frame's own text through {@link frameText}, so a guard can prove the encoder
 *  reproduces bytes it did not cut. Splicing an empty id list cannot prove that: it never parses. */
export function reencodeFrame(payload) {
  const frame = readFrame(payload);
  if (frame === null) return payload;
  const text = payload.subarray(frame.offset, frame.offset + frame.length).toString('utf8');
  return Buffer.concat([
    frameText(text, frame.lengthForm),
    payload.subarray(frame.offset + frame.length),
  ]);
}

/** Each record's payload, so a guard can walk a capture without reimplementing the container. */
/**
 * Each record's payload. Stops at the first record the file does not fully contain rather than
 * reading past the end: a hard app exit truncates a capture mid-record, which `capture-format.ts`
 * and the fixture generator's own reader both already tolerate. Reading on gives `ERR_OUT_OF_RANGE`
 * or, worse, a confident-sounding complaint about an unterminated heroes array.
 */
export function* capturePayloads(data) {
  let offset = CAPTURE_HEADER_BYTES;
  while (offset + 5 <= data.length) {
    const ctxLength = data.readUInt32LE(offset + 1);
    const lengthAt = offset + 5 + ctxLength;
    if (lengthAt + 4 > data.length) return;
    const payloadLength = data.readUInt32LE(lengthAt);
    const payloadStart = lengthAt + 4;
    if (payloadStart + payloadLength > data.length) return;
    yield data.subarray(payloadStart, payloadStart + payloadLength);
    offset = payloadStart + payloadLength;
  }
}

/**
 * @param {Buffer} data a `.bfcc` capture
 * @param {readonly string[]} dropHeroIds hero ids to remove from every frame
 * @returns {Buffer} the same capture with those heroes gone and every other byte untouched
 */
export function spliceCaptureHeroes(data, dropHeroIds) {
  if (data.subarray(0, CAPTURE_MAGIC.length).toString('ascii') !== CAPTURE_MAGIC) {
    throw new Error('splice-capture: not a capture file');
  }
  const dropIds = new Set(dropHeroIds);
  const out = [data.subarray(0, CAPTURE_HEADER_BYTES)];

  let offset = CAPTURE_HEADER_BYTES;
  while (offset + 5 <= data.length) {
    const recordStart = offset;
    const ctxLength = data.readUInt32LE(offset + 1);
    const lengthAt = offset + 5 + ctxLength;
    if (lengthAt + 4 > data.length) break;
    const payloadLength = data.readUInt32LE(lengthAt);
    const payloadStart = lengthAt + 4;
    if (payloadStart + payloadLength > data.length) break;
    const payload = data.subarray(payloadStart, payloadStart + payloadLength);
    offset = payloadStart + payloadLength;

    const frame = readFrame(payload);
    if (frame === null) {
      out.push(data.subarray(recordStart, offset));
      continue;
    }

    // Every walker downstream — the fixture generator's own capture reader, and the drift test's —
    // reads one frame per record too, so a record holding two would be spliced in its first and
    // copied through in its second, with nothing reporting the half that was missed.
    if (frame.offset + frame.length !== payload.length) {
      throw new Error('splice-capture: record payload is not exactly one WebSocket frame');
    }
    const text = payload.subarray(frame.offset, frame.offset + frame.length).toString('utf8');
    const spliced = spliceFrameText(text, dropIds);
    if (spliced === text) {
      out.push(data.subarray(recordStart, offset));
      continue;
    }

    const nextPayload = Buffer.concat([
      frameText(spliced, frame.lengthForm),
      payload.subarray(frame.offset + frame.length),
    ]);
    const head = Buffer.from(data.subarray(recordStart, payloadStart));
    head.writeUInt32LE(nextPayload.length, head.length - 4);
    out.push(head, nextPayload);
  }

  return Buffer.concat(out);
}

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
const CAPTURE_HEADER_BYTES = 5;

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

/** The frame text with every entry whose `"id"` is in `dropIds` cut out, commas repaired. */
export function spliceFrameText(text, dropIds) {
  const keyAt = text.indexOf(HEROES_KEY);
  if (keyAt === -1) return text;
  const arrayStart = keyAt + HEROES_KEY.length - 1;
  const spans = heroEntrySpans(text, arrayStart);

  const kept = spans.filter((span) => {
    const id = /"id":"([^"]*)"/.exec(text.slice(span.start, span.end))?.[1];
    return id === undefined || !dropIds.has(id);
  });
  if (kept.length === spans.length) return text;

  const body = kept.map((span) => text.slice(span.start, span.end)).join(',');
  const arrayEnd = spans[spans.length - 1].end;
  return `${text.slice(0, arrayStart + 1)}${body}${text.slice(arrayEnd)}`;
}

function readFrame(payload) {
  if (payload[0] !== WS_TEXT_FIRST_BYTE) return null;
  const short = payload[1] & 0x7f;
  if (short === 126) return { offset: 4, length: payload.readUInt16BE(2) };
  if (short === 127) return { offset: 10, length: Number(payload.readBigUInt64BE(2)) };
  return { offset: 2, length: short };
}

/** A WS text frame carrying `payload`, in the same 7-bit / 16-bit length forms the capture uses. */
function frameText(text) {
  const body = Buffer.from(text, 'utf8');
  if (body.length > 0xffff) throw new Error('splice-capture: frame too large for the 16-bit length form');
  const header =
    body.length <= 125
      ? Buffer.from([WS_TEXT_FIRST_BYTE, body.length])
      : (() => {
          const buf = Buffer.alloc(4);
          buf.writeUInt8(WS_TEXT_FIRST_BYTE, 0);
          buf.writeUInt8(126, 1);
          buf.writeUInt16BE(body.length, 2);
          return buf;
        })();
  return Buffer.concat([header, body]);
}

/**
 * @param {Buffer} data a `.bfcc` capture
 * @param {readonly string[]} dropHeroIds hero ids to remove from every frame
 * @returns {Buffer} the same capture with those heroes gone and every other byte untouched
 */
export function spliceCaptureHeroes(data, dropHeroIds) {
  const dropIds = new Set(dropHeroIds);
  const out = [data.subarray(0, CAPTURE_HEADER_BYTES)];

  let offset = CAPTURE_HEADER_BYTES;
  while (offset < data.length) {
    const recordStart = offset;
    offset += 1;
    const ctxLength = data.readUInt32LE(offset);
    offset += 4;
    offset += ctxLength;
    const payloadLength = data.readUInt32LE(offset);
    offset += 4;
    const payload = data.subarray(offset, offset + payloadLength);
    const payloadStart = offset;
    offset += payloadLength;

    const frame = dropIds.size === 0 ? null : readFrame(payload);
    if (frame === null) {
      out.push(data.subarray(recordStart, offset));
      continue;
    }

    const text = payload.subarray(frame.offset, frame.offset + frame.length).toString('utf8');
    const spliced = spliceFrameText(text, dropIds);
    if (spliced === text) {
      out.push(data.subarray(recordStart, offset));
      continue;
    }

    const nextPayload = Buffer.concat([
      payload.subarray(0, 0),
      frameText(spliced),
      payload.subarray(frame.offset + frame.length),
    ]);
    const head = Buffer.from(data.subarray(recordStart, payloadStart));
    head.writeUInt32LE(nextPayload.length, head.length - 4);
    out.push(head, nextPayload);
  }

  return Buffer.concat(out);
}

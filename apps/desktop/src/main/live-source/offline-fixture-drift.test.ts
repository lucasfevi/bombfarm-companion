import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';

type Generable = Iterable<Buffer>;

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;
const COMMITTED = resolve(HERE, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');
const COMMITTED_CAPS = resolve(HERE, '..', '..', '..', 'tests', 'fixtures', 'account-offline-caps.json');
const CAPTURE = resolve(HERE, 'fixtures', 'live-capture.bfcc');
const COMMITTED_CAPS_CAPTURE = resolve(HERE, 'fixtures', 'live-capture-caps.bfcc');
const SPLICER = resolve(HERE, '..', '..', '..', 'scripts', 'splice-capture.mjs');
const GENERATOR = resolve(HERE, '..', '..', '..', 'scripts', 'generate-offline-fixture.mjs');

/**
 * The counterpart to `fixtures/replay-stream-drift.test.ts`, which pins `replay-stream.bin` to its
 * generator the same way. Without it a hand-edit of the committed JSON, or a generator change made
 * without regenerating, goes unnoticed — and the file is 7,000+ lines, so nobody reads the diff.
 */
describe('the offline account fixture matches its generator', () => {
  it('is byte-identical to what the generator produces from the same two captures', async () => {
    const { serializeOfflineFixture } = (await import(GENERATOR)) as {
      serializeOfflineFixture: () => string;
    };

    // `readFileSync` as utf8, not a Buffer compare: the repo is LF everywhere and the generator
    // writes LF, so a byte compare would fail on a checkout that normalised endings rather than on
    // real content drift.
    expect(serializeOfflineFixture()).toBe(readFileSync(COMMITTED, 'utf8'));
  });

  it('still agrees with itself about who is on the field', async () => {
    const { buildOfflineFixture } = (await import(GENERATOR)) as {
      buildOfflineFixture: () => { casa: { field_size: number; heroes: { in_field: boolean }[] } };
    };
    const payload = buildOfflineFixture();

    // The generator throws when these disagree; this proves the check is reached and satisfied
    // rather than trusting that it would have fired.
    expect(payload.casa.heroes.filter((hero) => hero.in_field).length).toBe(payload.casa.field_size);
  });
});

/**
 * The `--account caps` variant is derived from the fixture above rather than captured, so it is
 * pinned to the same generator for the same reason: hand-editing 7,000 lines of JSON is not a
 * reviewable diff. What it exists to show — the four rotation states the replay capture cannot
 * produce on its own, and a rest-slot count below its ceiling — is asserted here rather than left
 * to be noticed from the screen.
 */
describe('the caps account fixture matches its generator', () => {
  it('is byte-identical to what the generator produces', async () => {
    const { serializeCapsFixture } = (await import(GENERATOR)) as {
      serializeCapsFixture: () => string;
    };
    expect(serializeCapsFixture()).toBe(readFileSync(COMMITTED_CAPS, 'utf8'));
  });

  it('puts a hero in every rotation state, which the base fixture never does', async () => {
    const { buildCapsFixture, buildOfflineFixture } = (await import(GENERATOR)) as {
      buildCapsFixture: () => { casa: { heroes: { state: string; recovering: boolean }[] } };
      buildOfflineFixture: () => { casa: { heroes: { state: string }[] } };
    };
    const states = (payload: { casa: { heroes: { state: string }[] } }) =>
      new Set(payload.casa.heroes.map((hero) => hero.state));

    expect(states(buildCapsFixture())).toEqual(new Set(['EM_CAMPO', 'DESCANSANDO', 'PRONTO', 'NO_BANCO']));
    expect(states(buildOfflineFixture())).toEqual(new Set(['EM_CAMPO', 'DESCANSANDO']));
  });

  it('carries both kinds of idle hero — one full and waiting for the field, one still filling', async () => {
    const { buildCapsFixture } = (await import(GENERATOR)) as {
      buildCapsFixture: () => {
        casa: { heroes: { state: string; recovering: boolean; energia_pct?: number }[] };
      };
    };
    const heroes = buildCapsFixture().casa.heroes;

    expect(heroes.find((hero) => hero.state === 'PRONTO')?.energia_pct).toBe(1);
    const queued = heroes.find((hero) => hero.state === 'DESCANSANDO' && !hero.recovering);
    expect(queued?.energia_pct).toBeLessThan(1);
  });

  it('leaves one hero with no energy figure at all, so the missing-energy bar has something to render', async () => {
    const { buildCapsFixture } = (await import(GENERATOR)) as {
      buildCapsFixture: () => { casa: { heroes: { state: string; energia_pct?: number }[] } };
    };
    const benched = buildCapsFixture().casa.heroes.find((hero) => hero.state === 'NO_BANCO');
    expect(benched).toBeDefined();
    expect(benched && Object.hasOwn(benched, 'energia_pct')).toBe(false);
  });

  it('sits below the rest-slot ceiling and carries a daily skip allowance, so both readings show', async () => {
    const { buildCapsFixture } = (await import(GENERATOR)) as {
      buildCapsFixture: () => {
        casa: {
          rescues_left: number;
          rescues_max: number;
          casa: { slots: number; slots_per_house: number[] };
        };
      };
    };
    const { casa } = buildCapsFixture();

    expect(casa.casa.slots).toBeLessThan(Math.max(...casa.casa.slots_per_house));
    expect(casa.rescues_left).toBeGreaterThan(0);
    expect(casa.rescues_max).toBe(15);
  });

  it('narrows the field below the game ceiling, and its own frames agree — anything else reads 9/6', async () => {
    const { buildCapsFixture, buildOfflineFixture } = (await import(GENERATOR)) as {
      buildCapsFixture: () => { casa: { field_size: number; heroes: { in_field: boolean }[] } };
      buildOfflineFixture: () => { casa: { field_size: number } };
    };
    const caps = buildCapsFixture();
    const onField = caps.casa.heroes.filter((hero) => hero.in_field).length;

    expect(caps.casa.field_size).toBeLessThan(buildOfflineFixture().casa.field_size);
    expect(caps.casa.field_size).toBeLessThan(FIELD_SLOTS_MAX);
    // The half that cannot be asserted from `field_size` alone: the frames have to show the same
    // number, because the live tap's on-field set overrules the snapshot.
    expect(onField).toBe(caps.casa.field_size);
  });
});

/**
 * The `caps` scenario narrows the field, and that has to be done to the FRAMES: the live tap's
 * on-field set overrules the snapshot, so an account claiming a narrower field than its capture
 * shows reads "9/6".
 *
 * Narrowing them by re-serialising is not available. The game writes whole floats with a trailing
 * `.0` (`"gate":-1.0`) and `JSON.stringify` writes `-1`, so a round-trip that changes nothing still
 * rewrites every frame — and matching that formatting would mean reimplementing the game's encoder
 * from its own output, which is how a generator and a decoder come to agree with each other while
 * both drift from the game. `splice-capture.mjs` deletes byte ranges instead, and the first test
 * below is the proof that the deleting machinery introduces nothing of its own.
 */
describe('the caps replay capture is the recorded one, minus three heroes', () => {
  it('re-encodes every recorded frame byte-for-byte — the encoder reproduces what it did not cut', async () => {
    // The guard that used to stand here spliced an empty id list, which is vacuous: the walker
    // short-circuited before parsing, so the encoder was never reached and a frame silently
    // re-headered into a different WebSocket length form would still have passed.
    const { reencodeFrame, capturePayloads } = (await import(SPLICER)) as {
      reencodeFrame: (payload: Buffer) => Buffer;
      capturePayloads: (data: Buffer) => Generable;
    };
    const payloads = [...capturePayloads(readFileSync(CAPTURE))];
    expect(payloads.length).toBeGreaterThan(0);
    expect(payloads.filter((payload) => !reencodeFrame(payload).equals(payload))).toEqual([]);
  });

  it('round-trips all three WebSocket length forms, not only the one the capture happens to use', async () => {
    // Every recorded frame is the 16-bit form and sits far above the 125-byte boundary, so no
    // assertion over the real capture reaches the 7-bit or 64-bit branches at all — a mutant that
    // broke either survived the other guards here. A capture that ever carries a short frame (a
    // heartbeat, an ack) and loses a hero from it goes straight through the 7-bit branch.
    const { reencodeFrame } = (await import(SPLICER)) as { reencodeFrame: (payload: Buffer) => Buffer };
    const body = Buffer.from('{"heroes":[{"id":"a"}]}', 'utf8');

    const sevenBit = Buffer.concat([Buffer.from([0x81, body.length]), body]);
    expect(body.length).toBeLessThanOrEqual(125);
    expect(reencodeFrame(sevenBit).equals(sevenBit)).toBe(true);

    const sixtyFourBitHeader = Buffer.alloc(10);
    sixtyFourBitHeader.writeUInt8(0x81, 0);
    sixtyFourBitHeader.writeUInt8(127, 1);
    sixtyFourBitHeader.writeBigUInt64BE(BigInt(body.length), 2);
    const sixtyFourBit = Buffer.concat([sixtyFourBitHeader, body]);
    expect(reencodeFrame(sixtyFourBit).equals(sixtyFourBit)).toBe(true);
  });

  it('keeps a frame in the length form it arrived in, even when a shorter one would now fit', async () => {
    // The recorded frames are all far above the 125-byte boundary, so no assertion over the real
    // capture can reach this: a fresh encoder picking the shortest form that fits reproduces them
    // exactly. It is a SPLICED frame that can cross the boundary downwards, and re-headering it
    // would rewrite two bytes nothing asked to change. Hence a frame built at the boundary.
    const { reencodeFrame } = (await import(SPLICER)) as { reencodeFrame: (payload: Buffer) => Buffer };

    const body = Buffer.from('{"heroes":[]}', 'utf8');
    expect(body.length).toBeLessThanOrEqual(125);
    const sixteenBitHeader = Buffer.alloc(4);
    sixteenBitHeader.writeUInt8(0x81, 0);
    sixteenBitHeader.writeUInt8(126, 1);
    sixteenBitHeader.writeUInt16BE(body.length, 2);
    const payload = Buffer.concat([sixteenBitHeader, body]);

    expect(reencodeFrame(payload).equals(payload)).toBe(true);
  });

  it('preserves the separator bytes between the entries it keeps, rather than re-joining them', async () => {
    // Re-joining with a fresh comma is a byte changed outside the cut, and the "every byte outside
    // the heroes array" guard masks the array out by construction, so only this can catch it.
    const { spliceFrameText } = (await import(SPLICER)) as {
      spliceFrameText: (text: string, dropIds: Set<string>) => string;
    };
    const text = '{"heroes":[ {"id":"a"} , {"id":"b"} , {"id":"c"} ],"wave":1}';

    // Every subset, because dropping the FIRST entry worked while dropping a MIDDLE one silently
    // kept it — copying the whole run between two kept entries copies the dropped one with it.
    const results = [['a'], ['b'], ['c'], ['a', 'b'], ['b', 'c'], ['a', 'c'], ['a', 'b', 'c'], []].map((drop) => ({
      drop,
      out: spliceFrameText(text, new Set(drop)),
    }));

    for (const { drop, out } of results) {
      const parsed = JSON.parse(out) as { heroes: { id: string }[]; wave: number };
      expect(parsed.heroes.map((hero) => hero.id)).toEqual(['a', 'b', 'c'].filter((id) => !drop.includes(id)));
      expect(parsed.wave).toBe(1);
    }
    expect(results[1]?.out).toBe('{"heroes":[ {"id":"a"} , {"id":"c"} ],"wave":1}');
  });

  it('refuses a frame it cannot splice wholly, rather than splicing the half it understands', async () => {
    const { spliceFrameText } = (await import(SPLICER)) as {
      spliceFrameText: (text: string, dropIds: Set<string>) => string;
    };
    expect(() => spliceFrameText('{"heroes":[{"id":"a"}],"x":{"heroes":[{"id":"b"}]}}', new Set(['a']))).toThrow(
      /more than one heroes array/,
    );
  });

  it('stops at a record the file does not fully contain, the way every sibling walker does', async () => {
    const { capturePayloads, spliceCaptureHeroes } = (await import(SPLICER)) as {
      capturePayloads: (data: Buffer) => Iterable<Buffer>;
      spliceCaptureHeroes: (data: Buffer, ids: readonly string[]) => Buffer;
    };
    const truncated = readFileSync(CAPTURE).subarray(0, 900);

    expect(() => [...capturePayloads(truncated)]).not.toThrow();
    expect(() => spliceCaptureHeroes(truncated, ['73099'])).not.toThrow();
  });

  it('refuses bytes that are not a capture at all', async () => {
    const { spliceCaptureHeroes } = (await import(SPLICER)) as {
      spliceCaptureHeroes: (data: Buffer, ids: readonly string[]) => Buffer;
    };
    expect(() => spliceCaptureHeroes(Buffer.from('NOPEpayload'), ['x'])).toThrow(/not a capture file/);
  });

  it('splicing an id no frame carries changes nothing, having parsed every frame to find out', async () => {
    const { spliceCaptureHeroes } = (await import(SPLICER)) as {
      spliceCaptureHeroes: (data: Buffer, ids: readonly string[]) => Buffer;
    };
    const source = readFileSync(CAPTURE);
    expect(spliceCaptureHeroes(source, ['no-hero-has-this-id']).equals(source)).toBe(true);
    expect(spliceCaptureHeroes(source, []).equals(source)).toBe(true);
  });

  it('is byte-identical to what the generator produces', async () => {
    const { buildCapsCapture } = (await import(GENERATOR)) as { buildCapsCapture: () => Buffer };
    expect(buildCapsCapture().equals(readFileSync(COMMITTED_CAPS_CAPTURE))).toBe(true);
  });

  it('still decodes to the same frame count, with three fewer heroes and nothing else changed', async () => {
    const { buildCapsCapture } = (await import(GENERATOR)) as { buildCapsCapture: () => Buffer };
    const heroIdsIn = (bytes: Buffer) => {
      const ids = new Set<string>();
      let frames = 0;
      for (const text of frameTexts(bytes)) {
        const frame = JSON.parse(text) as { heroes?: { id?: string }[] };
        frames += 1;
        for (const hero of frame.heroes ?? []) if (hero.id !== undefined) ids.add(hero.id);
      }
      return { ids, frames };
    };

    const before = heroIdsIn(readFileSync(CAPTURE));
    const after = heroIdsIn(buildCapsCapture());

    expect(after.frames).toBe(before.frames);
    expect(after.ids.size).toBe(before.ids.size - 3);
    expect([...after.ids].every((id) => before.ids.has(id))).toBe(true);
  });

  it('leaves every byte outside the heroes array alone — the phase, wave and gold still read as the game wrote them', async () => {
    const { buildCapsCapture } = (await import(GENERATOR)) as { buildCapsCapture: () => Buffer };
    const withoutHeroes = (bytes: Buffer) =>
      [...frameTexts(bytes)].map((text) => text.replace(/"heroes":\[.*?\](?=,"bombs")/, '"heroes":[]'));

    expect(withoutHeroes(buildCapsCapture())).toEqual(withoutHeroes(readFileSync(CAPTURE)));
  });
});

/** Every WebSocket text frame's JSON, straight out of a `.bfcc`. Deliberately a local walker
 *  rather than the shipped decoder: a guard that proves the capture using the same code the app
 *  uses to read it proves only that the two agree. */
function* frameTexts(bytes: Buffer): Generator<string> {
  let offset = 5;
  while (offset + 5 <= bytes.length) {
    const ctxLength = bytes.readUInt32LE(offset + 1);
    const payloadStart = offset + 5 + ctxLength + 4;
    if (payloadStart > bytes.length) return;
    const payloadLength = bytes.readUInt32LE(offset + 5 + ctxLength);
    const payloadEnd = payloadStart + payloadLength;
    if (payloadEnd > bytes.length) return;

    const payload = bytes.subarray(payloadStart, payloadEnd);
    offset = payloadEnd;
    if (payload[0] !== 0x81) continue;

    const short = (payload[1] ?? 0) & 0x7f;
    const [textOffset, textLength] =
      short === 126 ? [4, payload.readUInt16BE(2)] : short === 127 ? [10, Number(payload.readBigUInt64BE(2))] : [2, short];
    yield payload.subarray(textOffset, textOffset + textLength).toString('utf8');
  }
}

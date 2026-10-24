import { describe, expect, it } from 'vitest';
import {
  MINI_LIVE_INVOKE_CHANNELS,
  createIpcSenderPolicy,
  decideIpcSender,
  ipcSenderRejectionRecord,
  readSenderFrame,
  trustedOriginKeyOf,
  type SenderFrameFacts,
  type SenderFrameLike,
  type SenderWindow,
} from './ipc-sender-policy.js';

const APP_URL = 'app://bundle/index.html';
const DEV_URL = 'http://127.0.0.1:3000';

const packagedPolicy = createIpcSenderPolicy({ isDev: false, devRendererUrl: DEV_URL });
const devPolicy = createIpcSenderPolicy({ isDev: true, devRendererUrl: DEV_URL });

function topFrame(url: string): SenderFrameFacts {
  return { url, isTopLevel: true, detached: false };
}

function decide(
  input: { senderWindow?: SenderWindow | null; frame?: SenderFrameFacts | null; channel?: unknown },
  policy = packagedPolicy,
) {
  return decideIpcSender(
    {
      senderWindow: input.senderWindow === undefined ? 'main' : input.senderWindow,
      frame: input.frame === undefined ? topFrame(APP_URL) : input.frame,
      channel: 'channel' in input ? input.channel : 'settings:get',
    },
    policy,
  );
}

describe('decideIpcSender', () => {
  it('accepts the top-level main-window frame at the app origin for any channel', () => {
    expect(decide({ channel: 'settings:get' })).toEqual({ allowed: true });
    expect(decide({ channel: 'window:minimize' })).toEqual({ allowed: true });
  });

  it('accepts the app origin on any path, query or fragment', () => {
    expect(decide({ frame: topFrame('app://bundle/mini-live/index.html?x=1#y') })).toEqual({ allowed: true });
  });

  describe('compact Live window', () => {
    it('accepts every allowlisted channel', () => {
      for (const channel of MINI_LIVE_INVOKE_CHANNELS) {
        expect(decide({ senderWindow: 'mini-live', channel })).toEqual({ allowed: true });
      }
    });

    it('refuses a channel outside the allowlist, even one the main window may call', () => {
      expect(decide({ senderWindow: 'mini-live', channel: 'window:minimize' })).toEqual({
        allowed: false,
        reason: 'channel_not_allowed',
      });
      expect(decide({ senderWindow: 'main', channel: 'window:minimize' })).toEqual({ allowed: true });
    });

    it.each([undefined, null, 7, {}, ['settings:get'], '__proto__', 'toString', ''])(
      'refuses the non-channel value %j',
      (channel) => {
        expect(decide({ senderWindow: 'mini-live', channel })).toMatchObject({
          allowed: false,
          reason: 'channel_not_allowed',
        });
      },
    );

    it('refuses a non-string channel without coercing it', () => {
      const tricky = { toString: () => 'settings:get' };
      expect(decide({ senderWindow: 'mini-live', channel: tricky })).toMatchObject({ allowed: false });
    });

    it('still refuses an allowlisted channel from a foreign origin', () => {
      expect(
        decide({ senderWindow: 'mini-live', channel: 'miniLive:close', frame: topFrame('https://example.com/') }),
      ).toEqual({ allowed: false, reason: 'untrusted_origin' });
    });
  });

  it('refuses a subframe of a known window', () => {
    expect(decide({ frame: { url: APP_URL, isTopLevel: false, detached: false } })).toEqual({
      allowed: false,
      reason: 'not_top_frame',
    });
  });

  it('refuses a sender that belongs to no known window', () => {
    expect(decide({ senderWindow: null })).toEqual({ allowed: false, reason: 'unknown_window' });
  });

  it('refuses a missing sender frame', () => {
    expect(decide({ frame: null })).toEqual({ allowed: false, reason: 'no_frame' });
  });

  it('refuses a detached sender frame', () => {
    expect(decide({ frame: { url: APP_URL, isTopLevel: true, detached: true } })).toEqual({
      allowed: false,
      reason: 'detached_frame',
    });
  });

  describe('frame URLs that are not the app origin', () => {
    it.each([
      ['data:', 'data:text/html,<script>1</script>'],
      ['about:blank', 'about:blank'],
      ['about:srcdoc', 'about:srcdoc'],
      ['file:', 'file:///C:/Windows/win.ini'],
      ['blob:', 'blob:app://bundle/6f2a8e0c-1111-4c3e-9d2a-000000000000'],
      ['javascript:', 'javascript:void 0'],
      ['devtools:', 'devtools://devtools/bundled/devtools_app.html'],
      ['https foreign origin', 'https://example.com/'],
      ['http foreign origin', 'http://example.com/'],
      ['other app host', 'app://other-host/index.html'],
      ['host with a suffix', 'app://bundle.evil/index.html'],
      ['host with a prefix', 'app://evilbundle/index.html'],
      ['credentials before the host', 'app://bundle@evil/index.html'],
      ['credentials naming the host', 'app://bundle:secret@evil/'],
      ['explicit port on the app host', 'app://bundle:80/index.html'],
      ['app scheme without a host', 'app:///index.html'],
      ['uppercase host', 'app://BUNDLE/index.html'],
      ['wrong scheme, right host', 'https://bundle/index.html'],
      ['empty string', ''],
      ['unparseable', 'not a url'],
    ])('refuses %s', (_label, url) => {
      expect(decide({ frame: topFrame(url) })).toEqual({ allowed: false, reason: 'untrusted_origin' });
    });

    it('refuses the dev renderer origin when packaged', () => {
      expect(decide({ frame: topFrame(`${DEV_URL}/`) }, packagedPolicy)).toEqual({
        allowed: false,
        reason: 'untrusted_origin',
      });
    });
  });

  describe('dev mode', () => {
    it('accepts the dev renderer origin', () => {
      expect(decide({ frame: topFrame(`${DEV_URL}/`) }, devPolicy)).toEqual({ allowed: true });
      expect(decide({ frame: topFrame(`${DEV_URL}/mini-live/`), senderWindow: 'mini-live', channel: 'live:get' }, devPolicy))
        .toEqual({ allowed: true });
    });

    it('keeps accepting the app origin', () => {
      expect(decide({}, devPolicy)).toEqual({ allowed: true });
    });

    it.each([
      'http://127.0.0.1:3001/',
      'http://localhost:3000/',
      'https://127.0.0.1:3000/',
      'http://127.0.0.1:3000@evil.example/',
      'http://127.0.0.1:3000.evil.example/',
      'http://example.com/',
    ])('refuses %s', (url) => {
      expect(decide({ frame: topFrame(url) }, devPolicy)).toEqual({ allowed: false, reason: 'untrusted_origin' });
    });

    it('follows an overridden dev renderer URL, and only that one', () => {
      const overridden = createIpcSenderPolicy({ isDev: true, devRendererUrl: 'http://127.0.0.1:4555/some/path' });
      expect(decide({ frame: topFrame('http://127.0.0.1:4555/') }, overridden)).toEqual({ allowed: true });
      expect(decide({ frame: topFrame(`${DEV_URL}/`) }, overridden)).toMatchObject({ allowed: false });
    });

    it('ignores an unusable dev renderer URL instead of trusting everything', () => {
      for (const devRendererUrl of ['', 'garbage', 'file:///C:/app/index.html', 'data:text/html,x']) {
        const policy = createIpcSenderPolicy({ isDev: true, devRendererUrl });
        expect([...policy.trustedOrigins]).toEqual(['app://bundle']);
      }
    });
  });

  it('never trusts the dev origin in a packaged run, whatever URL it was handed', () => {
    const policy = createIpcSenderPolicy({ isDev: false, devRendererUrl: 'http://127.0.0.1:4555' });
    expect([...policy.trustedOrigins]).toEqual(['app://bundle']);
  });
});

describe('trustedOriginKeyOf', () => {
  it('names the app origin by protocol and host', () => {
    expect(trustedOriginKeyOf(APP_URL)).toBe('app://bundle');
  });

  it('is null for anything carrying credentials', () => {
    expect(trustedOriginKeyOf('app://user@bundle/')).toBeNull();
    expect(trustedOriginKeyOf('http://:pw@127.0.0.1:3000/')).toBeNull();
  });
});

describe('readSenderFrame', () => {
  const mainFrame = { processId: 4, routingId: 2 };

  function frame(overrides: Partial<SenderFrameLike> = {}): SenderFrameLike {
    return { url: APP_URL, parent: null, detached: false, processId: 4, routingId: 2, ...overrides };
  }

  it('reads a live top-level frame', () => {
    expect(readSenderFrame(frame(), mainFrame)).toEqual({ url: APP_URL, isTopLevel: true, detached: false });
  });

  it('is null for a null frame', () => {
    expect(readSenderFrame(null, mainFrame)).toBeNull();
  });

  it('marks a frame with a parent as not top-level', () => {
    expect(readSenderFrame(frame({ parent: {} }), mainFrame)?.isTopLevel).toBe(false);
  });

  it('marks a parentless frame that is not the sender main frame as not top-level', () => {
    expect(readSenderFrame(frame({ routingId: 9 }), mainFrame)?.isTopLevel).toBe(false);
    expect(readSenderFrame(frame({ processId: 5 }), mainFrame)?.isTopLevel).toBe(false);
  });

  it('marks every frame as not top-level when the sender main frame is unreadable', () => {
    expect(readSenderFrame(frame(), null)?.isTopLevel).toBe(false);
  });

  it('is null when the frame was disposed under the read', () => {
    const disposed = {
      get url(): string {
        throw new Error('Render frame was disposed before WebFrameMain could be accessed');
      },
      parent: null,
      detached: false,
      processId: 4,
      routingId: 2,
    };
    expect(readSenderFrame(disposed, mainFrame)).toBeNull();
  });
});

describe('ipcSenderRejectionRecord', () => {
  it('names the reason, window, origin and channel under the main scope', () => {
    expect(
      ipcSenderRejectionRecord(
        { senderWindow: 'mini-live', frame: topFrame('https://example.com/a/b?token=s3cret#frag'), channel: 'forge:run' },
        'untrusted_origin',
      ),
    ).toEqual({
      scope: 'main',
      event: 'ipc.sender_rejected',
      reason: 'untrusted_origin',
      window: 'mini-live',
      origin: 'https://example.com',
      channel: 'forge:run',
    });
  });

  it('logs only the scheme for an origin-less URL, never its payload', () => {
    const record = ipcSenderRejectionRecord(
      { senderWindow: null, frame: topFrame('data:text/html,<script>steal()</script>'), channel: 'settings:get' },
      'unknown_window',
    );
    expect(record.origin).toBe('data:');
    expect(JSON.stringify(record)).not.toContain('steal');
  });

  it('caps a hostile channel name and reports the type of a non-string one', () => {
    const long = ipcSenderRejectionRecord(
      { senderWindow: 'main', frame: null, channel: 'x'.repeat(10_000) },
      'no_frame',
    );
    expect((long.channel as string).length).toBe(64);
    expect(long.origin).toBe('none');
    expect(
      ipcSenderRejectionRecord({ senderWindow: 'main', frame: null, channel: { secret: 1 } }, 'no_frame').channel,
    ).toBe('object');
  });

  it('has no field that could carry call arguments', () => {
    const record = ipcSenderRejectionRecord(
      { senderWindow: 'main', frame: topFrame(APP_URL), channel: 'settings:get' },
      'not_top_frame',
    );
    expect(Object.keys(record).sort()).toEqual(['channel', 'event', 'origin', 'reason', 'scope', 'window']);
  });
});

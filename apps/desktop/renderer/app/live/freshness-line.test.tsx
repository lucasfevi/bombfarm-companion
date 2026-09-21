import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { STRINGS } from '../../lib/copy';
import { FreshnessLine } from './freshness-line';

const en = STRINGS.en;

function render(freshness: Parameters<typeof FreshnessLine>[0]['freshness'], onReopenConsent?: () => void) {
  return renderToStaticMarkup(createElement(FreshnessLine, { freshness, onReopenConsent }));
}

describe('FreshnessLine — one status line stating live or not, and why', () => {
  it("draws nothing while frames are arriving — the Live tab's dot and the strip say so already", () => {
    expect(render({ kind: 'live' })).toBe('');
  });

  it('states not-live plus the player-language cause for a non-actionable gap', () => {
    const html = render({ kind: 'gap', reason: 'clientNotStreaming', actionable: false, sinceAt: 't' });
    expect(html).toContain('data-testid="live-freshness"');
    expect(html).toContain(en.liveStatusNotLiveLabel);
    expect(html).toContain(en.liveGapReasonClientNotStreaming);
    expect(html).not.toContain('chip');
  });

  it('says security software is the likely cause when runtimeUnavailable carries likelyQuarantine', () => {
    const html = render({ kind: 'gap', reason: 'runtimeUnavailable', actionable: false, sinceAt: 't', likelyQuarantine: true });
    expect(html).toContain(en.liveGapReasonRuntimeUnavailableQuarantine);
    expect(html).not.toContain(en.liveGapReasonRuntimeUnavailable + '<');
  });

  it('uses the plain runtimeUnavailable cause when likelyQuarantine is false or absent', () => {
    const html = render({ kind: 'gap', reason: 'runtimeUnavailable', actionable: false, sinceAt: 't' });
    expect(html).toContain(en.liveGapReasonRuntimeUnavailable);
  });

  it('prints the runtime’s own error under an attachFailed gap, verbatim, so it can be read off the screen', () => {
    const detail = 'Error creating directory C:\\PROGRA~1\\Elsewhere\\temp\\frida-1: Permission denied';
    const html = render({ kind: 'gap', reason: 'attachFailed', actionable: true, sinceAt: 't', detail });
    expect(html).toContain('data-testid="live-freshness-detail"');
    expect(html).toContain(en.liveGapDetailLabel);
    expect(html).toContain('Elsewhere\\temp\\frida-1: Permission denied');
  });

  it('prints no error line when the gap carries no detail', () => {
    const html = render({ kind: 'gap', reason: 'attachFailed', actionable: true, sinceAt: 't' });
    expect(html).not.toContain('data-testid="live-freshness-detail"');
    expect(html).not.toContain(en.liveGapDetailLabel);
  });
});

describe('FreshnessLine — no action that cannot help', () => {
  it('offers no control for a reason the app is already retrying on its own', () => {
    const html = render({ kind: 'gap', reason: 'detached', actionable: true, sinceAt: 't' }, () => {});
    expect(html).not.toContain('<button');
    expect(html).not.toContain('data-testid="live-freshness-reopen-consent"');
  });

  it('offers the read-the-disclosure-again control only for consentMissing, reusing the existing copy', () => {
    const html = render({ kind: 'gap', reason: 'consentMissing', actionable: true, sinceAt: 't' }, () => {});
    expect(html).toContain('data-testid="live-freshness-reopen-consent"');
    expect(html).toContain(en.consentGateReadAgainAction);
  });

  it('does not render the action if no callback was supplied, even for consentMissing', () => {
    const html = render({ kind: 'gap', reason: 'consentMissing', actionable: true, sinceAt: 't' });
    expect(html).not.toContain('data-testid="live-freshness-reopen-consent"');
  });
});

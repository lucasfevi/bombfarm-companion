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
  it('states live when frames are arriving', () => {
    const html = render({ kind: 'live' });
    expect(html).toContain('data-testid="live-freshness"');
    expect(html).toContain(en.liveStatusLiveLabel);
  });

  it('states not-live plus the player-language cause for a non-actionable gap', () => {
    const html = render({ kind: 'gap', reason: 'clientNotStreaming', actionable: false });
    expect(html).toContain(en.liveStatusNotLiveLabel);
    expect(html).toContain(en.liveGapReasonClientNotStreaming);
  });

  it('says security software is the likely cause when runtimeUnavailable carries likelyQuarantine', () => {
    const html = render({ kind: 'gap', reason: 'runtimeUnavailable', actionable: false, likelyQuarantine: true });
    expect(html).toContain(en.liveGapReasonRuntimeUnavailableQuarantine);
    expect(html).not.toContain(en.liveGapReasonRuntimeUnavailable + '<');
  });

  it('uses the plain runtimeUnavailable cause when likelyQuarantine is false or absent', () => {
    const html = render({ kind: 'gap', reason: 'runtimeUnavailable', actionable: false });
    expect(html).toContain(en.liveGapReasonRuntimeUnavailable);
  });
});

describe('FreshnessLine — no action that cannot help', () => {
  it('offers no control for a reason the app is already retrying on its own', () => {
    const html = render({ kind: 'gap', reason: 'detached', actionable: true }, () => {});
    expect(html).not.toContain('<button');
    expect(html).not.toContain('data-testid="live-freshness-reopen-consent"');
  });

  it('offers the read-the-disclosure-again control only for consentMissing, reusing the existing copy', () => {
    const html = render({ kind: 'gap', reason: 'consentMissing', actionable: true }, () => {});
    expect(html).toContain('data-testid="live-freshness-reopen-consent"');
    expect(html).toContain(en.consentGateReadAgainAction);
  });

  it('does not render the action if no callback was supplied, even for consentMissing', () => {
    const html = render({ kind: 'gap', reason: 'consentMissing', actionable: true });
    expect(html).not.toContain('data-testid="live-freshness-reopen-consent"');
  });
});

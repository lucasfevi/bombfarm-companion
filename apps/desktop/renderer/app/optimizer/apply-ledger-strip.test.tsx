import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ApplyLedger } from '@bombfarm/domain/team-plan';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ApplyLedgerStrip } from './apply-ledger-strip';

const BASE_LEDGER: ApplyLedger = {
  equip: { calls: 3, estimatedMs: 7_500 },
  forge: { pieces: 2, goldExpected: 4_000 },
  points: { heroes: 2, respecs: 1, calls: 3, estimatedMs: 7_500, goldExact: 1_200 },
  totalGold: 5_200,
  walletBefore: 10_000,
  walletAfter: 4_800,
};

function render(ledger: ApplyLedger): string {
  return renderToStaticMarkup(
    createElement(CopyProvider, { locale: 'en', children: createElement(ApplyLedgerStrip, { ledger }) }),
  );
}

describe('ApplyLedgerStrip', () => {
  it('prints the five figures the ledger names — total, reset exact, forge, equip and the wallet', () => {
    const html = render(BASE_LEDGER);
    expect(html).toContain('data-testid="apply-ledger-total"');
    expect(html).toContain('data-testid="apply-ledger-reset"');
    expect(html).toContain('data-testid="apply-ledger-forge"');
    expect(html).toContain('data-testid="apply-ledger-equip"');
    expect(html).toContain('data-testid="apply-ledger-wallet"');
    expect(html).toContain(en.applyLedgerTotal);
    expect(html).toContain(en.applyLedgerReset);
    expect(html).toContain(en.applyLedgerEquip);
  });

  it('reads "can run over" when the forge list is priced, "no estimate" when it is not', () => {
    expect(render(BASE_LEDGER)).toContain(en.applyLedgerForge);
    const unpriced: ApplyLedger = { ...BASE_LEDGER, forge: { pieces: 2, goldExpected: null } };
    const html = render(unpriced);
    expect(html).toContain(en.applyLedgerForgeNone);
    expect(html).not.toContain(en.applyLedgerForge);
  });

  it('prints the wallet before then after', () => {
    const html = render(BASE_LEDGER);
    expect(html).toContain('10,000');
    expect(html).toContain('4,800');
  });

  it('prints the "not available" stand-in when the wallet is not finite', () => {
    const noWallet: ApplyLedger = { ...BASE_LEDGER, walletBefore: null, walletAfter: null };
    const html = render(noWallet);
    expect(html).toContain('—');
    expect(html).not.toContain('null');
  });
});

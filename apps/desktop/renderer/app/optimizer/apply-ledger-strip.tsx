'use client';

/**
 * The panel's gold ledger — five figures side by side (`docs/use-the-width.md` rule 1: each is a
 * short label and a figure, so they sit in a row rather than stacking), wrapping whole below a
 * narrow window rather than folding a column under one it has nothing to do with (rule 4).
 */
import type { ReactNode } from 'react';
import type { ApplyLedger } from '@bombfarm/domain/team-plan';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import { ForgeGold } from '../forge/forge-gold';

const WALLET_UNAVAILABLE = '—';

function Figure({ testId, label, value }: { testId: string; label: string; value: ReactNode }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

export function ApplyLedgerStrip({ ledger }: { ledger: ApplyLedger }) {
  const t = useCopy();
  const { locale } = useLocale();
  const gold = (amount: number) => formatCount(amount, locale);

  const walletBefore = ledger.walletBefore === null ? WALLET_UNAVAILABLE : gold(ledger.walletBefore);
  const walletAfter = ledger.walletAfter === null ? WALLET_UNAVAILABLE : gold(ledger.walletAfter);

  return (
    <div data-testid="apply-ledger" className="flex flex-wrap gap-x-6 gap-y-3 border-b border-line pb-3">
      <Figure
        testId="apply-ledger-total"
        label={t.applyLedgerTotal}
        value={<ForgeGold>{gold(ledger.totalGold)}</ForgeGold>}
      />
      <Figure
        testId="apply-ledger-reset"
        label={t.applyLedgerReset}
        value={<ForgeGold>{gold(ledger.points.goldExact)}</ForgeGold>}
      />
      <Figure
        testId="apply-ledger-forge"
        label={ledger.forge.goldExpected === null ? t.applyLedgerForgeNone : t.applyLedgerForge}
        value={ledger.forge.goldExpected === null ? WALLET_UNAVAILABLE : <ForgeGold>{gold(ledger.forge.goldExpected)}</ForgeGold>}
      />
      <Figure testId="apply-ledger-equip" label={t.applyLedgerEquip} value={null} />
      <div data-testid="apply-ledger-wallet" className="flex flex-col gap-0.5 self-end">
        <span className="text-sm text-ink">{sub(t.applyLedgerWallet, { before: walletBefore, after: walletAfter })}</span>
      </div>
    </div>
  );
}

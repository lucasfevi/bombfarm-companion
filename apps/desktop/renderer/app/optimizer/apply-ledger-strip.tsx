'use client';

/**
 * The panel's gold ledger — a gold-tinted band of four figures (`docs/use-the-width.md` rule 1:
 * each is a short label and a figure, so they sit in a row rather than stacking), the wallet
 * pinned to the right edge, wrapping whole below a narrow window rather than folding a column
 * under one it has nothing to do with (rule 4).
 */
import type { ReactNode } from 'react';
import type { ApplyLedger } from '@bombfarm/domain/team-plan';
import { cn } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import { ForgeGold } from '../forge/forge-gold';

const WALLET_UNAVAILABLE = '—';

function Figure({
  testId,
  label,
  value,
  qualifier,
  align = 'start',
}: {
  testId: string;
  label: string;
  value: ReactNode;
  qualifier?: string;
  align?: 'start' | 'end';
}) {
  return (
    <div data-testid={testId} className={cn('flex', 'flex-col', 'gap-0.5', align === 'end' ? 'ml-auto' : null, align === 'end' ? 'items-end' : null)}>
      <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</span>
      <span className="flex items-baseline gap-1.5 font-mono text-base font-bold text-ink tabular-nums">
        {value}
        {qualifier !== undefined ? <span className="font-sans text-[11px] font-normal text-muted">{qualifier}</span> : null}
      </span>
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
    <div
      data-testid="apply-ledger"
      className="flex flex-wrap gap-x-7 gap-y-3 rounded-sm border border-[color-mix(in_oklch,var(--gold)_45%,var(--line))] bg-[color-mix(in_oklch,var(--gold)_6%,transparent)] px-3 py-2.5"
    >
      <Figure testId="apply-ledger-total" label={t.applyLedgerTotal} value={<ForgeGold>{gold(ledger.totalGold)}</ForgeGold>} />
      <Figure
        testId="apply-ledger-reset"
        label={t.applyLedgerReset}
        value={<ForgeGold>{gold(ledger.points.goldExact)}</ForgeGold>}
        qualifier={t.applyLedgerExact}
      />
      <Figure
        testId="apply-ledger-forge"
        label={t.applyLedgerForge}
        value={ledger.forge.goldExpected === null ? WALLET_UNAVAILABLE : <ForgeGold>{gold(ledger.forge.goldExpected)}</ForgeGold>}
        qualifier={ledger.forge.goldExpected === null ? t.applyLedgerForgeNone : t.applyLedgerForgeExpected}
      />
      <Figure
        testId="apply-ledger-wallet"
        label={t.applyLedgerWalletLabel}
        value={walletBefore}
        qualifier={sub(t.applyLedgerWallet, { after: walletAfter })}
        align="end"
      />
    </div>
  );
}

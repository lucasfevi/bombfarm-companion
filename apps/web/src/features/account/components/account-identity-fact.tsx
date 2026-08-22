'use client';

/** One labelled read-only fact in the Account page header. */
export function AccountIdentityFact({ label, value }: { label: string; value: string }) {
  return (
    <div data-account-fact className="min-w-0">
      <div className="text-[11px] leading-1.35 text-muted">{label}</div>
      <div className="truncate font-mono text-sm font-semibold text-ink tabular-nums">{value}</div>
    </div>
  );
}

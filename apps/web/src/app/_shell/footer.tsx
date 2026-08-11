'use client';

import { BiCoffee, BiCopy } from 'react-icons/bi';
import type { Strings } from '@/shared/i18n';
import { getAppVersionLabel } from '@/shared/app-version';
import { REFERRAL_CODE } from '@/shared/referral';
import { WIKI_URL } from '@bombfarm/domain/wiki-assets';
import { useReferralCopy } from './use-referral-copy';

import { Tooltip, buttonRecipe, cn } from '@bombfarm/ui';

export function Footer({ t }: { t: Strings }) {
  const versionLabel = getAppVersionLabel();
  const { codeRef, copy: copyReferral } = useReferralCopy(t);

  return (
    <footer className="mx-auto mt-5 flex max-w-app flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3.5">
      <div className="m-0 max-w-[68ch] text-xs leading-normal text-muted">
        <p className="m-0">{t.disclaimer}</p>
        <p className="m-0 mt-1">
          {t.wikiArtCredit}{' '}
          <a
            className="text-accent underline-offset-2 hover:underline"
            href={WIKI_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t.wikiArtCreditLink}
          </a>
          .
        </p>
        <p className="m-0 mt-1 flex flex-wrap items-center gap-1.5">
          <span>{t.referralIntro}</span>
          <code
            ref={codeRef}
            data-testid="referral-code"
            className="rounded-sm border border-line bg-bg-2 px-1.5 py-0.5 font-mono tracking-[0.06em] text-accent"
          >
            {REFERRAL_CODE}
          </code>
          <Tooltip.Provider delay={200} closeDelay={80}>
            <Tooltip.Root>
              <Tooltip.Trigger
                type="button"
                onClick={copyReferral}
                // size-6 over the icon variant's size-5: 24px is the WCAG 2.2 AA
                // minimum target, and this one sits in a dense footer line.
                className={cn(buttonRecipe({ variant: 'icon' }), 'size-6')}
                aria-label={t.referralCopy}
              >
                <BiCopy size={14} aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>{t.referralCopy}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
          <span>{t.referralReward}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          data-testid="app-version"
          className="min-w-38 text-right font-mono text-xs tabular-nums text-muted"
        >
          {versionLabel}
        </span>
        <a
          className={buttonRecipe({ variant: 'coffee-full' })}
          href="https://buymeacoffee.com/lucasfevi"
          target="_blank"
          rel="noreferrer"
        >
          <BiCoffee size={16} aria-hidden="true" />
          {t.coffee}
        </a>
      </div>
    </footer>
  );
}

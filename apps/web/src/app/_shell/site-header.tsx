'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BiCoffee, BiCopy } from 'react-icons/bi';
import type { Strings, Lang } from '@/shared/i18n';
import { AppNav, Button, SegmentedToggle, Tooltip, buttonRecipe } from '@bombfarm/ui';
import { REFERRAL_CODE } from '@/shared/referral';
import { useReferralCopy } from './use-referral-copy';

export type SiteSection = 'planner' | 'farm' | 'teamPlan' | 'account';

const NAV_HREF: Record<SiteSection, string> = {
  planner: '/',
  farm: '/farm',
  teamPlan: '/team-plan',
  account: '/account',
};

export function SiteHeader({
  t,
  lang,
  showGuide,
  onImport,
  onToggleGuide,
  onLangChange,
}: {
  t: Strings;
  lang: Lang;
  showGuide?: boolean;
  onImport?: () => void;
  onToggleGuide?: (next: boolean) => void;
  onLangChange: (lang: Lang) => void;
}) {
  const pathname = usePathname();
  const { codeRef, copy: copyReferral } = useReferralCopy(t);
  const plannerActive = pathname === '/';
  const farmActive = pathname.startsWith('/farm');
  const teamPlanActive = pathname.startsWith('/team-plan');
  const accountActive = pathname.startsWith('/account');

  return (
    <header className="sticky top-0 z-30 min-h-top border-b border-line bg-[color-mix(in_oklch,var(--surface)_92%,transparent)] px-4 py-2.5 backdrop-blur-[14px]">
      <div className="mx-auto flex max-w-app flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <Image
              src="/favicon.svg"
              alt=""
              width={34}
              height={34}
              className="size-8.5 shrink-0"
              priority
            />
            <div>
              <div className="text-sm leading-1.1 font-bold text-ink">Bomb Farm</div>
              <div className="text-[11px] tracking-[0.04em] text-muted uppercase">{t.appSuiteTag}</div>
            </div>
          </Link>
          <AppNav
            ariaLabel={t.siteNavAria}
            items={[
              { id: 'planner', label: t.navPlanner, active: plannerActive },
              { id: 'farm', label: t.navPhases, active: farmActive },
              { id: 'teamPlan', label: t.navTeamPlan, active: teamPlanActive },
              { id: 'account', label: t.navAccount, active: accountActive },
            ]}
            renderItem={(item, className) => (
              <Link
                key={item.id}
                href={NAV_HREF[item.id as SiteSection]}
                aria-current={item.active ? 'page' : undefined}
                className={className}
              >
                {item.label}
              </Link>
            )}
          />
        </div>
        <div className="flex flex-nowrap items-center justify-end gap-1.5 max-[720px]:flex-wrap max-[720px]:justify-start">
          {onImport ? (
            <Button type="button" onClick={onImport}>
              {t.importHeroesBtn}
            </Button>
          ) : null}
          {onToggleGuide != null && showGuide != null ? (
            <Button
              type="button"
              variant={showGuide ? 'help-on' : 'help'}
              onClick={() => onToggleGuide(!showGuide)}
              title={t.guideToggleTitle}
              aria-label={t.guideToggleTitle}
            >
              ?
            </Button>
          ) : null}
          {/* Code only — the tooltip carries the why, the footer the full copy. */}
          <Tooltip.Provider delay={200} closeDelay={80}>
            <Tooltip.Root>
              <Tooltip.Trigger
                type="button"
                onClick={copyReferral}
                aria-label={t.referralTitle}
                data-testid="referral-topbar"
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-bg-2 px-2 text-[11px] font-bold tracking-[0.06em] text-muted hover:border-accent hover:text-accent motion-safe:transition-[border-color,color] motion-safe:duration-[120ms]"
              >
                <span ref={codeRef} className="font-mono">
                  {REFERRAL_CODE}
                </span>
                <BiCopy size={13} aria-hidden="true" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>{t.referralTitle}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
          <a
            className={buttonRecipe({ variant: 'coffee' })}
            href="https://buymeacoffee.com/lucasfevi"
            target="_blank"
            rel="noreferrer"
            title={t.coffee}
            aria-label={t.coffee}
          >
            <BiCoffee size={16} aria-hidden="true" />
          </a>
          <SegmentedToggle
            options={[
              { id: 'pt', label: 'PT' },
              { id: 'en', label: 'EN' },
            ]}
            value={lang}
            onChange={(nextLang) => {
              if (nextLang === 'pt' || nextLang === 'en') onLangChange(nextLang);
            }}
            ariaLabel="Language"
          />
        </div>
      </div>
    </header>
  );
}

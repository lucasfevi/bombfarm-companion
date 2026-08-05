'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BiCoffee } from 'react-icons/bi';
import type { Strings, Lang } from '@/shared/i18n';
import { Button, buttonRecipe } from '@bombfarm/ui';
import { NavLink } from './site-nav-link';

export type SiteSection = 'planner' | 'phases';

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
  const plannerActive = pathname === '/';
  const phasesActive = pathname.startsWith('/phases');

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
          <nav
            className="inline-flex items-stretch gap-1 rounded-md border border-line bg-[color-mix(in_oklch,var(--surface-2)_55%,transparent)] p-1 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--line)_35%,transparent)]"
            aria-label={t.siteNavAria}
          >
            <NavLink href="/" active={plannerActive}>
              {t.navPlanner}
            </NavLink>
            <NavLink href="/phases" active={phasesActive}>
              {t.navPhases}
            </NavLink>
          </nav>
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
          <div
            className="inline-flex h-8 shrink-0 overflow-hidden rounded-sm border border-line"
            role="group"
            aria-label="Language"
          >
            <button
              type="button"
              className={`cursor-pointer border-0 px-2.25 text-[11px] font-bold tracking-[0.03em] ${
                lang === 'pt' ? 'bg-accent text-accent-ink' : 'bg-transparent'
              }`}
              onClick={() => onLangChange('pt')}
            >
              PT
            </button>
            <button
              type="button"
              className={`cursor-pointer border-0 px-2.25 text-[11px] font-bold tracking-[0.03em] ${
                lang === 'en' ? 'bg-accent text-accent-ink' : 'bg-transparent'
              }`}
              onClick={() => onLangChange('en')}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@bombfarm/ui';
import {
  mutedClass,
  panelHClass,
  panelRecipe,
  panelTitleClass,
} from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { SITE_SECTION_HREF, SITE_SECTION_LABEL_KEY } from '@/shared/lib/site-sections';
import type { HomeCardSection, HomeCardState } from '../model/home-card-state';
import { HomeCardOutline } from './home-card-outline';

export function HomeSectionCard({
  section,
  state,
  context,
  footer,
  children,
  bodyClassName,
}: {
  section: HomeCardSection;
  state: HomeCardState;
  context: string;
  footer: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const { t } = useAppLang();
  const needs = state === 'needs';

  return (
    <article
      aria-label={t[SITE_SECTION_LABEL_KEY[section]]}
      data-home-card-state={state}
      className={cn(panelRecipe(), 'flex h-full min-w-0 flex-col')}
    >
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t[SITE_SECTION_LABEL_KEY[section]]}</h2>
        <span className={mutedClass}>{context}</span>
        <Link href={SITE_SECTION_HREF[section]}>{t.homeOpenLink}</Link>
      </div>
      <div
        aria-hidden={needs || undefined}
        className={cn('min-h-0 flex-1', bodyClassName, state === 'recalculating' && 'opacity-50')}
        data-testid="home-card-body"
      >
        {needs ? <HomeCardOutline kind={section} /> : children}
      </div>
      <div className={mutedClass} data-testid="home-card-footer">
        {footer}
      </div>
    </article>
  );
}

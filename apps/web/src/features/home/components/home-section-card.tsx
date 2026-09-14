'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { buttonRecipe, cn } from '@bombfarm/ui';
import {
  mutedClass,
  panelHClass,
  panelRecipe,
  panelTitleClass,
} from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { usePlannerStore } from '@/shared/stores';
import { SITE_SECTION_HREF, SITE_SECTION_LABEL_KEY } from '@/shared/lib/site-sections';
import type { HomeCardSection, HomeCardState } from '../model/home-card-state';
import { selectFirstVisit } from '../model/home-selectors';
import { HomeCardOutline } from './home-card-outline';

export function HomeSectionCard({
  section,
  state,
  context,
  footer,
  children,
  bodyClassName,
  title,
  link = true,
}: {
  section: HomeCardSection;
  state: HomeCardState;
  context?: string;
  footer: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  /** The section's nav label unless the card has a longer name of its own. */
  title?: string;
  /** Off for a card whose body already carries the way into its section. */
  link?: boolean;
}) {
  const { t } = useAppLang();
  const firstVisit = usePlannerStore(selectFirstVisit);
  const needs = state === 'needs';
  const heading = title ?? t[SITE_SECTION_LABEL_KEY[section]];

  return (
    <article
      aria-label={heading}
      data-home-card-state={state}
      className={cn(panelRecipe(), 'flex h-full min-w-0 flex-col')}
    >
      <div className={cn(panelHClass, 'items-center')}>
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className={cn(panelTitleClass, 'shrink-0')}>{heading}</h2>
          {context === undefined ? null : (
            <span className={cn(mutedClass, 'min-w-0 truncate')}>{context}</span>
          )}
        </div>
        {needs || !link ? null : (
          <Link
            className={cn(
              buttonRecipe({ variant: 'ghost' }),
              'ml-auto shrink-0 px-2 py-1 font-mono text-[11px] tracking-[0.07em] whitespace-nowrap uppercase no-underline',
            )}
            href={SITE_SECTION_HREF[section]}
          >
            {t.homeOpenLink}
          </Link>
        )}
      </div>
      <div
        aria-hidden={needs || undefined}
        className={cn('min-h-0 flex-1', bodyClassName, state === 'recalculating' && 'opacity-50')}
        data-testid="home-card-body"
      >
        {needs ? <HomeCardOutline kind={section} /> : children}
      </div>
      <div className={mutedClass} data-testid="home-card-footer">
        {needs && firstVisit ? null : footer}
      </div>
    </article>
  );
}

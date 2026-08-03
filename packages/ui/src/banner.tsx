import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import {
  setupBannerEmbeddedClass,
  setupBannerOkTitleClass,
  setupBannerPClass,
  setupBannerRecipe,
  setupBannerTitleClass,
  type SetupBannerVariant,
} from './panel-field.recipe';
import { cn } from './cn';

export type BannerProps = Omit<ComponentPropsWithoutRef<'aside'>, 'title'> & {
  tone?: NonNullable<SetupBannerVariant['tone']>;
  /** Page-centered (default) vs full-width in a stage / dialog. */
  layout?: 'page' | 'embedded';
  title?: ReactNode;
};

/**
 * Status / warning banner — dresses `setupBannerRecipe` (warn | ok).
 * Presentation-only; callers own copy and actions.
 */
export function Banner({
  tone = 'warn',
  layout = 'page',
  title,
  className,
  children,
  ...props
}: BannerProps) {
  return (
    <aside
      role="status"
      className={cn(
        setupBannerRecipe({ tone }),
        layout === 'embedded' && setupBannerEmbeddedClass,
        className,
      )}
      {...props}
    >
      {title != null && title !== '' && (
        <h2 className={tone === 'ok' ? setupBannerOkTitleClass : setupBannerTitleClass}>{title}</h2>
      )}
      {typeof children === 'string' || typeof children === 'number' ? (
        <p className={setupBannerPClass}>{children}</p>
      ) : (
        children
      )}
    </aside>
  );
}

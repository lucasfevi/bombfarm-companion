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

export type BannerProps = Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
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
    // A plain <div>, not <aside>: <aside>'s implicit "complementary" landmark role
    // does not permit overriding to role="status" (axe aria-allowed-role) — and a
    // status banner is a live-region announcement, not a page landmark, so <div>
    // is the semantically correct host anyway.
    <div
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
    </div>
  );
}

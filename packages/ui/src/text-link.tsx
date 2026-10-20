import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cn } from './cn';

const TONE_CLASS = {
  accent: 'text-accent underline-offset-2 hover:underline',
  muted: 'text-xs text-muted underline',
} as const;

export type TextLinkProps<C extends ElementType = 'a'> = {
  /** A link component to render in place of `<a>` — a router link, for example. */
  as?: C;
  tone?: keyof typeof TONE_CLASS;
} & Omit<ComponentPropsWithoutRef<C>, 'as' | 'tone'>;

export function TextLink<C extends ElementType = 'a'>({
  as,
  tone = 'accent',
  className,
  ...props
}: TextLinkProps<C>) {
  const Component: ElementType = as ?? 'a';
  return <Component className={cn(TONE_CLASS[tone], className)} {...props} />;
}

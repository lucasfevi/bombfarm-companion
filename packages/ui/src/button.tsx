import type { ComponentProps } from 'react';
import { Button as BaseButton } from '@base-ui/react/button';
import { buttonRecipe, type ButtonVariant } from './button.recipe';
import { cn } from './cn';

type BaseButtonProps = ComponentProps<typeof BaseButton>;

export type ButtonProps = Omit<BaseButtonProps, 'className'> & {
  variant?: ButtonVariant;
  className?: string;
};

/**
 * Button primitive — wraps `@base-ui/react` Button (keyboard/focus/disabled
 * semantics delegated to Base UI) and dresses it with the `buttonRecipe` cva
 * table. Caller `className` is merged last-wins via `cn()`.
 */
export function Button({ variant, className, ...props }: ButtonProps) {
  return <BaseButton className={cn(buttonRecipe({ variant }), className)} {...props} />;
}

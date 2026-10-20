import type { ComponentProps } from 'react';
import { cn } from './cn';
import { textFieldClass } from './panel-field.recipe';

export type TextInputProps = ComponentProps<'input'>;

export function TextInput({ className, ...props }: TextInputProps) {
  return <input className={cn(textFieldClass, className)} {...props} />;
}

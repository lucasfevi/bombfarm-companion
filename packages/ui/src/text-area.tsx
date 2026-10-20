import type { ComponentProps } from 'react';
import { cn } from './cn';
import { textFieldClass } from './panel-field.recipe';

export type TextAreaProps = ComponentProps<'textarea'>;

export function TextArea({ className, ...props }: TextAreaProps) {
  return <textarea className={cn(textFieldClass, className)} {...props} />;
}

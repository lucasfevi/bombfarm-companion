import type { ComponentProps } from 'react';
import { cn } from './cn';
import { textFieldClass } from './panel-field.recipe';

export type NativeSelectProps = ComponentProps<'select'>;

export function NativeSelect({ className, ...props }: NativeSelectProps) {
  return <select className={cn(textFieldClass, className)} {...props} />;
}

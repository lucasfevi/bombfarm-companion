import type { DataTableHeaderAlign } from './types';

export function headAlignClass(align: DataTableHeaderAlign): string | false {
  if (align === 'right') return 'justify-end';
  if (align === 'center') return 'justify-center';
  return false;
}

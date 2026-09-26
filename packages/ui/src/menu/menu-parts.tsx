'use client';

import type { ComponentProps } from 'react';
import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { cn } from '../cn';
import {
  menuGroupLabelClass,
  menuItemClass,
  menuPopupClass,
  menuPositionerClass,
  menuRadioIndicatorClass,
  menuSeparatorClass,
} from '../menu.recipe';

export function MenuRoot(props: ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root {...props} />;
}

export function MenuTrigger(props: ComponentProps<typeof MenuPrimitive.Trigger>) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />;
}

export function MenuPortal(props: ComponentProps<typeof MenuPrimitive.Portal>) {
  return <MenuPrimitive.Portal {...props} />;
}

export function MenuPositioner({ className, ...props }: ComponentProps<typeof MenuPrimitive.Positioner>) {
  return <MenuPrimitive.Positioner className={cn(menuPositionerClass, className)} {...props} />;
}

export function MenuPopup({ className, ...props }: ComponentProps<typeof MenuPrimitive.Popup>) {
  return <MenuPrimitive.Popup data-slot="menu-popup" className={cn(menuPopupClass, className)} {...props} />;
}

export function MenuItem({ className, ...props }: ComponentProps<typeof MenuPrimitive.Item>) {
  return <MenuPrimitive.Item className={cn(menuItemClass, className)} {...props} />;
}

export function MenuGroup(props: ComponentProps<typeof MenuPrimitive.Group>) {
  return <MenuPrimitive.Group {...props} />;
}

export function MenuGroupLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.GroupLabel>) {
  return <MenuPrimitive.GroupLabel className={cn(menuGroupLabelClass, className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn(menuSeparatorClass, className)} {...props} />;
}

export function MenuRadioGroup(props: ComponentProps<typeof MenuPrimitive.RadioGroup>) {
  return <MenuPrimitive.RadioGroup {...props} />;
}

export function MenuRadioItem({ className, ...props }: ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return <MenuPrimitive.RadioItem className={cn(menuItemClass, className)} {...props} />;
}

export function MenuRadioItemIndicator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.RadioItemIndicator>) {
  return (
    <MenuPrimitive.RadioItemIndicator
      keepMounted
      className={cn(menuRadioIndicatorClass, className)}
      {...props}
    />
  );
}

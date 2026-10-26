/**
 * Menu — compound wrap over `@base-ui/react/menu`, dressed with the same popup chrome `Select`
 * uses. Reach for it when a control opens a list of commands: the roving focus, typeahead,
 * outside-press dismissal and `role="menu"` semantics come from Base UI rather than from a
 * bespoke popup.
 */

import {
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from './menu-parts';

export const Menu = {
  Root: MenuRoot,
  Trigger: MenuTrigger,
  Portal: MenuPortal,
  Positioner: MenuPositioner,
  Popup: MenuPopup,
  Item: MenuItem,
  Group: MenuGroup,
  GroupLabel: MenuGroupLabel,
  Separator: MenuSeparator,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  RadioItemIndicator: MenuRadioItemIndicator,
};

// Kept here so `@bombfarm/ui/menu` still exports `DetailsMenu`; the barrel imports it from
// `./details-menu` directly, which is what keeps Base UI's menu out of a DetailsMenu-only consumer.
export { DetailsMenu } from '../details-menu';

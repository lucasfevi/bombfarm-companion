# @bombfarm/game-data

## 0.0.5

### Patch Changes

- Updated dependencies [b1e2591]
- Updated dependencies [635abe3]
- Updated dependencies [b1e2591]
- Updated dependencies [b1e2591]
  - @bombfarm/contracts@0.3.2

## 0.0.4

### Patch Changes

- 06bcc05: Removes `InventoryItem.iconUrl` and the parser that built it.

  The inventory parser composed a live wiki asset URL from the item's _instance_ level and handed it
  back on every parsed item. Nothing rendered that field — item art comes from the bundled assets via
  `itemIconSrc`, which keys off the set's native level — so the URL was both unused and wrong. Item
  art must never be sourced from the wire, so the builder and the contract field are gone rather than
  corrected.

  No consumer migration: the field had no readers.

- Updated dependencies [06bcc05]
  - @bombfarm/contracts@0.3.1

## 0.0.3

### Patch Changes

- Updated dependencies [1fa3def]
- Updated dependencies [e78122a]
- Updated dependencies [453ed05]
  - @bombfarm/contracts@0.3.0

## 0.0.2

### Patch Changes

- Updated dependencies [84c8c15]
- Updated dependencies [66d38d0]
- Updated dependencies [e55ebda]
  - @bombfarm/contracts@0.2.0

## 0.0.1

### Patch Changes

- Updated dependencies [3f8d4cb]
  - @bombfarm/contracts@0.1.0

# @bombfarm/game-data

## 0.0.13

### Patch Changes

- Updated dependencies [2ab64c9]
- Updated dependencies [076fc40]
  - @bombfarm/contracts@0.7.0

## 0.0.12

### Patch Changes

- Updated dependencies [4b6d4ba]
  - @bombfarm/contracts@0.6.2

## 0.0.11

### Patch Changes

- Updated dependencies [b02478e]
  - @bombfarm/contracts@0.6.1

## 0.0.10

### Patch Changes

- Updated dependencies [3eb7026]
- Updated dependencies [c94648a]
- Updated dependencies [3233351]
  - @bombfarm/contracts@0.6.0

## 0.0.9

### Patch Changes

- Updated dependencies [c3dd984]
- Updated dependencies [48ae346]
- Updated dependencies [b7d837a]
- Updated dependencies [b7d837a]
  - @bombfarm/contracts@0.5.0

## 0.0.8

### Patch Changes

- Updated dependencies [fae49fb]
- Updated dependencies [dec4425]
- Updated dependencies [7d3a951]
- Updated dependencies [1d9d79f]
  - @bombfarm/contracts@0.4.0

## 0.0.7

### Patch Changes

- a844381: Remove the process-memory reading path from the desktop app. The diagnostics snapshot panel now
  sources its gold/phase/wave reading from the in-run live data source instead of scanning the
  game's process memory directly, and the app no longer depends on a native FFI library to read a
  running game's memory. Account data was never sourced from process memory in the first place — it
  has always come from the authenticated periodic sync — so this has no effect on account, hero,
  skill, casa, or inventory data.
- Updated dependencies [a844381]
  - @bombfarm/contracts@0.3.4

## 0.0.6

### Patch Changes

- Updated dependencies [8692c92]
  - @bombfarm/contracts@0.3.3

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

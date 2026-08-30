# Bundled art provenance

`packages/game-art/assets/` is sourced from the Grimório's static assets, served under
`/wiki/static/assets/`. Both `apps/web` and `apps/desktop` copy this directory into their own
`public/wiki-assets/` at build time (`apps/*/scripts/copy-wiki-assets.mjs`) so it serves at
`/wiki-assets/...` — see [`docs/design-system.md`](design-system.md)'s Game art section. Most of
it is a byte-for-byte mirror at the same subpath, so a refresh is a straight re-fetch. The drop
sprites are the exception on two counts, and this table is what a refresh has to be driven from.

## Why these are renamed

Upstream files the five difficulty bands inconsistently: as bare indices on some families
(`chest_skill_1`…`_5`, `house_house_1`…`_5`) and as Portuguese words on others, two of them
misspelled — `dificio` and `muitodificio`, for *difícil* and *muito difícil*. Neither form belongs
in this repo's tree: an index leaves a reader decoding `_4`, and the misspellings would carry
another project's typos into a public repository. The sprites are renamed on the way in, to the
English difficulty names (`GAME_DIFFICULTY_EN`, lowercased and underscored).

Renaming means the local path no longer tells you where a file came from, which is exactly what
this table is for.

## Drop sprites

| Local path (`packages/game-art/assets/…`) | Upstream | Notes |
| --- | --- | --- |
| `chests/item_chest.png` | `icons/chest_0.png` | Not difficulty-scaled — one sprite for every band |
| `chests/gem_chest_easy.png` | *(game client)* `ui/chests/gems/gem_chest_facil.png` | Not published by the wiki |
| `chests/gem_chest_normal.png` | *(game client)* `ui/chests/gems/gem_chest_normal.png` | Not published by the wiki |
| `chests/gem_chest_hard.png` | *(game client)* `ui/chests/gems/gem_chest_dificio.png` | Not published by the wiki; upstream name misspelled |
| `chests/gem_chest_very_hard.png` | *(game client)* `ui/chests/gems/gem_chest_muitodificio.png` | Not published by the wiki; upstream name misspelled |
| `chests/gem_chest_inferno.png` | *(game client)* `ui/chests/gems/gem_chest_inferno.png` | Not published by the wiki |
| `chests/skill_stone_chest_easy.png` | `steam/chest_skill_1.png` | |
| `chests/skill_stone_chest_normal.png` | `steam/chest_skill_2.png` | |
| `chests/skill_stone_chest_hard.png` | `steam/chest_skill_3.png` | |
| `chests/skill_stone_chest_very_hard.png` | `steam/chest_skill_4.png` | |
| `chests/skill_stone_chest_inferno.png` | `steam/chest_skill_5.png` | |
| `houses/house_easy.png` | `steam/house_house_1.png` | The time chest's icon is the House of that band |
| `houses/house_normal.png` | `steam/house_house_2.png` | |
| `houses/house_hard.png` | `steam/house_house_3.png` | |
| `houses/house_very_hard.png` | `steam/house_house_4.png` | |
| `houses/house_inferno.png` | `steam/house_house_5.png` | |

`key/key_*.png` is deliberately **not** in this table: those mirror upstream at the same subpath
and are filed by rarity, which is what the art actually is. The planner's band→rarity step lives
in `GATE_KEY_RARITY_INDEX`, not in a filename.

## Inventory art

The Inventory screen shows every item the account carries, not just gear, so it needs art for the
five non-gear families and for the plate an item sits on. Four directories were added for it.

`background/` is the one that replaced code: the six plates are the game's own inventory slot
backdrops, and the card used to approximate them with hand-written CSS gradients
(`--rar-slot-*-glow/mid/edge`). The real plates are better art and one fewer thing to maintain.

| Local path (`packages/game-art/assets/…`) | Upstream | Notes |
| --- | --- | --- |
| `background/slot_background_{common,uncommon,rare,epic,legendary,mythic}.png` | `background/slot_background_*.png` | Same subpath and names |
| `gems/gem_*.png` | `icons/gem_*_icon.png` | `_icon` dropped so the filename is the `def_id` verbatim, which is how `itemKindIconSrc` reaches it |
| `houseparts/houseparts_{uncommon,rare,epic,legendary,mythic}.png` | `houseparts/houseparts_*.png` | The game's name for what a save calls `time_part_*` |
| `stones/skill_stone_{common,uncommon,rare,epic,legendary,mythic}.png` | *(game client)* `ui/icons/pedra_habilidades/pedra_habilidade_0N_*.png` | Not published by the wiki; renamed from the Portuguese and from a 1-based index |

The skill stones are the second family after the gem chests that the wiki does not publish, and
the only one filed under a Portuguese name with a 1-based index (`01_comum`…`06_mitico`). They
are renamed on the way in for the same two reasons the drop sprites are, and the index→rarity
step is `01` → rarity 0, so a refresh must not read the number as the rarity.

## Hero sprite sequences

Two subdirectories under `hero/` are frame sequences for `SpriteLoop`, not single mirrored icons,
and neither is published by the wiki.

| Local path (`packages/game-art/assets/hero/…`) | Upstream | Notes |
| --- | --- | --- |
| `hero6-bomb-activation/hero_6_bomb_activation_001.png` … `_018.png` | *(game client)* | Not published by the wiki |
| `hero6-menu-idle/hero6_idle_menu1.png` … `hero6_idle_menu15.png` | *(game client)* `characters/hero_6/animation/menu_idle/hero6_idle_menu1.png` … `hero6_idle_menu15.png` | Not published by the wiki; upstream numbers frames 1–15 with no zero-padding, so a lexical sort of the directory plays frame 10 right after frame 1 — order the sequence numerically |

## Everything else

`abilities/`, `env/`, `items/`, `icons/`, `key/` and `nav/`, and every `hero/` file outside the two
sequence subdirectories above, mirror upstream at the same subpath under their own upstream names.
Two of those names are Portuguese (`env/minerio_mithril.png`, `env/crystal_rubi.png`) and all
twenty ability sprites are, but those filenames are **not free to change**: `propIconSrc` and
`abilityIconSrc` build a path by joining a prop name or ability id straight onto the directory, and
those ids come from the game's own save and catalog data. Renaming the files would require an
id→filename map, and the id itself would stay as it is regardless — it is the game's identifier,
not a label.

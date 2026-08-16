---
"@bombfarm/domain": patch
---

Re-synced the item catalog against the 2026-08-16 redistribution patch.

No value changed — `stat_base`, `nivel_mult`, `forja` and the 30 sets / 240 definitions are all
byte-identical. What moved is **which stats each slot rolls, and in what order**: 239 of 240
definitions, 194 of them changing their stat set outright. Because rarity slices the first N
rolls, that changes what real items carry — **1,100 of 1,440 (definition × rarity) pairs now roll
a different stat set**, including 217 of 240 at Raro and 219 at Épico.

The new order is uniform across every set, one priority per slot:

| slot | priority |
| --- | --- |
| arma | dmg > crit > penetração > recarga > velocidade > energia |
| elmo | energia > sorte > dmg > crit > penetração > recarga |
| peito | **penetração** > recarga > velocidade > energia > sorte > dmg |
| calça | **recarga** > velocidade > energia > sorte > dmg > crit |
| bota | velocidade > energia > sorte > dmg > crit > penetração |
| luva | dmg > penetração > velocidade > sorte > crit > recarga |
| anel | crit > penetração > recarga > velocidade > energia > sorte |
| amuleto | sorte > dmg > crit > penetração > recarga > velocidade |

Crit chance left the top two on six of eight slots — it is now concentrated in `anel` and `arma`.

No sheet-math change: `stat_base` did not move, so the flat crit/cooldown model is untouched.

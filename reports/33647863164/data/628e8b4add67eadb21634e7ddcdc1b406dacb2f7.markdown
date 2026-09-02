# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: farm-respec.spec.ts >> Farm Respec Advisor >> hero cards wrap onto further rows at 1280px width, never collapsing into tabs or a scroller
- Location: e2e/farm-respec.spec.ts:178:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('farm-respec-heroes')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('farm-respec-heroes')

```

```yaml
- alert
- banner:
  - link "Bomb Farm Companion":
    - /url: /
  - navigation "Main sections":
    - link "Planner":
      - /url: /
    - link "Farm":
      - /url: /farm
    - link "Team plan":
      - /url: /team-plan
    - link "Inventory":
      - /url: /inventory
    - link "Account":
      - /url: /account
  - link "Download BombFarm Companion":
    - /url: /download
  - button "Import"
  - button "Copy my referral code — we both get a reward once you clear stage 151": F-X7BTKJPP
  - link "Buy me a coffee":
    - /url: https://buymeacoffee.com/lucasfevi
  - group "Language":
    - button "PT"
    - button "EN"
- heading "Farm Ranking" [level=2]
- group "Rotation pool":
  - text: Rotation pool
  - img "Minato"
  - text: B Minato Rare Lv 95
  - switch "Include Minato in the farm estimate" [checked]
  - img "Jon"
  - text: D Jon Rare Lv 96
  - switch "Include Jon in the farm estimate" [checked]
  - img "Bellatrix"
  - text: A Bellatrix Uncommon Lv 106
  - switch "Include Bellatrix in the farm estimate" [checked]
  - 'img "Buff S #1"'
  - text: "S Buff S #1 Rare Lv 85"
  - 'switch "Include Buff S #1 in the farm estimate" [checked]'
  - 'img "WB #2"'
  - text: "D WB #2 Common Lv 77"
  - 'switch "Include WB #2 in the farm estimate" [checked]'
  - 'img "WB #1"'
  - text: "B WB #1 Common Lv 84"
  - 'switch "Include WB #1 in the farm estimate" [checked]'
  - 'img "Buff L #1"'
  - text: "E Buff L #1 Rare Lv 68"
  - 'switch "Include Buff L #1 in the farm estimate" [checked]'
  - 'img "WB #3"'
  - text: "A WB #3 Common Lv 59"
  - 'switch "Include WB #3 in the farm estimate" [checked]'
  - 'img "Buff FL #1"'
  - text: "A Buff FL #1 Uncommon Lv 50"
  - 'switch "Include Buff FL #1 in the farm estimate" [checked]'
  - 'img "Manco #2"'
  - text: "E Manco #2 Rare Lv 67"
  - 'switch "Include Manco #2 in the farm estimate" [checked]'
  - img "Rowan"
  - text: S Rowan Common Lv 2
  - switch "Include Rowan in the farm estimate" [checked]
  - img "Perrin"
  - text: E Perrin Rare Lv 53
  - switch "Include Perrin in the farm estimate" [checked]
  - img "Korin"
  - text: A Korin Common Lv 2
  - switch "Include Korin in the farm estimate" [checked]
- status:
  - heading "Your field is saturated" [level=2]
  - paragraph: "11.0% of the time a rested hero waits on the bench because all 9 of your field slots are taken. 9 is the maximum, so this one is structural — there are no more slots to buy. The gold/hr estimate already charges this wait: it costs about 2.0% of the rate you would get with room for everyone. Turning heroes off above lowers the waiting too, but usually lowers the total as well: a hero that only sometimes gets a slot still earns while it has one."
- button "Optimize" [expanded]
- text: At least 16.5% more per hour Unlocked only
- switch "Unlocked only" [checked]
- text: Difficulty filter
- combobox "Difficulty filter": All difficulties
- text: Gate
- combobox "Gate": All phases
- text: Min item level
- combobox "Min item level": Any item level
- text: Return Bonus
- combobox "Return Bonus": "Off"
- text: Sorted by Gold, descending
- table "Every wiki phase ranked by what it pays this account per hour":
  - caption: Every wiki phase ranked by what it pays this account per hour
  - rowgroup:
    - row "Phase Mitigation Gold Item chest Key Gem chest Time chest XP Item level Clear time One-shot":
      - columnheader "Phase"
      - columnheader "Mitigation":
        - button "Mitigation"
      - columnheader "Gold":
        - button "Gold"
      - columnheader "Item chest":
        - button "Item chest"
      - columnheader "Key":
        - button "Key"
      - columnheader "Gem chest":
        - button "Gem chest"
      - columnheader "Time chest":
        - button "Time chest"
      - columnheader "XP":
        - button "XP"
      - columnheader "Item level"
      - columnheader "Clear time":
        - button "Clear time"
      - columnheader "One-shot"
  - rowgroup:
    - row "Normal 1-6 (#56) 5.5% 20.5m/h 12.8/h +12.8/h — — 1.8m/h 30 27s No":
      - cell "Normal 1-6 (#56)"
      - cell "5.5%"
      - cell "20.5m/h"
      - cell "12.8/h"
      - cell "+12.8/h"
      - cell "—"
      - cell "—"
      - cell "1.8m/h"
      - cell "30"
      - cell "27s"
      - cell "No"
    - row "Normal 1-5 (#55) 5.4% 20.5m/h 13.0/h +13.0/h — — 1.8m/h 30 26s No":
      - cell "Normal 1-5 (#55)"
      - cell "5.4%"
      - cell "20.5m/h"
      - cell "13.0/h"
      - cell "+13.0/h"
      - cell "—"
      - cell "—"
      - cell "1.8m/h"
      - cell "30"
      - cell "26s"
      - cell "No"
    - row "Normal 1-1 (#51) 5.1% 20.5m/h 14.0/h +14.0/h — — 1.9m/h 30 24s No":
      - cell "Normal 1-1 (#51)"
      - cell "5.1%"
      - cell "20.5m/h"
      - cell "14.0/h"
      - cell "+14.0/h"
      - cell "—"
      - cell "—"
      - cell "1.9m/h"
      - cell "30"
      - cell "24s"
      - cell "No"
    - row "Normal 1-4 (#54) 5.3% 20.5m/h 13.2/h +13.2/h — — 1.8m/h 30 26s No":
      - cell "Normal 1-4 (#54)"
      - cell "5.3%"
      - cell "20.5m/h"
      - cell "13.2/h"
      - cell "+13.2/h"
      - cell "—"
      - cell "—"
      - cell "1.8m/h"
      - cell "30"
      - cell "26s"
      - cell "No"
    - row "Normal 1-3 (#53) 5.3% 20.3m/h 13.4/h +13.4/h — — 1.8m/h 30 25s No":
      - cell "Normal 1-3 (#53)"
      - cell "5.3%"
      - cell "20.3m/h"
      - cell "13.4/h"
      - cell "+13.4/h"
      - cell "—"
      - cell "—"
      - cell "1.8m/h"
      - cell "30"
      - cell "25s"
      - cell "No"
    - row "Normal 1-8 (#58) 5.7% 20.3m/h 12.2/h +12.2/h — — 1.8m/h 30 28s No":
      - cell "Normal 1-8 (#58)"
      - cell "5.7%"
      - cell "20.3m/h"
      - cell "12.2/h"
      - cell "+12.2/h"
      - cell "—"
      - cell "—"
      - cell "1.8m/h"
      - cell "30"
      - cell "28s"
      - cell "No"
    - row "Normal 1-7 (#57) 5.6% 20.3m/h 12.4/h +12.4/h — — 1.8m/h 30 28s No":
      - cell "Normal 1-7 (#57)"
      - cell "5.6%"
      - cell "20.3m/h"
      - cell "12.4/h"
      - cell "+12.4/h"
      - cell "—"
      - cell "—"
      - cell "1.8m/h"
      - cell "30"
      - cell "28s"
      - cell "No"
    - row "Normal 1-2 (#52) 5.2% 20.2m/h 13.6/h +13.6/h — — 1.8m/h 30 25s No":
      - cell "Normal 1-2 (#52)"
      - cell "5.2%"
      - cell "20.2m/h"
      - cell "13.6/h"
      - cell "+13.6/h"
      - cell "—"
      - cell "—"
      - cell "1.8m/h"
      - cell "30"
      - cell "25s"
      - cell "No"
    - row "Normal 1-9 (#59) 5.7% 20.1m/h 11.8/h +11.8/h — — 1.8m/h 30 29s No":
      - cell "Normal 1-9 (#59)"
      - cell "5.7%"
      - cell "20.1m/h"
      - cell "11.8/h"
      - cell "+11.8/h"
      - cell "—"
      - cell "—"
      - cell "1.8m/h"
      - cell "30"
      - cell "29s"
      - cell "No"
    - row "Normal 1-12 (#62) 6.0% 19.5m/h 10.9/h +10.9/h — — 1.7m/h 30–40 31s No":
      - cell "Normal 1-12 (#62)"
      - cell "6.0%"
      - cell "19.5m/h"
      - cell "10.9/h"
      - cell "+10.9/h"
      - cell "—"
      - cell "—"
      - cell "1.7m/h"
      - cell "30–40"
      - cell "31s"
      - cell "No"
    - row "Normal 1-11 (#61) 5.9% 19.4m/h 11.0/h +11.0/h — — 1.7m/h 30–40 31s No":
      - cell "Normal 1-11 (#61)"
      - cell "5.9%"
      - cell "19.4m/h"
      - cell "11.0/h"
      - cell "+11.0/h"
      - cell "—"
      - cell "—"
      - cell "1.7m/h"
      - cell "30–40"
      - cell "31s"
      - cell "No"
    - row "Normal 1-14 (#64) 6.2% 18.9m/h 10.2/h +10.2/h — — 1.7m/h 30–40 33s No":
      - cell "Normal 1-14 (#64)"
      - cell "6.2%"
      - cell "18.9m/h"
      - cell "10.2/h"
      - cell "+10.2/h"
      - cell "—"
      - cell "—"
      - cell "1.7m/h"
      - cell "30–40"
      - cell "33s"
      - cell "No"
    - row "Normal 1-13 (#63) 6.1% 18.8m/h 10.3/h +10.3/h — — 1.7m/h 30–40 33s No":
      - cell "Normal 1-13 (#63)"
      - cell "6.1%"
      - cell "18.8m/h"
      - cell "10.3/h"
      - cell "+10.3/h"
      - cell "—"
      - cell "—"
      - cell "1.7m/h"
      - cell "30–40"
      - cell "33s"
      - cell "No"
    - row "Normal 1-10 (#60) Gate 5.8% 18.6m/h 10.8/h -113.5/h 0.5/h 10.8/h 1.7m/h 30 32s No":
      - cell "Normal 1-10 (#60) Gate"
      - cell "5.8%"
      - cell "18.6m/h"
      - cell "10.8/h"
      - cell "-113.5/h"
      - cell "0.5/h"
      - cell "10.8/h"
      - cell "1.7m/h"
      - cell "30"
      - cell "32s"
      - cell "No"
    - row "Normal 1-16 (#66) 6.3% 18.5m/h 9.7/h +9.7/h — — 1.6m/h 30–40 35s No":
      - cell "Normal 1-16 (#66)"
      - cell "6.3%"
      - cell "18.5m/h"
      - cell "9.7/h"
      - cell "+9.7/h"
      - cell "—"
      - cell "—"
      - cell "1.6m/h"
      - cell "30–40"
      - cell "35s"
      - cell "No"
    - row "Normal 1-15 (#65) 6.2% 18.5m/h 9.8/h +9.8/h — — 1.6m/h 30–40 35s No":
      - cell "Normal 1-15 (#65)"
      - cell "6.2%"
      - cell "18.5m/h"
      - cell "9.8/h"
      - cell "+9.8/h"
      - cell "—"
      - cell "—"
      - cell "1.6m/h"
      - cell "30–40"
      - cell "35s"
      - cell "No"
    - row "Normal 1-17 (#67) 6.4% 18.1m/h 9.4/h +9.4/h — — 1.6m/h 30–40 36s No":
      - cell "Normal 1-17 (#67)"
      - cell "6.4%"
      - cell "18.1m/h"
      - cell "9.4/h"
      - cell "+9.4/h"
      - cell "—"
      - cell "—"
      - cell "1.6m/h"
      - cell "30–40"
      - cell "36s"
      - cell "No"
    - row "Normal 1-18 (#68) 6.5% 17.7m/h 9.0/h +9.0/h — — 1.5m/h 30–40 38s No":
      - cell "Normal 1-18 (#68)"
      - cell "6.5%"
      - cell "17.7m/h"
      - cell "9.0/h"
      - cell "+9.0/h"
      - cell "—"
      - cell "—"
      - cell "1.5m/h"
      - cell "30–40"
      - cell "38s"
      - cell "No"
    - row "Normal 1-19 (#69) 6.6% 17.6m/h 8.8/h +8.8/h — — 1.5m/h 30–40 39s No":
      - cell "Normal 1-19 (#69)"
      - cell "6.6%"
      - cell "17.6m/h"
      - cell "8.8/h"
      - cell "+8.8/h"
      - cell "—"
      - cell "—"
      - cell "1.5m/h"
      - cell "30–40"
      - cell "39s"
      - cell "No"
    - row "Normal 2-1 (#71) 6.7% 17.5m/h 8.5/h +8.5/h — — 1.5m/h 40 40s No":
      - cell "Normal 2-1 (#71)"
      - cell "6.7%"
      - cell "17.5m/h"
      - cell "8.5/h"
      - cell "+8.5/h"
      - cell "—"
      - cell "—"
      - cell "1.5m/h"
      - cell "40"
      - cell "40s"
      - cell "No"
    - row "Normal 2-2 (#72) 6.8% 17m/h 8.2/h +8.2/h — — 1.5m/h 40 42s No":
      - cell "Normal 2-2 (#72)"
      - cell "6.8%"
      - cell "17m/h"
      - cell "8.2/h"
      - cell "+8.2/h"
      - cell "—"
      - cell "—"
      - cell "1.5m/h"
      - cell "40"
      - cell "42s"
      - cell "No"
    - row "Normal 2-3 (#73) 6.9% 16.8m/h 8.0/h +8.0/h — — 1.5m/h 40 43s No":
      - cell "Normal 2-3 (#73)"
      - cell "6.9%"
      - cell "16.8m/h"
      - cell "8.0/h"
      - cell "+8.0/h"
      - cell "—"
      - cell "—"
      - cell "1.5m/h"
      - cell "40"
      - cell "43s"
      - cell "No"
    - row "Normal 2-4 (#74) 7.0% 16.6m/h 7.7/h +7.7/h — — 1.4m/h 40 44s No":
      - cell "Normal 2-4 (#74)"
      - cell "7.0%"
      - cell "16.6m/h"
      - cell "7.7/h"
      - cell "+7.7/h"
      - cell "—"
      - cell "—"
      - cell "1.4m/h"
      - cell "40"
      - cell "44s"
      - cell "No"
    - row "Normal 2-5 (#75) 7.1% 16.4m/h 7.5/h +7.5/h — — 1.4m/h 40 45s No":
      - cell "Normal 2-5 (#75)"
      - cell "7.1%"
      - cell "16.4m/h"
      - cell "7.5/h"
      - cell "+7.5/h"
      - cell "—"
      - cell "—"
      - cell "1.4m/h"
      - cell "40"
      - cell "45s"
      - cell "No"
    - row "Normal 1-20 (#70) Gate 6.6% 16.3m/h 8.1/h -85.1/h 0.4/h 8.1/h 1.4m/h 30–40 42s No":
      - cell "Normal 1-20 (#70) Gate"
      - cell "6.6%"
      - cell "16.3m/h"
      - cell "8.1/h"
      - cell "-85.1/h"
      - cell "0.4/h"
      - cell "8.1/h"
      - cell "1.4m/h"
      - cell "30–40"
      - cell "42s"
      - cell "No"
    - row "Normal 2-6 (#76) 7.1% 15.5m/h 7.1/h +7.1/h — — 1.3m/h 40 48s No":
      - cell "Normal 2-6 (#76)"
      - cell "7.1%"
      - cell "15.5m/h"
      - cell "7.1/h"
      - cell "+7.1/h"
      - cell "—"
      - cell "—"
      - cell "1.3m/h"
      - cell "40"
      - cell "48s"
      - cell "No"
    - row "Normal 2-7 (#77) 7.2% 15.2m/h 6.8/h +6.8/h — — 1.3m/h 40 50s No":
      - cell "Normal 2-7 (#77)"
      - cell "7.2%"
      - cell "15.2m/h"
      - cell "6.8/h"
      - cell "+6.8/h"
      - cell "—"
      - cell "—"
      - cell "1.3m/h"
      - cell "40"
      - cell "50s"
      - cell "No"
    - row "Normal 2-8 (#78) 7.3% 14.9m/h 6.6/h +6.6/h — — 1.3m/h 40 52s No":
      - cell "Normal 2-8 (#78)"
      - cell "7.3%"
      - cell "14.9m/h"
      - cell "6.6/h"
      - cell "+6.6/h"
      - cell "—"
      - cell "—"
      - cell "1.3m/h"
      - cell "40"
      - cell "52s"
      - cell "No"
    - row "Normal 2-9 (#79) 7.4% 14.8m/h 6.4/h +6.4/h — — 1.3m/h 40 53s No":
      - cell "Normal 2-9 (#79)"
      - cell "7.4%"
      - cell "14.8m/h"
      - cell "6.4/h"
      - cell "+6.4/h"
      - cell "—"
      - cell "—"
      - cell "1.3m/h"
      - cell "40"
      - cell "53s"
      - cell "No"
- text: Difficulty
- combobox "Difficulty": Normal
- text: Map
- combobox "Map": 1-6 · Blind Rootlets
- heading "Map" [level=2]
- term: Map name
- definition: "Blind Rootlets · #56"
- term: Stone HP
- definition: 6,625
- term:
  - 'button "Mitigation: Need 5.5% pen to ignore all mitigation"': Mitigation
- definition: 5.5%
- term: Props on map
- definition: "75"
- term: Avg prop HP
- definition: 8,546
- term: Est. total map HP
- definition: 640,969
- term:
  - 'button "Boss / cage HP: ×10 stone — shared 2×2 pool"': Boss / cage HP
- definition: 66,250
- term: Gate timer
- definition: —
- term: Key consumed
- definition: —
- heading "Economy" [level=2]
- term: Item drops
- definition: Level 30 items
- term: XP per prop
- definition:
  - text: "288"
  - 'button "182 + 58%: base value × your skill tree''s XP multiplier"': 182 + 58%
- term: Gold (Common)
- definition:
  - text: 1,226
  - 'button "413 + 197%: base value × (1 + your skill tree''s team coin %)"': 413 + 197%
- term: Avg gold / prop
- definition:
  - text: 1,924
  - 'button "648 + 197%: base value × (1 + your skill tree''s team coin %)"': 648 + 197%
- term: Est. map gold
- definition:
  - text: 144,322
  - 'button "48,631 + 197%: base value × (1 + your skill tree''s team coin %)"': 48,631 + 197%
- heading "Cage" [level=2]
- paragraph: The cage runs on a logged-in play clock, not a per-room roll. It can arrive early — the chance climbs from 0 to the cap across the window — and is guaranteed at the end.
- term: Early-arrival chance at this phase
- definition: 10.0%
- term: Guarantee window
- definition: 3h 30m VIP 3h 0m
- term: Cage HP
- definition: 66,250
- term: Hero chest odds
- definition: Common 80.0% Uncommon 17.0% Rare 2.9% Epic 0.1%
- heading "Drop chances" [level=2]
- paragraph: Which drops can roll depends on whether the phase is a gate.
- term: Item chest
- definition:
  - text: 0.127%
  - 'button "0.100% + 19% + 7%: base value + your skill tree''s luck + your squad''s average luck."': 0.100% + 19% + 7%
- term: Key
- definition:
  - text: 0.127%
  - 'button "0.100% + 19% + 7%: base value + your skill tree''s luck + your squad''s average luck."': 0.100% + 19% + 7%
- term: Time chest
- definition: — Gates only
- term: Gem chest
- definition: — Gates only
- term: Stone chest
- definition: — Gates only
- heading "Prop mix" [level=2]
- table:
  - rowgroup:
    - row "Target prop HP Share Gold (wiki) Gold (yours)":
      - columnheader "Target prop"
      - columnheader "HP"
      - columnheader "Share"
      - columnheader "Gold (wiki)"
      - columnheader "Gold (yours)"
  - rowgroup:
    - row "Bush 3,644 20.0% 413 1,226":
      - cell "Bush"
      - cell "3,644"
      - cell "20.0%"
      - cell "413"
      - cell "1,226"
    - row "Stone 6,625 27.5% 578 1,716":
      - cell "Stone"
      - cell "6,625"
      - cell "27.5%"
      - cell "578"
      - cell "1,716"
    - row "Box 5,300 15.0% 413 1,226":
      - cell "Box"
      - cell "5,300"
      - cell "15.0%"
      - cell "413"
      - cell "1,226"
    - row "Copper Mine 9,606 10.0% 743 2,206":
      - cell "Copper Mine"
      - cell "9,606"
      - cell "10.0%"
      - cell "743"
      - cell "2,206"
    - row "Iron Mine 11,925 7.5% 909 2,696":
      - cell "Iron Mine"
      - cell "11,925"
      - cell "7.5%"
      - cell "909"
      - cell "2,696"
    - row "Gold Ore 14,575 5.0% 909 2,696":
      - cell "Gold Ore"
      - cell "14,575"
      - cell "5.0%"
      - cell "909"
      - cell "2,696"
    - row "Mithril Ore 18,550 3.8% 1,239 3,677":
      - cell "Mithril Ore"
      - cell "18,550"
      - cell "3.8%"
      - cell "1,239"
      - cell "3,677"
    - row "Blue Crystal 15,900 5.0% 909 2,696":
      - cell "Blue Crystal"
      - cell "15,900"
      - cell "5.0%"
      - cell "909"
      - cell "2,696"
    - row "Ruby Crystal 15,900 3.8% 909 2,696":
      - cell "Ruby Crystal"
      - cell "15,900"
      - cell "3.8%"
      - cell "909"
      - cell "2,696"
    - row "Purple Crystal 21,200 2.5% 1,239 3,677":
      - cell "Purple Crystal"
      - cell "21,200"
      - cell "2.5%"
      - cell "1,239"
      - cell "3,677"
- heading "Your hero" [level=2]
- paragraph: Uses your Account settings and each hero’s geared sheet + points.
- button "Switch hero":
  - img "Bellatrix"
  - text: A
  - paragraph: Bellatrix
  - text: Uncommon L106
- term: Penetration vs phase
- definition: Fully piercing
- term: Normal hit
- definition: 17,091
- term: Critical hit
- definition: 30,064
- term: Avg hit (this build)
- definition: 17,596
- term: Field time
- definition: 25m
- table:
  - rowgroup:
    - row "Target prop HP Hits":
      - columnheader "Target prop"
      - columnheader "HP"
      - columnheader "Hits"
  - rowgroup:
    - row "Bush 3,644 1":
      - cell "Bush"
      - cell "3,644"
      - cell "1"
    - row "Stone 6,625 1":
      - cell "Stone"
      - cell "6,625"
      - cell "1"
    - row "Box 5,300 1":
      - cell "Box"
      - cell "5,300"
      - cell "1"
    - row "Copper Mine 9,606 1":
      - cell "Copper Mine"
      - cell "9,606"
      - cell "1"
    - row "Iron Mine 11,925 1":
      - cell "Iron Mine"
      - cell "11,925"
      - cell "1"
    - row "Gold Ore 14,575 1":
      - cell "Gold Ore"
      - cell "14,575"
      - cell "1"
    - row "Mithril Ore 18,550 2":
      - cell "Mithril Ore"
      - cell "18,550"
      - cell "2"
    - row "Blue Crystal 15,900 1":
      - cell "Blue Crystal"
      - cell "15,900"
      - cell "1"
    - row "Ruby Crystal 15,900 1":
      - cell "Ruby Crystal"
      - cell "15,900"
      - cell "1"
    - row "Purple Crystal 21,200 2":
      - cell "Purple Crystal"
      - cell "21,200"
      - cell "2"
- heading "Top 9 by solo DPS" [level=2]
- paragraph: Sum of the highest solo sustained-DPS builds in your roster (same Account), up to your casa slot count.
- term: Combined sustained DPS
- definition: 49,136
- term:
  - 'button "Est. clear time: The ranking board''s model — your whole rotation under House and field limits, charging whole hits per prop. Not map HP ÷ combined DPS."': Est. clear time
- definition: 27s
- table:
  - rowgroup:
    - row "# Avatar Name Lv Normal Crit Field DPS":
      - columnheader "#"
      - columnheader "Avatar"
      - columnheader "Name"
      - columnheader "Lv"
      - columnheader "Normal"
      - columnheader "Crit"
      - columnheader "Field"
      - columnheader "DPS"
  - rowgroup:
    - row "Bellatrix":
      - cell "1"
      - cell "Bellatrix":
        - img "Bellatrix"
      - cell "Bellatrix"
      - cell "L106"
      - cell "17,091"
      - cell "30,064"
      - cell "25m"
      - cell "12,173"
    - row "Minato":
      - cell "2"
      - cell "Minato":
        - img "Minato"
      - cell "Minato"
      - cell "L95"
      - cell "15,714"
      - cell "27,409"
      - cell "23m 25s"
      - cell "8,439"
    - 'row "Buff S #1"':
      - cell "3"
      - 'cell "Buff S #1"':
        - 'img "Buff S #1"'
      - 'cell "Buff S #1"'
      - cell "L85"
      - cell "13,603"
      - cell "35,545"
      - cell "21m 60s"
      - cell "5,996"
    - row "Jon":
      - cell "4"
      - cell "Jon":
        - img "Jon"
      - cell "Jon"
      - cell "L96"
      - cell "10,980"
      - cell "18,046"
      - cell "25m 19s"
      - cell "5,983"
    - 'row "WB #1"':
      - cell "5"
      - 'cell "WB #1"':
        - 'img "WB #1"'
      - 'cell "WB #1"'
      - cell "L84"
      - cell "7,848"
      - cell "13,183"
      - cell "19m 44s"
      - cell "4,994"
    - 'row "WB #2"':
      - cell "6"
      - 'cell "WB #2"':
        - 'img "WB #2"'
      - 'cell "WB #2"'
      - cell "L77"
      - cell "6,809"
      - cell "10,665"
      - cell "17m 13s"
      - cell "4,070"
    - 'row "WB #3"':
      - cell "7"
      - 'cell "WB #3"':
        - 'img "WB #3"'
      - 'cell "WB #3"'
      - cell "L59"
      - cell "4,518"
      - cell "7,034"
      - cell "15m 37s"
      - cell "2,670"
    - 'row "Manco #2"':
      - cell "8"
      - 'cell "Manco #2"':
        - 'img "Manco #2"'
      - 'cell "Manco #2"'
      - cell "L67"
      - cell "6,904"
      - cell "11,135"
      - cell "17m 33s"
      - cell "2,572"
    - 'row "Buff L #1"':
      - cell "9"
      - 'cell "Buff L #1"':
        - 'img "Buff L #1"'
      - 'cell "Buff L #1"'
      - cell "L68"
      - cell "6,211"
      - cell "11,006"
      - cell "16m 35s"
      - cell "2,240"
- contentinfo:
  - paragraph: This is an unofficial, fan-made tool. It is not affiliated with, endorsed by or connected to the BombFarm developers in any way.
  - paragraph:
    - text: Assets are from the official BombFarm wiki.
    - link "wiki.bombfarm.net":
      - /url: https://wiki.bombfarm.net
    - text: .
  - paragraph:
    - text: Referral code
    - code: F-X7BTKJPP
    - button "Copy referral code"
    - text: — a reward for us both at stage 151.
  - text: v0.0.0-e2e
  - link "Buy me a coffee":
    - /url: https://buymeacoffee.com/lucasfevi
```

# Test source

```ts
  80  |     lang,
  81  |   };
  82  | }
  83  | 
  84  | async function firstRowPhase(page: Page): Promise<number> {
  85  |   const testid = await rows(page).first().getAttribute('data-testid');
  86  |   return Number(testid?.replace('farm-row-', ''));
  87  | }
  88  | 
  89  | // Deliberately NOT asserted anywhere in this file: "a second Optimize activation on unchanged
  90  | // inputs does not re-solve". The DOM has no honest signal for "did not recompute" — inventing
  91  | // one (a render-counter attribute) would be test-shaped production code. That claim is proved by
  92  | // a Vitest solve-counter assertion instead (phases-slice.test.ts).
  93  | test.describe('Farm Respec Advisor', () => {
  94  |   test.beforeEach(async ({ page }) => {
  95  |     await seedLocalStorage(page, { heroes: [], lang: 'en' });
  96  |     await page.goto('/farm');
  97  |     await importAccount486(page);
  98  |   });
  99  | 
  100 |   // 1. The callout appears with a lower-bound gain and nothing else; the recommended phase it
  101 |   // used to restate is the panel's Phase tile, so the band is asserted there instead.
  102 |   test('the toolbar callout is the lower-bound gain alone; the panel names a phase in 53-57', async ({ page }) => {
  103 |     await expect(toolbar(page)).toBeVisible();
  104 |     await expect(headline(page)).toContainText(/at least/i);
  105 |     // The phase, the cost and the payback all moved into the panel — none of them may creep back.
  106 |     await expect(headline(page)).not.toContainText(/#\d+/);
  107 |     await expect(headline(page)).not.toContainText(/gold to respec|pays for itself/i);
  108 | 
  109 |     await optimizeButton(page).click();
  110 |     await expect(panel(page)).toBeVisible();
  111 |     const phaseText = (await page.getByTestId('farm-respec-metric-phase').textContent()) ?? '';
  112 |     const phases = [...phaseText.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
  113 |     expect(phases.length, `no phase number found in "${phaseText}"`).toBeGreaterThan(0);
  114 |     // The tile reads `current -> recommended`; the recommendation is the last one it prints.
  115 |     const recommended = phases[phases.length - 1];
  116 |     // The solver lands on 55 for this account, up from 52 before the 2026-08-28 damage patch made
  117 |     // weapons worth five times as much: a stronger roster clears higher, so the phase it should
  118 |     // farm rises. Asserted as a narrow band rather than a point so a last-digit move in an
  119 |     // unrelated constant does not fail a test about the UI.
  120 |     //
  121 |     // This band is a UI anchor, not a measurement. The capture behind it is out of regime for
  122 |     // sheet math (see `docs/fixture-corpus.md` §13), so the number is here to keep the assertion
  123 |     // from going vacuous, and it moves whenever the model does.
  124 |     expect(recommended).toBeGreaterThanOrEqual(53);
  125 |     expect(recommended).toBeLessThanOrEqual(57);
  126 |   });
  127 | 
  128 |   // 2. Optimize expands the panel IN PLACE — DOM order between the toolbar and the table's
  129 |   // <thead>, never a modal or drawer.
  130 |   test('Optimize expands the panel in place, between the toolbar and the table head, never a dialog', async ({ page }) => {
  131 |     await optimizeButton(page).click();
  132 |     await expect(panel(page)).toBeVisible();
  133 | 
  134 |     const order = await page.evaluate(() => {
  135 |       const toolbarEl = document.querySelector('[data-testid="farm-respec-toolbar"]');
  136 |       const panelEl = document.querySelector('[data-testid="farm-respec-panel"]');
  137 |       const theadEl = document.querySelector('[data-testid="farm-ranking-table"] thead');
  138 |       if (!toolbarEl || !panelEl || !theadEl) return null;
  139 |       const toolbarBeforePanel = Boolean(
  140 |         toolbarEl.compareDocumentPosition(panelEl) & Node.DOCUMENT_POSITION_FOLLOWING,
  141 |       );
  142 |       const panelBeforeThead = Boolean(
  143 |         panelEl.compareDocumentPosition(theadEl) & Node.DOCUMENT_POSITION_FOLLOWING,
  144 |       );
  145 |       return { toolbarBeforePanel, panelBeforeThead };
  146 |     });
  147 |     expect(order).toEqual({ toolbarBeforePanel: true, panelBeforeThead: true });
  148 | 
  149 |     expect(await page.locator('[role="dialog"]:visible').count()).toBe(0);
  150 |   });
  151 | 
  152 |   // 3. The split is executable: every enabled hero has a card, at least one is the unchanged
  153 |   // variant naming gold not spent, a changed hero's card has eight key rows, the luck row reads
  154 |   // the keep wording, and nothing reads optional/negligible/skip.
  155 |   test('every enabled hero has a card; changed heroes show all eight keys with luck kept; unchanged heroes name the gold not spent', async ({ page }) => {
  156 |     await optimizeButton(page).click();
  157 |     await expect(panel(page)).toBeVisible();
  158 |     await expect(heroGrid(page)).toBeVisible();
  159 | 
  160 |     const cardCount = await heroGrid(page).locator('[data-testid^="farm-respec-hero-"]').count();
  161 |     expect(cardCount).toBe(13); // the committed capture's thirteen heroes
  162 | 
  163 |     const keyRows = heroGrid(page).locator('[data-testid^="farm-respec-key-"]');
  164 |     const changedCardKeyCount = await keyRows.count();
  165 |     expect(changedCardKeyCount).toBeGreaterThan(0);
  166 |     expect(changedCardKeyCount % 8).toBe(0); // every changed card contributes exactly 8 rows
  167 | 
  168 |     // The Luck row's lock glyph carries "Keep" as its accessible name (DeltaTable's `lockLabel`),
  169 |     // not visible text — a compact icon replaces the old Chip + HelpTip pair.
  170 |     await expect(heroGrid(page).getByRole('button', { name: 'Keep' }).first()).toBeVisible();
  171 |     await expect(heroGrid(page).getByText(/no respec needed/i).first()).toBeVisible();
  172 | 
  173 |     const panelText = (await panel(page).textContent()) ?? '';
  174 |     expect(panelText).not.toMatch(/optional|negligible|\bskip(pable)?\b/i);
  175 |   });
  176 | 
  177 |   // 4. Cards wrap onto further rows; never an accordion, tab list or horizontal scroller.
  178 |   test('hero cards wrap onto further rows at 1280px width, never collapsing into tabs or a scroller', async ({ page }) => {
  179 |     await optimizeButton(page).click();
> 180 |     await expect(heroGrid(page)).toBeVisible();
      |                                  ^ Error: expect(locator).toBeVisible() failed
  181 | 
  182 |     const cards = heroGrid(page).locator('[data-testid^="farm-respec-hero-"]');
  183 |     const count = await cards.count();
  184 |     expect(count).toBeGreaterThan(1);
  185 |     const boxes = await Promise.all(
  186 |       Array.from({ length: count }, (_unused, index) => cards.nth(index).boundingBox()),
  187 |     );
  188 |     const tops = new Set(boxes.map((box) => box?.y));
  189 |     expect(tops.size, 'expected cards on more than one row').toBeGreaterThan(1);
  190 | 
  191 |     // Scoped to the hero grid — the page may legitimately have an unrelated tablist elsewhere
  192 |     // (e.g. shell chrome); the requirement here is that this grid never becomes one.
  193 |     expect(await heroGrid(page).locator('[role="tablist"]').count()).toBe(0);
  194 |     const gridOverflowX = await heroGrid(page).evaluate((element) => getComputedStyle(element).overflowX);
  195 |     expect(gridOverflowX).not.toBe('scroll');
  196 |     expect(gridOverflowX).not.toBe('auto');
  197 |   });
  198 | 
  199 |   // 5. Re-rank moves the top-ranked phase into the recommended band, closes the panel, and marks the
  200 |   // table as showing the proposed build. Same band, and the same caveat, as the Phase tile above.
  201 |   test('re-rank moves the top-ranked phase into 53-57, closes the panel, and marks the table', async ({ page }) => {
  202 |     const beforePhase = await firstRowPhase(page);
  203 | 
  204 |     await optimizeButton(page).click();
  205 |     await expect(panel(page)).toBeVisible();
  206 | 
  207 |     await page.getByTestId('farm-respec-rerank').getByRole('switch').click();
  208 |     await expect(panel(page)).toBeHidden();
  209 |     await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'proposed');
  210 |     await expect(page.getByTestId('farm-respec-rerank-banner')).toBeVisible();
  211 | 
  212 |     const afterPhase = await firstRowPhase(page);
  213 |     expect(afterPhase).not.toBe(beforePhase);
  214 |     expect(afterPhase).toBeGreaterThanOrEqual(53);
  215 |     expect(afterPhase).toBeLessThanOrEqual(57);
  216 |   });
  217 | 
  218 |   // 6. Invalidation: with re-rank on, changing an input reverts everything — no stale figure.
  219 |   test('changing a rotation-pool input while re-ranked reverts the panel and the table, with no stale gain figure left on screen', async ({ page }) => {
  220 |     await optimizeButton(page).click();
  221 |     await expect(panel(page)).toBeVisible();
  222 | 
  223 |     // The PANEL's gold tile, not the toolbar headline. The headline is a live lower bound that
  224 |     // gets recomputed for whatever pool is selected, so it can legitimately read the same string
  225 |     // before and after — it did exactly that here ("At least 2.4% more per hour" both times),
  226 |     // which made a global search for it prove nothing. The tile carries the SOLVED proposal, is
  227 |     // rendered only inside the panel, and therefore has to be gone once the panel is invalidated.
  228 |     const proposalText = (await page.getByTestId('farm-respec-metric-gold').textContent()) ?? '';
  229 |     expect(proposalText.trim()).not.toBe('');
  230 | 
  231 |     await page.getByTestId('farm-respec-rerank').getByRole('switch').click();
  232 |     await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'proposed');
  233 | 
  234 |     // Toggle a rotation-pool hero — an input the respec proposal is keyed on.
  235 |     const firstPoolSwitch = page.locator('[data-testid^="farm-pool-hero-"]').first().getByRole('switch');
  236 |     await firstPoolSwitch.click();
  237 | 
  238 |     await expect(panel(page)).toBeHidden();
  239 |     await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'current');
  240 |     await expect(page.getByTestId('farm-respec-metric-gold')).toHaveCount(0);
  241 |     await expect(page.getByText(proposalText, { exact: true })).toHaveCount(0);
  242 |   });
  243 | 
  244 |   // 7. PT — the toolbar, panel and tiles render in Portuguese, no EN leakage.
  245 |   test('renders in Portuguese with no EN leakage in the toolbar or panel', async ({ page }) => {
  246 |     const captured = await captureSeededState(page, 'pt');
  247 |     await seedLocalStorage(page, captured);
  248 |     await page.goto('/farm');
  249 | 
  250 |     await expect(toolbar(page)).toContainText(/pelo menos/i);
  251 |     await optimizeButton(page).click();
  252 |     await expect(panel(page)).toBeVisible();
  253 |     await expect(panel(page).getByText('Ouro / h', { exact: true })).toBeVisible();
  254 | 
  255 |     const toolbarText = (await toolbar(page).textContent()) ?? '';
  256 |     const panelText = (await panel(page).textContent()) ?? '';
  257 |     expect(toolbarText).not.toMatch(/at least/i);
  258 |     expect(panelText).not.toMatch(/Optimize|Payback|Respec cost/i);
  259 |   });
  260 | 
  261 |   // 8. Keyboard reachability and the busy state.
  262 |   test('Optimize is keyboard-activatable and exposes aria-expanded; the re-rank switch is keyboard-reachable with an accessible name', async ({ page }) => {
  263 |     await optimizeButton(page).focus();
  264 |     await expect(optimizeButton(page)).toBeFocused();
  265 |     await page.keyboard.press('Enter');
  266 |     await expect(panel(page)).toBeVisible();
  267 |     await expect(optimizeButton(page)).toHaveAttribute('aria-expanded', 'true');
  268 | 
  269 |     const rerankSwitch = page.getByTestId('farm-respec-rerank').getByRole('switch');
  270 |     await rerankSwitch.focus();
  271 |     await expect(rerankSwitch).toBeFocused();
  272 |     await expect(page.getByRole('switch', { name: /show ranking under this build/i })).toBeVisible();
  273 |   });
  274 | });
  275 | 
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: farm-respec.spec.ts >> Farm Respec Advisor >> re-rank moves the top-ranked phase into 26-28, closes the panel, and marks the table
- Location: e2e/farm-respec.spec.ts:151:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('farm-respec-rerank-banner')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByTestId('farm-respec-rerank-banner')

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
  - button "Import"
  - button "Copy my referral code — we both get a reward once you clear stage 151": F-S7999UQC
  - link "Buy me a coffee":
    - /url: https://buymeacoffee.com/lucasfevi
  - group "Language":
    - button "PT"
    - button "EN"
- heading "Farm Ranking" [level=2]
- group "Rotation pool":
  - text: Rotation pool
  - switch "Include Jon in the farm estimate" [checked]
  - text: Jon
  - switch "Include Perrin in the farm estimate" [checked]
  - text: Perrin
  - switch "Include Perrin in the farm estimate" [checked]
  - text: Perrin
  - switch "Include Lyra in the farm estimate" [checked]
  - text: Lyra
  - switch "Include Bellatrix in the farm estimate" [checked]
  - text: Bellatrix
- text: Unlocked only
- switch "Unlocked only" [checked]
- text: Feasible only
- switch "Feasible only"
- text: Difficulty filter
- combobox "Difficulty filter": All difficulties
- text: Gate
- combobox "Gate": All phases
- text: Return Bonus
- combobox "Return Bonus": "Off"
- text: Objective
- combobox "Objective": Gold / hr
- button "Optimize"
- text: "At least 5.7% more per hour Recommended phase: Stone Gorge · #26 89,000 gold to respec Pays for itself in 6.3 h"
- switch "Show ranking under this build Show ranking under this build"
- text: Show ranking under this build Sorted by Gold / hr, descending
- table "Every wiki phase ranked by what it pays this account per hour":
  - caption: Every wiki phase ranked by what it pays this account per hour
  - rowgroup:
    - row "Phase Mitigation Gold / hr Chests / hr Keys / hr Gems / hr Time pieces / hr XP / hr Item level Clear time One-shot Cage window Feasible":
      - columnheader "Phase"
      - columnheader "Mitigation":
        - button "Mitigation"
      - columnheader "Gold / hr":
        - button "Gold / hr"
      - columnheader "Chests / hr":
        - button "Chests / hr"
      - columnheader "Keys / hr":
        - button "Keys / hr"
      - columnheader "Gems / hr":
        - button "Gems / hr"
      - columnheader "Time pieces / hr":
        - button "Time pieces / hr"
      - columnheader "XP / hr":
        - button "XP / hr"
      - columnheader "Item level"
      - columnheader "Clear time":
        - button "Clear time"
      - columnheader "One-shot"
      - columnheader "Cage window"
      - columnheader "Feasible"
  - rowgroup:
    - 'row "Depths Antechamber · #29 3.3 247.4k 1.3 +1.3 0 0 116.5k 10 2m 37s No 5.0% · 3h 30m"':
      - 'cell "Depths Antechamber · #29"'
      - cell "3.3"
      - cell "247.4k"
      - cell "1.3"
      - cell "+1.3"
      - cell "0"
      - cell "0"
      - cell "116.5k"
      - cell "10"
      - cell "2m 37s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Dark Crossroads · #27 3.1 244k 1.3 +1.3 0 0 115.7k 10 2m 28s No 5.0% · 3h 30m"':
      - 'cell "Dark Crossroads · #27"'
      - cell "3.1"
      - cell "244k"
      - cell "1.3"
      - cell "+1.3"
      - cell "0"
      - cell "0"
      - cell "115.7k"
      - cell "10"
      - cell "2m 28s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Roots in Rock · #28 3.2 243.2k 1.3 +1.3 0 0 114.3k 10 2m 35s No 5.0% · 3h 30m"':
      - 'cell "Roots in Rock · #28"'
      - cell "3.2"
      - cell "243.2k"
      - cell "1.3"
      - cell "+1.3"
      - cell "0"
      - cell "0"
      - cell "114.3k"
      - cell "10"
      - cell "2m 35s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Granite Heart · #30 Gate 3.4 240.9k 1.2 -19.8consumed 0.1 1.8 112.5k 10 3m 2s No 5.0% · 3h 30m"':
      - 'cell "Granite Heart · #30 Gate"'
      - cell "3.4"
      - cell "240.9k"
      - cell "1.2"
      - cell "-19.8consumed"
      - cell "0.1"
      - cell "1.8"
      - cell "112.5k"
      - cell "10"
      - cell "3m 2s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Stone Leaf Litter · #31 3.5 238k 1.1 +1.1 0 0 110.3k 10 2m 55s No 5.0% · 3h 30m"':
      - 'cell "Stone Leaf Litter · #31"'
      - cell "3.5"
      - cell "238k"
      - cell "1.1"
      - cell "+1.1"
      - cell "0"
      - cell "0"
      - cell "110.3k"
      - cell "10"
      - cell "2m 55s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Fallen Logs · #33 3.6 236.6k 1.1 +1.1 0 0 108.2k 10 3m 8s No 5.0% · 3h 30m"':
      - 'cell "Fallen Logs · #33"'
      - cell "3.6"
      - cell "236.6k"
      - cell "1.1"
      - cell "+1.1"
      - cell "0"
      - cell "0"
      - cell "108.2k"
      - cell "10"
      - cell "3m 8s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Stone Gorge · #26 3.0 235k 1.3 +1.3 0 0 112.4k 10 2m 28s No 5.0% · 3h 30m"':
      - 'cell "Stone Gorge · #26"'
      - cell "3.0"
      - cell "235k"
      - cell "1.3"
      - cell "+1.3"
      - cell "0"
      - cell "0"
      - cell "112.4k"
      - cell "10"
      - cell "2m 28s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Dry Branch Gallery · #32 3.5 234k 1.1 +1.1 0 0 107.7k 10 3m 4s No 5.0% · 3h 30m"':
      - 'cell "Dry Branch Gallery · #32"'
      - cell "3.5"
      - cell "234k"
      - cell "1.1"
      - cell "+1.1"
      - cell "0"
      - cell "0"
      - cell "107.7k"
      - cell "10"
      - cell "3m 4s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Deep Vein · #25 3.0 230.1k 1.4 +1.4 0 0 111.2k 10 2m 25s No 5.0% · 3h 30m"':
      - 'cell "Deep Vein · #25"'
      - cell "3.0"
      - cell "230.1k"
      - cell "1.4"
      - cell "+1.4"
      - cell "0"
      - cell "0"
      - cell "111.2k"
      - cell "10"
      - cell "2m 25s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Echo Shaft · #24 2.9 228.6k 1.4 +1.4 0 0 111.6k 10 2m 19s No 5.0% · 3h 30m"':
      - 'cell "Echo Shaft · #24"'
      - cell "2.9"
      - cell "228.6k"
      - cell "1.4"
      - cell "+1.4"
      - cell "0"
      - cell "0"
      - cell "111.6k"
      - cell "10"
      - cell "2m 19s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Old Timbers · #23 2.8 221.6k 1.4 +1.4 0 0 108.1k 10 2m 19s No 5.0% · 3h 30m"':
      - 'cell "Old Timbers · #23"'
      - cell "2.8"
      - cell "221.6k"
      - cell "1.4"
      - cell "+1.4"
      - cell "0"
      - cell "0"
      - cell "108.1k"
      - cell "10"
      - cell "2m 19s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Cracked Bark · #34 3.7 221.2k 1.0 +1.0 0 0 100.6k 10 3m 28s No 5.0% · 3h 30m"':
      - 'cell "Cracked Bark · #34"'
      - cell "3.7"
      - cell "221.2k"
      - cell "1.0"
      - cell "+1.0"
      - cell "0"
      - cell "0"
      - cell "100.6k"
      - cell "10"
      - cell "3m 28s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Sunken Clearing · #35 3.8 221.1k 0.9 +0.9 0 0 100.7k 10 3m 33s No 5.0% · 3h 30m"':
      - 'cell "Sunken Clearing · #35"'
      - cell "3.8"
      - cell "221.1k"
      - cell "0.9"
      - cell "+0.9"
      - cell "0"
      - cell "0"
      - cell "100.7k"
      - cell "10"
      - cell "3m 33s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Twisted Gallery · #22 2.7 215.6k 1.5 +1.5 0 0 106.5k 10 2m 16s No 5.0% · 3h 30m"':
      - 'cell "Twisted Gallery · #22"'
      - cell "2.7"
      - cell "215.6k"
      - cell "1.5"
      - cell "+1.5"
      - cell "0"
      - cell "0"
      - cell "106.5k"
      - cell "10"
      - cell "2m 16s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Fossil Stumps · #36 3.9 215.1k 0.9 +0.9 0 0 97.5k 10 3m 46s No 5.0% · 3h 30m"':
      - 'cell "Fossil Stumps · #36"'
      - cell "3.9"
      - cell "215.1k"
      - cell "0.9"
      - cell "+0.9"
      - cell "0"
      - cell "0"
      - cell "97.5k"
      - cell "10"
      - cell "3m 46s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Last Light · #21 2.6 208.4k 1.5 +1.5 0 0 104.3k 10 2m 14s No 5.0% · 3h 30m"':
      - 'cell "Last Light · #21"'
      - cell "2.6"
      - cell "208.4k"
      - cell "1.5"
      - cell "+1.5"
      - cell "0"
      - cell "0"
      - cell "104.3k"
      - cell "10"
      - cell "2m 14s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Exposed Roots · #38 4.0 207.1k 0.8 +0.8 0 0 92.9k 10 4m 8s No 5.0% · 3h 30m"':
      - 'cell "Exposed Roots · #38"'
      - cell "4.0"
      - cell "207.1k"
      - cell "0.8"
      - cell "+0.8"
      - cell "0"
      - cell "0"
      - cell "92.9k"
      - cell "10"
      - cell "4m 8s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Dead Wood · #37 3.9 202.9k 0.8 +0.8 0 0 91.4k 10 4m 6s No 5.0% · 3h 30m"':
      - 'cell "Dead Wood · #37"'
      - cell "3.9"
      - cell "202.9k"
      - cell "0.8"
      - cell "+0.8"
      - cell "0"
      - cell "0"
      - cell "91.4k"
      - cell "10"
      - cell "4m 6s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "The Master Cliff · #20 Gate 2.6 198.1k 1.5 -25.7consumed 0.1 2.2 100.6k 10 2m 20s No 5.0% · 3h 30m"':
      - 'cell "The Master Cliff · #20 Gate"'
      - cell "2.6"
      - cell "198.1k"
      - cell "1.5"
      - cell "-25.7consumed"
      - cell "0.1"
      - cell "2.2"
      - cell "100.6k"
      - cell "10"
      - cell "2m 20s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Root Mouth · #39 4.1 195.5k 0.7 +0.7 0 0 87.3k 10 4m 30s No 5.0% · 3h 30m"':
      - 'cell "Root Mouth · #39"'
      - cell "4.1"
      - cell "195.5k"
      - cell "0.7"
      - cell "+0.7"
      - cell "0"
      - cell "0"
      - cell "87.3k"
      - cell "10"
      - cell "4m 30s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Pit Depths · #19 2.5 188.4k 1.5 +1.5 0 0 97.1k 10 2m 13s No 5.0% · 3h 30m"':
      - 'cell "Pit Depths · #19"'
      - cell "2.5"
      - cell "188.4k"
      - cell "1.5"
      - cell "+1.5"
      - cell "0"
      - cell "0"
      - cell "97.1k"
      - cell "10"
      - cell "2m 13s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Cliff Shadow · #18 2.4 181k 1.5 +1.5 0 0 93.5k 10 2m 12s No 5.0% · 3h 30m"':
      - 'cell "Cliff Shadow · #18"'
      - cell "2.4"
      - cell "181k"
      - cell "1.5"
      - cell "+1.5"
      - cell "0"
      - cell "0"
      - cell "93.5k"
      - cell "10"
      - cell "2m 12s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Elder Trunk · #40 Gate 4.2 172.2k 0.6 -10.2consumed 0.0 0.9 77k 10 5m 52s No 5.0% · 3h 30m"':
      - 'cell "Elder Trunk · #40 Gate"'
      - cell "4.2"
      - cell "172.2k"
      - cell "0.6"
      - cell "-10.2consumed"
      - cell "0.0"
      - cell "0.9"
      - cell "77k"
      - cell "10"
      - cell "5m 52s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Living Stone · #17 2.3 171.3k 1.5 +1.5 0 0 90.1k 10 2m 11s No 5.0% · 3h 30m"':
      - 'cell "Living Stone · #17"'
      - cell "2.3"
      - cell "171.3k"
      - cell "1.5"
      - cell "+1.5"
      - cell "0"
      - cell "0"
      - cell "90.1k"
      - cell "10"
      - cell "2m 11s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Wooded Descent · #41 4.3 168.3k 0.6 +0.6 0 0 74.9k 10–20 5m 29s No 5.0% · 3h 30m"':
      - 'cell "Wooded Descent · #41"'
      - cell "4.3"
      - cell "168.3k"
      - cell "0.6"
      - cell "+0.6"
      - cell "0"
      - cell "0"
      - cell "74.9k"
      - cell "10–20"
      - cell "5m 29s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Twisted Roots · #42 4.4 162.8k 0.6 +0.6 0 0 72.1k 10–20 5m 49s No 5.0% · 3h 30m"':
      - 'cell "Twisted Roots · #42"'
      - cell "4.4"
      - cell "162.8k"
      - cell "0.6"
      - cell "+0.6"
      - cell "0"
      - cell "0"
      - cell "72.1k"
      - cell "10–20"
      - cell "5m 49s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Gray Vein · #16 2.2 161.3k 1.5 +1.5 0 0 86.6k 10 2m 10s No 5.0% · 3h 30m"':
      - 'cell "Gray Vein · #16"'
      - cell "2.2"
      - cell "161.3k"
      - cell "1.5"
      - cell "+1.5"
      - cell "0"
      - cell "0"
      - cell "86.6k"
      - cell "10"
      - cell "2m 10s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Crusher Echoes · #15 2.1 151.7k 1.5 +1.5 0 0 83.3k 10 2m 9s No 5.0% · 3h 30m"':
      - 'cell "Crusher Echoes · #15"'
      - cell "2.1"
      - cell "151.7k"
      - cell "1.5"
      - cell "+1.5"
      - cell "0"
      - cell "0"
      - cell "83.3k"
      - cell "10"
      - cell "2m 9s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Cracked Bench · #14 2.1 141.5k 1.5 +1.5 0 0 79.7k 10 2m 8s No 5.0% · 3h 30m"':
      - 'cell "Cracked Bench · #14"'
      - cell "2.1"
      - cell "141.5k"
      - cell "1.5"
      - cell "+1.5"
      - cell "0"
      - cell "0"
      - cell "79.7k"
      - cell "10"
      - cell "2m 8s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Loose Slope · #13 2.0 131k 1.6 +1.6 0 0 76k 10 2m 7s No 5.0% · 3h 30m"':
      - 'cell "Loose Slope · #13"'
      - cell "2.0"
      - cell "131k"
      - cell "1.6"
      - cell "+1.6"
      - cell "0"
      - cell "0"
      - cell "76k"
      - cell "10"
      - cell "2m 7s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Stone Steps · #12 1.9 123.2k 1.6 +1.6 0 0 72.3k 10 2m 6s No 5.0% · 3h 30m"':
      - 'cell "Stone Steps · #12"'
      - cell "1.9"
      - cell "123.2k"
      - cell "1.6"
      - cell "+1.6"
      - cell "0"
      - cell "0"
      - cell "72.3k"
      - cell "10"
      - cell "2m 6s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "First Bench · #11 1.8 112.7k 1.6 +1.6 0 0 68.6k 10 2m 5s No 5.0% · 3h 30m"':
      - 'cell "First Bench · #11"'
      - cell "1.8"
      - cell "112.7k"
      - cell "1.6"
      - cell "+1.6"
      - cell "0"
      - cell "0"
      - cell "68.6k"
      - cell "10"
      - cell "2m 5s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "The First Blast · #10 Gate 1.7 102.9k 1.6 -28.4consumed 0.1 2.4 65.5k 10 2m 7s No 5.0% · 3h 30m"':
      - 'cell "The First Blast · #10 Gate"'
      - cell "1.7"
      - cell "102.9k"
      - cell "1.6"
      - cell "-28.4consumed"
      - cell "0.1"
      - cell "2.4"
      - cell "65.5k"
      - cell "10"
      - cell "2m 7s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Cut Edge · #9 1.7 91.7k 1.6 +1.6 0 0 61.5k 10 2m 2s No 5.0% · 3h 30m"':
      - 'cell "Cut Edge · #9"'
      - cell "1.7"
      - cell "91.7k"
      - cell "1.6"
      - cell "+1.6"
      - cell "0"
      - cell "0"
      - cell "61.5k"
      - cell "10"
      - cell "2m 2s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Mining Face · #8 1.6 81.4k 1.6 +1.6 0 0 58.2k 10 2m No 5.0% · 3h 30m"':
      - 'cell "Mining Face · #8"'
      - cell "1.6"
      - cell "81.4k"
      - cell "1.6"
      - cell "+1.6"
      - cell "0"
      - cell "0"
      - cell "58.2k"
      - cell "10"
      - cell "2m"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Rubble Wall · #7 1.5 72.7k 1.7 +1.7 0 0 54k 10 1m 60s No 5.0% · 3h 30m"':
      - 'cell "Rubble Wall · #7"'
      - cell "1.5"
      - cell "72.7k"
      - cell "1.7"
      - cell "+1.7"
      - cell "0"
      - cell "0"
      - cell "54k"
      - cell "10"
      - cell "1m 60s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Sledgehammer Yard · #6 1.4 61.6k 1.7 +1.7 0 0 50.3k 10 1m 58s No 5.0% · 3h 30m"':
      - 'cell "Sledgehammer Yard · #6"'
      - cell "1.4"
      - cell "61.6k"
      - cell "1.7"
      - cell "+1.7"
      - cell "0"
      - cell "0"
      - cell "50.3k"
      - cell "10"
      - cell "1m 58s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Rubble Mound · #5 1.3 49.4k 1.7 +1.7 0 0 45.9k 10 1m 57s No 5.0% · 3h 30m"':
      - 'cell "Rubble Mound · #5"'
      - cell "1.3"
      - cell "49.4k"
      - cell "1.7"
      - cell "+1.7"
      - cell "0"
      - cell "0"
      - cell "45.9k"
      - cell "10"
      - cell "1m 57s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Sunlit Dust · #4 1.2 37.7k 1.7 +1.7 0 0 42k 10 1m 55s No 5.0% · 3h 30m"':
      - 'cell "Sunlit Dust · #4"'
      - cell "1.2"
      - cell "37.7k"
      - cell "1.7"
      - cell "+1.7"
      - cell "0"
      - cell "0"
      - cell "42k"
      - cell "10"
      - cell "1m 55s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Gravel Trail · #3 1.2 25.2k 1.7 +1.7 0 0 37.4k 10 1m 55s No 5.0% · 3h 30m"':
      - 'cell "Gravel Trail · #3"'
      - cell "1.2"
      - cell "25.2k"
      - cell "1.7"
      - cell "+1.7"
      - cell "0"
      - cell "0"
      - cell "37.4k"
      - cell "10"
      - cell "1m 55s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "Pebble Field · #2 1.1 15.9k 1.7 +1.7 0 0 33.1k 10 1m 54s No 5.0% · 3h 30m"':
      - 'cell "Pebble Field · #2"'
      - cell "1.1"
      - cell "15.9k"
      - cell "1.7"
      - cell "+1.7"
      - cell "0"
      - cell "0"
      - cell "33.1k"
      - cell "10"
      - cell "1m 54s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
    - 'row "First Strike · #1 1.0 3.2k 1.7 +1.7 0 0 28.6k 10 1m 53s No 5.0% · 3h 30m"':
      - 'cell "First Strike · #1"'
      - cell "1.0"
      - cell "3.2k"
      - cell "1.7"
      - cell "+1.7"
      - cell "0"
      - cell "0"
      - cell "28.6k"
      - cell "10"
      - cell "1m 53s"
      - cell "No"
      - cell "5.0% · 3h 30m"
      - cell
- text: Difficulty
- combobox "Difficulty": Easy
- text: Map
- combobox "Map": 1-1 · First Strike
- heading "Map" [level=2]
- term: Map name
- definition: "First Strike · #1"
- term: Stone HP
- definition: "53"
- term:
  - 'button "Mitigation: Need 1.0% pen to ignore all mitigation"': Mitigation
- definition: 1.0%
- term: Props on map
- definition: "50"
- term: Avg prop HP
- definition: "68"
- term: Est. total map HP
- definition: 3,419
- term:
  - 'button "Boss / cage HP: ×10 stone — shared 2×2 pool"': Boss / cage HP
- definition: "530"
- term: Gate timer
- definition: —
- term: Key consumed
- definition: —
- heading "Economy" [level=2]
- term: Item drops
- definition: Level 10 items
- term: XP per prop
- definition: "18.0"
- term: Gold (Comum, wiki)
- definition: "1"
- term:
  - 'button "Gold (Comum, yours): Wiki × (1 + team coin % on Account)"': Gold (Comum, yours)
- definition: "1"
- term: Avg gold / prop (wiki)
- definition: "2"
- term: Avg gold / prop (yours)
- definition: "2"
- term: Est. map gold (wiki)
- definition: "79"
- term: Est. map gold (yours)
- definition: "101"
- heading "Cage (hero clock)" [level=2]
- term:
  - 'button "Early cap at this phase: Climbs from 0 to cap over the play window"': Early cap at this phase
- definition: 5.0%
- term: Guarantee window
- definition: 3h 30m
- term: Cage HP
- definition: "530"
- term: Hero chest odds
- definition: Comum 90.0% Incomum 9.9% Raro 0.1%
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
    - row "Bush 29 20.0% 1 1":
      - cell "Bush"
      - cell "29"
      - cell "20.0%"
      - cell "1"
      - cell "1"
    - row "Stone 53 27.5% 1 2":
      - cell "Stone"
      - cell "53"
      - cell "27.5%"
      - cell "1"
      - cell "2"
    - row "Box 42 15.0% 1 1":
      - cell "Box"
      - cell "42"
      - cell "15.0%"
      - cell "1"
      - cell "1"
    - row "Copper Mine 77 10.0% 2 2":
      - cell "Copper Mine"
      - cell "77"
      - cell "10.0%"
      - cell "2"
      - cell "2"
    - row "Iron Mine 95 7.5% 2 3":
      - cell "Iron Mine"
      - cell "95"
      - cell "7.5%"
      - cell "2"
      - cell "3"
    - row "Gold Ore 117 5.0% 2 3":
      - cell "Gold Ore"
      - cell "117"
      - cell "5.0%"
      - cell "2"
      - cell "3"
    - row "Mithril Ore 148 3.8% 3 4":
      - cell "Mithril Ore"
      - cell "148"
      - cell "3.8%"
      - cell "3"
      - cell "4"
    - row "Blue Crystal 127 5.0% 2 3":
      - cell "Blue Crystal"
      - cell "127"
      - cell "5.0%"
      - cell "2"
      - cell "3"
    - row "Ruby Crystal 127 3.8% 2 3":
      - cell "Ruby Crystal"
      - cell "127"
      - cell "3.8%"
      - cell "2"
      - cell "3"
    - row "Purple Crystal 170 2.5% 3 4":
      - cell "Purple Crystal"
      - cell "170"
      - cell "2.5%"
      - cell "3"
      - cell "4"
- heading "Your hero" [level=2]
- paragraph: Uses your Account settings and each hero’s geared sheet + points.
- button "Switch hero":
  - img "Bellatrix"
  - text: B
  - paragraph: Bellatrix
  - text: Rare L42
- term: Penetration vs phase
- definition: Fully piercing
- term: Avg hit (this build)
- definition: 2,115
- table:
  - rowgroup:
    - row "Target prop HP Hits":
      - columnheader "Target prop"
      - columnheader "HP"
      - columnheader "Hits"
  - rowgroup:
    - row "Bush 29 1":
      - cell "Bush"
      - cell "29"
      - cell "1"
    - row "Stone 53 1":
      - cell "Stone"
      - cell "53"
      - cell "1"
    - row "Box 42 1":
      - cell "Box"
      - cell "42"
      - cell "1"
    - row "Copper Mine 77 1":
      - cell "Copper Mine"
      - cell "77"
      - cell "1"
    - row "Iron Mine 95 1":
      - cell "Iron Mine"
      - cell "95"
      - cell "1"
    - row "Gold Ore 117 1":
      - cell "Gold Ore"
      - cell "117"
      - cell "1"
    - row "Mithril Ore 148 1":
      - cell "Mithril Ore"
      - cell "148"
      - cell "1"
    - row "Blue Crystal 127 1":
      - cell "Blue Crystal"
      - cell "127"
      - cell "1"
    - row "Ruby Crystal 127 1":
      - cell "Ruby Crystal"
      - cell "127"
      - cell "1"
    - row "Purple Crystal 170 1":
      - cell "Purple Crystal"
      - cell "170"
      - cell "1"
- heading "Top 3 by solo DPS" [level=2]
- paragraph: Sum of the highest solo sustained-DPS builds in your roster (same Account), up to your casa slot count.
- term: Combined sustained DPS
- definition: "644"
- term:
  - 'button "Est. clear time: Mid-map sustained model — early burst clears faster."': Est. clear time
- definition: 5s
- table:
  - rowgroup:
    - row "# Avatar Name Lv Power Gear Abilities DPS":
      - columnheader "#"
      - columnheader "Avatar"
      - columnheader "Name"
      - columnheader "Lv"
      - columnheader "Power"
      - columnheader "Gear"
      - columnheader "Abilities"
      - columnheader "DPS"
  - rowgroup:
    - row "Bellatrix":
      - cell "1"
      - cell "Bellatrix":
        - img "Bellatrix"
      - cell "Bellatrix"
      - cell "L42"
      - cell "12,605"
      - cell "Wooden Weapon +8. Lv 10 Uncommon Ember Helm. Lv 10 Uncommon Wooden Ring. Lv 10 Uncommon Wooden Amulet. Lv 10 Uncommon Ember Chest. Lv 10 Uncommon Ember Legs +8. Lv 10 Rare Wooden Gloves +8. Lv 10 Uncommon Ember Boots. Lv 10 Uncommon":
        - button "Wooden Weapon +8. Lv 10 Uncommon"
        - button "Ember Helm. Lv 10 Uncommon"
        - button "Wooden Ring. Lv 10 Uncommon"
        - button "Wooden Amulet. Lv 10 Uncommon"
        - button "Ember Chest. Lv 10 Uncommon"
        - button "Ember Legs +8. Lv 10 Rare"
        - button "Wooden Gloves +8. Lv 10 Uncommon"
        - button "Ember Boots. Lv 10 Uncommon"
      - cell "Mercy, 20/20 Against the Clock, 2/20 Keen Eye, 20/20":
        - button "Mercy, 20/20"
        - button "Against the Clock, 2/20"
        - button "Keen Eye, 20/20"
      - cell "429"
    - row "Jon":
      - cell "2"
      - cell "Jon":
        - img "Jon"
      - cell "Jon"
      - cell "L38"
      - cell "7,879"
      - cell "Forest Weapon +8. Lv 10 Uncommon Wooden Helm. Lv 10 Uncommon Ring — empty Amulet — empty Wooden Chest. Lv 10 Uncommon Legs — empty Ember Gloves +8. Lv 10 Uncommon Boots — empty":
        - button "Forest Weapon +8. Lv 10 Uncommon"
        - button "Wooden Helm. Lv 10 Uncommon"
        - button "Ring — empty"
        - button "Amulet — empty"
        - button "Wooden Chest. Lv 10 Uncommon"
        - button "Legs — empty"
        - button "Ember Gloves +8. Lv 10 Uncommon"
        - button "Boots — empty"
      - cell "Extra Battery, 20/20 Miner's Breath, 18/20":
        - button "Extra Battery, 20/20"
        - button "Miner's Breath, 18/20"
      - cell "207"
    - row "Perrin":
      - cell "3"
      - cell "Perrin":
        - img "Perrin"
      - cell "Perrin"
      - cell "L3"
      - cell "640"
      - cell "Weapon — empty Helm — empty Ring — empty Amulet — empty Chest — empty Legs — empty Gloves — empty Boots — empty":
        - button "Weapon — empty"
        - button "Helm — empty"
        - button "Ring — empty"
        - button "Amulet — empty"
        - button "Chest — empty"
        - button "Legs — empty"
        - button "Gloves — empty"
        - button "Boots — empty"
      - cell "Hero Hunter, 3/20":
        - button "Hero Hunter, 3/20"
      - cell "7"
- contentinfo:
  - paragraph: This is an unofficial, fan-made tool. It is not affiliated with, endorsed by or connected to the BombFarm developers in any way.
  - paragraph:
    - text: Assets are from the official BombFarm wiki.
    - link "wiki.bombfarm.net":
      - /url: https://wiki.bombfarm.net
    - text: .
  - paragraph:
    - text: Referral code
    - code: F-S7999UQC
    - button "Copy referral code"
    - text: — a reward for us both at stage 151.
  - text: v0.0.0-e2e
  - link "Buy me a coffee":
    - /url: https://buymeacoffee.com/lucasfevi
```

# Test source

```ts
  60  |     await seedLocalStorage(page, { heroes: [], lang: 'en' });
  61  |     await page.goto('/farm');
  62  |     await importAccount486(page);
  63  |   });
  64  | 
  65  |   // 1. The callout appears and names a phase in the band; the gain reads as a lower bound.
  66  |   test('the toolbar callout names a recommended phase in 26-28, with a lower-bound gain', async ({ page }) => {
  67  |     await expect(toolbar(page)).toBeVisible();
  68  |     await expect(headline(page)).toContainText(/at least/i);
  69  |     // Scoped to the ONE leaf span carrying the phase — sibling spans in the headline have no
  70  |     // literal whitespace between them in the DOM (only a CSS flex gap), so reading the whole
  71  |     // container's concatenated textContent would run this span's digits into the next span's.
  72  |     const phaseText = await headline(page).getByText(/#\d+/).textContent();
  73  |     const phaseMatch = phaseText?.match(/#(\d+)/);
  74  |     expect(phaseMatch, `no phase number found in "${phaseText}"`).not.toBeNull();
  75  |     const phase = Number(phaseMatch![1]);
  76  |     expect(phase).toBeGreaterThanOrEqual(26);
  77  |     expect(phase).toBeLessThanOrEqual(28);
  78  |   });
  79  | 
  80  |   // 2. Optimize expands the panel IN PLACE — DOM order between the toolbar and the table's
  81  |   // <thead>, never a modal or drawer.
  82  |   test('Optimize expands the panel in place, between the toolbar and the table head, never a dialog', async ({ page }) => {
  83  |     await optimizeButton(page).click();
  84  |     await expect(panel(page)).toBeVisible();
  85  | 
  86  |     const order = await page.evaluate(() => {
  87  |       const toolbarEl = document.querySelector('[data-testid="farm-respec-toolbar"]');
  88  |       const panelEl = document.querySelector('[data-testid="farm-respec-panel"]');
  89  |       const theadEl = document.querySelector('[data-testid="farm-ranking-table"] thead');
  90  |       if (!toolbarEl || !panelEl || !theadEl) return null;
  91  |       const toolbarBeforePanel = Boolean(
  92  |         toolbarEl.compareDocumentPosition(panelEl) & Node.DOCUMENT_POSITION_FOLLOWING,
  93  |       );
  94  |       const panelBeforeThead = Boolean(
  95  |         panelEl.compareDocumentPosition(theadEl) & Node.DOCUMENT_POSITION_FOLLOWING,
  96  |       );
  97  |       return { toolbarBeforePanel, panelBeforeThead };
  98  |     });
  99  |     expect(order).toEqual({ toolbarBeforePanel: true, panelBeforeThead: true });
  100 | 
  101 |     expect(await page.locator('[role="dialog"]:visible').count()).toBe(0);
  102 |   });
  103 | 
  104 |   // 3. The split is executable: every enabled hero has a card, at least one is the unchanged
  105 |   // variant naming gold not spent, a changed hero's card has eight key rows, the luck row reads
  106 |   // the keep wording, and nothing reads optional/negligible/skip.
  107 |   test('every enabled hero has a card; changed heroes show all eight keys with luck kept; unchanged heroes name the gold not spent', async ({ page }) => {
  108 |     await optimizeButton(page).click();
  109 |     await expect(panel(page)).toBeVisible();
  110 |     await expect(heroGrid(page)).toBeVisible();
  111 | 
  112 |     const cardCount = await heroGrid(page).locator('[data-testid^="farm-respec-hero-"]').count();
  113 |     expect(cardCount).toBe(5); // the committed fixture's five heroes
  114 | 
  115 |     const keyRows = heroGrid(page).locator('[data-testid^="farm-respec-key-"]');
  116 |     const changedCardKeyCount = await keyRows.count();
  117 |     expect(changedCardKeyCount).toBeGreaterThan(0);
  118 |     expect(changedCardKeyCount % 8).toBe(0); // every changed card contributes exactly 8 rows
  119 | 
  120 |     await expect(heroGrid(page).getByText('Keep', { exact: true }).first()).toBeVisible();
  121 |     await expect(heroGrid(page).getByText(/no respec needed/i).first()).toBeVisible();
  122 | 
  123 |     const panelText = (await panel(page).textContent()) ?? '';
  124 |     expect(panelText).not.toMatch(/optional|negligible|\bskip(pable)?\b/i);
  125 |   });
  126 | 
  127 |   // 4. Cards wrap onto further rows; never an accordion, tab list or horizontal scroller.
  128 |   test('hero cards wrap onto further rows at 1280px width, never collapsing into tabs or a scroller', async ({ page }) => {
  129 |     await optimizeButton(page).click();
  130 |     await expect(heroGrid(page)).toBeVisible();
  131 | 
  132 |     const cards = heroGrid(page).locator('[data-testid^="farm-respec-hero-"]');
  133 |     const count = await cards.count();
  134 |     expect(count).toBeGreaterThan(1);
  135 |     const boxes = await Promise.all(
  136 |       Array.from({ length: count }, (_unused, index) => cards.nth(index).boundingBox()),
  137 |     );
  138 |     const tops = new Set(boxes.map((box) => box?.y));
  139 |     expect(tops.size, 'expected cards on more than one row').toBeGreaterThan(1);
  140 | 
  141 |     // Scoped to the hero grid — the page may legitimately have an unrelated tablist elsewhere
  142 |     // (e.g. shell chrome); the requirement here is that this grid never becomes one.
  143 |     expect(await heroGrid(page).locator('[role="tablist"]').count()).toBe(0);
  144 |     const gridOverflowX = await heroGrid(page).evaluate((element) => getComputedStyle(element).overflowX);
  145 |     expect(gridOverflowX).not.toBe('scroll');
  146 |     expect(gridOverflowX).not.toBe('auto');
  147 |   });
  148 | 
  149 |   // 5. Re-rank moves the top-ranked phase into the 26-28 band, closes the panel, and marks the
  150 |   // table as showing the proposed build.
  151 |   test('re-rank moves the top-ranked phase into 26-28, closes the panel, and marks the table', async ({ page }) => {
  152 |     const beforePhase = await firstRowPhase(page);
  153 | 
  154 |     await optimizeButton(page).click();
  155 |     await expect(panel(page)).toBeVisible();
  156 | 
  157 |     await page.getByTestId('farm-respec-rerank').getByRole('switch').click();
  158 |     await expect(panel(page)).toBeHidden();
  159 |     await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'proposed');
> 160 |     await expect(page.getByTestId('farm-respec-rerank-banner')).toBeVisible();
      |                                                                 ^ Error: expect(locator).toBeVisible() failed
  161 | 
  162 |     const afterPhase = await firstRowPhase(page);
  163 |     expect(afterPhase).not.toBe(beforePhase);
  164 |     expect(afterPhase).toBeGreaterThanOrEqual(26);
  165 |     expect(afterPhase).toBeLessThanOrEqual(28);
  166 |   });
  167 | 
  168 |   // 6. Invalidation: with re-rank on, changing an input reverts everything — no stale figure.
  169 |   test('changing a rotation-pool input while re-ranked reverts the panel and the table, with no stale gain figure left on screen', async ({ page }) => {
  170 |     await optimizeButton(page).click();
  171 |     await expect(panel(page)).toBeVisible();
  172 |     const oldGainText = (await headline(page).textContent()) ?? '';
  173 | 
  174 |     await page.getByTestId('farm-respec-rerank').getByRole('switch').click();
  175 |     await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'proposed');
  176 | 
  177 |     // Toggle a rotation-pool hero — an input the respec proposal is keyed on.
  178 |     const firstPoolSwitch = page.locator('[data-testid^="farm-pool-hero-"]').first().getByRole('switch');
  179 |     await firstPoolSwitch.click();
  180 | 
  181 |     await expect(panel(page)).toBeHidden();
  182 |     await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'current');
  183 |     if (oldGainText.trim() !== '') {
  184 |       await expect(page.getByText(oldGainText, { exact: true })).toHaveCount(0);
  185 |     }
  186 |   });
  187 | 
  188 |   // 7. The objective picker re-solves and persists across a reload.
  189 |   test('selecting the chests objective re-solves and shows the explainer; the selection survives a reload', async ({ page }) => {
  190 |     const objectiveSelect = toolbar(page).getByLabel(/^Objective$/i);
  191 |     await objectiveSelect.click();
  192 |     // Anchored to the start — "Balanced" also contains the word "chests" in its own label.
  193 |     await page.getByRole('option', { name: /^Chests \/ hr/i }).click();
  194 | 
  195 |     await optimizeButton(page).click();
  196 |     await expect(panel(page)).toBeVisible();
  197 |     await expect(page.getByTestId('farm-respec-chest-explainer')).toBeVisible();
  198 | 
  199 |     const captured = await captureSeededState(page, 'en');
  200 |     expect(captured.phasesView?.farmObjective).toBe('chests');
  201 | 
  202 |     await seedLocalStorage(page, captured);
  203 |     await page.goto('/farm');
  204 | 
  205 |     await expect(toolbar(page).getByLabel(/^Objective$/i)).toContainText(/Chests/i);
  206 |     const stored = await page.evaluate(() => {
  207 |       const raw = localStorage.getItem('bf-hp-phases-view-v1');
  208 |       return raw ? (JSON.parse(raw) as { farmObjective?: string }) : null;
  209 |     });
  210 |     expect(stored?.farmObjective).toBe('chests');
  211 |   });
  212 | 
  213 |   // 8. PT — the toolbar, panel and tiles render in Portuguese, no EN leakage.
  214 |   test('renders in Portuguese with no EN leakage in the toolbar or panel', async ({ page }) => {
  215 |     const captured = await captureSeededState(page, 'pt');
  216 |     await seedLocalStorage(page, captured);
  217 |     await page.goto('/farm');
  218 | 
  219 |     await expect(toolbar(page)).toContainText(/pelo menos/i);
  220 |     await optimizeButton(page).click();
  221 |     await expect(panel(page)).toBeVisible();
  222 |     await expect(panel(page).getByText('Ouro / h', { exact: true })).toBeVisible();
  223 | 
  224 |     const toolbarText = (await toolbar(page).textContent()) ?? '';
  225 |     const panelText = (await panel(page).textContent()) ?? '';
  226 |     expect(toolbarText).not.toMatch(/at least/i);
  227 |     expect(panelText).not.toMatch(/Optimize|Payback|Respec cost/i);
  228 |   });
  229 | 
  230 |   // 9. Keyboard reachability and the busy state.
  231 |   test('Optimize is keyboard-activatable and exposes aria-expanded; the re-rank switch is keyboard-reachable with an accessible name', async ({ page }) => {
  232 |     await optimizeButton(page).focus();
  233 |     await expect(optimizeButton(page)).toBeFocused();
  234 |     await page.keyboard.press('Enter');
  235 |     await expect(panel(page)).toBeVisible();
  236 |     await expect(optimizeButton(page)).toHaveAttribute('aria-expanded', 'true');
  237 | 
  238 |     const rerankSwitch = page.getByTestId('farm-respec-rerank').getByRole('switch');
  239 |     await rerankSwitch.focus();
  240 |     await expect(rerankSwitch).toBeFocused();
  241 |     await expect(page.getByRole('switch', { name: /show ranking under this build/i })).toBeVisible();
  242 |   });
  243 | });
  244 | 
```
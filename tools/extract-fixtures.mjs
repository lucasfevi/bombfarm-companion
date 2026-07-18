import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const researchRoot = path.join(__dirname, '../../bombfarm-research');
const outDir = path.join(__dirname, '../packages/game-data/fixtures');
fs.mkdirSync(outDir, { recursive: true });

const wl = fs
  .readFileSync(
    path.join(researchRoot, 'data/watch-long-20260718/watch-long-2026-07-18T00-15-52-059Z.jsonl'),
    'utf8',
  )
  .split('\n')
  .filter(Boolean);
const s0 = JSON.parse(wl[0]).body;
const s1 = JSON.parse(wl[1]).body;
fs.writeFileSync(path.join(outDir, 'state-push-a.json'), JSON.stringify(s0, null, 2));
fs.writeFileSync(path.join(outDir, 'state-push-b.json'), JSON.stringify(s1, null, 2));

const traffic = fs.readFileSync(
  path.join(researchRoot, 'data/api-traffic-20260717-211637.jsonl'),
  'utf8',
);
const lines = traffic.split('\n').filter(Boolean);
const invLine = lines.find((l) => l.includes('"bag_tabs"') && l.includes('"items"'));
if (invLine) {
  const inv = JSON.parse(invLine).body;
  inv.items = inv.items.slice(0, 4);
  fs.writeFileSync(path.join(outDir, 'inventory-bag-v2.json'), JSON.stringify(inv, null, 2));
}

fs.writeFileSync(
  path.join(outDir, 'garbage-format-string.json'),
  JSON.stringify({ itemid: '%llu', itemdefid: '%llu', item_tags: '%s', quantity: 1 }, null, 2),
);

const heroLine = lines.find((l) => l.includes('"cooldown_reduction"'));
if (heroLine) {
  fs.writeFileSync(path.join(outDir, 'hero-record.json'), JSON.stringify(JSON.parse(heroLine).body, null, 2));
}

const energyLine = lines.find((l) => l.includes('"energia_atual"'));
if (energyLine) {
  fs.writeFileSync(path.join(outDir, 'hero-energy.json'), JSON.stringify(JSON.parse(energyLine).body, null, 2));
}

console.log('fixtures:', fs.readdirSync(outDir));

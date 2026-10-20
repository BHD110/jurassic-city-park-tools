import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { worldReader } from '../verification/city-world-reader.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = process.argv[2] || path.join(root, 'backups', 'before-road-clearance-20261018-105607', 'world');
const output = path.join(root, 'map', 'generated', 'clear-coaster-supports.json');
const coaster = JSON.parse(await readFile(path.join(root, 'map', 'generated', 'city-coaster-route.json')));
const full = JSON.parse(await readFile(path.join(root, 'map', 'generated', 'upgrade-full.json')));
const points = coaster.route.points;
const buildings = full.metadata.buildings || [];
const reader = worldReader(world);
const protectedCells = new Set();
const key = (x, y, z) => `${x},${y},${z}`;
for (const point of points) {
  protectedCells.add(key(point.x, point.y, point.z));
  protectedCells.add(key(point.x, point.y - 1, point.z));
}

const operations = [];
const stats = { candidatePillars: 0, removedPillars: 0, removedBlocks: 0, protectedTrackAndDeck: protectedCells.size, protectedCellsSkipped: 0, stationCellsSkipped: 0, buildingCellsSkipped: 0, otherMaterialSkipped: 0 };
const seen = new Set();
const station = (x, z) => x >= -15 && x <= 15 && z >= 635 && z <= 675;
const buildingAt = (x, y, z) => buildings.some(({ bounds: b }) => x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2 && z >= b.z1 && z <= b.z2);

for (let i = 0; i < points.length; i += 1) {
  const p = points[i];
  if (p.y < 70 || i % 12 !== 0 || (p.x === 0 && p.z === 650)) continue;
  const column = `${p.x},${p.z}`;
  if (seen.has(column)) continue;
  seen.add(column);
  stats.candidatePillars += 1;
  let start = null;
  let end = null;
  const flush = () => {
    if (start === null) return;
    operations.push({ kind: 'box', x1: p.x, y1: start, z1: p.z, x2: p.x, y2: end, z2: p.z, block: 'minecraft:air', replace: 'minecraft:stone_bricks' });
    stats.removedBlocks += end - start + 1;
    start = end = null;
  };
  let removed = false;
  for (let y = 64; y <= p.y - 2; y += 1) {
    let safe = false;
    if (protectedCells.has(key(p.x, y, p.z))) stats.protectedCellsSkipped += 1;
    else if (station(p.x, p.z)) stats.stationCellsSkipped += 1;
    else if (buildingAt(p.x, y, p.z)) stats.buildingCellsSkipped += 1;
    else {
      const actual = await reader.block(p.x, y, p.z);
      if (actual?.Name === 'minecraft:stone_bricks') safe = true;
      else stats.otherMaterialSkipped += 1;
    }
    if (safe) {
      if (start === null) start = y;
      end = y;
      removed = true;
    } else flush();
  }
  flush();
  if (removed) stats.removedPillars += 1;
}

const plan = {
  name: 'Remove verified coaster piers below the deck',
  sourceWorld: world,
  protected: ['all 8488 rail cells', 'all 8488 direct track deck cells, including powered redstone', 'station x=-15..15 z=635..675', 'all metadata building bounds'],
  stats,
  operations,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(plan));
console.log(JSON.stringify({ output, stats }));

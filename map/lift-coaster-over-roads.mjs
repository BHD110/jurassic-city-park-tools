import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = path.join(root, 'map', 'generated');
const coasterFile = path.join(generated, 'city-coaster-route.json');
const fullFile = path.join(generated, 'upgrade-full.json');
const trafficFile = path.join(generated, 'iv-traffic.json');
const outputFile = path.join(generated, 'lift-coaster-over-roads.json');
const clearFile = path.join(generated, 'clear-coaster-supports.json');
const [coaster, full, traffic, clearSupports] = await Promise.all([coasterFile, fullFile, trafficFile, clearFile].map(async file => JSON.parse(await readFile(file))));
const old = coaster.route.points;
const n = old.length;
const xz = (x, z) => `${x},${z}`;
const corridor = new Set();
for (const route of traffic.routes) {
  const radius = /^(outer_perimeter|station_road_)/.test(route.id) ? 4 : 3;
  for (let i = 0; i < route.points.length; i += 1) {
    const a = route.points[i], b = route.points[(i + 1) % route.points.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 2));
    for (let s = 0; s <= steps; s += 1) {
      const x = Math.floor(a.x + (b.x - a.x) * s / steps);
      const z = Math.floor(a.z + (b.z - a.z) * s / steps);
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) corridor.add(xz(x + dx, z + dz));
      }
    }
  }
}

const required = new Map();
for (let i = 0; i < n; i += 1) {
  const p = old[i];
  if (p.y < 70 && corridor.has(xz(p.x, p.z))) required.set(i, 70);
}
const heights = old.map(p => p.y);
function raiseCone(index, height) {
  for (let d = -16; d <= 16; d += 1) {
    const j = (index + d + n) % n;
    heights[j] = Math.max(heights[j], height - Math.abs(d));
  }
}
for (const [index, height] of required) raiseCone(index, height);
const turnAt = i => {
  const p = old[i], a = old[(i - 1 + n) % n], b = old[(i + 1) % n];
  return !((a.x === p.x && b.x === p.x) || (a.z === p.z && b.z === p.z));
};
for (let pass = 0; pass < 20; pass += 1) {
  let changed = false;
  for (let i = 0; i < n; i += 1) {
    const prev = (i - 1 + n) % n, next = (i + 1) % n;
    if (turnAt(i) && (heights[i] !== heights[prev] || heights[i] !== heights[next])) {
      const height = Math.max(heights[i], heights[prev], heights[next]);
      for (const j of [prev, i, next]) if (heights[j] < height) { raiseCone(j, height); changed = true; }
    }
    if (heights[i] < heights[prev] && heights[i] < heights[next]) {
      raiseCone(i, Math.min(heights[prev], heights[next]));
      changed = true;
    }
  }
  if (!changed) break;
  if (pass === 19) throw new Error('Could not smooth lifted route');
}
if (heights[0] !== 64) throw new Error('Station elevation changed');

function dir(a, b) {
  if (b.x > a.x) return 'east';
  if (b.x < a.x) return 'west';
  if (b.z > a.z) return 'south';
  return 'north';
}
function shapeAt(i) {
  const p = old[i], a = old[(i - 1 + n) % n], b = old[(i + 1) % n];
  const higher = [a, b].filter((_, index) => heights[index === 0 ? (i - 1 + n) % n : (i + 1) % n] > heights[i]);
  if (higher.length === 1) return `ascending_${dir(p, higher[0])}`;
  const directions = [dir(p, a), dir(p, b)].sort().join('_');
  return ({ east_west: 'east_west', north_south: 'north_south', east_north: 'north_east', east_south: 'south_east', north_west: 'north_west', south_west: 'south_west' })[directions];
}
const points = old.map((p, i) => ({ ...p, y: heights[i], shape: shapeAt(i) }));
const errors = [];
for (let i = 0; i < n; i += 1) {
  const prev = (i - 1 + n) % n, next = (i + 1) % n;
  if (Math.abs(heights[i] - heights[next]) > 1) errors.push(`steep ${i}`);
  if (heights[prev] > heights[i] && heights[next] > heights[i]) errors.push(`valley ${i}`);
  if (turnAt(i) && (heights[i] !== heights[prev] || heights[i] !== heights[next])) errors.push(`turn slope ${i}`);
  if (corridor.has(xz(points[i].x, points[i].z)) && points[i].y < 70 && required.has(i)) errors.push(`low road deck ${i}`);
}
if (errors.length) throw new Error(errors.slice(0, 20).join(', '));

const changed = points.map((p, i) => i).filter(i => points[i].y !== old[i].y || points[i].shape !== old[i].shape);
const op = (p, y, block, replace) => ({ kind: 'box', x1: p.x, y1: y, z1: p.z, x2: p.x, y2: y, z2: p.z, block, ...(replace ? { replace } : {}) });
const operations = [];
for (const i of changed) operations.push(op(old[i], old[i].y, 'minecraft:air', old[i].powered ? 'minecraft:powered_rail' : 'minecraft:rail'));
for (const i of changed) operations.push(op(old[i], old[i].y - 1, 'minecraft:air', old[i].powered ? 'minecraft:redstone_block' : 'minecraft:stone_bricks'));
for (const i of changed) {
  if (old[i].y !== 64) continue;
  const p = old[i];
  operations.push(op(p, 63, corridor.has(xz(p.x, p.z)) ? 'minecraft:gray_concrete' : 'minecraft:grass_block'));
}
for (const i of changed) operations.push(op(points[i], points[i].y - 1, points[i].powered ? 'minecraft:redstone_block' : 'minecraft:stone_bricks'));
for (const i of changed) {
  const p = points[i];
  const rail = p.powered ? 'minecraft:powered_rail' : 'minecraft:rail';
  operations.push(op(p, p.y, `${rail}[shape=${p.shape}${p.powered ? ',powered=true' : ''}]`));
}
const stats = { trafficRoutes: traffic.routes.length, corridorColumns: corridor.size, requiredRailCells: required.size, changedRailCells: changed.length, minDeckAtRoad: Math.min(...[...required.keys()].map(i => points[i].y - 1)), station: points[0], errors: errors.length };
const plan = { name: 'Lift coaster above vehicle corridors', applyAfter: 'clear-coaster-supports.json', stats, operations };
await writeFile(outputFile, JSON.stringify(plan));
coaster.route.points = points;
coaster.route.length = points.length;
coaster.operations.push(...clearSupports.operations, ...operations);
coaster.metadata.roadLift = stats;
full.route.points = points;
full.route.length = points.length;
full.operations.push(...clearSupports.operations, ...operations);
full.metadata.roadLift = stats;
await Promise.all([writeFile(coasterFile, JSON.stringify(coaster)), writeFile(fullFile, JSON.stringify(full))]);
console.log(JSON.stringify({ output: outputFile, stats, operations: operations.length }));

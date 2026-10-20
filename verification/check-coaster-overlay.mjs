#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = process.argv.slice(2);
if (!names.length || names.some(n => !/^[a-zA-Z0-9_-]{1,64}$/.test(n))) {
  throw new Error('Usage: node verification/check-coaster-overlay.mjs <applied-patch>...');
}
const route = JSON.parse(await readFile(path.join(root, 'map/generated/city-coaster-route.json'))).route;
const oldRoute = JSON.parse(await readFile(path.join(root, 'map/generated/route.json')));
const oldCells = new Map(oldRoute.points.map((p, i) => [`${p.x},${p.z}`, { ...p, i }]));
const bucket = 32;
const buckets = new Map();
const sources = [];
for (const name of names) {
  const bytes = await readFile(path.join(root, 'map/generated', `${name}.json`));
  const plan = JSON.parse(bytes);
  sources.push({ name, sha256: createHash('sha256').update(bytes).digest('hex'), operations: plan.operations?.length || 0 });
  for (const op of plan.operations || []) {
    if (op.kind !== 'box' && op.kind !== 'sign') continue;
    const b = op.kind === 'sign'
      ? { x1: op.x, x2: op.x, y1: op.y, y2: op.y, z1: op.z, z2: op.z, block: op.block || 'minecraft:oak_wall_sign' }
      : { x1: Math.min(op.x1, op.x2), x2: Math.max(op.x1, op.x2), y1: Math.min(op.y1, op.y2), y2: Math.max(op.y1, op.y2), z1: Math.min(op.z1, op.z2), z2: Math.max(op.z1, op.z2), block: op.block };
    for (let x = Math.floor(b.x1 / bucket); x <= Math.floor(b.x2 / bucket); x += 1) {
      for (let z = Math.floor(b.z1 / bucket); z <= Math.floor(b.z2 / bucket); z += 1) {
        const k = `${x},${z}`;
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push({ ...b, source: name });
      }
    }
  }
}

function finalAt(x, y, z) {
  const boxes = buckets.get(`${Math.floor(x / bucket)},${Math.floor(z / bucket)}`) || [];
  for (let i = boxes.length - 1; i >= 0; i -= 1) {
    const b = boxes[i];
    if (x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2 && z >= b.z1 && z <= b.z2) return b;
  }
  return null;
}

const gateCells = [
  [337, 343, -592], [337, 343, 592], [-353, -347, 592], [-313, -307, -592],
];
const collisions = [];
let touched = 0;
for (const p of route.points) {
  const cells = new Set();
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) {
    for (let y = p.y; y <= p.y + 3; y += 1) cells.add(`${p.x + dx},${y},${p.z + dz}`);
  }
  if (p.y > 64) for (let y = 64; y < p.y; y += 1) cells.add(`${p.x},${y},${p.z}`);
  for (const cell of cells) {
    const [x, y, z] = cell.split(',').map(Number);
    const b = finalAt(x, y, z);
    if (!b || b.block === 'minecraft:air') continue;
    touched += 1;
    const old = oldCells.get(`${x},${z}`);
    const replaceableOld = old && (y === old.y && /^minecraft:(?:powered_rail|rail)\[/.test(b.block)
      || y >= old.y - 2 && y <= old.y - 1 && ['minecraft:stone_bricks', 'minecraft:redstone_block'].includes(b.block)
      || old.y > 68 && old.i % 12 === 0 && y >= 64 && y <= old.y - 3 && b.block === 'minecraft:polished_andesite');
    const gate = gateCells.some(([x1, x2, gz]) => x >= x1 && x <= x2 && z === gz && y >= 64 && y <= 74);
    if (!replaceableOld && !gate && collisions.length < 100) collisions.push({ rail: `${p.x},${p.y},${p.z}`, at: cell, block: b.block, source: b.source });
  }
}
const report = { routePoints: route.points.length, sources, touchedSolidCells: touched, collisionCount: collisions.length, collisionCountCappedAt100: collisions.length === 100, collisions, status: collisions.length ? 'failed' : 'passed' };
await writeFile(path.join(root, 'verification', 'coaster-overlay-check.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, routePoints: report.routePoints, touchedSolidCells: touched, collisionCount: collisions.length, collisions: collisions.slice(0, 8) }, null, 2));
if (collisions.length) process.exitCode = 1;

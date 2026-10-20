import { readFile, writeFile } from 'node:fs/promises';

const generated = new URL('./generated/', import.meta.url);
const full = JSON.parse(await readFile(new URL('full.json', generated), 'utf8'));
const route = JSON.parse(await readFile(new URL('route.json', generated), 'utf8'));
const boxes = full.operations.filter(op => op.kind === 'box');

function plannedBlock(x, y, z) {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const op = boxes[i];
    if (x >= Math.min(op.x1, op.x2) && x <= Math.max(op.x1, op.x2)
      && y >= Math.min(op.y1, op.y2) && y <= Math.max(op.y1, op.y2)
      && z >= Math.min(op.z1, op.z2) && z <= Math.max(op.z1, op.z2)) return op.block;
  }
  throw new Error(`No planned support at ${x},${y},${z}`);
}

const operations = [];
function setBlock(x, y, z, block) {
  operations.push({ kind: 'box', x1: x, y1: y, z1: z, x2: x, y2: y, z2: z, block });
}

for (const point of route.points) {
  setBlock(point.x, point.y - 1, point.z, plannedBlock(point.x, point.y - 1, point.z));
  setBlock(point.x, point.y + 1, point.z, 'minecraft:air');
  setBlock(point.x, point.y + 2, point.z, 'minecraft:air');
}
for (const point of route.points) {
  const id = point.powered ? 'minecraft:powered_rail' : 'minecraft:rail';
  const state = `${id}[shape=${point.shape}${point.powered ? ',powered=true' : ''}]`;
  setBlock(point.x, point.y, point.z, state);
}

const plan = {
  name: 'Jurassic City Park Rail Repair',
  source: 'full.json and route.json',
  bounds: full.bounds,
  operations,
};
await writeFile(new URL('rail-repair.json', generated), `${JSON.stringify(plan, null, 2)}\n`);
console.log(`rail-repair: ${route.points.length} rails, ${operations.length} operations`);

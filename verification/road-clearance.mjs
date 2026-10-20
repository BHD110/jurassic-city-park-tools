import {readFile, writeFile} from 'node:fs/promises';
import {worldReader} from './city-world-reader.mjs';

const world = process.argv[2] || 'runtime/server/jurassic-city-v2';
const suffix = process.argv[3] || 'before';
const plan = JSON.parse(await readFile('map/generated/iv-traffic.json', 'utf8'));
const reader = worldReader(world);
const columns = new Map();
// A five-block swept corridor includes body width and modest steering error.
for (const route of plan.routes) for (let i = 0; i < route.points.length; i++) {
  const a = route.points[i], b = route.points[(i + 1) % route.points.length];
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) * 2);
  for (let n = 0; n <= steps; n++) {
    const x = Math.floor(a.x + (b.x - a.x) * n / steps);
    const z = Math.floor(a.z + (b.z - a.z) * n / steps);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const key = `${x + dx},${z + dz}`;
      if (!columns.has(key)) columns.set(key, {x: x + dx, z: z + dz, route: route.id});
    }
  }
}
const passable = /:(air|cave_air|void_air|light|rail|powered_rail|short_grass|tall_grass|fern|large_fern|dead_bush|dandelion|poppy)$/;
const obstacles = [], materials = {}, unsupported = [];
for (const column of columns.values()) {
  const ground = await reader.block(column.x, 63, column.z);
  if (!ground || passable.test(ground.Name)) unsupported.push(column);
  for (let y = 64; y <= 68; y++) {
    const block = await reader.block(column.x, y, column.z);
    if (!block || passable.test(block.Name)) continue;
    obstacles.push({...column, y, block: block.Name});
    materials[block.Name] = (materials[block.Name] || 0) + 1;
  }
}
const report = {world, columns: columns.size, obstacleCount: obstacles.length,
  materials, unsupported, obstacles};
await writeFile(`verification/road-clearance-${suffix}.json`, JSON.stringify(report));
console.log(JSON.stringify({columns: columns.size, obstacles: obstacles.length, materials,
  unsupported: unsupported.length, examples: obstacles.slice(0, 15)}));

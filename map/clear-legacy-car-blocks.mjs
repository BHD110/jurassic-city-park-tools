import { writeFile } from 'node:fs/promises';

const operations = [];
for (const x of [-780, 780]) for (const z of [-505, -325, -145, 145, 325, 505]) {
  operations.push({ kind: 'box', x1: x - 3, x2: x + 3, y1: 64, y2: 68,
    z1: z - 5, z2: z + 5, block: 'minecraft:air' });
}
const plan = { name: 'Remove twelve legacy block vehicles obstructing arterial lanes',
  bounds: { x1: -784, x2: 784, z1: -511, z2: 511 }, operations };
await writeFile('map/generated/clear-legacy-road-cars.json', JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({ oldBlockCars: operations.length }));

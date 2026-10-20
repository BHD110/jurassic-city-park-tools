import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sample = JSON.parse(await readFile(path.join(root, 'map/generated/architecture-sample-12.json'), 'utf8'));
const operations = sample.operations.filter(op => op.kind === 'box' && op.block === 'minecraft:bricks' && op.y1 === op.y2 && [79, 82, 85].includes(op.y1) && op.x1 <= -840 && op.x2 >= -900 && op.z1 >= 697 && op.z2 <= 734 && op.z2 - op.z1 >= 27);
if (operations.length !== 3 || operations.some((op, i) => op.y1 !== 79 + i * 3)) throw Error('city-09 roof panels changed unexpectedly');
const plan = { name: 'City 09 Roof Closure', bounds: sample.bounds, operations, metadata: { buildingId: 'city-09', purpose: 'close three sawtooth roof bays in built sample' } };
await writeFile(path.join(root, 'map/generated/city09-roof-fix.json'), JSON.stringify(plan));
console.log(JSON.stringify({ operations: operations.length }));

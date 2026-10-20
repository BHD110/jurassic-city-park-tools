import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { addInteriorLighting } from './interior-lighting.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = path.join(root, 'map', 'generated');
const fullPath = path.join(generated, 'full.json');
const fullBytes = await readFile(fullPath);
const fullHash = createHash('sha256').update(fullBytes).digest('hex');
const full = JSON.parse(fullBytes.toString('utf8'));
const start = full.operations.length;
const report = { baseFull: path.basename(fullPath), baseFullSha256: fullHash, ...addInteriorLighting(full) };
const operations = full.operations.slice(start);
const fossilLights = operations.filter(op => Math.abs(op.x1) === 7 && op.z1 >= 418 && op.z1 <= 466);
if (fossilLights.length !== 14) throw new Error(`Expected 14 new fossil hall lamps, got ${fossilLights.length}`);

await writeFile(path.join(generated, 'lighting-patch-precheck.json'), JSON.stringify(report, null, 2));
await writeFile(path.join(generated, 'lighting-patch.json'), JSON.stringify({
  name: 'Jurassic City Park Interior Lighting',
  bounds: full.bounds,
  metadata: { baseFullSha256: fullHash, operationCount: operations.length, precheck: report },
  operations
}, null, 2));
await writeFile(path.join(generated, 'lighting-append-patch.json'), JSON.stringify({
  name: 'Jurassic City Park Fossil Hall Lighting',
  bounds: full.bounds,
  metadata: { baseFullSha256: fullHash, requiresInitialLighting: true, operationCount: fossilLights.length },
  operations: fossilLights
}, null, 2));
console.log(JSON.stringify(report, null, 2));

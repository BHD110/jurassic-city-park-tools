#!/usr/bin/env node
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { inflateSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const nbt = require('prismarine-nbt');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [snapshotArg, outputArg, planName = 'full'] = process.argv.slice(2);
if (!snapshotArg || !/^[a-zA-Z0-9_-]{1,64}$/.test(planName)) throw new Error('Usage: node verification/check-coaster-dinosaurs.mjs <saved-world-snapshot> [report-path] [plan-name]');
const snapshot = path.resolve(snapshotArg);
const full = JSON.parse(await readFile(path.join(root, 'map/generated', `${planName}.json`)));
const animals = [];
let entityChunks = 0;
for (const file of await readdir(path.join(snapshot, 'entities'))) {
  if (!/^r\.-?\d+\.-?\d+\.mca$/.test(file)) continue;
  const bytes = await readFile(path.join(snapshot, 'entities', file));
  if (bytes.length < 8192) continue;
  for (let slot = 0; slot < 1024; slot += 1) {
    const sector = bytes.readUIntBE(slot * 4, 3);
    if (!sector) continue;
    const offset = sector * 4096, length = bytes.readUInt32BE(offset);
    if (length < 1 || offset + 4 + length > bytes.length) throw new Error(`bad entity chunk ${file}:${slot}`);
    const compressed = bytes.subarray(offset + 5, offset + 4 + length);
    const type = bytes[offset + 4];
    const raw = type === 2 ? inflateSync(compressed) : type === 1 ? gunzipSync(compressed) : type === 3 ? compressed : null;
    if (!raw) throw new Error(`unsupported entity compression ${type}`);
    const chunk = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
    entityChunks += 1;
    animals.push(...(chunk.Entities || []).filter(e => e.id?.startsWith('jurassicreborn:')));
  }
}
const zones = full.metadata.enclosures.map(zone => {
  const matching = animals.filter(e => e.id === zone.species[0]);
  const within = matching.filter(e => e.Pos[0] > zone.bounds.x1 && e.Pos[0] < zone.bounds.x2
    && e.Pos[2] > zone.bounds.z1 && e.Pos[2] < zone.bounds.z2);
  return { zone: zone.id, expected: zone.count, found: matching.length, withinFence: within.length,
    alive: matching.filter(e => e.Health > 0 && e.DeathTime === 0).length };
});
const report = { snapshot, entityChunks, total: animals.length, zones,
  status: animals.length === full.metadata.expectedDinosaurCount && zones.every(z => z.found === z.expected && z.withinFence === z.expected && z.alive === z.expected) ? 'passed' : 'failed' };
await writeFile(outputArg ? path.resolve(outputArg) : path.join(root, 'verification/coaster-dinosaur-check.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'passed') process.exitCode = 1;

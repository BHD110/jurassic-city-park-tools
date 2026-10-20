import { readFile, readdir, writeFile } from 'node:fs/promises';
import { inflateSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';

const world = process.argv[2];
if (!world) throw new Error('Pass world path');
const plan = JSON.parse(await readFile('map/generated/city-pedestrians-radius-30.json', 'utf8'));
const dinoPlan = JSON.parse(await readFile('map/generated/dinosaur-fourfold.json', 'utf8'));
const enclosures = plan.report.enclosures.bounds;
const dinoZones = new Map(Object.entries(dinoPlan.metadata.counts).map(([id, count]) => [`jurassicreborn:${id}`, count.total]));
const counts = {}, uuids = new Set();
let npc = 0, dino = 0, insideNpc = 0, wrongRadius = 0, duplicateUuid = 0, outsideDino = 0, badSlots = 0;
for (const name of await readdir(path.join(world, 'entities'))) {
  if (!/^r\.-?\d+\.-?\d+\.mca$/.test(name)) continue;
  const bytes = await readFile(path.join(world, 'entities', name));
  if (!bytes.length) continue;
  for (let slot = 0; slot < 1024; slot++) {
    const sector = bytes.readUIntBE(slot * 4, 3);
    if (!sector) continue;
    const offset = sector * 4096, size = bytes.readUInt32BE(offset);
    if (!size) { badSlots++; continue; }
    const compression = bytes[offset + 4], payload = bytes.subarray(offset + 5, offset + 4 + size);
    const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : payload;
    const tree = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
    for (const entity of tree.Entities || []) {
      if (!entity?.id) continue;
      const key = entity.UUID?.join(',');
      if (key) { if (uuids.has(key)) duplicateUuid++; uuids.add(key); }
      if (entity.id === 'easy_npc:humanoid' && entity.Tags?.includes('city_life_pedestrian')) {
        npc++;
        const [x, , z] = entity.Pos;
        if (enclosures.some(({ bounds: b }) => x >= b.x1 && x <= b.x2 && z >= b.z1 && z <= b.z2)) insideNpc++;
        if (entity.ObjectiveData?.ObjectiveDataSet?.find(goal => goal?.Type === 'MOVE_BACK_TO_HOME')?.StopDistance !== 30) wrongRadius++;
      }
      if (entity.id.startsWith('jurassicreborn:')) {
        dino++;
        counts[entity.id] = (counts[entity.id] || 0) + 1;
        const zone = enclosures.find(z => entity.id.endsWith(z.id))?.bounds;
        const [x, , z] = entity.Pos;
        if (!zone || x <= zone.x1 || x >= zone.x2 || z <= zone.z1 || z >= zone.z2) outsideDino++;
      }
    }
  }
}
const failures = [];
if (npc !== 4372) failures.push(`NPC count ${npc} != 4372`);
if (dino !== 512) failures.push(`Dinosaur count ${dino} != 512`);
for (const [id, expected] of dinoZones) if (counts[id] !== expected) failures.push(`${id}: ${counts[id]} != ${expected}`);
if (insideNpc || wrongRadius || duplicateUuid || outsideDino) failures.push('Location, radius, or UUID error');
const report = { world, npc, dino, species: counts, insideNpc, wrongRadius, duplicateUuid, outsideDino, badSlots, failures, passed: failures.length === 0 };
await writeFile('verification/npc-dino-fourfold.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
process.exitCode = failures.length ? 1 : 0;

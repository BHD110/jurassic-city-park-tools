// Offline edit. Run only while the server is stopped and after backing up the world.
import { readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { inflateSync, gunzipSync, deflateSync } from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';

const world = process.argv[2];
if (!world) throw new Error('Pass a closed world path');
const T = (type, value) => ({ type, value });
let updated = 0;
let changedChunks = 0;
for (const name of await readdir(path.join(world, 'entities'))) {
  if (!/^r\.-?\d+\.-?\d+\.mca$/.test(name)) continue;
  const file = path.join(world, 'entities', name);
  let bytes = await readFile(file);
  if (!bytes.length) continue;
  let changed = false;
  for (let slot = 0; slot < 1024; slot++) {
    const sector = bytes.readUIntBE(slot * 4, 3);
    if (!sector) continue;
    const offset = sector * 4096;
    const size = bytes.readUInt32BE(offset);
    const compression = bytes[offset + 4];
    const payload = bytes.subarray(offset + 5, offset + 4 + size);
    const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : payload;
    const tree = nbt.parseUncompressed(raw, 'big');
    let chunkChanged = false;
    for (const entity of tree.value.Entities?.value.value || []) {
      if (entity.id?.value !== 'easy_npc:humanoid' || !entity.Tags?.value.value.includes('city_life_pedestrian')) continue;
      const goals = entity.ObjectiveData?.value.ObjectiveDataSet?.value.value;
      const home = goals?.find(goal => goal.Type?.value === 'MOVE_BACK_TO_HOME');
      if (!home) throw new Error(`NPC without home objective in ${name} slot ${slot}`);
      home.StopDistance = T('float', 30);
      updated++;
      chunkChanged = true;
    }
    if (!chunkChanged) continue;
    const compressed = deflateSync(nbt.writeUncompressed(tree, 'big'));
    const sectors = Math.ceil((compressed.length + 5) / 4096);
    if (sectors > 255) throw new Error('Entity chunk exceeds region limit');
    const next = Math.ceil(bytes.length / 4096);
    const record = Buffer.alloc(sectors * 4096);
    record.writeUInt32BE(compressed.length + 1);
    record[4] = 2;
    compressed.copy(record, 5);
    bytes = Buffer.concat([bytes, record]);
    bytes.writeUIntBE(next, slot * 4, 3);
    bytes[slot * 4 + 3] = sectors;
    bytes.writeUInt32BE(Math.floor(Date.now() / 1000), 4096 + slot * 4);
    changedChunks++;
    changed = true;
  }
  if (changed) {
    await writeFile(`${file}.tmp`, bytes);
    await rename(`${file}.tmp`, file);
  }
}
console.log(JSON.stringify({ updated, changedChunks, radius: 30 }));

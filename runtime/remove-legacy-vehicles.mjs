// Run only after the server has stopped and a complete backup exists.
import { readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { inflateSync, gunzipSync, deflateSync, gzipSync } from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';

const world = process.argv[2];
if (!world) throw new Error('Pass the stopped world directory');
let removed = 0, chunks = 0;
const removedIds = {};
for (const name of await readdir(path.join(world, 'entities'))) {
  if (!/^r\.-?\d+\.-?\d+\.mca$/.test(name)) continue;
  const file = path.join(world, 'entities', name);
  let bytes = await readFile(file), changed = false;
  if (!bytes.length) continue;
  for (let slot = 0; slot < 1024; slot++) {
    const sector = bytes.readUIntBE(slot * 4, 3);
    if (!sector) continue;
    const offset = sector * 4096, length = bytes.readUInt32BE(offset);
    if (!length) continue;
    const compression = bytes[offset + 4], payload = bytes.subarray(offset + 5, offset + 4 + length);
    const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : compression === 3 ? payload : null;
    if (!raw) throw new Error(`Unsupported compression ${name}:${slot}`);
    const tree = nbt.parseUncompressed(raw, 'big');
    const list = tree.value.Entities?.value.value;
    if (!list) continue;
    const kept = list.filter(entity => {
      const id = entity.id?.value || '';
      const tags = entity.Tags?.value.value || [];
      const legacy = id.startsWith('automobility:') || tags.some(tag => tag === 'city_life_traffic' || tag.startsWith('city_v2_traffic_'));
      if (legacy) { removed++; removedIds[id] = (removedIds[id] || 0) + 1; }
      return !legacy;
    });
    if (kept.length === list.length) continue;
    tree.value.Entities.value.value = kept;
    const compressed = deflateSync(nbt.writeUncompressed(tree, 'big'));
    const sectors = Math.ceil((compressed.length + 5) / 4096), next = Math.ceil(bytes.length / 4096);
    if (sectors > 255) throw new Error('Entity chunk exceeds region format limit');
    const record = Buffer.alloc(sectors * 4096);
    record.writeUInt32BE(compressed.length + 1); record[4] = 2; compressed.copy(record, 5);
    const padded = Buffer.alloc(next * 4096); bytes.copy(padded);
    bytes = Buffer.concat([padded, record]);
    bytes.writeUIntBE(next, slot * 4, 3); bytes[slot * 4 + 3] = sectors;
    bytes.writeUInt32BE(Math.floor(Date.now() / 1000), 4096 + slot * 4);
    changed = true; chunks++;
  }
  if (changed) { await writeFile(file + '.tmp', bytes); await rename(file + '.tmp', file); }
}
const levelFile = path.join(world, 'level.dat');
const level = nbt.parseUncompressed(gunzipSync(await readFile(levelFile)), 'big');
const packs = level.value.Data.value.DataPacks.value;
packs.Enabled.value.value = packs.Enabled.value.value.filter(name => name !== 'file/city-vehicles');
if (!packs.Enabled.value.value.includes('file/city-life-safety')) packs.Enabled.value.value.push('file/city-life-safety');
await writeFile(levelFile + '.tmp', gzipSync(nbt.writeUncompressed(level, 'big')));
await rename(levelFile + '.tmp', levelFile);
console.log(JSON.stringify({ removed, removedIds, chunks, enabledPacks: packs.Enabled.value.value }));

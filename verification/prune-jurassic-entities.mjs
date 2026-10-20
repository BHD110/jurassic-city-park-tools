import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync, gunzipSync, inflateSync } from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nbt = require(process.env.PARK_NBT_PACKAGE || 'D:/codeSource/product/jev/mindcraft-agent-gpt/node_modules/prismarine-nbt');
const world = process.argv[2];
if (!world) throw new Error('Usage: node verification/prune-jurassic-entities.mjs <world>');
let regions = 0, chunks = 0, removed = 0;
for (const file of await readdir(path.join(world, 'entities'))) {
  if (!/^r\.-?\d+\.-?\d+\.mca$/.test(file)) continue;
  const target = path.join(world, 'entities', file);
  const data = await readFile(target);
  if (data.length === 0) continue;
  if (data.length < 8192) throw new Error(`Incomplete entity region: ${file}`);
  let changed = false;
  for (let slot = 0; slot < 1024; slot++) {
    const location = data.readUIntBE(slot * 4, 3);
    const allocated = data[slot * 4 + 3];
    if (!location || !allocated) continue;
    const offset = location * 4096;
    const length = data.readUInt32BE(offset);
    const compression = data[offset + 4];
    const payload = data.subarray(offset + 5, offset + 4 + length);
    const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : compression === 3 ? payload : null;
    if (!raw) throw new Error(`Unsupported compression ${compression} in ${file}:${slot}`);
    const root = nbt.parseUncompressed(raw, 'big');
    const entities = root.value.Entities?.value.value;
    if (!Array.isArray(entities)) continue;
    const kept = entities.filter(entity => {
      const id = entity.id?.value;
      const remove = typeof id === 'string' && id.startsWith('jurassicreborn:');
      if (remove) removed++;
      return !remove;
    });
    if (kept.length === entities.length) continue;
    root.value.Entities.value.value = kept;
    const encoded = deflateSync(nbt.writeUncompressed(root, 'big'));
    const total = encoded.length + 5;
    const needed = Math.ceil(total / 4096);
    if (needed > allocated) throw new Error(`Pruned chunk grew unexpectedly: ${file}:${slot}`);
    data.writeUInt32BE(encoded.length + 1, offset);
    data[offset + 4] = 2;
    encoded.copy(data, offset + 5);
    data.fill(0, offset + 5 + encoded.length, offset + allocated * 4096);
    changed = true;
    chunks++;
  }
  if (changed) { await writeFile(target, data); regions++; }
}
console.log(JSON.stringify({ world: path.resolve(world), regions, chunks, removed }, null, 2));

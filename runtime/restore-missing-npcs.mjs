import { readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { gunzipSync, inflateSync, deflateSync } from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';

const world = process.argv[2];
if (!world) throw new Error('Pass stopped world path');
const entityDir = path.join(world, 'entities'), npcDir = path.join(world, 'easy_npc', 'npcs');
const present = new Set(), regions = new Map();
for (const name of await readdir(entityDir)) {
  if (!/^r\.-?\d+\.-?\d+\.mca$/.test(name)) continue;
  const bytes = await readFile(path.join(entityDir, name));
  regions.set(name, bytes);
  if (!bytes.length) continue;
  for (let slot = 0; slot < 1024; slot++) {
    const sector = bytes.readUIntBE(slot * 4, 3);
    if (!sector) continue;
    const offset = sector * 4096, size = bytes.readUInt32BE(offset);
    if (!size) continue;
    const raw = inflateSync(bytes.subarray(offset + 5, offset + 4 + size));
    const tree = nbt.parseUncompressed(raw, 'big');
    for (const entity of tree.value.Entities?.value.value || []) {
      const tag = entity?.Tags?.value.value.find(value => value.startsWith('city_life_npc_'));
      if (tag) present.add(tag);
    }
  }
}
const groups = new Map(), missing = [];
for (const name of await readdir(npcDir)) {
  if (!name.endsWith('.npc.nbt')) continue;
  const tree = nbt.parseUncompressed(gunzipSync(await readFile(path.join(npcDir, name))), 'big');
  const entity = tree.value, tag = entity.Tags?.value.value.find(value => value.startsWith('city_life_npc_'));
  if (!tag || present.has(tag)) continue;
  const [x, , z] = entity.Pos.value.value;
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16), regionName = `r.${Math.floor(cx / 32)}.${Math.floor(cz / 32)}.mca`;
  const slot = (cz & 31) * 32 + (cx & 31), key = `${regionName}:${slot}`;
  if (!groups.has(key)) groups.set(key, { regionName, slot, cx, cz, entities: [] });
  groups.get(key).entities.push(entity);
  missing.push(tag);
}
for (const regionName of new Set([...groups.values()].map(group => group.regionName))) {
  let bytes = regions.get(regionName) || Buffer.alloc(8192);
  if (!bytes.length) bytes = Buffer.alloc(8192);
  if (bytes.length % 4096) { const padded = Buffer.alloc(Math.ceil(bytes.length / 4096) * 4096); bytes.copy(padded); bytes = padded; }
  for (const group of groups.values()) {
    if (group.regionName !== regionName) continue;
    const sector = bytes.readUIntBE(group.slot * 4, 3);
    let tree;
    if (sector) {
      const offset = sector * 4096, size = bytes.readUInt32BE(offset);
      if (size) tree = nbt.parseUncompressed(inflateSync(bytes.subarray(offset + 5, offset + 4 + size)), 'big');
    }
    if (!tree) tree = { type: 'compound', name: '', value: {
      Position: { type: 'intArray', value: [group.cx, group.cz] },
      DataVersion: { type: 'int', value: 3955 },
      Entities: { type: 'list', value: { type: 'compound', value: [] } },
    } };
    tree.value.Entities.value.value = tree.value.Entities.value.value.filter(Boolean);
    tree.value.Entities.value.type = 'compound';
    tree.value.Entities.value.value.push(...group.entities);
    const compressed = deflateSync(nbt.writeUncompressed(tree, 'big'));
    const count = Math.ceil((compressed.length + 5) / 4096), next = bytes.length / 4096;
    if (count > 255) throw new Error(`Chunk too large ${regionName}:${group.slot}`);
    const record = Buffer.alloc(count * 4096);
    record.writeUInt32BE(compressed.length + 1); record[4] = 2; compressed.copy(record, 5);
    bytes = Buffer.concat([bytes, record]);
    bytes.writeUIntBE(next, group.slot * 4, 3); bytes[group.slot * 4 + 3] = count;
    bytes.writeUInt32BE(Math.floor(Date.now() / 1000), 4096 + group.slot * 4);
  }
  const file = path.join(entityDir, regionName);
  await writeFile(`${file}.tmp`, bytes); await rename(`${file}.tmp`, file);
}
console.log(JSON.stringify({ restored: missing.length, tags: missing }));

// Run only on a stopped, backed-up world.
import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { inflateSync, gunzipSync, deflateSync, gzipSync } from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';

const world = process.argv[2];
if (!world) throw new Error('Pass a stopped world path');
const people = JSON.parse(await readFile('map/generated/city-pedestrians-radius-30.json', 'utf8'));
const dinosaurs = JSON.parse(await readFile('map/generated/dinosaur-fourfold.json', 'utf8'));
if (people.operations.length !== 3998 || dinosaurs.operations.length !== 384) throw new Error('Plan count drift');
const T = (type, value) => ({ type, value });
const entityDir = path.join(world, 'entities');
const all = new Map(), templates = new Map();
for (const name of await readdir(entityDir)) {
  if (!/^r\.-?\d+\.-?\d+\.mca$/.test(name)) continue;
  const bytes = await readFile(path.join(entityDir, name));
  if (!bytes.length) continue;
  for (let slot = 0; slot < 1024; slot++) {
    const sector = bytes.readUIntBE(slot * 4, 3);
    if (!sector) continue;
    const offset = sector * 4096, size = bytes.readUInt32BE(offset), compression = bytes[offset + 4];
    if (!size) continue;
    const payload = bytes.subarray(offset + 5, offset + 4 + size);
    const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : payload;
    let tree;
    try { tree = nbt.parseUncompressed(raw, 'big'); }
    catch (error) { throw new Error(`Invalid NBT ${name}:${slot}, compression ${compression}, size ${size}: ${error.message}`); }
    all.set(`${name}:${slot}`, tree);
    for (const entity of tree.value.Entities?.value.value || []) if (entity.id?.value === 'easy_npc:humanoid' || entity.id?.value.startsWith('jurassicreborn:')) {
      if (!templates.has(entity.id.value)) templates.set(entity.id.value, entity);
    }
  }
}
const uuidParts = value => {
  const hex = value.replaceAll('-', '');
  return Array.from({ length: 4 }, (_, i) => Number.parseInt(hex.slice(i * 8, i * 8 + 8), 16) | 0);
};
const groups = new Map(), npcFiles = [];
function add(op, entity) {
  const cx = Math.floor(op.x / 16), cz = Math.floor(op.z / 16);
  const name = `r.${Math.floor(cx / 32)}.${Math.floor(cz / 32)}.mca`;
  const slot = (cz & 31) * 32 + (cx & 31), key = `${name}:${slot}`;
  if (!groups.has(key)) groups.set(key, { name, slot, cx, cz, entities: [] });
  groups.get(key).entities.push(entity);
}
for (const op of people.operations) {
  const match = op.nbt.match(/"(city_life_npc_\d+)"/);
  const point = people.points.find(p => p.tag === match?.[1]);
  if (!point) throw new Error('Unmatched NPC point');
  const entity = structuredClone(templates.get('easy_npc:humanoid'));
  const uuid = randomUUID();
  entity.UUID = T('intArray', uuidParts(uuid));
  entity.Pos = T('list', { type: 'double', value: [point.x, point.y, point.z] });
  entity.Tags = T('list', { type: 'string', value: ['city_life_pedestrian', point.tag] });
  entity.Navigation.value.Home.value = { X: T('int', Math.floor(point.x)), Y: T('int', point.y), Z: T('int', Math.floor(point.z)) };
  entity.CustomName = T('string', JSON.stringify(point.name));
  entity.VariantType = T('string', point.skin);
  entity.SkinData.value.Name = T('string', point.skin);
  const home = entity.ObjectiveData.value.ObjectiveDataSet.value.value.find(goal => goal.Type?.value === 'MOVE_BACK_TO_HOME');
  home.StopDistance = T('float', 30);
  entity.Motion = T('list', { type: 'double', value: [0, 0, 0] });
  entity.Rotation = T('list', { type: 'float', value: [0, 0] });
  add(op, entity);
  npcFiles.push({ uuid, entity });
}
for (const op of dinosaurs.operations) {
  const source = templates.get(op.entity);
  if (!source) throw new Error(`Missing dinosaur template ${op.entity}`);
  const entity = structuredClone(source);
  entity.UUID = T('intArray', uuidParts(randomUUID()));
  entity.Pos = T('list', { type: 'double', value: [op.x, op.y, op.z] });
  entity.Rotation = T('list', { type: 'float', value: [op.yaw, 0] });
  entity.Motion = T('list', { type: 'double', value: [0, 0, 0] });
  entity.Tags = T('list', { type: 'string', value: ['jurassic_park', 'jurassic_fourfold_20261018'] });
  entity.PersistenceRequired = T('byte', 1);
  entity.Invulnerable = T('byte', 1);
  entity.NoAI = T('byte', 0);
  add(op, entity);
}
for (const group of groups.values()) {
  const key = `${group.name}:${group.slot}`;
  let tree = all.get(key);
  if (!tree) tree = { type: 'compound', name: '', value: {
    Position: T('intArray', [group.cx, group.cz]), DataVersion: T('int', 3955),
    Entities: T('list', { type: 'compound', value: [] }),
  } };
  tree.value.Entities.value.type = 'compound';
  tree.value.Entities.value.value.push(...group.entities);
  all.set(key, tree);
}
const touchedFiles = new Set([...groups.values()].map(group => group.name));
for (const name of touchedFiles) {
  const file = path.join(entityDir, name);
  let bytes;
  try { bytes = await readFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; bytes = Buffer.alloc(8192); }
  if (!bytes.length) bytes = Buffer.alloc(8192);
  if (bytes.length % 4096) {
    const padded = Buffer.alloc(Math.ceil(bytes.length / 4096) * 4096);
    bytes.copy(padded);
    bytes = padded;
  }
  for (const group of groups.values()) {
    if (group.name !== name) continue;
    const tree = all.get(`${name}:${group.slot}`);
    const compressed = deflateSync(nbt.writeUncompressed(tree, 'big'));
    const sectors = Math.ceil((compressed.length + 5) / 4096);
    if (sectors > 255) throw new Error(`Chunk too large ${name}:${group.slot}`);
    const next = bytes.length / 4096;
    const record = Buffer.alloc(sectors * 4096);
    record.writeUInt32BE(compressed.length + 1);
    record[4] = 2;
    compressed.copy(record, 5);
    bytes = Buffer.concat([bytes, record]);
    bytes.writeUIntBE(next, group.slot * 4, 3);
    bytes[group.slot * 4 + 3] = sectors;
    bytes.writeUInt32BE(Math.floor(Date.now() / 1000), 4096 + group.slot * 4);
  }
  await writeFile(`${file}.tmp`, bytes);
  await rename(`${file}.tmp`, file);
}
// EasyNPC keeps an additional copy of each NPC indexed by UUID.
const npcDir = path.join(world, 'easy_npc', 'npcs');
await mkdir(npcDir, { recursive: true });
for (const { uuid, entity } of npcFiles) {
  const tree = { type: 'compound', name: '', value: entity };
  await writeFile(path.join(npcDir, `${uuid}.npc.nbt`), gzipSync(nbt.writeUncompressed(tree, 'big')));
}
console.log(JSON.stringify({ newNpcs: npcFiles.length, newDinosaurs: dinosaurs.operations.length,
  entityChunks: groups.size, regionFiles: touchedFiles.size, npcFiles: npcFiles.length }));

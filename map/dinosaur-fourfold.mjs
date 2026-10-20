// Read-only planning from a closed world snapshot. Usage: node map/dinosaur-fourfold.mjs <world>
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { inflateSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';
import { worldReader } from '../verification/city-world-reader.mjs';

const world = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass a closed world snapshot');
const previous = JSON.parse(await readFile('map/generated/dinosaur-population-expansion.json', 'utf8'));
const zones = previous.metadata.enclosures;
const reader = worldReader(world);
const animals = [];
for (const name of await readdir(path.join(world, 'entities'))) {
  if (!/^r\.-?\d+\.-?\d+\.mca$/.test(name)) continue;
  const bytes = await readFile(path.join(world, 'entities', name));
  if (bytes.length === 0) continue;
  for (let slot = 0; slot < 1024; slot++) {
    const sector = bytes.readUIntBE(slot * 4, 3);
    if (!sector) continue;
    const offset = sector * 4096;
    const size = bytes.readUInt32BE(offset);
    const payload = bytes.subarray(offset + 5, offset + 4 + size);
    const raw = bytes[offset + 4] === 2 ? inflateSync(payload) : bytes[offset + 4] === 1 ? gunzipSync(payload) : payload;
    const parsed = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
    for (const entity of parsed.Entities || []) if (entity.id?.startsWith('jurassicreborn:')) animals.push(entity);
  }
}
if (animals.length !== 128) throw new Error(`Expected 128 dinosaurs, found ${animals.length}`);
const solid = new Set(['minecraft:grass_block', 'minecraft:moss_block', 'minecraft:dirt', 'minecraft:coarse_dirt', 'minecraft:stone', 'minecraft:gravel']);
const air = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air', 'minecraft:short_grass', 'minecraft:fern']);
const names = ['triceratops', 'parasaurolophus', 'brachiosaurus', 'stegosaurus', 'ankylosaurus', 'velociraptor', 'dilophosaurus', 'tyrannosaurus'];
const templates = new Map(previous.operations.map(op => [op.entity, op.nbt]));
const operations = [], counts = {};
for (const zone of zones) {
  const id = zone.species[0];
  const current = animals.filter(animal => animal.id === id);
  if (current.length !== zone.count) throw new Error(`${id}: expected ${zone.count}, found ${current.length}`);
  const desired = current.length * 3;
  const large = id.endsWith('brachiosaurus') || id.endsWith('tyrannosaurus');
  const spacing = large ? 10 : 7;
  const height = id.endsWith('brachiosaurus') ? 10 : large ? 7 : 4;
  const occupied = current.map(animal => ({ x: animal.Pos[0], z: animal.Pos[2] }));
  const candidates = [];
  const b = zone.bounds;
  for (let x = b.x1 + 16; x <= b.x2 - 16; x += 3) for (let z = b.z1 + 16; z <= b.z2 - 16; z += 3) {
    const hash = ((x * 73856093) ^ (z * 19349663) ^ (id.length * 83492791)) >>> 0;
    candidates.push({ x, z, hash });
  }
  candidates.sort((a, b) => a.hash - b.hash);
  const selected = [];
  for (const point of candidates) {
    if (selected.length === desired) break;
    if ([...occupied, ...selected].some(other => Math.hypot(other.x - point.x, other.z - point.z) < spacing)) continue;
    let clear = true;
    const radius = large ? 2 : 1;
    for (let dx = -radius; dx <= radius && clear; dx++) for (let dz = -radius; dz <= radius && clear; dz++) {
      const x = point.x + dx, z = point.z + dz;
      if (!solid.has((await reader.block(x, 63, z))?.Name)) { clear = false; break; }
      for (let y = 64; y <= 64 + height; y++) if (!air.has((await reader.block(x, y, z))?.Name)) { clear = false; break; }
    }
    if (clear) selected.push(point);
  }
  if (selected.length !== desired) throw new Error(`${id}: only ${selected.length}/${desired} safe locations`);
  for (const point of selected) operations.push({
    kind: 'spawn', entity: id, x: point.x + 0.5, y: 65, z: point.z + 0.5,
    yaw: point.hash % 360,
    nbt: templates.get(id).replace('jurassic_population_expansion_20261017', 'jurassic_fourfold_20261018'),
  });
  counts[names.find(name => id.endsWith(name))] = { existing: current.length, added: desired, total: current.length + desired };
}
if (operations.length !== 384) throw new Error(`Expected 384 new dinosaurs, found ${operations.length}`);
const output = 'map/generated/dinosaur-fourfold.json';
await writeFile(output, `${JSON.stringify({ name: 'Jurassic population fourfold', bounds: previous.bounds, operations,
  metadata: { sourceWorld: world, baseline: 128, added: 384, expected: 512, counts, batchTag: 'jurassic_fourfold_20261018' } })}\n`);
console.log(JSON.stringify({ output, added: operations.length, counts }));

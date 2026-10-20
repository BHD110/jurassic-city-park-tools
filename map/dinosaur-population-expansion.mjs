import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { inflateSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const nbt = require('prismarine-nbt');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = path.resolve(process.argv[2] || path.join(root, 'runtime/server/jurassic-city-v2'));
const output = path.join(root, 'map/generated/dinosaur-population-expansion.json');
const batchTag = 'jurassic_population_expansion_20261017';
const fullBytes = await readFile(path.join(root, 'map/generated/full.json'));
const full = JSON.parse(fullBytes);
const baseline = JSON.parse(await readFile(path.join(root, 'verification/population-baseline-audit.json')));
const definitions = new Map(JSON.parse(await readFile(path.join(root, 'modpack/entities.json'))).map(entry => [entry.id, entry.nbt]));
if (!baseline.passed || baseline.totalDinosaurs !== 64 || baseline.dinosaurs.length !== 64 ||
    path.resolve(baseline.world) !== world || full.metadata.expectedDinosaurCount !== 64) {
  throw new Error('Expected a verified 64-dinosaur baseline from this world');
}
if (baseline.dinosaurs.some(animal => animal.tags?.includes(batchTag))) throw new Error('Expansion batch already exists');

const air = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air']);
const lowPlants = new Set([...air, 'minecraft:short_grass', 'minecraft:fern']);
const soil = new Set(['minecraft:grass_block', 'minecraft:moss_block']);
const regions = new Map(), chunks = new Map();
async function chunkAt(cx, cz) {
  const key = `${cx},${cz}`;
  if (chunks.has(key)) return chunks.get(key);
  const filename = `r.${Math.floor(cx / 32)}.${Math.floor(cz / 32)}.mca`;
  if (!regions.has(filename)) regions.set(filename, await readFile(path.join(world, 'region', filename)));
  const bytes = regions.get(filename);
  const slot = (cz & 31) * 32 + (cx & 31);
  const sector = bytes.readUIntBE(slot * 4, 3);
  if (!sector) throw new Error(`Missing chunk ${cx},${cz}`);
  const offset = sector * 4096, size = bytes.readUInt32BE(offset), compression = bytes[offset + 4];
  const payload = bytes.subarray(offset + 5, offset + 4 + size);
  const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : compression === 3 ? payload : null;
  if (!raw) throw new Error(`Unsupported compression in ${filename}`);
  const chunk = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
  chunks.set(key, chunk);
  return chunk;
}
async function blockAt(x, y, z) {
  const chunk = await chunkAt(Math.floor(x / 16), Math.floor(z / 16));
  const section = chunk.sections?.find(item => item.Y === Math.floor(y / 16));
  const { palette, data } = section?.block_states ?? {};
  if (!palette) return 'minecraft:air';
  if (palette.length === 1) return palette[0].Name;
  const bits = Math.max(4, Math.ceil(Math.log2(palette.length)));
  const perLong = Math.floor(64 / bits);
  const index = ((y & 15) << 8) | ((z & 15) << 4) | (x & 15);
  const word = BigInt.asUintN(64, BigInt(data[Math.floor(index / perLong)]));
  const paletteIndex = Number((word >> BigInt((index % perLong) * bits)) & ((1n << BigInt(bits)) - 1n));
  return palette[paletteIndex]?.Name;
}
function snbtValue(value) {
  if (typeof value === 'boolean') return value ? '1b' : '0b';
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : `${value}d`;
  if (Array.isArray(value)) return `[${value.map(snbtValue).join(',')}]`;
  return JSON.stringify(String(value));
}
function adultNbt(id, tags) {
  const base = definitions.get(id);
  if (!base) throw new Error(`Missing adult NBT for ${id}`);
  const values = { ...base, PersistenceRequired: true, Invulnerable: true, NoAI: false, Tags: tags };
  return `{${Object.entries(values).map(([key, value]) => `${key}:${snbtValue(value)}`).join(',')}}`;
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const operations = [], enclosures = [];
for (const zone of full.metadata.enclosures) {
  const id = zone.species[0];
  const original = full.operations.find(op => op.kind === 'spawn' && op.entity === id);
  if (!original || original.nbt !== adultNbt(id, ['jurassic_park'])) throw new Error(`Adult spawn template drifted for ${id}`);
  const existing = baseline.dinosaurs.filter(animal => animal.id === id);
  if (existing.length !== zone.count) throw new Error(`Baseline count drifted for ${id}`);
  const large = id.endsWith('brachiosaurus') || id.endsWith('tyrannosaurus');
  const spacing = large ? 22 : 12;
  const clearance = id.endsWith('brachiosaurus') ? 10 : large ? 7 : 5;
  const radius = large ? 2 : 1;
  const occupied = existing.map(animal => ({ x: animal.position[0], z: animal.position[2] }));
  const candidates = [];
  for (let z = zone.bounds.z1 + 22; z <= zone.bounds.z2 - 22; z += 4) {
    for (let x = zone.bounds.x1 + 22; x <= zone.bounds.x2 - 22; x += 4) {
      const hash = ((x * 73856093) ^ (z * 19349663) ^ (id.length * 83492791)) >>> 0;
      candidates.push({ x, z, hash });
    }
  }
  candidates.sort((a, b) => a.hash - b.hash);
  const added = [];
  for (const candidate of candidates) {
    if (added.length === zone.count) break;
    if ([...occupied, ...added].some(point => distance(point, candidate) < spacing)) continue;
    let clear = true;
    for (let dx = -radius; dx <= radius && clear; dx++) for (let dz = -radius; dz <= radius && clear; dz++) {
      const x = candidate.x + dx, z = candidate.z + dz;
      if (!soil.has(await blockAt(x, 63, z))) { clear = false; break; }
      for (let y = 64; y <= 64 + clearance; y++) {
        if (!(y <= 65 ? lowPlants : air).has(await blockAt(x, y, z))) { clear = false; break; }
      }
    }
    if (!clear) continue;
    added.push(candidate);
  }
  if (added.length !== zone.count) throw new Error(`Only ${added.length}/${zone.count} safe positions for ${id}`);
  for (const [index, point] of added.entries()) operations.push({
    kind: 'spawn', entity: id, x: point.x + 0.5, y: 65, z: point.z + 0.5,
    yaw: (point.hash % 360), nbt: adultNbt(id, ['jurassic_park', batchTag]),
  });
  enclosures.push({ ...zone, count: zone.count * 2, spawns: [...zone.spawns, ...added.map(({ x, z }) => ({ x, y: 65, z }))],
    added: added.map(({ x, z }) => ({ x, y: 65, z })), minSpacing: spacing, clearHeight: clearance });
}
if (operations.length !== 64 || enclosures.reduce((sum, zone) => sum + zone.count, 0) !== 128) {
  throw new Error('Expansion must add exactly 64 animals to reach 128');
}
const plan = {
  name: 'Jurassic City Park Dinosaur Population Expansion', bounds: full.bounds, operations,
  metadata: {
    sourcePlan: 'full', sourcePlanSha256: createHash('sha256').update(fullBytes).digest('hex'),
    sourceWorld: world, baselineAudit: 'verification/population-baseline-audit.json',
    baselineAuditSha256: createHash('sha256').update(await readFile(path.join(root, 'verification/population-baseline-audit.json'))).digest('hex'),
    batchTag, originalDinosaurCount: 64, addedDinosaurCount: 64, expectedDinosaurCount: 128,
    enclosures, regionFilesRead: [...regions.keys()].sort(), chunksRead: chunks.size,
  },
};
await writeFile(output, `${JSON.stringify(plan)}\n`);
console.log(JSON.stringify({ output, operations: operations.length, expected: 128,
  bySpecies: Object.fromEntries(enclosures.map(zone => [zone.species[0], zone.added.length])),
  regionFilesRead: plan.metadata.regionFilesRead.length, chunksRead: chunks.size }, null, 2));

import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, inflateSync } from 'node:zlib';

const require = createRequire(import.meta.url);
let nbt;
try { nbt = require('prismarine-nbt'); }
catch { nbt = require(process.env.PARK_NBT_PACKAGE || 'D:/codeSource/product/jev/mindcraft-agent-gpt/node_modules/prismarine-nbt'); }
const [world, output = 'verification/save-audit.json', planName = 'full'] = process.argv.slice(2);
if (!world || !/^[a-zA-Z0-9_-]{1,64}$/.test(planName)) throw new Error('Usage: node verification/check-save.mjs <saved-world> [report-path] [plan-name]');
const full = JSON.parse(await readFile(`map/generated/${planName}.json`, 'utf8'));
const definitions = new Map(JSON.parse(await readFile('modpack/entities.json', 'utf8')).map(e => [e.id, e.nbt]));
const found = [];
let chunks = 0;
for (const file of await readdir(path.join(world, 'entities'))) {
  if (!/^r\.-?\d+\.-?\d+\.mca$/.test(file)) continue;
  const buffer = await readFile(path.join(world, 'entities', file));
  if (buffer.length === 0) continue;
  if (buffer.length < 8192) throw new Error(`Incomplete entity region header: ${file}`);
  for (let slot = 0; slot < 1024; slot++) {
    // Region files have a 4-byte sector location for each of their 32x32 chunks.
    const sector = buffer.readUIntBE(slot * 4, 3);
    if (!sector) continue;
    const offset = sector * 4096;
    const length = buffer.readUInt32BE(offset);
    const compression = buffer[offset + 4];
    if (length < 1 || offset + 4 + length > buffer.length) throw new Error(`Invalid entity region ${file}:${slot}`);
    const payload = buffer.subarray(offset + 5, offset + 4 + length);
    const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : compression === 3 ? payload : null;
    if (!raw) throw new Error(`Unsupported region compression ${compression} in ${file}`);
    const parsed = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
    chunks++;
    for (const entity of parsed.Entities || []) {
      if (entity.id?.startsWith('jurassicreborn:')) found.push(entity);
    }
  }
}
const failures = [];
const counts = {};
for (const enclosure of full.metadata.enclosures) {
  const id = enclosure.species[0];
  const animals = found.filter(e => e.id === id);
  counts[id] = animals.length;
  if (animals.length !== enclosure.count) failures.push(`${id}: expected ${enclosure.count}, found ${animals.length}`);
  const { x1, z1, x2, z2 } = enclosure.bounds;
  for (const animal of animals) {
    const [x, y, z] = animal.Pos;
    if (!(x > x1 && x < x2 && z > z1 && z < z2 && y > 62 && y < 110)) failures.push(`${id}: outside enclosure at ${animal.Pos}`);
    if (animal.NoAI) failures.push(`${id}: AI disabled`);
    if (!(animal.Health > 0) || animal.DeathTime > 0) failures.push(`${id}: not alive`);
    if (!animal.PersistenceRequired) failures.push(`${id}: persistence flag missing`);
    if (!(animal.DinosaurAge >= definitions.get(id).DinosaurAge)) failures.push(`${id}: younger than the configured adult age`);
  }
}
if (found.length !== full.metadata.expectedDinosaurCount) failures.push(`Expected 64 total, found ${found.length}`);
const level = nbt.simplify((await nbt.parse(await readFile(path.join(world, 'level.dat')), 'big')).parsed).Data;
for (const name of ['dinosaurMetabolism', 'doDinoBreeding']) {
  if (level.GameRules[name] !== 'false') failures.push(`${name}: must be false for the visit world`);
}
const report = {
  inspectedAt: new Date().toISOString(), world: path.resolve(world), entityChunks: chunks,
  totalDinosaurs: found.length, counts, gameType: level.GameType, allowCommands: level.allowCommands,
  levelName: level.LevelName, spawn: [level.SpawnX, level.SpawnY, level.SpawnZ],
  rules: { dinosaurMetabolism: level.GameRules.dinosaurMetabolism, doDinoBreeding: level.GameRules.doDinoBreeding },
  dinosaurs: found.map(e => ({ id: e.id, uuid: e.UUID, position: e.Pos, age: e.DinosaurAge, health: e.Health, noAI: !!e.NoAI, sleeping: !!e.IsSleeping, tags: e.Tags || [] })),
  failures, passed: failures.length === 0
};
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ totalDinosaurs: found.length, counts, failures, passed: report.passed }, null, 2));
process.exitCode = failures.length ? 1 : 0;

import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync, gunzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const nbt = require('prismarine-nbt');
const [worldArg, reportArg] = process.argv.slice(2);
if (!worldArg || !reportArg) throw new Error('Usage: node verification/check-final-green-samples.mjs <world-snapshot> <report.json>');

const world = path.resolve(worldArg);
const plan = JSON.parse(await readFile('map/generated/city-green-density.json', 'utf8'));
const regions = new Map();
const chunks = new Map();

async function block(x, y, z) {
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
  const key = `${cx},${cz}`;
  let sections = chunks.get(key);
  if (!sections) {
    const filename = `r.${Math.floor(cx / 32)}.${Math.floor(cz / 32)}.mca`;
    if (!regions.has(filename)) regions.set(filename, await readFile(path.join(world, 'region', filename)));
    const region = regions.get(filename);
    const slot = (cx & 31) + 32 * (cz & 31);
    const sector = region.readUIntBE(slot * 4, 3);
    if (!sector) throw new Error(`Missing chunk ${key}`);
    const offset = sector * 4096;
    const size = region.readUInt32BE(offset);
    const mode = region[offset + 4];
    const payload = region.subarray(offset + 5, offset + 4 + size);
    const raw = mode === 2 ? inflateSync(payload) : mode === 1 ? gunzipSync(payload) : mode === 3 ? payload : null;
    if (!raw) throw new Error(`Unsupported compression ${mode}`);
    const chunk = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
    sections = new Map((chunk.sections ?? []).filter(s => s.block_states?.palette?.length).map(s => [s.Y, s.block_states]));
    chunks.set(key, sections);
  }
  const state = sections.get(Math.floor(y / 16));
  if (!state) return 'minecraft:air';
  if (state.palette.length === 1) return state.palette[0].Name;
  const bits = Math.max(4, Math.ceil(Math.log2(state.palette.length)));
  const perLong = Math.floor(64 / bits);
  const index = ((y & 15) << 8) | ((z & 15) << 4) | (x & 15);
  const word = state.data[Math.floor(index / perLong)];
  const paletteIndex = Number((BigInt.asUintN(64, word) >> BigInt((index % perLong) * bits)) & ((1n << BigInt(bits)) - 1n));
  return state.palette[paletteIndex]?.Name ?? 'invalid-palette-index';
}

const quadrants = [
  ['north-west', x => x.x1 < 0 && x.z1 < 0],
  ['north-east', x => x.x1 >= 0 && x.z1 < 0],
  ['south-west', x => x.x1 < 0 && x.z1 >= 0],
  ['south-east', x => x.x1 >= 0 && x.z1 >= 0],
];
const samples = [];
for (const [quadrant, contains] of quadrants) {
  const op = plan.operations.find(x => x.kind === 'box' && x.block === 'minecraft:oak_log' && x.x1 === x.x2 && x.z1 === x.z2 && contains(x));
  if (!op) throw new Error(`No sample for ${quadrant}`);
  const { x1: x, y1: y, z1: z } = op;
  const [trunk, support] = await Promise.all([block(x, y, z), block(x, y - 1, z)]);
  samples.push({ quadrant, x, y, z, expected: op.block, actual: trunk, support, passed: trunk === op.block && ['minecraft:grass_block', 'minecraft:moss_block'].includes(support) });
}
const report = { world, plan: path.resolve('map/generated/city-green-density.json'), passed: samples.every(x => x.passed), samples };
await writeFile(reportArg, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;

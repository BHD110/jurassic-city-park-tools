#!/usr/bin/env node
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const nbt = require('prismarine-nbt');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [planName, snapshotArg, outputArg] = process.argv.slice(2);
if (!planName || !snapshotArg || !/^[a-zA-Z0-9_-]{1,64}$/.test(planName)) {
  throw new Error('Usage: node verification/check-coaster-world.mjs <plan-name> <saved-world-snapshot> [report-path]');
}
const snapshot = path.resolve(snapshotArg);
const planBytes = await readFile(path.join(root, 'map/generated', `${planName}.json`));
const plan = JSON.parse(planBytes);
const points = plan.route?.points || [];
if (points.length < 100) throw new Error('plan has no embedded route');
const regions = new Map(), chunks = new Map();
const counts = { rails: 0, supports: 0, headroom: 0, button: 0 };
const examples = [];
const fail = (kind, point, actual) => { counts[kind] += 1; if (examples.length < 60) examples.push({ kind, point, actual }); };

async function chunkAt(cx, cz) {
  const k = `${cx},${cz}`;
  if (chunks.has(k)) return chunks.get(k);
  const rx = Math.floor(cx / 32), rz = Math.floor(cz / 32);
  const regionName = `r.${rx}.${rz}.mca`;
  if (!regions.has(regionName)) regions.set(regionName, await readFile(path.join(snapshot, 'region', regionName)));
  const bytes = regions.get(regionName);
  const slot = ((cz & 31) * 32) + (cx & 31);
  const sector = bytes.readUIntBE(slot * 4, 3);
  if (!sector) { chunks.set(k, null); return null; }
  const offset = sector * 4096;
  const length = bytes.readUInt32BE(offset);
  if (length < 1 || offset + 4 + length > bytes.length) throw new Error(`bad chunk length ${regionName}:${slot}`);
  const payload = bytes.subarray(offset + 5, offset + 4 + length);
  const compression = bytes[offset + 4];
  const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : compression === 3 ? payload : null;
  if (!raw) throw new Error(`unsupported chunk compression ${compression}`);
  const chunk = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
  chunks.set(k, chunk);
  return chunk;
}

async function blockAt(x, y, z) {
  const chunk = await chunkAt(Math.floor(x / 16), Math.floor(z / 16));
  if (!chunk) return null;
  const section = chunk.sections?.find(s => s.Y === Math.floor(y / 16));
  if (!section?.block_states?.palette) return null;
  const { palette, data } = section.block_states;
  if (palette.length === 1) return palette[0];
  const bits = Math.max(4, Math.ceil(Math.log2(palette.length)));
  const perLong = Math.floor(64 / bits);
  const index = ((y & 15) << 8) | ((z & 15) << 4) | (x & 15);
  const word = BigInt(data[Math.floor(index / perLong)]);
  const paletteIndex = Number((word >> BigInt((index % perLong) * bits)) & ((1n << BigInt(bits)) - 1n));
  return palette[paletteIndex] || null;
}

for (const p of points) {
  const rail = await blockAt(p.x, p.y, p.z);
  const expectedName = `minecraft:${p.powered ? 'powered_rail' : 'rail'}`;
  if (rail?.Name !== expectedName || rail?.Properties?.shape !== p.shape || (p.powered && rail?.Properties?.powered !== 'true')) {
    fail('rails', `${p.x},${p.y},${p.z}`, rail);
  }
  const support = await blockAt(p.x, p.y - 1, p.z);
  if (support?.Name !== (p.powered ? 'minecraft:redstone_block' : 'minecraft:stone_bricks')) {
    fail('supports', `${p.x},${p.y - 1},${p.z}`, support);
  }
  for (let dy = 1; dy <= 3; dy += 1) {
    const overhead = await blockAt(p.x, p.y + dy, p.z);
    if (overhead?.Name !== 'minecraft:air') fail('headroom', `${p.x},${p.y + dy},${p.z}`, overhead);
  }
}

const station = plan.route.station;
if (!station || !points.some(p => p.x === station.x && p.y === station.y && p.z === station.z)) {
  throw new Error('station is not on the embedded route');
}
const commandOrigin = `${station.x} ${station.y + 1} ${station.z}`;
const boardingSelector = `@p[x=${station.x - 10},y=${station.y + 1},z=${station.z + 9},distance=..5]`;
const boardingCart = '@e[type=minecraft:minecart,tag=park_boarding,sort=nearest,limit=1,distance=..4]';
for (const x of [station.x - 10, station.x + 10, station.x + 20]) {
  const button = await blockAt(x, station.y + 1, station.z + 9);
  if (button?.Name !== 'minecraft:stone_button' || button?.Properties?.face !== 'wall' || button?.Properties?.facing !== 'south') {
    fail('button', `${x},${station.y + 1},${station.z + 9}`, button);
  }
}
const stationControls = [
  { x: station.x - 10, z: station.z + 8, block: 'command_block', facing: 'north', auto: 0,
    command: `execute positioned ${commandOrigin} run kill @e[type=minecraft:minecart,tag=park_ride,distance=..5,nbt=!{Passengers:[{}]}]` },
  { x: station.x - 10, z: station.z + 7, block: 'chain_command_block', facing: 'north', auto: 1, conditional: 'false',
    command: `execute if entity ${boardingSelector} run summon minecraft:minecart ${station.x + 0.5} ${station.y + 0.2} ${station.z + 0.5} {Tags:["park_ride","park_boarding"]}` },
  { x: station.x - 10, z: station.z + 6, block: 'chain_command_block', facing: 'north', auto: 1, conditional: 'true',
    command: `execute positioned ${commandOrigin} run ride ${boardingSelector} mount ${boardingCart}` },
  { x: station.x - 10, z: station.z + 5, block: 'chain_command_block', facing: 'north', auto: 1, conditional: 'true',
    command: `execute positioned ${commandOrigin} run data merge entity ${boardingCart} {Motion:[0.28d,0.0d,0.0d]}` },
  { x: station.x - 10, z: station.z + 4, block: 'chain_command_block', facing: 'north', auto: 1, conditional: 'true',
    command: `execute positioned ${commandOrigin} run tag ${boardingCart} remove park_boarding` },
  { x: station.x + 10, z: station.z + 8, block: 'command_block', facing: 'south', auto: 0,
    command: 'gamemode creative @p[distance=..8]' },
  { x: station.x + 20, z: station.z + 8, block: 'command_block', facing: 'south', auto: 0,
    command: 'gamemode adventure @p[distance=..8]' },
];
for (const control of stationControls) {
  const { x, z } = control;
  const block = await blockAt(x, station.y + 1, z);
  const chunk = await chunkAt(Math.floor(x / 16), Math.floor(z / 16));
  const entity = chunk?.block_entities?.find(b => b.x === x && b.y === station.y + 1 && b.z === z);
  if (block?.Name !== `minecraft:${control.block}` || block?.Properties?.facing !== control.facing ||
      (control.conditional && block?.Properties?.conditional !== control.conditional) ||
      entity?.auto !== control.auto || entity?.Command !== control.command) {
    fail('button', `${x},${station.y + 1},${z}`, { block, auto: entity?.auto, command: entity?.Command });
  }
}
const report = {
  planFileName: planName,
  planSha256: createHash('sha256').update(planBytes).digest('hex'),
  routeSha256: createHash('sha256').update(JSON.stringify(plan.route)).digest('hex'),
  snapshot,
  levelDatSha256: createHash('sha256').update(await readFile(path.join(snapshot, 'level.dat'))).digest('hex'),
  checkedPoints: points.length,
  stationControls: {
    buttonsChecked: 3,
    commandBlocksChecked: stationControls.length,
    boardingCartPosition: { x: station.x + 0.5, y: station.y + 0.2, z: station.z + 0.5 },
    horizontalOffsetFromStationRail: Math.SQRT1_2,
  },
  chunksRead: chunks.size,
  regionsRead: regions.size,
  mismatches: counts,
  examples,
  status: Object.values(counts).every(n => n === 0) ? 'passed' : 'failed',
};
await writeFile(outputArg ? path.resolve(outputArg) : path.join(root, 'verification', `${planName}-world-rail-check.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, checkedPoints: points.length, chunksRead: chunks.size, regionsRead: regions.size, mismatches: counts, examples: examples.slice(0, 5) }, null, 2));
if (report.status !== 'passed') process.exitCode = 1;

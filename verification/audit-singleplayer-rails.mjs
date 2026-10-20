import {readFile, readdir, writeFile} from 'node:fs/promises';
import {inflateSync, gunzipSync} from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';

const world = 'D:/codeSource/product/jev/mindcraft-client/.minecraft/versions/1.21.1-NeoForge/saves/Jurassic City Park - Interior Lights';
const key = p => `${p.x},${p.y},${p.z}`;
const plans = [];
for (const file of ['city-coaster-route.json', 'park-tour-route.json']) {
  const plan = JSON.parse(await readFile(`map/generated/${file}`, 'utf8'));
  plans.push({file, cells: new Set(plan.route.points.map(key))});
}
const rails = [];
for (const file of await readdir(path.join(world, 'region'))) {
  const match = /^r\.(-?\d+)\.(-?\d+)\.mca$/.exec(file);
  if (!match) continue;
  const rx = Number(match[1]), rz = Number(match[2]);
  if (rx < -2 || rx > 1 || rz < -2 || rz > 1) continue;
  const bytes = await readFile(path.join(world, 'region', file));
  for (let slot = 0; slot < 1024; slot++) {
    const sector = bytes.readUIntBE(slot * 4, 3);
    if (!sector) continue;
    const offset = sector * 4096, length = bytes.readUInt32BE(offset), compression = bytes[offset + 4];
    const payload = bytes.subarray(offset + 5, offset + 4 + length);
    const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : compression === 3 ? payload : null;
    if (!raw) throw new Error(`Unsupported compression ${compression}`);
    const chunk = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
    for (const section of chunk.sections || []) {
      const state = section.block_states;
      if (!state?.palette) continue;
      const railIds = new Set(state.palette.flatMap((p, i) => /^(minecraft:rail|minecraft:powered_rail|minecraft:detector_rail|minecraft:activator_rail)$/.test(p.Name) ? [i] : []));
      if (!railIds.size) continue;
      const bits = Math.max(4, Math.ceil(Math.log2(state.palette.length))), perLong = Math.floor(64 / bits), mask = (1n << BigInt(bits)) - 1n;
      for (let index = 0; index < 4096; index++) {
        const id = state.palette.length === 1 ? 0 : Number((BigInt(state.data[Math.floor(index / perLong)]) >> BigInt(index % perLong * bits)) & mask);
        if (!railIds.has(id)) continue;
        const p = {x: chunk.xPos * 16 + (index & 15), y: section.Y * 16 + (index >> 8), z: chunk.zPos * 16 + ((index >> 4) & 15), block: state.palette[id]};
        p.plan = plans.find(plan => plan.cells.has(key(p)))?.file || 'unassigned';
        rails.push(p);
      }
    }
  }
}
const unassigned = rails.filter(p => p.plan === 'unassigned');
const remaining = new Map(unassigned.map(p => [key(p), p]));
const groups = [];
while (remaining.size) {
  const start = remaining.values().next().value, queue = [start];
  remaining.delete(key(start));
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const dy of [-1, 0, 1]) {
      const k = key({x: p.x + dx, y: p.y + dy, z: p.z + dz});
      if (remaining.has(k)) {queue.push(remaining.get(k)); remaining.delete(k);}
    }
  }
  groups.push({count: queue.length, bounds: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, [Math.min(...queue.map(p => p[axis])), Math.max(...queue.map(p => p[axis]))]])), samples: queue.filter((_, i) => i % Math.max(1, Math.floor(queue.length / 6)) === 0).slice(0, 6), points: queue});
}
groups.sort((a, b) => b.count - a.count);
const report = {world, scannedAt: new Date().toISOString(), totalRails: rails.length, assigned: Object.fromEntries(plans.map(p => [p.file, rails.filter(r => r.plan === p.file).length])), unassigned: unassigned.length, groups};
await writeFile('verification/singleplayer-rail-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({...report, groups: groups.map(({points, ...group}) => group)}, null, 2));

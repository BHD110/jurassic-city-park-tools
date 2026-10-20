import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {worldReader} from './city-world-reader.mjs';

const beforePath = process.argv[2] || 'backups/before-interior-lighting-20261018-124857/world';
const afterPath = process.argv[3];
const before = worldReader(beforePath);
const after = afterPath ? worldReader(afterPath) : null;
const plans = await Promise.all(['visitor-floor-repair', 'interior-lighting'].map(async name =>
  JSON.parse(await readFile(path.join('map/generated', `${name}.json`), 'utf8'))));
const targets = new Set();
const nearby = new Set();
const stats = {};
const key = (x, y, z) => `${x},${y},${z}`;
const protectedBlock = name => /:(rail|powered_rail|detector_rail|activator_rail|.*_stairs|.*_door|.*_trapdoor|.*_glass|glass|.*_log|.*_fence|.*_slab|.*_sign|.*_button|lever|redstone_block|.*command_block|glowstone|sea_lantern|torch|wall_torch|iron_block)$/.test(name || '');

for (const plan of plans) {
  let cells = 0;
  for (const op of plan.operations) {
    if (op.kind !== 'box') throw new Error(`Unexpected operation ${op.kind}`);
    for (let y = op.y1; y <= op.y2; y++) for (let z = op.z1; z <= op.z2; z++) for (let x = op.x1; x <= op.x2; x++) {
      const at = key(x, y, z);
      if (targets.has(at)) throw new Error(`Duplicate target ${at}`);
      targets.add(at);
      const old = (await before.block(x, y, z))?.Name;
      if (old !== op.expectedBlock) throw new Error(`Precondition mismatch ${at}: ${old} != ${op.expectedBlock}`);
      if (after) {
        const current = (await after.block(x, y, z))?.Name;
        if (current !== op.block) throw new Error(`Unapplied target ${at}: ${current} != ${op.block}`);
      }
      for (const [dx, dy, dz] of [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]]) {
        nearby.add(key(x + dx, y + dy, z + dz));
      }
      cells++;
    }
  }
  stats[plan.name] = {operations: plan.operations.length, cells};
}
let protectedNeighbors = 0;
for (const at of nearby) {
  if (targets.has(at)) continue;
  const [x, y, z] = at.split(',').map(Number);
  const oldState = await before.block(x, y, z);
  if (!protectedBlock(oldState?.Name)) continue;
  protectedNeighbors++;
  if (after) {
    const currentState = await after.block(x, y, z);
    if (JSON.stringify(currentState) !== JSON.stringify(oldState)) {
      throw new Error(`Adjacent protected block state changed ${at}: ${JSON.stringify(oldState)} -> ${JSON.stringify(currentState)}`);
    }
  }
}
console.log(JSON.stringify({beforePath, afterPath: afterPath || null, stats, protectedNeighbors, passed: true}, null, 2));

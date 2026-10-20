import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import nbt from 'prismarine-nbt';
import {worldReader} from '../verification/city-world-reader.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = path.resolve(process.argv[2] || path.join(root, 'backups/before-interior-lighting-20261018-124857/world'));
const sourceFile = path.join(root, 'map/references/assets/jpog-visitor-center-entrance.schematic');
const sourceBytes = await readFile(sourceFile);
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
if (sourceSha256 !== '6fb59e722c26cf962834bae4a394d00a0e570a21d65f2ea6df3b862faa196642') {
  throw new Error('Visitor schematic changed');
}
const source = nbt.simplify((await nbt.parse(sourceBytes)).parsed);
if (source.Width !== 101 || source.Height !== 36 || source.Length !== 91) throw new Error('Unexpected visitor schematic dimensions');
const reader = worldReader(world);
const sourceStone = [];
const preserved = [];
const beforeCounts = {};

for (let sy = 2; sy <= 4; sy++) for (let sz = 0; sz < source.Length; sz++) for (let sx = 0; sx < source.Width; sx++) {
  const index = (sy * source.Length + sz) * source.Width + sx;
  if ((source.Blocks[index] & 255) !== 1) continue;
  const cell = {x: -45 + sz, y: 62 + sy, z: 501 - sx};
  const before = (await reader.block(cell.x, cell.y, cell.z))?.Name;
  beforeCounts[before] = (beforeCounts[before] || 0) + 1;
  if (before === 'minecraft:light_gray_concrete') {
    preserved.push({...cell, before});
    continue;
  }
  if (before !== 'minecraft:air' && before !== 'minecraft:grass_block') {
    throw new Error(`Unexpected visitor foundation block ${JSON.stringify({...cell, before})}`);
  }
  sourceStone.push({...cell, before});
}

const rowKey = cell => `${cell.y},${cell.z},${cell.before}`;
const rows = new Map();
for (const cell of sourceStone) {
  const key = rowKey(cell);
  if (!rows.has(key)) rows.set(key, []);
  rows.get(key).push(cell);
}
const floorOperations = [];
for (const row of rows.values()) {
  row.sort((a, b) => a.x - b.x);
  let start = row[0], end = row[0];
  const flush = () => floorOperations.push({kind: 'box', x1: start.x, y1: start.y, z1: start.z,
    x2: end.x, y2: end.y, z2: end.z, block: 'minecraft:stone', expectedBlock: start.before});
  for (let i = 1; i < row.length; i++) {
    if (row[i].x === end.x + 1) end = row[i];
    else { flush(); start = end = row[i]; }
  }
  flush();
}
floorOperations.sort((a, b) => a.y1 - b.y1 || a.z1 - b.z1 || a.x1 - b.x1);

const stationLights = [];
for (const z of [645, 653, 661]) for (let x = -40; x <= 40; x += 8) {
  const top = await reader.block(x, 76, z);
  const below = await reader.block(x, 75, z);
  const head = await reader.block(x, 74, z);
  const ground = await reader.block(x, 63, z);
  if (top?.Name !== 'minecraft:dark_prismarine' || below?.Name !== 'minecraft:air' ||
      head?.Name !== 'minecraft:air' || !ground || ground.Name === 'minecraft:air') {
    throw new Error(`Station lamp lacks roof, headroom or floor at ${x},76,${z}`);
  }
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    if ((await reader.block(x + dx, 76, z + dz))?.Name !== top.Name) {
      throw new Error(`Station roof edge at ${x},76,${z}`);
    }
  }
  stationLights.push({kind: 'box', x1: x, y1: 76, z1: z, x2: x, y2: 76, z2: z,
    block: 'minecraft:sea_lantern', expectedBlock: top.Name});
}
const stationFloorLights = [];
for (const [z, y, material] of [[645, 63, 'minecraft:smooth_stone'],
  [657, 64, 'minecraft:polished_andesite'], [663, 64, 'minecraft:polished_andesite']]) {
  for (let x = -40; x <= 40; x += 8) {
    if ((await reader.block(x, y, z))?.Name !== material) continue;
    const above = (await reader.block(x, y + 1, z))?.Name;
    if (above !== 'minecraft:air') continue;
    let floorEdge = false;
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if ((await reader.block(x + dx, y, z + dz))?.Name !== material) floorEdge = true;
    }
    if (floorEdge) continue;
    let nearControl = false;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 2; dy++) {
      const nearby = (await reader.block(x + dx, y + dy, z + dz))?.Name || '';
      if (/:(rail|powered_rail|detector_rail|activator_rail|redstone_block|.*command_block|stone_button|lever)$/.test(nearby)) nearControl = true;
    }
    if (nearControl) continue;
    stationFloorLights.push({kind: 'box', x1: x, y1: y, z1: z, x2: x, y2: y, z2: z,
      block: 'minecraft:sea_lantern', expectedBlock: material, section: 'station-platform-floor'});
  }
}

const buildings = JSON.parse(await readFile(path.join(root, 'map/generated/upgrade-full.json'), 'utf8')).metadata.buildings;
const publicAudit = [];
const storeLights = [];
const ceilingMaterials = new Set(['minecraft:smooth_stone', 'minecraft:stone_bricks', 'minecraft:iron_block',
  'minecraft:dark_oak_planks', 'minecraft:oak_planks', 'minecraft:birch_planks',
  'minecraft:spruce_planks', 'minecraft:bricks', 'minecraft:white_concrete',
  'minecraft:light_gray_concrete', 'minecraft:gray_concrete', 'minecraft:polished_andesite']);
const floorMaterials = new Set(['minecraft:stone', 'minecraft:stone_bricks', 'minecraft:smooth_stone',
  'minecraft:polished_andesite', 'minecraft:oak_planks', 'minecraft:birch_planks',
  'minecraft:spruce_planks', 'minecraft:light_gray_concrete', 'minecraft:white_concrete']);
for (const building of buildings.filter(b => ['control', 'hatchery', 'maintenance', 'city-10', 'city-30', 'city-60'].includes(b.id))) {
  const b = building.bounds;
  let existingLights = 0;
  for (let x = b.x1; x <= b.x2; x++) for (let z = b.z1; z <= b.z2; z++) for (let y = 65; y <= b.y2; y++) {
    const name = (await reader.block(x, y, z))?.Name;
    if (/^minecraft:(glowstone|sea_lantern|torch|wall_torch|shroomlight|lantern)$/.test(name || '')) existingLights++;
  }
  const audit = {id: building.id, name: building.name, existingLights, addedLights: 0};
  publicAudit.push(audit);
  if (existingLights) continue;
  for (let x = b.x1 + 6; x <= b.x2 - 6; x += 8) for (let z = b.z1 + 6; z <= b.z2 - 6; z += 8) {
    for (let y = 68; y <= b.y2; y++) {
      const roof = (await reader.block(x, y, z))?.Name;
      if (!ceilingMaterials.has(roof)) continue;
      const headroom = await Promise.all([1, 2, 3].map(d => reader.block(x, y - d, z)));
      if (!headroom.every(block => block?.Name === 'minecraft:air')) continue;
      const neighbors = await Promise.all([[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dz]) => reader.block(x + dx, y, z + dz)));
      if (!neighbors.every(block => block?.Name === roof)) continue;
      let floorY = null, floorName = null;
      for (let d = 4; d <= 18; d++) {
        const floor = (await reader.block(x, y - d, z))?.Name;
        if (floor === 'minecraft:air') continue;
        if (floorMaterials.has(floor)) { floorY = y - d; floorName = floor; }
        break;
      }
      if (floorY === null) continue;
      const floorNeighbors = await Promise.all([[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dz]) => reader.block(x + dx, floorY, z + dz)));
      if (!floorNeighbors.every(block => floorMaterials.has(block?.Name))) continue;
      const lampY = y - floorY > 10 ? floorY : y;
      const material = lampY === y ? roof : floorName;
      storeLights.push({kind: 'box', x1: x, y1: lampY, z1: z, x2: x, y2: lampY, z2: z,
        block: 'minecraft:sea_lantern', expectedBlock: material, buildingId: building.id,
        surface: lampY === y ? 'ceiling' : 'floor'});
      audit.addedLights++;
      break;
    }
  }
}

const visitorLights = {};
for (let x = -45; x <= 45; x++) for (let z = 401; z <= 501; z++) for (let y = 64; y <= 94; y++) {
  const name = (await reader.block(x, y, z))?.Name;
  if (/^minecraft:(glowstone|sea_lantern|torch|wall_torch|shroomlight|lantern)$/.test(name || '')) {
    visitorLights[name] = (visitorLights[name] || 0) + 1;
  }
}
const stationFloorCoverage = {sampledWalkableCells: 0, withinDistance9: 0, withinDistance14: 0,
  fartherThan14: 0, maxManhattanDistance: 0};
for (let x = -44; x <= 44; x++) for (let z = 642; z <= 665; z++) {
  if ((await reader.block(x, 76, z))?.Name !== 'minecraft:dark_prismarine') continue;
  const y = (await reader.block(x, 64, z))?.Name === 'minecraft:polished_andesite' ? 64 : 63;
  const floor = (await reader.block(x, y, z))?.Name;
  if (!['minecraft:smooth_stone', 'minecraft:polished_andesite'].includes(floor) ||
      (await reader.block(x, y + 1, z))?.Name !== 'minecraft:air') continue;
  const distance = Math.min(...stationFloorLights.map(op =>
    Math.abs(x - op.x1) + Math.abs(y - op.y1) + Math.abs(z - op.z1)));
  stationFloorCoverage.sampledWalkableCells++;
  if (distance <= 9) stationFloorCoverage.withinDistance9++;
  if (distance <= 14) stationFloorCoverage.withinDistance14++;
  else stationFloorCoverage.fartherThan14++;
  stationFloorCoverage.maxManhattanDistance = Math.max(stationFloorCoverage.maxManhattanDistance, distance);
}
const lightingOperations = [...stationLights, ...stationFloorLights, ...storeLights];
const lightingBounds = {
  x1: Math.min(...lightingOperations.map(op => op.x1)),
  y1: Math.min(...lightingOperations.map(op => op.y1)),
  z1: Math.min(...lightingOperations.map(op => op.z1)),
  x2: Math.max(...lightingOperations.map(op => op.x2)),
  y2: Math.max(...lightingOperations.map(op => op.y2)),
  z2: Math.max(...lightingOperations.map(op => op.z2)),
};
const floorPlan = {
  name: 'JPOG Visitor Centre Source Stone Foundation Repair',
  bounds: {x1: -45, y1: 64, z1: 401, x2: 45, y2: 66, z2: 501},
  metadata: {sourceWorld: world, sourceSchematicSha256: sourceSha256,
    policy: 'Restore only original schematic ID 1 stone at y64-66 where the importer omitted it; preserve existing concrete and all upper floors, stairs, lights and courtyard geometry.',
    restoredCells: sourceStone.length, preservedExistingConcrete: preserved,
    beforeCounts, operationCount: floorOperations.length},
  operations: floorOperations,
};
const lightPlan = {
  name: 'Jurassic City Public Interior Recessed Lighting',
  bounds: lightingBounds,
  metadata: {sourceWorld: world, sourceSchematicSha256: sourceSha256,
    station: {roofBlock: 'minecraft:dark_prismarine', roofY: 76, existingNearbyLights: 2,
      addedRoofLights: stationLights.length, addedFloorLights: stationFloorLights.length,
      spacing: 8, floorCoverageEstimate: stationFloorCoverage},
    visitorCentre: {existingLights: visitorLights, addedLights: 0,
      reason: 'Original imported lighting is already dense, including the entrance and floor level; restoring the omitted stone foundation makes the original y67 lit floor walkable.'},
    publicBuildingAudit: publicAudit,
    operationCount: lightingOperations.length},
  operations: lightingOperations,
};
await writeFile(path.join(root, 'map/generated/visitor-floor-repair.json'), JSON.stringify(floorPlan));
await writeFile(path.join(root, 'map/generated/interior-lighting.json'), JSON.stringify(lightPlan));
await writeFile(path.join(root, 'verification/interior-repair-report.json'), JSON.stringify({
  sourceWorld: world,
  visitorCentre: {
    schematicStone: {y64: 4478, y65: 4328, y66: 4294},
    restoredStoneCells: sourceStone.length,
    existingConcretePreserved: preserved.length,
    entrance: 'South door at x=0..1,z=457 has stone-brick foot level y67. The original schematic stone at z=455,y66 restores a continuous y67 main-hall floor behind its z=456 stair.',
    mainHall: 'The source foundation consists of stone at y64-66; its top is walkable at y67. The imported iron upper floor at y74 and central atrium above y67 are unchanged.',
    existingLights: visitorLights,
  },
  station: {roofLights: stationLights.length, floorLights: stationFloorLights.length,
    floorCoverageEstimate: stationFloorCoverage,
    estimateNote: 'Manhattan distance from sampled walkable floor cells to the nearest recessed floor lamp; ignores light occlusion and is not an in-game light-level measurement.'},
  publicBuildings: publicAudit,
  planOperations: {visitorFloorRepair: floorOperations.length, interiorLighting: lightingOperations.length},
}, null, 2));
console.log(JSON.stringify({world, foundation: {restoredCells: sourceStone.length, preserved,
  beforeCounts, operations: floorOperations.length}, lighting: {stationRoofLights: stationLights.length,
  stationFloorLights: stationFloorLights.length, storeLights: storeLights.length,
  visitorExisting: visitorLights, visitorAdded: 0, publicBuildingAudit: publicAudit}}, null, 2));

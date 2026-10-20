import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedDir = path.join(ROOT, 'map', 'generated');
const id = block => block.includes(':') ? block : `minecraft:${block}`;
const key = (x, y, z) => `${x},${y},${z}`;
const xzKey = (x, z) => `${x},${z}`;
const rect = (x1, z1, x2, z2) => ({
  x1: Math.min(x1, x2), z1: Math.min(z1, z2),
  x2: Math.max(x1, x2), z2: Math.max(z1, z2),
});
const hit = (a, b, margin = 0) => a.x1 <= b.x2 + margin && a.x2 >= b.x1 - margin
  && a.z1 <= b.z2 + margin && a.z2 >= b.z1 - margin;

function coordDir(dx, dz) {
  if (dx > 0) return 'east';
  if (dx < 0) return 'west';
  if (dz > 0) return 'south';
  return 'north';
}

function flatShape(prev, point, next) {
  const a = coordDir(Math.sign(prev.x - point.x), Math.sign(prev.z - point.z));
  const b = coordDir(Math.sign(next.x - point.x), Math.sign(next.z - point.z));
  if (a === b) return a === 'east' || a === 'west' ? 'east_west' : 'north_south';
  const pair = [a, b].sort().join('_');
  return ({
    east_west: 'east_west',
    north_south: 'north_south',
    east_north: 'north_east',
    east_south: 'south_east',
    north_west: 'north_west',
    south_west: 'south_west',
  })[pair] || 'east_west';
}

/**
 * A route segment is deliberately axis-aligned. This makes every curve a
 * standard Minecraft rail corner while allowing elevation changes only on
 * straight sections.
 */
const segments = [
  // Station and east boulevard: the first climb puts the train above the
  // city street while leaving the station at the existing y=64 platform.
  { from: [0, 650], to: [120, 650], y1: 64, y2: 64, zone: 'city-station', name: 'station-approach' },
  { from: [120, 650], to: [360, 650], y1: 64, y2: 76, zone: 'city-east', name: 'east-climb' },
  { from: [360, 650], to: [600, 650], y1: 76, y2: 88, zone: 'city-east', name: 'east-overpass-climb' },
  { from: [600, 650], to: [780, 650], y1: 88, y2: 88, zone: 'city-east', name: 'east-city-boulevard' },
  // x=780 is the north/south service road between the two eastern building
  // bands. z=650 and z=-780 are road gaps, so the track crosses the city
  // without cutting through a building footprint.
  { from: [780, 650], to: [780, 430], y1: 88, y2: 82, zone: 'city-east', name: 'east-drop' },
  { from: [780, 430], to: [780, 80], y1: 82, y2: 82, zone: 'city-east', name: 'east-city-spine' },
  { from: [780, 80], to: [780, -260], y1: 82, y2: 94, zone: 'city-east', name: 'east-rise' },
  { from: [780, -260], to: [780, -780], y1: 94, y2: 94, zone: 'city-east', name: 'east-city-north' },
  // Long high-speed city crossing on the road gap between the -758 and -802
  // building bands. The fall is spread over enough blocks for valid slopes.
  { from: [780, -780], to: [600, -780], y1: 94, y2: 84, zone: 'city-north', name: 'north-drop-1' },
  { from: [600, -780], to: [340, -780], y1: 84, y2: 70, zone: 'city-north', name: 'north-drop-2' },
  // The eastern park edge passes all four eastern enclosures. The long rise
  // and fall are separated by flat straights before each corner.
  { from: [340, -780], to: [340, -620], y1: 70, y2: 66, zone: 'ankylosaurus', name: 'valley-entry' },
  { from: [340, -620], to: [340, -300], y1: 66, y2: 76, zone: 'ankylosaurus', name: 'east-rock-climb' },
  { from: [340, -300], to: [340, -30], y1: 76, y2: 76, zone: 'velociraptor', name: 'raptor-overlook' },
  { from: [340, -30], to: [340, 240], y1: 76, y2: 92, zone: 'dilophosaurus', name: 'east-canopy-rise' },
  { from: [340, 240], to: [340, 500], y1: 92, y2: 70, zone: 'tyrannosaurus', name: 'rex-drop' },
  { from: [340, 500], to: [340, 610], y1: 70, y2: 70, zone: 'tyrannosaurus', name: 'north-gate-approach' },
  { from: [340, 610], to: [-350, 610], y1: 70, y2: 70, zone: 'park-north', name: 'north-park-crossing' },
  // The western edge returns past all four western enclosures, then leaves
  // the park south of its perimeter and rejoins the west city road.
  { from: [-350, 610], to: [-350, 520], y1: 70, y2: 66, zone: 'triceratops', name: 'west-gate-drop' },
  { from: [-350, 520], to: [-350, 250], y1: 66, y2: 78, zone: 'triceratops', name: 'west-climb' },
  { from: [-350, 250], to: [-350, -50], y1: 78, y2: 78, zone: 'parasaurolophus', name: 'west-midline' },
  { from: [-350, -50], to: [-350, -350], y1: 78, y2: 66, zone: 'brachiosaurus', name: 'west-forest-drop' },
  { from: [-350, -350], to: [-310, -350], y1: 66, y2: 66, zone: 'stegosaurus', name: 'lake-approach' },
  { from: [-310, -350], to: [-310, -604], y1: 66, y2: 66, zone: 'stegosaurus', name: 'lake-overlook' },
  { from: [-310, -604], to: [-780, -604], y1: 66, y2: 82, zone: 'city-west', name: 'west-city-entry-climb' },
  { from: [-780, -604], to: [-780, 200], y1: 82, y2: 94, zone: 'city-west', name: 'west-city-rise' },
  { from: [-780, 200], to: [-780, 650], y1: 94, y2: 76, zone: 'city-west', name: 'west-city-drop' },
  { from: [-780, 650], to: [-350, 650], y1: 76, y2: 66, zone: 'city-west', name: 'west-boulevard-drop' },
  { from: [-350, 650], to: [0, 650], y1: 66, y2: 64, zone: 'city-station', name: 'station-return' },
];

const clearedPassages = [
  { name: 'east-south-gate', bounds: { x1: 337, y1: 64, z1: -592, x2: 343, y2: 74, z2: -592 } },
  { name: 'east-north-gate', bounds: { x1: 337, y1: 64, z1: 592, x2: 343, y2: 74, z2: 592 } },
  { name: 'west-north-gate', bounds: { x1: -353, y1: 64, z1: 592, x2: -347, y2: 74, z2: 592 } },
  { name: 'lake-south-gate', bounds: { x1: -313, y1: 64, z1: -592, x2: -307, y2: 74, z2: -592 } },
];

function makeRawPoints() {
  const points = [];
  for (let si = 0; si < segments.length; si += 1) {
    const s = segments[si];
    const [x1, z1] = s.from;
    const [x2, z2] = s.to;
    const n = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
    if (n === 0) throw new Error(`zero-length segment ${s.name}`);
    for (let i = si === 0 ? 0 : 1; i <= n; i += 1) {
      // The final segment returns to the station. Keep that station only at
      // index 0; the verifier closes the loop with modulo indexing.
      if (si === segments.length - 1 && i === n) continue;
      const t = i / n;
      const x = x1 + Math.sign(x2 - x1) * i;
      const z = z1 + Math.sign(z2 - z1) * i;
      const y = Math.round(s.y1 + (s.y2 - s.y1) * t);
      points.push({ x, y, z, zone: s.zone, segment: s.name });
    }
  }
  return points;
}

function decorateRoute(raw) {
  const points = raw.map((p, i) => {
    const prev = raw[(i - 1 + raw.length) % raw.length];
    const next = raw[(i + 1) % raw.length];
    const higher = [prev, next].filter(n => n.y > p.y);
    let shape;
    if (higher.length === 1) {
      const h = higher[0];
      shape = `ascending_${coordDir(Math.sign(h.x - p.x), Math.sign(h.z - p.z))}`;
    } else if (higher.length === 0) {
      shape = flatShape(prev, p, next);
    } else {
      shape = flatShape(prev, p, next);
    }
    const straight = shape === 'east_west' || shape === 'north_south' || shape.startsWith('ascending_');
    const powered = straight && i % 8 < 4;
    return { ...p, shape, powered };
  });
  return points;
}

function validateRoute(points) {
  const errors = [];
  const seen = new Set();
  let nonSequentialNearby = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const k = key(p.x, p.y, p.z);
    if (seen.has(k)) errors.push(`duplicate ${k}`);
    seen.add(k);
    const next = points[(i + 1) % points.length];
    if (Math.abs(p.x - next.x) + Math.abs(p.z - next.z) !== 1 || Math.abs(p.y - next.y) > 1) {
      errors.push(`non-adjacent ${k} -> ${key(next.x, next.y, next.z)}`);
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = points.findIndex((q, idx) => idx > i && q.x === p.x + dx && q.z === p.z + dz);
      if (j >= 0 && j !== (i + 1) % points.length && i !== (j + 1) % points.length) nonSequentialNearby += 1;
    }
    const prev = points[(i - 1 + points.length) % points.length];
    const nextPoint = points[(i + 1) % points.length];
    const higher = [prev, nextPoint].filter(n => n.y > p.y);
    if (higher.length > 1) errors.push(`valley slope ${k}`);
    if (higher.length === 1) {
      const h = higher[0];
      const expected = `ascending_${coordDir(Math.sign(h.x - p.x), Math.sign(h.z - p.z))}`;
      if (p.shape !== expected) errors.push(`slope shape ${k}: ${p.shape} != ${expected}`);
    } else if (p.shape.startsWith('ascending_')) errors.push(`unnecessary slope ${k}`);
    if (p.powered && !['east_west', 'north_south'].includes(p.shape) && !p.shape.startsWith('ascending_')) errors.push(`powered curve ${k}`);
    if (p.y !== prev.y || p.y !== nextPoint.y) {
      const turn = !((prev.x === p.x && nextPoint.x === p.x) || (prev.z === p.z && nextPoint.z === p.z));
      if (turn) errors.push(`slope-turn ${k}`);
    }
  }
  if (nonSequentialNearby) errors.push(`non-sequential adjacency ${nonSequentialNearby}`);
  return errors;
}

function boxBounds(op) {
  if (op.kind === 'sign') return { x1: op.x, x2: op.x, y1: op.y, y2: op.y, z1: op.z, z2: op.z, block: op.block || 'minecraft:oak_wall_sign' };
  if (op.kind !== 'box') return null;
  return {
    x1: Math.min(op.x1, op.x2), y1: Math.min(op.y1, op.y2), z1: Math.min(op.z1, op.z2),
    x2: Math.max(op.x1, op.x2), y2: Math.max(op.y1, op.y2), z2: Math.max(op.z1, op.z2),
    block: op.block,
  };
}

function buildSpatialIndex(operations) {
  const index = new Map();
  const bucket = 32;
  for (const op of operations) {
    const b = boxBounds(op);
    if (!b) continue;
    for (let bx = Math.floor(b.x1 / bucket); bx <= Math.floor(b.x2 / bucket); bx += 1) {
      for (let bz = Math.floor(b.z1 / bucket); bz <= Math.floor(b.z2 / bucket); bz += 1) {
        const k = `${bx},${bz}`;
        if (!index.has(k)) index.set(k, []);
        index.get(k).push(b);
      }
    }
  }
  return { index, bucket };
}

function finalBlockAt(spatial, x, y, z) {
  const { index, bucket } = spatial;
  const candidates = index.get(`${Math.floor(x / bucket)},${Math.floor(z / bucket)}`) || [];
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const b = candidates[i];
    if (b.x1 <= x && x <= b.x2 && b.y1 <= y && y <= b.y2 && b.z1 <= z && z <= b.z2) return b.block;
  }
  return null;
}

function lineOfSight(spatial, point, spawn) {
  const distance = Math.hypot(spawn.x - point.x, spawn.z - point.z);
  const steps = Math.ceil(distance * 2);
  for (let i = 2; i < steps - 2; i += 1) {
    const t = i / steps;
    const x = Math.floor(point.x + 0.5 + (spawn.x - point.x) * t);
    const y = Math.floor(point.y + 2 + (spawn.y - point.y) * t);
    const z = Math.floor(point.z + 0.5 + (spawn.z - point.z) * t);
    const block = finalBlockAt(spatial, x, y, z);
    if (block && !/(?:air|water|glass|iron_bars)/.test(block)) return false;
  }
  return true;
}

function buildOperations(full, oldRoute, points) {
  const operations = [];
  const stats = { oldRailClearCells: 0, rails: 0, poweredRails: 0, supportPillars: 0, supportBlocks: 0, headroomCells: 0, boundaryGates: 0, stationControlUpdates: 0, collisionCount: 0 };
  const oldSeen = new Set();
  for (let i = 0; i < oldRoute.points.length; i += 1) {
    const p = oldRoute.points[i];
    const k = xzKey(p.x, p.z);
    if (oldSeen.has(k)) continue;
    oldSeen.add(k);
    const clear = (y1, y2, replace) => operations.push({ kind: 'box', x1: p.x, y1, z1: p.z, x2: p.x, y2, z2: p.z, block: 'minecraft:air', replace });
    clear(p.y, p.y, 'minecraft:rail');
    clear(p.y, p.y, 'minecraft:powered_rail');
    clear(p.y - 2, p.y - 1, 'minecraft:stone_bricks');
    clear(p.y - 1, p.y - 1, 'minecraft:redstone_block');
    if (p.y > 68 && i % 12 === 0) clear(64, p.y - 3, 'minecraft:polished_andesite');
    stats.oldRailClearCells += 1;
  }
  const pillarCells = new Set();
  const put = (x1, y1, z1, x2, y2, z2, block) => operations.push({ kind: 'box', x1, y1, z1, x2, y2, z2, block: id(block) });
  for (const passage of clearedPassages) {
    const { x1, y1, z1, x2, y2, z2 } = passage.bounds;
    put(x1, y1, z1, x2, y2, z2, 'minecraft:air');
    stats.boundaryGates += 1;
  }
  // Clear the entire carriage envelope before putting down any new rail.
  // A later clearance operation must not erase an adjacent slope or support.
  for (const p of points) {
    put(p.x - 1, p.y, p.z - 1, p.x + 1, p.y + 3, p.z + 1, 'minecraft:air');
    stats.headroomCells += 27;
  }
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const support = p.powered ? 'minecraft:redstone_block' : 'minecraft:stone_bricks';
    put(p.x, p.y - 1, p.z, p.x, p.y - 1, p.z, support);
    stats.supportBlocks += 1;
    if (p.powered) stats.poweredRails += 1;
    // A bridge pier every 12 blocks keeps the overpass readable in the city
    // map while limiting block count. Never place a pier on the station pad.
    if (p.y >= 70 && i % 12 === 0 && !(p.x === 0 && p.z === 650)) {
      const pk = xzKey(p.x, p.z);
      if (!pillarCells.has(pk)) {
        put(p.x, 64, p.z, p.x, p.y - 2, p.z, 'minecraft:stone_bricks');
        pillarCells.add(pk);
        stats.supportPillars += 1;
      }
    }
  }
  for (const p of points) {
    const rail = p.powered ? 'minecraft:powered_rail' : 'minecraft:rail';
    put(p.x, p.y, p.z, p.x, p.y, p.z, `${rail}[shape=${p.shape}${p.powered ? ',powered=true' : ''}]`);
    stats.rails += 1;
  }
  const boardingSelector = '@e[type=minecraft:minecart,tag=park_boarding,sort=nearest,limit=1,distance=..4]';
  const launchCommand = `execute positioned 0 65 650 run data merge entity ${boardingSelector} {Motion:[0.28d,0.0d,0.0d]}`;
  operations.push({ kind: 'command', command: `data merge block -10 65 655 {Command:${JSON.stringify(launchCommand)},auto:1b}` });
  operations.push({ kind: 'sign', x: -2, y: 73, z: 665, block: 'minecraft:oak_wall_sign[facing=south]', lines: ['JURASSIC EXPRESS', '城市与八区观光', '完整环线'] });
  stats.stationControlUpdates = 2;
  return { operations, stats };
}

function staticChecks(full, oldRoute, points, operations) {
  const report = { routeErrors: validateRoute(points), buildingOverlaps: [], enclosureOverlaps: [], operationCollisions: [], citySegments: [], zoneVisibility: [] };
  const buildings = full.metadata.buildings || [];
  const enclosures = full.metadata.enclosures || [];
  for (const p of points) {
    const r = rect(p.x, p.z, p.x, p.z);
    const b = buildings.filter(item => hit(r, rect(item.bounds.x1, item.bounds.z1, item.bounds.x2, item.bounds.z2), 4));
    const e = enclosures.filter(item => hit(r, rect(item.bounds.x1, item.bounds.z1, item.bounds.x2, item.bounds.z2), 4));
    if (b.length) report.buildingOverlaps.push({ point: key(p.x, p.y, p.z), buildings: b.map(v => v.id) });
    if (e.length) report.enclosureOverlaps.push({ point: key(p.x, p.y, p.z), enclosures: e.map(v => v.id) });
  }
  const spatial = buildSpatialIndex(full.operations);
  for (const enclosure of enclosures) {
    const bounds = enclosure.bounds;
    const distanceToBounds = p => Math.hypot(Math.max(bounds.x1 - p.x, 0, p.x - bounds.x2), Math.max(bounds.z1 - p.z, 0, p.z - bounds.z2));
    const closestRailToFence = Math.min(...points.map(distanceToBounds));
    const spawns = full.operations.filter(o => o.kind === 'spawn' && o.x >= bounds.x1 && o.x <= bounds.x2 && o.z >= bounds.z1 && o.z <= bounds.z2);
    let closestSpawn = Infinity;
    let unobstructedSpawn = null;
    for (const spawn of spawns) {
      const nearby = points.map((p, i) => ({ i, d: Math.hypot(spawn.x - p.x, spawn.z - p.z) })).sort((a, b) => a.d - b.d);
      closestSpawn = Math.min(closestSpawn, nearby[0]?.d ?? Infinity);
      for (const { i, d } of nearby.slice(0, 24)) {
        if (d > 120) break;
        if (lineOfSight(spatial, points[i], spawn)) {
          if (!unobstructedSpawn || d < unobstructedSpawn.distance) unobstructedSpawn = { railIndex: i, spawn: key(spawn.x, spawn.y, spawn.z), distance: Math.round(d) };
          break;
        }
      }
    }
    report.zoneVisibility.push({ zone: enclosure.id, spawnCount: spawns.length, nearestFenceDistance: Math.round(closestRailToFence), nearestSpawnDistance: Math.round(closestSpawn), unobstructedSpawn });
  }
  // The patch explicitly clears old rails and their elevated support columns
  // first. Existing boxes on those exact x/z cells are therefore expected
  // replacement work, not a collision with the new route.
  const oldRouteXZ = new Map(oldRoute.points.map((p, i) => [xzKey(p.x, p.z), { ...p, index: i }]));
  for (const p of points) {
    const hits = [];
    for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) for (let y = p.y; y <= p.y + 3; y += 1) {
      const x = p.x + dx, z = p.z + dz;
      const block = finalBlockAt(spatial, x, y, z);
      if (!block || block === 'minecraft:air') continue;
      const old = oldRouteXZ.get(xzKey(x, z));
      const oldRail = old && y === old.y && /^minecraft:(?:powered_rail|rail)\[/.test(block);
      const oldSupport = old && y >= old.y - 2 && y <= old.y - 1 && (block === 'minecraft:stone_bricks' || block === 'minecraft:redstone_block');
      const oldPillar = old && old.y > 68 && old.index % 12 === 0 && y >= 64 && y <= old.y - 3 && block === 'minecraft:polished_andesite';
      const gate = clearedPassages.some(({ bounds: c }) => c.x1 <= x && x <= c.x2 && c.z1 <= z && z <= c.z2 && c.y1 <= y && y <= c.y2);
      if (!oldRail && !oldSupport && !oldPillar && !gate && hits.length < 3) hits.push({ at: key(x, y, z), block });
    }
    if (hits.length) {
      report.operationCollisions.push({ point: key(p.x, p.y, p.z), blocks: hits });
    }
  }
  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i];
    if (s.name.includes('city')) report.citySegments.push({ name: s.name, from: s.from, to: s.to, y1: s.y1, y2: s.y2 });
  }
  report.collisionCount = report.buildingOverlaps.length + report.enclosureOverlaps.length + report.operationCollisions.length;
  return report;
}

const fullBytes = await readFile(path.join(generatedDir, 'full.json'));
const full = JSON.parse(fullBytes);
const oldRouteBytes = await readFile(path.join(generatedDir, 'route.json'));
const oldRoute = JSON.parse(oldRouteBytes);
const raw = makeRawPoints();
const points = decorateRoute(raw);
const routeErrors = validateRoute(points);
if (routeErrors.length) throw new Error(`route generation failed: ${routeErrors.slice(0, 8).join('; ')}`);
const { operations, stats } = buildOperations(full, oldRoute, points);
const checks = staticChecks(full, oldRoute, points, operations);
const routeLength = points.length;
stats.collisionCount = checks.collisionCount;
const ascentSegments = segments.filter(s => s.y2 > s.y1);
const descentSegments = segments.filter(s => s.y2 < s.y1);
const cityPointCount = points.filter(p => p.zone.startsWith('city-')).length;
const stationCommands = full.operations.filter(o => o.kind === 'command').map(o => o.command);
const acceptance = {
  closedRideableGeometry: checks.routeErrors.length === 0,
  cityCrossing: cityPointCount >= 1000 && checks.citySegments.length >= 3,
  elevationAndDrops: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) >= 20 && ascentSegments.length >= 3 && descentSegments.length >= 3,
  eightEnclosureSightlines: checks.zoneVisibility.length === 8 && checks.zoneVisibility.every(z => z.unobstructedSpawn && z.nearestSpawnDistance <= 100),
  stationButtonPlan: stationCommands.some(c => c.includes('run summon minecraft:minecart')) && stationCommands.some(c => c.includes('run ride @p')) && operations.some(o => o.kind === 'command' && o.command.includes('Motion:[0.28d,0.0d,0.0d]')),
  basePlanCollisionFree: checks.collisionCount === 0,
  builtWorldRailAndClearance: 'pending',
  realMinecartLapAtLeast300Seconds: 'pending',
  playerBoardingButton: 'pending',
};
const metrics = {
  cityPointCount,
  parkPointCount: routeLength - cityPointCount,
  ascentSegments: ascentSegments.map(s => ({ name: s.name, rise: s.y2 - s.y1 })),
  descentSegments: descentSegments.map(s => ({ name: s.name, fall: s.y1 - s.y2 })),
  elevationMinY: Math.min(...points.map(p => p.y)),
  elevationMaxY: Math.max(...points.map(p => p.y)),
  estimatedSecondsAt8BlocksPerSecond: Math.round(routeLength / 8),
};
const output = {
  name: 'Jurassic City Coaster v2',
  routeVersion: 2,
  source: {
    fullSha256: createHash('sha256').update(fullBytes).digest('hex'),
    oldRouteSha256: createHash('sha256').update(oldRouteBytes).digest('hex'),
  },
  route: {
    name: 'Jurassic City Coaster',
    length: routeLength,
    station: { x: 0, y: 64, z: 650 },
    points,
    zones: full.route.zones,
    segments,
  },
  bounds: { x1: -1000, z1: -1000, x2: 1000, z2: 1000 },
  operations,
  metadata: {
    generatedAt: new Date().toISOString(),
    routeLength,
    baseFullSha256: createHash('sha256').update(fullBytes).digest('hex'),
    baseRouteSha256: createHash('sha256').update(oldRouteBytes).digest('hex'),
    estimatedRideSecondsAt8BlocksPerSecond: Math.round(routeLength / 8),
    elevation: { minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) },
    cityCrossing: {
      description: 'east and west boulevards, both city service spines, north city road and west south connector',
      segmentNames: checks.citySegments.map(s => s.name),
      roadGaps: ['z=650', 'x=780', 'z=-780', 'z=-604', 'x=-780'],
    },
    thrillFeatures: ['east city double climb', '94-to-70 north-city drop', '92-to-70 tyrannosaurus drop', 'west forest drop', 'west city climb and return drop', 'closed loop'],
    stats,
    staticChecks: checks,
    metrics,
    acceptance,
    applyOrder: ['clear-old-route-by-block-type', 'clear-boundary-gates', 'clear-carriage-envelope', 'place-supports-and-pillars', 'place-rails', 'update-station-control-and-sign', 'save-all'],
    clearedPassages,
  },
};
const outputPath = path.join(generatedDir, 'city-coaster-route.json');
const reportPath = path.join(ROOT, 'verification', 'city-coaster-route-report.json');
await writeFile(reportPath, `${JSON.stringify({ name: output.name, routeLength, stats, metrics, acceptance, staticChecks: checks }, null, 2)}\n`);
if (Object.values(acceptance).some(value => value === false)) throw new Error('city coaster static acceptance failed; see city-coaster-route-report.json');
await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(JSON.stringify({ routeLength, estimatedRideSeconds: Math.round(routeLength / 8), elevation: output.metadata.elevation, stats, staticChecks: { routeErrors: checks.routeErrors.length, buildingOverlaps: checks.buildingOverlaps.length, enclosureOverlaps: checks.enclosureOverlaps.length, operationCollisions: checks.operationCollisions.length } }, null, 2));

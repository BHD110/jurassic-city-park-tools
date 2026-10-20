#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a.startsWith('--')) args.set(a, process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : true);
}

const mode = String(args.get('--mode') || (args.has('--sample') ? 'sample' : 'full'));
const root = path.resolve(String(args.get('--root') || ROOT));
const generated = path.join(root, 'map', 'generated');
const verificationDir = path.join(root, 'verification');
fs.mkdirSync(verificationDir, { recursive: true });

const checks = [];
function check(id, ok, detail, severity = ok ? 'pass' : 'error') {
  checks.push({ id, status: ok ? 'pass' : severity, detail });
}
function warning(id, detail) { check(id, false, detail, 'warning'); }
function key(x, y, z) { return `${x},${y},${z}`; }
function xzKey(x, z) { return `${x},${z}`; }
function num(v) { return v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v); }
function coord(c) { return c && [num(c.x), num(c.y), num(c.z)].every(v => v !== null) ? { x: num(c.x), y: num(c.y), z: num(c.z) } : null; }

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

const mapFile = path.join(generated, `${mode}.json`);
const mapData = readJson(mapFile);
let route = null;
const routeCandidates = mode === 'sample'
  ? [path.join(generated, 'route-sample.json'), path.join(generated, 'route.json')]
  : [path.join(generated, 'route.json')];
for (const f of routeCandidates) {
  const parsed = readJson(f);
  if (parsed) { route = parsed.route || parsed; break; }
}

if (!mapData && !route) {
  check('input', false, `未找到 ${mapFile} 或路线 JSON；等待 map/generate.mjs 产物`);
} else {
  if (!mapData) warning('map-file', `未找到 ${mapFile}，仅检查路线文件`);
  if (!route) check('route-file', false, `未找到 ${routeCandidates.join(' 或 ')}`);
}

const operations = Array.isArray(mapData?.operations)
  ? mapData.operations
  : Array.isArray(mapData?.jobs) ? mapData.jobs
  : Array.isArray(mapData) ? mapData : [];
const metadata = mapData?.metadata || mapData?.meta || {};

function boundsOf(v) {
  const b = v?.bounds || v?.box || v;
  if (!b) return null;
  const x1 = num(b.x1 ?? b.minX), y1 = num(b.y1 ?? b.minY), z1 = num(b.z1 ?? b.minZ);
  const x2 = num(b.x2 ?? b.maxX), y2 = num(b.y2 ?? b.maxY), z2 = num(b.z2 ?? b.maxZ);
  if ([x1, y1, z1, x2, y2, z2].some(vv => vv === null)) return null;
  return { x1: Math.min(x1, x2), y1: Math.min(y1, y2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), y2: Math.max(y1, y2), z2: Math.max(z1, z2) };
}

function operationBox(op) {
  const b = boundsOf(op);
  if (!b) return null;
  const block = String(op.block ?? op.blockId ?? op.material ?? op.value ?? '').toLowerCase();
  if (!block || op.kind === 'spawn' || op.kind === 'sign') return null;
  return { ...b, block, order: 0 };
}
function parseSetblock(command) {
  if (typeof command !== 'string') return null;
  const m = command.match(/(?:setblock|fill)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)(?:\s+(-?\d+)\s+(-?\d+)\s+(-?\d+))?\s+([\w:.-]+)/i);
  if (!m) return null;
  const x1 = Number(m[1]), y1 = Number(m[2]), z1 = Number(m[3]);
  const x2 = m[4] === undefined ? x1 : Number(m[4]);
  const y2 = m[5] === undefined ? y1 : Number(m[5]);
  const z2 = m[6] === undefined ? z1 : Number(m[6]);
  return boundsOf({ x1, y1, z1, x2, y2, z2, block: m[7] }) && { x1: Math.min(x1, x2), y1: Math.min(y1, y2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), y2: Math.max(y1, y2), z2: Math.max(z1, z2), block: m[7].toLowerCase() };
}

const boxes = [];
for (const op of operations) {
  const b = operationBox(op);
  if (b) boxes.push({ ...b, order: boxes.length });
  const command = op.command || op.cmd;
  const parsed = parseSetblock(command);
  if (parsed) boxes.push({ ...parsed, order: boxes.length });
}

// A small x/z bucket index keeps final block lookups cheap even when a map has many fill boxes.
const bucketSize = 32;
const boxBuckets = new Map();
for (const b of boxes) {
  for (let bx = Math.floor(b.x1 / bucketSize); bx <= Math.floor(b.x2 / bucketSize); bx += 1) {
    for (let bz = Math.floor(b.z1 / bucketSize); bz <= Math.floor(b.z2 / bucketSize); bz += 1) {
      const k = `${bx},${bz}`;
      if (!boxBuckets.has(k)) boxBuckets.set(k, []);
      boxBuckets.get(k).push(b);
    }
  }
}
function blockAt(x, y, z) {
  const candidates = boxBuckets.get(`${Math.floor(x / bucketSize)},${Math.floor(z / bucketSize)}`) || [];
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const b = candidates[i];
    if (x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2 && z >= b.z1 && z <= b.z2) return b.block;
  }
  return null;
}
function isAir(block) { return block === null || block === 'air' || block === 'minecraft:air' || block === 'cave_air' || block === 'minecraft:cave_air'; }
function isSupport(block) { return !!block && !isAir(block) && !/(rail|fence|leaves|water|lava|glass_pane|carpet|slab|stairs|sign|button|torch|flower|grass\b)/.test(block); }
function isRail(block) { return !!block && /^minecraft:(?:powered_)?rail\[/.test(block); }

const rawPoints = Array.isArray(route?.points) ? route.points : [];
const points = rawPoints.map(coord).filter(Boolean);
const shapeNames = new Set(['north_south', 'east_west', 'ascending_east', 'ascending_west', 'ascending_north', 'ascending_south', 'south_east', 'south_west', 'north_east', 'north_west']);
const straight = new Set(['north_south', 'east_west']);
const curve = new Set(['south_east', 'south_west', 'north_east', 'north_west']);
const dirName = (dx, dz) => dx === 1 ? 'east' : dx === -1 ? 'west' : dz === 1 ? 'south' : 'north';
function adjacent(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1 && Math.abs(a.y - b.y) <= 1; }
function sequential(i, j, n) { return j === (i + 1) % n || i === (j + 1) % n; }

if (route && points.length) {
  const invalidPoints = rawPoints.length - points.length;
  const fractionalPoints = points.filter(p => !Number.isInteger(p.x) || !Number.isInteger(p.y) || !Number.isInteger(p.z)).length;
  check('route-coordinates', invalidPoints === 0 && fractionalPoints === 0, `无效坐标 ${invalidPoints} 个，非整数方块坐标 ${fractionalPoints} 个`);
  const expectedLength = num(route.length);
  const minLength = mode === 'sample' ? 4 : 3200;
  const maxLength = mode === 'sample' ? 100000 : 3600;
  check('route-length', expectedLength !== null && expectedLength >= minLength && expectedLength <= maxLength, `声明长度 ${expectedLength ?? '缺失'}，要求 ${minLength}-${maxLength}`);
  check('route-point-count', expectedLength === points.length && (num(metadata.routeLength) === null || num(metadata.routeLength) === points.length), `声明 ${expectedLength ?? '缺失'}，实际 ${points.length}，metadata ${metadata.routeLength ?? '未填'}`);
  const seen = new Map();
  let duplicate = 0;
  points.forEach((p, i) => { const k = key(p.x, p.y, p.z); if (seen.has(k)) duplicate += 1; else seen.set(k, i); });
  check('route-duplicates', duplicate === 0, duplicate ? `发现 ${duplicate} 个重复轨道坐标` : '轨道坐标无重复');
  let badAdj = 0;
  const badAdjExamples = [];
  for (let i = 0; i < points.length; i += 1) if (!adjacent(points[i], points[(i + 1) % points.length])) {
    badAdj += 1;
    if (badAdjExamples.length < 5) badAdjExamples.push(`${i}:${key(points[i].x, points[i].y, points[i].z)} -> ${key(points[(i + 1) % points.length].x, points[(i + 1) % points.length].y, points[(i + 1) % points.length].z)}`);
  }
  check('route-closure', badAdj === 0, badAdj ? `${badAdj} 段不满足水平曼哈顿相邻或坡高差；${badAdjExamples.join('；')}` : '首尾闭合且每段相邻');
  let nearby = 0;
  const pointByXZ = new Map();
  points.forEach((p, i) => { const k = xzKey(p.x, p.z); if (!pointByXZ.has(k)) pointByXZ.set(k, []); pointByXZ.get(k).push(i); });
  points.forEach((p, i) => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (const j of pointByXZ.get(xzKey(p.x + dx, p.z + dz)) || []) {
        if (j > i && !sequential(i, j, points.length) && adjacent(p, points[j])) nearby += 1;
      }
    }
  });
  check('non-sequential-adjacency', nearby === 0, nearby ? `${nearby} 对非顺序轨道相邻，可能触发 Minecraft 自动连接` : '没有非顺序相邻轨道');

  let shapeBad = 0, connectionShapeBad = 0, slopeShapeBad = 0, slopeTurn = 0, poweredBad = 0, supportUnknown = 0, supportBad = 0, headroomBad = 0, headroomUnknown = 0, railBlockBad = 0;
  const examples = { shape: [], power: [], support: [], headroom: [], rail: [] };
  const example = (type, p) => { if (examples[type].length < 5) examples[type].push(key(p.x, p.y, p.z)); };
  const poweredPoints = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const raw = route.points[i];
    const shape = String(raw?.shape || '').toLowerCase();
    const powered = raw?.powered === true || raw?.powered === 'true';
    if (!shapeNames.has(shape)) shapeBad += 1;
    const prev = points[(i - 1 + points.length) % points.length], next = points[(i + 1) % points.length];
    const d1 = dirName(Math.sign(prev.x - p.x), Math.sign(prev.z - p.z));
    const d2 = dirName(Math.sign(next.x - p.x), Math.sign(next.z - p.z));
    const pair = [d1, d2].sort().join('_');
    const expectedFlat = ({ east_north: 'north_east', east_south: 'south_east' })[pair] || pair;
    const turn = curve.has(expectedFlat);
    if (prev.y === p.y && next.y === p.y && shape !== expectedFlat) { connectionShapeBad += 1; example('shape', p); }
    if ((p.y !== prev.y || p.y !== next.y) && turn) slopeTurn += 1;
    const higher = [prev, next].filter(n => n.y > p.y);
    if (higher.length > 1) slopeShapeBad += 1;
    if (higher.length === 1) {
      const h = higher[0];
      if (shape !== `ascending_${dirName(Math.sign(h.x - p.x), Math.sign(h.z - p.z))}`) slopeShapeBad += 1;
    }
    if (higher.length === 0 && (prev.y !== p.y || next.y !== p.y)) {
      const lower = [prev, next].find(n => n.y < p.y);
      const expectedHighEnd = lower ? `ascending_${dirName(Math.sign(lower.x - p.x), Math.sign(lower.z - p.z))}` : expectedFlat;
      if (!(straight.has(shape) || shape === expectedHighEnd)) slopeShapeBad += 1;
    }
    const railBlock = blockAt(p.x, p.y, p.z);
    if (!isRail(railBlock) || !railBlock.includes(`shape=${shape}`) || powered !== railBlock.startsWith('minecraft:powered_rail[')) { railBlockBad += 1; example('rail', p); }
    if (powered) { poweredPoints.push(i); if ((!straight.has(shape) && !shape.startsWith('ascending_')) || blockAt(p.x, p.y - 1, p.z) !== 'minecraft:redstone_block' || !railBlock?.includes('powered=true')) { poweredBad += 1; example('power', p); } }
    const support = blockAt(p.x, p.y - 1, p.z);
    if (support === null) supportUnknown += 1; else if (!isSupport(support)) { supportBad += 1; example('support', p); }
    const overhead = [blockAt(p.x, p.y + 1, p.z), blockAt(p.x, p.y + 2, p.z)];
    if (overhead.some(b => b !== null && !isAir(b))) { headroomBad += 1; example('headroom', p); }
    if (overhead.some(b => b === null)) headroomUnknown += 1;
  }
  check('rail-shapes', shapeBad === 0, `${shapeBad} 个轨道 shape 缺失或非法`);
  check('connection-shapes', connectionShapeBad === 0, `${connectionShapeBad} 个平地轨道形状与相邻轨道方向不符；例：${examples.shape.join('、')}`);
  check('slope-shapes', slopeShapeBad === 0, `${slopeShapeBad} 个坡段的 ascending 方向与高低端不一致`);
  check('slope-turns', slopeTurn === 0, `${slopeTurn} 个坡段同时转弯，上下坡必须保持直线`);
  check('rail-blocks', railBlockBad === 0, `${railBlockBad} 个路线点的最终方块不是声明的铁轨或形状不符；例：${examples.rail.join('、')}`);
  check('powered-rail', poweredBad === 0, `${poweredPoints.length} 个动力轨道中 ${poweredBad} 个未满足直线或红石块供电；例：${examples.power.join('、')}`);
  if (supportUnknown) warning('rail-support-data', `${supportUnknown} 个轨道下方方块在 operations 中未知，无法完全确认支撑`);
  check('rail-support', supportBad === 0, `${supportBad} 个轨道下方不是可接受支撑方块；例：${examples.support.join('、')}`);
  check('headroom', headroomBad === 0, `${headroomBad} 个轨道头顶 2 格存在障碍；例：${examples.headroom.join('、')}`);
  if (headroomUnknown) warning('headroom-data', `${headroomUnknown} 个轨道头顶净空未在 operations 中明确写出`);

  const station = coord(route.station);
  if (station) {
    check('station-on-route', points.some(p => p.x === station.x && p.z === station.z && Math.abs(p.y - station.y) <= 1), `站台 ${key(station.x, station.y, station.z)} 附近${points.some(p => p.x === station.x && p.z === station.z && Math.abs(p.y - station.y) <= 1) ? '有' : '没有'}轨道`);
    let occupied = 0, unknown = 0;
    for (let x = station.x - 2; x <= station.x + 2; x += 1) for (let z = station.z - 2; z <= station.z + 2; z += 1) for (let y = station.y + 1; y <= station.y + 2; y += 1) {
      const b = blockAt(x, y, z); if (b === null) unknown += 1; else if (!isAir(b)) occupied += 1;
    }
    check('station-clearance', occupied === 0, `站台上方净空障碍 ${occupied} 格`);
    if (unknown) warning('station-data', `站台净空有 ${unknown} 格未在 operations 中给出`);
  } else warning('station', 'route.station 缺失，跳过站台净空');

  const buildings = Array.isArray(metadata.buildings) ? metadata.buildings : [];
  let buildingOverlap = 0;
  for (let i = 0; i < buildings.length; i += 1) for (let j = i + 1; j < buildings.length; j += 1) {
    const a = boundsOf(buildings[i]), b = boundsOf(buildings[j]);
    if (a && b && a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1 && a.z1 <= b.z2 && a.z2 >= b.z1) buildingOverlap += 1;
  }
  check('building-overlap', buildingOverlap === 0, `建筑占地重叠 ${buildingOverlap} 对`);
  const enclosures = Array.isArray(metadata.enclosures) ? metadata.enclosures : [];
  if (mode === 'full') check('enclosure-count', enclosures.length >= 8, `全图围场 ${enclosures.length} 个，要求至少 8 个`);
  const railDistance = num(metadata.minRailDistance) ?? 5;
  let enclosureNear = 0;
  for (const e of enclosures) {
    const b = boundsOf(e); if (!b) continue;
    let d = Infinity;
    for (const p of points) { const dx = Math.max(b.x1 - p.x, 0, p.x - b.x2), dz = Math.max(b.z1 - p.z, 0, p.z - b.z2); d = Math.min(d, dx + dz); }
    if (d < railDistance) enclosureNear += 1;
  }
  check('enclosure-rail-distance', enclosureNear === 0, `${enclosureNear} 个围场距轨道小于 ${railDistance} 格`);
  const zones = Array.isArray(route.zones) ? route.zones : [];
  check('zone-index', zones.length >= enclosures.length && enclosures.every(e => zones.some(z => z.id === e.id)), `围场 ${enclosures.length} 个，路线展示区 ${zones.length} 个；每个围场均需对应展示区`);
  let zoneUncovered = 0, zoneDinosaurShortfall = 0;
  const visibilityDistance = num(metadata.maxZoneRailDistance) ?? 64;
  const dinosaurs = operations.filter(o => String(o.kind || '').toLowerCase() === 'spawn' && String(o.entity || '').startsWith('jurassicreborn:') && coord(o));
  for (const z of zones) {
    const z1 = num(z.x1 ?? z.bounds?.x1), z2 = num(z.x2 ?? z.bounds?.x2), zz1 = num(z.z1 ?? z.bounds?.z1), zz2 = num(z.z2 ?? z.bounds?.z2);
    if ([z1, z2, zz1, zz2].some(v => v === null)) { zoneUncovered += 1; continue; }
    const covered = points.some(p => Math.max(Math.min(z1, z2) - p.x, 0, p.x - Math.max(z1, z2)) + Math.max(Math.min(zz1, zz2) - p.z, 0, p.z - Math.max(zz1, zz2)) <= visibilityDistance);
    if (!covered) zoneUncovered += 1;
    const required = num(z.minVisibleDinosaurs);
    if (required !== null) {
      const visible = dinosaurs.filter(o => o.x >= Math.min(z1, z2) && o.x <= Math.max(z1, z2) && o.z >= Math.min(zz1, zz2) && o.z <= Math.max(zz1, zz2) && (!Array.isArray(z.species) || z.species.includes(o.entity))).length;
      if (visible < required) zoneDinosaurShortfall += 1;
    }
  }
  check('zone-coverage', zoneUncovered === 0, `${zoneUncovered} 个展示区距轨道超过 ${visibilityDistance} 格`);
  check('zone-dinosaurs', zoneDinosaurShortfall === 0, `${zoneDinosaurShortfall} 个展示区恐龙数量或物种不足`);
  if (mode === 'full') {
    const maxSpawnDistance = 55;
    const shortfalls = [];
    for (const e of enclosures) {
      const species = Array.isArray(e.species) ? e.species : [];
      const required = ['brachiosaurus', 'tyrannosaurus'].includes(e.id) ? 3 : 4;
      const near = dinosaurs.filter(o => species.includes(o.entity) && points.some(p =>
        Math.hypot(o.x - p.x, o.y - (p.y + 1.5), o.z - p.z) <= maxSpawnDistance
      )).length;
      if (near < required) shortfalls.push(`${e.id} ${near}/${required}`);
    }
    check('spawn-to-route-distance', shortfalls.length === 0,
      shortfalls.length ? `出生点距实际轨道 ${maxSpawnDistance} 格内不足：${shortfalls.join('、')}` :
        `八个展示区的实际出生点均满足距轨道 ${maxSpawnDistance} 格内至少 4 只，腕龙和霸王龙至少 3 只`);
  }
  const expectedDino = num(metadata.expectedDinosaurCount);
  if (expectedDino !== null) {
    const entities = metadata.dinosaurs || metadata.entities;
    const spawnCount = dinosaurs.length;
    const actual = Array.isArray(entities) ? entities.length : spawnCount;
    check('dinosaur-count', actual >= expectedDino, `恐龙数量 ${actual}，期望至少 ${expectedDino}`);
  }
} else if (route) {
  check('route-points', false, 'route.points 缺失或为空');
}

const timingFile = path.join(root, 'runtime', 'server', mode === 'sample' ? 'parkbuild-sample-railtest.json' : 'parkbuild-railtest.json');
const timing = readJson(timingFile);
if (!timing) warning('runtime-timing', `未找到 ${timingFile}；需要服务端 railtest 实测日志`);
else {
  const propertiesFile = path.join(root, 'runtime', 'server', 'server.properties');
  const levelLine = fs.existsSync(propertiesFile) ? fs.readFileSync(propertiesFile, 'utf8').split(/\r?\n/).find(line => line.startsWith('level-name=')) : null;
  const expectedWorld = levelLine?.slice('level-name='.length) || null;
  const selectedRouteFile = routeCandidates.find(file => readJson(file));
  const sha256 = file => fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
  const expectedPlanHash = sha256(mapFile);
  const expectedRouteHash = selectedRouteFile ? sha256(selectedRouteFile) : null;
  const provenance = expectedWorld !== null && timing.worldName === expectedWorld
    && timing.planName === mapData?.name && timing.planSha256 === expectedPlanHash
    && timing.routeSha256 === expectedRouteHash;
  check('runtime-provenance', provenance, `报告世界 ${timing.worldName ?? '缺失'}，当前世界 ${expectedWorld ?? '缺失'}；计划和路线 SHA256 ${provenance ? '吻合' : '不吻合或缺失'}`);
  const elapsed = num(timing.elapsedSeconds);
  const laps = num(timing.completedLaps);
  const ticks = num(timing.serverTicks);
  const start = Date.parse(timing.startedAt), end = Date.parse(timing.endedAt);
  const timestampDuration = Number.isFinite(start) && Number.isFinite(end) ? (end - start) / 1000 : null;
  const observations = Array.isArray(timing.observations) ? timing.observations : [];
  const credible = timing.source === 'server-minecart' && timing.result === 'completed' && ticks !== null && ticks >= 6000 && timestampDuration !== null && timestampDuration >= 300 && elapsed !== null && Math.abs(timestampDuration - elapsed) <= 3 && laps !== null && laps >= 1 && observations.length >= 2 && observations.some(o => num(o.atSeconds) !== null && num(o.atSeconds) >= 300);
  check('runtime-timing', credible, `服务端实测 ${elapsed ?? '缺失'} 秒、${ticks ?? '缺失'} tick，时间戳相差 ${timestampDuration ?? '缺失'} 秒，${laps ?? '缺失'} 圈，观察记录 ${observations.length} 条；要求至少 300 秒和 1 圈`);
  if (points.length && observations.length) {
    const routeCells = new Set(points.map(p => xzKey(p.x, p.z)));
    const located = observations.filter(o => coord(o));
    const onRoute = located.filter(o => {
      for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
        if (routeCells.has(xzKey(Math.floor(o.x) + dx, Math.floor(o.z) + dz))) return true;
      }
      return false;
    }).length;
    check('runtime-position', located.length >= 2 && onRoute / located.length >= 0.9, `${onRoute}/${located.length} 条服务端坐标靠近规划轨道`);
  }
}

const errors = checks.filter(c => c.status === 'error');
const warnings = checks.filter(c => c.status === 'warning');
const report = { mode, generatedAt: new Date().toISOString(), input: { mapFile, routeCandidates, operations: operations.length }, summary: { status: errors.length ? 'failed' : warnings.length ? 'pending' : 'passed', errors: errors.length, warnings: warnings.length, passed: checks.filter(c => c.status === 'pass').length }, checks };
fs.writeFileSync(path.join(verificationDir, `report-${mode}.json`), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(verificationDir, 'report.json'), JSON.stringify(report, null, 2));
const lines = [`# 地图验收报告（${mode}）`, `生成时间：${report.generatedAt}`, `状态：${report.summary.status}`, `通过 ${report.summary.passed}，警告 ${report.summary.warnings}，错误 ${report.summary.errors}`, ''];
for (const c of checks) lines.push(`- [${c.status === 'pass' ? '通过' : c.status === 'warning' ? '待补数据' : '失败'}] ${c.id}：${c.detail}`);
fs.writeFileSync(path.join(verificationDir, `report-${mode}.md`), `${lines.join('\n')}\n`);
fs.writeFileSync(path.join(verificationDir, 'report.md'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
process.exitCode = errors.length ? 1 : 0;

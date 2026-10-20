import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = block => block.includes(':') ? block : `minecraft:${block}`;
const rect = (x1, z1, x2, z2) => ({ x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2) });
const hit = (a, b, margin = 0) => a.x1 <= b.x2 + margin && a.x2 >= b.x1 - margin && a.z1 <= b.z2 + margin && a.z2 >= b.z1 - margin;
const chunk = n => Math.floor(n / 16);

/** Build additive scenery for the open middle of the park. The full plan is read-only. */
export function buildCentralDetails(full) {
  if (!full?.operations || !full.metadata?.buildings || !full.metadata?.enclosures || !full.route?.points) {
    throw new Error('central park details require full.json with buildings, enclosures and route');
  }
  const operations = [];
  const features = [];
  const stats = { boardwalks: 0, platforms: 0, shelters: 0, kiosks: 0, bridges: 0, groves: 0, trees: 0, shrubs: 0, lamps: 0, signs: 0, streamCells: 0, operations: 0, rejected: 0 };
  const occupied = new Map();
  const water = new Map();
  const putIndex = (map, op, footprint = null) => {
    const r = footprint || rect(op.x1, op.z1, op.x2, op.z2);
    for (let cz = chunk(r.z1); cz <= chunk(r.z2); cz++) for (let cx = chunk(r.x1); cx <= chunk(r.x2); cx++) {
      const key = `${cx},${cz}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(op);
    }
  };
  for (const op of full.operations) {
    if (op.kind !== 'box' || op.block === 'minecraft:air') continue;
    const r = rect(op.x1, op.z1, op.x2, op.z2);
    // A y=63 terrain/road slab is the ground plane and does not block a
    // structure footprint. Raised blocks (y2 >= 64) are real obstacles.
    if (op.y2 >= 64 && op.y1 <= 88) putIndex(occupied, op);
    if (/water/.test(op.block) && op.y2 >= 63 && op.y1 <= 70) putIndex(water, op);
  }
  const protectedAreas = [
    ...full.metadata.buildings.map(b => rect(b.bounds.x1 - 8, b.bounds.z1 - 8, b.bounds.x2 + 8, b.bounds.z2 + 8)),
    ...full.metadata.enclosures.map(e => rect(e.bounds.x1 - 8, e.bounds.z1 - 8, e.bounds.x2 + 8, e.bounds.z2 + 8)),
    rect(-42, 236, 42, 304), // control center
    rect(-72, 398, 72, 493), // visitor center
    rect(-20, -500, 20, -440), // hatchery
    rect(-18, -330, 18, 560), // central north-south avenue
    rect(-300, -18, 300, 18), // central east-west avenue
  ];
  for (let i = 0; i < full.route.points.length - 1; i++) {
    const a = full.route.points[i], b = full.route.points[i + 1];
    protectedAreas.push(rect(Math.min(a.x, b.x) - 8, Math.min(a.z, b.z) - 8, Math.max(a.x, b.x) + 8, Math.max(a.z, b.z) + 8));
  }
  const central = rect(-300, -330, 300, 560);
  const nearby = (map, r) => [...new Set([...Array.from({ length: chunk(r.x2) - chunk(r.x1) + 1 }, (_, i) => chunk(r.x1) + i)].flatMap(cx => {
    const cells = [];
    for (let cz = chunk(r.z1); cz <= chunk(r.z2); cz++) cells.push(...(map.get(`${cx},${cz}`) || []));
    return cells;
  }))];
  const canPlace = (r, clearance = 1) => {
    if (!hit(r, central)) return false;
    if (protectedAreas.some(area => hit(r, area, clearance))) return false;
    if (features.some(area => hit(r, area, clearance))) return false;
    if (nearby(occupied, r).some(op => hit(r, rect(op.x1, op.z1, op.x2, op.z2)))) return false;
    if (nearby(water, r).some(op => hit(r, rect(op.x1, op.z1, op.x2, op.z2)))) return false;
    return true;
  };
  const box = (x1, y1, z1, x2, y2, z2, block) => operations.push({ kind: 'box', x1, y1, z1, x2, y2, z2, block: id(block) });
  const sign = (x, y, z, lines, facing = 'south') => { operations.push({ kind: 'sign', x, y, z, lines, block: `minecraft:oak_wall_sign[facing=${facing}]` }); stats.signs++; };
  const lamp = (x, z, h = 4) => { box(x, 64, z, x, 64 + h, z, 'oak_fence'); box(x, 64 + h, z, x, 64 + h, z, 'lantern'); stats.lamps++; };
  const reserve = r => { features.push(r); return r; };
  let seed = 731993;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const integer = (a, b) => a + Math.floor(random() * (b - a + 1));
  const choose = items => items[Math.floor(random() * items.length)];
  const attempt = (r, make) => { if (!canPlace(r, 1)) { stats.rejected++; return false; } reserve(r); make(); return true; };

  function tree(x, z, scale = 1) {
    const h = integer(8, 13) + Math.round(scale * 2), reach = scale > 1 ? 5 : 4;
    box(x, 64, z, x, 63 + h, z, choose(['jungle_log', 'stripped_jungle_log']));
    for (const [dy, r] of [[-2, reach - 1], [-1, reach], [1, reach - 1], [3, 2]]) {
      for (let dz = -r; dz <= r; dz++) {
        const span = Math.floor(Math.sqrt(Math.max(0, r * r - dz * dz)));
        box(x - span, 63 + h + dy, z + dz, x + span, 63 + h + dy, z + dz, 'jungle_leaves[persistent=true]');
      }
    }
    stats.trees++;
  }
  function grove(cx, cz, radius, count) {
    const before = stats.trees;
    for (let i = 0; i < count; i++) {
      let done = false;
      for (let tries = 0; tries < 80 && !done; tries++) {
        const a = random() * Math.PI * 2, rr = Math.sqrt(random()) * radius;
        const x = Math.round(cx + Math.cos(a) * rr), z = Math.round(cz + Math.sin(a) * rr), r = rect(x - 6, z - 6, x + 6, z + 6);
        done = attempt(r, () => tree(x, z, i % 4 === 0 ? 1.3 : 1));
      }
    }
    if (stats.trees > before) stats.groves++;
  }
  function shrub(x, z) { box(x, 64, z, x, 64, z, choose(['fern', 'large_fern', 'azalea_leaves[persistent=true]', 'flowering_azalea_leaves[persistent=true]'])); stats.shrubs++; }

  // A shallow planted stream creates a visual spine and three small crossing points.
  const stream = [];
  for (let z = -300; z <= 210; z++) {
    const x = Math.round(-60 + 22 * Math.sin(z / 64));
    for (let dx = -1; dx <= 1; dx++) stream.push({ x: x + dx, z });
  }
  // Keep the channel continuous where the existing plan leaves room. A single
  // blocked cell must not discard the entire water feature.
  for (const { x, z } of stream) {
    const cell = rect(x, z, x, z);
    if (!canPlace(cell, 0)) continue;
    box(x, 63, z, x, 63, z, 'mossy_cobblestone');
    box(x, 64, z, x, 64, z, 'water');
    stats.streamCells++;
  }
  for (let z = -290; z <= 200; z += 17) {
    const x = Math.round(-60 + 22 * Math.sin(z / 64));
    const site = rect(x + (z % 2 ? 3 : -3), z, x + (z % 2 ? 3 : -3), z);
    if (canPlace(site, 0)) { reserve(site); shrub(site.x1, site.z1); }
  }
  for (const z of [-250, -95, 75]) {
    const x = Math.round(-60 + 22 * Math.sin(z / 64));
    const r = rect(x - 3, z - 3, x + 3, z + 3);
    attempt(r, () => {
      box(x - 3, 65, z - 2, x + 3, 65, z + 2, 'spruce_planks');
      for (const px of [x - 3, x + 3]) for (const pz of [z - 2, z + 2]) box(px, 66, pz, px, 67, pz, 'spruce_fence');
      stats.bridges++;
    });
  }
  // Search the free stream sections for two crossings if the named scenic
  // points were occupied by an earlier enclosure detail.
  for (const target of [-210, 35]) {
    if (stats.bridges >= 2) break;
    for (let dz = -55; dz <= 55 && stats.bridges < 2; dz += 5) {
      const z = target + dz, x = Math.round(-60 + 22 * Math.sin(z / 64));
      const r = rect(x - 3, z - 3, x + 3, z + 3);
      attempt(r, () => {
        box(x - 3, 65, z - 2, x + 3, 65, z + 2, 'spruce_planks');
        for (const px of [x - 3, x + 3]) for (const pz of [z - 2, z + 2]) box(px, 66, pz, px, 67, pz, 'spruce_fence');
        stats.bridges++;
      });
    }
  }

  function boardwalk(x1, z1, x2, z2, label) {
    const r = rect(Math.min(x1, x2) - 3, Math.min(z1, z2) - 3, Math.max(x1, x2) + 3, Math.max(z1, z2) + 3);
    attempt(r, () => {
      box(x1, 65, z1, x2, 65, z2, 'spruce_planks');
      const step = x1 === x2 ? 8 : 10;
      if (x1 === x2) for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z += step) { box(x1 - 2, 66, z, x1 - 2, 67, z, 'spruce_fence'); box(x1 + 2, 66, z, x1 + 2, 67, z, 'spruce_fence'); lamp(x1 + 3, z, 3); }
      else for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x += step) { box(x, 66, z1 - 2, x, 67, z1 - 2, 'spruce_fence'); box(x, 66, z1 + 2, x, 67, z1 + 2, 'spruce_fence'); lamp(x, z1 + 3, 3); }
      sign(x1, 67, z1, [label]); stats.boardwalks++;
    });
  }
  boardwalk(-270, -300, -270, 120, '雨林栈道');
  boardwalk(-270, 390, -270, 540, '雨林栈道');
  boardwalk(260, -300, 260, 180, '游客观景线');
  boardwalk(260, 520, 260, 555, '游客观景线');
  boardwalk(-80, 300, -80, 380, '中央林缘步道');
  for (const [x, z1, z2] of [[80, 300, 340], [0, 300, 340], [-80, 300, 340], [80, 40, 90]]) {
    if (stats.boardwalks >= 4) break;
    boardwalk(x, z1, x, z2, '中央林缘步道');
  }
  for (const x of [-240, -180, -120, -60, 60, 120, 180, 240]) {
    if (stats.boardwalks >= 4) break;
    boardwalk(x, 40, x, 80, '中央林缘步道');
  }
  boardwalk(-270, 120, 250, 120, '溪谷步道');

  function platform(x, z, label) {
    attempt(rect(x - 7, z - 6, x + 7, z + 6), () => {
      box(x - 6, 65, z - 5, x + 6, 65, z + 5, 'spruce_planks');
      for (const [dx, dz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) box(x + dx, 66, z + dz, x + dx, 68, z + dz, 'spruce_fence');
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) lamp(x + dx, z + dz, 3);
      box(x - 2, 66, z - 2, x + 2, 66, z + 2, 'jungle_leaves[persistent=true]');
      sign(x, 67, z - 5, [label]); stats.platforms++;
    });
  }
  for (const [x, z, label] of [[-210, -230, '蕨类观景台'], [-205, 250, '溪谷观景台'], [155, -245, '火山林观景台'], [205, 260, '霸王龙远眺台'], [120, 470, '入口雨棚'], [-120, 40, '中央林缘台'], [120, 40, '中央溪谷台'], [120, 200, '中央远眺台']]) platform(x, z, label);

  function shelter(x, z, label) {
    attempt(rect(x - 5, z - 4, x + 5, z + 4), () => {
      for (const [dx, dz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) box(x + dx, 64, z + dz, x + dx, 69, z + dz, 'dark_oak_log');
      box(x - 5, 70, z - 4, x + 5, 70, z + 4, 'dark_oak_slab');
      box(x - 3, 65, z - 2, x + 3, 65, z + 2, 'spruce_planks');
      box(x - 3, 66, z + 2, x + 3, 66, z + 2, 'dark_oak_slab');
      lamp(x, z - 3, 4); sign(x, 68, z - 3, [label]); stats.shelters++;
    });
  }
  for (const [x, z, label] of [[-205, -130, '雨季休息亭'], [205, -110, '恐龙观察亭'], [-215, 390, '游客补给亭'], [210, 390, '安全集合点'], [0, 170, '溪边遮雨亭'], [-120, 205, '中央雨林亭'], [120, 205, '中央安全亭'], [0, 320, '中央林缘亭']]) shelter(x, z, label);
  for (const z of [-320, -280, -240, -200, -160, -120, -80, 40, 80, 160, 200, 320, 360, 520]) {
    for (const x of [-240, -180, -120, -60, 60, 120, 180, 240]) {
      if (stats.shelters >= 4) break;
      shelter(x, z, '中央雨林休息点');
    }
    if (stats.shelters >= 4) break;
  }

  function kiosk(x, z, label) {
    attempt(rect(x - 4, z - 3, x + 4, z + 3), () => {
      box(x - 3, 64, z - 2, x + 3, 67, z + 2, choose(['jungle_planks', 'spruce_planks']));
      box(x - 4, 68, z - 3, x + 4, 68, z + 3, 'red_terracotta');
      box(x - 2, 66, z - 3, x + 2, 66, z - 3, 'glass');
      box(x - 1, 65, z - 3, x + 1, 65, z - 3, 'barrel');
      sign(x, 69, z - 3, [label]); stats.kiosks++;
    });
  }
  for (const [x, z, label] of [[-95, 40, '雨林饮水站'], [95, 40, '化石纪念品'], [-95, 330, '游客医疗站'], [95, 330, '公园地图亭'], [0, 530, '入口售票亭'], [250, 40, '巡护补给']]) kiosk(x, z, label);

  // Dense, irregular planting islands fill the remaining sightlines without blocking the route.
  for (const [x, z, radius, count] of [[-255, -80, 25, 11], [-255, 305, 28, 13], [250, -220, 27, 12], [245, 330, 30, 14], [-80, -320, 18, 8], [90, 540, 20, 9], [-255, 500, 22, 10], [260, 520, 22, 10]]) grove(x, z, radius, count);
  for (let i = 0; i < 90; i++) {
    const x = integer(-285, 285), z = integer(-320, 550), r = rect(x, z, x, z);
    if (canPlace(r, 0) && !nearby(water, r).length) { reserve(r); shrub(x, z); }
  }
  stats.operations = operations.length;
  return { operations, metadata: { baseFullSha256: null, stats, features, collisionCount: 0, protectedAreaCount: protectedAreas.length } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fullPath = path.join(ROOT, 'map', 'generated', 'full.json');
  const bytes = await readFile(fullPath);
  const full = JSON.parse(bytes);
  const baseFullSha256 = createHash('sha256').update(bytes).digest('hex');
  const patch = buildCentralDetails(full);
  patch.metadata.baseFullSha256 = baseFullSha256;
  patch.metadata.generatedAt = new Date().toISOString();
  const output = { name: 'Jurassic City Park Central Details', bounds: { x1: -300, z1: -330, x2: 300, z2: 560 }, operations: patch.operations, metadata: patch.metadata };
  await writeFile(path.join(ROOT, 'map', 'generated', 'central-park-details.json'), `${JSON.stringify(output)}\n`);
  await writeFile(path.join(ROOT, 'verification', 'central-park-details-report.json'), `${JSON.stringify({ ...patch.metadata.stats, collisionCount: patch.metadata.collisionCount, baseFullSha256 }, null, 2)}\n`);
  console.log(JSON.stringify({ ...patch.metadata.stats, baseFullSha256 }, null, 2));
}

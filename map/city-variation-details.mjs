import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = block => block.includes(':') ? block : `minecraft:${block}`;
const rect = (x1, z1, x2, z2) => ({ x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2) });
const hit = (a, b, margin = 0) => a.x1 <= b.x2 + margin && a.x2 >= b.x1 - margin && a.z1 <= b.z2 + margin && a.z2 >= b.z1 - margin;
const inside = (a, b) => a.x1 >= b.x1 && a.x2 <= b.x2 && a.z1 >= b.z1 && a.z2 <= b.z2;

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

export function buildCityVariation(full) {
  if (!full?.operations || !full.metadata?.buildings || !full.metadata?.cityParcels) {
    throw new Error('city variation requires full.json with buildings and cityParcels');
  }
  const operations = [];
  const features = [];
  const buildings = full.metadata.buildings;
  const main = buildings.filter(b => /^city-\d\d$/.test(b.id));
  const parcelByMain = new Map(full.metadata.cityParcels.map(p => [p.mainBuilding, p.bounds]));
  const buildingRects = buildings.map(b => ({ id: b.id, rect: rect(b.bounds.x1, b.bounds.z1, b.bounds.x2, b.bounds.z2) }));
  const roads = [
    ...[-980, -780, -600, 600, 780, 980].flatMap(p => [
      rect(-995, p - 10, 995, p + 10), rect(p - 10, -995, p + 10, 995),
    ]),
    rect(-980, 632, 980, 668),
    ...[-420, -240, 0, 240, 420].flatMap(z => [rect(-995, z - 4, -600, z + 4), rect(600, z - 4, 995, z + 4)]),
  ];
  const rail = [rect(-360, -360, -340, 660), rect(340, -360, 360, 660), rect(-360, -360, 360, -340), rect(-360, 640, 360, 660)];
  const water = full.operations.filter(o => o.kind === 'box' && /(?:^|:)water(?:\[|$)/.test(o.block)).map(o => rect(o.x1, o.z1, o.x2, o.z2));
  const occupied = full.operations.filter(o => o.kind === 'box' && o.block !== 'minecraft:air' && o.y2 >= 64).map(o => rect(o.x1, o.z1, o.x2, o.z2));
  const stats = { selectedBuildings: 0, featureCount: 0, operations: 0, rejectedCandidates: 0, collisionsWithBuildings: 0, collisionsWithRoads: 0, collisionsWithRail: 0, collisionsWithWater: 0, types: {}, heightRange: { min: Infinity, max: -Infinity } };
  const box = (x1, y1, z1, x2, y2, z2, block) => operations.push({ kind: 'box', x1, y1, z1, x2, y2, z2, block: id(block) });
  const sign = (x, y, z, lines, facing = 'south') => operations.push({ kind: 'sign', x, y, z, lines, block: `minecraft:oak_wall_sign[facing=${facing}]` });
  const reserve = (r, feature) => { features.push({ ...r, ...feature }); };
  const safe = (r, parcel) => {
    if (!inside(r, parcel)) return false;
    if (roads.some(a => hit(r, a, 1)) || rail.some(a => hit(r, a, 1)) || water.some(a => hit(r, a, 0))) return false;
    if (buildingRects.some(b => hit(r, b.rect, 1))) return false;
    if (features.some(f => hit(r, f, 1))) return false;
    return true;
  };
  const candidate = (parcel, w, d, index) => {
    const p = rect(parcel.x1 + 4, parcel.z1 + 4, parcel.x2 - 4, parcel.z2 - 4);
    const options = [
      [p.x1, p.z1], [p.x2 - w + 1, p.z1], [p.x1, p.z2 - d + 1], [p.x2 - w + 1, p.z2 - d + 1],
      [Math.floor((p.x1 + p.x2 - w + 1) / 2), p.z1], [p.x1, Math.floor((p.z1 + p.z2 - d + 1) / 2)],
      [p.x2 - w + 1, Math.floor((p.z1 + p.z2 - d + 1) / 2)], [Math.floor((p.x1 + p.x2 - w + 1) / 2), p.z2 - d + 1],
    ];
    for (let k = 0; k < options.length; k++) {
      const [x, z] = options[(index + k) % options.length];
      const r = rect(x, z, x + w - 1, z + d - 1);
      if (safe(r, parcel)) return r;
    }
    stats.rejectedCandidates++;
    return null;
  };
  const materials = [
    { wall: 'bricks', trim: 'dark_oak_planks', roof: 'deepslate_tiles', glass: 'cyan_stained_glass' },
    { wall: 'yellow_terracotta', trim: 'spruce_planks', roof: 'cut_copper', glass: 'light_blue_stained_glass' },
    { wall: 'mud_bricks', trim: 'mangrove_planks', roof: 'waxed_exposed_copper', glass: 'green_stained_glass' },
    { wall: 'white_concrete', trim: 'dark_oak_planks', roof: 'red_nether_bricks', glass: 'orange_stained_glass' },
    { wall: 'stone_bricks', trim: 'jungle_planks', roof: 'oxidized_copper', glass: 'lime_stained_glass' },
    { wall: 'terracotta', trim: 'bamboo_block', roof: 'warped_slab', glass: 'purple_stained_glass' },
  ];
  const typeNames = ['corner_tower', 'arcade', 'balcony', 'awning', 'parking_deck', 'clock_tower', 'water_tower', 'retail_facade'];

  function buildFeature(type, r, m, idx, building) {
    const { x1, z1, x2, z2 } = r;
    const h = type === 'corner_tower' ? 26 : type === 'clock_tower' ? 24 : type === 'water_tower' ? 22 : type === 'parking_deck' ? 18 : 12;
    const accent = ['gold_block', 'copper_block', 'red_wool', 'blue_wool', 'lime_wool', 'orange_wool'][idx % 6];
    box(x1, 64, z1, x2, 64, z2, 'smooth_stone');
    if (type === 'corner_tower' || type === 'clock_tower') {
      box(x1, 65, z1, x2, 64 + h, z2, m.wall);
      box(x1 + 1, 66, z1 - 1, x2 - 1, 66, z2 - 1, m.trim);
      box(x1 + 1, 69, z1 - 1, x2 - 1, 69, z2 - 1, m.glass);
      box(x1 - 1, 64 + h, z1 - 1, x2 + 1, 64 + h, z2 + 1, m.roof);
      box(Math.floor((x1 + x2) / 2), 65, z1 - 1, Math.floor((x1 + x2) / 2), 70, z1 - 1, 'iron_bars');
      if (type === 'clock_tower') {
        box(x1 - 1, 64 + h + 1, z1 - 1, x2 + 1, 64 + h + 1, z2 + 1, accent);
        box(Math.floor((x1 + x2) / 2), 64 + h + 2, z1 - 1, Math.floor((x1 + x2) / 2), 64 + h + 2, z1 - 1, 'gold_block');
        sign(x1, 65, z1 - 2, ['CITY', building.id, '1993'], 'south');
      }
    } else if (type === 'arcade' || type === 'awning' || type === 'retail_facade') {
      box(x1, 65, z1, x2, 69, z2, m.wall);
      for (let x = x1 + 1; x <= x2 - 1; x += 3) box(x, 65, z1 - 1, x, 70, z1 - 1, m.trim);
      box(x1 - 1, 71, z1 - 2, x2 + 1, 71, z2 + 1, type === 'awning' ? accent : m.roof);
      box(x1 + 1, 66, z1 - 1, x2 - 1, 68, z1 - 1, m.glass);
      sign(x1 + 1, 72, z1 - 2, [type === 'arcade' ? 'ARCADE' : 'VISITOR', `BLOCK ${String(idx + 1).padStart(2, '0')}`], 'south');
    } else if (type === 'balcony') {
      box(x1, 65, z1, x2, 77, z2, m.wall);
      for (const y of [68, 72, 76]) {
        box(x1 - 1, y, z1 - 1, x2 + 1, y, z2 - 1, m.trim);
        box(x1, y + 1, z1 - 1, x2, y + 2, z1 - 1, 'iron_bars');
      }
      box(x1 - 1, 78, z1 - 1, x2 + 1, 78, z2 + 1, m.roof);
    } else if (type === 'parking_deck') {
      for (const y of [65, 70, 75, 80]) {
        box(x1, y, z1, x2, y, z2, m.trim);
        for (let x = x1 + 2; x <= x2 - 2; x += 4) box(x, y + 1, z1, x, y + 4, z1, m.wall);
      }
      box(x1, 81, z1, x2, 82, z2, m.roof);
      sign(x1 + 1, 83, z1, ['PARKING', `LEVEL ${idx % 4 + 1}`], 'south');
    } else if (type === 'water_tower') {
      for (const [x, z] of [[x1, z1], [x2, z1], [x1, z2], [x2, z2]]) box(x, 65, z, x, 64 + h, z, m.trim);
      box(x1 - 1, 64 + h - 2, z1 - 1, x2 + 1, 64 + h, z2 + 1, m.wall);
      box(x1 - 2, 64 + h + 1, z1 - 2, x2 + 2, 64 + h + 2, z2 + 2, m.roof);
      sign(x1, 64 + h - 1, z1 - 2, ['WATER', 'DISTRICT', 'PARK'], 'south');
    }
    reserve(r, { type, buildingId: building.id, materialSet: m.wall, height: h + 64 });
    stats.types[type] = (stats.types[type] || 0) + 1;
    stats.heightRange.min = Math.min(stats.heightRange.min, h + 64);
    stats.heightRange.max = Math.max(stats.heightRange.max, h + 64);
  }

  // Pick 32 evenly distributed main buildings; keep at least 24 successful sites.
  const targets = main.filter((_, i) => i % 2 === 0).slice(0, 32);
  targets.forEach((building, idx) => {
    const parcel = parcelByMain.get(building.id);
    if (!parcel) return;
    const type = typeNames[idx % typeNames.length];
    const dims = {
      corner_tower: [9, 9], arcade: [15, 6], balcony: [11, 7], awning: [17, 5],
      parking_deck: [15, 9], clock_tower: [9, 9], water_tower: [9, 9], retail_facade: [19, 5],
    }[type];
    const site = candidate(parcel, dims[0], dims[1], idx);
    if (!site) return;
    buildFeature(type, site, materials[idx % materials.length], idx, building);
  });
  stats.selectedBuildings = new Set(features.map(f => f.buildingId)).size;
  stats.featureCount = features.length;
  stats.operations = operations.length;
  // Audit the reserved feature footprints independently of placement decisions.
  // This keeps the report useful if a future variation changes the candidate order.
  stats.collisionsWithBuildings = features.reduce((n, f) => n + buildingRects.filter(b => hit(f, b.rect)).length, 0);
  stats.collisionsWithRoads = features.reduce((n, f) => n + roads.filter(a => hit(f, a)).length, 0);
  stats.collisionsWithRail = features.reduce((n, f) => n + rail.filter(a => hit(f, a)).length, 0);
  stats.collisionsWithWater = features.reduce((n, f) => n + water.filter(a => hit(f, a)).length, 0);
  if (stats.heightRange.min === Infinity) stats.heightRange = { min: 0, max: 0 };
  return { name: 'Jurassic City Park City Variation Details', bounds: { x1: -1000, z1: -1000, x2: 1000, z2: 1000 }, operations, metadata: { stats, features, baseFullSha256: null, generatedAt: new Date().toISOString(), additive: true } };
}

const fullPath = path.join(ROOT, 'map', 'generated', 'full.json');
const fullText = await readFile(fullPath, 'utf8');
const full = JSON.parse(fullText);
const patch = buildCityVariation(full);
patch.metadata.baseFullSha256 = sha256(fullText);
const outputPath = path.join(ROOT, 'map', 'generated', 'city-variation-details.json');
const reportPath = path.join(ROOT, 'verification', 'city-variation-details-report.json');
await writeFile(outputPath, `${JSON.stringify(patch)}\n`);
await writeFile(reportPath, `${JSON.stringify({ ...patch.metadata.stats, baseFullSha256: patch.metadata.baseFullSha256, featureTypes: patch.metadata.types, features: patch.metadata.features }, null, 2)}\n`);
console.log(JSON.stringify({ ...patch.metadata.stats, baseFullSha256: patch.metadata.baseFullSha256 }, null, 2));

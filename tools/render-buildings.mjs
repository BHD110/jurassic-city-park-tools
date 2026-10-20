import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
function dependency(name, fallback) {
  try { return require(name); } catch { return require(fallback); }
}
const nbt = dependency('prismarine-nbt', 'D:/codeSource/product/jev/mindcraft-agent-gpt/node_modules/prismarine-nbt');
const { createCanvas } = dependency('canvas', 'D:/codeSource/product/jev/mindcraft-agent-gpt/node_modules/canvas');

const args = process.argv.slice(2);
function option(name, fallback) {
  const at = args.indexOf(name);
  return at < 0 ? fallback : args[at + 1];
}
const worldPath = option('--world', null);
const comparePath = option('--compare', null);
const previewPath = option('--preview-plan', null);
const metadataPlanPath = option('--plan', 'map/generated/full.json');
const outPath = option('--out', 'verification/architecture-before');
const requestedIds = option('--ids', 'city-01,city-02,city-03,city-26,city-27,city-28,city-annex-1-l,city-annex-1-r,city-annex-41-l,city-annex-41-r,city-ground-001,city-ground-025,city-ground-049,city-ground-073').split(',');
const allMain = args.includes('--all-main');
const allStructures = args.includes('--all-structures');
const dualView = args.includes('--dual-view');
const contactSheet = args.includes('--contact-sheet');
const customBoundsArg = option('--bounds', null);
const customLabel = option('--label', 'custom-site');
const walkwayArg = option('--walkway', null);
if (comparePath && previewPath) throw new Error('--compare and --preview-plan are mutually exclusive');
if (!worldPath || args.includes('--help')) {
  console.log('Usage: node tools/render-buildings.mjs --world <snapshot> [--compare <new-snapshot> | --preview-plan <patch.json>] [--plan <metadata.json>] [--out <directory>] [--ids city-01,city-02 | --bounds x1,y1,z1,x2,y2,z2 --label name] [--all-main | --all-structures | --contact-sheet] [--dual-view] [--walkway x1,z1,x2,z2]');
  process.exit(worldPath ? 0 : 1);
}

class AnvilWorld {
  constructor(root) {
    this.root = path.resolve(root);
    this.regions = new Map();
    this.chunks = new Map();
    this.sources = new Map();
  }
  async chunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.chunks.has(key)) return this.chunks.get(key);
    const rx = Math.floor(cx / 32), rz = Math.floor(cz / 32);
    const filename = `r.${rx}.${rz}.mca`;
    let region = this.regions.get(filename);
    if (!region) {
      region = await readFile(path.join(this.root, 'region', filename));
      if (region.length < 8192) throw new Error(`Invalid region header: ${filename}`);
      this.regions.set(filename, region);
      this.sources.set(filename, createHash('sha256').update(region).digest('hex'));
    }
    const slot = (cx & 31) + 32 * (cz & 31);
    const sector = region.readUIntBE(slot * 4, 3);
    if (!sector) throw new Error(`Missing chunk ${cx},${cz} in ${filename}`);
    const offset = sector * 4096;
    if (offset + 5 > region.length) throw new Error(`Truncated chunk ${cx},${cz}`);
    const length = region.readUInt32BE(offset);
    if (length < 1 || offset + 4 + length > region.length) throw new Error(`Invalid chunk length ${cx},${cz}`);
    const compression = region[offset + 4];
    const payload = region.subarray(offset + 5, offset + 4 + length);
    const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : compression === 3 ? payload : null;
    if (!raw) throw new Error(`Unsupported compression ${compression} in ${filename}`);
    const parsed = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
    if (parsed.xPos !== cx || parsed.zPos !== cz) throw new Error(`Wrong chunk coordinates in ${filename}: ${cx},${cz}`);
    const sections = new Map();
    for (const section of parsed.sections ?? []) {
      const states = section.block_states;
      if (!states?.palette?.length) continue;
      const palette = states.palette.map(p => ({ name: p.Name.replace(/^minecraft:/, ''), properties: p.Properties ?? {} }));
      const bits = Math.max(4, Math.ceil(Math.log2(palette.length)));
      sections.set(section.Y, { palette, bits, data: states.data, perLong: Math.floor(64 / bits), mask: (1n << BigInt(bits)) - 1n });
    }
    const chunk = { sections };
    this.chunks.set(key, chunk);
    return chunk;
  }
  async block(x, y, z) {
    const chunk = await this.chunk(Math.floor(x / 16), Math.floor(z / 16));
    const section = chunk.sections.get(Math.floor(y / 16));
    if (!section) return AIR;
    if (section.palette.length === 1) return section.palette[0];
    const index = ((y & 15) << 8) | ((z & 15) << 4) | (x & 15);
    const word = section.data?.[Math.floor(index / section.perLong)];
    if (word === undefined) throw new Error(`Missing block-state data at ${x},${y},${z}`);
    const paletteIndex = Number((BigInt.asUintN(64, word) >> BigInt(index % section.perLong * section.bits)) & section.mask);
    const name = section.palette[paletteIndex];
    if (!name) throw new Error(`Invalid block-state palette index ${paletteIndex} at ${x},${y},${z}`);
    return name;
  }
}

const air = new Set(['air', 'cave_air', 'void_air', 'structure_void']);
const AIR = { name: 'air', properties: {} };
const transparent = state => air.has(state.name) || state.name.includes('glass') || state.name.includes('leaves') || state.name === 'water' || state.name.endsWith('_pane') || state.name === 'iron_bars';
const ground = name => name === 'smooth_stone' || name === 'gray_concrete' || name === 'stone' || name === 'dirt' || name === 'grass_block';
const baseColors = {
  white_concrete: '#e6e7df', light_gray_concrete: '#aaaeb0', gray_concrete: '#61656a', black_concrete: '#272b30', red_concrete: '#b43436',
  blue_concrete: '#3d60a0', yellow_concrete: '#e7bd44', green_concrete: '#4e8c51', lime_concrete: '#82af57', orange_concrete: '#d58442',
  pink_terracotta: '#c48b88', lime_terracotta: '#9ba46a', red_terracotta: '#9b4440', yellow_terracotta: '#bfa76d', white_terracotta: '#d2c2b0',
  bricks: '#a9614f', mud_bricks: '#7c6659', stone_bricks: '#9b9b91', smooth_stone: '#b2b3af', stone: '#92938e', polished_andesite: '#91918f',
  andesite: '#92918d', quartz_block: '#e4e1d9', quartz_pillar: '#e4e1d9', iron_block: '#ced2d0', iron_bars: '#777e82',
  gray_stained_glass: '#8caab2', brown_stained_glass: '#8e7967', glass: '#b7d5d4', dark_oak_planks: '#5c4635', spruce_planks: '#806548',
  dark_prismarine: '#355e5b', moss_block: '#667d51', grass_block: '#739a5b', dirt: '#80694e', water: '#4d91ae', red_wool: '#ab3f40',
  green_wool: '#538350', yellow_wool: '#d4ad4f', lime_wool: '#8bab60', orange_wool: '#c57d42', azalea_leaves: '#62874d',
  smooth_sandstone: '#d7c7a3', sandstone: '#d0bd91', waxed_cut_copper: '#b67d5b', brick_stairs: '#a9614f', brick_slab: '#a9614f',
  dark_oak_stairs: '#5c4635', dark_oak_slab: '#5c4635', spruce_stairs: '#806548', spruce_slab: '#806548',
  oak_planks: '#a48259', oak_log: '#746047', oak_fence: '#8e704c', oak_slab: '#a48259', oak_stairs: '#a48259',
  birch_planks: '#c8b88c', birch_log: '#d2cec1', stripped_birch_log: '#d2bd88', stripped_birch_wood: '#d2bd88',
  jungle_log: '#765741', jungle_planks: '#a17a56', spruce_log: '#5b4435',
  cobbled_deepslate: '#4d4e51', cobbled_deepslate_stairs: '#4d4e51', cobbled_deepslate_slab: '#4d4e51',
  deepslate_tiles: '#44464b', deepslate_tile_stairs: '#44464b', deepslate_tile_slab: '#44464b',
  deepslate_bricks: '#4b4d51', deepslate_brick_stairs: '#4b4d51', deepslate_brick_slab: '#4b4d51',
  gray_carpet: '#48494d', cyan_carpet: '#148d94', moss_carpet: '#687f50',
  mossy_stone_bricks: '#858d79', mossy_cobblestone: '#777e6f', coarse_dirt: '#806b52',
  bookshelf: '#9d7950', chiseled_bookshelf: '#90704c', decorated_pot: '#a87051', granite: '#a97d70', polished_granite: '#ae8174',
};
function color(name) {
  if (baseColors[name]) return baseColors[name];
  if (name.includes('glass')) return '#9db9bc';
  if (name.includes('leaves')) return '#5d8556';
  const family = Object.keys(baseColors).find(k => name.startsWith(k.replace(/_(concrete|terracotta|planks|bricks|wool)$/, '')));
  if (family) return baseColors[family];
  if (name.includes('wood') || name.includes('planks') || name.includes('log')) return '#765b42';
  if (name.includes('stone') || name.includes('cobble')) return '#8c8d87';
  const hash = createHash('sha1').update(name).digest();
  return `rgb(${95 + hash[0] % 75},${95 + hash[1] % 75},${95 + hash[2] % 75})`;
}
function shade(hex, factor) {
  const bytes = hex.startsWith('#') ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) : hex.match(/\d+/g).map(Number);
  return `rgb(${bytes.map(v => Math.round(v * factor)).join(',')})`;
}
function face(ctx, pts, fill) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function stateKey(state) {
  const properties = Object.entries(state.properties).sort(([a], [b]) => a.localeCompare(b));
  return properties.length ? `${state.name}[${properties.map(([key, value]) => `${key}=${value}`).join(',')}]` : state.name;
}
function shapeBoxes(state) {
  const { name, properties } = state;
  if (name.endsWith('_slab')) {
    if (properties.type === 'double') return [[0, 0, 0, 1, 1, 1]];
    return properties.type === 'top' ? [[0, .5, 0, 1, 1, 1]] : [[0, 0, 0, 1, .5, 1]];
  }
  if (name.endsWith('_stairs')) {
    const top = properties.half === 'top';
    const lower = top ? [[0, .5, 0, 1, 1, 1]] : [[0, 0, 0, 1, .5, 1]];
    const y1 = top ? 0 : .5, y2 = top ? .5 : 1;
    const facing = properties.facing ?? 'north';
    const back = {
      north: [0, y1, 0, 1, y2, .5], south: [0, y1, .5, 1, y2, 1],
      east: [.5, y1, 0, 1, y2, 1], west: [0, y1, 0, .5, y2, 1],
    }[facing];
    const shape = properties.shape ?? 'straight';
    if (shape === 'straight') return [...lower, back];
    const quadrants = [
      { x: 0, z: 0 }, { x: .5, z: 0 }, { x: 0, z: .5 }, { x: .5, z: .5 },
    ];
    const isFacing = q => facing === 'north' ? q.z === 0 : facing === 'south' ? q.z === .5 : facing === 'east' ? q.x === .5 : q.x === 0;
    const isLeft = q => facing === 'north' ? q.x === 0 : facing === 'south' ? q.x === .5 : facing === 'east' ? q.z === 0 : q.z === .5;
    const left = shape.endsWith('_left');
    const upper = quadrants.filter(q => shape.startsWith('outer_')
      ? isFacing(q) && isLeft(q) === left
      : isFacing(q) || isLeft(q) === left);
    return [...lower, ...upper.map(q => [q.x, y1, q.z, q.x + .5, y2, q.z + .5])];
  }
  if (name.endsWith('_pane') || name === 'iron_bars') return [[.4, 0, .4, .6, 1, .6]];
  if (name.endsWith('_fence') || name.endsWith('_wall')) return [[.34, 0, .34, .66, 1, .66]];
  if (name.endsWith('_door')) return [[0, 0, .4, 1, 1, .6]];
  return [[0, 0, 0, 1, 1, 1]];
}
function drawBox(ctx, project, x, y, z, shape, fill, visible, alpha = 1) {
  const [x1, y1, z1, x2, y2, z2] = shape;
  const p = (dx, dy, dz) => project(x + dx, y + dy, z + dz);
  ctx.globalAlpha = alpha;
  if (visible.west) face(ctx, [p(x1, y1, z2), p(x1, y1, z1), p(x1, y2, z1), p(x1, y2, z2)], shade(fill, .75));
  if (visible.east) face(ctx, [p(x2, y1, z1), p(x2, y1, z2), p(x2, y2, z2), p(x2, y2, z1)], shade(fill, .75));
  if (visible.south) face(ctx, [p(x1, y1, z2), p(x2, y1, z2), p(x2, y2, z2), p(x1, y2, z2)], shade(fill, .87));
  if (visible.top) face(ctx, [p(x1, y2, z1), p(x2, y2, z1), p(x2, y2, z2), p(x1, y2, z2)], fill);
  ctx.globalAlpha = 1;
}
async function extract(world, box) {
  const { x1, x2, z1, z2, y1, y2 } = box;
  const width = x2 - x1 + 1, depth = z2 - z1 + 1, height = y2 - y1 + 1;
  const blocks = new Array(width * depth * height);
  const at = (x, y, z) => ((y - y1) * depth + z - z1) * width + x - x1;
  for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) {
    await world.chunk(Math.floor(x / 16), Math.floor(z / 16));
    for (let y = y1; y <= y2; y++) blocks[at(x, y, z)] = await world.block(x, y, z);
  }
  return { box, blocks, at, get(x, y, z) {
    if (x < x1 || x > x2 || z < z1 || z > z2 || y < y1 || y > y2) return AIR;
    return blocks[at(x, y, z)];
  } };
}
function parsePlanState(value) {
  const match = value.match(/^(?:minecraft:)?([^\[]+)(?:\[([^\]]+)\])?$/);
  if (!match) throw new Error(`Invalid plan block state: ${value}`);
  return { name: match[1], properties: Object.fromEntries((match[2] ?? '').split(',').filter(Boolean).map(part => part.split('='))) };
}
function applyPlan(base, operations) {
  const { box, at } = base;
  const blocks = [...base.blocks];
  for (const operation of operations) {
    if (operation.kind === 'sign') {
      if (operation.x >= box.x1 && operation.x <= box.x2 && operation.y >= box.y1 && operation.y <= box.y2 && operation.z >= box.z1 && operation.z <= box.z2)
        blocks[at(operation.x, operation.y, operation.z)] = parsePlanState(operation.block ?? 'minecraft:oak_wall_sign');
      continue;
    }
    if (operation.kind !== 'box') throw new Error(`Unsupported preview operation: ${operation.kind}`);
    const x1 = Math.max(box.x1, operation.x1), x2 = Math.min(box.x2, operation.x2);
    const y1 = Math.max(box.y1, operation.y1), y2 = Math.min(box.y2, operation.y2);
    const z1 = Math.max(box.z1, operation.z1), z2 = Math.min(box.z2, operation.z2);
    if (x1 > x2 || y1 > y2 || z1 > z2) continue;
    const state = parsePlanState(operation.block);
    for (let y = y1; y <= y2; y++) for (let z = z1; z <= z2; z++) for (let x = x1; x <= x2; x++) blocks[at(x, y, z)] = state;
  }
  return { ...base, blocks, get(x, y, z) {
    if (x < box.x1 || x > box.x2 || z < box.z1 || z > box.z2 || y < box.y1 || y > box.y2) return AIR;
    return blocks[at(x, y, z)];
  } };
}
function render(volume, building, view = 'SE', isPreview = false) {
  const { box, get } = volume;
  const size = 7, rise = 9;
  const width = Math.ceil((box.x2 - box.x1 + box.z2 - box.z1 + 3) * size + 90);
  const height = Math.ceil((box.x2 - box.x1 + box.z2 - box.z1 + 4) * size / 4 + (box.y2 - box.y1) * rise + 115);
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8eff0'; ctx.fillRect(0, 0, width, height);
  const centerX = (box.x1 + box.x2) / 2, centerZ = (box.z1 + box.z2) / 2;
  const originX = width / 2, originY = 52 + (box.y2 - box.y1) * rise;
  const directionX = view === 'SW' ? -1 : 1;
  const project = (x, y, z) => [originX + (directionX * (x - centerX) - z + centerZ) * size, originY + (directionX * (x - centerX) + z - centerZ) * size / 2 - (y - box.y1) * rise];
  // Draw farther x/z columns first; within each column, lower blocks first.
  const minDiagonal = (directionX > 0 ? box.x1 : -box.x2) + box.z1;
  const maxDiagonal = (directionX > 0 ? box.x2 : -box.x1) + box.z2;
  for (let diagonal = minDiagonal; diagonal <= maxDiagonal; diagonal++) {
    for (let x = box.x1; x <= box.x2; x++) {
      const z = diagonal - directionX * x;
      if (z < box.z1 || z > box.z2) continue;
      for (let y = box.y1; y <= box.y2; y++) {
        const block = get(x, y, z);
        if (air.has(block.name)) continue;
        const top = y === box.y2 || transparent(get(x, y + 1, z));
        const east = directionX > 0 && (x === box.x2 || transparent(get(x + 1, y, z)));
        const west = directionX < 0 && (x === box.x1 || transparent(get(x - 1, y, z)));
        const south = z === box.z2 || transparent(get(x, y, z + 1));
        const shapes = shapeBoxes(block);
        const partial = shapes.length > 1 || shapes[0].some((v, index) => v !== [0, 0, 0, 1, 1, 1][index]);
        if (!partial && !top && !east && !west && !south) continue;
        const alpha = block.name.includes('glass') ? .53 : block.name.includes('leaves') ? .82 : block.name === 'water' ? .68 : 1;
        for (const shape of shapes) drawBox(ctx, project, x, y, z, shape, color(block.name),
          partial ? { top: true, east, west, south: true } : { top, east, west, south }, alpha);
      }
    }
  }
  const center = building.center ?? {
    x: Math.round((building.bounds.x1 + building.bounds.x2) / 2),
    z: Math.round((building.bounds.z1 + building.bounds.z2) / 2),
  };
  ctx.fillStyle = '#17282b'; ctx.font = 'bold 22px Arial'; ctx.fillText(`${building.id}  (${center.x}, ${center.z})`, 22, 34);
  ctx.font = '15px Arial'; ctx.fillStyle = '#43595b';
  ctx.fillText(`${isPreview ? 'Old Anvil world + unbuilt plan operations' : 'Anvil block data'} / ${directionX > 0 ? '+X' : '-X'} +Z view`, 22, height - 20);
  if (isPreview) {
    ctx.fillStyle = 'rgba(155, 50, 42, .92)'; ctx.fillRect(width - 268, 12, 250, 38);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Arial'; ctx.fillText('PLAN PREVIEW / UNBUILT', width - 254, 38);
  }
  return canvas;
}
function count(volume, bounds) {
  const materials = new Map(); let solid = 0, roofY = bounds.y1, nonGround = 0;
  let baseColumns = 0, supportedBaseColumns = 0;
  const unsupportedBase = [];
  for (let y = bounds.y1; y <= Math.min(volume.box.y2, Math.max(bounds.y2 + 20, 120)); y++)
    for (let z = bounds.z1; z <= bounds.z2; z++) for (let x = bounds.x1; x <= bounds.x2; x++) {
      const name = volume.get(x, y, z).name;
      if (air.has(name)) continue;
      solid++; materials.set(name, (materials.get(name) ?? 0) + 1);
      if (y >= 65 && !ground(name)) { nonGround++; roofY = Math.max(roofY, y); }
    }
  for (let z = bounds.z1; z <= bounds.z2; z++) for (let x = bounds.x1; x <= bounds.x2; x++) {
    const base = volume.get(x, 64, z).name;
    if (air.has(base) || base === 'water' || base === 'lava' || base.includes('leaves')) continue;
    baseColumns++;
    const below = volume.get(x, 63, z).name;
    if (!air.has(below) && below !== 'water' && below !== 'lava' && !below.includes('leaves')) supportedBaseColumns++;
    else if (unsupportedBase.length < 30) unsupportedBase.push({ x, z, base, below });
  }
  const roofMaterials = new Map(), roofByY = {}, glassByY = {};
  for (let y = 65; y <= roofY; y++) {
    const floor = new Map(); let glass = 0;
    for (let z = bounds.z1; z <= bounds.z2; z++) for (let x = bounds.x1; x <= bounds.x2; x++) {
      const name = volume.get(x, y, z).name;
      if (air.has(name)) continue;
      if (name.includes('glass')) glass++;
      if (y >= roofY - 9) {
        floor.set(name, (floor.get(name) ?? 0) + 1);
        roofMaterials.set(name, (roofMaterials.get(name) ?? 0) + 1);
      }
    }
    if (floor.size) roofByY[y] = Object.fromEntries([...floor].sort((a, b) => b[1] - a[1]).slice(0, 8));
    if (glass) glassByY[y] = glass;
  }
  return { solid, nonGround, roofY, baseColumns, supportedBaseColumns, unsupportedBase,
    materials: Object.fromEntries([...materials].sort((a, b) => b[1] - a[1]).slice(0, 12)),
    roofMaterials: Object.fromEntries([...roofMaterials].sort((a, b) => b[1] - a[1])), roofByY, glassByY };
}
function diff(a, b, bounds) {
  let changed = 0, added = 0, removed = 0, replaced = 0;
  const byHeight = {}, materialTransitions = new Map();
  for (let y = 64; y <= a.box.y2; y++)
    for (let z = bounds.z1; z <= bounds.z2; z++) for (let x = bounds.x1; x <= bounds.x2; x++) {
      const old = stateKey(a.get(x, y, z)), fresh = stateKey(b.get(x, y, z));
      if (old === fresh) continue;
      changed++; byHeight[y] = (byHeight[y] ?? 0) + 1;
      if (air.has(old)) added++; else if (air.has(fresh)) removed++; else replaced++;
      const key = `${old} -> ${fresh}`;
      materialTransitions.set(key, (materialTransitions.get(key) ?? 0) + 1);
    }
  return { changed, added, removed, replaced, byHeight, topTransitions: [...materialTransitions].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([transition, blocks]) => ({ transition, blocks })) };
}
async function auditWalkway(world, value) {
  const coordinates = value.split(',').map(Number);
  if (coordinates.length !== 4 || coordinates.some(n => !Number.isInteger(n))) throw new Error('--walkway requires four integers x1,z1,x2,z2');
  const [x1, z1, x2, z2] = coordinates;
  if (x1 !== x2 && z1 !== z2) throw new Error('--walkway must follow one straight x or z row');
  const length = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1));
  const passable = name => air.has(name) || name === 'short_grass' || name === 'tall_grass' || name.endsWith('_flower') || name === 'fern';
  const points = [];
  for (let index = 0; index <= length; index++) {
    const x = x1 + Math.sign(x2 - x1) * index, z = z1 + Math.sign(z2 - z1) * index;
    let surface = null;
    for (let y = 65; y >= 63; y--) {
      const name = (await world.block(x, y, z)).name;
      if (air.has(name) || name === 'water' || name === 'lava' || name.includes('leaves')) continue;
      surface = { y, block: name }; break;
    }
    const above = surface ? [(await world.block(x, surface.y + 1, z)).name, (await world.block(x, surface.y + 2, z)).name] : [];
    points.push({ x, z, ...surface, above, passable: !!surface && above.every(passable) });
  }
  const gaps = points.filter(p => !p.passable);
  const steepSteps = points.slice(1).filter((p, index) => p.y !== undefined && points[index].y !== undefined && Math.abs(p.y - points[index].y) > 1);
  return { start: { x: x1, z: z1 }, end: { x: x2, z: z2 }, points: points.length,
    passablePoints: points.length - gaps.length, gaps, steepSteps,
    surfaces: Object.fromEntries([...new Set(points.map(p => p.block).filter(Boolean))].map(name => [name, points.filter(p => p.block === name).length])),
    elevations: Object.fromEntries([...new Set(points.map(p => p.y).filter(y => y !== undefined))].map(y => [y, points.filter(p => p.y === y).length])),
  };
}

const plan = JSON.parse(await readFile('map/generated/full.json', 'utf8'));
const metadataPlan = JSON.parse(await readFile(metadataPlanPath, 'utf8'));
const updatedBuildings = new Map(metadataPlan.metadata.buildings.map(b => [b.id, b]));
const mains = plan.metadata.buildings.filter(b => /^city-\d\d$/.test(b.id));
const parcels = new Map(plan.metadata.cityParcels.map(p => [p.mainBuilding, p]));
for (const building of mains) {
  const parcel = parcels.get(building.id);
  if (!parcel) throw new Error(`Missing parcel for ${building.id}`);
  building.center = { x: Math.round((parcel.bounds.x1 + parcel.bounds.x2) / 2), z: Math.round((parcel.bounds.z1 + parcel.bounds.z2) / 2) };
}
const annexes = plan.metadata.buildings.filter(b => b.id.startsWith('city-annex-'));
for (const building of [...mains, ...annexes]) {
  const updated = updatedBuildings.get(building.id);
  if (updated) {
    building.name = updated.name;
    building.style = updated.style;
  }
}
const groundPatch = JSON.parse(await readFile('map/generated/city-ground-patch.json', 'utf8'));
const shops = groundPatch.metadata.sites.filter(s => s.type === 'shop').map(s => ({
  id: s.id, name: '街区小店', style: 'small-shop', bounds: { ...s.bounds, y1: 64, y2: 75 },
}));
const structures = [...mains, ...annexes, ...shops];
const byId = new Map(structures.map(b => [b.id, b]));
const customValues = customBoundsArg?.split(',').map(Number);
if (customValues && (customValues.length !== 6 || customValues.some(v => !Number.isInteger(v)))) throw new Error('--bounds requires six integers x1,y1,z1,x2,y2,z2');
const custom = customValues ? {
  id: customLabel, name: customLabel, style: 'site',
  bounds: { x1: customValues[0], y1: customValues[1], z1: customValues[2], x2: customValues[3], y2: customValues[4], z2: customValues[5] },
} : null;
const renderTargets = custom ? [custom] : requestedIds.map(id => {
  const building = byId.get(id);
  if (!building) throw new Error(`Unknown building: ${id}`);
  return building;
});
const statsTargets = custom ? [custom] : allStructures ? structures : allMain ? mains : renderTargets;
const before = new AnvilWorld(worldPath), after = comparePath ? new AnvilWorld(comparePath) : null;
const previewBytes = previewPath ? await readFile(previewPath) : null;
const preview = previewBytes ? JSON.parse(previewBytes) : null;
if (preview && !Array.isArray(preview.operations)) throw new Error('Preview plan lacks operations');
const previewStyles = new Map((preview?.metadata?.architectureManifest ?? []).map(item => [item.id, item.newStyle]));
await mkdir(outPath, { recursive: true });
const results = [];
const walkway = walkwayArg && after ? await auditWalkway(after, walkwayArg) : null;
const sheets = new Map();
function addToSheet(stage, canvas, building, index) {
  const group = Math.floor(index / 20);
  const key = `${stage}-${group + 1}`;
  let sheet = sheets.get(key);
  if (!sheet) {
    sheet = createCanvas(2200, contactSheet && !allMain && !allStructures ? 70 + Math.ceil(Math.min(20, statsTargets.length) / 5) * 423 : 1760);
    const c = sheet.getContext('2d');
    c.fillStyle = '#eef2f2'; c.fillRect(0, 0, sheet.width, sheet.height);
    c.font = 'bold 26px Arial'; c.fillStyle = '#17282b';
    c.fillText(`${stage.toUpperCase()} / main buildings ${group * 20 + 1}-${Math.min(group * 20 + 20, statsTargets.length)} / ${preview ? 'UNBUILT PLAN PREVIEW' : 'Anvil blocks'}`, 30, 36);
    sheets.set(key, sheet);
  }
  const ctx = sheet.getContext('2d');
  const slot = index % 20, col = slot % 5, row = Math.floor(slot / 5);
  const x = 20 + col * 438, y = 55 + row * 423;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 420, 400);
  const scale = Math.min(420 / canvas.width, 360 / canvas.height);
  const drawWidth = canvas.width * scale, drawHeight = canvas.height * scale;
  ctx.drawImage(canvas, x + (420 - drawWidth) / 2, y + 10, drawWidth, drawHeight);
  ctx.fillStyle = '#173337'; ctx.font = 'bold 18px Arial';
  const center = building.center ?? { x: Math.round((building.bounds.x1 + building.bounds.x2) / 2), z: Math.round((building.bounds.z1 + building.bounds.z2) / 2) };
  ctx.fillText(`${building.id}  ${stage.startsWith('candidate') ? previewStyles.get(building.id) ?? building.style : building.style}`, x + 12, y + 374);
  ctx.font = '14px Arial'; ctx.fillStyle = '#506468'; ctx.fillText(`(${center.x}, ${center.z})`, x + 12, y + 395);
}
for (const building of statsTargets) {
  const bounds = building.bounds;
  const box = { x1: bounds.x1 - 10, x2: bounds.x2 + 10, z1: bounds.z1 - 10, z2: bounds.z2 + 10, y1: 63, y2: Math.max(120, bounds.y2 + 20) };
  const a = await extract(before, box);
  const item = { id: building.id, name: building.name, style: building.style, bounds, before: count(a, bounds) };
  const renderLarge = renderTargets.includes(building);
  const renderSheet = (contactSheet && mains.includes(building)) || (mains.includes(building) && (allMain || allStructures));
  if (renderLarge || renderSheet) {
    const image = render(a, building);
    if (renderSheet) {
      addToSheet('before', image, building, results.length);
      if (dualView) addToSheet('before-opposite', render(a, building, 'SW'), building, results.length);
    }
    if (renderLarge) {
    item.beforeImage = `${building.id}-before.png`;
      await writeFile(path.join(outPath, item.beforeImage), image.toBuffer('image/png'));
      if (dualView) await writeFile(path.join(outPath, `${building.id}-before-opposite.png`), render(a, building, 'SW').toBuffer('image/png'));
    }
  }
  if (after || preview) {
    const b = preview ? applyPlan(a, preview.operations) : await extract(after, box);
    item.after = count(b, bounds);
    const comparisonBounds = { x1: bounds.x1 - 5, x2: bounds.x2 + 5, z1: bounds.z1 - 5, z2: bounds.z2 + 5 };
    item.difference = diff(a, b, comparisonBounds);
    if (renderLarge || renderSheet) {
      const image = render(b, building, 'SE', !!preview);
      if (renderSheet) {
        addToSheet(preview ? 'candidate' : 'after', image, building, results.length);
        if (dualView) addToSheet(preview ? 'candidate-opposite' : 'after-opposite', render(b, building, 'SW', !!preview), building, results.length);
      }
      if (renderLarge) {
      item.afterImage = `${building.id}-${preview ? 'candidate' : 'after'}.png`;
        await writeFile(path.join(outPath, item.afterImage), image.toBuffer('image/png'));
        if (dualView) await writeFile(path.join(outPath, `${building.id}-${preview ? 'candidate' : 'after'}-opposite.png`), render(b, building, 'SW', !!preview).toBuffer('image/png'));
      }
    }
  }
  results.push(item);
  console.log(`${item.id}: ${item.before.nonGround} built blocks, roof y=${item.before.roofY}${item.difference ? `; changed=${item.difference.changed}` : ''}`);
}
for (const [name, canvas] of sheets) await writeFile(path.join(outPath, `${name}-contact-sheet.png`), canvas.toBuffer('image/png'));
const report = {
  generatedAt: new Date().toISOString(), method: preview
    ? 'PLAN PREVIEW: old Anvil block_states plus candidate operations in memory; unbuilt proposal, not new-world evidence'
    : 'Minecraft 1.21.1 Anvil region block_states, offline oblique cube projection',
  beforeWorld: before.root, afterWorld: after?.root ?? null, previewPlan: previewPath ? path.resolve(previewPath) : null,
  metadataPlan: path.resolve(metadataPlanPath),
  previewPlanSha256: previewBytes ? createHash('sha256').update(previewBytes).digest('hex') : null,
  renderIds: custom ? [custom.id] : requestedIds, dualView, contactSheet, inspectedBuildings: results.length, inspectedGroups: {
    main: results.filter(r => mains.some(b => b.id === r.id)).length,
    annex: results.filter(r => r.id.startsWith('city-annex-')).length,
    shop: results.filter(r => r.id.startsWith('city-ground-')).length,
  },
  beforeRegionSha256: Object.fromEntries(before.sources), afterRegionSha256: after ? Object.fromEntries(after.sources) : null,
  walkway, buildings: results,
};
await writeFile(path.join(outPath, 'block-report.json'), JSON.stringify(report, null, 2));
console.log(`Saved ${results.length} building reports in ${path.resolve(outPath)}`);

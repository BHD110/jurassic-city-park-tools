import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

const require = createRequire(import.meta.url);
const nbt = require('prismarine-nbt');
const PoissonDiskSampling = require('poisson-disk-sampling');
const args = process.argv.slice(2);
const option = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const worldPath = option('--world', 'tools/unmined/world-snapshot-mediterranean-20261017');
const planPath = option('--plan', 'map/generated/upgrade-full.json');
const outputPath = option('--out', 'map/generated/city-green-density.json');
const seed = option('--seed', 'city-green-20261017-v1');
const BASE = { name: 'air' };
const allowedSoil = new Set(['grass_block', 'moss_block']);
const replaceable = new Set(['air', 'cave_air', 'void_air', 'short_grass', 'tall_grass', 'fern']);

class AnvilWorld {
  constructor(root) { this.root = path.resolve(root); this.regions = new Map(); this.chunks = new Map(); this.sources = new Map(); }
  async chunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.chunks.has(key)) return this.chunks.get(key);
    const filename = `r.${Math.floor(cx / 32)}.${Math.floor(cz / 32)}.mca`;
    let region = this.regions.get(filename);
    if (!region) {
      region = await readFile(path.join(this.root, 'region', filename));
      this.regions.set(filename, region);
      this.sources.set(filename, createHash('sha256').update(region).digest('hex'));
    }
    const slot = (cx & 31) + 32 * (cz & 31), sector = region.readUIntBE(slot * 4, 3);
    if (!sector) throw new Error(`Missing chunk ${cx},${cz}`);
    const offset = sector * 4096, size = region.readUInt32BE(offset), mode = region[offset + 4];
    const payload = region.subarray(offset + 5, offset + 4 + size);
    const raw = mode === 2 ? inflateSync(payload) : mode === 1 ? gunzipSync(payload) : mode === 3 ? payload : null;
    if (!raw) throw new Error(`Bad compression ${mode}`);
    const parsed = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
    const sections = new Map();
    for (const section of parsed.sections ?? []) {
      const palette = section.block_states?.palette?.map(p => p.Name.replace(/^minecraft:/, ''));
      if (!palette?.length) continue;
      const bits = Math.max(4, Math.ceil(Math.log2(palette.length)));
      sections.set(section.Y, { palette, data: section.block_states.data, bits, perLong: Math.floor(64 / bits), mask: (1n << BigInt(bits)) - 1n });
    }
    const chunk = { sections };
    this.chunks.set(key, chunk);
    return chunk;
  }
  async block(x, y, z) {
    const chunk = await this.chunk(Math.floor(x / 16), Math.floor(z / 16));
    const section = chunk.sections.get(Math.floor(y / 16));
    if (!section) return BASE.name;
    if (section.palette.length === 1) return section.palette[0];
    const index = ((y & 15) << 8) | ((z & 15) << 4) | (x & 15);
    const word = section.data?.[Math.floor(index / section.perLong)];
    if (word === undefined) throw new Error(`Missing block state at ${x},${y},${z}`);
    const paletteIndex = Number((BigInt.asUintN(64, word) >> BigInt(index % section.perLong * section.bits)) & section.mask);
    return section.palette[paletteIndex] ?? BASE.name;
  }
}

function hashGrid(size) {
  const cells = new Map();
  const key = (x, z) => `${x},${z}`;
  return {
    add(box) {
      for (let z = Math.floor(box.z1 / size); z <= Math.floor(box.z2 / size); z++)
        for (let x = Math.floor(box.x1 / size); x <= Math.floor(box.x2 / size); x++) {
          const k = key(x, z);
          if (!cells.has(k)) cells.set(k, []);
          cells.get(k).push(box);
        }
    },
    hit(box) {
      const seen = new Set();
      for (let z = Math.floor(box.z1 / size); z <= Math.floor(box.z2 / size); z++)
        for (let x = Math.floor(box.x1 / size); x <= Math.floor(box.x2 / size); x++)
          for (const item of cells.get(key(x, z)) ?? []) {
            if (seen.has(item)) continue;
            seen.add(item);
            if (box.x1 <= item.x2 && box.x2 >= item.x1 && box.z1 <= item.z2 && box.z2 >= item.z1) return true;
          }
      return false;
    },
  };
}

const plan = JSON.parse(await readFile(planPath, 'utf8'));
const world = new AnvilWorld(worldPath);
const parcels = plan.metadata.cityParcels.map(p => p.bounds);
const protectedGrid = hashGrid(16);
for (const b of plan.metadata.buildings) if (b.bounds) protectedGrid.add({x1:b.bounds.x1-2,z1:b.bounds.z1-2,x2:b.bounds.x2+2,z2:b.bounds.z2+2});
for (const e of plan.metadata.enclosures ?? []) protectedGrid.add({x1:e.bounds.x1-8,z1:e.bounds.z1-8,x2:e.bounds.x2+8,z2:e.bounds.z2+8});
for (const file of ['imported-ocean-house.json','imported-mediterranean-home.json','imported-fisherman-house.json','imported-jpog-visitor.json']) {
  const asset = JSON.parse(await readFile(`map/generated/${file}`, 'utf8'));
  const m = asset.metadata;
  if (m.importedBounds) {
    const b = m.importedBounds;
    protectedGrid.add({x1:b.x1-5,z1:b.z1-5,x2:b.x2+5,z2:b.z2+5});
  } else if (m.origin && m.dimensions) {
    protectedGrid.add({x1:m.origin.x-5,z1:m.origin.z-5,x2:m.origin.x+m.dimensions.width+4,z2:m.origin.z+m.dimensions.length+4});
  }
  if (m.connectedBoardwalk) {
    const b = m.connectedBoardwalk;
    protectedGrid.add({x1:b.x1-4,z1:b.z1-4,x2:b.x2+4,z2:b.z2+4});
  }
}
for (const p of plan.route.points) protectedGrid.add({x1:p.x-9,z1:p.z-9,x2:p.x+9,z2:p.z+9});

const noise = createNoise2D(alea(`${seed}:noise`));
const random = alea(`${seed}:points`);
const typeRandom = alea(`${seed}:types`);
const origin = -958, width = 1916;
const sampler = new PoissonDiskSampling({
  shape: [width, width], minDistance: 4, maxDistance: 9, tries: 20,
  distanceFunction: ([x, z]) => Math.max(0, Math.min(1, (noise((x+origin)/110, (z+origin)/110) + 1) / 2)),
}, random);
const candidates = sampler.fill().map(([x,z]) => [Math.round(x + origin), Math.round(z + origin)]);
const occupied = new Set(), covered = new Set(), operations = [];
const rejected = {}, accepted = {palm:0, tree:0, smallTree:0, shrub:0, groundcover:0};
const zoneName = (x,z) => `${z<0?'north':'south'}-${x<0?'west':'east'}`;
const acceptedZones = Object.fromEntries(['north-west','north-east','south-west','south-east'].map(k=>[k,0]));
const reject = reason => { rejected[reason] = (rejected[reason] ?? 0) + 1; };
const cell = (x,y,z) => `${x},${y},${z}`;
const groundCache = new Map();
async function surface(x,z) {
  const key = `${x},${z}`;
  if (groundCache.has(key)) return groundCache.get(key);
  let result = null;
  for (const y of [64,63]) {
    const name = await world.block(x,y,z);
    if (!replaceable.has(name)) { result = {y,name}; break; }
  }
  groundCache.set(key,result);
  return result;
}
const soil = async (x,z) => allowedSoil.has((await surface(x,z))?.name);
function inCity(x,z) { return parcels.some(b => x>=b.x1-20 && x<=b.x2+20 && z>=b.z1-20 && z<=b.z2+20); }
function addBox(x1,y1,z1,x2,y2,z2,block) { operations.push({kind:'box',x1,y1,z1,x2,y2,z2,block:`minecraft:${block}`}); }
function plant(type,x,y,z) {
  const voxels = new Map(), footprint = new Set();
  const put = (dx,dy,dz,block) => { const X=x+dx,Y=y+dy,Z=z+dz; voxels.set(cell(X,Y,Z),{x:X,y:Y,z:Z,block}); footprint.add(`${X},${Z}`); };
  const height = type==='palm'?10:type==='tree'?7:type==='smallTree'?5:type==='shrub'?2:1;
  if (type==='groundcover') put(0,0,0,'fern');
  else if (type==='shrub') {
    for (let dz=-1;dz<=1;dz++) for (let dx=-1;dx<=1;dx++) if (Math.abs(dx)+Math.abs(dz)<=2) put(dx,0,dz,'azalea_leaves[persistent=true]');
    put(0,1,0,'flowering_azalea_leaves[persistent=true]');
  } else {
    for (let dy=0;dy<height;dy++) put(0,dy,0,type==='palm'?'jungle_log':'oak_log');
    const layers = type==='palm' ? [[height-2,2],[height-1,3],[height,1]] : type==='tree' ? [[height-3,2],[height-2,3],[height-1,2],[height,1]] : [[height-2,1],[height-1,2],[height,1]];
    for (const [dy,r] of layers) for (let dz=-r;dz<=r;dz++) for (let dx=-r;dx<=r;dx++) {
      if (dx*dx+dz*dz>r*r+1) continue;
      put(dx,dy,dz,type==='palm'?'jungle_leaves[persistent=true]':'oak_leaves[persistent=true]');
    }
  }
  return {voxels:[...voxels.values()],footprint:[...footprint].map(s=>s.split(',').map(Number)),radius:type==='palm'||type==='tree'?3:type==='smallTree'?2:type==='shrub'?1:0};
}
for (const [x,z] of candidates) {
  if (!inCity(x,z)) { reject('outside_city_band'); continue; }
  const roll=typeRandom();
  const type=roll<.19?'palm':roll<.38?'tree':roll<.56?'smallTree':roll<.87?'shrub':'groundcover';
  if ((accepted.palm+accepted.tree+accepted.smallTree>=4800 && ['palm','tree','smallTree'].includes(type)) ||
      (accepted.shrub>=7600 && type==='shrub') || (accepted.groundcover>=2500 && type==='groundcover')) { reject('type_capacity'); continue; }
  const base = await surface(x,z);
  if (!base || !allowedSoil.has(base.name)) { reject('not_grass_or_moss'); continue; }
  const shape=plant(type,x,base.y+1,z);
  const box={x1:x-shape.radius,z1:z-shape.radius,x2:x+shape.radius,z2:z+shape.radius};
  if (protectedGrid.hit(box)) { reject('building_route_or_asset'); continue; }
  let reason=null;
  for (const [px,pz] of shape.footprint) if (!(await soil(px,pz))) { reason='road_or_water_under_crown'; break; }
  if (reason) { reject(reason); continue; }
  for (const v of shape.voxels) {
    if (occupied.has(cell(v.x,v.y,v.z))) { reason='new_plant_overlap'; break; }
    const old=await world.block(v.x,v.y,v.z);
    if (!replaceable.has(old)) { reason='existing_block_overlap'; break; }
  }
  if (reason) { reject(reason); continue; }
  for (const v of shape.voxels) { occupied.add(cell(v.x,v.y,v.z)); addBox(v.x,v.y,v.z,v.x,v.y,v.z,v.block); }
  for (const [px,pz] of shape.footprint) covered.add(`${Math.floor(px/8)},${Math.floor(pz/8)}`);
  accepted[type]++;
  acceptedZones[zoneName(x,z)]++;
}

function mergeAdjacent(items, fixedKeys, axis) {
  const grouped = new Map();
  for (const b of items) {
    const key=fixedKeys.map(k=>b[k]).join('|');
    if(!grouped.has(key)) grouped.set(key,[]);
    grouped.get(key).push(b);
  }
  const out=[];
  for (const group of grouped.values()) {
    group.sort((a,b)=>a[`${axis}1`]-b[`${axis}1`]);
    let current=null;
    for (const item of group) {
      if (current && item[`${axis}1`]===current[`${axis}2`]+1) current[`${axis}2`]=item[`${axis}2`];
      else { if (current) out.push(current); current={...item}; }
    }
    if (current) out.push(current);
  }
  return out;
}
const mergedX=mergeAdjacent(operations,['block','y1','z1'],'x');
const mergedZ=mergeAdjacent(mergedX,['block','y1','x1','x2'],'z');
const packedOperations=mergeAdjacent(mergedZ,['block','x1','x2','z1','z2'],'y');
let packedCells=0;
const packedSeen=new Set();
for (const op of packedOperations) for(let y=op.y1;y<=op.y2;y++) for(let z=op.z1;z<=op.z2;z++) for(let x=op.x1;x<=op.x2;x++) {
  const key=cell(x,y,z);
  if (!occupied.has(key) || packedSeen.has(key)) throw new Error(`Packing mismatch at ${key}`);
  packedSeen.add(key);
  packedCells++;
}
if (packedCells!==occupied.size) throw new Error(`Packing lost cells: ${packedCells}/${occupied.size}`);

// Coverage is sampled on 8x8 city cells so it can be compared without rendering every plant.
const eligible = new Set(), beforeCovered = new Set();
for (let z=origin;z<origin+width;z+=8) for(let x=origin;x<origin+width;x+=8) {
  if (!inCity(x,z)) continue;
  const key=`${Math.floor(x/8)},${Math.floor(z/8)}`;
  if (!(await soil(x,z))) continue;
  eligible.add(key);
  for(let y=66;y<=82;y++) {
    const name=await world.block(x,y,z);
    if (name.includes('leaves')) { beforeCovered.add(key); break; }
  }
}
const afterCovered = new Set([...beforeCovered,...covered].filter(k=>eligible.has(k)));
const ratio = count => eligible.size ? Math.round(count/eligible.size*1000)/10 : 0;
const acceptedTotal=Object.values(accepted).reduce((a,b)=>a+b,0);
if (!acceptedTotal && eligible.size > 100) throw new Error(`No greenery accepted despite ${eligible.size} eligible 8m cells; inspect protection bounds`);
const zoneCoverage={};
for (const zone of Object.keys(acceptedZones)) {
  const inZone = key => { const [x,z]=key.split(',').map(Number); return zoneName(x,z)===zone; };
  const cells=[...eligible].filter(inZone);
  const before=cells.filter(key=>beforeCovered.has(key)).length;
  const after=cells.filter(key=>afterCovered.has(key)).length;
  zoneCoverage[zone]={accepted:acceptedZones[zone],eligibleCells:cells.length,beforeCells:before,afterCells:after,
    beforePercent:cells.length?Math.round(before/cells.length*1000)/10:0,
    afterPercent:cells.length?Math.round(after/cells.length*1000)/10:0};
}
if (Object.values(zoneCoverage).some(z=>z.accepted<100 || z.afterPercent<=z.beforePercent))
  throw new Error('City greenery did not improve every quadrant');
const patch={name:'Seeded dense city greenery',bounds:{x1:origin,z1:origin,x2:origin+width-1,z2:origin+width-1},operations:packedOperations,metadata:{
  seed,sourceWorld:world.root,metadataPlan:path.resolve(planPath),regionSha256:Object.fromEntries(world.sources),
  libraries:{'poisson-disk-sampling':'2.3.1','simplex-noise':'4.0.3',alea:'1.0.1'},
  sources:['https://github.com/kchapelier/poisson-disk-sampling','https://github.com/jwagner/simplex-noise.js'],
  candidates:candidates.length,accepted,acceptedTotal,rejected,operationCount:packedOperations.length,unpackedOperationCount:operations.length,
  coverage8m:{definition:'8m cells whose sample point has grass/moss soil; before=existing leaves above sample, after=before or proposed plant footprint in cell',eligibleCells:eligible.size,beforeCells:beforeCovered.size,afterCells:afterCovered.size,beforePercent:ratio(beforeCovered.size),afterPercent:ratio(afterCovered.size)},
  zoneCoverage,
  protection:{buildings:plan.metadata.buildings.length,routePoints:plan.route.points.length,enclosures:(plan.metadata.enclosures??[]).length,importPatches:4,acceptedOverlaps:0},
  staticValidation:{passed:true,packedCells,originalCells:occupied.size,groundSupportedPlants:acceptedTotal},
}};
await writeFile(outputPath,JSON.stringify(patch));
await writeFile(outputPath.replace(/\.json$/,'.report.json'),JSON.stringify(patch.metadata,null,2));
console.log(JSON.stringify({output:path.resolve(outputPath),...patch.metadata},null,2));

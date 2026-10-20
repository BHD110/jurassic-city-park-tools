import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function addCityGroundDetails(full) {
if (!full?.operations || !full.metadata?.buildings || !full.metadata?.cityParcels || !full.metadata?.enclosures) {
  throw new Error('City ground details require a populated full plan');
}
if (full.metadata.cityGroundDetails) throw new Error('City ground details are already present in this plan');
const planOperations = full.operations.length;
const operations = [];
const sites = [];
const failures = [];
const rail = [
  { x1: -360, x2: -340, z1: -360, z2: 660 },
  { x1: 340, x2: 360, z1: -360, z2: 660 },
  { x1: -360, x2: 360, z1: -360, z2: -340 },
  { x1: -360, x2: 360, z1: 640, z2: 660 },
];
const blocked = [
  ...rail,
  ...full.metadata.buildings.map(({bounds:b}) => ({x1:b.x1-5,x2:b.x2+5,z1:b.z1-5,z2:b.z2+5})),
  ...full.metadata.cityParcels.map(({bounds:b}) => ({x1:b.x1-1,x2:b.x2+1,z1:b.z1-1,z2:b.z2+1})),
  ...full.metadata.enclosures.map(({bounds:b}) => ({x1:b.x1-12,x2:b.x2+12,z1:b.z1-12,z2:b.z2+12})),
];
const roads = [
  ...[-980,-780,-600,600,780,980].flatMap(p=>[
    {x1:-995,x2:995,z1:p-10,z2:p+10},
    {x1:p-10,x2:p+10,z1:-995,z2:995},
  ]),
  ...[-420,-240,0,240,420].flatMap(z=>[
    {x1:-995,x2:-600,z1:z-4,z2:z+4},
    {x1:600,x2:995,z1:z-4,z2:z+4},
  ]),
];
const intersects = (a,b) => a.x1<=b.x2 && a.x2>=b.x1 && a.z1<=b.z2 && a.z2>=b.z1;
const rect = (x1,z1,x2,z2) => ({x1,z1,x2,z2});
const id = block => block.includes(':') ? block : `minecraft:${block}`;
const box = (x1,y1,z1,x2,y2,z2,block) => operations.push({kind:'box',x1,y1,z1,x2,y2,z2,block:id(block)});
let seed=19930613;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);

// Grid cells index only existing structures and hard surface changes; the flat world's
// untouched surface is grass at Y=63. Air-clearing operations do not occupy a site.
const occupied = new Set();
const changedGround = new Map();
const reservedWalkways = new Set();
for (const op of full.operations) {
  if (op.kind!=='box' || op.x2 < -990 || op.x1 > 990 || op.z2 < -990 || op.z1 > 990) continue;
  const x1=Math.max(-990,op.x1), x2=Math.min(990,op.x2);
  const z1=Math.max(-990,op.z1), z2=Math.min(990,op.z2);
  if (op.y1<=63 && op.y2>=63) {
    for(let z=z1;z<=z2;z++) for(let x=x1;x<=x2;x++) changedGround.set(`${x},${z}`,op.block);
  }
  if(op.y2>=64 && op.y1<=87 && op.block!=='minecraft:air') {
    for(let z=z1;z<=z2;z++) for(let x=x1;x<=x2;x++) occupied.add(`${x},${z}`);
  }
}

function safe(site) {
  if(site.x1<-988||site.x2>988||site.z1<-988||site.z2>988) return false;
  if(site.x1<=14&&site.x2>=-14) return false;
  if(blocked.some(b=>intersects(site,b))||sites.some(s=>intersects(site,s.reserved))) return false;
  for(let z=site.z1;z<=site.z2;z++) for(let x=site.x1;x<=site.x2;x++) {
    const key=`${x},${z}`;
    if(occupied.has(key)||reservedWalkways.has(key)) return false;
    const ground=changedGround.get(key);
    if(ground && ground!=='minecraft:grass_block' && ground!=='minecraft:moss_block') return false;
  }
  return true;
}

function connectedWalkway(cx,cz) {
  function clear(strip) {
    if(strip.x1<-988||strip.x2>988||strip.z1<-988||strip.z2>988) return false;
    if(blocked.some(area=>intersects(strip,area))||sites.some(site=>intersects(strip,site.reserved))) return false;
    for(let z=strip.z1;z<=strip.z2;z++) for(let x=strip.x1;x<=strip.x2;x++) {
      const key=`${x},${z}`,ground=changedGround.get(key);
      if(occupied.has(key)||reservedWalkways.has(key)||ground && ground!=='minecraft:grass_block' && ground!=='minecraft:moss_block') return false;
    }
    return true;
  }
  const candidates=[];
  for(const direction of ['south','east','west']) {
    const strips=[];
    const stem=direction==='south'?0:3;
    let valid=true;
    for(let step=1;step<=stem;step++) {
      const strip=rect(cx-1,cz+14+step,cx+1,cz+14+step);
      if(!clear(strip)) {valid=false;break;}
      strips.push(strip);
    }
    if(!valid) continue;
    for(let step=1;step<=60-stem;step++) {
      const x=direction==='east'?cx+step:direction==='west'?cx-step:cx;
      const z=direction==='south'?cz+14+step:cz+17;
      const strip=direction==='south'?rect(x-1,z,x+1,z):rect(x,z-1,x,z+1);
      if(roads.some(road=>intersects(strip,road))) {
        if(strips.length>=2) candidates.push(strips);
        break;
      }
      if(!clear(strip)) break;
      strips.push(strip);
    }
  }
  candidates.sort((a,b)=>a.length-b.length);
  return candidates[0]||null;
}

function shop(cx,cz,index) {
  const b=rect(cx-8,cz-8,cx+8,cz+6);
  const palette=[['pink_terracotta','red_wool'],['yellow_terracotta','green_wool'],['light_gray_concrete','orange_wool'],['lime_terracotta','white_wool']][index%4];
  const labels=['录像店','餐厅','杂志店','热带商店','照相馆','咖啡店'];
  const roof=index%3===0?'bricks':index%3===1?'dark_oak_planks':'waxed_cut_copper';
  box(b.x1,63,b.z1,b.x2,63,b.z2,'stone_bricks');
  box(b.x1+1,64,b.z1+1,b.x2-1,64,b.z2-1,'smooth_stone');
  box(b.x1+1,65,b.z1+1,b.x2-1,71,b.z2-1,palette[0]);
  box(b.x1+2,65,b.z1+2,b.x2-2,70,b.z2-2,'air');
  box(b.x1+2,66,b.z2-1,cx-3,69,b.z2-1,'brown_stained_glass');
  box(cx+3,66,b.z2-1,b.x2-2,69,b.z2-1,'brown_stained_glass');
  box(cx-2,65,b.z2-1,cx+2,68,b.z2-1,'air');
  box(cx-2,64,b.z2,cx+2,64,b.z2,'smooth_stone');
  box(cx-1,65,b.z1+3,cx+1,65,b.z1+4,'dark_oak_planks');
  box(cx-1,66,b.z1+3,cx+1,66,b.z1+3,'spruce_slab[type=bottom]');
  for(const x of [b.x1+3,b.x2-3]) {
    box(x,65,b.z1+3,x,68,b.z1+6,'bookshelf');
    box(x,69,b.z1+3,x,69,b.z1+6,'dark_oak_slab[type=bottom]');
  }
  for(const x of [b.x1+1,b.x2-1]) box(x,67,cz,x,67,cz,'sea_lantern');
  box(b.x1,72,b.z1,b.x2,72,b.z2,roof);
  box(b.x1+1,73,b.z1+1,b.x2-1,73,b.z2-1,index%2?'spruce_slab[type=bottom]':'brick_slab[type=bottom]');
  for(let x=b.x1+1;x<=b.x2-1;x+=3) box(x,70,b.z2,x+2,70,b.z2+2,(x-b.x1)%2?palette[1]:'white_wool');
  box(cx-5,71,b.z2,cx+5,71,b.z2,'dark_oak_planks');
  operations.push({kind:'sign',x:cx-2,y:71,z:b.z2+1,lines:[labels[index%labels.length]],block:'minecraft:oak_wall_sign[facing=south]'});
  box(b.x1,63,b.z2+1,b.x2,63,b.z2+3,'smooth_stone');
  for(const [x1,x2] of [[cx-8,cx-2],[cx+2,cx+8]]) {
    box(x1,63,b.z2+4,x2,63,b.z2+8,'gray_concrete');
    for(const x of [x1,x2]) box(x,63,b.z2+4,x,63,b.z2+8,'white_concrete');
  }
  box(cx-1,63,b.z2+4,cx+1,63,b.z2+8,'smooth_stone');
  for(const x of [b.x1+1,b.x2-1]) {
    box(x,64,b.z2+1,x,64,b.z2+1,'moss_block');
    box(x,65,b.z2+1,x,65,b.z2+1,'potted_fern');
  }
  // A shallow upper terrace changes the silhouette without creating a second storey.
  if(index%4===0) {
    box(b.x1+3,73,b.z1+2,b.x2-3,73,b.z1+4,'dark_oak_slab[type=bottom]');
    box(b.x1+3,74,b.z1+4,b.x2-3,74,b.z1+4,'dark_oak_fence');
  }
  return b;
}

function courtyard(cx,cz,index) {
  const b=rect(cx-8,cz-8,cx+8,cz+6);
  box(b.x1,63,b.z1,b.x2,63,b.z2,'stone_bricks');
  box(b.x1+1,63,b.z1+1,b.x2-1,63,b.z2-1,'moss_block');
  for(const z of [b.z1+1,b.z2-1]) {
    box(b.x1+1,64,z,b.x1+5,64,z,'mossy_stone_brick_wall');
    box(b.x2-5,64,z,b.x2-1,64,z,'mossy_stone_brick_wall');
  }
  for(const x of [b.x1+1,b.x2-1]) box(x,64,b.z1+2,x,64,b.z2-2,'mossy_stone_brick_wall');
  box(cx-2,63,b.z2-1,cx+2,63,b.z2+1,'smooth_stone');
  box(cx-2,63,b.z2+2,cx+2,63,b.z2+8,'smooth_stone');
  for(const x of [cx-5,cx+5]) {
    box(x,64,cz-2,x,69,cz-2,'jungle_log');
    box(x-2,70,cz-4,x+2,71,cz,'jungle_leaves[persistent=true]');
  }
  box(cx-3,64,cz+2,cx+3,64,cz+2,'spruce_stairs[facing=north]');
  box(cx-4,64,cz-5,cx+4,64,cz-5,'flowering_azalea_leaves[persistent=true]');
  if(index%2===0) for(const x of [cx-7,cx+7]) {
    box(x,64,cz+1,x,68,cz+1,'polished_andesite_wall');
    box(x,69,cz+1,x,69,cz+1,'lantern');
  }
  return b;
}

// Candidates cover both outer city wings and leave broad breathing room between sites.
const candidates=[];
for(const shift of [0,7,14,21,28]) for(const side of [-1,1]) for(let z=-950+shift;z<=930;z+=35) for(let x=615+shift;x<=970;x+=35) {
  candidates.push({x:side*x+Math.floor(random()*7)-3,z:z+Math.floor(random()*7)-3,rank:random()});
}
candidates.sort((a,b)=>a.rank-b.rank);
for(const c of candidates) {
  if(sites.length>=110) break;
  const footprint=rect(c.x-10,c.z-10,c.x+10,c.z+14);
  if(!safe(footprint)) continue;
  const walkway=connectedWalkway(c.x,c.z);
  if(!walkway) continue;
  const start=operations.length;
  const type=sites.length%4===3?'courtyard':'shop';
  const bounds=type==='shop'?shop(c.x,c.z,sites.length):courtyard(c.x,c.z,sites.length);
  for(const segment of walkway) box(segment.x1,63,segment.z1,segment.x2,63,segment.z2,'smooth_stone');
  for(const segment of walkway) for(let z=segment.z1;z<=segment.z2;z++) for(let x=segment.x1;x<=segment.x2;x++) reservedWalkways.add(`${x},${z}`);
  sites.push({id:`city-ground-${String(sites.length+1).padStart(3,'0')}`,type,bounds,reserved:footprint,walkway,operations:operations.length-start});
}

for(const op of operations) {
  if(op.kind==='box') {
    if(op.x1>op.x2||op.y1>op.y2||op.z1>op.z2||op.y1<63) failures.push(`Invalid operation ${JSON.stringify(op)}`);
    if(!sites.some(site=>[site.reserved,...site.walkway].some(area=>op.x1>=area.x1&&op.x2<=area.x2&&op.z1>=area.z1&&op.z2<=area.z2))) {
      failures.push(`Operation outside reserved sites ${JSON.stringify(op)}`);
    }
  } else if(op.kind==='sign') {
    if(op.y<64||!sites.some(site=>op.x>=site.reserved.x1&&op.x<=site.reserved.x2&&op.z>=site.reserved.z1&&op.z<=site.reserved.z2)) {
      failures.push(`Sign outside reserved sites ${JSON.stringify(op)}`);
    }
  } else failures.push(`Unexpected operation ${JSON.stringify(op)}`);
}
if(sites.length<98) failures.push(`Only ${sites.length} connected sites; expected at least 98`);
const disconnectedWalkways=sites.filter(site=>{
  const end=site.walkway.at(-1);
  const contact=rect(end.x1-1,end.z1-1,end.x2+1,end.z2+1);
  return !roads.some(road=>intersects(contact,road));
}).length;
if(disconnectedWalkways) failures.push(`${disconnectedWalkways} walkways do not touch a public road`);
const counts=Object.fromEntries(['shop','courtyard'].map(type=>[type,sites.filter(s=>s.type===type).length]));
const boxes=operations.filter(op=>op.kind==='box');
const report={planOperations,patchOperations:operations.length,counts,sites:sites.length,connectedWalkways:sites.length-disconnectedWalkways,maximumWalkwayLength:Math.max(...sites.map(site=>site.walkway.length)),groundY:63,minimumStructureY:Math.min(...boxes.map(o=>o.y1)),maxStructureY:Math.max(...boxes.map(o=>o.y2)),collisionsWithExisting:0,collisionsWithRailOrEnclosures:0,failures};
if(failures.length) throw new Error(JSON.stringify(report));
full.operations.push(...operations);
full.metadata.cityGroundDetails={counts,sites:sites.length,connectedWalkways:sites.length,operations:operations.length,groundY:63};
return {report,sites,operations};
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
const root = path.resolve('map/generated');
const source = await readFile(path.join(root,'full.json'));
const full = JSON.parse(source);
const baseFullSha256=createHash('sha256').update(source).digest('hex');
const {report,sites,operations}=addCityGroundDetails(full);
const patch={name:'Jurassic City Ground-Level Street Blocks',bounds:full.bounds,operations,metadata:{baseFullSha256,counts:report.counts,sites}};
await writeFile(path.join(root,'city-ground-patch.json'),JSON.stringify(patch));
await writeFile(path.resolve('verification/city-ground-patch-report.json'),JSON.stringify({baseFullSha256,...report},null,2));
console.log(JSON.stringify({baseFullSha256,...report},null,2));
}

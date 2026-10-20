import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const id = block => block.includes(':') ? block : `minecraft:${block}`;
const hit = (a,b) => a.x1<=b.x2 && a.x2>=b.x1 && a.z1<=b.z2 && a.z2>=b.z1;
const rect = (x1,z1,x2,z2) => ({x1,z1,x2,z2});
const floorChunk = n => Math.floor(n/16);

export function addDensityDetails(plan) {
  if (!plan?.operations || !plan.metadata?.buildings || !plan.metadata?.enclosures || !plan.route) {
    throw new Error('Density details require the completed full plan and route');
  }
  if (plan.metadata.densityDetails) throw new Error('Density details already applied');
  const originalCount=plan.operations.length;
  const additions=[];
  const trees=[];
  const stats={trees:0,parkTrees:0,cityTrees:0,understory:0,groves:0,attempts:0,rejectedOccupied:0,rejectedGround:0,rejectedProtected:0};
  const box=(x1,y1,z1,x2,y2,z2,block)=>additions.push({kind:'box',x1,y1,z1,x2,y2,z2,block:id(block)});
  let seed=19930614;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const integer=(a,b)=>a+Math.floor(random()*(b-a+1));
  const choose=items=>items[Math.floor(random()*items.length)];

  const occupied=new Map(), ground=new Map();
  function index(map,op) {
    for(let cz=floorChunk(op.z1);cz<=floorChunk(op.z2);cz++) for(let cx=floorChunk(op.x1);cx<=floorChunk(op.x2);cx++) {
      const key=`${cx},${cz}`;
      if(!map.has(key)) map.set(key,[]);
      map.get(key).push(op);
    }
  }
  for(const op of plan.operations) {
    if(op.kind!=='box') continue;
    if(op.y1<=63 && op.y2>=63) index(ground,op);
    if(op.y2>=64 && op.y1<=96 && op.block!=='minecraft:air') index(occupied,op);
  }
  function nearby(map,r) {
    const found=new Set();
    for(let cz=floorChunk(r.z1);cz<=floorChunk(r.z2);cz++) for(let cx=floorChunk(r.x1);cx<=floorChunk(r.x2);cx++) {
      for(const op of map.get(`${cx},${cz}`)||[]) found.add(op);
    }
    return found;
  }
  function surfaceAt(x,z) {
    const list=ground.get(`${floorChunk(x)},${floorChunk(z)}`)||[];
    for(let i=list.length-1;i>=0;i--) {
      const op=list[i];
      if(x>=op.x1&&x<=op.x2&&z>=op.z1&&z<=op.z2) return op.block;
    }
    return 'minecraft:grass_block';
  }
  const protectedAreas=[
    ...plan.metadata.buildings.map(({bounds:b})=>rect(b.x1-8,b.z1-8,b.x2+8,b.z2+8)),
    ...plan.metadata.enclosures.map(({bounds:b})=>rect(b.x1-8,b.z1-8,b.x2+8,b.z2+8)),
    rect(-85,-260,5,-145),
    rect(-18,-580,18,590),rect(-580,-18,580,18),
    ...[-980,-780,-600,600,780,980].flatMap(p=>[rect(-995,p-20,995,p+20),rect(p-20,-995,p+20,995)]),
    rect(-980,620,980,680),
    ...[-420,-240,0,240,420].flatMap(z=>[rect(-995,z-12,-600,z+12),rect(600,z-12,995,z+12)]),
    ...[-450,-330,-210,-100,0,100,210,330,450].flatMap(x=>[rect(x-12,-995,x+12,-600),rect(x-12,600,x+12,995)]),
    ...plan.metadata.cityParcels.map(({bounds:b})=>rect(b.x1-2,b.z1-2,b.x2+2,b.z2+2)),
  ];
  const points=plan.route.points||plan.route;
  for(let i=0;i<points.length-1;i++) {
    const a=points[i],b=points[i+1];
    protectedAreas.push(rect(Math.min(a.x,b.x)-8,Math.min(a.z,b.z)-8,Math.max(a.x,b.x)+8,Math.max(a.z,b.z)+8));
  }
  const placed=[];
  function clear(r) {
    if(r.x1<-990||r.x2>990||r.z1<-990||r.z2>990) return false;
    if(protectedAreas.some(area=>hit(r,area))||placed.some(area=>hit(r,area))) {stats.rejectedProtected++;return false;}
    if([...nearby(occupied,r)].some(op=>hit(r,op))) {stats.rejectedOccupied++;return false;}
    for(let z=r.z1;z<=r.z2;z++) for(let x=r.x1;x<=r.x2;x++) {
      if(surfaceAt(x,z)!=='minecraft:grass_block') {stats.rejectedGround++;return false;}
    }
    return true;
  }
  function crown(x,z,y,reach) {
    const leaves='jungle_leaves[persistent=true]';
    for(const [dy,r] of [[-3,reach-1],[-2,reach],[0,reach],[2,reach-1],[3,Math.max(1,reach-2)]]) {
      for(let dz=-r;dz<=r;dz++) {
        const span=Math.floor(Math.sqrt(r*r-dz*dz));
        if(span>0) box(x-span,y+dy,z+dz,x+span,y+dy,z+dz,leaves);
      }
    }
  }
  function plant(x,z,zone,index) {
    const high=integer(10,17),reach=index%7===0?5:4,top=64+high;
    box(x,64,z,x,top-2,z,index%5===0?'stripped_jungle_log':'jungle_log');
    for(const [dx,dz] of [[2,0],[-2,1],[0,2],[1,-2]]) {
      const bx=x+Math.sign(dx),bz=z+Math.sign(dz);
      box(Math.min(bx,x+dx),top-4,Math.min(bz,z+dz),Math.max(bx,x+dx),top-2,Math.max(bz,z+dz),'jungle_log');
    }
    crown(x,z,top,reach);
    const shrubs=integer(1,3);
    for(let j=0;j<shrubs;j++) {
      const angle=random()*Math.PI*2,rr=integer(5,7);
      const sx=x+Math.round(Math.cos(angle)*rr),sz=z+Math.round(Math.sin(angle)*rr);
      const sr=rect(sx,sz,sx,sz);
      if(protectedAreas.some(area=>hit(sr,area))||placed.some(area=>hit(sr,area))||surfaceAt(sx,sz)!=='minecraft:grass_block'||[...nearby(occupied,sr)].some(op=>hit(sr,op))) continue;
      box(sx,64,sz,sx,64,sz,choose(['fern','large_fern','flowering_azalea_leaves[persistent=true]','moss_carpet']));
      stats.understory++;
    }
    placed.push(rect(x-reach-1,z-reach-1,x+reach+1,z+reach+1));
    trees.push({x,z,zone,height:high,reach});
    stats.trees++;
    stats[zone==='park'?'parkTrees':'cityTrees']++;
  }

  // Seed clustered groves; staggered centers and variable radii avoid a point grid.
  const clusters=[];
  for(let z=-315;z<=560;z+=55) for(const x of [-315,-280,-245,-190,-55,55,190,245,280,315]) {
    clusters.push({x:x+integer(-13,13),z:z+integer(-15,15),zone:'park',target:integer(3,7),radius:integer(18,31)});
  }
  for(const side of [-1,1]) for(let z=-940;z<=940;z+=68) for(const ax of [665,735,825,915]) {
    clusters.push({x:side*ax+integer(-15,15),z:z+integer(-18,18),zone:'city',target:integer(4,8),radius:integer(23,37)});
  }
  for(let z=-940;z<=940;z+=75) for(const x of [-515,-390,-270,-150,150,270,390,515]) {
    clusters.push({x:x+integer(-17,17),z:z+integer(-18,18),zone:'city',target:integer(3,6),radius:integer(20,32)});
  }
  // Park first, with extra density where the elevated ride faces open grass.
  for(const cluster of clusters) {
    if(stats.trees>=1050) break;
    let grown=0;
    for(let attempt=0;attempt<cluster.target*28&&grown<cluster.target;attempt++) {
      stats.attempts++;
      const angle=random()*Math.PI*2,radius=Math.sqrt(random())*cluster.radius;
      const x=Math.round(cluster.x+Math.cos(angle)*radius),z=Math.round(cluster.z+Math.sin(angle)*radius);
      const reach=stats.trees%7===0?5:4,site=rect(x-reach-1,z-reach-1,x+reach+1,z+reach+1);
      if(!clear(site)) continue;
      plant(x,z,cluster.zone,stats.trees);
      grown++;
    }
    if(grown) stats.groves++;
  }
  if(stats.trees<800||stats.trees>1200) throw new Error(`Density target missed: ${JSON.stringify(stats)}`);
  stats.operations=additions.length;
  plan.operations.push(...additions);
  plan.metadata.densityDetails={...stats,originalCount};
  return {stats,operations:additions,trees};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const folder=path.resolve('map/generated');
  const bytes=await readFile(path.join(folder,'full.json'));
  const plan=JSON.parse(bytes);
  const baseFullSha256=createHash('sha256').update(bytes).digest('hex');
  const {stats,operations,trees}=addDensityDetails(plan);
  const report={baseFullSha256,...stats,collisionCount:0,samples:trees.filter((_,i)=>i%Math.max(1,Math.floor(trees.length/18))===0).slice(0,18)};
  await writeFile(path.join(folder,'density-patch.json'),JSON.stringify({name:'Jurassic City Park Density',bounds:plan.bounds,operations,metadata:{baseFullSha256,stats}}));
  await writeFile(path.resolve('verification/density-patch-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}

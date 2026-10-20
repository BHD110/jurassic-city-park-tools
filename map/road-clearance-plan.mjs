import {readFile, writeFile} from 'node:fs/promises';
import {worldReader} from '../verification/city-world-reader.mjs';

const backup = 'backups/before-road-clearance-20261018-105607';
const plan = JSON.parse(await readFile(`${backup}/iv-traffic.json`, 'utf8'));
const full = JSON.parse(await readFile('map/generated/upgrade-full.json', 'utf8'));
const reader = worldReader(`${backup}/world`);
const xs = [-980,-780,-600,-450,-330,-210,-100,0,100,210,330,450,600,780,980];
const zs = [-980,-780,-600,-420,-240,0,240,420,600,780,980];
const main = [-980,-780,-600,600,780,980];
const locals = new Set([-450,-330,-210,-100,0,100,210,330,450,-420,-240,240,420]);
const offset = value => locals.has(value) ? 3 : 4;
for (const route of plan.routes) {
  if (!route.id.startsWith('cell_')) continue;
  const [, xi, zi] = route.id.split('_').map((v,i) => i ? Number(v) : v);
  const x1=xs[xi], x2=xs[xi+1], z1=zs[zi], z2=zs[zi+1];
  const corners = [[x1+14,z1+offset(z1)],[x2-14,z1+offset(z1)],
    [x2-offset(x2),z1+14],[x2-offset(x2),z2-14],
    [x2-14,z2-offset(z2)],[x1+14,z2-offset(z2)],
    [x1+offset(x1),z2-14],[x1+offset(x1),z1+14]];
  const points=[];
  for(let i=0;i<corners.length;i++) {
    const a=corners[i],b=corners[(i+1)%corners.length];
    const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/12);
    for(let n=0;n<steps;n++) points.push({x:a[0]+(b[0]-a[0])*n/steps,z:a[1]+(b[1]-a[1])*n/steps});
  }
  route.points=points;
}
await writeFile('map/generated/iv-traffic.json',JSON.stringify(plan,null,2)+'\n');
if(process.argv.includes('--routes-only')) {console.log('Updated lane geometry; all vehicle IDs/models retained.'); process.exit(0);}

const scan=JSON.parse(await readFile('verification/road-clearance-wider.json','utf8'));
const track=new Set();
for(const p of full.route.points) for(const y of [p.y,p.y-1]) track.add(`${p.x},${y},${p.z}`);
const buildings=full.metadata.buildings||[];
const protectedAt=(x,y,z)=>track.has(`${x},${y},${z}`)||buildings.some(({bounds:b})=>x>=b.x1&&x<=b.x2&&y>=b.y1&&y<=b.y2&&z>=b.z1&&z<=b.z2)
  || (Math.abs(x)<=65&&z>=610&&z<=688);
const operations=[], cleared=new Set(), skipped=[];
function cell(x,y,z,block,replace) {
  const key=`${x},${y},${z}`;
  if(cleared.has(key))return;
  if(protectedAt(x,y,z)){skipped.push({x,y,z,replace});return;}
  cleared.add(key);
  operations.push({kind:'box',x1:x,y1:y,z1:z,x2:x,y2:y,z2:z,block,...(replace?{replace}:{})});
}
for(const p of scan.obstacles) {
  cell(p.x,p.y,p.z,'minecraft:air',p.block.startsWith('minecraft:')?p.block:undefined);
  // Remove the entire obstructing lamp, including the lantern above headroom.
  if(p.block==='minecraft:polished_blackstone_wall'||p.block==='minecraft:sea_lantern') {
    for(let y=64;y<=71;y++) {
      const actual=await reader.block(p.x,y,p.z);
      if(['minecraft:polished_blackstone_wall','minecraft:sea_lantern'].includes(actual?.Name))cell(p.x,y,p.z,'minecraft:air',actual.Name);
    }
  }
}
for(const p of scan.unsupported)cell(p.x,63,p.z,'minecraft:gray_concrete');
// Convert the inner half of main-road sidewalks; retain two-block outer sidewalks.
for(const center of main) for(const side of [-1,1]) for(const delta of [7,8]) {
  for(const axis of ['x','z']) operations.push({kind:'box',
    x1:axis==='x'?-995:center+side*delta,z1:axis==='x'?center+side*delta:-995,y1:63,
    x2:axis==='x'?995:center+side*delta,z2:axis==='x'?center+side*delta:995,y2:63,
    block:'minecraft:gray_concrete',replace:'minecraft:smooth_stone'});
}
// Local streets: 11-block asphalt, two-block sidewalks, without touching buildings.
const groundAllowed=new Set(['minecraft:smooth_stone','minecraft:grass_block','minecraft:dirt','minecraft:coarse_dirt','minecraft:dirt_path','minecraft:air']);
let widened=0;
async function local(axis,center,from,to) {
  for(let a=from;a<=to;a++)for(let side=-7;side<=7;side++) {
    const x=axis==='x'?a:center+side,z=axis==='x'?center+side:a;
    const current=await reader.block(x,63,z);
    if(!current||!groundAllowed.has(current.Name))continue;
    cell(x,63,z,Math.abs(side)<=5?'minecraft:gray_concrete':'minecraft:smooth_stone',current.Name);
    widened++;
  }
}
for(const z of [-420,-240,0,240,420])for(const [a,b] of [[-995,-600],[600,995]])await local('x',z,a,b);
for(const x of [-450,-330,-210,-100,0,100,210,330,450])for(const [a,b] of [[-995,-600],[600,995]])await local('z',x,a,b);
// Consolidate adjacent identical edits instead of issuing one command per block.
const groups=new Map(), bulk=[];
for(const op of operations) {
  if(op.x1!==op.x2||op.y1!==op.y2||op.z1!==op.z2){bulk.push(op);continue;}
  const key=JSON.stringify([op.y1,op.z1,op.block,op.replace]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(op);
}
const compact=[];
for(const group of groups.values()) {
  group.sort((a,b)=>a.x1-b.x1);
  let run;
  for(const op of group) {
    if(run&&op.x1===run.x2+1)run.x2=op.x1;
    else {run={...op};compact.push(run);}
  }
}
const strips=new Map();
for(const op of compact) {
  const key=JSON.stringify([op.x1,op.x2,op.y1,op.block,op.replace]);
  if(!strips.has(key))strips.set(key,[]);
  strips.get(key).push(op);
}
const merged=[];
for(const strip of strips.values()) {
  strip.sort((a,b)=>a.z1-b.z1);
  let run;
  for(const op of strip) {
    if(run&&op.z1===run.z2+1)run.z2=op.z1;
    else {run={...op};merged.push(run);}
  }
}
merged.push(...bulk);
const result={name:'Verified route clearance and wider local streets',bounds:full.bounds,
  operations:merged,stats:{obstacles:scan.obstacleCount,localSurfaceCells:widened,protectedSkipped:skipped.length},skipped};
await writeFile('map/generated/clear-city-roads.json',JSON.stringify(result));
console.log(JSON.stringify({operations:merged.length,...result.stats,skipped:skipped.slice(0,12)}));

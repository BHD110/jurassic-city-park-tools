import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nbt from 'prismarine-nbt';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const asset=path.join(root,'map/references/assets/ocean-house-ookrazy8oo.schem');
const bytes=await readFile(asset);
const digest=createHash('sha256').update(bytes).digest('hex');
const expected='b362e725b9e687b7a7277738bd170583c7c5830977588cd25b891a98e92eb241';
if(digest!==expected) throw Error(`schematic SHA mismatch: ${digest}`);
const {value:s}=await new Promise((resolve,reject)=>nbt.parse(bytes,(err,parsed)=>err?reject(err):resolve(parsed)));
const W=s.Width.value,H=s.Height.value,L=s.Length.value;
if(W!==29||H!==18||L!==14||s.Version.value!==2||s.Offset.value.some(n=>n!==0)) throw Error('unexpected schematic dimensions/version/offset');
if(s.BlockEntities.value.value.length!==40) throw Error('unexpected block entity count');
const palette=Object.entries(s.Palette.value).reduce((out,[name,tag])=>(out[tag.value]=name,out),[]);
if(palette.length!==140||palette.some(name=>!name?.startsWith('minecraft:'))) throw Error('unexpected palette');
if(palette.some(name=>/command_block|structure_block|jigsaw|spawner|barrier/.test(name))) throw Error('restricted block in asset');
const data=s.BlockData.value,ids=[];
for(let i=0;i<data.length;) {
  let n=0,shift=0,byte;
  do { if(i>=data.length||shift>28) throw Error('bad BlockData varint');byte=data[i++]&255;n|=(byte&127)<<shift;shift+=7; } while(byte&128);
  if(!palette[n]) throw Error(`unknown palette id ${n}`);
  ids.push(n);
}
if(ids.length!==W*H*L) throw Error(`bad BlockData length ${ids.length}`);
const full=JSON.parse(await readFile(path.join(root,'map/generated/full.json'),'utf8'));
const central=JSON.parse(await readFile(path.join(root,'map/generated/central-park-details.json'),'utf8'));
const route=JSON.parse(await readFile(path.join(root,'map/generated/city-coaster-route.json'),'utf8'));
const x0=-80,y0=65,z0=-287;
const house={x1:x0,z1:z0,x2:x0+W-1,z2:z0+L-1};
const bridge={x1:x0+W,z1:z0+2,x2:-6,z2:z0+4};
const hit=(a,b)=>a.x1<=b.x2&&a.x2>=b.x1&&a.z1<=b.z2&&a.z2>=b.z1;
const operations=[];
const box=(x1,y1,z1,x2,y2,z2,block)=>operations.push({kind:'box',x1,y1,z1,x2,y2,z2,block:`minecraft:${block}`});
const occupied=[...full.operations,...central.operations].filter(o=>o.kind==='box'&&o.block!=='minecraft:air'&&o.y2>=65);
for(const o of occupied) {
  const footprint={x1:o.x1,z1:o.z1,x2:o.x2,z2:o.z2};
  if(hit(house,footprint)&&o.y1<=y0+H-1) throw Error(`house overlaps existing block ${JSON.stringify(o)}`);
  if(hit(bridge,footprint)&&o.y1<=68&&o.y2>=65) throw Error(`bridge overlaps existing block ${JSON.stringify(o)}`);
}
for(const b of [...full.metadata.buildings,...full.metadata.enclosures]) if(hit(house,b.bounds)||hit(bridge,b.bounds)) throw Error(`protected area ${b.id}`);
for(const p of route.route.points) {
  const c={x1:p.x-4,z1:p.z-4,x2:p.x+4,z2:p.z+4};
  if(hit(house,c)||hit(bridge,c)) throw Error(`rail corridor at ${p.x},${p.z}`);
}
const groups=new Map();let placed=0,skippedWater=0;
for(let i=0;i<ids.length;i++) {
  const name=palette[ids[i]];
  if(name==='minecraft:air') continue;
  if(name.startsWith('minecraft:water[')||name==='minecraft:water') {skippedWater++;continue;}
  const x=i%W,z=Math.floor(i/W)%L,y=Math.floor(i/(W*L));
  const clean=name.replace(/waterlogged=true/g,'waterlogged=false');
  const key=`${y0+y},${z0+z},${clean}`;
  if(!groups.has(key)) groups.set(key,[]);
  groups.get(key).push(x0+x);
  placed++;
}
for(const [key,xs] of groups) {
  const first=key.indexOf(','),second=key.indexOf(',',first+1);
  const y=Number(key.slice(0,first)),z=Number(key.slice(first+1,second)),name=key.slice(second+1);
  xs.sort((a,b)=>a-b);
  let start=xs[0],prev=xs[0];
  for(let i=1;i<=xs.length;i++) {
    if(i<xs.length&&xs[i]===prev+1) {prev=xs[i];continue;}
    operations.push({kind:'box',x1:start,y1:y,z1:z,x2:prev,y2:y,z2:z,block:name});
    start=prev=xs[i];
  }
}
// Carry the source dock across the narrow stream, then meet the avenue at ground level.
for(let x=-51;x<=-35;x++) {
  box(x,65,z0+2,x,65,z0+4,'oak_planks');
  if((x+51)%6===0) for(const z of [z0+1,z0+5]) {
    box(x,64,z,x,64,z,'oak_log');
    box(x,66,z,x,66,z,'oak_fence');
  }
}
box(-34,64,z0+2,-34,64,z0+4,'oak_stairs[facing=east,half=bottom]');
for(let x=-33;x<=-6;x++) box(x,64,z0+2,x,64,z0+4,(x%7===0)?'mossy_stone_bricks':'stone_bricks');
for(const x of [-31,-23,-15,-7]) {
  box(x,64,z0+1,x,64,z0+1,'moss_block');
  box(x,65,z0+1,x,66,z0+1,'flowering_azalea_leaves[persistent=true]');
}
for(const x of [-49,-37]) for(const z of [z0+1,z0+5]) box(x,67,z,x,67,z,'lantern');
box(x0+1,64,z0+1,x0+15,64,z0+11,'stone_bricks');
const plan={name:'Jurassic City Park Imported Ocean House',bounds:full.bounds,operations,metadata:{asset:'Ocean House with Full Interior by ooKrazy8oo',assetSha256:digest,schematicVersion:2,dataVersion:s.DataVersion.value,dimensions:{width:W,height:H,length:L},origin:{x:x0,y:y0,z:z0},blockEntitiesSkipped:40,entitiesImported:0,waterCellsSkipped:skippedWater,blocksImported:placed,connectedBoardwalk:bridge,source:'https://abfielder.com/schematicdetail/ookrazy8oo/ocean-house-with-full-interior/2289'}};
await writeFile(path.join(root,'map/generated/imported-ocean-house.json'),JSON.stringify(plan));
console.log(JSON.stringify({operations:operations.length,placed,skippedWater,site:house,bridge}));

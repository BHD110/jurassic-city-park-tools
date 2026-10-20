import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const local=JSON.parse(await readFile(path.join(root,'generated/imported-fisherman-local.json'),'utf8'));
const origin={x:-90,y:64,z:80};
const turn={north:'south',south:'north',east:'west',west:'east'};
function rotateState(state){
  const at=state.indexOf('[');
  if(at<0)return state;
  const props=Object.fromEntries(state.slice(at+1,-1).split(',').map(kv=>kv.split('=')));
  if(props.facing&&turn[props.facing])props.facing=turn[props.facing];
  const edge=Object.fromEntries(Object.entries(turn).filter(([k])=>k in props).map(([k,v])=>[v,props[k]]));
  Object.assign(props,edge);
  return `${state.slice(0,at)}[${Object.entries(props).map(([k,v])=>`${k}=${v}`).join(',')}]`;
}
const cells=new Map();
for(const op of local.operations)for(let x=op.x1;x<=op.x2;x++){
  const wx=origin.x+38-x, wy=origin.y+op.y1,wz=origin.z+30-op.z1;
  cells.set(`${wx},${wy},${wz}`,rotateState(op.block));
}
const ops=[];
function box(x1,y1,z1,x2,y2,z2,block){
  if(x1>x2||y1>y2||z1>z2)throw Error('invalid box');
  if(x1<-115||x2>-40||z1<70||z2>110||y1<63||y2>78)throw Error('out of shore parcel');
  ops.push({kind:'box',x1,y1,z1,x2,y2,z2,block:block.includes(':')?block:`minecraft:${block}`});
}
for(let y=64;y<=76;y++)for(let z=86;z<=103;z++){
  let start=null,last=null,state=null;
  function flush(){if(start!==null)box(start,y,z,last,y,z,state);}
  for(let x=-87;x<=-56;x++){
    const next=x<=-57?cells.get(`${x},${y},${z}`):undefined;
    if(next!==state){flush();start=next?x:null;state=next;}
    if(next)last=x;
  }
}
// A short landing reaches the lake without replacing any water cells at y=63.
box(-56,64,90,-43,64,94,'spruce_planks');
for(const z of [90,94])for(const x of [-56,-51,-46,-43]){
  box(x,63,z,x,63,z,'spruce_log[axis=y]');
  box(x,65,z,x,65,z,'spruce_fence');
}
box(-110,64,91,-88,64,93,'mossy_stone_bricks');
for(const x of [-108,-100,-92])for(const z of [88,96]){
  box(x,64,z,x+1,64,z+1,'moss_block');
  box(x,65,z,x+1,66,z+1,'azalea_leaves[persistent=true]');
}
for(const x of [-109,-91,-50,-44])for(const z of [89,95]){
  box(x,64,z,x,64,z,'spruce_log[axis=y]');
  box(x,65,z,x,67,z,'spruce_fence');
  box(x,68,z,x,68,z,'lantern[hanging=false]');
}
const route=JSON.parse(await readFile(path.join(root,'generated/city-coaster-route.json'),'utf8'));
const points=route.route?.points??route.points;
let trackCorridorHits=0;
for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(Math.min(a.x,b.x)-4<=-40&&Math.max(a.x,b.x)+4>=-115&&Math.min(a.z,b.z)-4<=110&&Math.max(a.z,b.z)+4>=70)trackCorridorHits++;
}
if(trackCorridorHits)throw Error(`track corridor collision ${trackCorridorHits}`);
const metadata={...local.metadata,id:'fisherman-house-pond-west',origin,rotation:'180 degrees',importedBounds:{x1:-87,y1:64,z1:86,x2:-57,y2:76,z2:103},connectionBounds:{x1:-110,y1:63,z1:88,x2:-43,y2:68,z2:96},pondWestWaterline:{z90:-47,z95:-47},trackCorridorHits,worldSourceBlocks:cells.size,operationCount:ops.length,applicationOrder:'Append after central park landscaping; source block entity NBT and entities remain omitted. No broad clearing or lake-water removal.'};
await writeFile(path.join(root,'generated/imported-fisherman-house.json'),JSON.stringify({name:'Fisherman House Pond West',bounds:{x1:-115,z1:70,x2:-40,z2:110},operations:ops,metadata}));
console.log(JSON.stringify({output:'map/generated/imported-fisherman-house.json',bounds:metadata.importedBounds,ops:ops.length,blocks:cells.size,trackCorridorHits},null,2));

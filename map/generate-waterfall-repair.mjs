import { writeFile } from 'node:fs/promises';
import { addWaterfallChannel } from './park-details.mjs';

const plan={
  name:'Jurassic City Park Waterfall Repair',
  bounds:{x1:-85,z1:-260,x2:5,z2:-145},
  operations:[],
  metadata:{
    clearBounds:{x1:-85,y1:63,z1:-260,x2:5,y2:90,z2:-145},
    restoredPool:{x:-20,y:63,z:-170,rx:16,rz:10},
    inspectionView:{x:-8,y:88,z:-161,yaw:155,pitch:15},
  }
};

// Each fill changes at most 23 * 116 * 7 = 18,676 blocks, below the game limit.
for(let x1=-85;x1<=5;x1+=23) for(let y1=63;y1<=90;y1+=7) {
  const x2=Math.min(x1+22,5),y2=Math.min(y1+6,90);
  plan.operations.push({kind:'command',command:`fill ${x1} ${y1} -260 ${x2} ${y2} -145 minecraft:air replace minecraft:water`});
}
// The original ground-level pond is the only planned water at Y=63 in this area.
for(let dz=-10;dz<=10;dz++) {
  const span=Math.max(1,Math.floor(16*Math.sqrt(1-(dz/10)**2)));
  plan.operations.push({kind:'box',x1:-20-span,y1:63,z1:-170+dz,
    x2:-20+span,y2:63,z2:-170+dz,block:'minecraft:water'});
}
const channelStart=plan.operations.length;
plan.metadata.channel=addWaterfallChannel(plan);
const channelOps=plan.operations.slice(channelStart);
const sources=channelOps.filter(op=>op.block==='minecraft:water');
const floors=new Map(channelOps.filter(op=>op.block==='minecraft:mossy_cobblestone' && op.y1===63)
  .map(op=>[`${op.x1},${op.z1}`,op]));
const bankTops=new Map(channelOps.filter(op=>op.block==='minecraft:mossy_cobblestone' && op.y1===op.y2 && op.y1>=65)
  .map(op=>[`${op.x1},${op.z1}`,op.y1]));
const sourceAt=new Set(sources.map(op=>`${op.x1},${op.z1}`));
for(const source of sources) {
  const {x1:x,z1:z,y1:y}=source;
  const floor=floors.get(`${x},${z}`);
  if(x>-29 || !floor || floor.y2!==y-1) throw new Error(`Uncontained water floor at ${x},${y},${z}`);
  for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    const neighbor=`${x+dx},${z+dz}`;
    if(!sourceAt.has(neighbor) && (bankTops.get(neighbor)??0)<y+1)
      throw new Error(`Water source can escape at ${x},${y},${z}`);
  }
}
for(const op of plan.operations.filter(op=>op.kind==='command')) {
  const coords=op.command.match(/^fill (-?\d+) (\d+) (-?\d+) (-?\d+) (\d+) (-?\d+) minecraft:air replace minecraft:water$/);
  if(!coords) throw new Error(`Unexpected repair command: ${op.command}`);
  const [,x1,y1,z1,x2,y2,z2]=coords.map(Number);
  if((x2-x1+1)*(y2-y1+1)*(z2-z1+1)>32768) throw new Error(`Oversized fill: ${op.command}`);
}
await writeFile(new URL('./generated/waterfall-repair.json',import.meta.url),`${JSON.stringify(plan,null,2)}\n`);
console.log(JSON.stringify({totalOperations:plan.operations.length,...plan.metadata.channel}));

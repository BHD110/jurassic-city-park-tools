import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {worldReader} from '../verification/city-world-reader.mjs';

const backup=JSON.parse(await readFile('verification/park-tour-slim-backup.json','utf8'));
const original=JSON.parse(await readFile('verification/park-tour-backup.json','utf8'));
const old=JSON.parse(await readFile(path.join(backup.backup,'park-tour-expected.json'),'utf8'));
const thin=JSON.parse(await readFile('verification/park-tour-expected.json','utf8'));
const route=JSON.parse(await readFile('map/generated/park-tour-route.json','utf8'));
if(route.metadata.deckWidth!==1)throw new Error('Generate the one-block tour geometry first');
const key=p=>`${p.x},${p.y},${p.z}`;
const oldMap=new Map(old.cells.map(p=>[key(p),p]));
const newMap=new Map(thin.cells.map(p=>[key(p),p]));
const name=block=>block.split('[')[0];
const encode=state=>state.Name+(state.Properties?'['+Object.entries(state.Properties).map(([k,v])=>`${k}=${v}`).join(',')+']':'');
const changes=[];
const readers=backup.worlds.map(w=>({...w,current:worldReader(w.backup),original:worldReader(original.worlds.find(o=>o.kind===w.kind).backup)}));
for(const p of old.cells) {
  if(newMap.has(key(p)))continue;
  if(!['deck','glass'].includes(p.role))throw new Error(`Would remove protected role ${p.role}`);
  const states=await Promise.all(readers.map(w=>w.original.block(p.x,p.y,p.z)));
  if(states.some(s=>!s)||states.some(s=>encode(s)!==encode(states[0])))throw new Error(`Different original ground ${key(p)}`);
  changes.push({...p,block:encode(states[0]),replace:name(p.block),role:p.role==='deck'?'removed-deck':'removed-old-glass'});
}
for(const p of thin.cells) {
  const before=oldMap.get(key(p));
  if(before?.block===p.block)continue;
  if(p.role!=='glass')throw new Error(`Unexpected structural change ${p.role}`);
  changes.push({...p,replace:before?name(before.block):'minecraft:air'});
}
for(const world of readers)for(const p of changes) {
  const actual=await world.current.block(p.x,p.y,p.z);
  if(actual?.Name!==p.replace)throw new Error(`Preserving unexpected block ${world.kind} ${key(p)} ${actual?.Name} != ${p.replace}`);
}
const operations=[];
changes.sort((a,b)=>a.block.localeCompare(b.block)||a.replace.localeCompare(b.replace)||a.y-b.y||a.z-b.z||a.x-b.x);
for(const p of changes) {
  const previous=operations.at(-1);
  if(previous?.block===p.block&&previous.replace===p.replace&&previous.y1===p.y&&previous.z1===p.z&&previous.x2===p.x-1)previous.x2=p.x;
  else operations.push({kind:'box',x1:p.x,y1:p.y,z1:p.z,x2:p.x,y2:p.y,z2:p.z,block:p.block,replace:p.replace});
}
const metadata={generatedAt:new Date().toISOString(),profile:'t-shaped-v1',deckWidth:1,
  removedDeckBlocks:changes.filter(p=>p.role==='removed-deck').length,
  removedOldGlass:changes.filter(p=>p.role==='removed-old-glass').length,
  addedCloseGlass:changes.filter(p=>p.role==='glass').length,
  restoredTerrain:changes.filter(p=>p.role==='removed-deck'&&!p.block.startsWith('minecraft:air')).length,
  routeSha256:route.metadata.routeSha256,
  sha256:createHash('sha256').update(JSON.stringify(operations)).digest('hex'),backup:backup.backup};
await writeFile('map/generated/park-tour-slim.json',JSON.stringify({name:'Narrow T Profile Park Tour',bounds:route.bounds,metadata,operations})+'\n');
await writeFile('verification/park-tour-slim-expected.json',JSON.stringify({metadata,changes})+'\n');
console.log(JSON.stringify({...metadata,operations:operations.length,changedCells:changes.length}));

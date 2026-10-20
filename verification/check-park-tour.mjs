import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import nbt from 'prismarine-nbt';
import {worldReader} from './city-world-reader.mjs';
import {entities} from './check-city-life.mjs';

const kind=process.argv[2];
const slim=process.argv.includes('--slim');
const backup=JSON.parse(await readFile(slim?'verification/park-tour-slim-backup.json':'verification/park-tour-backup.json','utf8'));
const item=backup.worlds.find(w=>w.kind===kind);
if(!item)throw new Error('Expected singleplayer or server');
const plan=JSON.parse(await readFile('map/generated/park-tour-route.json','utf8'));
const expected=JSON.parse(await readFile('verification/park-tour-expected.json','utf8'));
const oldRoute=JSON.parse(await readFile('map/generated/city-coaster-route.json','utf8')).route.points;
const before=worldReader(item.backup),after=worldReader(item.source);
const failures=[];
function fail(message) {if(failures.length<30)failures.push(message);}
const parseState=block=>{
  const [name,props]=block.split('[');
  return {name,props:props?Object.fromEntries(props.slice(0,-1).split(',').map(p=>p.split('='))):{}};
};
for(const p of expected.cells) {
  const actual=await after.block(p.x,p.y,p.z),want=parseState(p.block);
  if(actual?.Name!==want.name||Object.entries(want.props).some(([key,value])=>actual.Properties?.[key]!==value))fail(`Target mismatch ${p.role} ${p.x},${p.y},${p.z}: ${JSON.stringify(actual)}`);
}
let removedDeckBlocks=0,oldGlassCleared=0,curveClearanceSamples=0;
if(slim) {
  const delta=JSON.parse(await readFile('verification/park-tour-slim-expected.json','utf8'));
  for(const p of delta.changes) {
    const actual=await after.block(p.x,p.y,p.z),want=parseState(p.block);
    if(actual?.Name!==want.name||Object.entries(want.props).some(([key,value])=>actual.Properties?.[key]!==value))fail(`Narrow profile mismatch ${p.x},${p.y},${p.z}`);
    if(p.role==='removed-deck')removedDeckBlocks++;
    if(p.role==='removed-old-glass')oldGlassCleared++;
  }
  for(const p of plan.route.points) {
    if(!['east_west','north_south'].includes(p.shape)&&!p.shape.startsWith('ascending_'))continue;
    const across=p.shape==='north_south'||p.shape==='ascending_north'||p.shape==='ascending_south';
    for(const side of [-1,1]) {
      const x=p.x+(across?side:0),z=p.z+(across?0:side);
      if(!['minecraft:glass','minecraft:glass_pane'].includes((await after.block(x,p.y,z))?.Name))fail(`Missing close side glass ${x},${p.y},${z}`);
      if(p.y>70&&(await after.block(x,p.y-1,z))?.Name!=='minecraft:air')fail(`Unwanted wide deck ${x},${p.y-1},${z}`);
    }
  }
  const curveEnds={north_east:[[0.5,0],[1,0.5]],north_west:[[0,0.5],[0.5,0]],
    south_east:[[0.5,1],[1,0.5]],south_west:[[0,0.5],[0.5,1]]};
  for(const p of plan.route.points) {
    const ends=curveEnds[p.shape];
    if(!ends)continue;
    const rectangles=[];
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) {
      const x=p.x+dx,z=p.z+dz,state=await after.block(x,p.y,z);
      if(state?.Name==='minecraft:glass')rectangles.push([x,z,x+1,z+1]);
      if(state?.Name==='minecraft:glass_pane') {
        rectangles.push([x+7/16,z+7/16,x+9/16,z+9/16]);
        const sides={north:[x+7/16,z,x+9/16,z+7/16],south:[x+7/16,z+9/16,x+9/16,z+1],
          west:[x,z+7/16,x+7/16,z+9/16],east:[x+9/16,z+7/16,x+1,z+9/16]};
        for(const [side,rect] of Object.entries(sides))if(state.Properties?.[side]==='true')rectangles.push(rect);
      }
    }
    // Check a 0.98-block minecart envelope along each vanilla diagonal corner.
    for(let step=0;step<=20;step++) {
      const t=step/20,x=p.x+ends[0][0]*(1-t)+ends[1][0]*t,z=p.z+ends[0][1]*(1-t)+ends[1][1]*t;
      if(rectangles.some(([x1,z1,x2,z2])=>x+0.49>x1&&x-0.49<x2&&z+0.49>z1&&z-0.49<z2))fail(`Glass clips minecart at curve ${p.x},${p.z}`);
      curveClearanceSamples++;
    }
  }
}
for(const p of plan.route.points)for(let dy=1;dy<=3;dy++) {
  if((await after.block(p.x,p.y+dy,p.z))?.Name!=='minecraft:air')fail(`Train obstruction ${p.x},${p.y+dy},${p.z}`);
}
let unchangedOldTrackCells=0;
for(const p of oldRoute)for(const dy of [-1,0]) {
  const a=await before.block(p.x,p.y+dy,p.z),b=await after.block(p.x,p.y+dy,p.z);
  if(JSON.stringify(a)!==JSON.stringify(b))fail(`Original coaster changed ${p.x},${p.y+dy},${p.z}`);
  else unchangedOldTrackCells++;
}
for(const control of plan.metadata.controls) {
  const entity=await after.blockEntity(control.x,control.y,control.z);
  if(entity?.Command!==control.command||entity.auto!==control.auto)fail(`Boarding control mismatch ${control.z}`);
}
for(const x of [-6,6]) {
  const entity=await after.blockEntity(x,65,669);
  if(!entity?.front_text?.messages?.some(text=>text.includes('观光线')))fail(`Station sign missing ${x}`);
}
const allBefore=await entities(item.backup),allAfter=await entities(item.source);
const protectedEntities=list=>list.filter(e=>e.id?.startsWith('jurassicreborn:')||e.Tags?.includes('city_life_pedestrian')||e.id==='mts:builder_existing'&&e.entityid==='EntityVehicleF_Physics');
const entityKey=e=>e.uniqueUUID||JSON.stringify(e.UUID);
const oldIds=new Set(protectedEntities(allBefore).map(entityKey)),newIds=new Set(protectedEntities(allAfter).map(entityKey));
if(oldIds.size!==newIds.size||[...oldIds].some(id=>!newIds.has(id)))fail('Existing NPC, vehicle or dinosaur missing');
const saved=nbt.simplify((await nbt.parse(await readFile(`${item.source}/level.dat`))).parsed).Data;
const original=nbt.simplify((await nbt.parse(await readFile(`${item.backup}/level.dat`))).parsed).Data;
if(kind==='singleplayer'&&(saved.LevelName!==original.LevelName||saved.GameType!==original.GameType||saved.allowCommands!==original.allowCommands))fail('Single-player world metadata changed');
const report={kind,world:item.source,checkedAt:new Date().toISOString(),
  routeLength:plan.route.length,height:plan.metadata.height,enclosures:plan.metadata.enclosureCoverage,
  targetsChecked:expected.cells.length,glassBlocks:plan.metadata.glassBlocks,glassHeight:1,
  deckWidth:plan.metadata.deckWidth,insideCornerPanes:plan.metadata.insideCornerPanes,
  removedDeckBlocks,oldGlassCleared,curveClearanceSamples,
  unchangedOldTrackCells,boardingCommandsChecked:plan.metadata.controls.length,
  npcs:allAfter.filter(e=>e.Tags?.includes('city_life_pedestrian')).length,
  vehicles:allAfter.filter(e=>e.id==='mts:builder_existing'&&e.entityid==='EntityVehicleF_Physics').length,
  dinosaurs:allAfter.filter(e=>e.id?.startsWith('jurassicreborn:')).length,
  protectedEntityUuidsPreserved:oldIds.size,openedGame:false,fullRideTested:false,
  routeSha256:createHash('sha256').update(JSON.stringify(plan.route)).digest('hex'),
  failures,passed:!failures.length};
await writeFile(`verification/park-tour-${slim?'slim-':''}${kind}-check.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,enclosures:report.enclosures.map(e=>e.id)}));
process.exitCode=failures.length?1:0;

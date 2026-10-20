import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import nbt from 'prismarine-nbt';
import {entities} from './check-city-life.mjs';

const receipt=JSON.parse(await readFile('verification/interior-singleplayer-export.json','utf8'));
const world=receipt.installedSave, source=receipt.sourceWorld;
const data=nbt.simplify((await nbt.parse(await readFile(path.join(world,'level.dat')))).parsed).Data;
const traffic=JSON.parse(await readFile(path.join(world,'citytraffic-plan.json'),'utf8'));
const state=JSON.parse(await readFile(path.join(world,'citytraffic-state.json'),'utf8'));
const all=await entities(world);
const vehicles=all.filter(e=>e.id==='mts:builder_existing'&&e.entityid==='EntityVehicleF_Physics');
const npcs=all.filter(e=>e.Tags?.includes('city_life_pedestrian'));
const dinosaurs=all.filter(e=>e.id?.startsWith('jurassicreborn:'));
const vehicleIds=new Set(vehicles.map(e=>e.uniqueUUID));
const routes=new Set(traffic.routes.map(r=>r.id));
const failures=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let comparedFiles=0;
for (const file of ['citytraffic-plan.json','citytraffic-state.json']) {
  if (!(await readFile(path.join(source,file))).equals(await readFile(path.join(world,file)))) failures.push(`Portable traffic differs: ${file}`);
}
// One pass over copied world data; player metadata is intentionally reset for single-player.
for(const sub of ['region','entities','poi','data','datapacks','easy_npc','serverconfig','DIM-1','DIM1']) {
  async function compare(relative) {
    const a=path.join(source,relative),b=path.join(world,relative);
    const entries=await readdir(a,{withFileTypes:true});
    const copied=await readdir(b);
    if(entries.length!==copied.length)failures.push(`File count differs: ${relative}`);
    for(const entry of entries) {
      const file=path.join(relative,entry.name);
      if(entry.isDirectory())await compare(file);
      else {
        const one=await readFile(path.join(source,file)),two=await readFile(path.join(world,file));
        comparedFiles++;
        if(!one.equals(two))failures.push(`World copy differs: ${file}`);
      }
    }
  }
  await compare(sub);
}
if(data.LevelName!==receipt.displayName||data.GameType!==1||data.allowCommands!==1)failures.push('Single-player title/mode');
if([data.SpawnX,data.SpawnY,data.SpawnZ].join(',')!=='0,65,657')failures.push('Station spawn');
if(vehicles.length!==1201||state.assignments.length!==1201)failures.push('Vehicle totals');
if(state.assignments.some(a=>!vehicleIds.has(a.uuid)||!routes.has(a.route)))failures.push('Traffic assignment/route');
if(npcs.length!==4372||dinosaurs.length!==512)failures.push('NPC/dinosaur totals');
const clientJar=path.join(receipt.instance,'mods/parkbuilder-1.0.0.jar');
const serverJar='runtime/server/mods/parkbuilder-1.0.0.jar';
const controllerSha=hash(await readFile(clientJar));
if(controllerSha!==hash(await readFile(serverJar)))failures.push('Controller not synchronized');
const clientConfig=JSON.parse(await readFile(path.join(receipt.instance,'config/mtsconfig.json'),'utf8'));
if(clientConfig.damage.vehicleBlockBreaking.value||clientConfig.damage.vehicleExplosions.value)failures.push('Unsafe vehicle settings');
const report={checkedAt:new Date().toISOString(),installedSave:world,title:data.LevelName,
  creative:data.GameType===1,commands:data.allowCommands===1,spawn:[data.SpawnX,data.SpawnY,data.SpawnZ],
  vehicles:vehicles.length,npcs:npcs.length,dinosaurs:dinosaurs.length,routes:routes.size,
  comparedWorldFiles:comparedFiles,portableControllerSha256:controllerSha,
  clientRestartRequired:true,openedGame:false,failures,passed:!failures.length};
await writeFile('verification/interior-singleplayer-check.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
process.exitCode=failures.length?1:0;

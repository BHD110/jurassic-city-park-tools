// Offline edit: keep the original citizens' UUIDs and all other entities.
import {readFile,readdir,writeFile,rename} from 'node:fs/promises';
import {inflateSync,gunzipSync,deflateSync} from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';
const world=process.argv[2];if(!world)throw new Error('Pass closed work world');
const npcPlan=JSON.parse(await readFile('map/generated/city-pedestrians-v2.json','utf8'));
const updates=new Map(npcPlan.existingGoalUpdates.map(p=>[p.tag,p]));
const T=(type,value)=>({type,value});
const objective=(type,extra={})=>({Type:T('string',type),...extra});
const goals=[objective('FLOAT'),objective('OPEN_DOOR'),objective('MOVE_BACK_TO_HOME',{StopDistance:T('float',30),SpeedModifier:T('double',0.5)}),objective('RANDOM_STROLL_AROUND_HOME',{SpeedModifier:T('double',0.4)}),objective('LOOK_AT_PLAYER'),objective('LOOK_RANDOM_AROUND')];
let edited=0,chunks=0,removedRacers=0;
for(const file of await readdir(path.join(world,'entities'))){if(!/^r\.-?\d+\.-?\d+\.mca$/.test(file))continue;
 const target=path.join(world,'entities',file);let bytes=await readFile(target);if(!bytes.length)continue;let changed=false;
 for(let slot=0;slot<1024;slot++){const sector=bytes.readUIntBE(slot*4,3);if(!sector)continue;
 const offset=sector*4096,length=bytes.readUInt32BE(offset),type=bytes[offset+4],payload=bytes.subarray(offset+5,offset+4+length);
 const raw=type===2?inflateSync(payload):type===1?gunzipSync(payload):payload,tree=nbt.parseUncompressed(raw,'big');let edit=false;
 const list=tree.value.Entities?.value.value||[];
 const kept=list.filter(e=>{const remove=e.id?.value==='automobility:automobile'&&e.Tags?.value.value.includes('city_life_traffic');if(remove){removedRacers++;edit=true;}return !remove;});
 if(tree.value.Entities)tree.value.Entities.value.value=kept;
 for(const e of kept){if(e.id?.value!=='easy_npc:humanoid'||!e.Tags?.value.value.includes('city_life_pedestrian'))continue;
   const update=e.Tags.value.value.map(t=>updates.get(t)).find(Boolean);
   const entityGoals=structuredClone(goals);entityGoals[2].StopDistance.value=30;
   e.ObjectiveData=T('compound',{ObjectiveDataSet:T('list',{type:'compound',value:entityGoals})});edited++;edit=true;
 }
 if(!edit)continue;
 const compressed=deflateSync(nbt.writeUncompressed(tree,'big')),sectors=Math.ceil((compressed.length+5)/4096),next=Math.ceil(bytes.length/4096);
 if(sectors>255)throw new Error('Entity chunk exceeds size limit');const record=Buffer.alloc(sectors*4096);record.writeUInt32BE(compressed.length+1);record[4]=2;compressed.copy(record,5);
 const padded=Buffer.alloc(next*4096);bytes.copy(padded);bytes=Buffer.concat([padded,record]);bytes.writeUIntBE(next,slot*4,3);bytes[slot*4+3]=sectors;bytes.writeUInt32BE(Math.floor(Date.now()/1000),4096+slot*4);changed=true;chunks++;
 }
 if(changed){await writeFile(target+'.tmp',bytes);await rename(target+'.tmp',target);}
}
console.log(JSON.stringify({existingCitizensUpdated:edited,entityChunks:chunks,removedRacers,homeReturnRadius:30}));

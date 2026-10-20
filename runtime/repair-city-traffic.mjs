// Run only with the test server stopped. Keep UUIDs and all non-traffic entities.
import {readFile,readdir,writeFile,rename} from 'node:fs/promises';
import {inflateSync,gunzipSync,deflateSync} from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';
const world=process.argv[2];if(!world)throw new Error('Pass closed test world');
let cars=0,changedChunks=0;
for(const file of await readdir(path.join(world,'entities'))){if(!/^r\.-?\d+\.-?\d+\.mca$/.test(file))continue;
 const target=path.join(world,'entities',file);let bytes=await readFile(target);if(!bytes.length)continue;let changed=false;
 for(let slot=0;slot<1024;slot++){const sector=bytes.readUIntBE(slot*4,3);if(!sector)continue;
 const offset=sector*4096,length=bytes.readUInt32BE(offset),type=bytes[offset+4],payload=bytes.subarray(offset+5,offset+4+length);
 const raw=type===2?inflateSync(payload):type===1?gunzipSync(payload):payload,tree=nbt.parseUncompressed(raw,'big');
 let edit=false;for(const entity of tree.value.Entities?.value.value||[]){if(entity.id?.value==='automobility:automobile' && entity.Tags?.value.value.includes('city_life_traffic')){
   entity.Invulnerable={type:'byte',value:0};
   // Normal cars avoid the upstream autopilot's null-parent check for invulnerable hitboxes.
   cars++;edit=true;
 }}
 if(!edit)continue;const compressed=deflateSync(nbt.writeUncompressed(tree,'big')),sectors=Math.ceil((compressed.length+5)/4096),next=Math.ceil(bytes.length/4096);
 if(sectors>255)throw new Error('Entity chunk too large');const record=Buffer.alloc(sectors*4096);record.writeUInt32BE(compressed.length+1);record[4]=2;compressed.copy(record,5);
 const padded=Buffer.alloc(next*4096);bytes.copy(padded);bytes=Buffer.concat([padded,record]);bytes.writeUIntBE(next,slot*4,3);bytes[slot*4+3]=sectors;bytes.writeUInt32BE(Math.floor(Date.now()/1000),4096+slot*4);
 changed=true;changedChunks++;}
 if(changed){await writeFile(target+'.tmp',bytes);await rename(target+'.tmp',target);}}
console.log(JSON.stringify({cars,changedChunks}));

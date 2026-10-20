import {readFile,readdir,writeFile} from 'node:fs/promises';
import {inflateSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';
import {fileURLToPath} from 'node:url';
export async function entities(world){const found=[];
 for(const file of await readdir(path.join(world,'entities'))){if(!/^r\.-?\d+\.-?\d+\.mca$/.test(file))continue;
 const bytes=await readFile(path.join(world,'entities',file));if(!bytes.length)continue;
 for(let slot=0;slot<1024;slot++){const sector=bytes.readUIntBE(slot*4,3);if(!sector)continue;
 const offset=sector*4096,length=bytes.readUInt32BE(offset);if(!length)continue;const compression=bytes[offset+4],payload=bytes.subarray(offset+5,offset+4+length);
 const raw=compression===2?inflateSync(payload):compression===1?gunzipSync(payload):compression===3?payload:null;
 if(!raw)throw new Error('Unsupported compression');const chunk=nbt.simplify(nbt.parseUncompressed(raw,'big'));found.push(...chunk.Entities||[]);}}
 return found;
}
const [world,baseline,out='verification/city-life-save-audit.json']=process.argv.slice(2);
if(process.argv[1]===fileURLToPath(import.meta.url)&&world){const all=await entities(world),old=await entities(baseline);
 const d=all.filter(e=>e.id.startsWith('jurassicreborn:')),prior=old.filter(e=>e.id.startsWith('jurassicreborn:'));
 const p=all.filter(e=>e.Tags?.includes('city_life_pedestrian')),cars=all.filter(e=>e.Tags?.includes('city_life_traffic'));
 const failures=[];if(d.length!==128)failures.push('Dinosaurs count is '+d.length);
 for(const a of prior)if(!d.some(b=>String(a.UUID)===String(b.UUID)))failures.push('Original dinosaur missing');
 const pedestrianPlan=JSON.parse(await readFile('map/generated/city-pedestrians.json','utf8')),trafficPlan=JSON.parse(await readFile('map/generated/city-traffic.json','utf8'));
 if(p.length!==pedestrianPlan.count)failures.push('Pedestrians count is '+p.length);if(cars.length!==trafficPlan.metadata.vehicleCount)failures.push('Car count is '+cars.length);
 const tags=new Set();for(const e of [...p,...cars]){const tag=e.Tags.find(t=>/^city_life_(npc_\d|traffic_)/.test(t));if(tags.has(tag))failures.push('Duplicate '+tag);tags.add(tag);if(e.NoAI)failures.push('AI disabled '+tag);if(e.id==='automobility:automobile'?e.despawnTime!==-1:(!e.Invulnerable||!e.PersistenceRequired))failures.push('Protection missing '+tag);if(e.Health!==undefined&&e.Health<=0)failures.push('Dead '+tag);}
 const report={world,baseline,checkedAt:new Date().toISOString(),dinosaurs:d.length,originalDinosaursRetained:prior.length,pedestrians:p.length,vehicles:cars.length,skins:[...new Set(p.map(e=>e.VariantType))],failures,passed:!failures.length,
  entities:[...p,...cars].map(e=>({id:e.id,uuid:e.UUID,tags:e.Tags,pos:e.Pos,skin:e.VariantType,home:e.Navigation?.Home,objectives:e.ObjectiveData,frontAttachment:e.frontAttachment}))};
 await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,entities:undefined}));if(failures.length)process.exitCode=1;
}

import {readFile,readdir,writeFile} from 'node:fs/promises';
import {inflateSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';
const [world,baseline]=process.argv.slice(2);if(!world||!baseline)throw new Error('Pass saved world and backup');
async function readEntities(folder){const entities=[];for(const file of await readdir(path.join(folder,'entities'))){if(!/^r\.-?\d+\.-?\d+\.mca$/.test(file))continue;const bytes=await readFile(path.join(folder,'entities',file));if(!bytes.length)continue;for(let slot=0;slot<1024;slot++){const sector=bytes.readUIntBE(slot*4,3);if(!sector)continue;const offset=sector*4096,len=bytes.readUInt32BE(offset),type=bytes[offset+4],p=bytes.subarray(offset+5,offset+4+len);const raw=type===2?inflateSync(p):type===1?gunzipSync(p):p;entities.push(...nbt.simplify(nbt.parseUncompressed(raw,'big')).Entities||[]);}}return entities;}
const all=await readEntities(world),old=await readEntities(baseline),plan=JSON.parse(await readFile('map/generated/city-pedestrians-v2.json','utf8')),traffic=JSON.parse(await readFile('map/generated/city-vehicles-v2.json','utf8')),park=JSON.parse(await readFile('map/generated/upgrade-full.json','utf8'));
const people=all.filter(e=>e.Tags?.includes('city_life_pedestrian')),cars=all.filter(e=>e.Tags?.includes('city_v2_traffic')),dinosaurs=all.filter(e=>e.id.startsWith('jurassicreborn:'));
const priorPeople=old.filter(e=>e.Tags?.includes('city_life_pedestrian')),priorDinos=old.filter(e=>e.id.startsWith('jurassicreborn:'));
const uuids=new Set(all.map(e=>String(e.UUID))),failures=[];
if(people.length!==plan.points.length)failures.push(`Pedestrians: ${people.length}/${plan.points.length}`);
if(cars.length!==traffic.metadata.vehicleCount)failures.push(`Vehicles: ${cars.length}/${traffic.metadata.vehicleCount}`);
if(dinosaurs.length!==128)failures.push(`Dinosaurs: ${dinosaurs.length}/128`);
const retainedPeople=priorPeople.filter(e=>uuids.has(String(e.UUID))).length,retainedDinos=priorDinos.filter(e=>uuids.has(String(e.UUID))).length;
if(retainedPeople!==priorPeople.length||retainedDinos!==priorDinos.length)failures.push('Original NPC or dinosaur UUID missing');
const inPen=people.filter(e=>park.metadata.enclosures.some(({bounds:b})=>e.Pos[0]>=b.x1&&e.Pos[0]<=b.x2&&e.Pos[2]>=b.z1&&e.Pos[2]<=b.z2));
if(inPen.length)failures.push(`${inPen.length} pedestrians inside dinosaur enclosures`);
const oldRacers=all.filter(e=>e.id==='automobility:automobile'&&e.Tags?.includes('city_life_traffic'));if(oldRacers.length)failures.push(`${oldRacers.length} old race-style cars remain`);
const frames={};for(const car of cars){frames[car.frame]=(frames[car.frame]||0)+1;if(!car.frame.startsWith('city_vehicles:'))failures.push('Wrong vehicle frame');}
const peopleTags=people.flatMap(e=>(e.Tags||[]).filter(t=>t.startsWith('city_life_npc_')));if(new Set(peopleTags).size!==people.length)failures.push('Duplicated or missing citizen tags');
const report={world,baseline,checkedAt:new Date().toISOString(),people:people.length,vehicles:cars.length,frames,dinosaurs:dinosaurs.length,retainedOriginalPeople:retainedPeople,retainedDinosaurs:retainedDinos,oldRacers:oldRacers.length,peopleInsidePens:inPen.length,plannedIndoor:plan.report.counts.indoorNew,grid:plan.report.grid,failures,passed:!failures.length};
await writeFile('verification/city-v2-global-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,grid:{spacing:report.grid.spacing,coveragePercent:report.grid.coveragePercent}}));if(failures.length)process.exitCode=1;

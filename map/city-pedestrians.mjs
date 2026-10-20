import {readFile,writeFile} from 'node:fs/promises';
import {worldReader} from '../verification/city-world-reader.mjs';
const source=process.argv[2];if(!source)throw new Error('Pass a closed world snapshot');
const reader=worldReader(source),plan=JSON.parse(await readFile('map/generated/upgrade-full.json','utf8'));
const skins=['ALEX','ARI','EFE','KAI','MAKENA','NOOR','STEVE','SUNNY','ZURI'];
const floors=new Set(['smooth_stone','stone_bricks','polished_andesite','andesite','light_gray_concrete','gray_concrete','smooth_sandstone','dirt_path','cobblestone','oak_planks','dark_oak_planks'].map(x=>'minecraft:'+x));
const points=[];
async function safe(x,z){for(const y of [64,65,66,67,68]){
  if(!floors.has((await reader.block(x,y-1,z))?.Name))continue;
  let clear=true;for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(let dy=0;dy<3;dy++)if((await reader.block(x+dx,y+dy,z+dz))?.Name!=='minecraft:air')clear=false;
  if(clear)return y;
}return null;}
async function placeNear(cx,cz,group,name,skin){for(let r=0;r<=32;r+=4)for(const [dx,dz] of r?[[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,r],[r,-r],[-r,-r]]:[[0,0]]){
  const x=Math.round(cx+dx),z=Math.round(cz+dz);if(points.some(p=>(p.x-x)**2+(p.z-z)**2<25))continue;
  const y=await safe(x,z);if(y!==null){points.push({x:x+.5,y,z:z+.5,group,name,skin:skin||skins[points.length%skins.length]});return true;}
}return false;}
for(const b of plan.metadata.buildings.filter(b=>/^city-\d+$/.test(b.id))){const a=b.bounds,cx=(a.x1+a.x2)/2;await placeNear(cx-8,a.z2+8,b.id,'市民');await placeNear(cx+8,a.z2+10,b.id,'市民');}
for(const [cx,cz,group] of [[-45,680,'station'],[45,680,'station'],[-22,620,'gate'],[22,620,'gate'],[-50,520,'visitor'],[50,520,'visitor'],[-35,455,'visitor'],[35,455,'visitor']]){
  for(let i=0;i<3;i++)await placeNear(cx+i*6,cz,group,group==='station'?'候车游客':'公园游客');
}
for(const [cx,cz] of [[-18,555],[18,555],[-18,650],[18,650]])await placeNear(cx,cz,'staff','园区工作人员','SECURITY_01');
const originalPoints=[...points];
for(const p of originalPoints){if(!await placeNear(p.x+7,p.z+7,p.group,p.name,p.skin))throw new Error('Could not add second pedestrian near '+JSON.stringify(p));}
const commands=points.map((p,i)=>{
  const tag=`city_life_npc_${String(i+1).padStart(3,'0')}`;p.tag=tag;
  return `execute unless entity @e[tag=${tag},limit=1] run summon easy_npc:humanoid ${p.x} ${p.y} ${p.z} {Tags:["city_life_pedestrian","${tag}"],CustomName:'{"text":"${p.name}"}',EasyNPCVersion:3,CustomNameVisible:0b,Invulnerable:1b,PersistenceRequired:1b,NoAI:0b,VariantType:"${p.skin}",SkinData:{Type:"DEFAULT",Name:"${p.skin}"},Navigation:{Home:{X:${Math.floor(p.x)},Y:${p.y},Z:${Math.floor(p.z)}}},ObjectiveData:{HasObjectives:1b,ObjectiveDataSet:[{Type:"FLOAT"},{Type:"MOVE_BACK_TO_HOME",SpeedModifier:0.75d,StopDistance:14.0f},{Type:"RANDOM_STROLL_AROUND_HOME",SpeedModifier:0.4d},{Type:"LOOK_AT_PLAYER",LookDistance:6.0f},{Type:"LOOK_RANDOM_AROUND"}]}}`;
});
await writeFile('map/generated/city-pedestrians.json',JSON.stringify({source,count:points.length,originalCount:originalPoints.length,points,commands},null,2));
console.log(JSON.stringify({count:points.length,cityBuildings:plan.metadata.buildings.filter(b=>/^city-\d+$/.test(b.id)).length,skins:[...new Set(points.map(p=>p.skin))]}));

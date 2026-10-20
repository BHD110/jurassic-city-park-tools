import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {worldReader} from '../verification/city-world-reader.mjs';

// Read-only Anvil snapshot. Usage: node map/city-pedestrians-v2.mjs "<closed world copy>"
const source=path.resolve(process.argv[2]||'backups/before-city-v2-20261017-232150/Jurassic City Park');
const reader=worldReader(source);
const plan=JSON.parse(await readFile('map/generated/upgrade-full.json','utf8'));
const previous=JSON.parse(await readFile('map/generated/city-pedestrians.json','utf8'));
const enclosures=plan.metadata.enclosures.map(({id,bounds})=>({id,bounds}));
if(enclosures.length!==8)throw new Error(`Expected eight enclosure interiors, got ${enclosures.length}`);
const buildings=plan.metadata.buildings.filter(b=>b.bounds&&b.bounds.x1!==undefined);
const skins=['ALEX','ARI','EFE','KAI','MAKENA','NOOR','STEVE','SUNNY','ZURI'];
const floorNames=['smooth_stone','stone_bricks','polished_andesite','andesite','light_gray_concrete','smooth_sandstone','dirt_path','cobblestone','mossy_cobblestone','oak_planks','dark_oak_planks','spruce_planks','birch_planks','jungle_planks','acacia_planks','mangrove_planks','grass_block','moss_block','gravel','bricks','polished_diorite','quartz_block','quartz_bricks','sandstone','cut_sandstone','stone','stone_brick_slab','smooth_stone_slab'];
const floors=new Set(floorNames.map(n=>'minecraft:'+n));
const clear=new Set(['minecraft:air','minecraft:cave_air','minecraft:void_air','minecraft:tall_grass','minecraft:short_grass','minecraft:grass','minecraft:fern','minecraft:large_fern','minecraft:snow']);
const door=(v)=>/^minecraft:(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|bamboo|crimson|warped)_door$/.test(v||'');
const cellCache=new Map();
async function block(x,y,z){return (await reader.block(x,y,z))?.Name||null;}
function inRect(x,z,b,margin=0){return x>=b.x1-margin&&x<=b.x2+margin&&z>=b.z1-margin&&z<=b.z2+margin;}
function enclosureAt(x,z,margin=0){return enclosures.find(e=>inRect(x,z,e.bounds,margin));}
function buildingAt(x,z){return buildings.find(b=>inRect(x,z,b.bounds));}
async function headClear(x,y,z,wide,allowDoor=false){
  for(let dx=-wide;dx<=wide;dx++)for(let dz=-wide;dz<=wide;dz++)for(let dy=0;dy<3;dy++){
    const v=await block(x+dx,y+dy,z+dz);
    if(!clear.has(v)&&!(allowDoor&&door(v)))return false;
  }
  return true;
}
async function stand(x,z,{inside=false,wide=1}={}){
  const key=`${x},${z},${inside},${wide}`;
  if(cellCache.has(key))return cellCache.get(key);
  let result=null;
  for(const y of [64,65,66,67,68]){
    const below=await block(x,y-1,z);
    if(!floors.has(below))continue;
    if(!inside&&buildingAt(x,z))continue;
    if(await headClear(x,y,z,wide,inside)){result=y;break;}
  }
  cellCache.set(key,result);return result;
}
async function hasRoof(x,y,z){
  for(let h=4;h<=24;h++){
    const b=await block(x,y+h,z);
    if(b&&!clear.has(b)&&!b.endsWith('_leaves')&&!b.endsWith('_fence'))return true;
  }
  return false;
}
function grid(x,z){return `${Math.floor((x+995)/30)},${Math.floor((z+995)/30)}`;}
const existing=previous.points.map(p=>({...p}));
if(existing.length!==374||new Set(existing.map(p=>p.tag)).size!==374)throw new Error('Original NPC identity set changed');
const points=[...existing],usedTags=new Set(existing.map(p=>p.tag)),occupied=new Set(existing.map(p=>grid(p.x,p.z)));
let next=375;
function add(x,y,z,group,name='市民',skin){
  const tag=`city_life_npc_${String(next++).padStart(4,'0')}`;
  if(usedTags.has(tag))throw new Error(`Duplicate ${tag}`);
  usedTags.add(tag);const p={name,skin:skin||skins[(next-376)%skins.length],x:x+.5,y,z:z+.5,tag,group};points.push(p);return p;
}
const offsets=[];
for(const dx of [0,-6,6,-12,12])for(const dz of [0,-6,6,-12,12])offsets.push([dx,dz]);
offsets.sort((a,b)=>a[0]**2+a[1]**2-b[0]**2-b[1]**2);
let excludedCells=0,coveredByExisting=0,walkableCells=0,emptyCells=0;
const missing=[];
for(let gx=0;gx<67;gx++)for(let gz=0;gz<67;gz++){
  const cx=-980+gx*30,cz=-980+gz*30,key=`${gx},${gz}`;
  if(enclosureAt(cx,cz,2)){excludedCells++;continue;}
  if(occupied.has(key)){coveredByExisting++;walkableCells++;continue;}
  let placed=false;
  for(const [dx,dz] of offsets){
    const x=cx+dx,z=cz+dz;
    if(x<-995||x>995||z<-995||z>995||enclosureAt(x,z,5)||buildingAt(x,z))continue;
    const y=await stand(x,z);
    if(y===null)continue;
    // Strong road/track veto. Roadway is gray concrete; white/yellow lane paint
    // and rail blocks are not accepted as floor. Check close neighbors too.
    let street=false;
    for(const [ax,az] of [[x,z],[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){
      const v=await block(ax,y-1,az);
      if(['minecraft:gray_concrete','minecraft:white_concrete','minecraft:yellow_concrete','minecraft:rail','minecraft:powered_rail','minecraft:detector_rail','minecraft:activator_rail'].includes(v))street=true;
    }
    if(street)continue;
    add(x,y,z,Math.abs(x)<=580&&Math.abs(z)<=580?'park-path':'city-grid',Math.abs(x)<=580&&Math.abs(z)<=580?'公园游客':'市民');
    occupied.add(key);walkableCells++;placed=true;break;
  }
  if(!placed){emptyCells++;missing.push({gx,gz,cx,cz});}
}

// Reachable, roofed ground-floor rooms only. Start from an actual open gap in a
// building's wall, then traverse inside by ordinary floor/head-clear steps.
// Closed doors are intentionally not assumed passable by EasyNPC.
const indoorStats={checked:0,accessible:0,withoutOpenEntrance:0,placed:0,byBuilding:[]};
const mainBuildings=buildings.filter(b=>/^city-\d+$/.test(b.id)&&!/(open-air|market)/.test(b.style||''));
for(const b of mainBuildings){
  indoorStats.checked++;
  const q=[],seen=new Set(),a=b.bounds;
  const seed=async(x,z)=>{
    if(x<a.x1||x>a.x2||z<a.z1||z>a.z2)return;
    const y=await stand(x,z,{inside:true,wide:0});
    if(y===null||!await hasRoof(x,y,z))return;
    const outer=[[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dz])=>!inRect(x+dx,z+dz,a));
    if(!outer)return;
    // The two cells across the perimeter must be open at the same level.
    for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
      if(inRect(x+dx,z+dz,a))continue;
      const yo=await stand(x+dx,z+dz,{inside:true,wide:0});
      if(yo!==null&&Math.abs(yo-y)<=1){q.push([x,z,y]);return;}
    }
  };
  for(let x=a.x1;x<=a.x2;x++){await seed(x,a.z1);await seed(x,a.z2);}
  for(let z=a.z1;z<=a.z2;z++){await seed(a.x1,z);await seed(a.x2,z);}
  if(!q.length){indoorStats.withoutOpenEntrance++;continue;}
  const reachable=[];
  for(let i=0;i<q.length&&i<12000;i++){
    const [x,z,y]=q[i],k=`${x},${z}`;if(seen.has(k))continue;seen.add(k);
    if(x<a.x1||x>a.x2||z<a.z1||z>a.z2)continue;
    const yy=await stand(x,z,{inside:true,wide:0});if(yy===null||Math.abs(yy-y)>1)continue;
    if(!await hasRoof(x,yy,z))continue;
    if(x>a.x1+2&&x<a.x2-2&&z>a.z1+2&&z<a.z2-2&&await headClear(x,yy,z,1))reachable.push([x,yy,z]);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])q.push([x+dx,z+dz,yy]);
  }
  if(!reachable.length)continue;
  indoorStats.accessible++;
  const desired=Math.min(5,Math.max(2,Math.floor(reachable.length/90)));
  let made=0;
  for(let i=0;i<reachable.length&&made<desired;i+=Math.max(1,Math.floor(reachable.length/desired))){
    const [x,y,z]=reachable[i];
    if(enclosureAt(x,z,5)||points.some(p=>Math.hypot(p.x-x,p.z-z)<5))continue;
    add(x,y,z,`interior:${b.id}`,'室内访客');made++;indoorStats.placed++;
  }
  indoorStats.byBuilding.push({id:b.id,reachable:reachable.length,placed:made});
}
function radiusFor(p){return p.group.startsWith('interior:')?18:enclosureAt(p.x,p.z,70)?20:48;}
function objectiveNbt(p){
  return `{HasObjectives:1b,ObjectiveDataSet:[{Type:"FLOAT"},{Type:"MOVE_BACK_TO_HOME",SpeedModifier:0.75d,StopDistance:${radiusFor(p)}.0f},{Type:"RANDOM_STROLL_AROUND_HOME",SpeedModifier:0.4d},{Type:"OPEN_DOOR"},{Type:"LOOK_AT_PLAYER",LookDistance:6.0f},{Type:"LOOK_RANDOM_AROUND"}]}`;
}
function npcNbt(p){
  return `{Tags:["city_life_pedestrian","${p.tag}"],CustomName:'{"text":"${p.name}"}',EasyNPCVersion:3,CustomNameVisible:0b,Invulnerable:1b,PersistenceRequired:1b,NoAI:0b,VariantType:"${p.skin}",SkinData:{Type:"DEFAULT",Name:"${p.skin}"},Navigation:{Home:{X:${Math.floor(p.x)},Y:${p.y},Z:${Math.floor(p.z)}}},ObjectiveData:${objectiveNbt(p)}}`;
}
const commands=points.map(p=>`execute unless entity @e[tag=${p.tag},limit=1] run summon easy_npc:humanoid ${p.x} ${p.y} ${p.z} ${npcNbt(p)}`);
const newPoints=points.slice(existing.length);
const insideEnclosure=points.filter(p=>enclosureAt(p.x,p.z));
const newInsideEnclosure=newPoints.filter(p=>enclosureAt(p.x,p.z));
if(newInsideEnclosure.length)throw new Error(`New NPC inside enclosure: ${JSON.stringify(newInsideEnclosure.slice(0,3))}`);
if(points.length!==commands.length||new Set(points.map(p=>p.tag)).size!==points.length)throw new Error('Command/tag mismatch');
const report={source,grid:{spacing:30,cells:4489,excludedEnclosureCenters:excludedCells,walkableCells,coveredByExisting,filledNew:walkableCells-coveredByExisting,unfilledCells:emptyCells,coveragePercent:+(100*walkableCells/(4489-excludedCells)).toFixed(1),missingPreview:missing.slice(0,25)},counts:{original:existing.length,new:newPoints.length,total:points.length,outdoorNew:newPoints.length-indoorStats.placed,indoorNew:indoorStats.placed},indoor:indoorStats,enclosures:{bounds:enclosures,existingInside:insideEnclosure.filter(p=>existing.includes(p)).map(p=>p.tag),newInside:newInsideEnclosure.length},movementSafety:'EasyNPC home and return goals are soft AI objectives, not a hard boundary. A server tick boundary guard must reject movement into enclosure bounds; do not claim strict containment until installed and tested.'};
// ParkBuilder consumes these typed spawn operations in batches. Existing 374
// entities are represented in points/commands for identity audit, but omitted
// from operations so installation never duplicates or resets them.
const operations=newPoints.map(p=>({kind:'spawn',entity:'easy_npc:humanoid',x:p.x,y:p.y,z:p.z,nbt:npcNbt(p)}));
const existingGoalUpdates=existing.map(p=>({tag:p.tag,home:{X:Math.floor(p.x),Y:p.y,Z:Math.floor(p.z)},stopDistance:radiusFor(p),objectiveData:objectiveNbt(p)}));
const output={name:'City pedestrians v2',source,bounds:{x1:-995,z1:-995,x2:995,z2:995},points,commands,operations,existingGoalUpdates,report};
await writeFile('map/generated/city-pedestrians-v2.json',JSON.stringify(output));
console.log(JSON.stringify({output:'map/generated/city-pedestrians-v2.json',report},null,2));

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nbt from 'prismarine-nbt';
import minecraftData from 'minecraft-data';

const root=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(root,'references/assets/jpog-visitor-center-entrance.schematic');
const bytes=await readFile(source);
const hash=createHash('sha256').update(bytes).digest('hex');
if(hash!=='6fb59e722c26cf962834bae4a394d00a0e570a21d65f2ea6df3b862faa196642')throw Error('source changed');
const s=nbt.simplify((await nbt.parse(bytes)).parsed);
if(s.Materials!=='Alpha'||s.Width!==101||s.Height!==36||s.Length!==91||s.Blocks.length!==s.Width*s.Height*s.Length||s.Data.length!==s.Blocks.length)throw Error('unexpected MCEdit schematic');
const legacy=minecraftData('1.12.2');
const expected={5:'planks',17:'log',18:'leaves',20:'glass',22:'lapis_block',42:'iron_block',43:'double_stone_slab',44:'stone_slab',50:'torch',53:'oak_stairs',63:'standing_sign',64:'wooden_door',68:'wall_sign',69:'lever',77:'stone_button',85:'fence',87:'netherrack',89:'glowstone',97:'monster_egg',98:'stonebrick',101:'iron_bars',109:'stone_brick_stairs',126:'wooden_slab',134:'spruce_stairs',135:'birch_stairs',148:'heavy_weighted_pressure_plate',155:'quartz_block',156:'quartz_stairs',167:'iron_trapdoor',169:'sea_lantern',189:'birch_fence',190:'jungle_fence',251:'concrete'};
for(const [id,name] of Object.entries(expected))if(legacy.blocks[Number(id)]?.name!==name)throw Error(`legacy id ${id} changed`);
const ignored=new Set([0,1,2,3,9,31,32,37,38,51,166,175,208]);
const colors=['white','orange','magenta','light_blue','yellow','lime','pink','gray','light_gray','cyan','purple','blue','brown','green','red','black'];
const woods=['oak','spruce','birch','jungle','acacia','dark_oak'];
const faces=['east','west','south','north'];
function stairs(name,data){if(data>7)throw Error(`stairs data ${data}`);return `minecraft:${name}[facing=${faces[data&3]},half=${data&4?'top':'bottom'},shape=straight,waterlogged=false]`;}
function state(id,data,index){
  if(ignored.has(id))return null;
  if(!legacy.blocks[id])throw Error(`unknown old id ${id}`);
  if(id!==50&&legacy.blocks[id].variations?.length&&!legacy.blocks[id].variations.some(v=>v.metadata===data))throw Error(`undocumented old id:data ${id}:${data}`);
  switch(id){
    case 5: return `minecraft:${woods[data]}_planks`;
    case 17:{const kind=['oak','spruce','birch','jungle'][data&3],axis=({0:'y',4:'x',8:'z',12:'y'})[data&12];return `minecraft:${kind}_log[axis=${axis}]`;}
    case 18: return `minecraft:${['oak','spruce','birch','jungle'][data&3]}_leaves[persistent=${Boolean(data&4)}]`;
    case 20:return 'minecraft:glass';
    case 22:return 'minecraft:lapis_block';
    case 42:return 'minecraft:iron_block';
    case 43:return ({0:'minecraft:smooth_stone',7:'minecraft:quartz_block'})[data];
    case 44:{const slab=({0:'stone',5:'stone_brick',7:'quartz'})[data&7];return slab?`minecraft:${slab}_slab[type=${data&8?'top':'bottom'}]`:null;}
    case 50:return data===5?'minecraft:torch':`minecraft:wall_torch[facing=${({1:'east',2:'west',3:'south',4:'north'})[data]}]`;
    case 53:return stairs('oak_stairs',data);
    case 63:return `minecraft:oak_sign[rotation=${data}]`;
    case 64:{
      const upper=Boolean(data&8);
      const lower=upper?(s.Data[index-s.Width*s.Length]&15):data;
      if((s.Blocks[upper?index-s.Width*s.Length:index]&255)!==64)throw Error(`orphan door at ${index}`);
      const facing=['east','south','west','north'][lower&3];
      return `minecraft:oak_door[facing=${facing},half=${upper?'upper':'lower'},hinge=${upper&&data&1?'right':'left'},open=${Boolean(lower&4)},powered=false]`;
    }
    case 68:return `minecraft:oak_wall_sign[facing=${({2:'north',3:'south',4:'west',5:'east'})[data]}]`;
    case 69:return 'minecraft:lever[face=wall,facing=east,powered=false]';
    case 77:return `minecraft:stone_button[face=wall,facing=${({1:'east',2:'west',3:'south',4:'north'})[data]},powered=false]`;
    case 85:return 'minecraft:oak_fence';
    case 87:return 'minecraft:netherrack';
    case 89:return 'minecraft:glowstone';
    case 97:return 'minecraft:stone_bricks';
    case 98:return 'minecraft:stone_bricks';
    case 101:return 'minecraft:iron_bars';
    case 109:return stairs('stone_brick_stairs',data);
    case 126:return `minecraft:${woods[data&7]}_slab[type=${data&8?'top':'bottom'}]`;
    case 134:return stairs('spruce_stairs',data);
    case 135:return stairs('birch_stairs',data);
    case 148:return 'minecraft:heavy_weighted_pressure_plate[power=0]';
    case 155:return 'minecraft:quartz_block';
    case 156:return stairs('quartz_stairs',data);
    case 167:return `minecraft:iron_trapdoor[facing=${['north','south','west','east'][data&3]},half=${data&8?'top':'bottom'},open=${Boolean(data&4)},powered=false,waterlogged=false]`;
    case 169:return 'minecraft:sea_lantern';
    case 189:return 'minecraft:birch_fence';
    case 190:return 'minecraft:jungle_fence';
    case 251:return `minecraft:${colors[data]}_concrete`;
    default:throw Error(`unmapped old id:data ${id}:${data}`);
  }
}
const turn={north:'west',west:'south',south:'east',east:'north'};
function rotate(block){
  const at=block.indexOf('[');
  if(at<0)return block;
  const props=Object.fromEntries(block.slice(at+1,-1).split(',').map(p=>p.split('=')));
  if(props.facing&&turn[props.facing])props.facing=turn[props.facing];
  if(props.axis==='x')props.axis='z';else if(props.axis==='z')props.axis='x';
  if(props.rotation!==undefined)props.rotation=String((Number(props.rotation)+12)%16);
  const edge=Object.fromEntries(Object.entries(turn).filter(([key])=>key in props).map(([key,value])=>[value,props[key]]));
  Object.assign(props,edge);
  return `${block.slice(0,at)}[${Object.entries(props).map(([key,value])=>`${key}=${value}`).join(',')}]`;
}
const origin={x:-45,y:62,z:401};
const cells=new Map(),mappedPairs=new Set(),skipped={};
for(let y=2;y<=32;y++)for(let z=0;z<s.Length;z++)for(let x=0;x<s.Width;x++){
  const i=(y*s.Length+z)*s.Width+x;
  const id=(s.Blocks[i]&255)+((s.AddBlocks?.[Math.floor(i/2)]??0)>>(i%2?4:0)&15)*256;
  const data=s.Data[i]&15;
  if(ignored.has(id)){skipped[id]=(skipped[id]||0)+1;continue;}
  mappedPairs.add(`${id}:${data}`);
  const old=state(id,data,i);
  if(!old)throw Error(`unmapped documented id:data ${id}:${data}`);
  if(/undefined/.test(old))throw Error(`incomplete mapping ${id}:${data}`);
  const wx=origin.x+z,wy=origin.y+y,wz=origin.z+100-x;
  cells.set(`${wx},${wy},${wz}`,rotate(old));
}
const ops=[];
function box(x1,y1,z1,x2,y2,z2,block){ops.push({kind:'box',x1,y1,z1,x2,y2,z2,block:block.includes(':')?block:`minecraft:${block}`});}
// Only the original visitor centre is replaced. The approach tower reaches south to z501.
box(-62,64,407,62,106,484,'air');
box(-62,64,407,62,64,484,'grass_block');
// The old visitor centre's trim extends two blocks beyond its recorded bounds.
for(const [x1,x2] of [[-65,-63],[63,65]])box(x1,64,405,x2,100,473,'air');
// Its two forecourt trees straddled z484; the first clearing left half crowns floating.
box(-64,65,482,-56,72,489,'air');
box(58,65,482,65,72,489,'air');
for(let y=64;y<=94;y++)for(let z=401;z<=501;z++){
  let start=null,last=null,block=null;
  function flush(){if(start!==null)box(start,y,z,last,y,z,block);}
  for(let x=-45;x<=46;x++){
    const next=x<=45?cells.get(`${x},${y},${z}`):undefined;
    if(next!==block){flush();start=next?x:null;block=next;}
    if(next)last=x;
  }
}
// New south approach preserves the original gate direction and breaks up the old forecourt.
box(-8,64,502,8,64,516,'smooth_sandstone');
box(-5,64,517,5,64,530,'mossy_stone_bricks');
for(const x of [-22,17]){
  box(x,64,489,x+5,64,501,'moss_block');
  for(const z of [491,496,500])box(x+1,65,z,x+4,66,z+1,'azalea_leaves[persistent=true]');
}
for(const x of [-18,18])for(const z of [506,520]){
  box(x,64,z,x,64,z,'moss_block');
  box(x,65,z,x,68,z,'jungle_log[axis=y]');
  box(x-2,69,z-2,x+2,70,z+2,'jungle_leaves[persistent=true]');
}
const route=JSON.parse(await readFile(path.join(root,'generated/city-coaster-route.json'),'utf8'));
const points=route.route?.points??route.points;
let corridorHits=0;
for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(Math.min(a.x,b.x)-4<=62&&Math.max(a.x,b.x)+4>=-62&&Math.min(a.z,b.z)-4<=530&&Math.max(a.z,b.z)+4>=401)corridorHits++;
}
if(corridorHits)throw Error(`track corridor intersections ${corridorHits}`);
const counts={};for(const block of cells.values())counts[block.split('[')[0]]=(counts[block.split('[')[0]]||0)+1;
const metadata={id:'visitor-centre',asset:'JPOG Visitor Center Entrance JP',source:'https://www.planetminecraft.com/project/jpog-entrace-visitor-center-schematic/',sourceSha256:hash,format:'MCEdit Alpha schematic',legacyVersion:'1.12.2 ID/Data, inferred from source IDs including concrete',sourceDimensions:{width:s.Width,height:s.Height,length:s.Length},sourceRegionUsed:{x1:0,y1:2,z1:0,x2:100,y2:32,z2:90},rotation:'counterclockwise-90; source west frontage becomes world south',origin,importedBounds:{x1:-45,y1:64,z1:401,x2:45,y2:94,z2:501},oldVisitorCleared:{x1:-62,y1:64,z1:407,x2:62,y2:106,z2:484},oldTrimAndTreesCleared:true,blocksImported:cells.size,operations:ops.length,legacyPairsMapped:mappedPairs.size,skippedTerrainAndUnsafe:skipped,sourceEntitiesSkipped:s.Entities?.length||0,sourceTileEntitiesSkipped:s.TileEntities?.length||0,trackCorridorHits:corridorHits,blockCounts:counts,policy:'No source entities or tile entity NBT; legacy fire and barrier omitted. Numeric mapping checked against minecraft-data 1.12.2 and validated for 1.21.1 before construction.'};
await writeFile(path.join(root,'generated/imported-jpog-visitor.json'),JSON.stringify({name:'JPOG Visitor Centre Replacement Candidate',bounds:{x1:-62,z1:401,x2:62,z2:530},operations:ops,metadata}));
console.log(JSON.stringify({output:'map/generated/imported-jpog-visitor.json',blocks:cells.size,operations:ops.length,legacyPairsMapped:mappedPairs.size,corridorHits,skipped},null,2));

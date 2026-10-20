import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {worldReader} from '../verification/city-world-reader.mjs';

const backup = JSON.parse(await readFile('verification/park-tour-backup.json', 'utf8'));
const full = JSON.parse(await readFile('map/generated/upgrade-full.json', 'utf8'));
const worlds = backup.worlds.map(item => ({...item, reader: worldReader(item.backup)}));
const key = (x,y,z) => `${x},${y},${z}`;
const xz = (x,z) => `${x},${z}`;
const air = name => ['minecraft:air','minecraft:cave_air'].includes(name);
const waypoints = [[0,674],[600,674],[600,100],[460,100],[460,-185],
  [210,-185],[210,-465],[-185,-465],[-185,-335],[-460,-335],[-460,385],
  [-210,385],[-210,270],[210,270],[210,550],[-180,550],[-180,674],[0,674]];
const direction = (dx,dz) => dx>0?'east':dx<0?'west':dz>0?'south':'north';
function pointsAt(height) {
  const raw=[];
  for(let segment=0;segment<waypoints.length-1;segment++) {
    const [ax,az]=waypoints[segment], [bx,bz]=waypoints[segment+1];
    const length=Math.abs(ax-bx)+Math.abs(az-bz);
    if(ax!==bx&&az!==bz) throw new Error('Diagonal segment');
    for(let i=0;i<length;i++) {
      const x=ax+Math.sign(bx-ax)*i,z=az+Math.sign(bz-az)*i;
      let y=height;
      if(segment===0) y=65+Math.min(height-65,Math.max(0,x-75));
      if(segment===waypoints.length-2) y=height-Math.min(height-65,Math.max(0,x+60));
      raw.push({x,y,z,segment});
    }
  }
  return raw.map((p,i)=>{
    const previous=raw[(i+raw.length-1)%raw.length],next=raw[(i+1)%raw.length];
    const higher=[previous,next].filter(q=>q.y>p.y);
    if(higher.length>1)throw new Error('Invalid valley');
    const dirs=[previous,next].map(q=>direction(q.x-p.x,q.z-p.z)).sort().join('_');
    const shapes={east_west:'east_west',north_south:'north_south',east_north:'north_east',east_south:'south_east',north_west:'north_west',south_west:'south_west'};
    const shape=higher.length?`ascending_${direction(higher[0].x-p.x,higher[0].z-p.z)}`:shapes[dirs];
    if(!shape)throw new Error('Unknown rail shape');
    const turn=previous.x!==next.x&&previous.z!==next.z;
    if(turn&&(previous.y!==p.y||next.y!==p.y))throw new Error('Sloping corner');
    if(Math.abs(p.y-next.y)>1)throw new Error('Disconnected height');
    return {...p,shape,powered:!turn};
  });
}
function buildGeometry(points) {
  const center=new Map(points.map(p=>[xz(p.x,p.z),p])),glass=new Map();
  for(const p of points)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const x=p.x+dx,z=p.z+dz,k=xz(x,z);
    if(!center.has(k)&&!glass.has(k))glass.set(k,{x,z,y:p.y});
  }
  const insideCorners=new Set();
  for(let i=0;i<points.length;i++) {
    const p=points[i],previous=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
    if(previous.x!==next.x&&previous.z!==next.z)insideCorners.add(xz(previous.x+next.x-p.x,previous.z+next.z-p.z));
  }
  const columns=new Map([...center].map(([k,p])=>[k,{...p,distance:0}]));
  const cells=new Map();
  const put=(x,y,z,block,role)=>cells.set(key(x,y,z),{x,y,z,block,role});
  for(const [k,p] of glass) {
    let block='minecraft:glass';
    // A full glass block on an inside diagonal would clip a turning minecart.
    if(insideCorners.has(k)) {
      const props=[['north',0,-1],['south',0,1],['east',1,0],['west',-1,0]]
        .map(([side,dx,dz])=>`${side}=${glass.get(xz(p.x+dx,p.z+dz))?.y===p.y}`);
      block=`minecraft:glass_pane[${props.join(',')},waterlogged=false]`;
    }
    put(p.x,p.y,p.z,block,'glass');
    columns.set(k,{...p,distance:1});
  }
  for(let x=-26;x<=26;x++)for(let z=665;z<=676;z++)put(x,64,z,'minecraft:smooth_stone','platform');
  for(const p of points) {
    put(p.x,p.y-1,p.z,p.powered?'minecraft:redstone_block':'minecraft:stone_bricks','rail-support');
    put(p.x,p.y,p.z,`minecraft:${p.powered?'powered_rail':'rail'}[shape=${p.shape}${p.powered?',powered=true':''}]`,'rail');
  }
  for(const x of [-20,-10,10,20])put(x,64,668,'minecraft:sea_lantern','platform-light');
  return {cells,columns,center};
}

let geometry,points,height;
const conflicts=[];
for(height=96;height<=120;height+=4) {
  points=pointsAt(height);
  geometry=buildGeometry(points);
  const hits=[];
  for(const p of geometry.cells.values()) {
    if(p.y<=65)continue;
    for(const world of worlds) {
      const state=await world.reader.block(p.x,p.y,p.z);
      if(!air(state?.Name)) {hits.push({world:world.kind,...p,actual:state});break;}
    }
    if(hits.length>=3)break;
  }
  if(!hits.length)break;
  conflicts.push({height,hits});
}
if(height>120)throw new Error(`No clear elevated route: ${JSON.stringify(conflicts)}`);
const {cells,columns,center}=geometry;
const selector='@p[x=0,y=65,z=669,distance=..4]';
const cart='@e[type=minecraft:minecart,tag=park_tour_boarding,sort=nearest,limit=1,distance=..4]';
const origin='0 66 674';
const commands=[
  `execute positioned ${origin} run kill @e[type=minecraft:minecart,tag=park_tour,distance=..5,nbt=!{Passengers:[{}]}]`,
  `execute if entity ${selector} run summon minecraft:minecart 0.5 65.2 674.5 {Tags:["park_tour","park_tour_boarding"]}`,
  `execute positioned ${origin} run ride ${selector} mount ${cart}`,
  `execute positioned ${origin} run data merge entity ${cart} {Motion:[0.28d,0.0d,0.0d]}`,
  `execute positioned ${origin} run tag ${cart} remove park_tour_boarding`,
];
const controls=commands.map((command,i)=>({x:0,y:64,z:669+i,command,
  block:`minecraft:${i?'chain_command_block':'command_block'}[facing=south,conditional=${i>1}]`,auto:i?1:0}));
const put=(x,y,z,block,role)=>cells.set(key(x,y,z),{x,y,z,block,role});
for(const control of controls)put(control.x,control.y,control.z,control.block,'control');
put(0,65,669,'minecraft:stone_button[face=floor,facing=north,powered=false]','button');
for(const x of [-6,6])put(x,65,669,'minecraft:oak_sign[rotation=8,waterlogged=false]','sign');

const allowedGround=new Set(['minecraft:air','minecraft:grass_block','minecraft:dirt',
  'minecraft:smooth_stone','minecraft:polished_andesite','minecraft:stone_bricks',
  'minecraft:light_gray_concrete','minecraft:gray_concrete','minecraft:stone',
  'minecraft:azalea_leaves','minecraft:flowering_azalea_leaves','minecraft:short_grass',
  'minecraft:fern','minecraft:moss_carpet']);
const seen=new Set();
for(let i=0;i<points.length;i++) {
  const p=points[i],next=points[(i+1)%points.length],k=xz(p.x,p.z);
  if(seen.has(k))throw new Error(`Self intersection: ${k}`);
  seen.add(k);
  if(Math.abs(p.x-next.x)+Math.abs(p.z-next.z)!==1)throw new Error('Disconnected route');
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const adjacent=center.get(xz(p.x+dx,p.z+dz));
    if(adjacent&&adjacent!==next&&adjacent!==points[(i+points.length-1)%points.length])throw new Error('Unintended rail junction');
  }
  for(let dy=1;dy<=3;dy++) {
    if(cells.has(key(p.x,p.y+dy,p.z)))throw new Error('New geometry blocks train clearance');
    for(const world of worlds)if(!air((await world.reader.block(p.x,p.y+dy,p.z))?.Name))throw new Error(`Existing train obstruction at ${k}`);
  }
}
const preflight=[];
for(const world of worlds) {
  let reused=0;
  for(const p of cells.values()) {
    const state=await world.reader.block(p.x,p.y,p.z);
    if(!air(state?.Name)) {
      if(p.y>65||!allowedGround.has(state?.Name))throw new Error(`Protected block conflict ${world.kind} ${key(p.x,p.y,p.z)} ${state?.Name}`);
      reused++;
    }
  }
  preflight.push({kind:world.kind,checkedTargets:cells.size,reusedGroundBlocks:reused});
}
const enclosureCoverage=full.metadata.enclosures.map(enclosure=>{
  const b=enclosure.bounds;
  const above=points.filter(p=>p.x>b.x1+4&&p.x<b.x2-4&&p.z>b.z1+4&&p.z<b.z2-4&&p.y>b.y2+8);
  if(above.length<40)throw new Error(`Insufficient enclosure coverage: ${enclosure.id}`);
  return {id:enclosure.id,name:enclosure.name,overheadTrackBlocks:above.length,
    sample:above[Math.floor(above.length/2)]};
});
const operations=[];
// Build the complete deck first so later rail and glass updates have support.
const order={'deck':0,'platform':0,'platform-light':0,'rail-support':0,'glass':1,'rail':2,'button':3};
const sorted=[...cells.values()].filter(p=>!['control','sign','button'].includes(p.role))
  .sort((a,b)=>order[a.role]-order[b.role]||a.block.localeCompare(b.block)||a.y-b.y||a.z-b.z||a.x-b.x);
for(const p of sorted) {
  const previous=operations.at(-1);
  if(previous?.kind==='box'&&previous.block===p.block&&previous.y1===p.y&&previous.z1===p.z&&previous.x2===p.x-1)previous.x2=p.x;
  else operations.push({kind:'box',x1:p.x,y1:p.y,z1:p.z,x2:p.x,y2:p.y,z2:p.z,block:p.block});
}
for(const c of controls)operations.push({kind:'command',command:`setblock ${c.x} ${c.y} ${c.z} ${c.block}{Command:${JSON.stringify(c.command)},auto:${c.auto}b,TrackOutput:0b}`});
operations.push({kind:'box',x1:0,y1:65,z1:669,x2:0,y2:65,z2:669,block:'minecraft:stone_button[face=floor,facing=north,powered=false]'});
for(const x of [-6,6])operations.push({kind:'sign',x,y:65,z:669,block:'minecraft:oak_sign[rotation=8,waterlogged=false]',
  lines:x<0?['恐龙园区观光线','八大园区上空环游','车站发车 · 返回本站','']:['公园高架观光线','发车按钮在中间','两侧玻璃护栏','']});
const bounds={};
for(const axis of ['x','y','z']) {
  bounds[`${axis}1`]=Math.min(...[...cells.values()].map(p=>p[axis]));
  bounds[`${axis}2`]=Math.max(...[...cells.values()].map(p=>p[axis]));
}
const route={name:'Park Dinosaur Sky Tour',station:{x:0,y:65,z:674},length:points.length,points};
const metadata={generatedAt:new Date().toISOString(),height,deckWidth:1,glassHeight:1,profile:'t-shaped-v1',
  insideCornerPanes:[...cells.values()].filter(p=>p.block.startsWith('minecraft:glass_pane')).length,
  glassBlocks:[...cells.values()].filter(p=>p.role==='glass').length,
  unchangedOriginalCoaster:true,noGroundSupportPillars:true,enclosureCoverage,preflight,
  button:{x:0,y:65,z:669},controls,waypoints,estimatedRideMinutes:Math.round(points.length/8/60*10)/10,
  routeSha256:createHash('sha256').update(JSON.stringify(route)).digest('hex'),
  backup:backup.backup,skippedHeights:conflicts.map(c=>c.height)};
const plan={name:'Park Dinosaur Sky Tour',bounds,route,metadata,operations};
await writeFile('map/generated/park-tour-route.json',JSON.stringify(plan)+'\n');
await writeFile('verification/park-tour-expected.json',JSON.stringify({cells:[...cells.values()],columns:[...columns.values()]})+'\n');
console.log(JSON.stringify({...metadata,controls:controls.length,operations:operations.length,targets:cells.size,routeLength:points.length}));

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { addParkDetails } from './park-details.mjs';
import { addCityDetails } from './city-details.mjs';
import { addInteriorLighting } from './interior-lighting.mjs';
import { addCityGroundDetails } from './city-ground-patch.mjs';
import { addDensityDetails } from './density-details.mjs';

const out = path.resolve('map/generated');
await mkdir(out, { recursive: true });
const plan = (name, bounds) => ({ name, bounds, operations: [], metadata: { buildings: [], cityParcels: [], enclosures: [], landmarks: [], expectedDinosaurCount: 0, routeLength: 0 } });
const full = plan('Jurassic City Park', { x1: -1000, z1: -1000, x2: 1000, z2: 1000 });
const sample = plan('Jurassic Park Sample', { x1: -128, z1: -128, x2: 128, z2: 128 });
const polishExtras=[];
const visitorFixOps=[];
const railsideClearanceOps=[];
let current = full;
function box(x1,y1,z1,x2,y2,z2,block) { const op={kind:'box',x1:Math.round(x1),y1:Math.round(y1),z1:Math.round(z1),x2:Math.round(x2),y2:Math.round(y2),z2:Math.round(z2),block:block.includes(':')?block:`minecraft:${block}`}; current.operations.push(op); return op; }
function command(command) { current.operations.push({kind:'command',command}); }
function sign(x,y,z,lines,facing='south') { current.operations.push({kind:'sign',x,y,z,lines,block:`minecraft:oak_wall_sign[facing=${facing}]`}); }
function landmark(id,name,x,y,z) { current.metadata.landmarks.push({id,name,x,y,z}); }
function b(x1,y1,z1,x2,y2,z2) { return {x1,y1,z1,x2,y2,z2}; }
function markBuilding(id,name,x1,y1,z1,x2,y2,z2,interior) { current.metadata.buildings.push({id,name,bounds:b(x1,y1,z1,x2,y2,z2),interior}); }
let seed = 246813579;
function rand() { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
function int(a,z) { return a+Math.floor(rand()*(z-a+1)); }
let spawnHazards = null;
function hazard(x1,z1,x2,z2) { if(spawnHazards) spawnHazards.push({x1,z1,x2,z2}); }

function commonRules() {
  for (const r of ['doDaylightCycle false','doWeatherCycle false','doMobSpawning false','doFireTick false','mobGriefing false','randomTickSpeed 0','dinosaurMetabolism false','doDinoBreeding false']) command(`gamerule ${r}`);
  command('time set 1000'); command('weather clear'); command('difficulty normal');
}
function lamp(x,z) { box(x,64,z,x,68,z,'polished_blackstone_wall'); box(x-1,69,z,x+1,69,z,'iron_bars'); box(x-1,68,z,x-1,68,z,'sea_lantern'); box(x+1,68,z,x+1,68,z,'sea_lantern'); }
function tree(x,z,large=false) {
  const h=large?int(14,20):int(7,11),wood=large?'jungle_log':'oak_log';
  const leaves=large?'jungle_leaves[persistent=true]':'oak_leaves[persistent=true]';
  box(x,64,z,x+(large?1:0),63+h,z+(large?1:0),wood);
  const layers=large?[[-4,2],[-3,4],[-2,5],[-1,5],[0,4],[1,3],[2,1]]:[[-3,1],[-2,2],[-1,3],[0,3],[1,2],[2,1]];
  for(const [dy,r] of layers) for(let dz=-r;dz<=r;dz++) {
    const width=Math.floor(Math.sqrt(r*r-dz*dz));
    box(x-width,63+h+dy,z+dz,x+width,63+h+dy,z+dz,leaves);
  }
  hazard(x-(large?9:5),z-(large?9:5),x+(large?10:5),z+(large?10:5));
}
function road(x1,z1,x2,z2,horizontal) {
  box(x1,63,z1,x2,63,z2,'gray_concrete');
  if (horizontal) { box(x1,63,z1,x2,63,z1+3,'smooth_stone'); box(x1,63,z2-3,x2,63,z2,'smooth_stone'); for(let x=x1+5;x<x2;x+=18) box(x,63,Math.floor((z1+z2)/2),Math.min(x+7,x2),63,Math.floor((z1+z2)/2),'white_concrete'); for(let x=x1+20;x<x2;x+=64) lamp(x,z1+2); }
  else { box(x1,63,z1,x1+3,63,z2,'smooth_stone'); box(x2-3,63,z1,x2,63,z2,'smooth_stone'); for(let z=z1+5;z<z2;z+=18) box(Math.floor((x1+x2)/2),63,z,Math.floor((x1+x2)/2),63,Math.min(z+7,z2),'white_concrete'); for(let z=z1+20;z<z2;z+=64) lamp(x1+2,z); }
}
function shell(x1,z1,x2,z2,y1,y2,wall,glass='brown_stained_glass') {
  box(x1,y1,z1,x2,y1,z2,'smooth_stone');
  box(x1,y1+1,z1,x1,y2,z2,wall);box(x2,y1+1,z1,x2,y2,z2,wall);
  box(x1+1,y1+1,z1,x2-1,y2,z1,wall);box(x1+1,y1+1,z2,x2-1,y2,z2,wall);
  box(x1,y2,z1,x2,y2,z2,wall);
  for(let y=y1+4;y<y2-1;y+=4) box(x1+1,y,z1+1,x2-1,y,z2-1,'smooth_stone');
  for(let y=y1+3;y<y2-2;y+=4) {
    for(let x=x1+3;x<=x2-5;x+=7) {
      box(x,y,z1,Math.min(x+3,x2-3),y+1,z1,glass);
      box(x,y,z2,Math.min(x+3,x2-3),y+1,z2,glass);
    }
    for(let z=z1+3;z<=z2-5;z+=7) {
      box(x1,y,z,x1,y+1,Math.min(z+3,z2-3),glass);
      box(x2,y,z,x2,y+1,Math.min(z+3,z2-3),glass);
    }
  }
  for(let x=x1+7;x<x2-3;x+=7) {box(x,y1+1,z2,x,y2-1,z2,wall);box(x,y1+1,z1,x,y2-1,z1,wall);}
}
function cornice(x1,z1,x2,z2,y,material) { box(x1-1,y,z1-1,x2+1,y,z2+1,material); box(x1,y+1,z1,x2,y+1,z2,'air'); }
function tileRoof(x1,z1,x2,z2,y,rise=5) {
  const half=(x2-x1)/2,mid=(x1+x2)/2;
  for(let x=x1;x<=x2;x++) {
    const distance=Math.min(x-x1,x2-x),level=Math.round(rise*distance/half);
    const surface=(x+y)%5===0?'bricks':'red_terracotta';
    box(x,y+level,z1-2,x,y+level,z2+2,surface);
    box(x,y,z1-2,x,y+level,z1-2,'light_gray_concrete');
    box(x,y,z2+2,x,y+level,z2+2,'light_gray_concrete');
    box(x,y+level,z1-2,x,y+level,z1-2,surface);
    box(x,y+level,z2+2,x,y+level,z2+2,surface);
    if(x>x1&&x<mid&&level>Math.round(rise*(x-1-x1)/half))
      box(x,y+level,z1-1,x,y+level,z2+1,'brick_stairs[facing=west]');
    if(x>mid&&x<x2&&level>Math.round(rise*(x2-(x+1))/half))
      box(x,y+level,z1-1,x,y+level,z2+1,'brick_stairs[facing=east]');
  }
  box(x1-1,y,z1-2,x1-1,y,z2+2,'brick_stairs[facing=west]');
  box(x2+1,y,z1-2,x2+1,y,z2+2,'brick_stairs[facing=east]');
  box(Math.floor((x1+x2)/2),y+rise,z1-2,Math.ceil((x1+x2)/2),y+rise,z2+2,'bricks');
}
function shutters(x1,x2,z,y1,y2) {
  for(let x=x1+4;x<x2-4;x+=8) {
    box(x,y1,z,x+3,y2,z,'brown_stained_glass');
    box(x-1,y1,z+1,x-1,y2,z+1,'dark_oak_trapdoor[facing=south,open=true]');
    box(x+4,y1,z+1,x+4,y2,z+1,'dark_oak_trapdoor[facing=south,open=true]');
  }
}
function veranda(x1,x2,z,y1,y2) {
  box(x1-2,y2,z,x2+2,y2,z+5,'smooth_sandstone');
  for(let x=x1;x<=x2;x+=8) box(x,y1,z+5,x,y2-1,z+5,'smooth_sandstone');
  box(x1-2,y1,z+1,x2+2,y1,z+5,'smooth_stone');
}
function roofUnit(cx,cz,y) {box(cx-4,y,cz-3,cx+4,y+3,cz+3,'polished_andesite');box(cx-3,y+4,cz-2,cx+3,y+4,cz+2,'iron_block');for(const x of [cx-8,cx+8]) box(x,y,cz-7,x,y+2,cz-7,'iron_bars');}
function streetShop(cx,zfront,label,awning='red_wool') { box(cx-5,65,zfront,cx+5,68,zfront,'glass');box(cx-2,65,zfront,cx+2,68,zfront,'air');box(cx-7,69,zfront,cx+7,69,zfront+3,awning);box(cx-5,71,zfront+1,cx+5,72,zfront+1,'dark_oak_planks');sign(cx-2,71,zfront+2,[label]); }
function cityParcel(cx,cz,index,halfX,halfZ,depth) {
  const z1=cz-depth,z2=cz+depth;
  current.metadata.cityParcels.push({id:`city-parcel-${index+1}`,bounds:b(cx-halfX,63,cz-halfZ,cx+halfX,75,cz+halfZ),mainBuilding:`city-${String(index+1).padStart(2,'0')}`});
  box(cx-halfX,63,cz-halfZ,cx+halfX,63,cz+halfZ,'stone_bricks');
  box(cx-halfX+3,63,cz-halfZ+3,cx+halfX-3,63,z1-5,'moss_block');
  box(cx-halfX+4,63,z2+4,cx+halfX-4,63,cz+halfZ-3,'smooth_stone');
  box(cx-4,63,z2,cx+4,63,cz+halfZ+14,'smooth_stone');
  for(const side of [-1,1]) {
    const x=cx+side*(halfX-7);
    for(const zz of [cz-halfZ+10,cz-halfZ+30]) {
      box(x-2,64,zz-2,x+2,64,zz+2,'moss_block');
      box(x,65,zz,x,68,zz,'jungle_log');
      box(x-2,69,zz-2,x+2,70,zz+2,'jungle_leaves[persistent=true]');
    }
    box(x-2,64,cz+halfZ-12,x+2,64,cz+halfZ-8,'moss_block');
    box(x,65,cz+halfZ-10,x,67,cz+halfZ-10,'flowering_azalea_leaves[persistent=true]');
  }
  const frontDepth=Math.min(20,halfZ-depth-7);
  if(frontDepth>=5) for(const side of [-1,1]) {
    const x=cx+side*19,ax1=x-10,ax2=x+10,az1=z2+6,az2=az1+frontDepth-1;
    const wall=index%3===0?'pink_terracotta':index%3===1?'white_concrete':'lime_terracotta';
    box(ax1,64,az1,ax2,72+index%3,az2,wall);
    box(ax1+1,65,az1+1,ax2-1,71+index%3,az2-1,'air');
    box(ax1+2,66,az2,ax2-2,69,az2,'brown_stained_glass');
    box(x-2,65,az2,x+2,68,az2,'air');
    box(ax1-1,73+index%3,az1-1,ax2+1,73+index%3,az2+2,'bricks');
    box(ax1-1,70,az2+1,ax2+1,70,az2+3,side<0?'green_wool':'red_wool');
    sign(x-2,71,az2+3,[side<0?'市场':'咖啡']);
    markBuilding(`city-annex-${index+1}-${side<0?'l':'r'}`,'沿街配楼',ax1,64,az1,ax2,76+index%3,az2+3,true);
  }
}
function building(cx,cz,index,small=false) {
  const types=['concrete-office','hotel','courtyard-apartment','arcade-hacienda','municipal-office','roof-villa','shop-row','parking-garage','fire-station','fuel-market'];
  const names=['海岛办公楼','双塔酒店','庭院公寓','骑楼旅馆','市政办公楼','红瓦洋房','街角商铺','停车楼','消防站','加油与便利店'];
  const type=types[small?5:index%types.length];
  const widths=[34,38,32,36,38,30,33,32,34,35],depths=[29,32,28,30,32,28,29,28,29,30];
  const width=small?12:widths[index%10]+index%3,depth=small?12:depths[index%10]+index%2;
  const x1=cx-width,x2=cx+width,z1=cz-depth,z2=cz+depth;
  let top=80;
  if(!small) cityParcel(cx,cz,index,Math.abs(cx)>600?68:Math.abs(cx)<=150?45:52,cz===720?44:68,depth);
  box(x1-3,63,z1-3,x2+3,63,z2+4,'smooth_stone');
  if(type==='concrete-office') {
    shell(x1,z1,x2,z2,64,84,'light_gray_concrete','gray_stained_glass');
    const upper=94+4*(index%3);
    shell(x1+7,z1+5,x2-7,z2-5,84,upper,'white_concrete','gray_stained_glass');
    cornice(x1+7,z1+5,x2-7,z2-5,upper,'polished_andesite');top=upper+2;
    veranda(x1+3,x2-3,z2,65,71);shutters(x1+3,x2-3,z2,74,77);
    streetShop(cx,z2,'城市书店','green_wool');
  } else if(type==='hotel') {
    const tower=93+3*(index%3);
    shell(x1,z1,x2,z2,64,74,'white_concrete','brown_stained_glass');
    shell(x1+3,z1+3,x1+18,z2-3,74,tower,'light_gray_concrete');
    shell(x2-18,z1+3,x2-3,z2-3,74,tower-3,'white_concrete');
    tileRoof(x1+2,z1+2,x1+19,z2-2,tower+1,4);tileRoof(x2-19,z1+2,x2-2,z2-2,tower-2,4);top=tower+6;
    veranda(x1+4,x2-4,z2,65,71);shutters(x1+4,x2-4,z2,76,79);
    streetShop(cx,z2,'海岛酒店','red_wool');
  } else if(type==='courtyard-apartment') {
    shell(x1,z1,x1+15,z2,64,84,'pink_terracotta');
    shell(x1+15,z1,x2,z1+15,64,84,'pink_terracotta');
    if(index%2===0) shell(x2-15,z1+15,x2,z2,64,80,'pink_terracotta');
    for(let y=69;y<=81;y+=4) for(let zz=z1+20;zz<z2-3;zz+=8) box(x1+16,y,zz,x1+18,y,zz+4,'dark_oak_slab[type=bottom]');
    box(cx-5,64,cz+2,cx+11,64,z2-3,'moss_block');tree(cx+8,cz+8);
    tileRoof(x1,z1,x1+15,z2,85,5);tileRoof(x1+15,z1,x2,z1+15,85,5);top=91;
  } else if(type==='arcade-hacienda') {
    shell(x1,z1,x2,z2,64,81,'white_concrete');
    const upper=87+2*(index%3);
    shell(x1+7,z1+7,x2-7,z2-7,81,upper,'light_gray_concrete');
    veranda(x1+2,x2-2,z2,65,72);shutters(x1+2,x2-2,z2,75,78);
    tileRoof(x1,z1,x2,z2,upper+1,6);top=upper+8;
  } else if(type==='municipal-office') {
    shell(x1,z1,x2,z2,64,83,'light_gray_concrete','gray_stained_glass');
    shell(x1+9,z1+7,x2-9,z2-7,83,95,'white_concrete','gray_stained_glass');
    veranda(x1+4,x2-4,z2,65,72);
    cornice(x1+9,z1+7,x2-9,z2-7,95,'smooth_stone');top=97;
  } else if(type==='roof-villa') {
    shell(x1,z1,x2,z2,64,small?76:82,'lime_terracotta');
    const base=small?77:83,steps=small?4:6;
    tileRoof(x1,z1,x2,z2,base,steps);
    shutters(x1+2,x2-2,z2,68,71);
    for(let xx=x1+4;xx<x2-3;xx+=10) {box(xx,68,z2+1,xx+5,68,z2+3,'spruce_slab[type=bottom]');box(xx+1,65,z2+1,xx+4,65,z2+2,'flower_pot');}
    top=base+steps+2;
  } else if(type==='shop-row') {
    shell(x1,z1,x2,z2,64,78,'pink_terracotta','brown_stained_glass');
    for(const [dx,label,color] of [[-15,'咖啡','orange_wool'],[0,'玩具','lime_wool'],[15,'餐厅','red_wool']]) streetShop(cx+dx,z2,label,color);
    tileRoof(x1,z1,x2,z2,79,4);top=84;
  } else if(type==='parking-garage') {
    box(x1,64,z1,x2,64,z2,'smooth_stone');
    for(let y=68;y<=84;y+=4) {box(x1,y,z1,x2,y,z2,'smooth_stone');for(const xx of [x1,x1+12,x2-12,x2]) for(const zz of [z1,z2]) box(xx,y-3,zz,xx,y-1,zz,'polished_andesite');box(x1,y-2,z1,x1,y-1,z2,'iron_bars');box(x2,y-2,z1,x2,y-1,z2,'iron_bars');}
    box(x1,85,z1,x2,85,z2,'gray_concrete');
    box(cx-3,86,z2,cx+3,90,z2,'white_concrete');top=91;
  } else if(type==='fire-station') {
    shell(x1,z1,x2,z2,64,78,'white_concrete','gray_stained_glass');
    for(const xx of [cx-12,cx,cx+12]) {box(xx-4,65,z2,xx+4,72,z2,'gray_stained_glass');box(xx-5,73,z2,xx+5,73,z2,'red_terracotta');}
    shell(x1+3,z1+3,x1+14,z1+14,78,94,'white_concrete','gray_stained_glass');
    box(x1+7,95,z1+7,x1+10,98,z1+10,'red_terracotta');top=99;
    sign(cx-2,77,z2+1,['消防站','FIRE STATION']);
  } else {
    shell(x1,z1,x1+19,z2,64,76,'white_concrete','brown_stained_glass');
    box(x1+20,72,z1+2,x2,72,z2-2,'white_concrete');
    box(x1+20,73,z1+2,x2,74,z1+2,'red_concrete');
    for(const xx of [x1+23,x2-3]) for(const zz of [z1+5,z2-5]) box(xx,65,zz,xx,71,zz,'quartz_pillar');
    for(const xx of [x1+25,x2-8]) {box(xx,64,cz-2,xx+3,68,cz+2,'red_concrete');box(xx+1,66,cz+3,xx+2,67,cz+3,'iron_block');}
    tileRoof(x1,z1,x1+19,z2,77,3);top=81;
    streetShop(x1+9,z2,'便利店','green_wool');
  }
  box(cx-2,65,z2,cx+2,68,z2,'air');
  for(const xx of [x1+3,x2-3]) box(xx,64,z2+3,xx+2,64,z2+5,'moss_block');
  current.metadata.buildings.push({id:`city-${String(index+1).padStart(2,'0')}`,name:names[small?5:index%types.length],style:type,bounds:b(x1-1,64,z1-1,x2+1,top,z2+5),interior:['hotel','shop-row','parking-garage','fire-station','fuel-market'].includes(type)});
}
function localStreet(x1,z1,x2,z2,horizontal) {
  box(x1,63,z1,x2,63,z2,'gray_concrete');
  if(horizontal) {box(x1,63,z1,x2,63,z1+1,'smooth_stone');box(x1,63,z2-1,x2,63,z2,'smooth_stone');for(let x=x1+8;x<x2;x+=20) box(x,63,Math.floor((z1+z2)/2),Math.min(x+7,x2),63,Math.floor((z1+z2)/2),'yellow_concrete');}
  else {box(x1,63,z1,x1+1,63,z2,'smooth_stone');box(x2-1,63,z1,x2,63,z2,'smooth_stone');for(let z=z1+8;z<z2;z+=20) box(Math.floor((x1+x2)/2),63,z,Math.floor((x1+x2)/2),63,Math.min(z+7,z2),'yellow_concrete');}
}
function cityCar(x,z,color='red_concrete',bus=false) {
  const length=bus?14:7;
  box(x-2,64,z-3,x+2,64,z+length-4,'black_concrete');
  box(x-2,65,z-3,x+2,66,z+length-4,color);
  box(x-1,67,z-1,x+1,68,z+length-7,'gray_stained_glass');
  for(const zz of [z-2,z+length-5]) for(const xx of [x-3,x+3]) box(xx,64,zz,xx,65,zz,'black_concrete');
  box(x-1,65,z+length-4,x+1,65,z+length-4,'white_concrete');
}
function parkVehicle(x,z,jeep=false,stripe='red_concrete') {
  box(x-2,64,z-4,x+2,64,z+4,'black_concrete');
  box(x-2,65,z-4,x+2,66,z+4,jeep?'light_gray_concrete':'yellow_concrete');
  box(x-2,66,z-3,x+2,66,z-1,'dark_oak_planks');
  box(x-1,67,z-1,x+1,68,z+2,'gray_stained_glass');
  box(x-2,66,z+1,x-2,66,z+3,stripe);box(x+2,66,z+1,x+2,66,z+3,stripe);
  box(x-2,65,z-3,x+2,65,z-3,stripe);
  for(const xx of [x-3,x+3]) for(const zz of [z-3,z+3]) box(xx,64,zz,xx,65,zz,'black_concrete');
  box(x-1,66,z-5,x+1,66,z-5,'sea_lantern');
  box(x-1,65,z+5,x+1,65,z+5,'red_concrete');
}
function busStop(x,z) {box(x-9,63,z-5,x+9,63,z+5,'smooth_stone');for(const xx of [x-7,x+7]) box(xx,64,z-3,xx,69,z-3,'polished_andesite');box(x-8,70,z-4,x+8,70,z+2,'dark_prismarine');box(x-8,65,z-3,x-8,68,z+2,'glass');box(x+8,65,z-3,x+8,68,z+2,'glass');box(x-5,64,z+1,x+5,64,z+2,'dark_oak_stairs[facing=north]');sign(x-1,68,z+3,['城市公交','BUS STOP']);cityCar(x+22,z-4,'yellow_concrete',true);}
function fountainContainment(x,z) {
  for(const zz of [z-4,z+4]) box(x-4,65,zz,x+4,65,zz,'stone_bricks');
  for(const xx of [x-4,x+4]) box(xx,65,z-3,xx,65,z+3,'stone_bricks');
  for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) box(x+dx,66,z+dz,x+dx,68,z+dz,'glass');
}
function pocketSquare(x,z) {box(x-17,63,z-20,x+17,63,z+20,'stone_bricks');box(x-14,63,z-17,x+14,63,z+17,'smooth_stone');box(x-5,64,z-5,x+5,64,z+5,'polished_andesite');fountainContainment(x,z);box(x-3,65,z-3,x+3,65,z+3,'water');box(x,66,z,x,68,z,'water');for(const xx of [x-12,x+12]) for(const zz of [z-14,z+14]) {box(xx,64,zz,xx+2,64,zz+2,'moss_block');box(xx+1,65,zz+1,xx+1,66,zz+1,'azalea_leaves[persistent=true]');}for(const xx of [x-12,x+12]) lamp(xx,z);}
function parkingLot(x,z) {box(x-16,63,z-21,x+16,63,z+21,'gray_concrete');for(let zz=z-17;zz<=z+17;zz+=8) {box(x-14,63,zz,x-5,63,zz,'white_concrete');box(x+5,63,zz,x+14,63,zz,'white_concrete');}for(let zz=z-15;zz<=z+15;zz+=16) cityCar(x-10,zz,zz%3?'blue_concrete':'red_concrete');lamp(x+14,z-17);lamp(x+14,z+17);}
function city() {
  for(const p of [-980,-780,-600,600,780,980]) {road(-995,p-10,995,p+10,true);road(p-10,-995,p+10,995,false);}
  road(-980,632,980,668,true);
  for(const z of [-420,-240,0,240,420]) {localStreet(-995,z-4,-600,z+4,true);localStreet(600,z-4,995,z+4,true);}
  for(const x of [-450,-330,-210,-100,0,100,210,330,450]) {localStreet(x-4,-995,x+4,-600,false);localStreet(x-4,600,x+4,995,false);}
  let n=0;
  for(const x of [-870,-690,690,870]) for(const z of [-870,-690,-510,-330,-150,150,330,510,720,870]) building(x,z,n++);
  for(const z of [-870,-690,720,870]) for(const x of [-510,-390,-270,-150,-50,50,150,270,390,510]) building(x,z,n++);
  pocketSquare(-940,-80);pocketSquare(940,80);
  for(const x of [-940,940]) {parkingLot(x,-330);parkingLot(x,330);}
  pocketSquare(-560,-940);pocketSquare(560,940);
  for(const x of [-580,580]) busStop(x,700);
  for(const x of [-780,780]) for(const z of [-505,-325,-145,145,325,505]) parkVehicle(x,z,false,['red_concrete','green_concrete','lime_concrete'][Math.abs(z)%3]);
  for(let x=-900;x<=900;x+=48) for(const z of [-620,620]) if(Math.abs(x)>100) tree(x,z);
  for(let z=-900;z<=900;z+=48) for(const x of [-620,620]) tree(x,z);
  landmark('city-station','城市中央车站',0,65,650);
}
function outerFence() {
  for(const z of [-592,592]) { box(-592,64,z,592,65,z,'stone_bricks'); box(-592,66,z,592,72,z,'iron_bars'); for(let x=-592;x<=592;x+=32) box(x,64,z,x+1,74,z,'polished_andesite'); }
  for(const x of [-592,592]) { box(x,64,-592,x,65,592,'stone_bricks'); box(x,66,-592,x,72,592,'iron_bars'); for(let z=-592;z<=592;z+=32) box(x,64,z,x+1,74,z+1,'polished_andesite'); }
  box(-22,64,591,22,77,594,'air');
}
const gateLetters={
  J:['111','001','001','101','111'],U:['101','101','101','101','111'],R:['110','101','110','101','101'],
  A:['010','101','111','101','101'],S:['111','100','111','001','111'],I:['111','010','010','010','111'],
  C:['111','100','100','100','111'],P:['110','101','110','100','100'],K:['101','101','110','101','101']
};
function gateText(word,x,y,z) {
  const start=x-Math.floor((word.length*4-1)/2);
  for(let i=0;i<word.length;i++) for(let row=0;row<5;row++) for(let col=0;col<3;col++) {
    if(gateLetters[word[i]][row][col]!=='1') continue;
    const xx=start+i*4+col,yy=y+4-row;
    box(xx-1,yy,z,xx+1,yy,z,'yellow_concrete');
    box(xx,yy-1,z,xx,yy+1,z,'yellow_concrete');
    box(xx,yy,z+1,xx,yy,z+1,'red_concrete');
  }
}
function gate(x,z) {
  for(const side of [-1,1]) {
    const cx=x+side*25;
    box(cx-7,64,z-6,cx+7,112,z+6,'mossy_stone_bricks');
    box(cx-9,113,z-8,cx+9,114,z+8,'polished_andesite');
    for(const yy of [75,86,99,115]) {
      box(cx-2,yy,z+7,cx+2,yy,z+8,'netherrack');
      box(cx-1,yy+1,z+8,cx+1,yy+1,z+8,'fire');
    }
  }
  for(const side of [-1,1]) {
    for(let offset=0;offset<9;offset++) {
      const xx=x+side*(8+offset);
      box(xx,64,z+3-side*offset,xx,86,z+4-side*offset,'dark_oak_planks');
      box(xx,70,z+5-side*offset,xx,71,z+5-side*offset,'stripped_dark_oak_log[axis=x]');
    }
  }
  box(x-22,87,z-4,x+22,103,z+4,'black_concrete');
  for(let step=0;step<5;step++) box(x-22+step,104+step,z-4,x+22-step,104+step,z+4,'black_concrete');
  box(x-8,109,z-4,x+8,110,z+4,'black_concrete');
  gateText('JURASSIC',x,96,z+5);gateText('PARK',x,88,z+5);
  landmark('park-gate','侏罗纪公园大门',x,65,z);
}
function plaza(x1,z1,x2,z2) { box(x1,63,z1,x2,63,z2,'stone_bricks'); box(x1+2,63,z1+2,x2-2,63,z2-2,'smooth_stone'); for(let x=x1+8;x<x2;x+=12) for(let z=z1+8;z<z2;z+=12) box(x,63,z,x+1,63,z+1,'polished_andesite'); }
function station(x,z,small=false) { const h=small?24:44; plaza(x-h-8,z-15,x+h+8,z+21); box(x-h,64,z+3,x+h,64,z+14,'polished_andesite'); for(let p=x-h;p<=x+h;p+=11) {box(p,65,z-7,p,75,z-7,'dark_oak_log');box(p,65,z+14,p,75,z+14,'dark_oak_log');} box(x-h-2,76,z-9,x+h+2,76,z+16,'dark_prismarine'); const signBoard=box(x-4,71,z+14,x+4,75,z+14,'dark_oak_planks'); if(current===full) polishExtras.push(signBoard); sign(x-2,73,z+15,['JURASSIC EXPRESS','侏罗纪观光列车','7 MIN LOOP']); landmark('station','观光车站',x,65,z+5); }
function thatchRoof(x,z,r,base,height) {
  for(let y=0;y<=height;y++) {
    const radius=Math.max(2,Math.floor(r*(1-y/(height+2))));
    for(let dz=-radius;dz<=radius;dz++) {
      const span=Math.floor(Math.sqrt(radius*radius-dz*dz));
      box(x-span,base+y,z+dz,x+span,base+y,z+dz,y%3===0?'mud_bricks':'packed_mud');
    }
  }
  // The raised vent cap is open on four sides, as on the original building.
  box(x-4,base+height+1,z-4,x+4,base+height+1,z+4,'dark_oak_planks');
  for(const xx of [x-4,x+4]) for(const zz of [z-4,z+4]) box(xx,base+height+2,zz,xx,base+height+4,zz,'smooth_stone');
  box(x-3,base+height+2,z-4,x+3,base+height+3,z-4,'air');
  box(x-4,base+height+2,z-3,x-4,base+height+3,z+3,'air');
  box(x-3,base+height+5,z-3,x+3,base+height+5,z+3,'packed_mud');
  box(x-1,base+height+6,z-1,x+1,base+height+6,z+1,'mud_bricks');
}
function visitor() {
  const z=440;plaza(-72,370,72,515);
  const span=(r,d)=>Math.floor(Math.sqrt(r*r-d*d));
  for(const side of [-1,1]) {
    const x1=side<0?-62:23,x2=side<0?-23:62;
    box(x1,64,407,x2,82,465,'light_gray_concrete');
    box(x1+3,65,410,x2-3,80,462,'air');
    const outerX=side*62,trimX=side*63;
    box(trimX,64,407,trimX,65,465,'polished_andesite');
    box(trimX,80,407,trimX,81,465,'smooth_stone');
    for(const zz of [413,425,437,449]) {
      box(Math.min(outerX,outerX-side*2),68,zz+1,Math.max(outerX,outerX-side*2),74,zz+6,'air');
      box(outerX-side,68,zz+1,outerX-side,74,zz+6,'gray_stained_glass');
      box(trimX,67,zz,trimX,67,zz+7,'smooth_stone');
      box(trimX,75,zz,trimX,75,zz+7,'smooth_stone');
    }
    for(const zz of [408,420,432,444,456,464]) box(trimX,65,zz,trimX,79,zz,'polished_andesite');
    for(let x=x1+5;x<x2-4;x+=8) {
      box(x,68,465,x+4,74,465,'gray_stained_glass');
      box(x-1,65,466,x-1,80,466,'smooth_stone');
    }
    for(let s=0;s<4;s++) box(x1+s,83+s,407+s,x2-s,83+s,465-s,'light_gray_concrete');
    box(x1-2,65,465,x2+2,65,471,'smooth_stone');
    for(let x=x1;x<=x2;x+=9) box(x,66,471,x,77,471,'smooth_stone');
    box(x1-2,78,465,x2+2,78,472,'smooth_stone');
  }
  for(let dz=-34;dz<=34;dz++) box(-span(34,dz),64,z+dz,span(34,dz),82,z+dz,'light_gray_concrete');
  for(let dz=-31;dz<=31;dz++) box(-span(31,dz),65,z+dz,span(31,dz),81,z+dz,'air');
  for(let x=-25;x<=25;x+=10) {
    box(x,67,z+32,x+5,75,z+32,'gray_stained_glass');
    box(x-1,65,z+33,x-1,81,z+33,'smooth_stone');
  }
  thatchRoof(0,z,35,83,13);
  thatchRoof(-39,424,15,87,9);thatchRoof(39,424,15,87,9);
  box(-8,65,472,8,81,480,'chiseled_stone_bricks');
  box(-6,66,473,6,77,481,'air');
  for(const xx of [-8,8]) {box(xx,65,481,xx,81,481,'chiseled_stone_bricks');box(xx,72,482,xx,77,482,'bone_block[axis=y]');}
  box(-9,82,471,9,84,482,'smooth_stone');
  box(-2,83,483,2,83,483,'bone_block[axis=x]');
  box(-6,65,479,-1,68,479,'dark_oak_planks');box(1,65,479,6,68,479,'dark_oak_planks');
  box(-5,66,480,-2,68,480,'dark_oak_fence');box(2,66,480,5,68,480,'dark_oak_fence');
  box(-6,65,481,6,72,484,'air');
  for(let step=0;step<5;step++) box(-11,64+step,485-step,11,64+step,486-step,'smooth_stone');
  for(const side of [-1,1]) {
    const x1=side<0?-44:15,x2=side<0?-15:44;
    box(x1,65,476,x2,69,487,'light_gray_concrete');
    box(x1+2,70,477,x2-2,70,486,'moss_block');
    for(let x=x1+4;x<x2-2;x+=7) box(x,71,480,x+2,72,482,'jungle_leaves[persistent=true]');
  }
  box(-19,63,502,19,63,511,'clay');
  box(-19,64,502,19,64,502,'smooth_stone');box(-19,64,511,19,64,511,'smooth_stone');
  box(-19,64,503,-19,64,510,'smooth_stone');box(19,64,503,19,64,510,'smooth_stone');
  box(-18,64,503,18,64,510,'water');
  for(const x of [-60,60]) {box(x,64,484,x+2,64,487,'moss_block');box(x+1,65,485,x+1,69,485,'jungle_log');box(x-2,69,482,x+4,71,488,'jungle_leaves[persistent=true]');}
  box(-13,64,z-26,13,64,z+24,'polished_andesite');
  box(-11,65,z-24,11,65,z+24,'smooth_stone');
  for(const zz of [z-24,z+24]) for(const x of [-16,16]) box(x,65,zz,x,69,zz,'sea_lantern');
  for(let zz=z-18;zz<=z+17;zz+=5) {
    box(0,70,zz,0,70,zz+4,'bone_block[axis=z]');
    for(const x of [-5,5]) { box(x,65,zz,x,69,zz,'bone_block[axis=y]'); box(x,69,zz,x,70,zz,'bone_block[axis=y]'); }
    box(-5,70,zz,5,70,zz,'bone_block[axis=x]');
  }
  box(0,69,z-22,0,74,z-22,'bone_block[axis=y]');
  box(-4,74,z-23,4,74,z-23,'bone_block[axis=x]');
  for(const x of [-32,32]) { box(x-3,65,z+20,x+3,65,z+27,'dark_oak_planks'); box(x-3,66,z+20,x+3,66,z+20,'dark_oak_stairs[facing=south]'); box(x-3,66,z+27,x+3,66,z+27,'dark_oak_stairs[facing=north]'); }
  box(-5,75,480,5,79,480,'polished_andesite');
  sign(-2,77,481,['游客中心','化石骨架展厅','VISITOR CENTRE']);
  const fixStart=current.operations.length;
  box(-2,65,471,2,74,471,'air');
  box(-2,66,472,2,74,472,'air');
  box(-2,65,479,2,68,479,'air');
  box(-2,66,480,2,68,480,'air');
  box(-2,65,479,2,66,479,'smooth_stone');
  box(-2,66,480,2,67,480,'smooth_stone');
  if(current===full) visitorFixOps.push(...current.operations.slice(fixStart));
  parkVehicle(-55,497,true,'red_concrete');parkVehicle(55,497,false,'green_concrete');
  markBuilding('visitor-centre','游客中心',-62,64,407,62,106,484,true);
  landmark('visitor-centre','游客中心',0,70,489);
}
function facility(x,z,id,name,wall='white_concrete') {
  box(x-32,64,z-21,x+32,79,z+21,wall);
  box(x-30,65,z-19,x+30,78,z+19,'air');
  box(x-32,68,z+21,x-5,74,z+21,'light_blue_stained_glass');
  box(x+5,68,z+21,x+32,74,z+21,'light_blue_stained_glass');
  box(x-3,65,z+20,x+3,69,z+22,'air');
  box(x-24,80,z-14,x+24,80,z+14,'glass');
  box(x-23,81,z-13,x+23,82,z+13,'waxed_copper_block');
  for(const xx of [x-25,x+25]) for(const zz of [z-14,z+14]) box(xx,65,zz,xx,77,zz,'polished_andesite');
  for(const xx of [x-20,x,x+20]) for(const zz of [z-10,z+10]) box(xx,76,zz,xx,76,zz,'sea_lantern');
  for(const xx of [x-19,x+13]) { box(xx,65,z-4,xx+6,65,z+4,'dark_oak_planks'); box(xx,66,z-4,xx+6,66,z-4,'dark_oak_stairs[facing=south]'); }
  box(x-4,65,z-8,x+4,65,z-5,'polished_andesite');
  box(x-3,66,z-7,x+3,66,z-7,'glass');
  box(x-3,75,z+22,x+3,78,z+22,'polished_andesite');
  sign(x-2,76,z+23,[name,id.toUpperCase()]);
  markBuilding(id,name,x-32,64,z-21,x+32,82,z+21,true);
  landmark(id,name,x,66,z+28);
}
function pond(x,z,rx,rz) { for(let dz=-rz;dz<=rz;dz++) { const span=Math.max(1,Math.floor(rx*Math.sqrt(1-(dz/rz)**2))); box(x-span-2,62,z+dz,x+span+2,63,z+dz,'sand'); box(x-span,62,z+dz,x+span,62,z+dz,'clay'); box(x-span,63,z+dz,x+span,63,z+dz,'water'); } hazard(x-rx-4,z-rz-4,x+rx+4,z+rz+4); }
function hill(x,z,rx,rz,h) {
  for(let dz=-rz;dz<=rz;dz++) for(let dx=-rx;dx<=rx;dx++) {
    const xx=Math.round(x+dx),zz=Math.round(z+dz);
    const radial=(dx/rx)**2+(dz/rz)**2;
    const edge=1+0.07*Math.sin(xx*0.37)+0.05*Math.cos(zz*0.43)+0.03*Math.sin((xx+zz)*0.21);
    if(radial>=edge) continue;
    const height=Math.max(1,Math.floor(h*Math.sqrt(Math.max(0,1-radial/edge))));
    const top=63+height;
    const rock=(xx*13+zz*7)%5===0?'andesite':'stone';
    if(height>2) box(xx,64,zz,xx,top-2,zz,rock);
    if(height>1) box(xx,top-1,zz,xx,top-1,zz,(xx+zz)%3===0?'mossy_cobblestone':rock);
    box(xx,top,zz,xx,top,zz,radial<0.62?'grass_block':'mossy_cobblestone');
  }
  hazard(Math.floor(x-rx-4),Math.floor(z-rz-4),Math.ceil(x+rx+4),Math.ceil(z+rz+4));
}

const habitats=[
  ['triceratops','三角龙草原',-560,250,-375,520,10,'meadow'],['parasaurolophus','副栉龙溪谷',-325,170,-100,365,10,'meadow'],['brachiosaurus','腕龙巨树森林',-560,-300,-375,135,6,'forest'],['stegosaurus','剑龙湖岸',-290,-560,-80,-375,8,'lake'],['ankylosaurus','甲龙岩石谷',80,-560,290,-375,8,'rocks'],['velociraptor','迅猛龙隔离区',100,-300,325,-70,8,'carnivore'],['dilophosaurus','双脊龙湿地',375,-30,560,195,8,'wetland'],['tyrannosaurus','霸王龙王国',100,225,325,500,6,'carnivore']
];
const railsideSpawns={
  triceratops:[[-402,285],[-402,315],[-402,345],[-402,375]],
  parasaurolophus:[[-305,230],[-305,245],[-305,300],[-305,325]],
  brachiosaurus:[[-400,-240],[-400,-205],[-400,-170],[-400,-135]],
  stegosaurus:[[-245,-398],[-180,-398],[-155,-398],[-105,-398]],
  ankylosaurus:[[135,-395],[180,-390],[225,-390],[265,-390]],
  velociraptor:[[300,-260],[300,-225],[300,-190],[300,-120]],
  dilophosaurus:[[400,70],[400,85],[400,120],[400,155]],
  tyrannosaurus:[[300,250],[300,285],[300,320]]
};
let entityDefinitions = new Map();
try { for (const entry of JSON.parse(await readFile('modpack/entities.json','utf8'))) entityDefinitions.set(entry.id, entry.nbt); } catch {}
function snbtValue(value) {
  if (typeof value === 'boolean') return value ? '1b' : '0b';
  if (typeof value === 'number') return Number.isInteger(value) ? `${value}` : `${value}d`;
  if (Array.isArray(value)) return `[${value.map(snbtValue).join(',')}]`;
  return JSON.stringify(String(value));
}
function adultNbtFor(id) {
  const base = entityDefinitions.get(`jurassicreborn:${id}`) || {};
  const values = { ...base, PersistenceRequired: true, Invulnerable: true, NoAI: false, Tags: ['jurassic_park'] };
  return `{${Object.entries(values).map(([key,value]) => `${key}:${snbtValue(value)}`).join(',')}}`;
}
function habitat(h) {
  const [id,name,x1,z1,x2,z2,count,type]=h;
  spawnHazards=[];
  for(const z of [z1,z2]) {box(x1,64,z,x2,65,z,'reinforced_deepslate');box(x1,66,z,x2,73,z,'iron_bars');}
  for(const x of [x1,x2]) {box(x,64,z1,x,65,z2,'reinforced_deepslate');box(x,66,z1,x,73,z2,'iron_bars');}
  for(let x=x1;x<=x2;x+=18) {box(x,64,z1,x+1,75,z1,'polished_andesite');box(x,64,z2,x+1,75,z2,'polished_andesite');}
  for(let z=z1;z<=z2;z+=18) {box(x1,64,z,x1+1,75,z+1,'polished_andesite');box(x2,64,z,x2+1,75,z+1,'polished_andesite');}
  pond(x1+38,z1+40,20,13);
  const trees=type==='forest'?30:type==='wetland'?14:type==='carnivore'?8:5;
  for(let i=0;i<trees;i++) tree(int(x1+12,x2-12),int(z1+12,z2-12),type==='forest');
  if(type==='rocks'||type==='carnivore') {hill((x1+x2)/2-30,(z1+z2)/2-35,18,12,9);hill((x1+x2)/2+42,(z1+z2)/2+50,14,19,7);}
  if(type==='wetland'||type==='lake') pond((x1+x2)/2+15,(z1+z2)/2+12,35,24);
  box(x1+12,64,z2-32,x1+36,64,z2-12,'hay_block'); hazard(x1+8,z2-36,x1+40,z2-8);
  box(x1+18,73,z1-1,x1+23,76,z1-1,'polished_andesite');
  sign(x1+20,74,z1,[name,id.toUpperCase()]);
  const spawns=[],spacing=id==='brachiosaurus'?14:9;
  for(let i=0;i<count;i++) {
    let x,z,valid=false;
    for(let attempt=0;attempt<3000;attempt++) {
      x=int(x1+20,x2-20);z=int(z1+20,z2-20);
      valid=!spawnHazards.some(h=>x>=h.x1&&x<=h.x2&&z>=h.z1&&z<=h.z2)&&spawns.every(p=>Math.abs(p.x-x)+Math.abs(p.z-z)>=spacing);
      if(valid) break;
    }
    if(!valid) throw new Error(`No clear spawn location for ${id} ${i+1}/${count}`);
    current.operations.push({kind:'spawn',entity:`jurassicreborn:${id}`,x:x+0.5,y:65,z:z+0.5,yaw:int(0,359),nbt:adultNbtFor(id)});
    spawns.push({x,y:65,z});
  }
  spawnHazards=null;
  current.metadata.enclosures.push({id,name,bounds:b(x1,64,z1,x2,75,z2),species:[`jurassicreborn:${id}`],count,spawns});
  current.metadata.expectedDinosaurCount+=count;
  landmark(id,name,Math.floor((x1+x2)/2),68,Math.floor((z1+z2)/2));
}

function pathPoints(x1,z1,x2,z2,heightFn) {
  const raw=[];
  const add=(x,z)=>{ if(raw.at(-1)?.x===x && raw.at(-1)?.z===z) return; raw.push({x,y:heightFn(x,z),z}); };
  const segment=(ax,az,bx,bz)=>{const dx=Math.sign(bx-ax),dz=Math.sign(bz-az);let x=ax,z=az;while(x!==bx||z!==bz){add(x,z);x+=dx;z+=dz;}add(bx,bz);};
  segment(0,z2,x1,z2);segment(x1,z2,x1,z1);segment(x1,z1,x2,z1);segment(x2,z1,x2,z2);segment(x2,z2,0,z2);
  return raw.slice(0,-1);
}
function direction(a,b) { return b.x>a.x?'east':b.x<a.x?'west':b.z>a.z?'south':'north'; }
function shapeAt(raw,i) {
  const p=raw[i],prev=raw[(i+raw.length-1)%raw.length],next=raw[(i+1)%raw.length];
  // Only the lower end of each sloped rail declares ascending_*. The high
  // endpoint remains a straight rail so Minecraft can connect it to level track.
  if(p.y<prev.y) return `ascending_${direction(p,prev)}`;
  if(p.y<next.y) return `ascending_${direction(p,next)}`;
  const a=direction(p,prev), bdir=direction(p,next);
  if((a==='east'&&bdir==='west')||(a==='west'&&bdir==='east')) return 'east_west';
  if((a==='north'&&bdir==='south')||(a==='south'&&bdir==='north')) return 'north_south';
  const joined=[a,bdir].sort().join('_');
  return {east_north:'north_east',east_south:'south_east',north_west:'north_west',south_west:'south_west'}[joined];
}
function routeHeight(x,z) {
  if(x===-350 && z>=-320 && z<=120) return 64+Math.min(16,Math.floor((120-z)/3),Math.floor((z+320)/3));
  if(z===-350 && x>=-220 && x<=220) return 64+Math.min(12,Math.floor((x+220)/3),Math.floor((220-x)/3));
  if(x===350 && z>=0 && z<=144) return 64+Math.min(18,Math.floor(z/3),Math.floor((144-z)/3));
  return 64;
}
function makeRoute(x1,z1,x2,z2,heightFn,name) {
  const raw=pathPoints(x1,z1,x2,z2,heightFn);
  const points=raw.map((p,i)=>{const shape=shapeAt(raw,i); if(!shape) throw new Error(`Unable to derive rail shape at ${p.x},${p.y},${p.z}`); return {...p,shape,powered:(shape==='east_west'||shape==='north_south'||shape.startsWith('ascending_'))&&i%8<4,zone:''};});
  return {name,length:points.length,station:{x:0,y:heightFn(0,z2),z:z2},points,zones:[]};
}
function putTrack(route) {
  route.zones=current.metadata.enclosures.map(e=>({id:e.id,name:e.name,bounds:{x1:e.bounds.x1,z1:e.bounds.z1,x2:e.bounds.x2,z2:e.bounds.z2},minVisibleDinosaurs:2,species:e.species}));
  // Clear carriageway first. This prevents a later point's 3x3 clearance box
  // from deleting the support or redstone block of an earlier point.
  for(const p of route.points) box(p.x-1,p.y,p.z-1,p.x+1,p.y+5,p.z+1,'air');
  for(let i=0;i<route.points.length;i++) {
    const p=route.points[i];
    let best=route.zones[0],distance=Infinity;
    for(const z of route.zones) {const d=Math.max(z.bounds.x1-p.x,0,p.x-z.bounds.x2)+Math.max(z.bounds.z1-p.z,0,p.z-z.bounds.z2);if(d<distance){distance=d;best=z;}}
    p.zone=best?.id||'city';
    box(p.x,p.y-2,p.z,p.x,p.y-1,p.z,'stone_bricks');
    if(p.y>68 && i%12===0) polishExtras.push(box(p.x,64,p.z,p.x,p.y-3,p.z,'polished_andesite'));
    if(p.powered) box(p.x,p.y-1,p.z,p.x,p.y-1,p.z,'redstone_block');
  }
  for(const p of route.points) box(p.x,p.y,p.z,p.x,p.y,p.z,`${p.powered?'powered_rail':'rail'}[shape=${p.shape}${p.powered?',powered=true':''}]`);
  current.metadata.routeLength=route.length;
}
function controls(x,z) {
  const boardX=x-10,buttonZ=z+9,commandZ=z+8;
  const nearButton=`@p[x=${boardX},y=65,z=${buttonZ},distance=..5]`;
  const nearTrack=`@e[type=minecraft:minecart,tag=park_boarding,sort=nearest,limit=1,distance=..4]`;
  const boardingCommands=[
    `execute positioned ${x} 65 ${z} run kill @e[type=minecraft:minecart,tag=park_ride,distance=..5,nbt=!{Passengers:[{}]}]`,
    `execute if entity ${nearButton} run summon minecraft:minecart ${x+0.5} 64.2 ${z+0.5} {Tags:["park_ride","park_boarding"]}`,
    `execute positioned ${x} 65 ${z} run ride ${nearButton} mount ${nearTrack}`,
    `execute positioned ${x} 65 ${z} run data merge entity ${nearTrack} {Motion:[-0.28d,0.0d,0.0d]}`,
    `execute positioned ${x} 65 ${z} run tag ${nearTrack} remove park_boarding`
  ];
  for(let i=0;i<boardingCommands.length;i++) {
    const kind=i===0?'command_block':'chain_command_block';
    const state=`facing=north${i>=2?',conditional=true':''}`;
    command(`setblock ${boardX} 65 ${commandZ-i} minecraft:${kind}[${state}]{Command:${JSON.stringify(boardingCommands[i])},auto:${i===0?'0b':'1b'}} replace`);
  }
  box(boardX,65,buttonZ,boardX,65,buttonZ,'stone_button[face=wall,facing=south]');
  sign(boardX-1,68,z+10,['乘车发车','JURASSIC EXPRESS']);
  box(x-18,64,z+2,x+18,64,z+4,'smooth_stone');
  const buttons=[
    {dx:10,label:['创造模式','CREATIVE'],cmd:'gamemode creative @p[distance=..8]'},
    {dx:20,label:['冒险模式','ADVENTURE'],cmd:'gamemode adventure @p[distance=..8]'}
  ];
  for(const control of buttons) {
    const xx=x+control.dx;
    box(xx,64,z+8,xx,64,z+8,'polished_andesite');
    command(`setblock ${xx} 65 ${z+8} minecraft:command_block[facing=south]{Command:${JSON.stringify(control.cmd)},auto:0b} replace`);
    box(xx,65,z+9,xx,65,z+9,'stone_button[face=wall,facing=south]');
    sign(xx-1,68,z+10,control.label);
  }
  command(`setworldspawn ${x} 65 ${z+7}`); command(`spawnpoint @a ${x} 65 ${z+7}`);
}
function tunnel() {
  const x1=-155,x2=-85,z=-350;
  for(const side of [-4,4]) box(x1,64,z+side,x2,81,z+side,'deepslate_bricks');
  box(x1,82,z-4,x2,82,z+4,'deepslate_tiles');
  box(x1,83,z-4,x2,83,z+4,'mossy_stone_bricks');
  for(let x=x1+6;x<x2;x+=12) {
    box(x,79,z-4,x+1,80,z-4,'sea_lantern');
    box(x,79,z+4,x+1,80,z+4,'sea_lantern');
  }
  for(const x of [x1,x2]) {
    box(x,76,z-4,x,82,z-3,'polished_andesite');
    box(x,76,z+3,x,82,z+4,'polished_andesite');
  }
  landmark('north-tunnel','高架观景隧道',-120,78,z);
}
function centralLandscape() { box(-5,63,-580,5,63,590,'smooth_stone'); box(-580,63,-5,580,63,5,'smooth_stone'); pond(-20,100,28,45); pond(-20,-170,16,10); for(let z=-550;z<570;z+=50){lamp(-18,z);lamp(18,z);} facility(0,-470,'hatchery','孵化实验室'); facility(0,270,'control','公园控制中心','light_gray_concrete'); facility(500,500,'maintenance','后勤维修站','bricks'); landmark('waterfall','中央瀑布',-20,70,-145); }

current=full; commonRules(); city(); addCityDetails(full); outerFence(); gate(0,570); visitor(); centralLandscape(); station(0,650);
for(const h of habitats) habitat(h);
addParkDetails(full);
// Keep the original spawn positions through detail generation so existing vegetation stays put.
for(const enclosure of full.metadata.enclosures) {
  const sites=railsideSpawns[enclosure.id];
  const spawnOps=full.operations.filter(o=>o.kind==='spawn'&&o.entity===enclosure.species[0]);
  for(let i=0;i<sites.length;i++) {
    const [x,z]=sites[i];
    enclosure.spawns[i]={x,y:65,z};
    spawnOps[i].x=x+0.5;spawnOps[i].z=z+0.5;
    railsideClearanceOps.push(box(x-2,64,z-2,x+2,80,z+2,'air'));
  }
}
const route=makeRoute(-350,-350,350,650,routeHeight,'Jurassic Express'); putTrack(route); full.route=route;
const tunnelStart=full.operations.length; tunnel(); polishExtras.push(...full.operations.slice(tunnelStart));
const controlsStart=full.operations.length; controls(0,650); polishExtras.push(...full.operations.slice(controlsStart));
landmark('park-overlook','公园鸟瞰',0,180,100);
addInteriorLighting(full);
addCityGroundDetails(full);
addDensityDetails(full);

current=sample; commonRules(); plaza(-124,70,124,124); gate(-60,38); building(-78,-62,0,true); const sampleHabitat=['triceratops','三角龙样板围场',-10,-105,100,8,2,'meadow']; habitat(sampleHabitat); station(0,100,true); const sampleRoute=makeRoute(-115,-115,115,100,()=>64,'Sample Loop'); putTrack(sampleRoute); sample.route=sampleRoute; controls(0,100); landmark('sample-overlook','样板鸟瞰',0,115,0);

function finalBlockAt(operations,x,y,z) {
  for(let i=operations.length-1;i>=0;i--) {
    const o=operations[i];
    if(o.kind==='box'&&x>=o.x1&&x<=o.x2&&y>=o.y1&&y<=o.y2&&z>=o.z1&&z<=o.z2) return o.block;
  }
  return null;
}
for(const building of full.metadata.buildings) {
  const {x1,y2,z1,x2,z2}=building.bounds;
  const cx=Math.floor((x1+x2)/2),cz=Math.floor((z1+z2)/2);
  let roof=null,wall=null;
  for(const [x,z] of [[cx,cz],[x1+9,cz],[x2-9,cz],[cx,z1+9]]) {
    for(let y=y2;y>=70;y--) {
      const block=finalBlockAt(full.operations,x,y,z);
      if(block&&block!=='minecraft:air'&&!/leaves|lantern/.test(block)) {
        if(!roof||y>roof.y) roof={x,y,z,block};
        break;
      }
    }
  }
  for(const [x,z] of [[x1,z1],[x2,z1],[x1+1,z1+1],[x2-1,z1+1],[x1+1,z2-1],[x2-1,z2-1]]) {
    for(const y of [67,70,73]) {
      const block=finalBlockAt(full.operations,x,y,z);
      if(block&&/concrete|terracotta|bricks|stone|andesite/.test(block)) {wall={x,y,z,block};break;}
    }
    if(wall) break;
  }
  if(!roof||!wall) throw new Error(`Missing roof/wall verification target for ${building.id}`);
  building.verify={roof,wall};
}

const polish=plan('Jurassic City Park Polish',full.bounds);
polish.metadata={...full.metadata,polishFor:'full',removesSample:true};
current=polish;
function rebuildRegion({x1,z1,x2,z2,y1=64,y2=110},resetGround=false) {
  box(x1,y1,z1,x2,y2,z2,'air');
  if(resetGround) box(x1,63,z1,x2,63,z2,'grass_block');
  for(const op of full.operations) {
    if(op.kind==='box') {
      const a={x1:Math.max(x1,op.x1),y1:Math.max(resetGround?63:y1,op.y1),z1:Math.max(z1,op.z1),x2:Math.min(x2,op.x2),y2:Math.min(y2,op.y2),z2:Math.min(z2,op.z2)};
      if(a.x1<=a.x2&&a.y1<=a.y2&&a.z1<=a.z2) polish.operations.push({...op,...a});
    } else if(op.kind==='sign'&&op.x>=x1&&op.x<=x2&&op.y>=y1&&op.y<=y2&&op.z>=z1&&op.z<=z2) polish.operations.push(op);
  }
}
// Remove mobile entities before dismantling the sample fences and rails.
polish.operations.push({kind:'removeEntities',region:b(-128,60,-128,128,140,128),tag:'jurassic_park',entity:'jurassicreborn'});
polish.operations.push({kind:'removeEntities',region:b(-128,60,-128,128,140,128),tag:'park_ride',entity:'minecraft:minecart'});
rebuildRegion({x1:-128,z1:-128,x2:128,z2:128},true);
rebuildRegion({x1:-72,z1:370,x2:72,z2:515,y2:112});
for(const [x,z] of [[0,-470],[0,270],[500,500]]) rebuildRegion({x1:x-34,z1:z-23,x2:x+34,z2:z+23,y2:85});
polish.operations.push(...polishExtras);
polish.operations.push(...railsideClearanceOps);
// The builder loads each covered chunk before removal, so unloaded dinosaurs cannot survive a replay.
for(const enclosure of full.metadata.enclosures) {
  const e=enclosure.bounds;
  // Clear every Jurassic Reborn entity in the enclosure before replaying the
  // authoritative 64-spawn set. Existing animals may have lost the builder
  // tag after moving, so namespace matching must be the source of truth.
  polish.operations.push({kind:'removeEntities',region:b(e.x1,60,e.z1,e.x2,140,e.z2),entity:'jurassicreborn'});
}
for(const op of full.operations) if(op.kind==='spawn'&&op.entity.startsWith('jurassicreborn:')) polish.operations.push(op);
polish.route=route;

const finalFix=plan('Jurassic City Park Final Fixes',full.bounds);
finalFix.metadata={sourcePlan:'full',expectedDinosaurCount:full.metadata.expectedDinosaurCount};
current=finalFix;
finalFix.operations.push(...visitorFixOps);
for(const [x,z] of [[-940,-80],[940,80],[-560,-940],[560,940]]) {
  fountainContainment(x,z);
  const overflow=[
    [x-17,z-20,x+17,z-5],[x-17,z+5,x+17,z+20],
    [x-17,z-4,x-5,z+4],[x+5,z-4,x+17,z+4]
  ];
  for(const [x1,z1,x2,z2] of overflow)
    finalFix.operations.push({...b(x1,64,z1,x2,68,z2),kind:'box',block:'minecraft:air',replace:'minecraft:water'});
}
finalFix.operations.push(...railsideClearanceOps);
for(const enclosure of full.metadata.enclosures) {
  const e=enclosure.bounds;
  finalFix.operations.push({kind:'removeEntities',region:b(e.x1,60,e.z1,e.x2,140,e.z2),tag:'jurassic_park',entity:'jurassicreborn'});
}
for(const op of full.operations) if(op.kind==='spawn'&&op.entity.startsWith('jurassicreborn:')) finalFix.operations.push(op);

for(const [name,value] of [['full',full],['sample',sample],['route',route],['route-sample',sampleRoute],['polish',polish],['final-fixes',finalFix]]) await writeFile(path.join(out,`${name}.json`),JSON.stringify(value));
await writeFile(path.join(out,'summary.json'),JSON.stringify({seed:246813579,buildings:full.metadata.buildings.length,enclosures:full.metadata.enclosures.length,dinosaurs:full.metadata.expectedDinosaurCount,railLength:route.length,estimatedRideSeconds:Math.round(route.length/8),operations:full.operations.length,sampleOperations:sample.operations.length},null,2));
console.log(JSON.stringify({buildings:full.metadata.buildings.length,enclosures:full.metadata.enclosures.length,dinosaurs:full.metadata.expectedDinosaurCount,railLength:route.length,operations:full.operations.length,sampleOperations:sample.operations.length},null,2));

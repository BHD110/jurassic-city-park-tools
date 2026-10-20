import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async name => JSON.parse(await readFile(path.join(root, 'map/generated', name), 'utf8'));
const full = await read('full.json');
const variation = await read('city-variation-details.json');
const ground = await read('city-ground-patch.json');
const routePatch = await read('city-coaster-route.json');
const sample = process.argv.includes('--sample');
const sample12 = process.argv.includes('--sample12');
const main = full.metadata.buildings.filter(b => /^city-\d\d$/.test(b.id));
const selected = sample ? main.slice(0, 3) : sample12 ? main.slice(0, 12) : main;
const ops = [];
const manifest = [];
const corridor=[];
const points=routePatch.route?.points ?? routePatch.points;
if(!points?.length) throw Error('coaster route points missing');
for(let i=0;i<points.length-1;i++) {
  const a=points[i],b=points[i+1];
  corridor.push({x1:Math.min(a.x,b.x)-4,z1:Math.min(a.z,b.z)-4,x2:Math.max(a.x,b.x)+4,z2:Math.max(a.z,b.z)+4});
}
const block = value => value.includes(':') ? value : `minecraft:${value}`;
const rect = (x1, z1, x2, z2) => ({ x1, z1, x2, z2 });
const hit = (a, b, pad = 0) => a.x1 <= b.x2 + pad && a.x2 >= b.x1 - pad && a.z1 <= b.z2 + pad && a.z2 >= b.z1 - pad;
function box(x1, y1, z1, x2, y2, z2, value) {
  if (![x1,y1,z1,x2,y2,z2].every(Number.isInteger) || x1 > x2 || y1 > y2 || z1 > z2) throw Error(`bad box ${[x1,y1,z1,x2,y2,z2]}`);
  ops.push({ kind: 'box', x1, y1, z1, x2, y2, z2, block: block(value) });
}
function geometryBounds(start,end=ops.length) {
  const built=ops.slice(start,end).filter(o=>o.kind==='box'&&o.block!=='minecraft:air'&&o.y2>=64);
  if(!built.length) throw Error('building has no constructed geometry');
  return built.reduce((a,o)=>({x1:Math.min(a.x1,o.x1),y1:Math.min(a.y1,o.y1),z1:Math.min(a.z1,o.z1),x2:Math.max(a.x2,o.x2),y2:Math.max(a.y2,o.y2),z2:Math.max(a.z2,o.z2)}),{x1:Infinity,y1:Infinity,z1:Infinity,x2:-Infinity,y2:-Infinity,z2:-Infinity});
}
function sign(x,y,z,lines) { ops.push({ kind:'sign', x,y,z, lines, block:'minecraft:oak_wall_sign[facing=south]' }); }
function clearOld(source, area, maxY) {
  let count = 0;
  for (const op of source) {
    if (op.kind === 'box' && op.block !== 'minecraft:air') {
      const x1=Math.max(area.x1,op.x1), x2=Math.min(area.x2,op.x2);
      const y1=Math.max(64,op.y1), y2=Math.min(maxY,op.y2);
      const z1=Math.max(area.z1,op.z1), z2=Math.min(area.z2,op.z2);
      if (x1<=x2 && y1<=y2 && z1<=z2) { box(x1,y1,z1,x2,y2,z2,'air'); count++; }
    } else if (op.kind === 'sign' && op.x>=area.x1 && op.x<=area.x2 && op.z>=area.z1 && op.z<=area.z2 && op.y>=64 && op.y<=maxY) {
      box(op.x,op.y,op.z,op.x,op.y,op.z,'air'); count++;
    }
  }
  return count;
}
const palettes = [
  {wall:'white_concrete',base:'smooth_sandstone',frame:'dark_oak_log',roof:'bricks',glass:'light_blue_stained_glass'},
  {wall:'light_gray_concrete',base:'stone_bricks',frame:'spruce_log',roof:'red_terracotta',glass:'gray_stained_glass'},
  {wall:'yellow_terracotta',base:'smooth_sandstone',frame:'dark_oak_log',roof:'mud_bricks',glass:'light_blue_stained_glass'},
  {wall:'white_terracotta',base:'polished_andesite',frame:'jungle_log',roof:'dark_prismarine',glass:'cyan_stained_glass'},
];
function floor(r, y, material) { box(r.x1,y,r.z1,r.x2,y,r.z2,material); }
function shell(r, low, high, p, windows = true) {
  floor(r,low,p.base);
  box(r.x1,low+1,r.z1,r.x2,high,r.z2,p.wall);
  box(r.x1+1,low+1,r.z1+1,r.x2-1,high-1,r.z2-1,'air');
  for (const y of [low+4,low+9,low+14,low+19]) if (y < high-2) floor({x1:r.x1+1,z1:r.z1+1,x2:r.x2-1,z2:r.z2-1},y,p.base);
  if (!windows) return;
  for (let y=low+2;y<high-2;y+=5) {
    for (let x=r.x1+4;x<=r.x2-5;x+=7) {
      box(x,y,r.z1,x+2,y+2,r.z1,p.glass); box(x,y,r.z2,x+2,y+2,r.z2,p.glass);
      box(x-1,y-1,r.z2+1,x+3,y-1,r.z2+1,p.frame);
    }
    for (let z=r.z1+4;z<=r.z2-5;z+=8) {
      box(r.x1,y,z,r.x1,y+2,z+2,p.glass); box(r.x2,y,z,r.x2,y+2,z+2,p.glass);
    }
  }
  for(const x of [r.x1,r.x2]) for(const z of [r.z1,r.z2]) box(x,low+1,z,x,high,z,p.frame);
}
function doorway(r, cx, p, width=5) {
  const a=cx-Math.floor(width/2), b=a+width-1;
  box(a,65,r.z2,b,68,r.z2,'air');
  for(const x of [a-1,b+1]) box(x,65,r.z2+1,x,69,r.z2+1,p.frame);
  box(a-1,69,r.z2+1,b+1,69,r.z2+2,p.roof);
  box(a,64,r.z2+1,b,64,r.z2+3,p.base);
}
function porch(r, cx, p, width=15, depth=5) {
  const a=cx-Math.floor(width/2), b=cx+Math.floor(width/2);
  box(a,64,r.z2+1,b,64,r.z2+depth,p.base);
  for(const x of [a,b]) box(x,65,r.z2+depth,x,71,r.z2+depth,p.frame);
  box(a-1,72,r.z2,b+1,72,r.z2+depth+1,p.roof);
  doorway(r,cx,p);
}
function gable(r, y, rise, p, axis='x') {
  const stair={bricks:'brick_stairs',red_terracotta:'brick_stairs',mud_bricks:'mud_brick_stairs',dark_oak_planks:'dark_oak_stairs',dark_prismarine:'dark_prismarine_stairs'}[p.roof]||'spruce_stairs';
  const slab={bricks:'brick_slab',red_terracotta:'brick_slab',mud_bricks:'mud_brick_slab',dark_oak_planks:'dark_oak_slab',dark_prismarine:'dark_prismarine_slab'}[p.roof]||'spruce_slab';
  if (axis==='x') {
    const mid=Math.floor((r.x1+r.x2)/2);
    for(let x=r.x1-1;x<=r.x2+1;x++) {
      const distance=Math.min(x-(r.x1-1),(r.x2+1)-x);
      const h=Math.floor(rise*distance/Math.max(1,mid-r.x1+1));
      box(x,y+h,r.z1-1,x,y+h,r.z2+1,`${stair}[facing=${x<=mid?'east':'west'},half=bottom]`);
      if(h>0 && x>=r.x1 && x<=r.x2) {
        box(x,y,r.z1-1,x,y+h-1,r.z1-1,p.frame);
        box(x,y,r.z2+1,x,y+h-1,r.z2+1,p.frame);
      }
    }
    box(mid,y+rise+1,r.z1-1,mid,y+rise+1,r.z2+1,`${slab}[type=bottom]`);
  } else {
    const mid=Math.floor((r.z1+r.z2)/2);
    for(let z=r.z1-1;z<=r.z2+1;z++) {
      const distance=Math.min(z-(r.z1-1),(r.z2+1)-z);
      const h=Math.floor(rise*distance/Math.max(1,mid-r.z1+1));
      box(r.x1-1,y+h,z,r.x2+1,y+h,z,`${stair}[facing=${z<=mid?'south':'north'},half=bottom]`);
      if(h>0 && z>=r.z1 && z<=r.z2) {
        box(r.x1-1,y,z,r.x1-1,y+h-1,z,p.frame);
        box(r.x2+1,y,z,r.x2+1,y+h-1,z,p.frame);
      }
    }
    box(r.x1-1,y+rise+1,mid,r.x2+1,y+rise+1,mid,`${slab}[type=bottom]`);
  }
}
function terrace(r,y,p) {
  floor(r,y,p.base);
  for(const z of [r.z1,r.z2]) box(r.x1,y+1,z,r.x2,y+1,z,p.frame);
  for(const x of [r.x1,r.x2]) box(x,y+1,r.z1,x,y+1,r.z2,p.frame);
}
function arcade(x1,x2,z,y,p) {
  for(let x=x1;x<=x2;x+=6) {
    box(x,y,z,x,y+5,z,p.base);
    box(x,y+5,z,x+Math.min(5,x2-x),y+5,z,p.frame);
    if(x+5<=x2) {box(x+1,y+4,z,x+4,y+4,z,p.base); box(x+2,y+3,z,x+3,y+3,z,p.base);}
  }
}
function balcony(x1,x2,z,y,p) {
  box(x1,y,z,x2,y,z+3,p.base);
  for(let x=x1;x<=x2;x+=3) box(x,y+1,z+3,x,y+2,z+3,p.frame);
  box(x1,y+3,z+3,x2,y+3,z+3,p.frame);
}
function publicHall(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2), d=v%3;
  const left=rect(a.x1,a.z1+8,cx-13,a.z2-8);
  const right=rect(cx+13,a.z1+6,a.x2,a.z2-8);
  const hall=rect(cx-10,a.z1,cx+10,a.z2-23);
  const vestibule=rect(cx-8,a.z2-23,cx+8,a.z2-7);
  shell(left,64,74+d,p); shell(right,64,77+d,p);shell(hall,64,82+d,p);shell(vestibule,64,72,p);
  gable(left,75+d,3,p,'z');gable(right,78+d,4,p,'z');gable(hall,83+d,4,p,'x');
  gable(vestibule,73,2,p,'x');
  for(const r of [left,right]) {
    box(r.x1,64,r.z1,r.x2,66,r.z2,p.base);
    arcade(r.x1+2,r.x2-2,r.z2+1,65,p);
    box(r.x1+2,72,r.z2+1,r.x2-2,72,r.z2+3,'dark_oak_slab[type=bottom]');
  }
  const fore=rect(left.x2+1,a.z2+1,right.x1-1,a.z2+9);
  box(fore.x1,64,fore.z1,fore.x2,64,fore.z2,'moss_block');
  box(cx-3,64,fore.z1,cx+3,64,fore.z2,p.base);
  for(const x of [fore.x1+2,fore.x2-2]) box(x,65,fore.z2-2,x,67,fore.z2-2,'flowering_azalea_leaves[persistent=true]');
  const tower=rect(cx-3,a.z1+5,cx+3,a.z1+11);
  shell(tower,83+d,91+d,p,false);
  for(const z of [tower.z1,tower.z2]) box(cx-1,86+d,z,cx+1,88+d,z,'black_concrete');
  gable(tower,92+d,2,p,'x');
  doorway(vestibule,cx,p,7);
  box(cx-5,72,vestibule.z2+1,cx+5,72,vestibule.z2+5,'dark_oak_slab[type=bottom]');
  for(const x of [cx-5,cx+5]) box(x,65,vestibule.z2+5,x,71,vestibule.z2+5,p.frame);
  sign(cx-1,74,vestibule.z2+5,['ISLA','CIVIC HALL']);
  return {style:'tropical-civic-hall',height:95+d,body:'低双翼让出深前庭，窄中央大厅和小钟塔突出',roof:'四段浅坡与钟塔，木板深檐',facade:'石基座、外侧木廊、退入门厅和绿化前庭'};
}
function terraceHotel(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2), d=v%3;
  const west=rect(a.x1+2,a.z1+3,cx-13,a.z2-12);
  const east=rect(cx+13,a.z1+10,a.x2-2,a.z2-12);
  const lobby=rect(cx-12,a.z1+2,cx+12,a.z1+17);
  const westP={...p,wall:'light_gray_concrete',base:'stone_bricks'};
  const eastP={...p,wall:'yellow_terracotta',roof:'dark_oak_planks'};
  for(const [r,h,m] of [[west,88+d,westP],[east,79+d,eastP]]) {
    shell(r,68,h,m);
    floor(r,64,m.base);
    for(const x of [r.x1,r.x1+7,r.x2-7,r.x2]) for(const z of [r.z1,r.z2]) box(x,65,z,x,67,z,m.frame);
    for(const y of [73,78,83]) if(y<h-3) {
      balcony(r.x1+2,r.x2-2,r.z2,y,m);
      const towardCourt=r===west?r.x2:r.x1;
      const recess=r===west?rect(r.x2-3,r.z1+4,r.x2,r.z2-4):rect(r.x1,r.z1+4,r.x1+3,r.z2-4);
      box(recess.x1,y,recess.z1,recess.x2,y+2,recess.z2,'air');
      for(let z=recess.z1;z<=recess.z2;z+=3) box(towardCourt,y,z,towardCourt,y+1,z,m.frame);
      box(towardCourt,y+2,recess.z1,towardCourt,y+2,recess.z2,'dark_oak_slab[type=bottom]');
      for(const z of [recess.z1+2,recess.z2-2]) box(towardCourt,y,z,towardCourt,y,z,'flower_pot');
      if(r===west) for(let z=r.z1+5;z<r.z2-5;z+=9) {
        box(r.x1,y,z,r.x1+2,y+2,z+4,'air');
        box(r.x1+2,y,z,r.x1+2,y+2,z+4,m.glass);
        for(const zz of [z,z+4]) box(r.x1,y,zz,r.x1,y+1,zz,m.frame);
        box(r.x1,y+2,z,r.x1,y+2,z+4,'dark_oak_slab[type=bottom]');
      }
    }
  }
  shell(lobby,64,73,p);
  for(const [z1,z2] of [[west.z1,west.z1+5],[west.z2-5,west.z2]]) {
    box(west.x1,83,z1,west.x2,88+d,z2,'air');
    terrace(rect(west.x1,z1,west.x2,z2),82,westP);
  }
  gable(rect(west.x1,west.z1+6,west.x2,west.z2-6),89+d,3,westP,'x');
  gable(east,80+d,3,eastP,'z');gable(lobby,74,2,p,'x');
  const court=rect(cx-11,a.z1+20,cx+11,a.z2-5);
  box(court.x1,64,court.z1,court.x2,64,court.z2,'moss_block');
  const water=rect(cx-6,court.z1+4,cx+6,court.z2-4);
  box(water.x1,64,water.z1,water.x2,64,water.z2,'light_blue_concrete');
  box(water.x1+1,65,water.z1+1,water.x2-1,65,water.z2-1,'water');
  box(cx-2,64,lobby.z2+1,cx+2,64,court.z2,p.base);
  for(const x of [court.x1+1,court.x2-1]) box(x,65,court.z2-2,x,68,court.z2-2,'flowering_azalea_leaves[persistent=true]');
  doorway(lobby,cx,p,7);
  box(cx-6,73,lobby.z2+1,cx+6,73,lobby.z2+6,'dark_oak_slab[type=bottom]');
  sign(cx-2,75,lobby.z2+6,['ISLA','TERRACE HOTEL']);
  return {style:'stepped-terrace-hotel',height:93+d,body:'不等高独立客房翼与低大厅围合开放泳池前院',roof:'两方向浅坡、老式设备屋和大厅短屋脊',facade:'架空柱廊、双面阳台、绿庭与入口雨棚'};
}
function courtyardLodge(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2), d=v%3;
  const rear=rect(a.x1,a.z1,a.x2,a.z1+9);
  const west=rect(a.x1,a.z1+9,cx-13,a.z2-11);
  const east=rect(cx+13,a.z1+9,a.x2,a.z2-11);
  const bridge=rect(cx-14,a.z1+13,cx+14,a.z1+15);
  shell(rear,64,78+d,p); shell(west,64,83+d,p); shell(east,64,76+d,p);
  box(bridge.x1,72,bridge.z1,bridge.x2,72,bridge.z2,'dark_oak_planks');
  for(const z of [bridge.z1,bridge.z2]) {
    for(let x=bridge.x1;x<=bridge.x2;x+=3) box(x,73,z,x,74,z,'dark_oak_fence');
    box(bridge.x1,75,z,bridge.x2,75,z,'dark_oak_slab[type=bottom]');
  }
  gable(rear,79+d,5,p,'z'); gable(west,84+d,5,p,'x'); gable(east,77+d,4,p,'x');
  const yard=rect(cx-11,a.z1+11,cx+11,a.z2-15);
  box(yard.x1,64,yard.z1,yard.x2,64,yard.z2,'moss_block');
  box(cx-2,64,yard.z1,cx+2,64,yard.z2,p.base);
  for(const x of [cx-8,cx+8]) {
    box(x,65,Math.floor((yard.z1+yard.z2)/2),x,69,Math.floor((yard.z1+yard.z2)/2),'jungle_log');
    box(x-2,70,Math.floor((yard.z1+yard.z2)/2)-2,x+2,71,Math.floor((yard.z1+yard.z2)/2)+2,'jungle_leaves[persistent=true]');
  }
  box(cx-2,64,yard.z1+3,cx+2,64,yard.z1+7,'stone_bricks');
  box(cx-1,65,yard.z1+4,cx+1,65,yard.z1+6,'water');
  for(let z=yard.z1+2;z<=yard.z2-2;z+=5) {
    arcade(west.x2-5,west.x2,z,65,p); arcade(east.x1,east.x1+5,z,65,p);
  }
  balcony(west.x1+2,west.x2-2,west.z2-1,76,p);
  balcony(east.x1+2,east.x2-2,east.z2-1,70,p);
  doorway(rear,cx,p,5);
  box(cx-3,64,a.z2-11,cx+3,64,a.z2-7,p.base);
  return {style:'bridge-courtyard-lodge',height:90+d,body:'三面围合可见绿院，南侧细木廊桥下方通行',roof:'三段高低交错的独立坡顶',facade:'内向回廊、外向阳台、院内树与小水景'};
}
function decoCinema(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2), d=v%3;
  const core=rect(cx-13,a.z1+4,cx+13,a.z2-15);
  const wings=[rect(a.x1,a.z1+13,cx-15,a.z2-10),rect(cx+15,a.z1+17,a.x2,a.z2-10)];
  shell(core,64,82+d,p);wings.forEach((r,i)=>shell(r,64,70+i*3,p));
  terrace(rect(core.x1+1,core.z1+1,core.x2-1,core.z2-1),83+d,p);
  for(let level=1;level<=2;level++) {
    const t=rect(cx-11+level*3,core.z1+3+level*3,cx+11-level*3,core.z2-3-level*3);
    floor(t,84+d+level*2,p.base);
    for(const z of [t.z1,t.z2]) box(t.x1,85+d+level*2,z,t.x2,85+d+level*2,z,p.frame);
    for(const x of [t.x1,t.x2]) box(x,85+d+level*2,t.z1,x,85+d+level*2,t.z2,p.frame);
    for(const x of [t.x1+2,t.x2-2]) box(x,85+d+level*2,t.z2-1,x,86+d+level*2,t.z2-1,'flowering_azalea_leaves[persistent=true]');
  }
  for(const x of [cx-10,cx-5,cx,cx+5,cx+10]) box(x,66,core.z2+1,x,82+d,core.z2+1,p.frame);
  wings.forEach((r,i)=>terrace(r,71+i*3,p));
  const portal=rect(cx-5,core.z2-1,cx+5,core.z2+6);
  floor(portal,64,p.base);
  for(const x of [portal.x1,portal.x2]) box(x,65,portal.z2,x,76,portal.z2,p.frame);
  box(portal.x1-1,77,portal.z1,portal.x2+1,77,portal.z2+1,'smooth_stone_slab[type=bottom]');
  doorway(core,cx,p,7);
  sign(cx-2,76,portal.z2+1,['ISLA CINEMA','1993']);
  return {style:'stepped-cinema',height:91+d,body:'高放映厅、两侧低票厅与中轴高门楼',roof:'薄平屋顶和可用退台，栏杆与花池',facade:'装饰艺术竖柱、宽门楼与浅色石檐'};
}
function civicClockHall(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2),d=v%3;
  const civic={...p,wall:'smooth_sandstone',base:'stone_bricks',roof:'dark_oak_planks'};
  const hall=rect(a.x1+11,a.z1+5,a.x2-11,a.z2-13);
  const left=rect(a.x1,a.z1+13,a.x1+15,a.z2-13);
  const right=rect(a.x2-15,a.z1+9,a.x2,a.z2-13);
  shell(hall,64,77+d,civic);shell(left,64,69,civic);shell(right,64,72,civic);
  terrace(hall,78+d,civic);gable(left,70,2,civic,'z');gable(right,73,2,civic,'z');
  for(const x of [hall.x1+3,hall.x1+10,cx,hall.x2-10,hall.x2-3]) box(x,65,hall.z2+2,x,74+d,hall.z2+2,'quartz_pillar');
  box(hall.x1,76+d,hall.z2+2,hall.x2,76+d,hall.z2+5,'dark_oak_slab[type=bottom]');
  const tower=rect(cx-5,hall.z1+4,cx+5,hall.z1+14);
  shell(tower,79+d,90+d,civic,false);
  for(const z of [tower.z1,tower.z2]) box(cx-2,84+d,z,cx+2,87+d,z,'black_concrete');
  gable(tower,91+d,2,civic,'x');
  doorway(hall,cx,civic,7);
  return {style:'civic-clock-hall',height:94+d,body:'低宽市政大会堂、前柱廊和细钟塔',roof:'低翼浅坡、主厅平屋顶和小塔顶',facade:'石柱、木檐、深窗与正中入口'};
}
function marketArcade(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2),d=v%3;
  const left=rect(a.x1+2,a.z1+3,cx-15,a.z2-8);
  const right=rect(cx+15,a.z1+3,a.x2-2,a.z2-8);
  for(const [i,r] of [left,right].entries()) {
    shell(r,64,70+i*2,p);
    box(r.x1-1,71+i*2,r.z1-1,r.x2+1,71+i*2,r.z2+1,'dark_oak_slab[type=bottom]');
    const edge=i?r.x1-1:r.x2+1;
    for(let z=r.z1+2;z<r.z2-2;z+=7) {
      box(edge,65,z,edge,70+i*2,z,p.frame);
      box(edge,70+i*2,z,edge,70+i*2,z+5,'dark_oak_slab[type=bottom]');
    }
  }
  const lane=rect(left.x2+2,a.z1+2,right.x1-2,a.z2-7);
  floor(lane,64,'stone_bricks');
  box(cx-2,64,lane.z1,cx+2,64,lane.z2,'smooth_sandstone');
  for(let z=lane.z1+4;z<lane.z2-4;z+=9) for(const side of [-1,1]) {
    const x=cx+side*7;
    box(x-3,65,z,x+3,65,z+4,p.frame);
    for(const xx of [x-3,x+3]) box(xx,66,z,xx,69,z,p.frame);
    box(x-4,70,z-1,x+4,70,z+5,side<0?'red_wool':'green_wool');
  }
  return {style:'open-air-market',height:75+d,body:'两条平行骑楼和宽敞露天市巷，分段摊位',roof:'低平木檐与独立布棚',facade:'内向连续柱廊、透明店窗与双端通路'};
}
function greenhouse(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2), d=v%3;
  const side1=rect(a.x1,a.z1+8,cx-10,a.z2-10),side2=rect(cx+10,a.z1+8,a.x2,a.z2-10);
  const nave=rect(cx-11,a.z1,cx+11,a.z2-10);
  shell(side1,64,74,p);shell(side2,64,77+d,p);shell(nave,64,82+d,p);
  for(const r of [side1,side2,nave]) {
    const roofY=r===nave?83+d:r===side1?75:78+d;
    const mid=Math.floor((r.x1+r.x2)/2);
    for(let x=r.x1-1;x<=r.x2+1;x++) {
      const h=Math.min(x-r.x1+1,r.x2+1-x,7);
      box(x,roofY+h,r.z1-1,x,roofY+h,r.z2+1,(x-r.x1)%5===0?p.frame:'light_blue_stained_glass');
    }
    for(let z=r.z1+3;z<r.z2-2;z+=7) box(r.x1,66,z,r.x2,73,z,'light_blue_stained_glass');
    box(mid,roofY+6,r.z1-1,mid,roofY+6,r.z2+1,p.frame);
  }
  porch(nave,cx,p,13,5);
  return {style:'tropical-greenhouse',height:90+d,body:'中央高温室与两条低侧廊',roof:'三道玻璃拱脊和木质肋架',facade:'大块透明玻璃、通高骨架与入口雨棚'};
}
function scienceSheds(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2),d=v%3;
  const labs=[];
  for(let i=0;i<3;i++) {
    const x1=a.x1+i*Math.floor((a.x2-a.x1+1)/3),x2=i===2?a.x2:x1+Math.floor((a.x2-a.x1+1)/3)-2;
    const r=rect(x1,a.z1+i*3,x2,a.z2-10-i*2);labs.push(r);
    shell(r,64,76+i*3+d,p);
    box(r.x1-1,77+i*3+d,r.z1-1,r.x2+1,77+i*3+d,r.z2+1,p.roof);
    for(let z=r.z1-1;z<=r.z2+1;z++) {
      const h=(z-r.z1+1)%8;
      box(r.x1-1,77+i*3+d+h,z,r.x2+1,77+i*3+d+h,z,h<3?p.roof:p.base);
    }
    for(let x=r.x1+4;x<r.x2-3;x+=7) box(x,67,r.z2,x+3,70,r.z2,p.glass);
  }
  for(let i=0;i<2;i++) box(labs[i].x2+1,64,labs[i].z2-3,labs[i+1].x1-1,69,labs[i].z2+2,p.base);
  porch(labs[1],cx,p,11,5);
  return {style:'sawtooth-research-sheds',height:92+d,body:'三条逐级升高的窄实验翼楼和连廊',roof:'三段锯齿采光屋面',facade:'工业高窗、长檐、门厅与设备管廊'};
}
function circularExhibit(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2),cz=Math.floor((a.z1+a.z2)/2),d=v%3;
  const radius=Math.min(21,Math.floor((a.x2-a.x1)/2)-2,Math.floor((a.z2-a.z1)/2)-1);
  const ring=[];
  for(let z=cz-radius;z<=cz+radius;z++) {
    const w=Math.floor(Math.sqrt(Math.max(0,radius*radius-(z-cz)**2)));
    box(cx-w,64,z,cx+w,64,z,p.base);
    if(w>1) {box(cx-w,65,z,cx+w,80+d,z,p.wall);box(cx-w+1,65,z,cx+w-1,79+d,z,'air');}
    ring.push({z,w});
  }
  for(const {z,w} of ring) {
    if(w<3) continue;
    if((z-cz)%6===0) {box(cx-w,68,z,cx-w,71,z,p.glass);box(cx+w,68,z,cx+w,71,z,p.glass);}
    const rise=Math.floor(8*(1-Math.abs(z-cz)/radius));
    box(cx-w,81+d+rise,z,cx+w,81+d+rise,z,(z-cz)%5===0?p.frame:p.roof);
  }
  const front=rect(cx-7,Math.min(cz+radius-8,a.z2-12),cx+7,a.z2-9);
  shell(front,64,71,p,false);porch(front,cx,p,13,5);
  box(cx-2,65,cz+radius-5,cx+2,68,cz+radius-5,'air');
  return {style:'round-exhibit-hall',height:90+d,body:'圆形主展厅与短矩形入口翼',roof:'层层收拢的低圆顶',facade:'分节壁柱、环窗和深入口'};
}
function steppedApartments(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2),d=v%3;
  const wings=[rect(a.x1,a.z1+4,cx-8,a.z2-12),rect(cx+8,a.z1+9,a.x2,a.z2-8)];
  for(let i=0;i<2;i++) {
    const r=wings[i],high=83+(i?5:0)+d;
    shell(r,64,high,p);
    for(let level=0;level<3;level++) {
      const t=rect(r.x1+level*3,r.z1+level*3,r.x2-level*3,r.z2-2-level*3);
      terrace(t,high+1+level*3,p);
    }
    for(let y=69;y<high-4;y+=5) balcony(r.x1+4,r.x2-4,r.z2,y,p);
  }
  const court=rect(cx-7,a.z1+12,cx+7,a.z2-13);
  box(court.x1,64,court.z1,court.x2,64,court.z2,'moss_block');
  box(cx-2,64,court.z1,cx+2,64,court.z2,p.base);
  return {style:'stepped-apartment-courts',height:96+d,body:'两翼错位排布，中间留完整地面绿院',roof:'六层错位露台而非整片大屋盖',facade:'深阳台、退台栏杆和入口小径'};
}
function timberLodge(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2),d=v%3;
  const timber={...p,wall:'spruce_planks',base:'stone_bricks',roof:'dark_oak_planks'};
  const cabins=[
    rect(a.x1+2,a.z1+2,a.x1+17,a.z1+19),
    rect(a.x2-18,a.z1+6,a.x2-3,a.z1+23),
    rect(a.x1+4,a.z2-24,a.x1+19,a.z2-8),
    rect(a.x2-20,a.z2-22,a.x2-4,a.z2-7),
  ];
  cabins.forEach((r,i)=>{
    const h=70+(i%2)*2+d;
    shell(r,64,h,timber);gable(r,h+1,3,timber,i%2?'z':'x');
    box(r.x1+2,64,r.z2+1,r.x2-2,64,r.z2+4,'spruce_planks');
    for(const x of [r.x1+2,r.x2-2]) box(x,65,r.z2+4,x,68,r.z2+4,'jungle_log');
    box(r.x1+1,69,r.z2,r.x2-1,69,r.z2+5,'dark_oak_slab[type=bottom]');
    doorway(r,Math.floor((r.x1+r.x2)/2),timber,3);
  });
  const lane=rect(cx-4,a.z1+7,cx+4,a.z2-8);
  floor(lane,64,'spruce_planks');
  for(let z=lane.z1;z<=lane.z2;z+=7) for(const x of [lane.x1,lane.x2]) box(x,65,z,x,70,z,'jungle_log');
  box(lane.x1,71,lane.z1,lane.x2,71,lane.z2,'dark_oak_slab[type=bottom]');
  return {style:'timber-tropical-lodge',height:77+d,body:'四栋分散低木屋由中央带顶步道连通',roof:'四座小深檐屋顶和细长步道檐',facade:'独立阳台、粗木柱、石基和可进入木廊'};
}
function poolResort(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2),d=v%3;
  const left=rect(a.x1,a.z1,cx-13,a.z2-9),right=rect(cx+13,a.z1+8,a.x2,a.z2-9);
  const rear=rect(cx-14,a.z1,cx+14,a.z1+17);
  shell(left,64,83+d,p);shell(right,64,79+d,p);shell(rear,64,75,p);
  gable(left,84+d,5,p,'x');gable(right,80+d,4,p,'x');gable(rear,76,4,p,'z');
  const pool=rect(cx-9,a.z1+22,cx+9,a.z2-16);
  box(pool.x1,64,pool.z1,pool.x2,64,pool.z2,'light_blue_concrete');
  box(pool.x1+1,64,pool.z1+1,pool.x2-1,64,pool.z2-1,'water');
  for(const y of [70,75,80]) if(y<83) balcony(left.x1+3,left.x2-3,left.z2,y,p);
  balcony(right.x1+3,right.x2-3,right.z2,70,p);
  doorway(rear,cx,p);
  return {style:'double-wing-pool-resort',height:90+d,body:'双翼围合内庭泳池，后侧低大堂',roof:'双坡顶错高，后厅独立横屋脊',facade:'泳池露台、连续阳台与大厅通道'};
}
function lVilla(a,p,v) {
  const cx=Math.floor((a.x1+a.x2)/2),d=v%3;
  const back=rect(a.x1,a.z1,a.x2,a.z1+17);
  const leg= v%2 ? rect(a.x1,a.z1+16,cx-4,a.z2-9):rect(cx+4,a.z1+16,a.x2,a.z2-9);
  shell(back,64,76+d,p);shell(leg,64,72+d,p);
  gable(back,77+d,6,p,'x');gable(leg,73+d,5,p,'z');
  const yard=rect(v%2?cx-2:a.x1+5,a.z1+21,v%2?a.x2-4:cx+2,a.z2-12);
  box(yard.x1,64,yard.z1,yard.x2,64,yard.z2,'moss_block');
  for(let z=yard.z1+3;z<yard.z2;z+=7) box(v%2?back.x2:back.x1,65,z,v%2?back.x2:back.x1,69,z,p.frame);
  porch(leg,Math.floor((leg.x1+leg.x2)/2),p,11,5);
  return {style:'red-tile-l-villa',height:84+d,body:'明确L形主屋和侧向院子',roof:'相交的红瓦横纵双脊',facade:'柱廊、外向深窗和小门廊'};
}
const mainDesigns=[publicHall,terraceHotel,courtyardLodge,decoCinema,civicClockHall,lVilla,marketArcade,greenhouse,scienceSheds,circularExhibit,steppedApartments,timberLodge];
function rebuildAnnex(b, n) {
  const old=b.bounds, side=b.id.endsWith('-l')?0:1, index=Number(b.id.match(/city-annex-(\d+)/)[1]);
  const p=palettes[(index+side)%palettes.length];
  const r=rect(old.x1+1,old.z1+1,old.x2-1,old.z2-2);
  const cx=Math.floor((r.x1+r.x2)/2), form=(index*3+side)%8;
  box(old.x1,64,old.z1,old.x2,82,old.z2,'air');
  let roof='';
  if(r.z2-r.z1<13) {
    shell(r,64,70+(index%3),p);
    gable(r,71+(index%3),2,p,side?'x':'z');
    roof='小尺度浅坡街屋';
  } else if(form===0 || form===4) {
    const wing=rect(r.x1,r.z1,cx+2,r.z2);
    shell(wing,64,73,p);gable(wing,74,3,p,'x');
    terrace(rect(cx+3,r.z1+3,r.x2,r.z2-3),68,p);
    roof='不对称坡顶加一侧露台';
  } else if(form===1 || form===5) {
    const rear=rect(r.x1,r.z1,r.x2,r.z1+8);
    const left=rect(r.x1,r.z1+8,cx-2,r.z2);
    shell(rear,64,75,p);shell(left,64,70,p);
    gable(rear,76,3,p,'z');gable(left,71,2,p,'x');
    box(cx+1,64,r.z1+10,r.x2,64,r.z2,'moss_block');
    roof='L形两段错高屋脊';
  } else if(form===2 || form===6) {
    shell(r,64,73,p);
    const tower=rect(r.x1+2,r.z1+2,r.x1+7,r.z1+7);
    shell(tower,74,79,p,false);
    gable(r,74,2,p,'z');gable(tower,80,2,p,'x');
    roof='低商铺加角塔';
  } else {
    shell(r,64,71,p);
    gable(r,72,3,p,'x');
    const canopy=rect(r.x1+2,r.z2+1,r.x2-2,old.z2-1);
    box(canopy.x1,70,canopy.z1,canopy.x2,70,canopy.z2,'dark_oak_slab[type=bottom]');
    for(const x of [canopy.x1,canopy.x2]) box(x,65,canopy.z2,x,69,canopy.z2,p.frame);
    roof='深檐坡顶与开放骑楼';
  }
  box(cx-2,65,r.z2,cx+2,68,r.z2,'air');
  box(cx-2,64,r.z2+1,cx+2,64,old.z2,p.base);
  for(const x of [r.x1+2,r.x2-2]) {
    box(x,66,r.z2,x,68,r.z2,p.glass);
    box(x-1,65,r.z2+1,x+1,65,r.z2+1,p.frame);
  }
  sign(cx-2,70,r.z2+1,[side?'CAFE':'ARCADE',String(index)]);
  return {id:b.id,kind:'annex',center:{x:cx,z:Math.floor((old.z1+old.z2)/2)},oldStyle:'plain-street-box',newStyle:['terrace-shop','courtyard-cafe','corner-tower-shop','arcade-store'][form%4],body:`街屋形体 ${form+1}/8`,roof,facadeAndEntry:'落地入口、深窗、遮阳与前缘步道',clearBounds:{...rect(old.x1,old.z1,old.x2,old.z2),y1:64,y2:82},newBounds:{...r,y1:64,y2:82},collisionCount:0};
}
function rebuildShop(site,index) {
  const old=site.bounds,cx=Math.floor((old.x1+old.x2)/2),cz=Math.floor((old.z1+old.z2)/2);
  const p=palettes[index%palettes.length],form=index%6;
  box(old.x1,64,old.z1,old.x2,81,old.z2+2,'air');
  const r=rect(old.x1+1,old.z1+1,old.x2-1,old.z2-1);
  if(form===0 || form===3) {
    const left=rect(r.x1,r.z1,cx+1,r.z2);
    shell(left,64,71,p);gable(left,72,3,p,'x');
    const patio=rect(cx+2,r.z1+2,r.x2,r.z2);
    box(patio.x1,64,patio.z1,patio.x2,64,patio.z2,'moss_block');
    box(patio.x1,69,patio.z1,patio.x2,69,patio.z2,'dark_oak_slab[type=bottom]');
    for(const x of [patio.x1,patio.x2]) for(const z of [patio.z1,patio.z2]) box(x,65,z,x,68,z,p.frame);
  } else if(form===1 || form===4) {
    shell(r,64,72,p);gable(r,73,3,p,'z');
    box(r.x1+2,73,r.z2-3,r.x2-2,73,r.z2-1,'dark_oak_planks');
    box(r.x1+2,74,r.z2-1,r.x2-2,75,r.z2-1,'dark_oak_fence');
  } else {
    shell(r,64,70,p);gable(r,71,2,p,'x');
    box(r.x1+2,71,r.z1+2,r.x2-2,71,r.z1+4,'light_blue_stained_glass');
  }
  box(cx-1,65,r.z2,cx+1,68,r.z2,'air');
  box(cx-2,64,r.z2+1,cx+2,64,old.z2+2,p.base);
  box(r.x1,69,r.z2+1,r.x2,69,r.z2+2,index%2?'red_wool':'green_wool');
  for(const x of [r.x1+2,r.x2-2]) box(x,66,r.z2,x,68,r.z2,p.glass);
  sign(cx-2,71,r.z2+2,[['PHOTO','CAFE','MARKET','BOOKS','VIDEO','DINER'][form]]);
  return {id:site.id,kind:'shop',center:{x:cx,z:cz},oldStyle:'single-box-kiosk',newStyle:['patio-shop','gable-terrace-shop','glass-roof-kiosk'][form%3],body:`错位小店与露天前场 ${form+1}/6`,roof:'浅坡或露台，独立檐线',facadeAndEntry:'透明店窗、落地入口、雨棚和店牌',clearBounds:{...rect(old.x1,old.z1,old.x2,old.z2+2),y1:64,y2:81},newBounds:{...r,y1:64,y2:79},collisionCount:0};
}
for(const b of selected) {
  const index=Number(b.id.slice(-2))-1,cycle=Math.floor(index/12),basePalette=palettes[(index+cycle)%palettes.length];
  const p=index===0?{...basePalette,wall:'light_gray_concrete',base:'stone_bricks',roof:'dark_oak_planks'}:basePalette;
  const clear=rect(b.bounds.x1-1,b.bounds.z1-2,b.bounds.x2+1,b.bounds.z2);
  box(clear.x1,64,clear.z1,clear.x2,112,clear.z2,'air');
  const oldClear=1;
  const feature=variation.metadata.features.find(f=>f.buildingId===b.id);
  if(feature) {
    const area=rect(feature.x1-2,feature.z1-2,feature.x2+2,feature.z2+2);
    if(corridor.some(c=>hit(area,c))) {
      for(let x=area.x1;x<=area.x2;x++) for(let z=area.z1;z<=area.z2;z++) {
        if(!corridor.some(c=>hit(rect(x,z,x,z),c))) box(x,64,z,x,100,z,'air');
      }
    } else box(area.x1,64,area.z1,area.x2,100,area.z2,'air');
  }
  const inset=index<3?10:8+cycle%3;
  const a=rect(b.bounds.x1+inset,b.bounds.z1+8+cycle%3,b.bounds.x2-inset,b.bounds.z2-(index<3?14:11+cycle%3));
  const designStart=ops.length;
  const design=mainDesigns[index%mainDesigns.length](a,p,index+cycle);
  const builtBounds=geometryBounds(designStart);
  {
    const cx=Math.floor((b.bounds.x1+b.bounds.x2)/2),z1=a.z2+3,z2=b.bounds.z2-3;
    box(b.bounds.x1,63,b.bounds.z1,b.bounds.x2,63,b.bounds.z2,'grass_block');
    box(cx-2,63,a.z2-6,cx+2,63,b.bounds.z2,p.base);
    box(b.bounds.x1+4,63,z2-2,b.bounds.x2-4,63,z2-2,p.base);
    for(const x of [cx-18-cycle%3,cx+18+cycle%3]) {
      for(const z of [a.z1+5,z1+1,z2-5]) {
        const side=x<cx?b.bounds.x1+4:b.bounds.x2-4;
        const xx=z===a.z1+5?side:x;
        box(xx,64,z,xx,68,z,'jungle_log');
        box(xx-2,69,z-2,xx+2,70,z+2,'jungle_leaves[persistent=true]');
        box(xx-3,64,z+3,xx+3,65,z+5,'flowering_azalea_leaves[persistent=true]');
      }
    }
  }
  manifest.push({id:b.id,kind:'main',center:{x:Math.floor((b.bounds.x1+b.bounds.x2)/2),z:Math.floor((b.bounds.z1+b.bounds.z2)/2)},oldStyle:b.style,newStyle:design.style,body:design.body,roof:design.roof,facadeAndEntry:design.facade,variant:{designFamily:index%mainDesigns.length+1,cycle:cycle+1,designInput:index+cycle,inset,palette:p},clearBounds:{...clear,y1:64,y2:112},newBounds:builtBounds,oldOperationsCleared:oldClear,variationCleared:Boolean(feature)});
}
const annexes=full.metadata.buildings.filter(b=>b.id.startsWith('city-annex-'));
for(const b of annexes) if(!sample&&!sample12 || new RegExp(`^city-annex-(?:${sample12?'[1-9]|1[0-2]':'[1-3]'})-`).test(b.id)) {
  const start=ops.length,m=rebuildAnnex(b,manifest.length);
  m.newBounds=geometryBounds(start);
  manifest.push(m);
}
if(!sample&&!sample12) for(const [index,site] of ground.metadata.sites.filter(s=>s.type==='shop').entries()) {
  const start=ops.length,m=rebuildShop(site,index);
  m.newBounds=geometryBounds(start);
  manifest.push(m);
}

const selectedIds=new Set(manifest.map(m=>m.id));
const protectedAreas=[...full.metadata.enclosures.map(e=>rect(e.bounds.x1-3,e.bounds.z1-3,e.bounds.x2+3,e.bounds.z2+3)),...full.metadata.buildings.filter(b=>!selectedIds.has(b.id)).map(b=>rect(b.bounds.x1,b.bounds.z1,b.bounds.x2,b.bounds.z2))];
for(const o of ops) if(o.kind==='box' && o.y2>=64) {
  const r=rect(o.x1,o.z1,o.x2,o.z2);
  if(corridor.some(c=>hit(r,c))) throw Error(`route conflict at ${JSON.stringify(o)}`);
  if(protectedAreas.some(c=>hit(r,c))) throw Error(`protected structure conflict at ${JSON.stringify(o)}`);
}
const counts={main:manifest.filter(m=>m.kind==='main').length,annex:manifest.filter(m=>m.kind==='annex').length,shop:manifest.filter(m=>m.kind==='shop').length};
const mode=sample?'architecture-sample-v3':sample12?'architecture-sample-12':'architecture-rebuild';
const plan={name:`Jurassic City Park ${sample?'Architecture Sample v3':sample12?'Architecture Sample 12':'Architecture Rebuild'}`,bounds:full.bounds,operations:ops,metadata:{architectureManifest:manifest,mode,counts,routePointsChecked:points.length,collisionCount:0}};
await writeFile(path.join(root,`map/generated/${mode}.json`),JSON.stringify(plan));
await writeFile(path.join(root,`verification/${mode}-manifest.json`),JSON.stringify(plan.metadata,null,2));
console.log(JSON.stringify({operations:ops.length,manifest:manifest.length,counts,points:points.length}));

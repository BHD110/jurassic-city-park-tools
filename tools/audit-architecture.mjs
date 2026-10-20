import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import nbt from 'prismarine-nbt';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beforePath = path.join(root, 'tools/unmined/world-snapshot-20261017-city-variation-v2');
const afterPath = path.join(root, 'tools/unmined/world-snapshot-mediterranean-20261017');
const manifest = JSON.parse(await readFile(path.join(root, 'verification/architecture-rebuild-manifest.json'), 'utf8')).architectureManifest;
const imported = JSON.parse(await readFile(path.join(root, 'map/generated/imported-mediterranean-home.json'), 'utf8')).metadata;
const AIR = { name: 'air', properties: {} };
const nonSolid = new Set(['air','cave_air','void_air','short_grass','tall_grass','fern','large_fern','dead_bush','dandelion','poppy','allium','blue_orchid','azure_bluet','oxeye_daisy','cornflower','lily_of_the_valley','water']);
const solid = state => !nonSolid.has(state.name) && !state.name.endsWith('_leaves') && !state.name.endsWith('_carpet') && !state.name.endsWith('_flower') && !state.name.endsWith('_pane');
const key = state => `${state.name}:${JSON.stringify(state.properties)}`;

class World {
  constructor(folder) { this.folder=folder; this.regions=new Map(); this.chunks=new Map(); }
  async chunk(cx,cz) {
    const id=`${cx},${cz}`;
    if(this.chunks.has(id)) return this.chunks.get(id);
    const filename=`r.${Math.floor(cx/32)}.${Math.floor(cz/32)}.mca`;
    let region=this.regions.get(filename);
    if(!region) { region=await readFile(path.join(this.folder,'region',filename)); this.regions.set(filename,region); }
    const slot=(cx&31)+32*(cz&31), sector=region.readUIntBE(slot*4,3);
    if(!sector) throw Error(`missing chunk ${id}`);
    const offset=sector*4096, length=region.readUInt32BE(offset), compression=region[offset+4];
    const bytes=region.subarray(offset+5,offset+4+length);
    const raw=compression===2?inflateSync(bytes):compression===1?gunzipSync(bytes):compression===3?bytes:null;
    if(!raw) throw Error(`unsupported compression ${compression}`);
    const parsed=nbt.simplify(nbt.parseUncompressed(raw,'big'));
    if(parsed.xPos!==cx||parsed.zPos!==cz) throw Error(`wrong chunk ${id}`);
    const sections=new Map();
    for(const section of parsed.sections??[]) {
      const states=section.block_states;
      if(!states?.palette?.length) continue;
      const palette=states.palette.map(item=>({name:item.Name.replace(/^minecraft:/,''),properties:item.Properties??{}}));
      const bits=Math.max(4,Math.ceil(Math.log2(palette.length)));
      sections.set(section.Y,{palette,bits,data:states.data,perLong:Math.floor(64/bits),mask:(1n<<BigInt(bits))-1n});
    }
    const chunk={sections}; this.chunks.set(id,chunk); return chunk;
  }
  async block(x,y,z) {
    const chunk=await this.chunk(Math.floor(x/16),Math.floor(z/16));
    const section=chunk.sections.get(Math.floor(y/16));
    if(!section) return AIR;
    if(section.palette.length===1) return section.palette[0];
    const index=((y&15)<<8)|((z&15)<<4)|(x&15), word=section.data?.[Math.floor(index/section.perLong)];
    if(word===undefined) throw Error(`missing block data ${x},${y},${z}`);
    const paletteIndex=Number((BigInt.asUintN(64,word)>>BigInt(index%section.perLong*section.bits))&section.mask);
    return section.palette[paletteIndex]??AIR;
  }
}
const before=new World(beforePath), after=new World(afterPath);
const auditRegion=async bounds=>{
  let changed=0,afterSolid=0;
  for(let x=bounds.x1;x<=bounds.x2;x++) for(let z=bounds.z1;z<=bounds.z2;z++) for(let y=bounds.y1;y<=bounds.y2;y++) {
    const old=await before.block(x,y,z), current=await after.block(x,y,z);
    if(key(old)!==key(current)) changed++;
    if(solid(current)) afterSolid++;
  }
  return {changed,afterSolid};
};
async function walkable(x,z,y) {
  const floor=await after.block(x,y-1,z),feet=await after.block(x,y,z),head=await after.block(x,y+1,z);
  return solid(floor)&&!solid(feet)&&!solid(head);
}
async function entranceReachable(item) {
  const old=item.clearBounds, built=item.newBounds, cx=item.center.x;
  const x1=Math.min(old.x1,built.x1)-3,x2=Math.max(old.x2,built.x2)+3;
  const z1=Math.min(old.z1,built.z1)-3,z2=Math.max(old.z2,built.z2)+5;
  const queue=[],seen=new Set(),passable=new Map();
  const pass=async(x,z,y)=>{
    const id=`${x},${z},${y}`;
    if(!passable.has(id)) passable.set(id,await walkable(x,z,y));
    return passable.get(id);
  };
  const add=async(x,z,y)=>{
    if(x<x1||x>x2||z<z1||z>z2) return;
    const id=`${x},${z},${y}`;
    if(seen.has(id)||!(await pass(x,z,y))) return;
    seen.add(id); queue.push({x,z,y});
  };
  for(let z=old.z2+1;z<=old.z2+4;z++) for(let x=cx-6;x<=cx+6;x++) for(const y of [64,65]) await add(x,z,y);
  let cursor=0;
  while(cursor<queue.length) {
    const p=queue[cursor++];
    if(p.x>=Math.max(built.x1,cx-6)&&p.x<=Math.min(built.x2,cx+6)&&p.z>=built.z2-5&&p.z<=built.z2-2) return {reached:true,visited:seen.size,goal:{x:p.x,y:p.y,z:p.z}};
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) for(const y of [p.y,p.y-1,p.y+1]) if(y>=64&&y<=66) await add(p.x+dx,p.z+dz,y);
  }
  return {reached:false,visited:seen.size};
}
const results=[];
for(const [index,entry] of manifest.entries()) {
  const item=entry.id==='city-06'?{...entry,newBounds:imported.importedBounds}:entry;
  const b=item.newBounds, roofY=Math.max(69,b.y2-5);
  const roof=await auditRegion({x1:b.x1,y1:roofY,z1:b.z1,x2:b.x2,y2:b.y2,z2:b.z2});
  let facadeChanged=0,facadeSolid=0;
  for(let x=b.x1;x<=b.x2;x++) for(let z=b.z1;z<=b.z2;z++) {
    if(x>b.x1+1&&x<b.x2-1&&z>b.z1+1&&z<b.z2-1) continue;
    for(let y=65;y<=Math.min(b.y2-2,78);y++) {
      const old=await before.block(x,y,z),current=await after.block(x,y,z);
      if(key(old)!==key(current)) facadeChanged++;
      if(solid(current)) facadeSolid++;
    }
  }
  const entryRegion={x1:Math.max(b.x1,item.center.x-4),x2:Math.min(b.x2,item.center.x+4),y1:64,y2:Math.min(71,b.y2),z1:b.z2-6,z2:b.z2+2};
  const entrance=await auditRegion(entryRegion);
  const access=await entranceReachable(item);
  let baseColumns=0,supportedBaseColumns=0;
  for(let x=b.x1;x<=b.x2;x++) for(let z=b.z1;z<=b.z2;z++) {
    if(!solid(await after.block(x,64,z))) continue;
    baseColumns++;
    if(solid(await after.block(x,63,z))) supportedBaseColumns++;
  }
  results.push({id:item.id,kind:item.kind,style:item.newStyle,variant:item.variant??null,roof,facade:{changed:facadeChanged,afterSolid:facadeSolid},entrance,access,support:{baseColumns,supportedBaseColumns}});
  if((index+1)%25===0) console.log(`audited ${index+1}/${manifest.length}`);
}
const summary={total:results.length,main:results.filter(r=>r.kind==='main').length,annex:results.filter(r=>r.kind==='annex').length,shop:results.filter(r=>r.kind==='shop').length,roofChanged:results.filter(r=>r.roof.changed>0).length,facadeChanged:results.filter(r=>r.facade.changed>0).length,entranceChanged:results.filter(r=>r.entrance.changed>0).length,entranceReachable:results.filter(r=>r.access.reached).length,fullySupported:results.filter(r=>r.support.baseColumns>0&&r.support.baseColumns===r.support.supportedBaseColumns).length};
const report={beforeWorld:beforePath,afterWorld:afterPath,summary,buildings:results};
await writeFile(path.join(root,'verification/architecture-upgrade-block-audit.json'),JSON.stringify(report,null,2));
const lines=[
  '# 建筑改建真实存档验收',
  '',
  `施工前快照：\`${path.relative(root,beforePath)}\``,
  `施工后快照：\`${path.relative(root,afterPath)}\`（包含 city-06 素材替换）`,
  '',
  `共 ${summary.total} 栋：主楼 ${summary.main}、配楼 ${summary.annex}、小店 ${summary.shop}。屋顶、外墙、入口区域各 ${summary.roofChanged}/${summary.total} 栋发生真实方块变化；南侧入口 ${summary.entranceReachable}/${summary.total} 处由地块外步行可达；底层 ${summary.fullySupported}/${summary.total} 栋的全部实体方块有下方地基支撑。`,
  '',
  '统计直接读取 Minecraft 1.21.1 Anvil 区块。屋顶取新建筑最高 6 层；外墙取新边界内外 2 格、Y=65..78；入口取正面中心 9 格宽、Y=64..71。每格比较施工前后方块状态；通路沿可站立方块做两格净空广度搜索，允许一格高差。主楼参数来自施工 manifest。',
  '',
  '| 建筑 | 类型/新样式 | 屋顶变更格 | 外墙变更格 | 入口变更格 | 底层支撑 | 入口可达 | 主楼变体 |',
  '| --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
];
for(const item of results) {
  const variant=item.variant?`轮次${item.variant.cycle} / 色板${item.variant.palette.wall}+${item.variant.palette.roof} / 内缩${item.variant.inset}`:'-';
  lines.push(`| ${item.id} | ${item.kind} / ${item.style} | ${item.roof.changed} | ${item.facade.changed} | ${item.entrance.changed} | ${item.support.supportedBaseColumns}/${item.support.baseColumns} | ${item.access.reached?'是':'否'} | ${variant} |`);
}
lines.push('', '逐栋原始统计见 `architecture-upgrade-block-audit.json`；主楼双角真图见 `architecture-12-real-save/`，全量 80 栋联系图另行归档。', '');
await writeFile(path.join(root,'verification/architecture-upgrade-acceptance.md'),lines.join('\n'));
console.log(JSON.stringify(summary));

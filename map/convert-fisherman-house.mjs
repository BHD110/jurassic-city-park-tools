import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nbt from 'prismarine-nbt';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'references/assets/fisherman-house-heldorya.litematic');
const bytes = await readFile(source);
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== '156cf1873340d4b297dc05e33ce67c29502302c3dd05af4846de84708094caba') throw Error('source changed');
const data = nbt.simplify((await nbt.parse(bytes)).parsed);
if (data.Version !== 7 || data.MinecraftDataVersion !== 3955) throw Error('unexpected Litematica version');
const regions = Object.entries(data.Regions);
if (!regions.length) throw Error('no regions');
const cells = new Map();
const regionInfo = [];
let discardedEntities=0, discardedBlockEntities=0;
let skippedBarriers=0;
for (const [name, region] of regions) {
  const size = region.Size;
  const extent = [Math.abs(size.x),Math.abs(size.y),Math.abs(size.z)];
  const [width,height,length]=extent;
  const volume=width*height*length;
  const palette = region.BlockStatePalette.map(entry => {
    const block=entry.Name;
    if (!block.startsWith('minecraft:') || /command_block|structure_block|jigsaw|spawner/.test(block)) throw Error(`unsafe block ${block}`);
    const props=entry.Properties;
    return props ? `${block}[${Object.entries(props).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join(',')}]` : block;
  });
  const bits=Math.max(2,Math.ceil(Math.log2(palette.length)));
  const longs=region.BlockStates.map(v=>BigInt.asUintN(64,BigInt(v.toString())));
  if(longs.length!==Math.ceil(volume*bits/64)) throw Error(`packed length mismatch for ${name}`);
  const mask=(1n<<BigInt(bits))-1n;
  let nonAir=0;
  for(let i=0;i<volume;i++) {
    const bit=i*bits, word=Math.floor(bit/64), offset=bit%64;
    let state=(longs[word]>>BigInt(offset))&mask;
    if(offset+bits>64) state=((longs[word]>>BigInt(offset))|(longs[word+1]<<BigInt(64-offset)))&mask;
    const block=palette[Number(state)];
    if (!block) throw Error(`bad palette index ${state}`);
    if(block==='minecraft:air') continue;
    if(block==='minecraft:barrier') { skippedBarriers++; continue; }
    const x=i%width,z=Math.floor(i/width)%length,y=Math.floor(i/(width*length));
    const rx=region.Position.x+(size.x<0?-x:x);
    const ry=region.Position.y+(size.y<0?-y:y);
    const rz=region.Position.z+(size.z<0?-z:z);
    const key=`${rx},${ry},${rz}`;
    if(cells.has(key)) throw Error(`region overlap ${key}`);
    cells.set(key,block); nonAir++;
  }
  regionInfo.push({name,size,position:region.Position,dimensions:{width,height,length},paletteStates:palette.length,nonAir});
  discardedEntities+=region.Entities?.length||0;
  discardedBlockEntities+=region.TileEntities?.length||0;
}
const coords=[...cells.keys()].map(k=>k.split(',').map(Number));
const minima=[0,1,2].map(i=>Math.min(...coords.map(c=>c[i])));
const maxima=[0,1,2].map(i=>Math.max(...coords.map(c=>c[i])));
const ops=[];
const counts={};
for(let y=minima[1];y<=maxima[1];y++) for(let z=minima[2];z<=maxima[2];z++) {
  let start=null,prev=null,block=null;
  function flush(){if(start!==null)ops.push({kind:'box',x1:start,y1:y,z1:z,x2:prev,y2:y,z2:z,block});}
  for(let x=minima[0];x<=maxima[0]+1;x++) {
    const next=x<=maxima[0]?cells.get(`${x},${y},${z}`):undefined;
    if(next!==block){flush();start=next?x:null;block=next;}
    if(next)prev=x;
  }
}
for(const block of cells.values()) counts[block.split('[')[0]]=(counts[block.split('[')[0]]||0)+1;
const metadata={asset:'Fisherman House by Heldorya Studio',source:'https://abfielder.com/Products/ProductDetails.php?id=11656',sourceSha256:hash,format:'Litematica',version:data.Version,dataVersion:data.MinecraftDataVersion,regions:regionInfo,sourceBounds:{x1:minima[0],y1:minima[1],z1:minima[2],x2:maxima[0],y2:maxima[1],z2:maxima[2]},blocksImported:cells.size,operations:ops.length,skippedBarriers,entitiesSkipped:discardedEntities,blockEntitiesSkipped:discardedBlockEntities,blockEntityPolicy:'Do not transfer source NBT. Signs blank; containers empty; decorative entities omitted.',blockCounts:counts};
const plan={name:'Fisherman House Local-Origin Source Plan',bounds:{x1:minima[0],z1:minima[2],x2:maxima[0],z2:maxima[2]},operations:ops,metadata};
await writeFile(path.join(root,'generated/imported-fisherman-local.json'),JSON.stringify(plan));
console.log(JSON.stringify({output:'map/generated/imported-fisherman-local.json',metadata},null,2));

import {readFile} from 'node:fs/promises';
import {inflateSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';
export function worldReader(world) {
  const regions=new Map(), chunks=new Map();
  async function chunkAt(cx,cz){
    const key=`${cx},${cz}`;if(chunks.has(key))return chunks.get(key);
    const file=path.join(world,'region',`r.${Math.floor(cx/32)}.${Math.floor(cz/32)}.mca`);
    if(!regions.has(file))regions.set(file,await readFile(file));
    const bytes=regions.get(file),sector=bytes.readUIntBE(((cz&31)*32+(cx&31))*4,3);
    if(!sector)return null;
    const offset=sector*4096,length=bytes.readUInt32BE(offset),compression=bytes[offset+4];
    if(length<1||offset+length+4>bytes.length)throw new Error(`Corrupt chunk: ${key}`);
    const payload=bytes.subarray(offset+5,offset+4+length);
    const raw=compression===2?inflateSync(payload):compression===1?gunzipSync(payload):compression===3?payload:null;
    if(!raw)throw new Error(`Unsupported compression ${compression}`);
    const value=nbt.simplify(nbt.parseUncompressed(raw,'big'));chunks.set(key,value);return value;
  }
  return {async blockEntity(x,y,z){
    const chunk=await chunkAt(Math.floor(x/16),Math.floor(z/16));
    return chunk?.block_entities?.find(entity=>entity.x===x&&entity.y===y&&entity.z===z);
  },async block(x,y,z){
    const chunk=await chunkAt(Math.floor(x/16),Math.floor(z/16));
    const state=chunk?.sections?.find(s=>s.Y===Math.floor(y/16))?.block_states;
    if(!state?.palette)return null;
    if(state.palette.length===1)return state.palette[0];
    const bits=Math.max(4,Math.ceil(Math.log2(state.palette.length))),perLong=Math.floor(64/bits);
    const index=((y&15)<<8)|((z&15)<<4)|(x&15),word=BigInt(state.data[Math.floor(index/perLong)]);
    return state.palette[Number((word>>BigInt(index%perLong*bits))&((1n<<BigInt(bits))-1n))];
  }};
}

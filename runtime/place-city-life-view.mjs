import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';
const world=process.argv[2];if(!world)throw new Error('Pass a closed world');
function place(p){p.Pos={type:'list',value:{type:'double',value:[630.5,65,-640.5]}};p.Rotation={type:'list',value:{type:'float',value:[-45,6]}};p.Motion={type:'list',value:{type:'double',value:[0,0,0]}};p.FallDistance={type:'float',value:0};}
const file=path.join(world,'level.dat'),tree=(await nbt.parse(await readFile(file),'big')).parsed;
if(tree.value.Data.value.Player)place(tree.value.Data.value.Player.value);
await writeFile(file,gzipSync(nbt.writeUncompressed(tree,'big')));
const playerFile=path.join(world,'playerdata','00000000-0000-3000-8000-000000000001.dat');
const player=await readFile(playerFile).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
if(player){const data=(await nbt.parse(player,'big')).parsed;place(data.value);await writeFile(playerFile,gzipSync(nbt.writeUncompressed(data,'big')));}
console.log(JSON.stringify({position:[630.5,65,-640.5],view:'northeast city near traffic and pedestrians'}));

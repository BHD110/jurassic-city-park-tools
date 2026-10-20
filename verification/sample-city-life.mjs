import {writeFile} from 'node:fs/promises';
import {connect} from '../runtime/city-life-control.mjs';
const client=await connect(),samples=[],duration=Number(process.argv[2]||150);
const tags=['city_life_traffic_northeast_1',...Array.from({length:6},(_,i)=>`city_life_npc_${String(i+1).padStart(3,'0')}`)];
const started=Date.now();
try{while(Date.now()-started<duration*1000){const row={elapsed:(Date.now()-started)/1000,positions:{}};
  for(const tag of tags){const reply=await client.command(`data get entity @e[tag=${tag},limit=1] Pos`);const m=reply.match(/\[([^\]]+)\]/);row.positions[tag]=m?m[1].split(',').map(x=>Number(x.trim().replace(/[dDfF]$/,''))):null;}
  samples.push(row);await writeFile('verification/city-life-movement.json',JSON.stringify({started:new Date(started).toISOString(),samples},null,2));
  await new Promise(r=>setTimeout(r,2000));
}}finally{client.close();}
const summary={duration,samples:samples.length,moved:tags.map(tag=>{const positions=samples.map(s=>s.positions[tag]).filter(Boolean);return {tag,maxDisplacement:Math.max(0,...positions.map(p=>Math.hypot(p[0]-positions[0][0],p[2]-positions[0][2]))),start:positions[0],end:positions.at(-1)};})};
await writeFile('verification/city-life-movement-summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));

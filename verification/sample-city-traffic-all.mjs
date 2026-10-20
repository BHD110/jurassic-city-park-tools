import {readFile,writeFile} from 'node:fs/promises';
import {connect} from '../runtime/city-life-control.mjs';
const c=await connect(),plan=JSON.parse(await readFile('map/generated/city-traffic.json','utf8'));
const p=JSON.parse(await readFile('map/generated/city-pedestrians.json','utf8'));
const routeId=process.argv[4],routes=routeId?plan.metadata.routes.filter(r=>r.id===routeId):plan.metadata.routes;
const people=routeId?p.points.filter(x=>x.x>780&&x.x<980&&x.z>600&&x.z<780).slice(0,2):p.points.slice(0,2);
const tags=routes.flatMap(r=>r.cars.map((_,i)=>`city_life_traffic_${r.id}_${i+1}`)).concat(people.map(x=>x.tag));
const samples=[],started=Date.now(),duration=Number(process.argv[2]||50),name=process.argv[3]||'city-life-all-movement';
try{for(const a of people)await c.command(`forceload add ${Math.floor(a.x)-16} ${Math.floor(a.z)-16} ${Math.floor(a.x)+16} ${Math.floor(a.z)+16}`);
 while(Date.now()-started<duration*1000){const positions={};for(const tag of tags){const reply=await c.command(`data get entity @e[tag=${tag},limit=1] Pos`);const m=reply.match(/\[([^\]]+)\]/);positions[tag]=m?m[1].split(',').map(x=>Number(x.trim().replace(/[dDfF]$/,''))):null;}samples.push({seconds:(Date.now()-started)/1000,positions});await new Promise(r=>setTimeout(r,2000));}
}finally{c.close();}
const summary=tags.map(tag=>{const v=samples.map(s=>s.positions[tag]).filter(Boolean);let travel=0;for(let i=1;i<v.length;i++)travel+=Math.hypot(v[i][0]-v[i-1][0],v[i][2]-v[i-1][2]);return {tag,observed:v.length,travel,start:v[0],end:v.at(-1)};});
await writeFile(`verification/${name}.json`,JSON.stringify({duration,samples,summary},null,2));console.log(JSON.stringify(summary));

import {readFile,writeFile} from 'node:fs/promises';
import {connect} from './city-life-control.mjs';
const plan=JSON.parse(await readFile('map/generated/city-traffic.json','utf8')),c=await connect(),log=[];
const command=async command=>{const reply=await c.command(command);log.push({command,reply});return reply;};
try{
 for(const route of plan.metadata.routes)for(const car of route.cars.slice(0,3))await command(`forceload add ${Math.floor(car.x)} ${Math.floor(car.z)}`);
 await new Promise(r=>setTimeout(r,2000));
 for(const route of plan.metadata.routes)for(let i=0;i<3;i++){
  const a=route.cars[i],tag=`city_life_traffic_${route.id}_${i+1}`;
  await command(`data merge entity @e[tag=${tag},limit=1] {Invulnerable:0b,engineSpeed:0f,burningOut:0b}`);
  await command(`tp @e[tag=${tag},limit=1] ${a.x} 64 ${a.z} ${a.yaw} 0`);
 }
 await command('save-all flush');
}finally{c.close();await writeFile('verification/city-life-traffic-relocate.json',JSON.stringify(log,null,2));}
console.log(JSON.stringify({commands:log.length,unexpected:log.filter(x=>!/Marked|already|Teleported|Modified|Saving|Saved/.test(x.reply))}));

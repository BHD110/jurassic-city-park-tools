import {readFile,writeFile} from 'node:fs/promises';
const people=JSON.parse(await readFile('map/generated/city-pedestrians-v2.json','utf8'));
const cars=JSON.parse(await readFile('map/generated/city-vehicles-v2.json','utf8'));
const operations=[];
const carLocations=new Map(cars.metadata.routes.flatMap(r=>r.vehicles).map(v=>[v.tag,v]));
for(const op of cars.operations){const c=op.command;if(c?.startsWith('kill '))continue;
 const m=c?.match(/^execute if block (-?\d+) (\d+) (-?\d+) ([^ ]+) run setblock (-?\d+) (\d+) (-?\d+) (.+)$/);
 if(m){const [x,y,z]=m.slice(1,4).map(Number);operations.push({kind:'box',x1:x,y1:y,z1:z,x2:x,y2:y,z2:z,block:m[8],replace:m[4]});continue;}
 const s=c?.match(/run summon automobility:automobile ([-\d.]+) ([-\d.]+) ([-\d.]+) (.+)$/);
 if(s){const [x,y,z]=s.slice(1,4).map(Number),nbt=s[4],tag=nbt.match(/"(city_v2_traffic_[^"]+)"/)[1];operations.push({kind:'spawn',entity:'automobility:automobile',x,y,z,yaw:carLocations.get(tag).yaw,nbt});continue;}
 throw new Error('Unrecognized operation: '+c);
}
operations.push(...people.operations);
const plan={name:'City v2 urban cars and dense pedestrians',bounds:people.bounds,operations,metadata:{pedestrians:people.points.length,newPedestrians:people.operations.length,cars:cars.metadata.vehicleCount,buses:cars.metadata.busCount}};
await writeFile('map/generated/city-v2-install.json',JSON.stringify(plan));console.log(JSON.stringify({...plan,operations:plan.operations.length}));

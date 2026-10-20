import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {connect} from '../runtime/city-life-control.mjs';

const client=await connect();
const snapshots=[];
const seconds=Number(process.argv[2]||30);
if(!Number.isFinite(seconds)||seconds<10||seconds>60)throw new Error('Sample duration must be 10..60 seconds');
try {
  for(let i=0;i<=Math.ceil(seconds/5);i++) {
    if(i)await new Promise(resolve=>setTimeout(resolve,5000));
    await client.command('citytraffic audit');
    snapshots.push(JSON.parse(await readFile('runtime/server/citytraffic-audit.json','utf8')));
  }
} finally {client.close();}
const cars=new Map();
for(const snapshot of snapshots)for(const car of snapshot.cars) {
  if(!cars.has(car.id))cars.set(car.id,[]);
  cars.get(car.id).push(car);
}
const samples=[...cars].filter(([,rows])=>rows.length>=3).map(([id,rows])=>{
  let drivenDistance=0, recoveryEvents=0, movingSamples=0;
  for(let i=1;i<rows.length;i++) {
    const a=rows[i-1],b=rows[i];
    recoveryEvents+=Math.max(0,b.recoveryCount-a.recoveryCount);
    if(b.recoveryCount===a.recoveryCount)drivenDistance+=Math.hypot(b.x-a.x,b.z-a.z);
    if(b.velocity>0.15)movingSamples++;
  }
  return {id,model:rows[0].model,observations:rows.length,drivenDistance,recoveryEvents,
    movingSamples,engineRunning:rows.at(-1).engineRunning,lastBlocked:rows.at(-1).blocked,
    lastPosition:[rows.at(-1).x,rows.at(-1).z],stalledTicks:rows.at(-1).stalledTicks};
});
const moved=samples.filter(c=>c.drivenDistance>=3&&c.movingSamples>0);
const models={};
for(const car of samples) {
  const group=models[car.model]||={sampled:0,driving:0,recoveries:0};
  group.sampled++;group.driving+=Number(moved.includes(car));group.recoveries+=car.recoveryEvents;
}
const report={checkedAt:new Date().toISOString(),durationSeconds:seconds,
  summaries:snapshots.map(s=>s.summary),sampled:samples.length,driving:moved.length,
  drivingFraction:moved.length/Math.max(1,samples.length),models,samples};
await writeFile('verification/road-traffic-movement.json',JSON.stringify(report,null,2)+'\n');
await copyFile('verification/road-traffic-movement.json',`verification/road-traffic-movement-${Date.now()}.json`);
console.log(JSON.stringify({...report,samples:samples.filter(c=>!moved.includes(c))}));

import {readFile,writeFile} from 'node:fs/promises';
import {connect} from './city-life-control.mjs';
const mode=process.argv[2], client=await connect(), replies=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function command(c){const reply=await client.command(c);replies.push({command:c,reply});return reply;}
try {
  if(mode==='traffic-candidate'){
    await command('forceload add 592 -784 784 -592');await sleep(4000);
    const plan=JSON.parse(await readFile('map/generated/city-traffic-candidate.json','utf8'));
    for(const op of plan.operations)await command(op.command);
  }else if(mode==='traffic-full'){
    // The starting snapshot had no forced chunks. Replace only our temporary test loads.
    await command('forceload remove all');
    const plan=JSON.parse(await readFile('map/generated/city-traffic.json','utf8'));
    const chunks=new Set();
    for(const r of plan.metadata.routes){const {x1,x2,z1,z2}=r.bounds;
      for(let x=Math.floor((x1+4)/16);x<=Math.floor((x2-4)/16);x++)for(const z of [Math.floor((z1+4)/16),Math.floor((z2-4)/16)])chunks.add(`${x*16} ${z*16}`);
      for(let z=Math.floor((z1+4)/16);z<=Math.floor((z2-4)/16);z++)for(const x of [Math.floor((x1+3)/16),Math.floor((x1+5)/16),Math.floor((x2-5)/16),Math.floor((x2-3)/16)])chunks.add(`${x*16} ${z*16}`);
    }
    for(const chunk of chunks)await command(`forceload add ${chunk}`);
    await sleep(3000);
    for(const op of plan.operations)await command(op.command);
  }else if(mode==='npc-sample'||mode==='npcs'||mode==='npcs-double'||mode==='npc-walking'){
    const plan=JSON.parse(await readFile('map/generated/city-pedestrians.json','utf8'));
    const points=mode==='npc-sample'?plan.points.slice(0,6):mode==='npcs-double'?plan.points.slice(plan.originalCount):plan.points;
    for(let i=0;i<points.length;i++){
      const p=points[i], x=Math.floor(p.x),z=Math.floor(p.z);
      await command(`forceload add ${x} ${z}`);await sleep(150);
      if(mode==='npc-walking')await command(`execute as @e[tag=${p.tag},limit=1] run data merge entity @s {ObjectiveData:{ObjectiveDataSet:[{Type:"FLOAT"},{Type:"MOVE_BACK_TO_HOME",SpeedModifier:0.65d,StopDistance:14.0f},{Type:"RANDOM_STROLL_AROUND_HOME",SpeedModifier:0.4d},{Type:"LOOK_AT_PLAYER"},{Type:"LOOK_RANDOM_AROUND"}]}}`);
      else await command(plan.commands[plan.points.indexOf(p)]);
      if(mode!=='npc-sample')await command(`forceload remove ${x} ${z}`);
    }
  }else throw new Error('Unknown mode');
  await command('save-all flush');
}finally{client.close();}
await writeFile(`verification/city-life-${mode}-apply.json`,JSON.stringify(replies,null,2));
const unexpected=replies.filter(r=>/Unknown|Incorrect|Unable|not loaded|Invalid|not found|could not|Failed|Expected/i.test(r.reply));
console.log(JSON.stringify({mode,commands:replies.length,unexpected:unexpected.slice(0,10)},null,2));

import {readFile,writeFile} from 'node:fs/promises';
import {connect} from './city-life-control.mjs';

const names=['clear-coaster-supports','clear-city-roads','lift-coaster-over-roads'];
const plans=await Promise.all(names.map(async name=>JSON.parse(await readFile(`map/generated/${name}.json`,'utf8'))));
const operations=plans.flatMap(plan=>plan.operations);
await writeFile('map/generated/road-clearance.json',JSON.stringify({
  name:'Road clearance, wider lanes and coaster crossing repair',
  bounds:plans[1].bounds,operations,sources:names
}));
const client=await connect();
try {
  const validation=await client.command('parkbuild validate road-clearance');
  console.log(validation);
  if(!validation.includes('invalid=0'))throw new Error('Plan validation failed');
  console.log(await client.command('parkbuild start road-clearance'));
  for(let i=0;i<150;i++) {
    await new Promise(resolve=>setTimeout(resolve,2000));
    const status=await client.command('parkbuild status');
    if(i%10===0||status.includes('done=true'))console.log(status);
    if(status.includes('error=')&&!status.endsWith('error='))throw new Error(status);
    if(status.includes('done=true')) {
      console.log(await client.command('save-all flush'));
      process.exitCode=0;
      break;
    }
    if(i===149)throw new Error('Construction timeout');
  }
} finally {client.close();}

import {readFile, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';

const planFile='map/generated/park-tour-route.json';
const plan=JSON.parse(await readFile(planFile,'utf8'));
const backup=JSON.parse(await readFile('verification/park-tour-backup.json','utf8'));
for(const world of backup.worlds) {
  const report=JSON.parse(await readFile(`verification/park-tour-${world.kind}-check.json`,'utf8'));
  if(!report.passed||report.routeSha256!==plan.metadata.routeSha256)throw new Error('World verification required');
  await copyFile(planFile,path.join(world.source,'park-tour-route.json'));
}
const file='map/generated/upgrade-full.json';
const full=JSON.parse(await readFile(file,'utf8'));
if(full.metadata.parkTour) {
  if(full.metadata.parkTour.routeSha256!==plan.metadata.routeSha256)throw new Error('A different tour already exists');
} else {
  full.operations.push(...plan.operations);
  full.metadata.parkTour={...plan.metadata,plan:'park-tour-route',routeLength:plan.route.length,
    recordedAt:new Date().toISOString()};
  await writeFile(file,JSON.stringify(full)+'\n');
}
const receipt={installedWorlds:backup.worlds.map(w=>w.source),backup:backup.backup,
  routeLength:plan.route.length,height:plan.metadata.height,glassHeight:1,
  glassBlocks:plan.metadata.glassBlocks,station:plan.route.station,
  boardingButton:plan.metadata.button,enclosures:plan.metadata.enclosureCoverage.map(e=>e.name),
  originalCoasterRetained:true,openedGame:false,fullRideTested:false};
await writeFile('verification/park-tour-installed.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));

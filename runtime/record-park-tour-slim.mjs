import {readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';

const planFile='map/generated/park-tour-route.json';
const plan=JSON.parse(await readFile(planFile,'utf8'));
const delta=JSON.parse(await readFile('map/generated/park-tour-slim.json','utf8'));
const backup=JSON.parse(await readFile('verification/park-tour-slim-backup.json','utf8'));
for(const world of backup.worlds) {
  const report=JSON.parse(await readFile(`verification/park-tour-slim-${world.kind}-check.json`,'utf8'));
  if(!report.passed||report.deckWidth!==1||report.routeSha256!==plan.metadata.routeSha256)throw new Error('Verified narrow world required');
  await copyFile(planFile,path.join(world.source,'park-tour-route.json'));
}
const file='map/generated/upgrade-full.json';
const full=JSON.parse(await readFile(file,'utf8'));
if(full.metadata.parkTourSlim&&full.metadata.parkTourSlim.sha256!==delta.metadata.sha256)throw new Error('Different narrow profile already recorded');
if(!full.metadata.parkTourSlim)full.operations.push(...delta.operations);
full.metadata.parkTour={...plan.metadata,plan:'park-tour-route',routeLength:plan.route.length};
full.metadata.parkTourSlim=delta.metadata;
await writeFile(file,JSON.stringify(full)+'\n');
const receipt=JSON.parse(await readFile('verification/park-tour-installed.json','utf8'));
receipt.profile='t-shaped-v1';
receipt.deckWidth=1;
receipt.glassBlocks=plan.metadata.glassBlocks;
receipt.insideCornerPanes=plan.metadata.insideCornerPanes;
receipt.previousBackup=receipt.previousBackup||receipt.backup;
receipt.backup=backup.backup;
receipt.updatedAt=new Date().toISOString();
receipt.removedDeckBlocks=delta.metadata.removedDeckBlocks;
receipt.boardingPlatformRetained=true;
await writeFile('verification/park-tour-installed.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));

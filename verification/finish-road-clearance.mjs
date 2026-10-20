import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const json=async file=>JSON.parse(await readFile(file,'utf8'));
const fullFile='map/generated/upgrade-full.json';
const full=await json(fullFile);
if(!full.metadata.roadClearance) {
  for(const name of ['clear-city-roads','clear-roadside-block-bus']) {
    full.operations.push(...(await json(`map/generated/${name}.json`)).operations);
  }
  full.metadata.roadClearance={date:'2026-10-18',roadLaneOffsets:{main:4,local:3},
    localAsphaltWidth:11,localSidewalkWidth:2,mainSidewalkWidth:2};
  await writeFile(fullFile,JSON.stringify(full));
}
const clearance=await json('verification/road-clearance-after.json');
const coaster=await json('verification/road-clearance-coaster.json');
const movement=await json('verification/road-traffic-movement.json');
const vehicles=await json('verification/iv-traffic-save.json');
const population=await json('verification/city-upgrade-population.json');
const piers=await json('map/generated/clear-coaster-supports.json');
const lift=await json('map/generated/lift-coaster-over-roads.json');
const artifactHash=createHash('sha256').update(await readFile('runtime/server/mods/parkbuilder-1.0.0.jar')).digest('hex');
const failures=[];
if(clearance.obstacleCount||clearance.unsupported.length)failures.push('Route clearance');
if(coaster.status!=='passed')failures.push('Coaster integrity');
if(!vehicles.passed||!population.passed)failures.push('Population preservation');
if(movement.sampled<10||movement.drivingFraction<0.7)failures.push('Traffic movement');
for(const model of ['hyundai_new_county','hyundai_eleccity']) {
  if(!movement.models[model]?.driving)failures.push(`Bus not observed driving: ${model}`);
}
const report={checkedAt:new Date().toISOString(),backup:'backups/before-road-clearance-20261018-105607',
  routeColumns:clearance.columns,remainingObstacles:clearance.obstacleCount,
  roadGaps:clearance.unsupported.length,removedPiers:piers.stats.removedPillars,
  removedPierBlocks:piers.stats.removedBlocks,liftedRailCells:lift.stats.changedRailCells,
  railPoints:coaster.checkedPoints,vehicles:vehicles.vehicles,npcs:population.npcCount,
  dinosaurs:population.dinosaurCount,movement:{sampled:movement.sampled,driving:movement.driving,
    models:movement.models,recoveryEvents:movement.samples.reduce((sum,c)=>sum+c.recoveryEvents,0)},
  installedModSha256:artifactHash,failures,passed:!failures.length};
await writeFile('verification/road-clearance-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
process.exitCode=failures.length?1:0;

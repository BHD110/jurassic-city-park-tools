import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const plans = await Promise.all(['visitor-floor-repair', 'interior-lighting'].map(async name =>
  JSON.parse(await readFile(`map/generated/${name}.json`, 'utf8'))));
const operations = plans.flatMap(plan => plan.operations.map(op => {
  if (!op.expectedBlock) throw new Error('Missing block precondition');
  return {...op, replace: op.expectedBlock};
}));
const bounds = {};
for (const axis of ['x', 'y', 'z']) {
  bounds[`${axis}1`] = Math.min(...operations.map(op => op[`${axis}1`]));
  bounds[`${axis}2`] = Math.max(...operations.map(op => op[`${axis}2`]));
}
const digest = createHash('sha256').update(JSON.stringify(operations)).digest('hex');
const patch = {name: 'Jurassic City Interior Repair and Lighting', bounds,
  metadata: {sha256: digest, parts: plans.map(p => ({name: p.name, metadata: p.metadata}))}, operations};
if (process.argv.includes('--record')) {
  const file = 'map/generated/upgrade-full.json';
  const full = JSON.parse(await readFile(file, 'utf8'));
  full.metadata ||= {};
  if (full.metadata.interiorRepair) {
    if (full.metadata.interiorRepair.sha256 !== digest) throw new Error('Different interior repair already recorded');
    console.log('Interior repair already recorded');
  } else {
    full.operations.push(...operations);
    full.metadata.interiorRepair = {sha256: digest, recordedAt: new Date().toISOString(),
      operationCount: operations.length, parts: patch.metadata.parts};
    await writeFile(file, JSON.stringify(full) + '\n');
    console.log(`Recorded ${operations.length} interior operations`);
  }
} else {
  await writeFile('map/generated/interior-upgrade.json', JSON.stringify(patch) + '\n');
  console.log(JSON.stringify({operations: operations.length, sha256: digest, bounds}));
}

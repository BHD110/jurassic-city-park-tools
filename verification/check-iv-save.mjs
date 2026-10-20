import { readFile, writeFile } from 'node:fs/promises';
import { entities } from './check-city-life.mjs';

const world = process.argv[2] || 'runtime/server/jurassic-city-v2';
const all = await entities(world);
const cars = all.filter(e => e.id === 'mts:builder_existing' && e.entityid === 'EntityVehicleF_Physics');
const plan = JSON.parse(await readFile('map/generated/iv-traffic.json', 'utf8'));
const state = JSON.parse(await readFile(`${world}/citytraffic-state.json`, 'utf8'));
const actual = new Set(cars.map(e => e.uniqueUUID));
const missingAssignments = state.assignments.filter(e => !actual.has(e.uuid));
const models = {};
for (const car of cars) models[car.systemName] = (models[car.systemName] || 0) + 1;
const busModels = new Set(['hyundai_new_county', 'hyundai_eleccity', 'hyundai_nsac']);
const busCount = cars.filter(e => busModels.has(e.systemName)).length;
const duplicateVehicleIds = cars.length - actual.size;
const failures = [];
if (cars.length !== plan.cars.length || state.assignments.length !== plan.cars.length) failures.push('Vehicle count/assignment mismatch');
if (missingAssignments.length || duplicateVehicleIds) failures.push('Vehicle UUID mismatch');
if (busCount !== plan.cars.filter(e => busModels.has(e.model)).length) failures.push('Bus count mismatch');
const report = { checkedAt: new Date().toISOString(), world, vehicles: cars.length,
  tracked: state.assignments.length, planned: plan.cars.length, buses: busCount,
  models, missingAssignments: missingAssignments.length, duplicateVehicleIds, failures, passed: !failures.length };
await writeFile('verification/iv-traffic-save.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exitCode = failures.length ? 1 : 0;

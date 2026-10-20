import { readFile, writeFile } from 'node:fs/promises';
import { entities } from './check-city-life.mjs';

const world = process.argv[2] || 'runtime/server/jurassic-city-v2';
const planPath = 'map/generated/iv-traffic.json';
const retiredPath = 'map/generated/iv-traffic-retired.json';
const plan = JSON.parse(await readFile(planPath, 'utf8'));
const retired = JSON.parse(await readFile(retiredPath, 'utf8'));
const state = JSON.parse(await readFile(`${world}/citytraffic-state.json`, 'utf8'));
const vehicles = (await entities(world)).filter(entity =>
  entity.id === 'mts:builder_existing' && entity.entityid === 'EntityVehicleF_Physics');
const byUuid = new Map(vehicles.map(vehicle => [vehicle.uniqueUUID, vehicle.systemName]));
const byId = new Map(state.assignments.map(assignment => [assignment.id, byUuid.get(assignment.uuid)]));
if (vehicles.length !== byUuid.size || state.assignments.length !== byId.size ||
    plan.cars.length !== byId.size || [...byId.values()].some(model => !model) ||
    plan.cars.some(car => !byId.has(car.id))) {
  throw new Error('Saved vehicles, assignments, and plan IDs must match before syncing models');
}
let changed = 0;
for (const car of plan.cars) {
  const model = byId.get(car.id);
  if (car.model !== model) changed++;
  car.model = model;
}
for (const car of retired) {
  if (!byId.has(car.id)) throw new Error(`Retired vehicle missing: ${car.id}`);
  car.model = byId.get(car.id);
}
await writeFile(planPath, JSON.stringify(plan, null, 2) + '\n');
await writeFile(retiredPath, JSON.stringify(retired, null, 2) + '\n');
console.log(JSON.stringify({ vehicles: vehicles.length, updatedModels: changed,
  buses: plan.cars.filter(car => ['hyundai_new_county', 'hyundai_eleccity', 'hyundai_nsac'].includes(car.model)).length }));

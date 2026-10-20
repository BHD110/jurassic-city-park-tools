import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const receipt = JSON.parse(await readFile('verification/interior-singleplayer-export.json', 'utf8'));
const plan = JSON.parse(await readFile(path.join(receipt.sourceWorld, 'citytraffic-plan.json'), 'utf8'));
const state = JSON.parse(await readFile(path.join(receipt.sourceWorld, 'citytraffic-state.json'), 'utf8'));
const routes = new Set(plan.routes.map(route => route.id));
const cars = new Map(plan.cars.map(car => [car.id, car]));
const repaired = [];
for (const assignment of state.assignments) {
  if (routes.has(assignment.route)) continue;
  const planned = cars.get(assignment.id);
  if (!planned || !routes.has(planned.route)) throw new Error(`No current route for ${assignment.id}`);
  repaired.push({id: assignment.id, previousRoute: assignment.route, route: planned.route});
  assignment.route = planned.route;
}
const content = JSON.stringify(state, null, 2) + '\n';
for (const world of [receipt.sourceWorld, receipt.releasedWorld, receipt.installedSave]) {
  await writeFile(path.join(world, 'citytraffic-state.json'), content);
}
await writeFile('verification/interior-traffic-route-normalization.json', JSON.stringify({
  repaired, count: repaired.length, changedVehicleEntities: false,
  preservedAssignmentCount: state.assignments.length,
}, null, 2) + '\n');
console.log(JSON.stringify({normalizedOldRouteNames: repaired.length, vehicles: state.assignments.length}));

import { readFile, writeFile } from 'node:fs/promises';

const source = 'map/generated/city-pedestrians-v2.json';
const plan = JSON.parse(await readFile(source, 'utf8'));
if (plan.points.length !== 4372 || plan.operations.length !== 3998) {
  throw new Error('NPC plan count changed; inspect before applying radius update');
}
const radius = 30;
const replaceRadius = value => value.replace(/StopDistance:\d+(?:\.\d+)?f/g, `StopDistance:${radius}.0f`);
plan.commands = plan.commands.map(replaceRadius);
plan.operations = plan.operations.map(operation => ({ ...operation, nbt: replaceRadius(operation.nbt) }));
plan.existingGoalUpdates = plan.existingGoalUpdates.map(update => ({
  ...update, stopDistance: radius, objectiveData: replaceRadius(update.objectiveData),
}));
plan.report.movementRadius = radius;
const output = 'map/generated/city-pedestrians-radius-30.json';
await writeFile(output, `${JSON.stringify(plan)}\n`);
console.log(JSON.stringify({ output, total: plan.points.length, new: plan.operations.length, radius }));

import { readFile, writeFile } from 'node:fs/promises';

const [beforeFile, afterFile, output = 'verification/persistence-audit.json', expectedArg] = process.argv.slice(2);
if (!beforeFile || !afterFile) throw new Error('Usage: node verification/compare-save-audits.mjs <before.json> <after.json> [report-path]');
const before = JSON.parse(await readFile(beforeFile, 'utf8'));
const after = JSON.parse(await readFile(afterFile, 'utf8'));
const key = animal => JSON.stringify(animal.uuid);
const previous = new Map(before.dinosaurs.map(animal => [key(animal), animal]));
const current = new Map(after.dinosaurs.map(animal => [key(animal), animal]));
const failures = [];
if (!before.passed || !after.passed) failures.push('Both world audits must pass.');
const expected = expectedArg === undefined ? before.totalDinosaurs : Number(expectedArg);
if (!Number.isInteger(expected) || before.totalDinosaurs !== expected || after.totalDinosaurs !== expected) failures.push(`Both snapshots must contain ${expected} dinosaurs.`);
if (previous.size !== expected || current.size !== expected) failures.push('Dinosaur UUIDs must be unique.');
for (const uuid of previous.keys()) if (!current.has(uuid)) failures.push(`Dinosaur missing after reload: ${uuid}`);
for (const uuid of current.keys()) if (!previous.has(uuid)) failures.push(`Unexpected dinosaur after reload: ${uuid}`);
const movement = {};
for (const animal of after.dinosaurs) {
  const prior = previous.get(key(animal));
  if (!prior) continue;
  if (prior.id !== animal.id) failures.push(`Species changed for ${key(animal)}`);
  if (!(animal.health > 0) || animal.noAI) failures.push(`Dinosaur unhealthy after reload: ${key(animal)}`);
  const distance = Math.hypot(...animal.position.map((coordinate, index) => coordinate - prior.position[index]));
  const result = movement[animal.id] ??= { count: 0, moved: 0, greatestDistance: 0 };
  result.count++;
  if (distance >= 0.25) result.moved++;
  result.greatestDistance = Math.max(result.greatestDistance, distance);
}
const speciesWithMovement = Object.entries(movement).filter(([, result]) => result.moved > 0).map(([species]) => species);
const report = {
  inspectedAt: new Date().toISOString(), beforeFile, afterFile,
  beforeTime: before.inspectedAt, afterTime: after.inspectedAt,
  retainedUUIDs: [...previous.keys()].filter(uuid => current.has(uuid)).length,
  movement, speciesWithMovement, activityObserved: speciesWithMovement.length > 0,
  activityObservedInEverySpecies: speciesWithMovement.length === Object.keys(movement).length,
  failures, passed: failures.length === 0
};
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;

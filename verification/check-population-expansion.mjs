import { readFile, writeFile } from 'node:fs/promises';

const [beforePath = 'verification/population-pre-spawn-audit.json',
  afterPath = 'verification/population-after-spawn-audit.json',
  reportPath = 'verification/population-expansion-check.json'] = process.argv.slice(2);
const before = JSON.parse(await readFile(beforePath));
const after = JSON.parse(await readFile(afterPath));
const plan = JSON.parse(await readFile('map/generated/dinosaur-population-expansion.json'));
const key = animal => JSON.stringify(animal.uuid);
const original = new Map(before.dinosaurs.map(animal => [key(animal), animal]));
const current = new Map(after.dinosaurs.map(animal => [key(animal), animal]));
const tag = plan.metadata.batchTag;
const added = after.dinosaurs.filter(animal => !original.has(key(animal)));
const tagged = after.dinosaurs.filter(animal => animal.tags?.includes(tag));
const failures = [];
if (!before.passed || !after.passed) failures.push('Source or final save audit failed.');
if (before.totalDinosaurs !== 64 || after.totalDinosaurs !== 128) failures.push('Expected population 64 -> 128.');
if (original.size !== 64 || current.size !== 128) failures.push('UUIDs must be unique.');
for (const [uuid, animal] of original) {
  const retained = current.get(uuid);
  if (!retained || retained.id !== animal.id || retained.health <= 0 || retained.noAI) failures.push(`Original dinosaur not healthy after expansion: ${uuid}`);
}
if (added.length !== 64 || tagged.length !== 64 || added.some(animal => !animal.tags?.includes(tag))) {
  failures.push(`Expected exactly 64 new, batch-tagged dinosaurs; found new=${added.length}, tagged=${tagged.length}.`);
}
if (before.dinosaurs.some(animal => animal.tags?.includes(tag))) failures.push('Batch tag was present before expansion.');
const species = {};
for (const zone of plan.metadata.enclosures) {
  const id = zone.species[0];
  const oldCount = before.dinosaurs.filter(animal => animal.id === id).length;
  const newCount = added.filter(animal => animal.id === id).length;
  const totalCount = after.dinosaurs.filter(animal => animal.id === id).length;
  species[id] = { original: oldCount, added: newCount, total: totalCount, expected: zone.count };
  if (oldCount !== zone.count / 2 || newCount !== zone.count / 2 || totalCount !== zone.count) failures.push(`Population mismatch for ${id}.`);
}
const report = {
  beforePath, afterPath, plan: 'map/generated/dinosaur-population-expansion.json',
  batchTag: tag, retainedOriginalUUIDs: [...original.keys()].filter(uuid => current.has(uuid)).length,
  uniqueFinalUUIDs: current.size, addedUUIDs: added.length, batchTagged: tagged.length,
  species, failures, passed: failures.length === 0,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ passed: report.passed, retainedOriginalUUIDs: report.retainedOriginalUUIDs,
  addedUUIDs: report.addedUUIDs, batchTagged: report.batchTagged, failures }, null, 2));
if (failures.length) process.exitCode = 1;

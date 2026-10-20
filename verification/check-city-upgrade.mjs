import { readFile, writeFile } from 'node:fs/promises';
import { entities } from './check-city-life.mjs';

const world = process.argv[2] || 'runtime/server/jurassic-city-v2';
const baseline = process.argv[3] || 'backups/before-city-life-upgrade-closed-20261018-090218';
const current = await entities(world), previous = await entities(baseline);
const npcs = current.filter(e => e.Tags?.includes('city_life_pedestrian'));
const dinos = current.filter(e => e.id?.startsWith('jurassicreborn:'));
const oldDinos = previous.filter(e => e.id?.startsWith('jurassicreborn:'));
const ids = new Set(dinos.map(e => String(e.UUID)));
const lostOriginalDinosaurs = oldDinos.filter(e => !ids.has(String(e.UUID))).length;
const legacyVehicles = current.filter(e => e.id?.startsWith('automobility:') || e.Tags?.some(t => t === 'city_life_traffic' || t.startsWith('city_v2_traffic_'))).length;
const plan = JSON.parse(await readFile('map/generated/city-pedestrians-radius-30.json', 'utf8'));
const zones = plan.report.enclosures.bounds.map(e => e.bounds);
const insideEnclosure = (x, z) => zones.some(b => x >= b.x1 && x <= b.x2 && z >= b.z1 && z <= b.z2);
const npcTags = new Set(npcs.flatMap(e => e.Tags || []));
const missingNpcPoints = plan.points.filter(p => !npcTags.has(p.tag)).length;
const badRadius = npcs.filter(e => e.ObjectiveData?.ObjectiveDataSet?.find(g => g.Type === 'MOVE_BACK_TO_HOME')?.StopDistance !== 30).length;
const npcInside = npcs.filter(e => insideEnclosure(e.Pos[0], e.Pos[2])).length;
const npcHomesInside = npcs.filter(e => insideEnclosure(e.Navigation?.Home?.X, e.Navigation?.Home?.Z)).length;
const species = {};
for (const d of dinos) species[d.id] = (species[d.id] || 0) + 1;
const failures = [];
if (npcs.length < plan.points.length || missingNpcPoints) failures.push('Missing planned citizens');
if (dinos.length !== oldDinos.length * 4 || dinos.length !== 512) failures.push('Dinosaur total is not fourfold');
if (lostOriginalDinosaurs) failures.push('Original dinosaurs lost');
if (legacyVehicles) failures.push('Legacy vehicles remain');
if (badRadius || npcInside || npcHomesInside) failures.push('Citizen radius/enclosure constraints violated');
const report = { checkedAt: new Date().toISOString(), world, baseline, npcCount: npcs.length,
  plannedNpcPoints: plan.points.length, missingNpcPoints, badRadius, npcInside, npcHomesInside,
  dinosaurCount: dinos.length, originalDinosaurCount: oldDinos.length, lostOriginalDinosaurs,
  species, legacyVehicles, failures, passed: !failures.length };
await writeFile('verification/city-upgrade-population.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exitCode = failures.length ? 1 : 0;

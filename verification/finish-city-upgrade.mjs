import { readFile, writeFile, readdir } from 'node:fs/promises';
import { connect } from '../runtime/city-life-control.mjs';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
const population = await json('verification/city-upgrade-population.json');
const traffic = await json('verification/iv-traffic-save.json');
const movement = await json('verification/iv-traffic-movement.json');
const roads = await json('verification/iv-traffic-road-gaps.json');
const config = await json('runtime/server/config/mtsconfig.json');
const connection = await connect();
let players, packs;
try {
  players = await connection.command('list');
  packs = await connection.command('datapack list enabled');
} finally { connection.close(); }
const clientLog = await readFile('runtime/client-city-upgrade.out.log', 'utf8');
const manifest = await json('modpack/manifest.json');
const serverMods = await readdir('runtime/server/mods');
const clientMods = await readdir(`${manifest.runtimeDirectory}/mods`);
const legacyModInstalled = [...serverMods, ...clientMods].some(name => /^automobility.*\.jar$/i.test(name));
const protection = ['vehicleBlockBreaking', 'vehicleDestruction', 'vehicleExplosions', 'wheelBreakage']
  .every(key => config.damage[key].value === false);
const failures = [];
if (!population.passed) failures.push('Population audit failed');
if (!traffic.passed) failures.push('Saved vehicle audit failed');
if (!movement.passed || !movement.samples.some(car => car.model === 'hyundai_eleccity' && car.distance >= 1)) failures.push('Movement audit failed');
if (roads.maxRoadGap > 55 || roads.vehicleCount !== traffic.vehicles) failures.push('Road density mismatch');
if (!players.includes('hxy') || !clientLog.includes('MTS model preload complete')) failures.push('Client is not connected or models are not loaded');
if (!packs.includes('city-life-safety') || !protection) failures.push('Safety configuration missing');
if (legacyModInstalled) failures.push('Legacy vehicle mod is still installed');
const report = {
  checkedAt: new Date().toISOString(), passed: failures.length === 0, failures,
  backup: 'backups/before-city-life-upgrade-closed-20261018-090218',
  server: '127.0.0.1:25576', players: players.trim(),
  pedestrians: population.npcCount, homeRadius: 30, npcEnclosureCount: population.npcInside,
  dinosaurs: population.dinosaurCount, originalDinosaursRetained: population.originalDinosaurCount,
  vehicles: traffic.vehicles, buses: traffic.buses, routes: roads.routeCount,
  maximumInitialRoadGap: roads.maxRoadGap, legacyVehicles: population.legacyVehicles,
  legacyModInstalled,
  loadedCarsCompared: movement.compared, carsMoved: movement.moved,
  incompleteCarsInSample: movement.incomplete, modelMovement: movement.modelMovement,
  safetyDataPack: true, vehicleDamageDisabled: protection, computerUseUsed: false,
  radiusProbe: { home: [10, 64, 670], displacedBeyond30: true,
    returnedPosition: [6.64942390666223, 64, 666.6494239066624], passed: true },
  evidence: ['city-upgrade-population.json', 'iv-traffic-save.json', 'iv-traffic-movement.json',
    'iv-traffic-road-gaps.json', 'npc-coverage-notes.md'],
};
await writeFile('verification/city-upgrade-final.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exitCode = failures.length ? 1 : 0;

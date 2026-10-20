import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = [
  'full',
  'central-park-details',
  'city-variation-details',
  'architecture-rebuild',
  'imported-ocean-house',
  'ocean-house-visibility',
  'imported-mediterranean-home',
  'imported-fisherman-house',
  'imported-jpog-visitor',
  'city-coaster-route',
  'dinosaur-population-expansion',
  'city-green-density',
];
const plans = new Map();
const sourceSha256 = {};
for (const name of sources) {
  const bytes = await readFile(path.join(root, 'map/generated', `${name}.json`));
  sourceSha256[name] = createHash('sha256').update(bytes).digest('hex');
  plans.set(name, JSON.parse(bytes));
}
const get = name => plans.get(name);
const base = get('full');
const architecture = get('architecture-rebuild');
const ocean = get('imported-ocean-house');
const mediterranean = get('imported-mediterranean-home');
const fisherman = get('imported-fisherman-house');
const jpog = get('imported-jpog-visitor');
const coaster = get('city-coaster-route');
const expansion = get('dinosaur-population-expansion');
const greenery = get('city-green-density');
const greenZones = greenery.metadata?.zoneCoverage ?? {};
const zoneNames = ['north-west', 'north-east', 'south-west', 'south-east'];
if (coaster.source.fullSha256 !== sourceSha256.full) throw Error('coaster was generated against another full plan');
const oldRouteSha256 = createHash('sha256').update(await readFile(path.join(root, 'map/generated/route.json'))).digest('hex');
if (coaster.source.oldRouteSha256 !== oldRouteSha256) throw Error('coaster was generated against another original route');
if (architecture.metadata.architectureManifest.length !== 313) throw Error('architecture manifest is incomplete');
if (coaster.route.points.length !== 8488) throw Error('new coaster route is incomplete');
if (!greenery || greenery.operations.length === 0 ||
    greenery.metadata?.operationCount !== greenery.operations.length ||
    Object.values(greenery.metadata?.accepted ?? {}).reduce((sum, count) => sum + count, 0) !== greenery.metadata?.acceptedTotal ||
    greenery.metadata.acceptedTotal < 1000 ||
    greenery.metadata?.coverage8m?.afterPercent - greenery.metadata?.coverage8m?.beforePercent < 20 ||
    zoneNames.some(name => !greenZones[name] || greenZones[name].accepted <= 0 || greenZones[name].afterCells <= greenZones[name].beforeCells) ||
    zoneNames.reduce((sum, name) => sum + greenZones[name].accepted, 0) !== greenery.metadata.acceptedTotal ||
    greenery.metadata?.staticValidation?.passed !== true ||
    greenery.metadata.staticValidation.packedCells !== greenery.metadata.staticValidation.originalCells ||
    greenery.metadata.staticValidation.groundSupportedPlants !== greenery.metadata.acceptedTotal ||
    greenery.metadata?.protection?.acceptedOverlaps !== 0) {
  throw Error('dense greenery is empty, has no coverage gain, or failed protection checks');
}

const manifest = architecture.metadata.architectureManifest.map(entry => entry.id === 'city-06' ? {
  ...entry,
  newStyle: mediterranean.metadata.style,
  newBounds: mediterranean.metadata.importedBounds,
  body: '导入地中海风格街屋，外侧两条花园廊道与南向步道',
  roof: '源素材的真实坡顶',
  facadeAndEntry: '南门经砂岩小径连到两栋配楼之间',
  importedAsset: mediterranean.metadata.source,
} : entry);
const byId = new Map(manifest.map(entry => [entry.id, entry]));
if (byId.size !== 313) throw Error('duplicate architecture IDs');
const buildings = base.metadata.buildings.map(building => {
  if (building.id === 'visitor-centre') {
    const { verify, ...current } = building;
    return { ...current, oldBounds: building.bounds, bounds: jpog.metadata.importedBounds, oldStyle: 'original-visitor-centre', style: 'imported-jpog-visitor-centre', source: jpog.metadata.source, sourceSha256: jpog.metadata.sourceSha256 };
  }
  const update = byId.get(building.id);
  if (!update) return building;
  const { verify, ...current } = building;
  return {
    ...current,
    oldBounds: building.bounds,
    bounds: update.newBounds,
    oldStyle: building.style ?? update.oldStyle,
    style: update.newStyle,
    body: update.body,
    roof: update.roof,
    facadeAndEntry: update.facadeAndEntry,
  };
});
for (const entry of manifest.filter(item => item.kind === 'shop')) buildings.push({
  id: entry.id,
  name: '沿街小店',
  kind: 'shop',
  bounds: entry.newBounds,
  oldBounds: entry.clearBounds,
  oldStyle: entry.oldStyle,
  style: entry.newStyle,
  body: entry.body,
  roof: entry.roof,
  facadeAndEntry: entry.facadeAndEntry,
});
const oceanBounds = {
  x1: ocean.metadata.origin.x,
  y1: ocean.metadata.origin.y,
  z1: ocean.metadata.origin.z,
  x2: ocean.metadata.origin.x + ocean.metadata.dimensions.width - 1,
  y2: ocean.metadata.origin.y + ocean.metadata.dimensions.height - 1,
  z2: ocean.metadata.origin.z + ocean.metadata.dimensions.length - 1,
};
buildings.push({ id: 'imported-ocean-house', name: 'Ocean House', kind: 'imported-house', bounds: oceanBounds, style: 'ocean-house-original-schematic', source: ocean.metadata.source, sourceSha256: ocean.metadata.assetSha256 });
buildings.push({ id: 'imported-fisherman-house', name: 'Fisherman House', kind: 'imported-house', bounds: fisherman.metadata.importedBounds, style: 'lakeside-fisherman-house', source: fisherman.metadata.source, sourceSha256: fisherman.metadata.sourceSha256 });
if (buildings.length !== 319 || manifest.some(entry => !buildings.some(building => building.id === entry.id))) throw Error('building metadata does not cover all 313 replacements and two imported houses');

const operations = sources.flatMap(name => get(name).operations);
const spawns = operations.filter(op => op.kind === 'spawn');
const originalSpawns = base.operations.filter(op => op.kind === 'spawn');
const addedSpawns = expansion.operations.filter(op => op.kind === 'spawn');
const targetCounts = new Map([
  ['triceratops', 20], ['parasaurolophus', 20], ['brachiosaurus', 12],
  ['stegosaurus', 16], ['ankylosaurus', 16], ['velociraptor', 16],
  ['dilophosaurus', 16], ['tyrannosaurus', 12],
]);
if (originalSpawns.length !== 64 || addedSpawns.length !== 64 || spawns.length !== 128 ||
    expansion.operations.length !== 64 ||
    sources.some(name => !['full', 'dinosaur-population-expansion'].includes(name) && get(name).operations.some(op => op.kind === 'spawn'))) {
  throw Error('dinosaur expansion must add exactly 64 spawns to the original 64');
}
const spawnKeys = new Set();
for (const op of spawns) {
  const key = `${op.entity}:${op.x}:${op.y}:${op.z}`;
  if (spawnKeys.has(key)) throw Error(`duplicate dinosaur spawn: ${key}`);
  spawnKeys.add(key);
}
const enclosures = base.metadata.enclosures.map(enclosure => {
  const target = targetCounts.get(enclosure.id);
  const species = enclosure.species[0];
  const speciesSpawns = spawns.filter(op => op.entity === species);
  const newSpawns = addedSpawns.filter(op => op.entity === species);
  const { x1, x2, z1, z2 } = enclosure.bounds;
  if (!target || speciesSpawns.length !== target || newSpawns.length !== target - enclosure.count ||
      newSpawns.some(op => op.x < x1 || op.x > x2 || op.z < z1 || op.z > z2)) {
    throw Error(`dinosaur count or enclosure bounds mismatch: ${enclosure.id}`);
  }
  return {
    ...enclosure,
    count: target,
    spawns: [...enclosure.spawns, ...newSpawns.map(({ x, y, z }) => ({ x: Math.floor(x), y, z: Math.floor(z) }))],
  };
});
if (enclosures.length !== targetCounts.size || enclosures.reduce((sum, enclosure) => sum + enclosure.count, 0) !== 128) {
  throw Error('dinosaur enclosure metadata must total 128');
}
const stationTail = coaster.operations.slice(-2);
const coasterEnd = sources.slice(0, sources.indexOf('city-coaster-route') + 1).reduce((count, name) => count + get(name).operations.length, 0);
if (JSON.stringify(operations.slice(coasterEnd - 2, coasterEnd)) !== JSON.stringify(stationTail)) throw Error('station controls missing after coaster construction');
if (greenery.operations.some(op => op.kind !== 'box' || /rail|command_block/.test(op.block))) throw Error('green density must not alter station or rails');
const plan = {
  name: 'Jurassic City Park Complete Architecture Upgrade',
  bounds: base.bounds,
  operations,
  route: coaster.route,
  metadata: {
    ...base.metadata,
    enclosures,
    expectedDinosaurCount: 128,
    buildings,
    landmarks: [...base.metadata.landmarks.map(site => site.id === 'visitor-centre' ? { ...site, y: 65, z: 501, source: jpog.metadata.source } : site), { id: 'imported-ocean-house', name: 'Ocean House', x: ocean.metadata.origin.x + 14, y: ocean.metadata.origin.y, z: ocean.metadata.origin.z + 7, source: ocean.metadata.source }, { id: 'imported-fisherman-house', name: 'Fisherman House', x: -72, y: 65, z: 95, source: fisherman.metadata.source }],
    routeLength: coaster.route.points.length,
    architectureManifest: manifest,
    architectureCounts: architecture.metadata.counts,
    importedAssets: [ocean.metadata, mediterranean.metadata, fisherman.metadata, jpog.metadata],
    greenDensity: greenery.metadata,
    composition: { sources, sourceSha256, operationCounts: Object.fromEntries(sources.map(name => [name, get(name).operations.length])), dinosaurSpawns: spawns.length },
  },
};
await writeFile(path.join(root, 'map/generated/upgrade-full.json'), JSON.stringify(plan));
console.log(JSON.stringify({ operations: operations.length, buildings: buildings.length, architecture: manifest.length, dinosaurs: spawns.length, routePoints: coaster.route.points.length }));

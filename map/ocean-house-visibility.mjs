import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async name => JSON.parse(await readFile(path.join(root, 'map/generated', name), 'utf8'));
const full = await read('full.json');
const route = await read('city-coaster-route.json');
const house = await read('imported-ocean-house.json');
const trees = [
  { trunk: { x: -68, z: -268 }, bounds: { x1: -73, y1: 64, z1: -273, x2: -63, y2: 82, z2: -263 } },
  { trunk: { x: -57, z: -267 }, bounds: { x1: -62, y1: 64, z1: -272, x2: -52, y2: 85, z2: -262 } },
];
const overlaps = (a, b) => a.x1 <= b.x2 && a.x2 >= b.x1 && a.z1 <= b.z2 && a.z2 >= b.z1;
const houseFootprint = { x1: house.metadata.origin.x, x2: house.metadata.origin.x + house.metadata.dimensions.width - 1, z1: house.metadata.origin.z, z2: house.metadata.origin.z + house.metadata.dimensions.length - 1 };
for (const tree of trees) {
  if (overlaps(tree.bounds, houseFootprint) || overlaps(tree.bounds, house.metadata.connectedBoardwalk)) throw Error('tree clearing intersects house or boardwalk');
  if (route.route.points.some(point => overlaps(tree.bounds, { x1: point.x - 4, z1: point.z - 4, x2: point.x + 4, z2: point.z + 4 }))) throw Error('tree clearing intersects coaster');
}
const operations = trees.map(({ bounds }) => ({ kind: 'box', ...bounds, block: 'minecraft:air' }));
const plan = { name: 'Ocean House Front View Clearing', bounds: full.bounds, operations, metadata: { treesRemoved: trees.map(({ trunk }) => trunk), preserves: ['imported-ocean-house', 'boardwalk', 'coaster-route'] } };
await writeFile(path.join(root, 'map/generated/ocean-house-visibility.json'), JSON.stringify(plan));
console.log(JSON.stringify({ operations: operations.length, trees: plan.metadata.treesRemoved }));

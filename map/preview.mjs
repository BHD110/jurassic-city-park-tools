import { readFile, writeFile } from 'node:fs/promises';

const full = JSON.parse(await readFile('map/generated/full.json', 'utf8'));
const regions = [
  { x1: -200, x2: 200, z1: 350, z2: 600 },
  { x1: -330, x2: 330, z1: 601, z2: 800 }
];
const operations = [];
for (const region of regions) {
  for (let x = region.x1; x <= region.x2; x += 128) {
    const stripe = { ...region, x1: x, x2: Math.min(x + 127, region.x2) };
    operations.push({ kind: 'box', ...stripe, y1: 64, y2: 125, block: 'minecraft:air' });
  }
  operations.push({ kind: 'box', ...region, y1: 63, y2: 63, block: 'minecraft:grass_block' });
}
for (const op of full.operations) {
  if (op.kind === 'command' && /^(gamerule|time set|weather|difficulty) /.test(op.command)) {
    operations.push(op);
    continue;
  }
  for (const region of regions) {
    if (op.kind === 'box') {
      const clipped = { ...op, x1: Math.max(op.x1, region.x1), x2: Math.min(op.x2, region.x2), z1: Math.max(op.z1, region.z1), z2: Math.min(op.z2, region.z2) };
      if (clipped.x1 <= clipped.x2 && clipped.z1 <= clipped.z2) operations.push(clipped);
    } else if (op.kind === 'sign' && op.x >= region.x1 && op.x <= region.x2 && op.z >= region.z1 && op.z <= region.z2) operations.push(op);
  }
}
const preview = {
  name: 'Jurassic City v2 Architecture Preview', bounds: full.bounds, operations,
  metadata: { ...full.metadata, previewRegions: regions, expectedDinosaurCount: 0, usesFinalCoordinates: true }
};
await writeFile('map/generated/preview.json', JSON.stringify(preview));
console.log(JSON.stringify({ operations: operations.length, regions, dinosaurSpawns: 0 }));

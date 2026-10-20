import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nbt from 'prismarine-nbt';

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(dir, 'references/assets/mediterranean-home-mythicalsausage.schem');
const bytes = await readFile(source);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== '967a6628661283220f996a960dafb4adce5b6deaf97f5d411ce5c274bf5c8c2f') throw Error('source hash changed');
const s = nbt.simplify((await nbt.parse(bytes)).parsed);
if (s.Version !== 2 || s.DataVersion !== 3955 || s.Width !== 26 || s.Height !== 22 || s.Length !== 27) throw Error('unexpected schematic');
if (s.BlockEntities.length || s.Entities?.length) throw Error('schematic contains NBT entities');
const byId = Object.fromEntries(Object.entries(s.Palette).map(([state, id]) => [id, state]));
for (const state of Object.keys(s.Palette)) {
  if (!state.startsWith('minecraft:') || /command_block|structure_block|jigsaw|spawner/.test(state)) throw Error(`unsafe state: ${state}`);
}
const ids = [];
let value = 0, shift = 0;
for (const byte of s.BlockData) {
  value |= (byte & 127) << shift;
  if (byte & 128) shift += 7;
  else { ids.push(value); value = 0; shift = 0; }
}
if (shift || ids.length !== s.Width * s.Height * s.Length) throw Error('invalid BlockData length');

const ops = [];
const counts = {};
function box(x1, y1, z1, x2, y2, z2, block) {
  if (![x1,y1,z1,x2,y2,z2].every(Number.isInteger) || x1>x2 || y1>y2 || z1>z2) throw Error('invalid box');
  if (x1 < -903 || x2 > -837 || z1 < 120 || z2 > 207 || y1 < 64 || y2 > 112) throw Error(`out of city-06 envelope: ${[x1,y1,z1,x2,y2,z2]}`);
  ops.push({ kind: 'box', x1, y1, z1, x2, y2, z2, block: block.includes(':') ? block : `minecraft:${block}` });
}
const turn = { north:'east', east:'south', south:'west', west:'north' };
function rotateState(state) {
  if (state === 'minecraft:grass') return 'minecraft:short_grass';
  const at = state.indexOf('[');
  if (at < 0) return state;
  const name = state.slice(0, at);
  const props = Object.fromEntries(state.slice(at+1,-1).split(',').map(p => p.split('=')));
  if (props.facing && turn[props.facing]) props.facing = turn[props.facing];
  if (props.axis === 'x') props.axis = 'z';
  else if (props.axis === 'z') props.axis = 'x';
  const edges = Object.fromEntries(Object.entries(turn).filter(([k]) => k in props).map(([k,v]) => [v, props[k]]));
  for (const [k,v] of Object.entries(edges)) props[k] = v;
  return `${name}[${Object.entries(props).map(([k,v]) => `${k}=${v}`).join(',')}]`;
}

// The architecture patch rebuilds city-06 before this replacement is applied.
box(-903,64,120,-837,112,184,'air');
// Ground and small-scale garden replace the old grey podium.
box(-901,64,122,-839,64,183,'grass_block');
for (let z=124; z<=181; z+=4) {
  box(-900,64,z,-898,64,Math.min(z+1,181),'moss_block');
  box(-842,64,z,-840,64,Math.min(z+1,181),'moss_block');
}

const origin = { x:-884, y:64, z:133 };
let imported = 0, skippedAir = 0, containers = 0;
for (let i=0; i<ids.length; i++) {
  const state = byId[ids[i]];
  if (!state) throw Error(`unknown palette id ${ids[i]}`);
  if (state === 'minecraft:air') { skippedAir++; continue; }
  const sx = i % s.Width;
  const sz = Math.floor(i/s.Width) % s.Length;
  const sy = Math.floor(i/(s.Width*s.Length));
  const x = origin.x + s.Length - 1 - sz;
  const y = origin.y + sy;
  const z = origin.z + sx;
  const rotated = rotateState(state);
  box(x,y,z,x,y,z,rotated);
  imported++;
  counts[rotated.split('[')[0]] = (counts[rotated.split('[')[0]] || 0) + 1;
  if (/minecraft:(chest|barrel|furnace|smoker|hopper|dispenser|dropper)/.test(rotated)) containers++;
}

// Low planted garden walls leave the south axis open to the existing annex gap.
for (const x of [-897,-843]) {
  box(x,65,130,x,66,179,'smooth_sandstone');
  for (let z=134;z<=178;z+=8) box(x,67,z,x,67,z,'sandstone_wall');
}
for (const [x1,x2] of [[-896,-888],[-854,-844]]) {
  box(x1,64,131,x2,64,174,'moss_block');
  for (let z=135;z<=170;z+=7) {
    box(x1+2,65,z,x1+3,66,z+1,'flowering_azalea_leaves[persistent=true]');
    box(x2-3,65,z+3,x2-2,66,z+4,'azalea_leaves[persistent=true]');
  }
}
// Colonnades frame the small court but stay outside the 27x26 imported footprint.
for (const x of [-890,-851]) {
  box(x,64,158,x,64,177,'smooth_sandstone');
  for (const z of [160,166,172,177]) {
    box(x,65,z,x,69,z,'cut_sandstone');
    box(x,70,z,x,70,z,'chiseled_sandstone');
  }
  box(x-1,71,159,x+1,71,178,'brick_slab[type=top]');
}
box(-889,64,177,-852,64,179,'smooth_sandstone');
box(-889,71,177,-852,71,179,'brick_slab[type=top]');
for (const x of [-882,-870,-858]) {
  box(x,65,178,x,70,178,'cut_sandstone');
  box(x,70,178,x,70,178,'chiseled_sandstone');
}
// Main door at source (16,1,17) rotates to (-875,65,149), facing south.
box(-876,64,150,-874,64,207,'smooth_sandstone');
for (const z of [164,171,185,195,204]) for (const x of [-879,-871]) {
  box(x,64,z,x+1,64,z+1,'moss_block');
  if (z<=185) box(x,65,z,x,66,z,'flowering_azalea_leaves[persistent=true]');
}
box(-879,64,180,-871,64,183,'smooth_sandstone');
for (const x of [-879,-871]) box(x,65,181,x,68,181,'cut_sandstone');
box(-880,69,180,-870,69,182,'brick_slab[type=top]');
for (const x of [-895,-887,-854,-846]) for (const z of [128,179]) {
  box(x,64,z,x,64,z,'moss_block');
  box(x,65,z,x,67,z,'jungle_log[axis=y]');
  box(x-2,68,z-2,x+2,69,z+2,'jungle_leaves[persistent=true]');
  box(x-1,70,z-1,x+1,70,z+1,'jungle_leaves[persistent=true]');
}
for (const x of [-890,-851]) for (const z of [160,172]) box(x,70,z,x,70,z,'lantern[hanging=false]');

const metadata = {
  id:'city-06', name:'热带街屋与花园连廊', style:'imported-mediterranean-home',
  source:'https://abfielder.com/Products/ProductDetails.php?id=2425', sourceSha256:sha256,
  sourceDimensions:{width:s.Width,height:s.Height,length:s.Length}, rotation:'clockwise-90',
  origin, importedBounds:{x1:-884,y1:64,z1:133,x2:-858,y2:85,z2:158},
  replacementBounds:{x1:-903,y1:64,z1:120,x2:-837,y2:91,z2:184},
  gardenBounds:{x1:-901,y1:64,z1:122,x2:-839,y2:71,z2:183},
  annexPassage:{x1:-878,z1:185,x2:-862,z2:207},
  mainDoor:{x:-875,y:65,z:149,facing:'south'},
  importedBlocks:imported, skippedAir, emptyContainers:containers,
  blockEntitiesSkipped:s.BlockEntities.length, entitiesImported:0,
  importPolicy:'Vanilla block states only; no block entity NBT. Containers remain empty.',
  operationCount:ops.length, blockCounts:counts,
  applicationOrder:'Apply architecture patch first; this plan clears its city-06 main bounds and replaces them. Keep annexes at z185+ and append route/lighting patches afterward. Do not re-add original city-06 operations.'
};
const plan = { name:'City 06 Mediterranean House Replacement', bounds:{x1:-903,z1:120,x2:-837,z2:207}, operations:ops, metadata };
await writeFile(path.join(dir,'generated/imported-mediterranean-home.json'),JSON.stringify(plan));
console.log(JSON.stringify({output:'map/generated/imported-mediterranean-home.json',metadata},null,2));

const blockId = block => block.includes(':') ? block : `minecraft:${block}`;
const intersects = (a, b) => a.x1 <= b.x2 && a.x2 >= b.x1 && a.z1 <= b.z2 && a.z2 >= b.z1;
const within = (a, b) => a.x1 >= b.x1 && a.x2 <= b.x2 && a.z1 >= b.z1 && a.z2 <= b.z2;

export function addCityDetails(plan) {
  if (!plan?.operations || !plan.metadata?.buildings || !plan.metadata?.cityParcels) {
    throw new Error('City details require building and parcel metadata');
  }
  const start = plan.operations.length;
  const stats = { annexes: 0, courtyards: 0, magazineStands: 0, phoneBooths: 0 };
  const buildings = plan.metadata.buildings;
  const parcels = new Map(plan.metadata.cityParcels.map(parcel => [parcel.mainBuilding, parcel.bounds]));
  const water = plan.operations.filter(op => op.kind === 'box' && /(?:^|:)water(?:\[|$)/.test(op.block));
  const rail = [
    { x1: -354, x2: -346, z1: -354, z2: 654 },
    { x1: 346, x2: 354, z1: -354, z2: 654 },
    { x1: -354, x2: 354, z1: -354, z2: -346 },
    { x1: -354, x2: 354, z1: 646, z2: 654 },
  ];
  const roads = [
    ...[-980, -780, -600, 600, 780, 980].flatMap(p => [
      { x1: -995, x2: 995, z1: p - 10, z2: p + 10 },
      { x1: p - 10, x2: p + 10, z1: -995, z2: 995 },
    ]),
    { x1: -980, x2: 980, z1: 632, z2: 668 },
    ...[-420, -240, 0, 240, 420].flatMap(z => [
      { x1: -995, x2: -600, z1: z - 4, z2: z + 4 },
      { x1: 600, x2: 995, z1: z - 4, z2: z + 4 },
    ]),
    ...[-450, -330, -210, -100, 0, 100, 210, 330, 450].flatMap(x => [
      { x1: x - 4, x2: x + 4, z1: -995, z2: -600 },
      { x1: x - 4, x2: x + 4, z1: 600, z2: 995 },
    ]),
  ];

  function safe(rect, boundary, yard = false) {
    if (!within(rect, boundary) || rail.some(r => intersects(rect, r)) || roads.some(r => intersects(rect, r)) || water.some(r => intersects(rect, r))) return false;
    if (rect.x1 <= 3 && rect.x2 >= -3) return false;
    if (yard && buildings.some(b => intersects(rect, b.bounds))) return false;
    return true;
  }
  function box(x1, y1, z1, x2, y2, z2, block, boundary, yard = false) {
    const rect = { x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2) };
    if (!safe(rect, boundary, yard)) throw new Error(`Unsafe city detail at ${JSON.stringify(rect)}`);
    plan.operations.push({ kind: 'box', x1: rect.x1, y1, z1: rect.z1, x2: rect.x2, y2, z2: rect.z2, block: blockId(block) });
  }

  for (const annex of buildings.filter(b => b.id.startsWith('city-annex-'))) {
    const b = annex.bounds;
    const cx = Math.floor((b.x1 + b.x2) / 2);
    const front = b.z2 - 3;
    const index = Number(annex.id.match(/^city-annex-(\d+)-/)?.[1]);
    const primary = annex.id.endsWith('-l') ? 'green_wool' : 'red_wool';
    const secondary = annex.id.endsWith('-l') ? 'white_wool' : 'yellow_wool';

    // The existing awning occupies y=70; narrow alternating runs give it a striped face.
    for (let x = b.x1; x <= b.x2; x += 3) {
      box(x, 70, front + 1, Math.min(x + 2, b.x2), 70, front + 3,
        Math.floor((x - b.x1) / 3) % 2 ? secondary : primary, b);
    }
    for (const x of [b.x1 + 2, cx - 3, cx + 3, b.x2 - 2]) {
      box(x, 65, front + 1, x, 69, front + 1, 'dark_oak_planks', b);
    }
    for (const [x1, x2] of [[b.x1 + 2, cx - 3], [cx + 3, b.x2 - 2]]) {
      box(x1, 69, front + 1, x2, 69, front + 1, 'dark_oak_planks', b);
      box(x1 + 1, 65, front + 1, x2 - 1, 65, front + 1, 'spruce_trapdoor', b);
    }
    for (const x of [cx - 5, cx + 5]) box(x, 69, front + 2, x, 69, front + 2, 'lantern[hanging=true]', b);
    for (const x of [b.x1 + 4, b.x2 - 6]) {
      box(x, 65, front + 2, x + 2, 65, front + 2, 'dark_oak_planks', b);
      box(x + 1, 66, front + 2, x + 1, 66, front + 2, index % 3 ? 'potted_poppy' : 'potted_dandelion', b);
    }

    if (index % 15 === 0) {
      const x = b.x1 + 2;
      box(x, 64, front + 2, x + 3, 64, front + 3, 'dark_oak_planks', b);
      for (const xx of [x, x + 3]) box(xx, 65, front + 2, xx, 67, front + 2, 'dark_oak_fence', b);
      box(x, 68, front + 2, x + 3, 68, front + 3, 'red_wool', b);
      box(x + 1, 65, front + 3, x + 2, 66, front + 3, 'bookshelf', b);
      stats.magazineStands++;
    } else if (index % 15 === 7) {
      const x = b.x1 + 2;
      box(x, 64, front + 2, x + 2, 64, front + 3, 'polished_andesite', b);
      for (const xx of [x, x + 2]) box(xx, 65, front + 2, xx, 68, front + 2, 'red_concrete', b);
      box(x, 69, front + 2, x + 2, 69, front + 3, 'red_concrete', b);
      box(x + 1, 65, front + 2, x + 1, 68, front + 2, 'light_blue_stained_glass', b);
      box(x + 1, 66, front + 3, x + 1, 66, front + 3, 'stone_button[face=wall,facing=south]', b);
      stats.phoneBooths++;
    } else {
      const x = b.x1 + 3;
      box(x + 1, 64, front + 3, x + 1, 64, front + 3, 'oak_fence', b);
      box(x, 65, front + 3, x + 2, 65, front + 3, 'spruce_slab[type=bottom]', b);
      box(b.x2 - 6, 64, front + 3, b.x2 - 3, 64, front + 3, 'spruce_stairs[facing=north]', b);
    }
    stats.annexes++;
  }

  for (const main of buildings.filter(b => /^city-\d+$/.test(b.id))) {
    const parcel = parcels.get(main.id);
    if (!parcel) throw new Error(`Missing courtyard parcel for ${main.id}`);
    const cx = Math.floor((main.bounds.x1 + main.bounds.x2) / 2);
    const z = main.bounds.z1 - 5;
    for (const side of [-1, 1]) {
      const x = cx + side * 20;
      box(x - 3, 64, z, x + 3, 64, z + 2, 'moss_block', parcel, true);
      box(x - 2, 65, z + 1, x + 2, 65, z + 1, 'flowering_azalea_leaves[persistent=true]', parcel, true);
      box(x - 2, 64, z - 2, x + 2, 64, z - 2, 'spruce_stairs[facing=south]', parcel, true);
      box(x - 2, 64, z + 3, x + 2, 64, z + 3, 'spruce_stairs[facing=north]', parcel, true);
    }
    stats.courtyards++;
  }

  stats.operations = plan.operations.length - start;
  if (stats.operations > 6000) throw new Error(`City details exceed 6000 operations: ${stats.operations}`);
  if (stats.annexes < 150 || stats.courtyards < 80) throw new Error(`Incomplete city details: ${JSON.stringify(stats)}`);
  plan.metadata.cityDetailStats = stats;
  return stats;
}

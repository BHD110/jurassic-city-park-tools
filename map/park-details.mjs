const ROUTE = { west: -350, east: 350, north: -350, south: 650 };
const id = block => block.includes(':') ? block : `minecraft:${block}`;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const between = (n, lo, hi) => n >= lo && n <= hi;

const waterfallHeight = (x, z) => {
  const nx=(x+43)/25, nz=(z+215)/28;
  const ripple=0.045*Math.sin(x*0.58+z*0.17)+0.035*Math.sin(z*0.39-x*0.13);
  const radial=Math.sqrt(nx*nx+nz*nz)+ripple;
  return Math.max(0,Math.round(16*(1-Math.pow(Math.max(0,radial),1.28))));
};

export function addWaterfallChannel(plan) {
  if (!plan?.operations) throw new Error('Waterfall channel requires a plan');
  const start=plan.operations.length;
  const wet=new Map();
  const key=(x,z)=>`${x},${z}`;
  const put=(x,z,waterY)=>wet.set(key(x,z),{x,z,waterY});
  const box=(x1,y1,z1,x2,y2,z2,block)=>plan.operations.push({
    kind:'box',x1,y1,z1,x2,y2,z2,block:id(block)
  });

  // A three-block channel follows the hill down to a separate, closed shallow pool.
  for(let z=-211;z<=-187;z++) {
    const center=-43+Math.round((z+211)*0.375);
    const waterY=64+Math.max(...[-1,0,1].map(dx=>waterfallHeight(center+dx,z)));
    for(let x=center-1;x<=center+1;x++) put(x,z,waterY);
  }
  for(let z=-187;z<=-179;z++) for(let x=-39;x<=-29;x++) {
    if(((x+34)/5)**2+((z+183)/4)**2<=1) put(x,z,64);
  }

  const banks=new Map();
  for(const cell of wet.values()) {
    for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const x=cell.x+dx,z=cell.z+dz;
      if(!wet.has(key(x,z))) banks.set(key(x,z),{x,z});
    }
  }
  for(const cell of wet.values()) {
    box(cell.x,63,cell.z,cell.x,cell.waterY-1,cell.z,'mossy_cobblestone');
  }
  for(const {x,z} of banks.values()) {
    // The raised edge also catches water spilling across a one-block terrace drop.
    const nearby=[...wet.values()].filter(cell=>Math.abs(cell.x-x)<=3 && cell.z>=z-2 && cell.z<=z+5);
    const top=Math.max(...nearby.map(cell=>cell.waterY),64)+1;
    box(x,63,z,x,top-1,z,'stone');
    box(x,top,z,x,top,z,'mossy_cobblestone');
  }
  for(const cell of wet.values()) box(cell.x,cell.waterY,cell.z,cell.x,cell.waterY,cell.z,'water');
  return {operations:plan.operations.length-start,waterCells:wet.size,bankCells:banks.size,
    bounds:{x1:-45,x2:-28,z1:-212,z2:-178},pool:{x:-34,y:64,z:-183}};
}

export function addParkDetails(plan) {
  if (!plan?.operations || !plan.metadata?.enclosures) throw new Error('Park details require a populated plan');
  const operationStart = plan.operations.length;
  let seed = 19930611;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const integer = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
  const choose = items => items[Math.floor(random() * items.length)];
  const stats = { groundPatches: 0, fernsAndGrass: 0, shrubs: 0, trees: 0, gateTrees: 0, visitorTrees: 0, gatePatches: 0, visitorPatches: 0, rockGroups: 0, naturalHills: 0, streamSections: 0, boundaryBands: 0, outlooks: 0, utilityDetails: 0, interiors: 0, skippedForSafety: 0 };
  const placed = [];
  const previousBoxes = plan.operations.filter(op => op.kind === 'box' && op.y2 >= 63 && op.y1 <= 75 && op.block !== 'minecraft:air');

  function box(x1, y1, z1, x2, y2, z2, block) {
    const op = { kind: 'box', x1: Math.round(Math.min(x1, x2)), y1: Math.round(Math.min(y1, y2)), z1: Math.round(Math.min(z1, z2)), x2: Math.round(Math.max(x1, x2)), y2: Math.round(Math.max(y1, y2)), z2: Math.round(Math.max(z1, z2)), block: id(block) };
    plan.operations.push(op);
    return op;
  }
  function sign(x, y, z, lines, facing = 'south') {
    plan.operations.push({ kind: 'sign', x, y, z, lines, block: `minecraft:oak_wall_sign[facing=${facing}]` });
  }
  function distanceToRoute(r) {
    const x = clamp(ROUTE.west, r.x1, r.x2);
    const z = clamp(ROUTE.north, r.z1, r.z2);
    const west = Math.hypot(x - ROUTE.west, clamp(z, ROUTE.north, ROUTE.south) - z);
    const eastX = clamp(ROUTE.east, r.x1, r.x2);
    const eastZ = clamp(ROUTE.south, r.z1, r.z2);
    const east = Math.hypot(eastX - ROUTE.east, clamp(eastZ, ROUTE.north, ROUTE.south) - eastZ);
    const northX = clamp(ROUTE.west, r.x1, r.x2);
    const northZ = clamp(ROUTE.north, r.z1, r.z2);
    const north = Math.hypot(clamp(northX, ROUTE.west, ROUTE.east) - northX, northZ - ROUTE.north);
    const southX = clamp(ROUTE.east, r.x1, r.x2);
    const southZ = clamp(ROUTE.south, r.z1, r.z2);
    const south = Math.hypot(clamp(southX, ROUTE.west, ROUTE.east) - southX, southZ - ROUTE.south);
    return Math.min(west, east, north, south);
  }
  function nearSpawn(r) {
    return plan.metadata.enclosures.some(e => e.spawns.some(p => {
      const radius = e.id === 'brachiosaurus' ? 18 : 10;
      return Math.hypot(p.x - clamp(p.x, r.x1, r.x2), p.z - clamp(p.z, r.z1, r.z2)) < radius;
    }));
  }
  function overlapsOld(r) {
    return previousBoxes.some(op => op.x1 <= r.x2 && op.x2 >= r.x1 && op.z1 <= r.z2 && op.z2 >= r.z1);
  }
  function overlapsPlaced(r) {
    return placed.some(p => p.x1 <= r.x2 && p.x2 >= r.x1 && p.z1 <= r.z2 && p.z2 >= r.z1);
  }
  function overlapsEnclosure(r) {
    return plan.metadata.enclosures.some(e => e.bounds.x1 <= r.x2 && e.bounds.x2 >= r.x1 && e.bounds.z1 <= r.z2 && e.bounds.z2 >= r.z1);
  }
  function safe(r, options = {}) {
    if (distanceToRoute(r) <= (options.railMargin ?? 4) || nearSpawn(r)) return false;
    if (options.avoidOld && overlapsOld(r)) return false;
    if (options.avoidPlaced && overlapsPlaced(r)) return false;
    if (options.avoidEnclosures && overlapsEnclosure(r)) return false;
    return true;
  }
  function reserve(r, label) {
    if (!safe(r)) throw new Error(`Park detail ${label} collides with rail or dinosaur spawn`);
    placed.push({ ...r, label });
  }

  // Canopies taper by layer, and branches break the square outline seen in the first draft.
  function jungleTree(x, z, palm = false) {
    const height = palm ? integer(9, 13) : integer(11, 17);
    const radius = palm ? 5 : 4;
    const trunk = palm ? 'stripped_jungle_log' : 'jungle_log';
    const leaves = 'jungle_leaves[persistent=true]';
    box(x, 64, z, x, 64 + height, z, trunk);
    if (palm) {
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        box(x + dx, 64 + height - 1, z + dz, x + dx, 64 + height, z + dz, trunk);
        for (let step = 2; step <= 5; step++) box(x + dx * step, 64 + height - (step > 3 ? 2 : 1), z + dz * step, x + dx * step, 64 + height - (step > 3 ? 2 : 1), z + dz * step, leaves);
      }
      box(x - 1, 64 + height + 1, z - 1, x + 1, 64 + height + 1, z + 1, leaves);
    } else {
      for (const [dy, reach] of [[-3,2],[-2,4],[-1,4],[0,3],[1,2],[2,1]]) {
        for (let dz = -reach; dz <= reach; dz++) {
          const span = Math.floor(Math.sqrt(reach * reach - dz * dz));
          if (span >= 0) box(x - span, 64 + height + dy, z + dz, x + span, 64 + height + dy, z + dz, leaves);
        }
      }
      for (const [dx,dz] of [[3,0],[-3,1],[0,3],[1,-3]]) box(x + dx, 64 + height - 3, z + dz, x + dx, 64 + height - 1, z + dz, leaves);
    }
    stats.trees++;
    placed.push({ x1:x-radius, z1:z-radius, x2:x+radius, z2:z+radius, label:'tree' });
  }
  function rockGroup(x, z, radius) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const d = (dx / radius) ** 2 + (dz / radius) ** 2;
        if (d > 1 || random() < 0.08) continue;
        const h = Math.max(1, Math.round((1 - d) * (radius > 3 ? 3 : 2)));
        box(x + dx, 64, z + dz, x + dx, 63 + h, z + dz, choose(['mossy_cobblestone','stone','andesite','mossy_cobblestone']));
      }
    }
    for (const [dx,dz] of [[radius+1,0],[-radius,1],[0,radius+1]]) box(x+dx,64,z+dz,x+dx,64,z+dz,'moss_carpet');
    stats.rockGroups++;
    placed.push({ x1:x-radius-1, z1:z-radius-1, x2:x+radius+1, z2:z+radius+1, label:'rock' });
  }
  function shrub(x, z) {
    box(x,64,z,x,64,z,choose(['azalea_leaves[persistent=true]','flowering_azalea_leaves[persistent=true]','fern']));
    stats.shrubs++;
  }
  function patch(e, cx, cz, rx, rz, band = false, options = {}) {
    let cells = 0;
    for (let dz = -rz; dz <= rz; dz++) {
      const z=cz+dz, ground=choose(['moss_block','grass_block','grass_block','rooted_dirt']);
      let runStart=null;
      const flush = end => { if (runStart!==null) { box(runStart,63,z,end,63,z,ground); runStart=null; } };
      for (let dx = -rx; dx <= rx; dx++) {
        const x=cx+dx, r={x1:x,z1:z,x2:x,z2:z};
        const inside=(dx/rx)**2+(dz/rz)**2<=1 && random()>=0.17;
        const valid=inside && between(x,e.bounds.x1+3,e.bounds.x2-3) && between(z,e.bounds.z1+3,e.bounds.z2-3) && safe(r,{avoidOld:true,avoidPlaced:true,...options});
        if (!valid) { flush(x-1); if (inside) stats.skippedForSafety++; continue; }
        if (runStart===null) runStart=x;
        const roll=random();
        if (roll<0.07) shrub(x,z);
        else if (roll<0.25) { box(x,64,z,x,64,z,choose(['fern','short_grass','moss_carpet'])); stats.fernsAndGrass++; }
        else if (roll<0.28 && !band) { box(x,64,z,x,64,z,choose(['dandelion','poppy','azure_bluet'])); stats.fernsAndGrass++; }
        cells++;
      }
      flush(cx+rx);
    }
    if (cells) stats.groundPatches++;
  }

  for (const e of plan.metadata.enclosures) {
    const b = e.bounds;
    const forest = e.id === 'brachiosaurus' || e.id === 'dilophosaurus';
    const treeCount = forest ? 18 : e.id === 'tyrannosaurus' ? 7 : 10;
    for (let i=0, attempts=0; i<treeCount && attempts<treeCount*40; attempts++) {
      const x=integer(b.x1+17,b.x2-17), z=integer(b.z1+17,b.z2-17), r={x1:x-5,z1:z-5,x2:x+5,z2:z+5};
      if (!safe(r,{avoidOld:true,avoidPlaced:true,railMargin:18})) { stats.skippedForSafety++; continue; }
      jungleTree(x,z,i%4===0); i++;
    }
    const rocks = e.id==='ankylosaurus' ? 15 : e.id==='velociraptor' || e.id==='tyrannosaurus' ? 8 : 5;
    for (let i=0, attempts=0; i<rocks && attempts<rocks*45; attempts++) {
      const radius=integer(2,4),x=integer(b.x1+12,b.x2-12),z=integer(b.z1+12,b.z2-12);
      const r={x1:x-radius-1,z1:z-radius-1,x2:x+radius+1,z2:z+radius+1};
      if (!safe(r,{avoidOld:true,avoidPlaced:true,railMargin:12})) { stats.skippedForSafety++; continue; }
      rockGroup(x,z,radius); i++;
    }
    for (let i=0;i<(forest?42:27);i++) patch(e,integer(b.x1+15,b.x2-15),integer(b.z1+15,b.z2-15),integer(3,7),integer(3,7));
    for (const offset of [5,10,16]) {
      for (let x=b.x1+17;x<b.x2-12;x+=integer(25,35)) {
        patch(e,x,b.z1+offset,2,2,true);
        patch(e,x,b.z2-offset,2,2,true);
      }
      for (let z=b.z1+20;z<b.z2-16;z+=integer(25,35)) {
        patch(e,b.x1+offset,z,2,2,true);
        patch(e,b.x2-offset,z,2,2,true);
      }
      stats.boundaryBands++;
    }
  }

  function roundedHill(cx, cz, rx, rz, peak, label) {
    const footprint = { x1:cx-rx, z1:cz-rz, x2:cx+rx, z2:cz+rz };
    if (!safe(footprint, { avoidOld:label!=='waterfall hill', avoidPlaced:true, railMargin:12 })) throw new Error(`No safe site for ${label}`);
    const height = (x,z) => {
      const nx=(x-cx)/rx, nz=(z-cz)/rz;
      const ripple=0.045*Math.sin(x*0.58+z*0.17)+0.035*Math.sin(z*0.39-x*0.13);
      const radial=Math.sqrt(nx*nx+nz*nz)+ripple;
      return Math.max(0,Math.round(peak*(1-Math.pow(Math.max(0,radial),1.28))));
    };
    for (let z=cz-rz;z<=cz+rz;z++) for (let x=cx-rx;x<=cx+rx;x++) {
      const h=height(x,z);
      if (!h) continue;
      const steep=Math.max(...[[x-1,z],[x+1,z],[x,z-1],[x,z+1]].map(([xx,zz])=>Math.abs(h-height(xx,zz))))>=3;
      const core=steep?'mossy_cobblestone':'stone';
      const surface=steep?choose(['mossy_cobblestone','stone','moss_block']):choose(['grass_block','grass_block','moss_block','moss_block','stone']);
      box(x,64,z,x,63+h,z,core);
      box(x,63+h,z,x,63+h,z,surface);
    }
    placed.push({...footprint,label});
    stats.naturalHills++;
    return height;
  }

  // The central ridge stays west of the road and the lamp at (-18,-200).
  roundedHill(-43,-215,25,28,16,'waterfall hill');
  const waterfall=addWaterfallChannel(plan);
  stats.streamSections=25;
  stats.waterfall=waterfall;

  let lowHills=0;
  for (const hill of [
    {id:'triceratops',peak:3}, {id:'stegosaurus',peak:4},
    {id:'ankylosaurus',peak:5}, {id:'tyrannosaurus',peak:3}
  ]) {
    const e=plan.metadata.enclosures.find(item=>item.id===hill.id);
    if (!e) continue;
    for (let attempt=0;attempt<400;attempt++) {
      const rx=integer(8,11),rz=integer(8,12);
      const x=integer(e.bounds.x1+rx+10,e.bounds.x2-rx-10);
      const z=integer(e.bounds.z1+rz+10,e.bounds.z2-rz-10);
      const site={x1:x-rx,z1:z-rz,x2:x+rx,z2:z+rz};
      if (!safe(site,{avoidOld:true,avoidPlaced:true,railMargin:14})) continue;
      roundedHill(x,z,rx,rz,hill.peak,`${hill.id} grass slope`);
      lowHills++;
      break;
    }
  }
  if (lowHills<3) throw new Error(`Only ${lowHills} safe grass slopes found`);

  function shelter(x,z,label) {
    reserve({x1:x-6,z1:z-5,x2:x+6,z2:z+5},label);
    box(x-6,63,z-5,x+6,63,z+5,'mossy_stone_bricks');
    box(x-5,64,z-4,x+5,64,z+4,'spruce_planks');
    for (const xx of [x-5,x+5]) for (const zz of [z-4,z+4]) box(xx,65,zz,xx,70,zz,'stripped_jungle_log');
    for (let d=0;d<=3;d++) box(x-7+d,71+d,z-6,x+7-d,71+d,z+6,'spruce_stairs[facing=north]');
    box(x-6,65,z+3,x-4,65,z+4,'spruce_stairs[facing=north]');
    box(x+4,65,z+3,x+6,65,z+4,'spruce_stairs[facing=north]');
    sign(x-2,68,z+5,[label,'JURASSIC PARK']);
    stats.outlooks++;
  }
  shelter(-329,405,'雨林观景亭');
  shelter(25,-323,'溪谷木码头');
  shelter(332,185,'饲养观察棚');

  reserve({x1:37,z1:551,x2:47,z2:563},'guard hut');
  box(37,63,551,47,63,563,'stone_bricks');
  box(38,64,552,46,68,562,'light_gray_concrete');
  box(39,65,553,45,67,561,'air');
  box(38,66,553,38,67,559,'glass_pane');
  box(42,65,562,44,67,562,'air');
  box(37,69,551,47,69,563,'spruce_planks');
  for (const zz of [552,554,556,558,560]) box(37,64,zz,37,64,zz,zz%4===0?'yellow_concrete':'black_concrete');
  sign(40,67,563,['安全检查','STOP / CHECK']);
  stats.utilityDetails++;

  // Shallow water in front of the gate stays away from the central entrance road.
  reserve({x1:-65,z1:526,x2:-25,z2:539},'rainforest channel');
  for (let x=-64;x<=-26;x++) {
    const z=532+Math.round(Math.sin(x*0.35)*2);
    box(x,62,z-3,x,63,z+3,'clay');
    box(x,63,z-2,x,63,z+2,'water');
    if (x%7===0) box(x,64,z+1,x,64,z+1,'lily_pad');
    box(x,64,z-4,x,64,z-4,'moss_block');
  }
  stats.utilityDetails++;

  for (const e of plan.metadata.enclosures) {
    const {x1,x2,z1,z2}=e.bounds;
    for (const [x,z] of [[x1,z1],[x1,z2],[x2,z1],[x2,z2]]) {
      reserve({x1:x,z1:z,x2:x,z2:z},'fence beacon');
      box(x,76,z,x,76,z,'redstone_block');
      box(x,77,z,x,77,z,'redstone_lamp[lit=true]');
      stats.utilityDetails++;
    }
  }
  reserve({x1:333,z1:277,x2:338,z2:282},'power cabinet');
  box(333,63,277,338,63,282,'stone_bricks');
  box(334,64,278,337,68,281,'gray_concrete');
  box(334,65,282,337,65,282,'yellow_concrete');
  box(334,66,282,337,66,282,'black_concrete');
  box(334,67,282,337,67,282,'yellow_concrete');
  box(335,68,279,336,68,280,'iron_trapdoor');
  sign(334,69,282,['高压电网','DANGER']);
  stats.utilityDetails++;

  // Both facilities already have hollow shells; furniture stays against their rear walls.
  box(-9,65,254,9,65,259,'polished_andesite');
  for (const x of [-6,0,6]) {
    box(x-2,66,255,x+2,66,258,'dark_oak_planks');
    box(x-2,67,254,x+2,69,254,'black_concrete');
    box(x-1,68,255,x+1,68,255,'gray_stained_glass');
    box(x-1,66,258,x+1,66,258,'stone_button[face=floor,facing=north]');
  }
  stats.interiors++;
  for (const x of [-7,3]) {
    box(x,65,-484,x+4,65,-479,'white_concrete');
    box(x,66,-482,x+4,69,-479,'glass');
    box(x+1,66,-481,x+3,66,-480,'moss_block');
    box(x+2,67,-480,x+2,67,-480,'fern');
    box(x+1,70,-483,x+3,70,-479,'iron_trapdoor');
  }
  stats.interiors++;

  const groveZones=[
    {area:'visitor',bounds:{x1:-150,x2:-75,z1:380,z2:529},trees:24,patches:35},
    {area:'visitor',bounds:{x1:76,x2:95,z1:380,z2:500},trees:9,patches:19},
    {area:'visitor',bounds:{x1:95,x2:150,z1:505,z2:529},trees:6,patches:11},
    {area:'gate',bounds:{x1:-180,x2:-35,z1:530,z2:585},trees:19,patches:29},
    {area:'gate',bounds:{x1:35,x2:180,z1:530,z2:585},trees:19,patches:29}
  ];
  for (const [x,z,rx,rz,peak,label] of [[-116,511,11,9,3,'visitor west grass slope'],[122,542,12,10,3,'gate east grass slope']]) {
    const site={x1:x-rx,z1:z-rz,x2:x+rx,z2:z+rz};
    if (!safe(site,{avoidOld:true,avoidPlaced:true,avoidEnclosures:true,railMargin:14})) throw new Error(`No safe site for ${label}`);
    roundedHill(x,z,rx,rz,peak,label);
  }
  for (const zone of groveZones) {
    const b=zone.bounds;
    let planted=0;
    for (let attempt=0;planted<zone.trees && attempt<zone.trees*120;attempt++) {
      const x=integer(b.x1+6,b.x2-6),z=integer(b.z1+6,b.z2-6);
      const footprint={x1:x-5,z1:z-5,x2:x+5,z2:z+5};
      if (!safe(footprint,{avoidOld:true,avoidPlaced:true,avoidEnclosures:true,railMargin:14})) continue;
      jungleTree(x,z,planted%4===1);
      planted++;
    }
    if (planted < Math.ceil(zone.trees*0.75)) throw new Error(`Grove too sparse near ${zone.area}: ${planted}/${zone.trees}`);
    stats[zone.area==='gate'?'gateTrees':'visitorTrees']+=planted;
  }
  for (const zone of groveZones) {
    const b=zone.bounds,area=zone.area;
    for (let i=0;i<zone.patches;i++) {
      const before=stats.groundPatches;
      patch(zone,integer(b.x1+6,b.x2-6),integer(b.z1+6,b.z2-6),integer(2,4),integer(2,4),false,{avoidEnclosures:true});
      stats[area==='gate'?'gatePatches':'visitorPatches']+=stats.groundPatches-before;
    }
  }

  const finishing = addParkFinishingDetails(plan);
  plan.metadata.parkDetails = { ...stats, ...finishing, operationStart, operationCount: plan.operations.length - operationStart, reservedFootprints: placed.length, footprints: placed, safety: { minRailClearance: 4, spawnClearance: 10, brachiosaurusSpawnClearance: 18 } };
  return plan.metadata.parkDetails;
}

// This can also be applied to an already-built world as a small additive patch.
export function addParkFinishingDetails(plan) {
  if (!plan?.operations || !plan.metadata?.buildings || !plan.metadata?.enclosures) {
    throw new Error('Park finishing details require a populated plan');
  }
  const start = plan.operations.length;
  const stats = { centralGroves: 0, centralTrees: 0, centralFerns: 0, centralRocks: 0, lowLights: 0 };
  const id = block => block.includes(':') ? block : `minecraft:${block}`;
  const box = (x1,y1,z1,x2,y2,z2,block) => {
    plan.operations.push({kind:'box',x1,y1,z1,x2,y2,z2,block:id(block)});
    return plan.operations.at(-1);
  };

  for (const [cx,cz] of [[0,-470],[0,270],[500,500]]) {
    // Lamps recessed in the lower walls light furniture without narrowing the room.
    for (const dz of [-13,-4,5,14]) for (const side of [-1,1]) {
      box(cx+side*31,67,cz+dz,cx+side*31,67,cz+dz,'sea_lantern');
      box(cx+side*31,68,cz+dz,cx+side*31,68,cz+dz,'waxed_cut_copper');
      stats.lowLights++;
    }
    for (const dx of [-24,-12,12,24]) for (const dz of [-20,20]) {
      box(cx+dx,66,cz+dz,cx+dx,66,cz+dz,'sea_lantern');
      stats.lowLights++;
    }
    for (const dx of [-10,10]) for (const dz of [-13,1,13]) {
      box(cx+dx,64,cz+dz,cx+dx,64,cz+dz,'sea_lantern');
      stats.lowLights++;
    }
  }
  for (const x of [-12,12]) for (const z of [418,430,442,454]) {
    box(x,64,z,x,64,z,'sea_lantern');
    stats.lowLights++;
  }
  for (const x of [-49,-34,34,49]) for (const z of [417,433,449]) {
    box(x,64,z,x,64,z,'sea_lantern');
    stats.lowLights++;
  }
  for (const x of [-60,60]) for (const z of [416,432,448]) {
    box(x,66,z,x,66,z,'sea_lantern');
    box(x,67,z,x,67,z,'waxed_cut_copper');
    stats.lowLights++;
  }

  let seed=19930612;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const integer=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
  const intersects=(a,b)=>a.x1<=b.x2&&a.x2>=b.x1&&a.z1<=b.z2&&a.z2>=b.z1;
  const blockers=plan.operations.slice(0,start).filter(op=>op.kind==='box' && op.block!=='minecraft:air' &&
    op.x1<=100 && op.x2>=-100 && op.z1<=565 && op.z2>=-345 &&
    ((op.y2>=64 && op.y1<=90) || (op.y1<=63 && op.y2>=63 && /smooth_stone|stone_bricks|gray_concrete|water/.test(op.block))));
  const occupied=[];
  const rail=[
    {x1:-364,x2:-336,z1:-364,z2:664},{x1:336,x2:364,z1:-364,z2:664},
    {x1:-364,x2:364,z1:-364,z2:-336},{x1:-364,x2:364,z1:636,z2:664},
  ];
  const protectedAreas=[
    ...plan.metadata.enclosures.map(e=>({x1:e.bounds.x1-7,x2:e.bounds.x2+7,z1:e.bounds.z1-7,z2:e.bounds.z2+7})),
    ...plan.metadata.buildings.map(b=>({x1:b.bounds.x1-7,x2:b.bounds.x2+7,z1:b.bounds.z1-7,z2:b.bounds.z2+7})),
  ];
  function safeTree(site) {
    if (site.x1<-95||site.x2>95||site.z1<-335||site.z2>560) return false;
    if (site.x1<=13&&site.x2>=-13) return false;
    if (site.z1<=13&&site.z2>=-13) return false;
    return !rail.some(r=>intersects(site,r)) && !protectedAreas.some(r=>intersects(site,r)) &&
      !blockers.some(r=>intersects(site,r)) && !occupied.some(r=>intersects(site,r));
  }
  function tree(x,z,palm) {
    const h=integer(10,16),y=64+h;
    box(x,64,z,x,y-1,z,palm?'stripped_jungle_log':'jungle_log');
    if (palm) {
      for (const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        box(Math.min(x+dx,x+dx*4),y-1,Math.min(z+dz,z+dz*4),
          Math.max(x+dx,x+dx*4),y-1,Math.max(z+dz,z+dz*4),'jungle_leaves[persistent=true]');
      }
      box(x-1,y,z-1,x+1,y,z+1,'jungle_leaves[persistent=true]');
    } else {
      box(x-3,y-2,z,x+3,y-2,z,'jungle_leaves[persistent=true]');
      box(x,y-2,z-3,x,y-2,z+3,'jungle_leaves[persistent=true]');
      box(x-2,y-1,z-2,x+2,y-1,z+2,'jungle_leaves[persistent=true]');
      box(x-2,y,z-2,x+2,y,z+2,'jungle_leaves[persistent=true]');
      box(x-1,y+1,z-1,x+1,y+1,z+1,'jungle_leaves[persistent=true]');
    }
    box(x+4,64,z+1,x+4,64,z+1,stats.centralTrees%3===0?'large_fern':'fern');
    stats.centralTrees++;
    stats.centralFerns++;
    occupied.push({x1:x-5,x2:x+5,z1:z-5,z2:z+5});
  }
  for (const z of [-310,-245,-175,-105,-40,45,160,330,525]) for (const side of [-1,1]) {
    let planted=0;
    for (let attempt=0;attempt<900 && planted<8;attempt++) {
      const x=side*55+integer(-27,27),zz=z+integer(-25,25);
      const site={x1:x-5,x2:x+5,z1:zz-5,z2:zz+5};
      if (!safeTree(site)) continue;
      tree(x,zz,(planted+stats.centralGroves)%4===0);
      planted++;
    }
    if (planted) {
      const first=occupied.at(-planted);
      box(first.x1+1,64,first.z1+1,first.x1+1,64,first.z1+1,'mossy_cobblestone');
      stats.centralRocks++;
      stats.centralGroves++;
    }
  }
  if (stats.centralTrees<100||stats.centralTrees>150) throw new Error(`Central groves are too sparse: ${stats.centralTrees}`);
  stats.operationCount=plan.operations.length-start;
  plan.metadata.parkFinishing={...stats,operationStart:start};
  return stats;
}

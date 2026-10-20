import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { worldReader } from '../verification/city-world-reader.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(await readFile(path.join(dir, 'generated/city-traffic.json'), 'utf8'));
const sign = (x, z, rotation) => ({ x, y: 64, z, rotation });
const steps = (from, to, stride = 24) => {
  const arr = [from], d = Math.sign(to - from);
  for (let n = from + d * stride; d * (to - n) > 0; n += d * stride) arr.push(n);
  if (Math.abs(to - arr.at(-1)) < stride / 2) arr[arr.length - 1] = to;
  else arr.push(to);
  return arr;
};
function extraLoop(id, x1, z1, x2, z2) {
  const signs = [];
  for (const x of steps(x1 + 16, x2 - 16)) signs.push(sign(x, z1 + 4, 2));
  signs.push(sign(x2 - 8, z1 + 8, 3));
  for (const z of steps(z1 + 16, z2 - 16)) signs.push(sign(x2 - 4, z, 4));
  signs.push(sign(x2 - 8, z2 - 8, 5));
  for (const x of steps(x2 - 16, x1 + 16)) signs.push(sign(x, z2 - 4, 6));
  signs.push(sign(x1 + 8, z2 - 8, 7));
  for (const z of steps(z2 - 16, z1 + 16)) signs.push(sign(x1 + 4, z, 0));
  signs.push(sign(x1 + 8, z1 + 8, 1));
  return { id, bounds: { x1, z1, x2, z2 }, signs: [...new Map(signs.map(p => [`${p.x},${p.z}`, p])).values()] };
}
const routes = [
  ...base.metadata.routes.map(r => ({ id: r.id, bounds: r.bounds, signs: r.signs, count: 16 })),
  { ...extraLoop('north_main_streets', -604, -980, 600, -780), count: 24 },
  { ...extraLoop('south_main_streets', -604, 780, 600, 980), count: 24 },
];
function places({ x1, z1, x2, z2 }, n) {
  const segments = [
    { ax: x1+16, az: z1+4, bx: x2-16, bz: z1+4, yaw: 90 },
    { ax: x2-4, az: z1+16, bx: x2-4, bz: z2-16, yaw: 180 },
    { ax: x2-16, az: z2-4, bx: x1+16, bz: z2-4, yaw: 270 },
    { ax: x1+4, az: z2-16, bx: x1+4, bz: z1+16, yaw: 0 },
  ].map(s => ({ ...s, length: Math.hypot(s.bx-s.ax, s.bz-s.az) }));
  const total = segments.reduce((a,s) => a+s.length,0);
  return Array.from({ length: n }, (_, i) => {
    let d = (i+.35) * total/n;
    for (const s of segments) {
      if (d <= s.length) return { x: Math.round((s.ax+(s.bx-s.ax)*d/s.length)*2)/2, z: Math.round((s.az+(s.bz-s.az)*d/s.length)*2)/2, yaw: s.yaw };
      d -= s.length;
    }
    throw new Error('distance outside route');
  });
}
const colors = ['sedan_white','sedan_blue','sedan_gray','sedan_red'];
const existingSigns = base.operations.filter(o => !o.command?.includes('summon automobility:automobile'));
const operations = [
  { kind: 'command', command: 'kill @e[type=automobility:automobile,tag=city_life_traffic]' },
  ...existingSigns,
];
for (const r of routes.slice(4)) for (const p of r.signs) operations.push({ kind: 'command', command: `execute if block ${p.x} 64 ${p.z} minecraft:air run setblock ${p.x} 64 ${p.z} automobility:autopilot_sign[type=floor,rotation=${p.rotation},powered=false,waterlogged=false]` });
let buses = 0;
for (const route of routes) {
  route.vehicles = places(route.bounds, route.count).map((p, i) => {
    const bus = i % 8 === 7, id = bus ? `bus_${(buses++ % 2) ? 'green' : 'cream'}` : colors[i % colors.length];
    const tag = `city_v2_traffic_${route.id}_${i+1}`;
    const nbt = `{frame:"city_vehicles:${id}",wheels:"automobility:standard",engine:"city_vehicles:urban",frontAttachment:{type:"automobility:autopilot",StopsFor:["minecraft:player","easy_npc:humanoid"]},Invulnerable:0b,PersistenceRequired:1b,despawnTime:-1,decorative:0b,Tags:["city_v2_traffic","${tag}"],Rotation:[${p.yaw}f,0f]}`;
    operations.push({ kind: 'command', command: `execute unless entity @e[type=automobility:automobile,tag=${tag},limit=1] run summon automobility:automobile ${p.x} 64 ${p.z} ${nbt}` });
    return { ...p, frame: `city_vehicles:${id}`, tag };
  });
}
const output = {
  name: 'City vehicles v2: 1990s sedans and buses',
  bounds: base.bounds,
  operations,
  metadata: {
    mod: 'Automobility 0.5.0.h / Minecraft 1.21.1 NeoForge',
    resourcepack: 'modpack/city-vehicles-resourcepack',
    datapack: 'modpack/city-vehicles-datapack',
    engine: 'city_vehicles:urban',
    stockStoneSpeed: .58, urbanSpeed: .31,
    vehicleCount: routes.reduce((n,r) => n+r.count,0), busCount: buses,
    oldVehicleCount: base.metadata.vehicleCount,
    routes: routes.map(({ id,bounds,signs,vehicles }) => ({ id,bounds,signCount:signs.length,signs,vehicles })),
    order: ['install both packs', 'restart or reload client and server resources', 'apply operations'],
  },
};
const outPath = path.join(dir, 'generated/city-vehicles-v2.json');
await writeFile(outPath, JSON.stringify(output));
console.log(JSON.stringify({ output: outPath, vehicleCount: output.metadata.vehicleCount, busCount: buses, signs: routes.reduce((n,r)=>n+r.signs.length,0) }));

if (process.argv[2] === '--check-world') {
  const world = worldReader(path.resolve(process.argv[3]));
  const clear = new Set(['minecraft:air','minecraft:cave_air','automobility:autopilot_sign']);
  const issues = [];
  const seen = new Set();
  // One global pass: route centerlines every 8 blocks, plus all sign and spawn cells.
  for (const route of routes) {
    const { x1,z1,x2,z2 } = route.bounds;
    const samples = [...route.signs.map(p=>[p.x,p.z]),...route.vehicles.map(p=>[p.x,p.z])];
    for (const x of steps(x1+16,x2-16,8)) { samples.push([x,z1+4],[x,z2-4]); }
    for (const z of steps(z1+16,z2-16,8)) { samples.push([x1+4,z],[x2-4,z]); }
    for (const [cx,cz] of samples) for (const [dx,dz] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]]) {
      const x = Math.floor(cx+dx), z = Math.floor(cz+dz);
      for (const y of [64,65,66]) {
        const key = `${x},${y},${z}`; if (seen.has(key)) continue; seen.add(key);
        const block = (await world.block(x,y,z))?.Name;
        if (!clear.has(block)) issues.push({x,y,z,block});
      }
    }
  }
  console.log(JSON.stringify({ checkedCells: seen.size, vehicleCount: output.metadata.vehicleCount, busCount: buses, clearanceIssues: issues.length, examples: issues.slice(0,20) }, null, 2));
  if (issues.length) process.exitCode = 1;
}

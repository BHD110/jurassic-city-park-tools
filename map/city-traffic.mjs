import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { inflateSync, gunzipSync } from 'node:zlib';
import { worldReader } from '../verification/city-world-reader.mjs';

// Automobility 0.5.0.h: floor signs broadcast a heading to automobiles in a
// 32x4x32 box every four ticks. A sign's rotation is the path direction; 0=N,
// 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW.
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated');
const signBlock = rotation => `automobility:autopilot_sign[type=floor,rotation=${rotation},powered=false,waterlogged=false]`;
const sign = (x, z, rotation) => ({ x: Math.round(x), y: 64, z: Math.round(z), rotation });
const steps = (from, to, stride = 24) => {
  const result = [from], direction = Math.sign(to - from);
  for (let p = from + direction * stride; direction * (to - p) > 0; p += direction * stride) result.push(p);
  if (from !== to) {
    if (Math.abs(to - result.at(-1)) < stride / 2) result[result.length - 1] = to;
    else result.push(to);
  }
  return result;
};
const colors = [
  'red', 'yellow', 'light_blue', 'green', 'orange', 'white',
  'cyan', 'lime', 'purple', 'gray', 'pink', 'light_gray',
];

function loop(id, sx, sz, outer = true) {
  // Keep the tested northeast inner loop. The other three use the outer
  // x=780..980 roads to avoid fixed coaster pillars and the station bus.
  const x1 = sx > 0 ? (outer && sz > 0 ? 780 : 600) : (outer ? -980 : -780);
  const x2 = sx > 0 ? (outer && sz > 0 ? 980 : 780) : (outer ? -780 : -600);
  const z1 = sz > 0 ? 600 : -780, z2 = sz > 0 ? 780 : -600;
  const s = [];
  const add = (x, z, rotation) => s.push(sign(x, z, rotation));
  // Signs point clockwise, but Automobility 0.5.0.h actually drives in the
  // opposite direction: when the car faces along the sign, it burns out and
  // brakes. The tested vehicle faces against the sign and moves counterclockwise.
  // The 12-block corner radius works in either traversal direction; each turn
  // has an incoming cardinal sign, a diagonal sign, and an outgoing cardinal.
  for (const x of steps(x1 + 16, x2 - 16)) add(x, z1 + 4, 2);
  add(x2 - 8, z1 + 8, 3);
  for (const z of steps(z1 + 16, z2 - 16)) add(x2 - 4, z, 4);
  add(x2 - 8, z2 - 8, 5);
  for (const x of steps(x2 - 16, x1 + 16)) add(x, z2 - 4, 6);
  add(x1 + 8, z2 - 8, 7);
  for (const z of steps(z2 - 16, z1 + 16)) add(x1 + 4, z, 0);
  add(x1 + 8, z1 + 8, 1);
  const unique = [...new Map(s.map(p => [`${p.x},${p.z}`, p])).values()];
  const cars = [
    { x: x1 + 48.5, z: z1 + 4.5, yaw: 90 },
    { x: x2 - 4.5, z: z1 + 84.5, yaw: 180 },
    { x: x2 - 100.5, z: z2 - 4.5, yaw: 270 },
    { x: x1 + 140.5, z: z1 + 4.5, yaw: 90 },
    { x: x2 - 4.5, z: z1 + 160.5, yaw: 180 },
    { x: x1 + 4.5, z: z2 - 80.5, yaw: 0 },
    { x: x1 + 94.5, z: z1 + 4.5, yaw: 90 },
    { x: x2 - 4.5, z: z1 + 24.5, yaw: 180 },
    { x: x2 - 4.5, z: z1 + 122.5, yaw: 180 },
    { x: x2 - 42.5, z: z2 - 4.5, yaw: 270 },
    { x: x2 - 150.5, z: z2 - 4.5, yaw: 270 },
    { x: x1 + 4.5, z: z1 + 28.5, yaw: 0 },
  ];
  return { id, bounds: { x1, z1, x2, z2 }, signs: unique, cars };
}

const loops = [
  loop('northeast', 1, -1), loop('northwest', -1, -1),
  loop('southeast', 1, 1), loop('southwest', -1, 1),
];
const retiredSigns = [
  loop('northwest', -1, -1, false),
  loop('southeast', 1, 1, false),
  loop('southwest', -1, 1, false),
].flatMap(route => route.signs);

function signOperation(p) {
  // y=64 is normally air above the y=63 roadway. Never overwrite a structure.
  return { kind: 'command', command: `execute if block ${p.x} 64 ${p.z} minecraft:air run setblock ${p.x} 64 ${p.z} ${signBlock(p.rotation)}` };
}

function removeRetiredSign(p) {
  return { kind: 'command', command: `execute if block ${p.x} 64 ${p.z} automobility:autopilot_sign run setblock ${p.x} 64 ${p.z} minecraft:air` };
}

function carOperation(route, car, index) {
  const uniqueTag = `city_life_traffic_${route.id}_${index + 1}`;
  const frame = `automobility:standard_${colors[index]}`;
  const nbt = `{frame:"${frame}",wheels:"automobility:standard",engine:"automobility:stone",frontAttachment:{type:"automobility:autopilot",StopsFor:["minecraft:player","easy_npc:humanoid"]},Invulnerable:0b,PersistenceRequired:1b,despawnTime:-1,decorative:0b,Tags:["city_life_traffic","${uniqueTag}"],Rotation:[${car.yaw}f,0f]}`;
  return { kind: 'command', command: `execute unless entity @e[type=automobility:automobile,tag=${uniqueTag},limit=1] run summon automobility:automobile ${car.x} 64 ${car.z} ${nbt}` };
}

function makePlan(name, selected, carsPerLoop) {
  const operations = [];
  if (selected.length > 1) operations.push(...retiredSigns.map(removeRetiredSign));
  for (const route of selected) {
    operations.push(...route.signs.map(signOperation));
    operations.push(...route.cars.slice(0, carsPerLoop).map((car, i) => carOperation(route, car, i)));
  }
  return {
    name,
    bounds: { x1: -1000, z1: -1000, x2: 1000, z2: 1000 },
    operations,
    metadata: {
      mod: 'automobility 0.5.0.h / Minecraft 1.21.1 NeoForge',
      signY: 64, roadY: 63, routeIds: selected.map(r => r.id),
      vehicleCount: selected.length * carsPerLoop,
      retiredSignCount: selected.length > 1 ? retiredSigns.length : 0,
      routes: selected.map(r => ({ id: r.id, bounds: r.bounds, signCount: r.signs.length,
        signs: r.signs, cars: r.cars.slice(0, carsPerLoop) })),
    },
  };
}

await mkdir(out, { recursive: true });
const candidate = makePlan('City traffic northeast test loop', loops.slice(0, 1), 1);
const full = makePlan('City traffic four district loops', loops, 12);
await Promise.all([
  writeFile(path.join(out, 'city-traffic-candidate.json'), JSON.stringify(candidate)),
  writeFile(path.join(out, 'city-traffic.json'), JSON.stringify(full)),
]);
console.log(JSON.stringify({ candidate: candidate.operations.length, full: full.operations.length,
  signs: loops.map(r => [r.id, r.signs.length]), cars: full.metadata.vehicleCount }));

// Optional read-only check against an Anvil world: node map/city-traffic.mjs
// --check-world runtime/server/city-life-work
if (process.argv[2] === '--check-world') {
  const world = path.resolve(process.argv[3] || '');
  const nbt = createRequire(import.meta.url)('prismarine-nbt');
  const regions = new Map(), chunks = new Map(), issues = [];
  async function chunkAt(cx, cz) {
    const key = `${cx},${cz}`;
    if (chunks.has(key)) return chunks.get(key);
    const name = `r.${Math.floor(cx / 32)}.${Math.floor(cz / 32)}.mca`;
    if (!regions.has(name)) regions.set(name, await readFile(path.join(world, 'region', name)));
    const bytes = regions.get(name), slot = ((cz & 31) * 32) + (cx & 31);
    const sector = bytes.readUIntBE(slot * 4, 3);
    if (!sector) return null;
    const offset = sector * 4096, length = bytes.readUInt32BE(offset);
    const payload = bytes.subarray(offset + 5, offset + 4 + length);
    const compression = bytes[offset + 4];
    const raw = compression === 2 ? inflateSync(payload) : compression === 1 ? gunzipSync(payload) : payload;
    const chunk = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
    chunks.set(key, chunk);
    return chunk;
  }
  async function blockAt(x, y, z) {
    const chunk = await chunkAt(Math.floor(x / 16), Math.floor(z / 16));
    const section = chunk?.sections?.find(s => s.Y === Math.floor(y / 16));
    const palette = section?.block_states?.palette;
    if (!palette) return null;
    if (palette.length === 1) return palette[0].Name;
    const bits = Math.max(4, Math.ceil(Math.log2(palette.length))), perLong = Math.floor(64 / bits);
    const index = ((y & 15) << 8) | ((z & 15) << 4) | (x & 15);
    const word = BigInt(section.block_states.data[Math.floor(index / perLong)]);
    const paletteIndex = Number((word >> BigInt((index % perLong) * bits)) & ((1n << BigInt(bits)) - 1n));
    return palette[paletteIndex]?.Name || null;
  }
  for (const route of loops) for (const p of route.signs) {
    const above = await blockAt(p.x, 64, p.z), below = await blockAt(p.x, 63, p.z);
    if (!['minecraft:air', 'automobility:autopilot_sign'].includes(above) || !['minecraft:gray_concrete', 'minecraft:white_concrete', 'minecraft:yellow_concrete', 'minecraft:smooth_stone'].includes(below)) {
      issues.push({ route: route.id, x: p.x, z: p.z, above, below });
    }
  }
  console.log(JSON.stringify({ world, checkedSigns: loops.reduce((n, r) => n + r.signs.length, 0), issues }, null, 2));
  if (issues.length) process.exitCode = 1;
}

if (process.argv[2] === '--scan-world') {
  const world = path.resolve(process.argv[3] || '');
  const reader = worldReader(world);
  const clear = new Set(['minecraft:air', 'minecraft:cave_air', 'automobility:autopilot_sign']);
  const report = [];
  for (const route of loops) {
    const { x1, x2, z1, z2 } = route.bounds;
    const points = [];
    const line = (a, b) => {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      for (let i = 0; i <= n; i++) points.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
    };
    const arc = (cx, cz, begin) => {
      for (let i = 0; i <= 19; i++) {
        const a = begin + Math.PI * i / 38;
        points.push([cx + 12 * Math.cos(a), cz + 12 * Math.sin(a)]);
      }
    };
    line([x1 + 16, z1 + 4], [x2 - 16, z1 + 4]);
    arc(x2 - 16, z1 + 16, -Math.PI / 2);
    line([x2 - 4, z1 + 16], [x2 - 4, z2 - 16]);
    arc(x2 - 16, z2 - 16, 0);
    line([x2 - 16, z2 - 4], [x1 + 16, z2 - 4]);
    arc(x1 + 16, z2 - 16, Math.PI / 2);
    line([x1 + 4, z2 - 16], [x1 + 4, z1 + 16]);
    arc(x1 + 16, z1 + 16, Math.PI);
    const blocked = new Map();
    for (const [cx, cz] of points) for (let x = Math.floor(cx - 1.2); x <= Math.ceil(cx + 1.2); x++)
      for (let z = Math.floor(cz - 1.2); z <= Math.ceil(cz + 1.2); z++) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > 1.3) continue;
        for (const y of [64, 65, 66]) {
          const block = (await reader.block(x, y, z))?.Name;
          if (!clear.has(block)) blocked.set(`${x},${y},${z}`, { x, y, z, block });
        }
      }
    report.push({ route: route.id, samples: points.length, blocked: [...blocked.values()] });
  }
  console.log(JSON.stringify(report));
}

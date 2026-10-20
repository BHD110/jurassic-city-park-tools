import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const resources = path.join(root, 'modpack/city-vehicles-resourcepack');
const datapack = path.join(root, 'modpack/city-vehicles-datapack');
const models = path.join(resources, 'assets/city_vehicles/models/entity/automobile/frame');
const textures = path.join(resources, 'assets/city_vehicles/textures/entity/automobile/frame');
const frames = path.join(datapack, 'data/city_vehicles/automobility/automobile_frame');
const engines = path.join(datapack, 'data/city_vehicles/automobility/automobile_engine');
for (const dir of [models, textures, frames, engines]) await mkdir(dir, { recursive: true });

await writeFile(path.join(resources, 'pack.mcmeta'), JSON.stringify({ pack: { pack_format: 34, description: 'City Vehicles 1990s | Automobility OBJ models' } }, null, 2));
await writeFile(path.join(datapack, 'pack.mcmeta'), JSON.stringify({ pack: { pack_format: 48, description: 'City Vehicles 1990s | Automobility frames and slow urban engine' } }, null, 2));

// Four 16x16 swatches in a 64x64 PNG. OBJ faces use their own swatch UV.
const swatch = { paint: [0, 0], glass: [1, 0], trim: [2, 0], light: [3, 0], rear: [0, 1], grille: [1, 1], tire: [2, 1] };
const variants = {
  sedan_white: ['#d6d0b9', '#75838b'], sedan_blue: ['#466983', '#637a8b'],
  sedan_red: ['#994b42', '#767f86'], sedan_gray: ['#747a76', '#697a80'],
  bus_cream: ['#d3c59c', '#6c8387'], bus_green: ['#64836b', '#67818b'],
};
function color(hex) { return [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)); }
async function texture(id, paint, glass) {
  const atlas = { paint, glass, trim: '#424747', light: '#e8deb0', rear: '#a73731', grille: '#30383d', tire: '#282b2d' };
  const pixels = Buffer.alloc(64 * 64 * 4, 255);
  for (const [kind, [tx, ty]] of Object.entries(swatch)) {
    const rgb = color(atlas[kind]);
    for (let y = ty * 16; y < ty * 16 + 16; y++) for (let x = tx * 16; x < tx * 16 + 16; x++) {
      const p = (y * 64 + x) * 4;
      pixels[p] = rgb[0]; pixels[p + 1] = rgb[1]; pixels[p + 2] = rgb[2];
    }
  }
  await sharp(pixels, { raw: { width: 64, height: 64, channels: 4 } }).png().toFile(path.join(textures, `${id}.png`));
}

function makeObj(type) {
  const v = [], vt = [], vn = [], faces = [];
  const normal = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0]];
  function quad(points, n, material) {
    const base = v.length + 1, tex = vt.length + 1, ni = n + 1;
    v.push(...points);
    const [tx, ty] = swatch[material];
    const u = (tx * 16 + 1) / 64, u2 = (tx * 16 + 15) / 64;
    // ObjModel flips V before sampling Minecraft's top-origin PNG texture.
    const t = 1 - (ty * 16 + 1) / 64, t2 = 1 - (ty * 16 + 15) / 64;
    vt.push([u, t], [u2, t], [u2, t2], [u, t2]);
    // Exterior winding matters because Automobility's cutout material culls backfaces.
    faces.push(`f ${base}/${tex}/${ni} ${base + 2}/${tex + 2}/${ni} ${base + 1}/${tex + 1}/${ni}`);
    faces.push(`f ${base}/${tex}/${ni} ${base + 3}/${tex + 3}/${ni} ${base + 2}/${tex + 2}/${ni}`);
  }
  function box(x1, y1, z1, x2, y2, z2, mat = 'paint') {
    quad([[x1,y1,z1],[x2,y1,z1],[x2,y2,z1],[x1,y2,z1]], 0, mat);
    quad([[x2,y1,z2],[x1,y1,z2],[x1,y2,z2],[x2,y2,z2]], 1, mat);
    quad([[x1,y1,z2],[x1,y1,z1],[x1,y2,z1],[x1,y2,z2]], 2, mat);
    quad([[x2,y1,z1],[x2,y1,z2],[x2,y2,z2],[x2,y2,z1]], 3, mat);
    quad([[x1,y1,z2],[x2,y1,z2],[x2,y1,z1],[x1,y1,z1]], 4, mat);
    quad([[x1,y2,z1],[x2,y2,z1],[x2,y2,z2],[x1,y2,z2]], 5, mat);
  }
  if (type === 'sedan') {
    box(-.70,.27,-1.45,.70,.78,1.45); // long, ordinary four-door body
    box(-.63,.77,-.64,.63,1.43,.75,'glass');
    box(-.68,1.39,-.69,.68,1.49,.80); // roof
    for (const z of [-.69,.05,.76]) {
      box(-.69,.76,z,-.61,1.46,z+.08); box(.61,.76,z,.69,1.46,z+.08);
    }
    box(-.66,.77,-.70,.66,.86,-.61); box(-.66,.77,.75,.66,.86,.84);
    box(-.55,.44,-1.49,.55,.68,-1.46,'grille');
    for (const x of [-.57,.37]) box(x,.59,-1.51,x+.20,.72,-1.49,'light');
    for (const x of [-.57,.37]) box(x,.56,1.49,x+.20,.70,1.51,'rear');
    box(-.71,.30,-1.27,-.69,.43,1.28,'trim'); box(.69,.30,-1.27,.71,.43,1.28,'trim');
  } else {
    box(-.82,.32,-2.18,.82,.88,2.18);
    box(-.79,.87,-2.17,.79,2.18,2.17,'glass');
    box(-.84,2.10,-2.20,.84,2.28,2.20);
    for (const z of [-2.16,-1.42,-.68,.06,.80,1.54,2.12]) {
      box(-.84,.85,z,-.76,2.21,z+.08); box(.76,.85,z,.84,2.21,z+.08);
    }
    box(-.84,.84,-2.20,.84,.99,2.20);
    box(-.81,2.04,-2.22,.81,2.20,-2.14);
    box(-.62,.50,-2.23,.62,.73,-2.21,'grille');
    for (const x of [-.70,.49]) box(x,.70,-2.24,x+.21,.84,-2.21,'light');
    for (const x of [-.70,.49]) box(x,.70,2.21,x+.21,.84,2.24,'rear');
    box(-.85,.32,-1.88,-.83,.46,1.88,'trim'); box(.83,.32,-1.88,.85,.46,1.88,'trim');
  }
  return ['# City Vehicles original boxy 1990s ' + type, ...v.map(p => `v ${p.join(' ')}`), ...vt.map(p => `vt ${p.join(' ')}`), ...normal.map(p => `vn ${p.join(' ')}`), ...faces].join('\n') + '\n';
}
for (const type of ['sedan', 'bus']) {
  const dir = path.join(models, type); await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'main.obj'), makeObj(type));
  const modelDir = path.join(resources, 'assets/city_vehicles/automobile_models/frame');
  await mkdir(modelDir, { recursive: true });
  await writeFile(path.join(modelDir, `${type}.json`), JSON.stringify({
    type: 'automobility:obj', material: 'cutout',
    model_layer: `city_vehicles:automobile/frame/${type}/main`
  }, null, 2));
}
for (const [id, [paint, glass]] of Object.entries(variants)) await texture(id, paint, glass);

function wheel(forward, right, side, end) { return { end, forward, right, scale: 1.0, side, yaw: side === 'left' ? 0 : 180 }; }
function frame(id, type) {
  const bus = type === 'bus', axle = bus ? 26 : 17, right = bus ? 10 : 8;
  return {
    display: {
      driver_seat: [0, bus ? 13 : 7, bus ? -20 : -2],
      engine_position: [0, 4, bus ? -28 : -19],
      front_attachment_offset: bus ? 35 : 25,
      length_pixels: bus ? 70 : 47,
      model: `city_vehicles:frame/${type}`,
      rear_attachment_offset: bus ? 35 : 25,
      texture: `city_vehicles:textures/entity/automobile/frame/${id}.png`,
      wheels: [wheel(axle,-right,'left','front'),wheel(-axle,-right,'left','back'),wheel(axle,right,'right','front'),wheel(-axle,right,'right','back')]
    },
    hitboxes: bus ? [
      { height: 2.2, origin: [0,1.15,0], width: 1.7 },
      { height: 2.2, origin: [0,1.15,-1.4], width: 1.7 },
      { height: 2.2, origin: [0,1.15,1.4], width: 1.7 }
    ] : [
      { height: 1.45, origin: [0,.75,0], width: 1.42 },
      { height: .8, origin: [0,.5,-1.0], width: 1.42 },
      { height: .8, origin: [0,.5,1.0], width: 1.42 }
    ],
    horn: { loop_end: .6605, loop_start: .09435, pitches: [.59460354,.70710677], sound: { sound_id: 'automobility:entity.automobile.disc_horn' } },
    weight: bus ? .85 : .58,
    width: bus ? 1.7 : 1.42
  };
}
for (const id of Object.keys(variants)) await writeFile(path.join(frames, `${id}.json`), JSON.stringify(frame(id, id.startsWith('bus') ? 'bus' : 'sedan'), null, 2));
const stone = JSON.parse(await readFile(path.join(root, 'tools/city-life-research/automobility/source/neoforge/src/generated/resources/data/automobility/automobility/automobile_engine/stone.json'), 'utf8'));
await writeFile(path.join(engines, 'urban.json'), JSON.stringify({ ...stone, speed: .31, torque: .22 }, null, 2));
console.log(JSON.stringify({ resourcepack: resources, datapack, frames: Object.keys(variants), engine: 'city_vehicles:urban', models: ['sedan','bus'] }));

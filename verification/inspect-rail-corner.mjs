import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { inflateSync, gunzipSync } from 'node:zlib';
import path from 'node:path';

const require = createRequire(import.meta.url);
const nbt = require('prismarine-nbt');
const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) throw new Error('Usage: node inspect-rail-corner.mjs <candidate-world> <current-world>');
function reader(world) {
  const regions = new Map(), chunks = new Map();
  async function chunkAt(cx, cz) {
    const key = `${cx},${cz}`;
    if (chunks.has(key)) return chunks.get(key);
    const filename = `r.${Math.floor(cx / 32)}.${Math.floor(cz / 32)}.mca`;
    if (!regions.has(filename)) regions.set(filename, await readFile(path.join(world, 'region', filename)));
    const bytes = regions.get(filename), slot = (cz & 31) * 32 + (cx & 31), sector = bytes.readUIntBE(slot * 4, 3);
    if (!sector) return null;
    const offset = sector * 4096, size = bytes.readUInt32BE(offset), type = bytes[offset + 4];
    const payload = bytes.subarray(offset + 5, offset + 4 + size);
    const raw = type === 2 ? inflateSync(payload) : type === 1 ? gunzipSync(payload) : type === 3 ? payload : null;
    if (!raw) throw new Error(`Bad compression in ${filename}`);
    const chunk = nbt.simplify(nbt.parseUncompressed(raw, 'big'));
    chunks.set(key, chunk);
    return chunk;
  }
  return async (x, y, z) => {
    const chunk = await chunkAt(Math.floor(x / 16), Math.floor(z / 16));
    const section = chunk?.sections?.find(s => s.Y === Math.floor(y / 16));
    const { palette, data } = section?.block_states ?? {};
    if (!palette) return 'minecraft:air';
    if (palette.length === 1) return palette[0].Name;
    const bits = Math.max(4, Math.ceil(Math.log2(palette.length))), perLong = Math.floor(64 / bits);
    const index = ((y & 15) << 8) | ((z & 15) << 4) | (x & 15);
    const word = BigInt.asUintN(64, BigInt(data[Math.floor(index / perLong)]));
    const paletteIndex = Number((word >> BigInt((index % perLong) * bits)) & ((1n << BigInt(bits)) - 1n));
    const block = palette[paletteIndex];
    return `${block.Name}${block.Properties ? JSON.stringify(block.Properties) : ''}`;
  };
}
const before = reader(beforePath), after = reader(afterPath), changed = [];
for (let z = 625; z <= 658; z++) for (let x = -784; x <= -770; x++) for (let y = 75; y <= 81; y++) {
  const oldBlock = await before(x, y, z), currentBlock = await after(x, y, z);
  if (oldBlock !== currentBlock) changed.push({ x, y, z, oldBlock, currentBlock });
}
console.log(JSON.stringify({ beforePath, afterPath, changed: changed.length,
  nearCurve: changed.filter(block => block.z >= 642 && block.z <= 654),
  otherExamples: changed.filter(block => block.z < 642 || block.z > 654).slice(0, 30) }, null, 2));

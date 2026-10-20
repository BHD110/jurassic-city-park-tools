import { createRequire } from 'node:module';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
let nbt;
try { nbt = require('prismarine-nbt'); }
catch { nbt = require(process.env.PARK_NBT_PACKAGE || 'D:/codeSource/product/jev/mindcraft-agent-gpt/node_modules/prismarine-nbt'); }
const [world, levelName = 'Jurassic City Park'] = process.argv.slice(2);
if (!world) throw new Error('Usage: node runtime/prepare-world.mjs <exported-world> [world-name]');
const levelFile = path.join(world, 'level.dat');
const { parsed } = await nbt.parse(await readFile(levelFile), 'big');
const data = parsed.value.Data.value;
const put = (object, key, type, value) => { object[key] = { type, value }; };
put(data, 'LevelName', 'string', levelName);
put(data, 'GameType', 'int', 1);
put(data, 'allowCommands', 'byte', 1);
put(data, 'hardcore', 'byte', 0);
put(data, 'SpawnX', 'int', 0);
put(data, 'SpawnY', 'int', 65);
put(data, 'SpawnZ', 'int', 657);
const rules = data.GameRules.value;
for (const name of ['commandBlockOutput', 'sendCommandFeedback']) put(rules, name, 'string', 'false');
put(rules, 'spawnRadius', 'string', '0');
function resetPlayer(player) {
  put(player, 'playerGameType', 'int', 1);
  put(player, 'Pos', 'list', { type: 'double', value: [0.5, 65, 657.5] });
  put(player, 'Motion', 'list', { type: 'double', value: [0, 0, 0] });
  put(player, 'Rotation', 'list', { type: 'float', value: [180, 0] });
  put(player, 'FallDistance', 'float', 0);
  put(player, 'Health', 'float', 20);
  if (player.abilities) {
    for (const name of ['mayfly', 'instabuild', 'invulnerable']) put(player.abilities.value, name, 'byte', 1);
    put(player.abilities.value, 'flying', 'byte', 0);
  }
}
if (data.Player) resetPlayer(data.Player.value);
await writeFile(levelFile, gzipSync(nbt.writeUncompressed(parsed, 'big')));
const playerDir = path.join(world, 'playerdata');
for (const file of await readdir(playerDir).catch(() => [])) {
  if (!file.endsWith('.dat')) continue;
  const target = path.join(playerDir, file);
  const player = (await nbt.parse(await readFile(target), 'big')).parsed;
  resetPlayer(player.value);
  await writeFile(target, gzipSync(nbt.writeUncompressed(player, 'big')));
}
const checked = nbt.simplify((await nbt.parse(await readFile(levelFile), 'big')).parsed).Data;
if (checked.GameType !== 1 || checked.allowCommands !== 1 || checked.SpawnZ !== 657) throw new Error('Export settings failed verification');
console.log(JSON.stringify({ world, name: checked.LevelName, creative: true, commands: true, spawn: [0, 65, 657] }));

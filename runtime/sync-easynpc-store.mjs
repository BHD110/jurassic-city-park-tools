import { readFile, readdir, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import path from 'node:path';
import nbt from 'prismarine-nbt';

const world = process.argv[2];
if (!world) throw new Error('Pass a stopped world path');
const dir = path.join(world, 'easy_npc', 'npcs');
const files = (await readdir(dir)).filter(name => name.endsWith('.npc.nbt'));
if (files.length !== 4372) throw new Error(`Expected 4372 NPC files, found ${files.length}`);
const indexFile = path.join(world, 'data', 'easy_npc_index.dat');
const index = nbt.parseUncompressed(gunzipSync(await readFile(indexFile)), 'big');
const records = index.value.data.value.Metadata.value.value;
const key = uuid => uuid.join(',');
const existing = new Set(records.map(record => key(record.UUID.value)));
const metadata = structuredClone(records[0]);
let updated = 0, indexed = 0;
for (const name of files) {
  const file = path.join(dir, name);
  const tree = nbt.parseUncompressed(gunzipSync(await readFile(file)), 'big');
  const goals = tree.value.ObjectiveData?.value.ObjectiveDataSet?.value.value;
  const home = goals?.find(goal => goal.Type?.value === 'MOVE_BACK_TO_HOME');
  if (!home) throw new Error(`NPC lacks home objective: ${name}`);
  home.StopDistance = { type: 'float', value: 30 };
  await writeFile(file, gzipSync(nbt.writeUncompressed(tree, 'big')));
  updated++;
  const uuid = tree.value.UUID.value;
  if (!existing.has(key(uuid))) {
    const record = structuredClone(metadata);
    record.UUID.value = uuid;
    records.push(record);
    existing.add(key(uuid));
    indexed++;
  }
}
await writeFile(indexFile, gzipSync(nbt.writeUncompressed(index, 'big')));
console.log(JSON.stringify({ updated, indexed, indexTotal: records.length }));

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'map/generated/upgrade-full.json'));
const plan = JSON.parse(source);
const station = plan.route.station;
const y = station.y + 1;
const positions = [
  [station.x - 10, y, station.z + 8],
  [station.x - 10, y, station.z + 7],
  [station.x - 10, y, station.z + 6],
  [station.x - 10, y, station.z + 5],
  [station.x - 10, y, station.z + 4],
  [station.x + 10, y, station.z + 8],
  [station.x + 20, y, station.z + 8],
];
const wanted = new Set(positions.map(position => position.join(',')));
const latest = new Map();
for (const op of plan.operations) {
  if (op.kind !== 'command') continue;
  const location = /^(?:setblock|data merge block) (-?\d+) (-?\d+) (-?\d+)\b/.exec(op.command);
  if (!location) continue;
  const key = location.slice(1).join(',');
  if (!wanted.has(key)) continue;
  const command = /\bCommand:("(?:\\.|[^"\\])*")/.exec(op.command);
  if (!command) throw new Error(`station command NBT missing at ${key}`);
  latest.set(key, JSON.parse(command[1]));
}
if (latest.size !== positions.length) throw new Error(`expected seven station commands, found ${latest.size}`);
const originalCommands = positions.map(position => latest.get(position.join(',')));
if (!originalCommands[3].includes('Motion:[0.28d,0.0d,0.0d]')) throw new Error('final eastbound launch command missing');
const positionedPrefix = `execute positioned ${station.x} ${station.y + 1} ${station.z} run `;
const operations = originalCommands.map(command => ({
  kind: 'command',
  command: command.startsWith(positionedPrefix) ? command.slice(positionedPrefix.length) : command,
}));
const result = {
  name: 'Station Action Command Syntax Validation',
  operations,
  metadata: {
    sourcePlan: 'upgrade-full',
    sourceSha256: createHash('sha256').update(source).digest('hex'),
    station,
    commandBlockPositions: positions,
    originalCommands,
    parserLimitation: 'ParkValidate rejects execute positioned wrappers even for run say; four action commands are parsed without that wrapper. The final world checker compares the full installed commands.',
  },
};
await writeFile(path.join(root, 'map/generated/station-command-syntax.json'), JSON.stringify(result));
console.log(JSON.stringify({ sourceSha256: result.metadata.sourceSha256, commands: operations.length }));

import { readFile, writeFile } from 'node:fs/promises';
import { connect } from '../runtime/city-life-control.mjs';

const seconds = Number(process.argv[2] || 10);
if (!Number.isFinite(seconds) || seconds < 3 || seconds > 60) throw new Error('Sample duration must be 3..60 seconds');
const client = await connect();
const snapshot = async () => {
  await client.command('citytraffic audit');
  return JSON.parse(await readFile('runtime/server/citytraffic-audit.json', 'utf8'));
};
let before, after;
try {
  before = await snapshot();
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  after = await snapshot();
} finally { client.close(); }
const previous = new Map(before.cars.map(c => [c.id, c]));
const samples = after.cars.filter(c => previous.has(c.id)).map(c => {
  const old = previous.get(c.id);
  return { ...c, distance: Math.hypot(c.x - old.x, c.z - old.z) };
});
const moving = samples.filter(c => c.distance >= 1);
const incomplete = samples.filter(c => c.engines < 1 || c.wheels < 4);
const modelMovement = {};
for (const car of samples) {
  const group = modelMovement[car.model] ||= { compared: 0, moved: 0 };
  group.compared++;
  if (car.distance >= 1) group.moved++;
}
const report = { checkedAt: new Date().toISOString(), seconds, beforeTick: before.tick, afterTick: after.tick,
  beforeSummary: before.summary, afterSummary: after.summary, compared: samples.length,
  moved: moving.length, incomplete: incomplete.length, models: [...new Set(samples.map(c => c.model))],
  modelMovement, passed: moving.length > 0 && !incomplete.length, samples };
await writeFile('verification/iv-traffic-movement.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, samples: report.samples.slice(0, 6) }));
process.exitCode = report.passed ? 0 : 1;

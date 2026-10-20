#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const planName = process.argv[2] || 'upgrade-full';
if (!/^[a-zA-Z0-9_-]{1,64}$/.test(planName)) throw new Error('invalid plan name');
const planBytes = await readFile(path.join(root, 'map', 'generated', `${planName}.json`));
const plan = JSON.parse(planBytes);
const points = plan.route?.points || [];
const rideReportPath = path.join(root, 'runtime', 'server', `parkbuild-railtest-${planName}.json`);
const checks = [];
const check = (name, ok, detail) => checks.push({ name, status: ok ? 'pass' : 'fail', detail });
const key = p => `${p.x},${p.y},${p.z}`;
const min = (a, b) => Math.min(a, b);
const max = (a, b) => Math.max(a, b);
const bucket = 32;
const buckets = new Map();

for (const op of plan.operations || []) {
  if (op.kind !== 'box') continue;
  const b = {
    x1: min(op.x1, op.x2), x2: max(op.x1, op.x2),
    y1: min(op.y1, op.y2), y2: max(op.y1, op.y2),
    z1: min(op.z1, op.z2), z2: max(op.z1, op.z2),
    block: op.block,
  };
  for (let x = Math.floor(b.x1 / bucket); x <= Math.floor(b.x2 / bucket); x += 1) {
    for (let z = Math.floor(b.z1 / bucket); z <= Math.floor(b.z2 / bucket); z += 1) {
      const k = `${x},${z}`;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(b);
    }
  }
}

function blockAt(x, y, z) {
  const candidates = buckets.get(`${Math.floor(x / bucket)},${Math.floor(z / bucket)}`) || [];
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const b = candidates[i];
    if (x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2 && z >= b.z1 && z <= b.z2) return b.block;
  }
  return null;
}

const seen = new Set();
let duplicate = 0, disconnected = 0, slopeTurn = 0, wrongShape = 0;
let railMismatch = 0, supportMismatch = 0, headroomMismatch = 0, powerMismatch = 0;
const examples = { rail: [], support: [], headroom: [], shape: [] };
for (let i = 0; i < points.length; i += 1) {
  const p = points[i], prev = points[(i - 1 + points.length) % points.length], next = points[(i + 1) % points.length];
  const k = key(p);
  if (seen.has(k)) duplicate += 1;
  seen.add(k);
  if (Math.abs(p.x - next.x) + Math.abs(p.z - next.z) !== 1 || Math.abs(p.y - next.y) > 1) disconnected += 1;
  const turn = prev.x !== next.x && prev.z !== next.z;
  if (turn && (p.y !== prev.y || p.y !== next.y)) slopeTurn += 1;
  const higher = [prev, next].filter(q => q.y > p.y);
  const high = higher[0];
  const direction = high && (high.x > p.x ? 'east' : high.x < p.x ? 'west' : high.z > p.z ? 'south' : 'north');
  if (higher.length > 1 || (high && p.shape !== `ascending_${direction}`) || (!high && p.shape.startsWith('ascending_'))) {
    wrongShape += 1;
    if (examples.shape.length < 5) examples.shape.push(k);
  }
  const expectedRail = `minecraft:${p.powered ? 'powered_rail' : 'rail'}[shape=${p.shape}${p.powered ? ',powered=true' : ''}]`;
  if (blockAt(p.x, p.y, p.z) !== expectedRail) {
    railMismatch += 1;
    if (examples.rail.length < 5) examples.rail.push(k);
  }
  const support = blockAt(p.x, p.y - 1, p.z);
  if (support !== (p.powered ? 'minecraft:redstone_block' : 'minecraft:stone_bricks')) {
    supportMismatch += 1;
    if (examples.support.length < 5) examples.support.push(k);
  }
  if ([1, 2].some(dy => blockAt(p.x, p.y + dy, p.z) !== 'minecraft:air')) {
    headroomMismatch += 1;
    if (examples.headroom.length < 5) examples.headroom.push(k);
  }
  if (p.powered && !['east_west', 'north_south'].includes(p.shape) && !p.shape.startsWith('ascending_')) powerMismatch += 1;
}

const launch = (plan.operations || []).filter(o => o.kind === 'command' && /^data merge block -10 65 655 /.test(o.command || '')).at(-1)?.command || '';
check('embedded-route', points.length >= 2400 && plan.route.length === points.length && plan.metadata?.routeLength === points.length, `route points ${points.length}, declared ${plan.route?.length}, metadata ${plan.metadata?.routeLength}`);
check('closed-continuous', duplicate === 0 && disconnected === 0 && slopeTurn === 0 && wrongShape === 0, `duplicates ${duplicate}, disconnected ${disconnected}, slope turns ${slopeTurn}, wrong shapes ${wrongShape}; examples ${examples.shape.join(' ')}`);
check('rail-blocks', railMismatch === 0, `${railMismatch} mismatches; examples ${examples.rail.join(' ')}`);
check('supports-and-power', supportMismatch === 0 && powerMismatch === 0, `support ${supportMismatch}, powered curve ${powerMismatch}; examples ${examples.support.join(' ')}`);
check('headroom', headroomMismatch === 0, `${headroomMismatch} blocked; examples ${examples.headroom.join(' ')}`);
check('station-launch', launch.includes('Motion:[0.28d,0.0d,0.0d]'), launch ? 'station command points east' : 'station launch command missing');
check('eight-zones', Array.isArray(plan.route.zones) && plan.route.zones.length === 8, `${plan.route.zones?.length ?? 0} zones`);

let ride = null;
try { ride = JSON.parse(await readFile(rideReportPath)); } catch { /* No new-plan ride report yet. */ }
let expectedWorld = null;
try {
  const properties = await readFile(path.join(root, 'runtime', 'server', 'server.properties'), 'utf8');
  expectedWorld = properties.split(/\r?\n/).find(s => s.startsWith('level-name='))?.slice('level-name='.length) || null;
} catch { /* The plan can be checked before the server exists. */ }
const planSha256 = createHash('sha256').update(planBytes).digest('hex');
const routeSha256 = createHash('sha256').update(JSON.stringify(plan.route)).digest('hex');
const observations = ride?.observations || [];
const runtimeProvenance = !!ride && ride.planFileName === planName && ride.planName === plan.name
  && ride.planSha256 === planSha256 && ride.routeSha256 === routeSha256
  && expectedWorld !== null && ride.worldName === expectedWorld;
const rideDuration = ride && Number(ride.elapsedSeconds);
const measuredRide = runtimeProvenance && ride.source === 'server-minecart' && ride.result === 'completed'
  && ride.completedLaps >= 1 && ride.serverTicks >= 6000 && rideDuration >= 300
  && observations.some(o => o.atSeconds >= 300);
const routeCells = new Set(points.map(p => `${p.x},${p.z}`));
const nearRoute = observations.filter(o => {
  for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) {
    if (routeCells.has(`${Math.floor(o.x) + dx},${Math.floor(o.z) + dz}`)) return true;
  }
  return false;
}).length;
const observedZones = new Set(observations.map(o => o.zone));
const missingZones = (plan.route.zones || []).map(z => z.id).filter(id => !observedZones.has(id));
const runtimeChecks = {
  provenance: ride ? runtimeProvenance ? 'pass' : 'fail' : 'pending',
  realMinecartLapAtLeast300Seconds: ride ? measuredRide ? 'pass' : 'fail' : 'pending',
  samplesNearRoute: ride ? observations.length >= 2 && nearRoute / observations.length >= 0.9 ? 'pass' : 'fail' : 'pending',
  eightZonesObserved: ride ? missingZones.length === 0 ? 'pass' : 'fail' : 'pending',
  noRouteProgressJump: ride ? ride.maxForwardJump == null ? 'pending'
    : Number.isInteger(ride.maxForwardJump) && ride.maxForwardJump <= 8 ? 'pass' : 'fail' : 'pending',
  playerBoardingButton: 'pending',
};

const report = {
  planFileName: planName,
  planName: plan.name,
  planSha256,
  routeSha256,
  status: checks.every(c => c.status === 'pass') ? 'passed' : 'failed',
  checks,
  runtimeReportPath: rideReportPath,
  expectedWorld,
  runtimeChecks,
  runtimeDetails: ride ? { missingZones, maxForwardJump: ride.maxForwardJump ?? null } : null,
};
const reportPath = path.join(root, 'verification', `${planName}-route-check.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${report.status}: ${checks.map(c => `${c.name}=${c.status}`).join(' ')}`);
if (report.status !== 'passed') process.exitCode = 1;

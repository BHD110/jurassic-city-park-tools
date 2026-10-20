const floorAllowed = new Set([
  'minecraft:air', 'minecraft:smooth_stone', 'minecraft:polished_andesite',
  'minecraft:light_gray_concrete', 'minecraft:white_concrete', 'minecraft:bricks',
  'minecraft:chiseled_stone_bricks', 'minecraft:sea_lantern'
]);

export function addInteriorLighting(plan) {
  if (!Array.isArray(plan?.operations) || !Array.isArray(plan?.route?.points)) {
    throw new Error('Interior lighting requires a complete plan and route');
  }
  const candidates = [];
  const add = (x, y, z, area, surface) => candidates.push({ x, y, z, area, surface });

  for (const z of [418, 426, 434, 442, 450, 458]) {
    add(-20, 64, z, 'visitor-centre-hall', 'floor');
    add(20, 64, z, 'visitor-centre-hall', 'floor');
    add(-7, 65, z, 'visitor-centre-fossil', 'floor');
    add(7, 65, z, 'visitor-centre-fossil', 'floor');
  }
  for (const x of [-7, 7]) add(x, 64, 466, 'visitor-centre-fossil', 'floor');
  for (const z of [474, 478]) {
    add(-8, 70, z, 'visitor-centre-entry', 'wall');
    add(8, 70, z, 'visitor-centre-entry', 'wall');
    add(-3, 65, z, 'visitor-centre-entry', 'floor');
    add(3, 65, z, 'visitor-centre-entry', 'floor');
  }
  for (const x of [-4, 4]) add(x, 68, 481, 'visitor-centre-steps', 'floor');
  for (const z of [421, 425, 433, 437, 445, 449, 457, 461]) {
    add(-60, 70, z, 'visitor-centre-west-wing', 'wall');
    add(60, 70, z, 'visitor-centre-east-wing', 'wall');
  }
  for (const [cx, cz, id] of [[0, -470, 'hatchery'], [0, 270, 'control'], [500, 500, 'maintenance']]) {
    for (const dz of [-14, -7, 0, 7, 14]) {
      add(cx - 31, 70, cz + dz, `${id}-west-wall`, 'wall');
      add(cx + 31, 70, cz + dz, `${id}-east-wall`, 'wall');
    }
    for (const dx of [-24, -8, 8, 24]) for (const dz of [-11, -3, 5, 13]) {
      if (id === 'control' && dz === -11 && Math.abs(dx) === 8) continue;
      add(cx + dx, 64, cz + dz, `${id}-floor`, 'floor');
    }
  }

  const boxes = plan.operations.filter(op => op.kind === 'box');
  const blockAt = (x, y, z) => {
    for (let i = boxes.length - 1; i >= 0; i -= 1) {
      const op = boxes[i];
      if (x >= op.x1 && x <= op.x2 && y >= op.y1 && y <= op.y2 && z >= op.z1 && z <= op.z2) return op.block;
    }
    return y === 63 ? 'minecraft:grass_block' : 'minecraft:air';
  };
  const report = { operations: 0, checks: [] };
  const blocked = [];
  const pending = [];
  for (const site of candidates) {
    const { x, y, z, area, surface } = site;
    const before = blockAt(x, y, z);
    if (before === 'minecraft:sea_lantern') continue;
    const exposed = surface === 'floor' ? blockAt(x, y + 1, z) === 'minecraft:air' :
      [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]].some(([a, b]) => blockAt(a, y, b) === 'minecraft:air');
    const allowed = surface === 'floor' ? floorAllowed.has(before) :
      /minecraft:(?:chiseled_stone_bricks|light_gray_concrete|white_concrete|bricks)/.test(before);
    if (!allowed || !exposed) blocked.push({ x, y, z, before, exposed, area });
    else pending.push(site);
  }
  report.checks.push({ id: 'target-surfaces', pass: blocked.length === 0, blocked });
  const spawns = plan.operations.filter(op => op.kind === 'spawn' && String(op.entity).startsWith('jurassicreborn:'));
  const spawnOverlap = pending.filter(({ x, z }) => spawns.some(op => Math.abs(op.x - (x + 0.5)) <= 1 && Math.abs(op.z - (z + 0.5)) <= 1));
  report.checks.push({ id: 'dinosaur-clearance', pass: spawnOverlap.length === 0, overlaps: spawnOverlap.length });
  const railCells = new Set(plan.route.points.map(point => `${point.x},${point.z}`));
  const railOverlap = pending.filter(({ x, z }) => railCells.has(`${x},${z}`));
  report.checks.push({ id: 'rail-clearance', pass: railOverlap.length === 0, overlaps: railOverlap.length });
  report.pass = report.checks.every(check => check.pass);
  if (!report.pass) throw new Error(`Interior lighting precheck failed: ${JSON.stringify(report.checks)}`);

  for (const { x, y, z } of pending) {
    plan.operations.push({ kind: 'box', x1: x, y1: y, z1: z, x2: x, y2: y, z2: z, block: 'minecraft:sea_lantern' });
  }
  report.operations = pending.length;
  return report;
}

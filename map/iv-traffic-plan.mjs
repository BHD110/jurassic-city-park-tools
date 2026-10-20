import { readFile, writeFile } from 'node:fs/promises';

const xGrid = [-980, -780, -600, -450, -330, -210, -100, 0, 100, 210, 330, 450, 600, 780, 980];
const zGrid = [-980, -780, -600, -420, -240, 0, 240, 420, 600, 780, 980];
const routes = [];
const cars = [];
const buses = ['hyundai_new_county', 'hyundai_eleccity'];
const sedans = ['hyundai_sonata_new_rise', 'hyundai_grandeur_ig', 'kia_k5', 'hyundai_sonata_the_edge'];
let busCount = 0;
let existingModels = new Map();
try {
  const existing = JSON.parse(await readFile('map/generated/iv-traffic.json', 'utf8'));
  existingModels = new Map(existing.cars.map(car => [car.id, car.model]));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

function routeForCell(x1, x2, z1, z2) {
  const offset = value => [-450, -330, -210, -100, 0, 100, 210, 330, 450, -420, -240, 240, 420].includes(value) ? 3 : 4;
  const west = x1 + offset(x1), east = x2 - offset(x2);
  const north = z1 + offset(z1), south = z2 - offset(z2);
  const points = [];
  const push = (x, z) => {
    if (points.at(-1)?.x !== x || points.at(-1)?.z !== z) points.push({ x, z });
  };
  const line = (ax, az, bx, bz) => {
    const length = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(length / 12);
    for (let step = 0; step <= steps; step++) {
      const fraction = step / steps;
      push(ax + (bx - ax) * fraction, az + (bz - az) * fraction);
    }
  };
  const corners = [
    [x1 + 14, north], [x2 - 14, north],
    [east, z1 + 14], [east, z2 - 14],
    [x2 - 14, south], [x1 + 14, south],
    [west, z2 - 14], [west, z1 + 14]
  ];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length];
    line(a[0], a[1], b[0], b[1]);
  }
  points.pop();
  return points;
}

function interpolate(points, distance) {
  const segments = points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    return { point, next, length: Math.hypot(next.x - point.x, next.z - point.z) };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = distance % total;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const fraction = remaining / segment.length;
      return {
        x: segment.point.x + (segment.next.x - segment.point.x) * fraction,
        z: segment.point.z + (segment.next.z - segment.point.z) * fraction,
        yaw: Math.atan2(segment.next.x - segment.point.x, segment.next.z - segment.point.z) * 180 / Math.PI
      };
    }
    remaining -= segment.length;
  }
  throw new Error('Unreachable route distance');
}

function addPointsRoute(id, points, spacing) {
  routes.push({ id, points });
  const length = points.reduce((sum, point, i) => {
    const next = points[(i + 1) % points.length];
    return sum + Math.hypot(next.x - point.x, next.z - point.z);
  }, 0);
  const count = Math.max(3, Math.round(length / spacing));
  for (let i = 0; i < count; i++) {
    const position = interpolate(points, (i + 0.35) * length / count);
    const isBus = cars.length % 8 === 7;
    cars.push({
      id: `${id}_${i + 1}`, route: id,
      model: isBus ? buses[busCount++ % buses.length] : sedans[cars.length % sedans.length],
      x: Math.round(position.x * 2) / 2,
      y: 64,
      z: Math.round(position.z * 2) / 2,
      yaw: position.yaw
    });
  }
}

function addRoute(id, x1, x2, z1, z2, spacing) {
  addPointsRoute(id, routeForCell(x1, x2, z1, z2), spacing);
}

function stationRoadRoute(left, right) {
  const points = [];
  for (let x = left; x <= right; x += 12) points.push({ x: Math.min(x, right), z: 642 });
  points.push({ x: right, z: 650 }, { x: right, z: 658 });
  for (let x = right - 12; x >= left; x -= 12) points.push({ x: Math.max(x, left), z: 658 });
  points.push({ x: left, z: 650 });
  return points;
}

for (let xi = 0; xi < xGrid.length - 1; xi++) for (let zi = 0; zi < zGrid.length - 1; zi++) {
  const x1 = xGrid[xi], x2 = xGrid[xi + 1], z1 = zGrid[zi], z2 = zGrid[zi + 1];
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  const northSouth = Math.abs(mz) >= 600 && Math.abs(mx) < 600;
  const eastWest = Math.abs(mx) >= 600 && Math.abs(mz) < 600;
  const corner = Math.abs(mx) >= 600 && Math.abs(mz) >= 600;
  const station = z1 === 600 && z2 === 780 && x1 < 100 && x2 > -100;
  if ((!northSouth && !eastWest && !corner) || station) continue;
  const id = `cell_${xi}_${zi}`;
  // Shared streets belong to adjacent loops, giving about 50 blocks between cars.
  addRoute(id, x1, x2, z1, z2, 100);
}

addRoute('outer_perimeter', -980, 980, -980, 980, 50);
addPointsRoute('station_road_west', stationRoadRoute(-970, -70), 50);
addPointsRoute('station_road_east', stationRoadRoute(70, 970), 50);

const main = [-980, -780, -600, 600, 780, 980];
const localX = [-450, -330, -210, -100, 0, 100, 210, 330, 450];
const localZ = [-420, -240, 0, 240, 420];
const roadSegments = [
  ...main.map(value => ({ axis: 'x', value, from: -980, to: 980 })),
  ...main.flatMap(value => value === 600 ? [
    { axis: 'z', value, from: -980, to: -100 },
    { axis: 'z', value, from: 100, to: 980 }
  ] : [{ axis: 'z', value, from: -980, to: 980 }]),
  ...localX.filter(value => Math.abs(value) >= 100).flatMap(value => [
    { axis: 'x', value, from: -980, to: -600 },
    { axis: 'x', value, from: 600, to: 980 }
  ]),
  ...localX.filter(value => Math.abs(value) < 100).flatMap(value => [
    { axis: 'x', value, from: -980, to: -600 },
    { axis: 'x', value, from: 780, to: 980 }
  ]),
  ...localZ.flatMap(value => [
    { axis: 'z', value, from: -980, to: -600 },
    { axis: 'z', value, from: 600, to: 980 }
  ]),
  { axis: 'z', value: 650, from: -970, to: -70, tolerance: 10 },
  { axis: 'z', value: 650, from: 70, to: 970, tolerance: 10 }
];

function projected(segment) {
  const along = segment.axis === 'x' ? 'z' : 'x';
  return cars.filter(car => Math.abs(car[segment.axis] - segment.value) <= (segment.tolerance ?? 5)
    && car[along] >= segment.from && car[along] <= segment.to)
    .map(car => car[along]).sort((a, b) => a - b);
}

for (const segment of roadSegments) {
  const along = segment.axis === 'x' ? 'z' : 'x';
  let positions = [segment.from, ...projected(segment), segment.to];
  for (let i = 1; i < positions.length; i++) {
    const gap = positions[i] - positions[i - 1];
    if (gap <= 55) continue;
    const needed = Math.ceil(gap / 42) - 1;
    for (let n = 1; n <= needed; n++) {
      const desired = positions[i - 1] + n * gap / (needed + 1);
      let best = null;
      for (const route of routes) for (let pointIndex = 0; pointIndex < route.points.length; pointIndex++) {
        const point = route.points[pointIndex];
        if (Math.abs(point[segment.axis] - segment.value) > (segment.tolerance ?? 5)) continue;
        const distance = Math.hypot(point[segment.axis] - segment.value, point[along] - desired);
        if (distance > 25 || best && distance >= best.distance) continue;
        best = { route, pointIndex, point, distance };
      }
      if (!best) throw new Error(`No route near ${segment.axis}=${segment.value}, ${desired}`);
      const next = best.route.points[(best.pointIndex + 1) % best.route.points.length];
      cars.push({
        id: `gap_${segment.axis}_${segment.value}_${Math.round(desired)}`,
        route: best.route.id,
        model: sedans[cars.length % sedans.length],
        x: Math.round(best.point.x * 2) / 2, y: 64,
        z: Math.round(best.point.z * 2) / 2,
        yaw: Math.atan2(next.x - best.point.x, next.z - best.point.z) * 180 / Math.PI
      });
    }
  }
}

const segmentGaps = roadSegments.map(segment => {
  const positions = [segment.from, ...projected(segment), segment.to];
  return { ...segment, cars: positions.length - 2,
    maxGap: Math.max(...positions.slice(1).map((position, i) => position - positions[i])) };
});
const worstGap = Math.max(...segmentGaps.map(segment => segment.maxGap));
if (worstGap > 55) throw new Error(`Road gap too large: ${worstGap}`);

let retired;
try {
  retired = JSON.parse(await readFile('map/generated/iv-traffic-retired.json', 'utf8'));
} catch {
  const state = JSON.parse(await readFile('runtime/server/jurassic-city-v2/citytraffic-state.json', 'utf8'));
  const activeIds = new Set(cars.map(car => car.id));
  const old = state.assignments.filter(assignment => !activeIds.has(assignment.id));
  const totals = new Map();
  for (const assignment of old) totals.set(assignment.route, (totals.get(assignment.route) || 0) + 1);
  retired = old.map((assignment, index) => {
    let origin;
    if (assignment.route === 'park_perimeter') {
      origin = routeForCell(-600, 600, -600, 600);
    } else if (assignment.route.startsWith('cell_')) {
      const [, xi, zi] = assignment.route.split('_');
      origin = routeForCell(xGrid[Number(xi)], xGrid[Number(xi) + 1],
        zGrid[Number(zi)], zGrid[Number(zi) + 1]);
    } else {
      origin = routes[0].points;
    }
    const ordinal = Number(assignment.id.match(/_(\d+)$/)?.[1] ?? 1);
    const position = interpolate(origin, (ordinal - 0.65) * origin.reduce((sum, point, i) => {
      const next = origin[(i + 1) % origin.length];
      return sum + Math.hypot(next.x - point.x, next.z - point.z);
    }, 0) / Math.max(ordinal, totals.get(assignment.route)));
    let nearest;
    for (const route of routes) for (const point of route.points) {
      if (Math.abs(point.x) < 70 && point.z > 600 && point.z < 780) continue;
      if (Math.abs(point.x) <= 594 && Math.abs(point.z) <= 594) continue;
      const distance = Math.hypot(point.x - position.x, point.z - position.z);
      if (!nearest || distance < nearest.distance) nearest = { route, point, distance };
    }
    if (!nearest) throw new Error(`No safe route for ${assignment.id}`);
    return {
      id: assignment.id, route: nearest.route.id,
      model: index % 8 === 7 ? buses[index % buses.length] : sedans[index % sedans.length],
      x: Math.round(nearest.point.x * 2) / 2, y: 64,
      z: Math.round(nearest.point.z * 2) / 2, yaw: position.yaw
    };
  });
  await writeFile('map/generated/iv-traffic-retired.json', JSON.stringify(retired, null, 2) + '\n');
}
for (const car of retired) {
  if (cars.some(current => current.id === car.id)) throw new Error(`Duplicate existing ID: ${car.id}`);
  cars.push(car);
}
for (const car of cars) car.model = existingModels.get(car.id) ?? car.model;

await writeFile('map/generated/iv-traffic.json', JSON.stringify({ routes, cars }, null, 2) + '\n');
await writeFile('verification/iv-traffic-road-gaps.json', JSON.stringify({
  routeCount: routes.length,
  vehicleCount: cars.length,
  busCount: cars.filter(car => buses.includes(car.model)).length,
  maxRoadGap: worstGap,
  segments: segmentGaps
}, null, 2) + '\n');
console.log(JSON.stringify({ routes: routes.length, cars: cars.length,
  buses: cars.filter(car => buses.includes(car.model)).length,
  maxRoadGap: Math.round(worstGap) }));

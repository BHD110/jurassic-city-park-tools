import {readFile} from 'node:fs/promises';
import sharp from 'sharp';

const full = JSON.parse(await readFile('map/generated/upgrade-full.json', 'utf8'));
const city = JSON.parse(await readFile('map/generated/city-coaster-route.json', 'utf8')).route.points;
const tour = JSON.parse(await readFile('map/generated/park-tour-route.json', 'utf8')).route.points;
const tx = x => 450 + x * 0.43, tz = z => 470 + z * 0.43;
const path = points => points.map((p, i) => `${i ? 'L' : 'M'}${tx(p.x).toFixed(1)},${tz(p.z).toFixed(1)}`).join(' ');
const color = p => p.zone.startsWith('city-') ? '#286bba' : '#dd6c16';
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="990" viewBox="0 0 900 990"><rect width="900" height="990" fill="white"/><g font-family="Microsoft YaHei, sans-serif" letter-spacing="0"><text x="36" y="40" font-size="24" fill="#222">轨道位置简图（上北下南）</text><text x="36" y="74" font-size="18" fill="#16814b">绿色：新建玻璃观光线，保留</text><text x="36" y="103" font-size="18" fill="#286bba">蓝色：无玻璃、经过车站的城市段</text><text x="36" y="132" font-size="18" fill="#dd6c16">橙色：无玻璃、离车站较远的园内段</text>`;
for (const e of full.metadata.enclosures) {
  const b = e.bounds;
  svg += `<rect x="${tx(b.x1)}" y="${tz(b.z1)}" width="${(b.x2 - b.x1) * 0.43}" height="${(b.z2 - b.z1) * 0.43}" fill="#f2f4f2" stroke="#d9dfd9"/><text x="${tx((b.x1 + b.x2) / 2)}" y="${tz((b.z1 + b.z2) / 2)}" text-anchor="middle" font-size="13" fill="#666">${e.name}</text>`;
}
svg += `<path d="${path([...tour, tour[0]])}" fill="none" stroke="#16814b" stroke-width="3" opacity="0.9"/>`;
for (let i = 0; i < city.length; i++) {
  svg += `<path d="${path([city[i], city[(i + 1) % city.length]])}" fill="none" stroke="${color(city[i])}" stroke-width="4"/>`;
}
svg += `<circle cx="${tx(0)}" cy="${tz(650)}" r="8" fill="#222"/><text x="${tx(0) + 15}" y="${tz(650) + 7}" font-size="20" fill="#222">车站</text><text x="36" y="910" font-size="18" fill="#222">蓝色和橙色前后相连，合起来是一条无玻璃环线。</text><text x="36" y="945" font-size="18" fill="#222">要删的是橙色园内段吗？</text></g></svg>`;
await sharp(Buffer.from(svg)).png().toFile('verification/rail-delete-selection.png');

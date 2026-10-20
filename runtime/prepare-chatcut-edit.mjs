import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';

const out='video/剪辑资料';
await mkdir(out,{recursive:true});
const paragraphs=(await readFile('video/旁白稿.md','utf8')).split(/\r?\n\s*\r?\n/).map(p=>p.trim()).filter(p=>p&&!/^[#>]/.test(p));
const names=['成果开场','成果快剪','进入讲解','公园要能逛','地图规划','施工工具','批量施工','建筑导入','绿化与照明','恐龙与游客','城市车辆','观光轨道','地图检查','成果回顾','结尾'];
const visuals=[['03','01'],['20','07','03','01','02','08'],['23'],['02','11','05','08'],['overview','21','15','08'],['construction','builder','19'],['11','13','14','builder'],['12','14','01','schematic'],['16','13','09','11'],['03','04','05','07'],['20','traffic','15','06'],['02','10','08'],['overview','before-after','23','10'],['20','07','01','03','08'],['23','01']];
let start=0;
const plan=paragraphs.map((text,i)=>{
  const targetSeconds=Math.ceil(text.length/(i<3?4.7:4.2)+5);
  const row={index:i,name:names[i],text,visuals:visuals[i],sourceEvidence:'录屏素材镜头总览、城市镜头总览、全图航拍总览及真实地图资料',targetSeconds,estimatedSpeechSeconds:Math.ceil(text.length/(i<3?4.7:4.2)),provisionalStartSeconds:start,fit:'fits',voiceStyle:i<2?'excited':'relaxed'};
  start+=targetSeconds;return row;
});
plan[0].text='太牛了！我用 AI 一小时就造了一座侏罗纪公园！';
await writeFile('video/chatcut-edit-plan.json',JSON.stringify(plan,null,2));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
async function codeImage(name,title,file,lines){
  const rows=lines.flatMap(line=>line.length>83?line.match(/.{1,83}/g):[line]).slice(0,13);
  const svg=`<svg width="1280" height="720"><rect width="1280" height="720" fill="#191c1b"/><rect x="0" y="0" width="12" height="720" fill="#79c89e"/><text x="60" y="78" fill="#ffffff" font-family="Microsoft YaHei" font-size="36">${escape(title)}</text><text x="60" y="122" fill="#96b3a3" font-family="Consolas" font-size="20">${escape(file)}</text>${rows.map((r,i)=>`<text x="60" y="${180+i*34}" fill="#e3e9e5" font-family="Consolas,Microsoft YaHei" font-size="23">${escape(r)}</text>`).join('')}<text x="60" y="676" fill="#a1aaa4" font-family="Microsoft YaHei" font-size="20">真实项目文件节选 · 代码说明画面，非施工过程录像</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${out}/${name}.png`);
}
const build=JSON.parse(await readFile('map/generated/upgrade-full.json','utf8'));
const op=build.operations.find(x=>x.kind==='box');
await codeImage('construction','施工清单：一个操作描述一片方块','map/generated/upgrade-full.json',JSON.stringify(op,null,2).split('\n'));
const java=(await readFile('builder/MDK-1.21.1-ModDevGradle-main/src/main/java/com/example/examplemod/ParkBuilder.java','utf8')).split(/\r?\n/);
await codeImage('builder','NeoForge：读取计划，分批放置','ParkBuilder.java',[java.find(x=>x.includes('BLOCKS_PER_TICK =')), '',...java.slice(64,71).map(x=>x.trim()),'',java.find(x=>x.includes('static BuildJob read(')).trim()]);
const convert=(await readFile('map/convert-jpog-visitor.mjs','utf8')).split(/\r?\n/);
await codeImage('schematic','建筑导入：旧 schematic 转为施工计划','map/convert-jpog-visitor.mjs',convert.slice(0,13));
const traffic=JSON.parse(await readFile('map/generated/iv-traffic.json','utf8'));
await codeImage('traffic','CityTraffic：路线和车辆分别配置','map/generated/iv-traffic.json',JSON.stringify({routeId:traffic.routes[0].id,points:traffic.routes[0].points.slice(0,2),vehicle:traffic.cars[0]},null,2).split('\n'));
console.log(JSON.stringify({segments:plan.length,estimatedSeconds:start,files:4}));

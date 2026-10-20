#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'.');
const full=JSON.parse(fs.readFileSync(path.join(root,'map/generated/full.json'),'utf8'));
const polish=JSON.parse(fs.readFileSync(path.join(root,'map/generated/polish.json'),'utf8'));
const checks=[];
const check=(id,ok,detail)=>checks.push({id,status:ok?'pass':'error',detail});
const ops=full.operations,patch=polish.operations;
function lastBlock(operations,x,y,z) {
  for(let i=operations.length-1;i>=0;i--) {
    const o=operations[i];
    if(o.kind==='box'&&x>=o.x1&&x<=o.x2&&y>=o.y1&&y<=o.y2&&z>=o.z1&&z<=o.z2) return o.block;
  }
  return null;
}
const air=b=>b===null||b==='minecraft:air';
const indoors=[
  ['visitor-room',0,68,460],['visitor-entry',0,70,482],
  ['hatchery-room',0,69,-470],['hatchery-entry',0,67,-449],
  ['control-room',0,69,270],['control-entry',0,67,291],
  ['maintenance-room',500,69,500],['maintenance-entry',500,67,521]
];
for(const [id,x,y,z] of indoors) check(id,lastBlock(ops,x,y,z)==='minecraft:air',`${x},${y},${z} 最终方块 ${lastBlock(ops,x,y,z)}`);
check('visitor-fossil',lastBlock(ops,0,70,440)?.includes('bone_block'),`展厅骨架 ${lastBlock(ops,0,70,440)}`);
check('visitor-three-thatch-roofs',[[0,96,440],[-39,94,424],[39,94,424]].every(([x,y,z])=>lastBlock(ops,x,y,z)==='minecraft:packed_mud'),'中央大草顶及左右小草顶均存在');
check('visitor-hall-clearance',lastBlock(ops,0,76,425)==='minecraft:air','化石展厅上方保持挑空');
check('visitor-water-and-vehicles',lastBlock(ops,0,64,505)==='minecraft:water'&&lastBlock(ops,-55,65,497)==='minecraft:light_gray_concrete'&&lastBlock(ops,55,65,497)==='minecraft:yellow_concrete','入口水池、灰红 Jeep 与黄绿 Explorer');
check('visitor-pond-contained',[[0,502],[0,511],[-19,506],[19,506],[-19,502],[19,511]].every(([x,z])=>lastBlock(ops,x,64,z)==='minecraft:smooth_stone')&&lastBlock(ops,0,64,506)==='minecraft:water','水池四边及角落有连续高出水面的石沿');
check('visitor-side-windows',[-1,1].every(side=>[415,427,439,451].every(z=>lastBlock(ops,side*62,70,z)==='minecraft:air'&&lastBlock(ops,side*61,70,z)==='minecraft:gray_stained_glass')),'两翼长墙各有四组内凹窄窗');
check('interior-lighting',lastBlock(ops,20,76,260)==='minecraft:sea_lantern'&&lastBlock(ops,16,65,416)==='minecraft:sea_lantern','游客中心和设施内有实体照明');
check('sign-backing',lastBlock(ops,0,77,480)==='minecraft:polished_andesite'&&lastBlock(ops,0,76,292)==='minecraft:polished_andesite'&&lastBlock(ops,-540,74,249)==='minecraft:polished_andesite','游客中心、设施和围场牌有背板');
check('gate-lettering',ops.filter(o=>o.kind==='box'&&o.block==='minecraft:red_concrete'&&o.z1===576&&o.y1>=88&&o.y2<=100).length>=100&&lastBlock(ops,25,116,578)==='minecraft:fire'&&air(lastBlock(ops,0,70,570)),'黑底红黄方块字、双柱火炬与敞开的中轴');
const mainBuildings=full.metadata.buildings.filter(b=>b.id.startsWith('city-')&&!b.id.startsWith('city-annex-'));
const annexes=full.metadata.buildings.filter(b=>b.id.startsWith('city-annex-'));
const parcels=full.metadata.cityParcels||[];
check('1993-city-scale',mainBuildings.length===80&&annexes.length>=150&&mainBuildings.every(b=>b.bounds.y2<=110)&&mainBuildings.every(b=>b.style!=='glass-tower'),'80 栋低中层主楼与至少 150 栋沿街配楼，无蓝玻璃高塔');
const tiledShops=mainBuildings.filter(b=>b.style==='shop-row');
check('tiled-roof-ridge',tiledShops.length===8&&tiledShops.every(b=>{const cx=Math.floor((b.bounds.x1+b.bounds.x2)/2),cz=Math.floor((b.bounds.z1+b.bounds.z2)/2);return lastBlock(ops,cx,83,cz)==='minecraft:bricks'&&air(lastBlock(ops,b.bounds.x1+8,83,cz));}),'沿街商铺红瓦从两侧连续收至窄屋脊，无大片平木顶');
check('city-parcels',parcels.length===80&&parcels.every(p=>p.bounds.x2-p.bounds.x1>=90&&p.bounds.z2-p.bounds.z1>=88&&lastBlock(ops,p.bounds.x1+1,63,p.bounds.z1+1)!==null),'80 块有铺装与花园的街区地块，宽至少 90 格');
check('building-verification-targets',full.metadata.buildings.every(b=>['roof','wall'].every(k=>{const p=b.verify?.[k];return p&&lastBlock(ops,p.x,p.y,p.z)===p.block;})),'所有建筑均给出可在生成结果复核的屋顶与墙体坐标');

const controls=ops.filter(o=>o.kind==='command'&&o.command?.startsWith('setblock ')&&o.command.includes('command_block'));
const buttons=ops.filter(o=>o.kind==='box'&&o.block.startsWith('minecraft:stone_button'));
check('station-controls',controls.length===7&&buttons.filter(o=>o.z1===659&&[-10,10,20].includes(o.x1)).length===3,'乘车命令链、创造和冒险三个按钮');
check('cart-boarding-sequence',controls.some(o=>o.command.includes('nbt=!{Passengers:[{}]}'))&&controls.some(o=>o.command.includes('run summon minecraft:minecart'))&&controls.some(o=>o.command.includes('run ride @p'))&&controls.some(o=>o.command.includes('run data merge entity'))&&!ops.some(o=>o.kind==='command'&&o.command?.startsWith('summon minecraft:minecart')),'清旧空车、召车、乘坐后发车，生成计划不自动放空车');
check('cart-initial-speed',controls.some(o=>o.command.includes('Motion:[-0.28d,0.0d,0.0d]')),'乘客上车后指定向西初速度');
check('mode-switch',controls.some(o=>o.command.includes('gamemode creative'))&&controls.some(o=>o.command.includes('gamemode adventure')),'两个模式切换命令存在');

check('tunnel-roof',lastBlock(ops,-120,82,-350)==='minecraft:deepslate_tiles','高架隧道有连续顶盖');
check('tunnel-walls',lastBlock(ops,-120,78,-354)==='minecraft:deepslate_bricks'&&lastBlock(ops,-120,78,-346)==='minecraft:deepslate_bricks','高架隧道有双侧墙体');
check('tunnel-clearance',[77,78,79].every(y=>air(lastBlock(ops,-120,y,-350))),'隧道轨道上方至少三格净空');
const pillar=full.route.points.find((p,i)=>p.y>=76&&i%12===0);
check('bridge-pillar',!!pillar&&lastBlock(ops,pillar.x,64,pillar.z)==='minecraft:polished_andesite',pillar?`支柱 ${pillar.x},64,${pillar.z} 连接到高架轨道`:'未找到高架轨道');

const spawns=ops.filter(o=>o.kind==='spawn'&&o.entity?.startsWith('jurassicreborn:'));
const blocked=[];
for(const o of spawns) {
  const x=Math.floor(o.x),z=Math.floor(o.z);
  for(let y=64;y<=68;y++) {
    const block=lastBlock(ops,x,y,z);
    if(block&&!air(block)) {blocked.push(`${o.entity}@${x},${y},${z}:${block}`);break;}
  }
}
check('dinosaur-spawn-clearance',spawns.length===64&&blocked.length===0,`64 只恐龙出生点；阻挡 ${blocked.length} 处${blocked.length?`，例 ${blocked.slice(0,3).join('；')}`:''}`);
check('dinosaur-ai',spawns.every(o=>o.nbt?.includes('NoAI:0b')&&o.nbt?.includes('DinosaurAge:')),'所有恐龙成年且保留 AI');

const first=patch.find(o=>o.kind==='box');
check('polish-clean-start',patch[0]?.kind==='removeEntities'&&patch[1]?.kind==='removeEntities'&&first?.block==='minecraft:air'&&first.x1===-128&&first.x2===128&&first.y1===64&&first.y2===110&&first.z1===-128&&first.z2===128,'先移走样板实体，再清除中心 64..110 层');
const removals=patch.map((o,i)=>({o,i})).filter(({o})=>o.kind==='removeEntities');
const replay=patch.map((o,i)=>({o,i})).filter(({o})=>o.kind==='spawn');
check('polish-entity-reset',removals.length===10&&replay.length===64&&Math.max(...removals.map(r=>r.i))<Math.min(...replay.map(r=>r.i)),'中心矿车、中心恐龙、八个围场逐区块清理后重放64只');
check('polish-controls',patch.filter(o=>o.kind==='command'&&o.command?.includes('command_block')).length===7&&patch.filter(o=>o.kind==='box'&&o.block.startsWith('minecraft:stone_button')&&o.z1===659&&[-10,10,20].includes(o.x1)).length===3,'补丁包含完整乘车命令链和操作台');
let regionMismatch=0;
for(const [x,z] of [[0,0],[-80,-60],[0,100],[100,0],[-20,-80],[80,80]]) {
  for(const y of [64,65,70,80,100]) {
    const original=lastBlock(ops,x,y,z),repaired=lastBlock(patch,x,y,z);
    if(!((air(original)&&air(repaired))||original===repaired)) regionMismatch++;
  }
}
check('sample-region-rebuild',regionMismatch===0,`中心代表位置与 full 最终方块差异 ${regionMismatch} 处`);

const errors=checks.filter(c=>c.status==='error').length;
const report={generatedAt:new Date().toISOString(),summary:{status:errors?'failed':'passed',errors,passed:checks.length-errors},checks};
fs.writeFileSync(path.join(root,'verification/report-polish.json'),JSON.stringify(report,null,2));
const lines=[`# 补丁与建筑验收`,`状态：${report.summary.status}，通过 ${report.summary.passed}，错误 ${errors}`,'',...checks.map(c=>`- [${c.status==='pass'?'通过':'失败'}] ${c.id}：${c.detail}`)];
fs.writeFileSync(path.join(root,'verification/report-polish.md'),`${lines.join('\n')}\n`);
console.log(lines.join('\n'));
process.exitCode=errors?1:0;

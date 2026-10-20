import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const world=process.argv[2];if(!world)throw new Error('Pass the working world');
const plan=JSON.parse(await readFile('map/generated/upgrade-full.json','utf8'));
const root=path.join(world,'datapacks/city-life-safety');
for(const p of ['data/city_life/function','data/minecraft/tags/function'])await mkdir(path.join(root,p),{recursive:true});
await writeFile(path.join(root,'pack.mcmeta'),JSON.stringify({pack:{pack_format:48,description:'City pedestrians stay outside dinosaur enclosures'}},null,2));
await writeFile(path.join(root,'data/minecraft/tags/function/load.json'),JSON.stringify({values:['city_life:load']}));
await writeFile(path.join(root,'data/city_life/function/load.mcfunction'),'schedule function city_life:watch 40t replace\n');
const lines=plan.metadata.enclosures.map(({bounds:b})=>{
 const x=Math.ceil(b.x1),z=Math.ceil(b.z1),dx=Math.floor(b.x2)-x,dz=Math.floor(b.z2)-z;
 return `execute as @e[type=easy_npc:humanoid,tag=city_life_pedestrian,x=${x},y=-64,z=${z},dx=${dx},dy=384,dz=${dz}] at @s run function city_life:return_home with entity @s Navigation.Home`;
});
lines.push('schedule function city_life:watch 40t replace');
lines.push('execute as @e[type=easy_npc:humanoid,tag=city_life_pedestrian] at @s run function city_life:keep_radius with entity @s Navigation.Home');
await writeFile(path.join(root,'data/city_life/function/watch.mcfunction'),lines.join('\n')+'\n');
await writeFile(path.join(root,'data/city_life/function/return_home.mcfunction'),'$tp @s $(X) $(Y) $(Z)\n');
await writeFile(path.join(root,'data/city_life/function/keep_radius.mcfunction'),'$execute positioned $(X) $(Y) $(Z) if entity @s[distance=30.01..] run tp @s $(X) $(Y) $(Z)\n');
console.log(JSON.stringify({datapack:root,enclosures:plan.metadata.enclosures.length,intervalTicks:40,radius:30}));

import {readFile, access} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root=path.resolve('video/capture');
const shots=JSON.parse(await readFile(path.resolve(process.argv[2] ?? path.join(root,'main-plan.json')),'utf8'));
const output=path.resolve(process.argv[3] ?? path.join(root,'contact-sheet.png'));
const tiles=[];
for(const shot of shots){
  const file=path.join(root,`${shot.id}-${Math.floor(shot.seconds*24/2)}.png`);
  try{await access(file);}catch{continue;}
  const thumb=await sharp(file).resize(480,270).toBuffer();
  const label=Buffer.from(`<svg width="480" height="32"><rect width="480" height="32" fill="#202020"/><text x="12" y="22" fill="white" font-size="16" font-family="Microsoft YaHei">${shot.id} ${shot.label}</text></svg>`);
  const index=tiles.length/2, x=(index%3)*480,y=Math.floor(index/3)*302;
  tiles.push({input:thumb,left:x,top:y},{input:label,left:x,top:y+270});
}
if(!tiles.length)throw new Error('No captured frames yet');
await sharp({create:{width:1440,height:Math.ceil(tiles.length/6)*302,channels:3,background:'#202020'}}).composite(tiles).png().toFile(output);
console.log(`Reviewed ${tiles.length/2} shots`);

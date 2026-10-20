import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import path from 'node:path';

const root=path.resolve('video/capture');
const out=path.resolve('video/录屏素材');
await mkdir(out,{recursive:true});
const supplement=process.argv[2] === '--city';
const flyover=process.argv[2] === '--flyover';
const shots=JSON.parse(await readFile(path.join(root,flyover?'flyover-plan.json':supplement?'city-plan.json':'main-plan.json'),'utf8'));
const manifest=[];
for(const shot of shots){
  const source=path.join(root,`${shot.id}.mp4`);
  const info=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_frames,duration','-of','json',source],{encoding:'utf8'}));
  const stream=info.streams[0];
  if(!stream || Number(stream.nb_frames)!==shot.seconds*24 || Math.abs(Number(stream.duration)-shot.seconds)>.1)throw new Error(`Incomplete capture: ${shot.id}`);
  const name=`${shot.id.slice(0,2)}-${shot.label}.mp4`;
  await copyFile(source,path.join(out,name));
  manifest.push({...shot,file:name,encoding:stream});
}
await copyFile(path.join(root,flyover?'flyover-contact-sheet.png':supplement?'city-contact-sheet.png':'contact-sheet.png'),path.join(out,flyover?'全图航拍总览.png':supplement?'城市镜头总览.png':'镜头总览.png'));
await writeFile(path.join(out,flyover?'全图航拍素材清单.json':supplement?'城市补充素材清单.json':'素材清单.json'),JSON.stringify(manifest,null,2));

const order=flyover?shots.map((_,i)=>i):supplement?[0,1,4,5,6,2,3,7,8,9]:[2,1,5,6,4,0,9,7,3,8];
const args=['-hide_banner','-loglevel','warning','-y'];
for(const i of order){const shot=shots[i];args.push('-ss',String(flyover?0:shot.seconds/2-2),'-t',String(flyover?shot.seconds:4),'-i',path.join(out,manifest[i].file));}
const reset=order.map((_,i)=>`[${i}:v]setpts=PTS-STARTPTS[v${i}]`).join(';');
args.push('-filter_complex',`${reset};${order.map((_,i)=>`[v${i}]`).join('')}concat=n=${order.length}:v=1:a=0[out]`,'-map','[out]','-an','-c:v','libx264','-preset','veryfast','-crf','19','-threads','2','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,flyover?'全地图快速航拍.mp4':supplement?'城市补充预览.mp4':'园区实录预览.mp4'));
const encoder=spawn('ffmpeg',args,{stdio:['ignore','ignore','inherit'],windowsHide:true});
await new Promise((resolve,reject)=>{encoder.on('error',reject);encoder.on('exit',code=>code===0?resolve():reject(new Error(`Preview encoder ${code}`)));});
console.log(JSON.stringify({directory:out,shots:shots.length,totalSeconds:shots.reduce((sum,s)=>sum+s.seconds,0),previewSeconds:flyover?shots.reduce((sum,s)=>sum+s.seconds,0):40,width:1280,height:720,fps:24},null,2));

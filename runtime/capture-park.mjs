import {readFile, writeFile, mkdir, rename, stat} from 'node:fs/promises';
import path from 'node:path';

const project = process.cwd();
const root = path.join(project, 'video/capture');
const planFile = path.resolve(process.argv[2] ?? 'video/capture/preview-plan.json');
const shots = JSON.parse(await readFile(planFile, 'utf8'));
await mkdir(root, {recursive:true});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [];
for (const shot of shots) {
  const request = {action:'record', fps:24, warmup:12, ...shot};
  await writeFile(path.join(root, 'control-next.json'), JSON.stringify(request));
  await rename(path.join(root, 'control-next.json'), path.join(root, 'control.json'));
  const start = Date.now();
  let previous = '';
  while (Date.now() - start < 240000) {
    await delay(1500);
    let state;
    try {state = JSON.parse(await readFile(path.join(root, 'status.json'), 'utf8'));} catch {continue;}
    if (state.id !== shot.id) continue;
    const summary = `${state.state} frames=${state.frames} fps=${state.fps}`;
    if (summary !== previous) {console.log(`${shot.id}: ${summary}`); previous=summary;}
    if (state.state === 'error') throw new Error(JSON.stringify(state));
    if (state.state === 'done') {
      state.video = path.join(root, `${shot.id}.mp4`);
      state.bytes = (await stat(state.video)).size;
      results.push({...shot, result:state});
      await writeFile(path.join(root, `${shot.id}-report.json`), JSON.stringify(state,null,2));
      break;
    }
  }
  if (results.length === 0 || results.at(-1).id !== shot.id) throw new Error(`Timed out: ${shot.id}`);
}
const report = planFile.replace(/\.json$/,'-result.json');
await writeFile(report, JSON.stringify(results,null,2));
console.log(`Saved ${report}`);

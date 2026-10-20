import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const instance=process.argv[2];
if(!instance)throw new Error('Client instance is required');
const file=path.join(instance,'config/mtsconfig.json');
const config=JSON.parse(await readFile(file,'utf8'));
const server=JSON.parse(await readFile(new URL('./server/config/mtsconfig.json',import.meta.url),'utf8'));
// Preserve rendering settings; carry over only vehicle/world damage protection.
config.damage=server.damage;
await writeFile(file,JSON.stringify(config,null,2)+'\n');
console.log('Single-player vehicle damage protection installed.');

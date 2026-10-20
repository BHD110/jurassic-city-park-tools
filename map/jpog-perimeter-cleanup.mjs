import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const full=JSON.parse(await readFile(path.join(root,'map/generated/full.json'),'utf8'));
const importPlan=JSON.parse(await readFile(path.join(root,'map/generated/imported-jpog-visitor.json'),'utf8'));
const operations=importPlan.operations.slice(2,6);
if(operations.length!==4||operations.some(op=>op.block!=='minecraft:air'))throw Error('JPOG cleanup operations changed');
await writeFile(path.join(root,'map/generated/jpog-perimeter-cleanup.json'),JSON.stringify({name:'JPOG Visitor Old Trim Cleanup',bounds:full.bounds,operations,metadata:{sourcePlan:'imported-jpog-visitor',scope:'remaining old side trim and half-cleared forecourt trees'}}));
console.log(JSON.stringify({operations:operations.length}));

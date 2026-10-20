import net from 'node:net';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

export async function connect() {
  const props = Object.fromEntries((await readFile(new URL('./server/server.properties', import.meta.url),'utf8')).split(/\r?\n/).filter(l=>l && !l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
  const socket=net.createConnection({host:'127.0.0.1',port:Number(props['rcon.port'])});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);});
  let buffer=Buffer.alloc(0), queue=[], pending=[];
  socket.on('data',b=>{buffer=Buffer.concat([buffer,b]);while(buffer.length>=4 && buffer.length>=buffer.readInt32LE(0)+4){const n=buffer.readInt32LE(0);const packet=buffer.subarray(4,n+4);buffer=buffer.subarray(n+4); const msg={id:packet.readInt32LE(0),type:packet.readInt32LE(4),body:packet.subarray(8,-2).toString('utf8')}; if(pending.length)pending.shift()(msg);else queue.push(msg);}});
  const read=()=>queue.length?Promise.resolve(queue.shift()):new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('RCON response timeout')),20000);pending.push(m=>{clearTimeout(timer);resolve(m);});});
  let id=1;
  const send=async(type,body)=>{const thisId=id++;const data=Buffer.from(body,'utf8'),p=Buffer.alloc(data.length+14);p.writeInt32LE(data.length+10);p.writeInt32LE(thisId,4);p.writeInt32LE(type,8);data.copy(p,12);socket.write(p);const reply=await read();if(reply.id!==thisId)throw new Error('RCON response id mismatch');return reply.body;};
  await send(3,props['rcon.password']);
  return {command:c=>send(2,c), close:()=>socket.end()};
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const [arg,out]=process.argv.slice(2);
  const commands=arg?.endsWith('.json')?JSON.parse(await readFile(arg,'utf8')):[arg];
  const client=await connect();const replies=[];
  try {for(const command of commands)replies.push({command,reply:await client.command(command)});}finally{client.close();}
  if(out)await writeFile(out,JSON.stringify(replies,null,2));
  else console.log(JSON.stringify(replies,null,2));
}

import {env} from 'cloudflare:workers';
import {database} from './storage';
export function sameOrigin(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
export async function requireRecordPassword(req:Request):Promise<Response|null>{
 if(!sameOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403});
 const secret=(env as unknown as Record<string,string>).RECORD_PASSWORD;
 if(!secret)return Response.json({error:'Record password has not been configured.'},{status:503});
 const username=req.headers.get('x-record-username')||'';const expectedUsername=(env as unknown as Record<string,string>).RECORD_USERNAME;
 const password=req.headers.get('x-record-password')||'';
 if(!password||!username)return Response.json({error:'Enter your record username and password.'},{status:401});
 const ip=req.headers.get('cf-connecting-ip')||'site';const key='auth:'+ip+':'+Math.floor(Date.now()/600000);
 const attempt=await database().prepare('INSERT INTO workspace (id,payload,version,updated) VALUES (?, ?, 1, ?) ON CONFLICT(id) DO UPDATE SET version=version+1 RETURNING version').bind(key,'{}',new Date().toISOString()).first<{version:number}>();
 if(!attempt||attempt.version>15)return Response.json({error:'Too many password attempts. Try again in 10 minutes.'},{status:429});
 const hash=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
 const [a,b]=await Promise.all([hash(password),hash(secret)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 if(diff||username!==expectedUsername)return Response.json({error:'Incorrect username or password. No changes were made.'},{status:401});
 await database().prepare('DELETE FROM workspace WHERE id=?').bind(key).run();
 return null;
}

import {database} from '@/lib/storage';
import {validPoint} from '@/lib/calibration';
import {requireRecordPassword,sameOrigin} from '@/lib/record-auth';
export async function GET(){try{const row=await database().prepare('SELECT payload,version FROM workspace WHERE id=?').bind('main').first<{payload:string;version:number}>();return Response.json(row?{...JSON.parse(row.payload),version:row.version}:{version:0,rows:[],overrides:[],archive:[],replacements:{}},{headers:{'Cache-Control':'no-store'}});}catch(e){console.error(e);return Response.json({error:'Saved workspace is unavailable. Your changes have not been cleared.'},{status:503});}}
export async function POST(req:Request){try{
 const denied=await requireRecordPassword(req);if(denied)return denied;
 if(!sameOrigin(req))return Response.json({error:'Invalid request origin'},{status:403});
 const b:any=await req.json();if(!Number.isInteger(b.version)||b.version<0||!Array.isArray(b.rows)||b.rows.length>500||!b.rows.every((r:any)=>r&&typeof r.id==='string'&&['model','fn','range','condition','unit'].every(k=>typeof r[k]==='string')&&Number.isFinite(r.value)&&(r.frequency===null||Number.isFinite(r.frequency)))||!Array.isArray(b.overrides)||b.overrides.length>5000||!b.overrides.every(validPoint)||!Array.isArray(b.archive)||!b.archive.every(validPoint))return Response.json({error:'Invalid workspace data'},{status:400});
 const row=await database().prepare('SELECT payload,version FROM workspace WHERE id=?').bind('main').first<{payload:string;version:number}>();const old=row?JSON.parse(row.payload):{overrides:[],archive:[]};
 if((row?.version||0)!==b.version)return Response.json({error:'Another session saved changes. Reload the workspace before saving.'},{status:409});

 const payload=JSON.stringify({...old,rows:b.rows,overrides:b.overrides,archive:b.archive});if(payload.length>2000000)return Response.json({error:'Workspace is too large'},{status:413});
 const now=new Date().toISOString();const result=b.version===0?await database().prepare('INSERT OR IGNORE INTO workspace (id,payload,version,updated) VALUES (?,?,?,?)').bind('main',payload,1,now).run():await database().prepare('UPDATE workspace SET payload=?,version=version+1,updated=? WHERE id=? AND version=?').bind(payload,now,'main',b.version).run();if(!result.meta.changes)return Response.json({error:'Another session saved changes. Reload the workspace.'},{status:409});return Response.json({version:b.version+1});
 }catch(e){console.error(e);return Response.json({error:'Could not save. Your changes are still on this screen.'},{status:503});}}

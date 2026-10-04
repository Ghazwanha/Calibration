import {env} from 'cloudflare:workers';
import {database} from '@/lib/storage';
import {requireRecordPassword} from '@/lib/record-auth';
import {rotateCertificate,initialCertificates} from '@/lib/certificates';
export async function POST(req:Request){try{
 const denied=await requireRecordPassword(req);if(denied)return denied;
 const form=await req.formData();const file=form.get('file');const model=String(form.get('model'));const number=String(form.get('number')||'').trim();const date=String(form.get('date')||'');const version=Number(form.get('version'));
 if(!(file instanceof File)||file.size>20*1024*1024||file.size<5||!number||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(version))return Response.json({error:'Provide a PDF up to 20 MB, certificate number and date.'},{status:400});
 const bytes=await file.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')return Response.json({error:'The uploaded file is not a PDF.'},{status:400});
 let records;try{records=JSON.parse(String(form.get('records')));}catch{return Response.json({error:'Invalid records.'},{status:400});}
 if(!Array.isArray(records)||records.length>5000)return Response.json({error:'Invalid record count.'},{status:400});
 const row=await database().prepare('SELECT payload,version FROM workspace WHERE id=?').bind('main').first<{payload:string;version:number}>();if((row?.version||0)!==version)return Response.json({error:'The workspace changed. Reload before importing; your PDF is unchanged.'},{status:409});
 const current=row?JSON.parse(row.payload):{rows:[],overrides:[],archive:[],certificates:initialCertificates};
 const id='upload-'+crypto.randomUUID();let next;
 try{next=rotateCertificate(current,model,records,{id,model,era:'new',number,date,filename:file.name});}catch(e){return Response.json({error:(e as Error).message},{status:400});}
 const payload=JSON.stringify(next);if(payload.length>2000000)return Response.json({error:'The extracted data is too large.'},{status:413});
 if(!env.BUCKET)return Response.json({error:'Certificate storage is unavailable. No records changed.'},{status:503});
 await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:'application/pdf'}});
 const now=new Date().toISOString();const result=version===0?await database().prepare('INSERT OR IGNORE INTO workspace (id,payload,version,updated) VALUES (?,?,?,?)').bind('main',payload,1,now).run():await database().prepare('UPDATE workspace SET payload=?,version=version+1,updated=? WHERE id=? AND version=?').bind(payload,now,'main',version).run();
 if(!result.meta.changes){await env.BUCKET.delete(id);return Response.json({error:'Another session saved changes. Reload before importing.'},{status:409});}
 const expired=(current.certificates||initialCertificates).filter((c:any)=>c.model===model&&c.era==='old'&&c.id.startsWith('upload-'));for(const c of expired){try{await env.BUCKET.delete(c.id);}catch(e){console.error('Expired certificate cleanup failed',e);}}
 return Response.json({version:version+1});
 }catch(e){console.error(e);return Response.json({error:'Import failed. Reload to check the current certificate before trying again.'},{status:503});}}

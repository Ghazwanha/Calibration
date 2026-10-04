import {requireRecordPassword} from '@/lib/record-auth';
export async function POST(req:Request){try{const denied=await requireRecordPassword(req);return denied||Response.json({authenticated:true},{headers:{'Cache-Control':'no-store'}});}catch(e){console.error(e);return Response.json({error:'Sign-in is unavailable. Please try again.'},{status:503});}}

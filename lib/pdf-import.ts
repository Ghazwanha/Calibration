import {units,allowedSource,type Point} from './calibration';
export type Candidate=Point&{sourceText:string;checked:boolean};
export type Extraction={records:Candidate[];warnings:string[];pages:number};
export type ParseContext={fn:string;range:string;condition:string};
const canonical=(s:string)=>s.replace(/[μµ]/g,'µ').replace(/\bu(?=[AVFΩ])/g,'µ').replace(/Ohms?/gi,'Ω').replace(/\b([mkMG]?)ohms?\b/gi,'$1Ω').replace(/\bmv\b/g,'mV');
const quantity=/([-+−]?\d+(?:[.,]\d+)?(?:\s*[eE]\s*[-+]?\d+)?)\s*(µV\/V|uV\/V|µA\/A|uA\/A|µΩ\/Ω|uΩ\/Ω|ppm|MHz|kHz|Hz|GΩ|MΩ|kΩ|mΩ|Ω|mV|µV|V|mA|µA|nA|A|mF|µF|nF|pF|F)(?![A-Za-z])/g;
export function parseCertificateLines(lines:string[],model:string,page:number,ctx:ParseContext):{records:Candidate[];warnings:string[]}{
 const records:Candidate[]=[],warnings:string[]=[];
 for(const raw of lines){const line=canonical(raw.trim()),lower=line.toLowerCase();
  if(/accuracy test|verification|distortion.*test|power.*test|thermocouple.*test|rtd.*test/i.test(line)&&!/^[-+\d]/.test(line)){
   ctx.fn='';ctx.range='';ctx.condition='';
   if(/dc voltage/.test(lower)&&!/offset/.test(lower)){ctx.fn='DC voltage';ctx.condition=model==='5522A'?(/aux/.test(lower)?'Aux':'Normal'):'';}
   else if(/ac voltage/.test(lower)&&!/(offset|square|triangle|truncated)/.test(lower)){ctx.fn='AC voltage';ctx.condition=model==='5522A'?(/aux/.test(lower)?'Aux':'Normal'):'';}
   else if(/dc current/.test(lower))ctx.fn='DC current';
   else if(/ac current/.test(lower))ctx.fn='AC current';
   else if(/capacitance/.test(lower))ctx.fn='Capacitance';
   else if(/resistance accuracy/.test(lower))ctx.fn='Resistance';
   else if(/ohms|Ω/.test(line)&&model==='8508A')ctx.fn=(/voltage/.test(lower)?'High voltage ohms':/true/.test(lower)?'True ohms':'Normal ohms')+(/loi|lol/.test(lower)?' · LoI':'');
   else if(/frequency accuracy/.test(lower)){ctx.fn='Frequency';ctx.range='Frequency';}
   if(ctx.fn&&!allowedSource({model,...ctx})){ctx.fn='';ctx.range='';}
   if(!ctx.fn)warnings.push(`Page ${page}: section not imported: ${raw}`);
   continue;
  }
  if(/range/i.test(line)){const m=line.match(/([\d.]+)\s*([µmkMGn]?)([VAΩF])\s*Range/i);ctx.range=m?`${m[1]} ${m[2]}${m[3]}`:'';if(/\(4w\)/i.test(line))ctx.condition='4W';if(/\(2w\)/i.test(line))ctx.condition='2W';continue;}
  if(!ctx.fn||!ctx.range||!/^[-+−]?\d/.test(line))continue;
  const matches=Array.from(line.matchAll(quantity)).map(m=>({value:Number(m[1].replace(/\s/g,'').replace(',','.').replace('−','-')),unit:m[2]}));
  if(matches.length<4){if(matches.length)warnings.push(`Page ${page}: could not read a complete row: ${raw}`);continue;}
  const nominal=matches.shift()!;let frequency:number|null=null;
  if(ctx.fn.startsWith('AC')||ctx.fn==='Capacitance'){
   const f=matches[0];if(f&&f.unit.endsWith('Hz')){frequency=f.value*units[f.unit];matches.shift();}else{warnings.push(`Page ${page}: frequency missing: ${raw}`);continue;}
  }
  const [ref,measured,u]=matches;if(!ref||!measured||!u||!units[nominal.unit]||!units[ref.unit]||!units[measured.unit]){warnings.push(`Page ${page}: units unreadable: ${raw}`);continue;}
  const uncertainty=u.unit.includes('/')||u.unit==='ppm'?u.value*Math.abs(ref.value*units[ref.unit])*1e-6:units[u.unit]?u.value*units[u.unit]:null;
  if(uncertainty===null||uncertainty<0){warnings.push(`Page ${page}: uncertainty unreadable: ${raw}`);continue;}
  records.push({id:crypto.randomUUID(),model,era:'new',fn:ctx.fn,range:ctx.range,condition:ctx.condition,frequency,nominal:nominal.value*units[nominal.unit],reference:ref.value*units[ref.unit],measured:measured.value*units[measured.unit],uncertainty,unit:nominal.unit,k:2,page,certificate:'draft',sourceText:raw,checked:false});
 }
 return {records,warnings};
}
export async function extractCertificate(file:File,model:string,progress:(s:string)=>void,signal:AbortSignal):Promise<Extraction>{
 const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/import/pdf.worker.min.mjs';
 const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:'/import/cmaps/',cMapPacked:true,standardFontDataUrl:'/import/standard_fonts/'}).promise;
 let worker:import('tesseract.js').Worker|undefined;
 const result:Extraction={records:[],warnings:[],pages:pdf.numPages};const ctx={fn:'',range:'',condition:''};
 try{
  if(pdf.numPages>80)throw Error('Please upload no more than 80 pages.');
  for(let i=1;i<=pdf.numPages;i++){
   if(signal.aborted)throw Error('Import cancelled.');progress(`Reading page ${i} of ${pdf.numPages}…`);
   const page=await pdf.getPage(i);const content=await page.getTextContent();let lines:string[]=[];
   const items=content.items.filter((v:any)=>typeof v.str==='string') as any[];
   if(items.map(v=>v.str).join('').length>100){
    const groups:{y:number;items:any[]}[]=[];for(const item of items){const y=item.transform[5];let g=groups.find(g=>Math.abs(g.y-y)<3);if(!g){g={y,items:[]};groups.push(g);}g.items.push(item);}
    lines=groups.sort((a,b)=>b.y-a.y).map(g=>g.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(v=>v.str).join(' '));
   }else{
    progress(`Reading scanned page ${i} of ${pdf.numPages}…`);
    if(!worker){const {createWorker}=await import('tesseract.js');worker=await createWorker('eng',1,{workerPath:'/import/worker.min.js',corePath:'/import/',langPath:'/import/',gzip:true,cacheMethod:'none'});}
    const viewport=page.getViewport({scale:2.5});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
    await page.render({canvas,canvasContext:canvas.getContext('2d')!,viewport}).promise;
    const recognized=await worker.recognize(canvas,{}, {text:true});lines=recognized.data.text.split('\n');canvas.width=canvas.height=0;
   }
   const parsed=parseCertificateLines(lines,model,i,ctx);result.records.push(...parsed.records);result.warnings.push(...parsed.warnings);page.cleanup();
  }
  if(!result.records.length)throw Error('No supported electrical tables were recognized. Check the PDF layout or use a clearer scan. No certificate was changed.');
  return result;
 }finally{await worker?.terminate();await pdf.destroy();}
}

import seed from '@/data/points.json';
import {type Point,validPoint,allowedSource} from './calibration';
export type Certificate={id:string;model:string;era:string;number:string;date:string;filename?:string};
export const initialCertificates:Certificate[]=[{id:'5522-new',model:'5522A',era:'new',number:'EVL1056908',date:'2025-05-29'},{id:'5522-old',model:'5522A',era:'old',number:'EVL918262',date:'2023-10-04'},{id:'8508a-new',model:'8508A',era:'new',number:'EVL1035363',date:'2025-03-01'},{id:'8508a-old',model:'8508A',era:'old',number:'EVL769023',date:'2022-01-24'}];
export function activePoints(overrides:Point[]=[],replacements:Record<string,Point[]>={}){const map=new Map((seed as Point[]).filter(p=>!replacements[p.model]).map(p=>[p.id,p]));Object.values(replacements).flat().forEach(p=>map.set(p.id,p));overrides.forEach(p=>map.set(p.id,p));return [...map.values()].filter(allowedSource);}
export const certificateUrl=(id:string)=>id.startsWith('upload-')?'/api/certificates/'+id:'/certificates/'+id+'.pdf';
export function rotateCertificate(current:any,model:string,records:Point[],certificate:Certificate){
 if(!['5522A','8508A'].includes(model)||!records.length||records.some(p=>!validPoint(p)||!allowedSource(p)||p.model!==model||p.review||p.uncertainty===null))throw Error('Check every imported record before approval.');
 const keys=records.map(p=>JSON.stringify([p.fn,p.range,p.condition,p.frequency,p.nominal]));if(new Set(keys).size!==keys.length)throw Error('Duplicate test points: resolve them before approval.');
 const previous=activePoints(current.overrides,current.replacements).filter(p=>p.model===model&&p.era==='new').map(p=>({...p,era:'old'}));
 const certificates=(current.certificates||initialCertificates) as Certificate[];
 return {...current,overrides:(current.overrides||[]).filter((p:Point)=>p.model!==model),archive:(current.archive||[]).filter((p:Point)=>p.model!==model),replacements:{...current.replacements,[model]:[...previous,...records.map((p,i)=>({...p,id:certificate.id+'-'+i,era:'new',certificate:certificate.id}))]},certificates:[...certificates.filter(c=>c.model!==model),...certificates.filter(c=>c.model===model&&c.era==='new').map(c=>({...c,era:'old'})),certificate]};
}

export type Point={id:string;model:string;era:string;fn:string;range:string;condition:string;frequency:number|null;nominal:number;reference:number;measured:number;uncertainty:number|null;unit:string;k:number;page:number;certificate:string;review?:string};
export type RequestPoint={model:string;fn:string;range:string;condition:string;frequency:number|null;value:number;unit:string};
export const units:Record<string,number>={V:1,mV:1e-3,'µV':1e-6,A:1,mA:1e-3,'µA':1e-6,nA:1e-9,'Ω':1,'kΩ':1e3,'MΩ':1e6,'GΩ':1e9,'mΩ':1e-3,F:1,'µF':1e-6,nF:1e-9,pF:1e-12,mF:1e-3,Hz:1,kHz:1e3,MHz:1e6};
export const allowedSource=(p:{model:string;fn:string;condition:string})=>p.model==='8508A'?(!/ohms|resistance/i.test(p.fn)||p.fn==='Normal ohms'):p.model!=='5522A'||(!/voltage|harmonic/i.test(p.fn)||(['DC voltage','AC voltage'].includes(p.fn)&&p.condition==='Normal'));
export const dimension=(u:string)=>u.endsWith('V')?'V':u.endsWith('A')?'A':u.endsWith('Ω')?'Ω':u.endsWith('F')?'F':'Hz';
export const close=(a:number,b:number)=>Math.abs(a-b)<=Math.max(Math.abs(a),Math.abs(b),1e-30)*1e-10;
export const error=(p:Point)=>{const reference=p.reference;const magnitude=Math.max(Math.abs(p.measured),Math.abs(reference));if(!magnitude)return 0;const scale=10**(14-Math.floor(Math.log10(magnitude)));return (p.model==='5522A'?-1:1)*(Math.round(p.measured*scale)-Math.round(reference*scale))/scale;};
export function linear(x:number,x1:number,y1:number,x2:number,y2:number){if(x1===x2)throw Error('Duplicate points');return y1+(x-x1)*(y2-y1)/(x2-x1);}
export type Calculation={status:string;reason:string;error:number|null;uncertainty:number|null;k:number|null;used:Point[];uSource:Point|null};
export function calculate(points:Point[],q:RequestPoint,era:string):Calculation{
 const no=(reason:string)=>({status:'unavailable',reason,error:null as number|null,uncertainty:null as number|null,k:null as number|null,used:[] as Point[],uSource:null as Point|null});
 if(!allowedSource(q))return no('This function is not enabled for this reference.');
 if(!Number.isFinite(q.value)||!units[q.unit])return no('Enter a finite value and a valid unit.');
 if(q.condition==='auto'){
  const conditions=[...new Set(points.filter(p=>p.model===q.model&&p.era===era&&p.fn===q.fn&&p.frequency===q.frequency).map(p=>p.condition))];
  const candidates=conditions.map(condition=>calculate(points,{...q,condition},era)).filter(r=>r.status!=='unavailable');
  if(candidates.length===1)return {...candidates[0],reason:candidates[0].reason+' · Connection: '+candidates[0].used[0].condition};
  return no(candidates.length?'More than one connection method covers this point. Review the certificate records.':'No certificate connection covers this point.');
 }
 if(q.range==='auto'){
  const ranges=[...new Set(points.filter(p=>p.model===q.model&&p.era===era&&p.fn===q.fn&&p.condition===q.condition&&p.frequency===q.frequency&&dimension(p.unit)===dimension(q.unit)).map(p=>p.range))];
  const results=ranges.map(range=>({range,result:calculate(points,{...q,range},era)})).filter(v=>v.result.status==='exact');
  const capacity=(range:string)=>{const m=range.match(/^([\d.]+)\s*(\S+)/);return m&&units[m[2]]?Number(m[1])*units[m[2]]:Infinity;};
  results.sort((a,b)=>capacity(a.range)-capacity(b.range)||a.range.localeCompare(b.range));
  if(!results.length)return calculate(points,{...q,range:'__cross_range__'},era);
  const best=results[0];
  return {...best.result,reason:best.result.reason+' · Automatic range: '+best.range};
 }
 const x=q.value*units[q.unit];
 const series=points.filter(p=>p.model===q.model&&p.era===era&&p.fn===q.fn&&(q.range==='__cross_range__'||p.range===q.range)&&p.condition===q.condition&&p.frequency===q.frequency&&dimension(p.unit)===dimension(q.unit)).sort((a,b)=>a.nominal-b.nominal);
 if(!series.length)return no('No certificate data for this range and frequency.');
 const exact=series.filter(p=>close(p.nominal,x));
 if(exact.length>1)return no('Multiple certificate points match. Check the source records.');
 if(exact.length){const p=exact[0];if(p.review)return no(p.review);return {status:'exact',reason:'Exact certificate point',error:error(p)/units[q.unit],uncertainty:p.uncertainty===null?null:p.uncertainty/units[q.unit],k:p.k,used:[p],uSource:p};}
 const capacity=(p:Point)=>{const m=p.range.match(/^([\d.]+)\s*(\S+)/);return m&&units[m[2]]?Number(m[1])*units[m[2]]:Infinity;};
 const uniqueSeries=q.range==='__cross_range__'?[...new Map([...series].sort((a,b)=>b.nominal-a.nominal||capacity(b)-capacity(a)).map(p=>[p.nominal,p])).values()].sort((a,b)=>a.nominal-b.nominal):series;
 const low=uniqueSeries.filter(p=>p.nominal<x).at(-1),high=uniqueSeries.find(p=>p.nominal>x);
 if(!low||!high)return no('Outside the measured interval. Extrapolation is disabled.');
 if(low.review||high.review)return no('A bracketing record needs source review.');
 if(low.nominal<0&&high.nominal>0)return no('Interpolation across zero is disabled.');
 const uSource = high.uncertainty !== null ? high : null;;
 return {status:'interpolated',reason:low.range===high.range?'Linear interpolation within the same range and frequency':'Cross-range linear interpolation (user-selected method): '+low.range+' → '+high.range+'; same function, frequency and connection',error:linear(x,low.nominal,error(low),high.nominal,error(high))/units[q.unit],uncertainty:uSource?uSource.uncertainty!/units[q.unit]:null,k:uSource?.k??null,used:[low,high],uSource};
}
export const fmt=(n:number|null,d=8)=>n===null?'—':n!==0&&Math.abs(n)<10**(-d)?n.toExponential(5):n.toFixed(d).replace(/(\.\d*?[1-9])0+$|\.0+$/,'$1');
export function validPoint(p:any){return p&&['id','model','era','fn','range','condition','unit','certificate'].every(k=>typeof p[k]==='string')&&['nominal','reference','measured','k','page'].every(k=>Number.isFinite(p[k]))&&p.k>0&&p.page>=1&&units[p.unit]!==undefined&&(p.frequency===null||Number.isFinite(p.frequency)&&p.frequency>=0)&&(p.uncertainty===null||Number.isFinite(p.uncertainty)&&p.uncertainty>=0);}

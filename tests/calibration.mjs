import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate,linear,error,validPoint} from '../lib/calibration.ts';
const points=JSON.parse(readFileSync(new URL('../data/points.json',import.meta.url)));
assert.equal(points.length,1200);assert.ok(points.every(validPoint));
const q={model:'5522A',fn:'DC voltage',range:'33 V',condition:'Normal',frequency:null,value:10,unit:'V'};
assert.equal(calculate(points,q,'old').error,.000014);assert.equal(calculate(points,q,'new').error,-.00002);
assert.ok(Math.abs(linear(10,3.3,-.00020,30,-.00016)-(-.0001899625468164794))<1e-15);
const sample=(x,e,u)=>({id:String(x),model:'5522A',era:'new',fn:'DC voltage',range:'33 V',condition:'Normal',frequency:null,nominal:x,reference:x,measured:x+e,uncertainty:u,unit:'V',k:2,page:1,certificate:'5522-new'});
const s=[sample(3.3,-.0002,.00008),sample(30,-.00016,.00002)];
const r=calculate(s,q,'new');assert.equal(r.status,'interpolated');assert.ok(Math.abs(r.error-(-.0001899625468164794))<1e-13);assert.equal(r.uncertainty,.00008);assert.equal(r.uSource.nominal,3.3);
assert.equal(calculate(s,{...q,value:40},'new').status,'unavailable');
assert.equal(calculate(s,{...q,frequency:50},'new').status,'unavailable');
assert.equal(calculate([sample(-1,0,1),sample(1,0,1)],{...q,value:0},'new').status,'unavailable');
assert.equal(calculate(points,{...q,fn:'AC current',range:'330 µA',condition:'',frequency:50,value:50,unit:'µA'},'new').status,'unavailable');
const d=points.find(p=>p.id==='8508A_new-4-568');assert.ok(d);assert.ok(Math.abs(error(d)-(9.999919-9.9999336))<1e-13);assert.ok(Math.abs(d.uncertainty-9.9999336*2.5e-6)<1e-15);
assert.equal(calculate(points,{...q,unit:'mV',value:10000},'new').error,-.02);
const ids=new Set();for(const p of points){assert.ok(!ids.has(p.id));ids.add(p.id);assert.ok(Number.isFinite(p.nominal)&&Number.isFinite(p.reference)&&Number.isFinite(p.measured));}
console.log('PASS: certificate extraction invariants, exact old/new errors, interpolation example, conservative U, units, missing frequency, boundaries, polarity and 8508A relative uncertainty.');

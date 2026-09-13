const {test}=require('node:test');const assert=require('node:assert/strict');
const {createSiteLogService}=require('../outputs/site-log-service');
function fixture(){const db={projects:[{id:'p'}],boqItems:[{id:'b',projectId:'p',quantity:10,sellingRate:150,sourceExecutedQuantity:4}],audit:[]};let writes=0;const route=createSiteLogService({auth:()=>({id:'u'}),json:(res,status,body)=>Object.assign(res,{status,body}),readBody:async req=>req.body,getDb:()=>db,save:()=>writes++,audit:()=>db.audit.unshift({})});return{db,call:async(method,suffix,body)=>{const res={};await route({method,body},res,['api','site-logs','p',...suffix]);return res},writes:()=>writes}}
const expense={date:'2026-08-15',category:'Labor',description:'Labour payment',amount:100000,paymentMode:'Cash',remarks:'Receipt',requestId:'request-12345'};
test('retains imported progress and does not modify cost',async()=>{const f=fixture();const r=await f.call('GET',[]);assert.equal(r.body.boq[0].executedQuantity,4);await f.call('PATCH',['progress','b'],{executedQuantity:6,revision:0});assert.equal(f.db.projects[0].physicalProgress,.6);assert.equal(f.db.boqItems[0].actualCost,undefined)});
test('rejects excess quantities and stale updates',async()=>{const f=fixture();assert.equal((await f.call('PATCH',['progress','b'],{executedQuantity:11,revision:0})).status,422);await f.call('PATCH',['progress','b'],{executedQuantity:6,revision:0});assert.equal((await f.call('PATCH',['progress','b'],{executedQuantity:3,revision:0})).status,409);assert.equal(f.db.boqItems[0].executedQuantity,6)});
test('expense retries create only one payment',async()=>{const f=fixture();await f.call('POST',['expenses'],expense);await f.call('POST',['expenses'],expense);assert.equal(f.db.siteExpenses.length,1);assert.equal(f.db.siteExpenses[0].amount,100000)});
test('expense edit requires current revision',async()=>{const f=fixture();const r=await f.call('POST',['expenses'],expense),id=r.body.data.id;assert.equal((await f.call('PATCH',['expenses',id],{...expense,amount:500,revision:1})).status,200);assert.equal((await f.call('PATCH',['expenses',id],{...expense,revision:1})).status,409);assert.equal(f.db.siteExpenses[0].amount,500)});
test('rejects invalid calendar date and negative amount',async()=>{const f=fixture();assert.equal((await f.call('POST',['expenses'],{...expense,date:'2026-02-30'})).status,422);assert.equal((await f.call('POST',['expenses'],{...expense,amount:-10})).status,422);assert.equal(f.writes(),0)});

const manual={costCode:'M-01',description:'Concrete',quantity:5,unit:'m3',sellingRate:200,rate:100,requestId:'manual-request-001'};
test('manual BOQ entry persists once, recalculates progress and keeps agreed contract unchanged',async()=>{
 const f=fixture();f.db.projects[0].contractValue=5000;const result=await f.call('POST',['boq'],manual);
 assert.equal(result.status,201);assert.equal(result.body.data.budgetAmount,500);assert.equal(result.body.data.executedQuantity,0);
 assert.equal(f.db.projects[0].physicalProgress,600/2500);assert.equal(f.db.projects[0].contractValue,5000);
 assert.equal((await f.call('POST',['boq'],manual)).status,200);assert.equal(f.db.boqItems.length,2);
 assert.equal((await f.call('POST',['boq'],{...manual,requestId:'another-request-001'})).status,409);
});
test('invalid manual quantities and rates cannot create BOQ rows',async()=>{
 for(const bad of [{quantity:0},{quantity:-1},{sellingRate:-1},{sellingRate:''},{rate:Infinity},{description:' '},{unit:''}]){
  const f=fixture();assert.equal((await f.call('POST',['boq'],{...manual,...bad})).status,422);assert.equal(f.writes(),0);
 }
});
test('editing expenses retains old values and records editor and edit time',async()=>{
 const f=fixture(),created=await f.call('POST',['expenses'],expense),id=created.body.data.id;
 await f.call('PATCH',['expenses',id],{...expense,amount:1200,description:'Corrected labour',revision:1});
 assert.equal(f.db.siteExpenses.length,1);assert.equal(f.db.siteExpenses[0].updatedBy,'u');assert.ok(f.db.siteExpenses[0].updatedAt);
 assert.equal(f.db.audit[0].before.amount,100000);assert.equal(f.db.audit[0].after.amount,1200);
 assert.equal((await f.call('POST',['expenses'],{...expense,amount:0.001,requestId:'tiny-payment-001'})).status,422);
});

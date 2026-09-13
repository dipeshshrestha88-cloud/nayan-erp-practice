const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createProjectActions,nextProjectCode}=require('../outputs/project-actions');
function fixture(){
 const db={projects:[{id:'p',name:'Test project'},{id:'other',name:'Keep project'}],boqItems:[{id:'boq',projectId:'p'},{id:'keep',projectId:'other'}],siteExpenses:[{id:'exp',projectId:'p',amount:100}],purchaseOrders:[{id:'po',boqItemId:'boq'}],vendorBills:[{id:'bill',purchaseOrderId:'po'}],payments:[{id:'payment',vendorBillId:'bill'}],clientBills:[{id:'client',projectId:'p'}],clientReceipts:[{id:'receipt',clientBillId:'client'}],publicTenders:[{id:'tender',projectId:'p',revision:1}],vendors:[{id:'vendor'}],audit:[]};
 let writes=0,clock=0,saved,fail=false;const user={id:'admin',role:'admin'};
 const route=createProjectActions({auth:(req,res,roles)=>{if(!roles.includes(user.role)){res.status=403;return null;}return user},json:(res,status,body)=>Object.assign(res,{status,body}),readBody:async req=>req.body||{},getDb:()=>db,save:()=>{if(fail)throw Error('Disk failure');writes++;saved=structuredClone(db)},audit:(u,action,entity,id)=>db.audit.unshift({action,entity,id}),now:()=>clock});
 const call=async(method,suffix='',body={})=>{const res={};await route({method,body},res,['api','projects','p',...suffix?[suffix]:[]]);return res};
 const confirm=async()=>{const preview=await call('GET','delete-preview');return (await call('POST','delete-confirmation',{firstConfirmation:true,fingerprint:preview.body.fingerprint})).body.confirmationToken};
 return {db,user,call,confirm,writes:()=>writes,saved:()=>saved,advance:()=>clock+=300001,failSave:()=>fail=true};
}
test('both confirmations required; previews and cancellation never save',async()=>{
 const f=fixture();assert.equal((await f.call('DELETE','',{confirmedName:'Test project'})).status,409);
 assert.equal((await f.call('POST','delete-confirmation',{firstConfirmation:false})).status,409);
 const token=await f.confirm();assert.equal(f.writes(),0);
 assert.equal((await f.call('DELETE','',{confirmationToken:token,confirmedName:'Wrong name'})).status,422);
 assert.equal(f.db.projects.length,2);assert.equal(f.writes(),0);
});
test('deletion archives dependent records and preserves unrelated registers and history',async()=>{
 const f=fixture(),confirmationToken=await f.confirm();const result=await f.call('DELETE','',{confirmationToken,confirmedName:'Test project'});
 assert.equal(result.status,200);assert.equal(f.writes(),1);assert.deepEqual(f.db.projects.map(p=>p.id),['other']);assert.deepEqual(f.db.boqItems.map(i=>i.id),['keep']);
 for(const key of ['siteExpenses','purchaseOrders','vendorBills','payments','clientBills','clientReceipts'])assert.equal(f.db[key].length,0);
 const archive=f.saved().deletedProjects[0];assert.equal(archive.project.id,'p');assert.equal(archive.records.payments[0].id,'payment');assert.equal(archive.records.clientReceipts[0].id,'receipt');assert.equal(archive.records.siteExpenses[0].amount,100);
 assert.equal(f.db.publicTenders[0].projectId,undefined);assert.equal(f.db.publicTenders[0].deletedProjectId,'p');assert.equal(f.db.vendors.length,1);assert.equal(f.db.audit[0].action,'DELETE');
 assert.equal((await f.call('DELETE','',{confirmationToken,confirmedName:'Test project'})).status,404);
});
test('confirmation cannot be reused by another user or after expiry or a record change',async()=>{
 for(const change of [f=>f.user.id='different-admin',f=>f.advance(),f=>f.db.siteExpenses[0].amount=200]){
  const f=fixture(),confirmationToken=await f.confirm();change(f);assert.equal((await f.call('DELETE','',{confirmationToken,confirmedName:'Test project'})).status,409);assert.equal(f.writes(),0);
 }
});
test('only admins may delete; failed persistence leaves project in memory',async()=>{
 const f=fixture();f.user.role='accountant';assert.equal((await f.call('GET','delete-preview')).status,403);f.user.role='admin';
 const confirmationToken=await f.confirm(),before=structuredClone(f.db);f.failSave();await assert.rejects(f.call('DELETE','',{confirmationToken,confirmedName:'Test project'}),/Disk failure/);assert.deepEqual(f.db,before);
});
test('new project codes do not reuse archived or active project codes',()=>{
 assert.equal(nextProjectCode({projects:[{code:'PRJ-001'}],deletedProjects:[{project:{code:'PRJ-008'}}]}),'PRJ-009');
 assert.equal(nextProjectCode({projects:[]}),'PRJ-001');
});

const crypto=require('node:crypto');
const schemas=require('./operations-schema');
const statuses=['Not awarded','Preparing','Submitted','Awarded','Not successful','Withdrawn'];
function clean(v,max=2000){return String(v??'').trim().slice(0,max)}
function date(v){if(!v)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Enter valid AD dates.');return v}
function amount(v){const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e12)throw Error('Amounts must be non-negative numbers.');return Math.round(n*100)/100}
function tenderInput(b){const title=clean(b.title),entity=clean(b.entity),ifb=clean(b.ifb,200);if(!title||!entity||!ifb)throw Error('Project title, public entity and IFB reference are required.');if(!statuses.includes(b.status))throw Error('Choose a valid bid status.');for(const key of ['prepared','guaranteeApplied','securityReleased'])if(typeof b[key]!=='boolean')throw Error('Checklist values must be Yes or No.');return {title,entity,ifb,deadline:date(b.deadline),prepared:b.prepared,guaranteeApplied:b.guaranteeApplied,status:b.status,securityAmount:amount(b.securityAmount),securityFee:amount(b.securityFee),securityReleased:b.securityReleased,notes:clean(b.notes),guaranteeReference:clean(b.guaranteeReference,200),sourceSheet:clean(b.sourceSheet,300)}}
const normal=s=>s.trim().replace(/\s+/g,'').toLowerCase();
function createOperationsService({auth,json,readBody,getDb,save,audit,getGuarantees}){
 return async(req,res,parts)=>{
  const admin=['admin','procurement-manager','project-manager','finance-manager'];
  const role=parts[1]==='tenders'?admin:[...admin,'site-engineer','accountant'];
  const user=auth(req,res,req.method==='GET'?undefined:role);if(!user)return;
  const db=getDb();db.publicTenders ||= [];db.operationRecords ||= [];
  try{
   if(parts[1]==='tenders'){
    const id=parts[2],action=parts[3];
    if(req.method==='GET'&&!id)return json(res,200,{data:db.publicTenders,projects:db.projects,guarantees:getGuarantees().map(g=>({reference:g.reference,contractNo:g.contractNo,amount:g.amount,released:g.released,expiryDate:g.expiryDate}))});
    const b=await readBody(req);
    if(id==='import'&&req.method==='POST'){
     if(user.role!=='admin')return json(res,403,{error:'Only administrators may import records.'});
     if(!Array.isArray(b.rows)||b.rows.length>500)throw Error('Import must contain up to 500 rows.');
     const rows=b.rows.map(tenderInput),keys=new Set();for(const row of rows){const key=normal(row.ifb);if(keys.has(key))throw Error('Duplicate IFB in import.');keys.add(key)}
     const added=[];for(const row of rows){if(db.publicTenders.some(t=>normal(t.ifb)===normal(row.ifb)))continue;const t={...row,id:crypto.randomUUID(),revision:1,createdAt:new Date().toISOString(),createdBy:user.id};db.publicTenders.push(t);added.push(t)}
     audit(user,'IMPORT','public-tenders',String(added.length));save(db);return json(res,201,{imported:added.length,skipped:rows.length-added.length});
    }
    if(!id&&req.method==='POST'){
     const data=tenderInput(b);if(db.publicTenders.some(t=>normal(t.ifb)===normal(data.ifb)))return json(res,409,{error:'This IFB already exists in the tracker.'});
     const t={...data,id:crypto.randomUUID(),revision:1,createdAt:new Date().toISOString(),createdBy:user.id};db.publicTenders.unshift(t);audit(user,'CREATE','public-tender',t.id);save(db);return json(res,201,{data:t});
    }
    const t=db.publicTenders.find(t=>t.id===id);if(!t)return json(res,404,{error:'Tender not found'});
    if(action==='project'&&req.method==='POST'){
     if(t.projectId)return json(res,200,{data:db.projects.find(p=>p.id===t.projectId)});
     if(t.status!=='Awarded')return json(res,409,{error:'Mark the tender as awarded before creating its project.'});
     let p;if(b.projectId){p=db.projects.find(p=>p.id===b.projectId);if(!p)throw Error('Choose an existing project.')}else{
      const value=amount(b.contractValue);if(!value)throw Error('Enter the actual awarded contract amount.');
      if(db.projects.some(p=>normal(p.contractId||'')===normal(t.ifb)))return json(res,409,{error:'A project already uses this IFB. Link the existing project.'});
      p={id:'prj-'+crypto.randomUUID(),code:require('./project-actions').nextProjectCode(db),name:t.title,client:t.entity,contractId:t.ifb,contractValue:value,budget:0,actualCost:0,committedCost:0,forecastMargin:0,status:'Setup',createdAt:new Date().toISOString(),tenderId:t.id};db.projects.push(p);
     }
     t.projectId=p.id;t.revision++;audit(user,'LINK_PROJECT','public-tender',t.id);save(db);return json(res,201,{data:p});
    }
    if(req.method==='PATCH'&&!action){if(t.revision!==b.revision)return json(res,409,{error:'This tender changed. Reload before saving.'});const data=tenderInput(b);if(t.projectId&&data.status!=='Awarded')throw Error('Linked projects must retain their awarded tender status.');if(db.publicTenders.some(x=>x.id!==t.id&&normal(x.ifb)===normal(data.ifb)))throw Error('IFB reference already exists.');if(data.guaranteeReference&&!getGuarantees().some(g=>g.reference===data.guaranteeReference))throw Error('Choose an existing bank guarantee.');const before={...t};Object.assign(t,data,{revision:t.revision+1});audit(user,'UPDATE','public-tender',t.id);db.audit[0].before=before;save(db);return json(res,200,{data:t});}
   }
   if(parts[1]==='operations'){
    const kind=parts[2],id=parts[3],schema=schemas[kind];if(!schema)return json(res,404,{error:'Workspace not found'});
    if(req.method==='GET')return json(res,200,{data:db.operationRecords.filter(r=>r.kind===kind),projects:db.projects});
    if(!['POST','PATCH'].includes(req.method))return json(res,405,{error:'Unsupported action'});
    const b=await readBody(req);if(!db.projects.some(p=>p.id===b.projectId))throw Error('Choose a valid project.');
    const data={projectId:b.projectId};for(const [key,label,type,required,options]of schema.fields){const value=b[key];if(required&&(value===undefined||value===null||value===''))throw Error(label+' is required.');data[key]=type==='number'?amount(value):type==='date'?date(value):clean(value);if(type==='select'&&!options.includes(value))throw Error('Choose a valid '+label.toLowerCase()+'.');}
    if(['inventory','labour'].includes(kind)&&data.quantity<=0)throw Error('Quantity must be positive.');if(kind==='equipment'&&data.hours>24)throw Error('Operating hours cannot exceed 24 per day.');
    if(kind==='quality'&&data.status==='Closed'&&!data.notes)throw Error('Describe the action taken before closing the observation.');
    const existing=id?db.operationRecords.find(r=>r.id===id&&r.kind===kind):null;if(req.method==='PATCH'&&!existing)return json(res,404,{error:'Record not found'});
    if(existing&&existing.revision!==b.revision)return json(res,409,{error:'Another employee updated this record. Reload and try again.'});
    if(req.method==='POST'){if(!/^[\w-]{8,100}$/.test(b.requestId||''))throw Error('Request ID required.');const duplicate=db.operationRecords.find(r=>r.kind===kind&&r.requestId===b.requestId);if(duplicate)return json(res,200,{data:duplicate});}
    const proposed={...existing,...data,id:existing?.id||crypto.randomUUID(),kind,revision:(existing?.revision||0)+1,requestId:existing?.requestId||b.requestId,createdAt:existing?.createdAt||new Date().toISOString(),createdBy:existing?.createdBy||user.id};
    if(kind==='inventory'){
     const balances=new Map();for(const r of [...db.operationRecords.filter(r=>r.kind===kind&&r.id!==id),proposed]){const key=[r.projectId,normal(r.store),normal(r.item),normal(r.unit)].join('|');balances.set(key,(balances.get(key)||0)+(r.movement==='Received'?1:-1)*r.quantity)}
     if([...balances.values()].some(n=>n< -0.000001))throw Error('This movement would issue more stock than is available in that project store.');
    }
    if(kind==='people'&&db.operationRecords.some(r=>r.kind===kind&&r.id!==id&&r.projectId===data.projectId&&normal(r.employee)===normal(data.employee)&&r.date===data.date))throw Error('Attendance already exists for this employee on this date.');
    if(existing)Object.assign(existing,proposed);else db.operationRecords.push(proposed);audit(user,existing?'UPDATE':'CREATE',kind,proposed.id);save(db);return json(res,existing?200:201,{data:proposed});
   }
   return json(res,405,{error:'Unsupported action'});
  }catch(e){return json(res,422,{error:e.message})}
 };
}
module.exports={createOperationsService,tenderInput};

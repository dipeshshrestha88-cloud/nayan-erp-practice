const crypto = require('node:crypto');

// Move a project and its dependent records out of active registers in one save.
// Guarantees, company documents, vendors and audit history are independent records.
const collections = ['boqItems','siteExpenses','operationRecords','requisitions','purchaseOrders','goodsReceipts','vendorBills','payments','inventory','invoices','clientBills','clientReceipts'];
const referenceKeys = ['projectId','boqItemId','requisitionId','purchaseOrderId','goodsReceiptId','vendorBillId','clientBillId'];
function nextProjectCode(db) {
  const projects=[...db.projects,...(db.deletedProjects||[]).map(entry=>entry.project)];
  return 'PRJ-'+String(projects.reduce((max,p)=>Math.max(max,Number(String(p.code||'').match(/^PRJ-(\d+)$/)?.[1])||0),0)+1).padStart(3,'0');
}
function deletionSnapshot(db, project) {
  const ids = new Set([project.id]);
  const records = Object.fromEntries(collections.map(key => [key, []]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of collections) for (const row of db[key] || []) {
      if (records[key].includes(row)) continue;
      if (referenceKeys.some(field => ids.has(row[field])) || (row.lines || []).some(line => referenceKeys.some(field => ids.has(line[field])))) {
        records[key].push(row); if(row.id)ids.add(row.id); changed = true;
      }
    }
  }
  const tenders = (db.publicTenders || []).filter(t => t.projectId === project.id);
  const snapshot = {project, records, tenders};
  return {...snapshot, fingerprint: crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')};
}
function createProjectActions({auth, json, readBody, getDb, save, audit, now = Date.now}) {
  const confirmations = new Map();
  return async (req,res,parts) => {
    const user = auth(req,res,['admin']); if(!user)return;
    const body = req.method==='GET'?{}:await readBody(req);
    const db = getDb(), project = db.projects.find(p => p.id === parts[2]);
    if(!project)return json(res,404,{error:'Project not found'});
    const snapshot = deletionSnapshot(db,project);
    const preview = {name:project.name,fingerprint:snapshot.fingerprint,counts:Object.fromEntries(collections.map(key => [key,snapshot.records[key].length]))};
    if(req.method==='GET' && parts[3]==='delete-preview')return json(res,200,preview);
    if(req.method==='POST' && parts[3]==='delete-confirmation') {
      if(body.firstConfirmation!==true || body.fingerprint!==snapshot.fingerprint)return json(res,409,{error:'The project changed. Review the deletion details again.'});
      for(const [key,value] of confirmations)if(value.expires <= now() || (value.userId===user.id && value.projectId===project.id))confirmations.delete(key);
      const confirmationToken = crypto.randomBytes(32).toString('hex');
      confirmations.set(confirmationToken,{userId:user.id,projectId:project.id,fingerprint:snapshot.fingerprint,expires:now()+5*60*1000});
      return json(res,200,{confirmationToken});
    }
    if(req.method!=='DELETE' || parts.length!==3)return json(res,405,{error:'Unsupported action'});
    const confirmation = confirmations.get(body.confirmationToken);
    if(!confirmation || confirmation.userId!==user.id || confirmation.projectId!==project.id || confirmation.expires<=now())return json(res,409,{error:'Complete the first confirmation again. It is valid for five minutes.'});
    if(body.confirmedName!==project.name)return json(res,422,{error:'Type the project name exactly to confirm deletion.'});
    if(confirmation.fingerprint!==snapshot.fingerprint)return json(res,409,{error:'The project changed after confirmation. Cancel and review the deletion again.'});
    const before = structuredClone(db);
    try {
      const archived = structuredClone({project:snapshot.project,records:snapshot.records,tenders:snapshot.tenders});
      (db.deletedProjects ||= []).push({...archived,deletedAt:new Date(now()).toISOString(),deletedBy:user.id});
      db.projects = db.projects.filter(p => p.id !== project.id);
      for(const key of collections)if(Array.isArray(db[key]))db[key]=db[key].filter(row=>!snapshot.records[key].includes(row));
      for(const tender of snapshot.tenders){delete tender.projectId;tender.deletedProjectId=project.id;tender.revision=(tender.revision||0)+1;}
      audit(user,'DELETE','project',project.id);
      save(db);
      confirmations.delete(body.confirmationToken);
      return json(res,200,{deleted:true,name:project.name,archived:true});
    } catch(error) {
      for(const key of Object.keys(db))delete db[key];Object.assign(db,before);
      throw error;
    }
  };
}
module.exports = {createProjectActions,deletionSnapshot,nextProjectCode};

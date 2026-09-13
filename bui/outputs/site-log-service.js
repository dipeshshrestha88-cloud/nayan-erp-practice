// Domain API with injected persistence; UI does not write to browser storage.
const crypto=require('node:crypto');
const categories=['Materials','Labor','Equipment/Fuel','Overheads'];
const modes=['Cash','Bank transfer','Cheque','Other'];
const money=n=>Math.round(n*100)/100;
function expenseInput(b){
 const amount=Number(b.amount);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')||!Number.isFinite(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date)throw Error('Enter a valid date (AD).');
 if(!categories.includes(b.category)||!modes.includes(b.paymentMode))throw Error('Choose a category and payment method.');
 if(!String(b.description||'').trim()||String(b.description).length>1000||!Number.isFinite(amount)||amount<0.01||amount>1e12)throw Error('Enter a description and an amount of at least Rs 0.01.');
 return {date:b.date,category:b.category,description:String(b.description).trim(),amount:money(amount),paymentMode:b.paymentMode,remarks:String(b.remarks||'').slice(0,1000)};
}
function createSiteLogService({auth,json,readBody,getDb,save,audit}){
 return async(req,res,parts)=>{
  const user=auth(req,res,req.method==='GET'?undefined:['admin','finance-manager','project-manager','site-engineer','accountant']);if(!user)return;
  const db=getDb(),project=db.projects.find(p=>p.id===parts[2]);if(!project)return json(res,404,{error:'Project not found'});
  db.siteExpenses ||= [];const resource=parts[3],id=parts[4];
  if(req.method==='GET'&&!resource){return json(res,200,{project,boq:db.boqItems.filter(i=>i.projectId===project.id).map(i=>({...i,executedQuantity:i.executedQuantity??i.sourceExecutedQuantity??0,revision:i.progressRevision||0})),expenses:db.siteExpenses.filter(e=>e.projectId===project.id),openingExpense:project.sourceSiteExpenditure||0});}
  try{
   const b=await readBody(req);
   if(resource==='boq'&&!id&&req.method==='POST'){
    const code=String(b.costCode||'').trim(),description=String(b.description||'').trim(),unit=String(b.unit||'').trim();
    const quantity=Number(b.quantity),rate=Number(b.rate??0),sellingRate=Number(b.sellingRate);
    if(!code||code.length>100||!description||description.length>2000||!unit||unit.length>50)throw Error('Enter an item number, description and unit.');
    if(!Number.isFinite(quantity)||quantity<=0||quantity>1e9||!Number.isFinite(rate)||rate<0||!Number.isFinite(sellingRate)||b.sellingRate===''||b.sellingRate==null||sellingRate<0||Math.max(quantity*rate,quantity*sellingRate)>1e12)throw Error('Enter a positive quantity and valid non-negative rates.');
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(b.requestId||''))throw Error('Request ID required.');
    const duplicate=db.boqItems.find(i=>i.projectId===project.id&&i.requestId===b.requestId);
    if(duplicate)return json(res,200,{data:duplicate});
    if(db.boqItems.some(i=>i.projectId===project.id&&String(i.costCode).trim().toLowerCase()===code.toLowerCase()))return json(res,409,{error:'This item number already exists in the project. Choose a different number.'});
    const item={id:'boq-'+crypto.randomUUID(),projectId:project.id,costCode:code,description,unit,quantity,rate,sellingRate,budgetAmount:money(quantity*rate),actualCost:0,committedCost:0,executedQuantity:0,progressRevision:0,status:'Approved baseline',requestId:b.requestId,createdAt:new Date().toISOString(),createdBy:user.id};
    db.boqItems.push(item);
    const boq=db.boqItems.filter(i=>i.projectId===project.id),total=boq.reduce((n,i)=>n+i.quantity*(i.sellingRate||0),0);
    project.budget=money(boq.reduce((n,i)=>n+(Number(i.budgetAmount)||0),0));
    project.physicalProgress=total?boq.reduce((n,i)=>n+(i.executedQuantity??i.sourceExecutedQuantity??0)*(i.sellingRate||0),0)/total:0;
    project.forecastMargin=project.contractValue&&project.budget?Number((((project.contractValue-project.budget)/project.contractValue)*100).toFixed(1)):0;
    audit(user,'CREATE','boq-item',item.id);save(db);return json(res,201,{data:item});
   }
   if(resource==='progress'&&req.method==='PATCH'){
    const item=db.boqItems.find(i=>i.id===id&&i.projectId===project.id);if(!item)return json(res,404,{error:'BOQ item not found'});
    const quantity=Number(b.executedQuantity);if(b.executedQuantity===''||!Number.isFinite(quantity)||quantity<0||quantity>item.quantity)return json(res,422,{error:'Completed quantity must be between zero and the BOQ quantity.'});
    if(b.revision!==(item.progressRevision||0))return json(res,409,{error:'Another employee updated this item. Reload the project and try again.'});
    const before=item.executedQuantity??item.sourceExecutedQuantity??0;item.executedQuantity=quantity;item.progressRevision=(item.progressRevision||0)+1;
    const boq=db.boqItems.filter(i=>i.projectId===project.id),total=boq.reduce((n,i)=>n+i.quantity*(i.sellingRate||0),0);project.physicalProgress=total?boq.reduce((n,i)=>n+(i.executedQuantity??i.sourceExecutedQuantity??0)*(i.sellingRate||0),0)/total:0;
    audit(user,'UPDATE_PROGRESS','boq-item',item.id);db.audit[0].before={executedQuantity:before};db.audit[0].after={executedQuantity:quantity};save(db);return json(res,200,{data:{...item,revision:item.progressRevision}});
   }
   if(resource==='expenses'&&['POST','PATCH'].includes(req.method)){
    const input=expenseInput(b);let expense;
    if(req.method==='POST'){
     if(!/^[a-zA-Z0-9_-]{8,100}$/.test(b.requestId||''))return json(res,422,{error:'Request ID required.'});
     expense=db.siteExpenses.find(e=>e.projectId===project.id&&e.requestId===b.requestId);if(expense)return json(res,200,{data:expense});
     expense={id:crypto.randomUUID(),projectId:project.id,...input,requestId:b.requestId,revision:1,createdBy:user.id,createdAt:new Date().toISOString()};db.siteExpenses.push(expense);
    }else{
     expense=db.siteExpenses.find(e=>e.id===id&&e.projectId===project.id);if(!expense)return json(res,404,{error:'Expense not found'});
     if(b.revision!==expense.revision)return json(res,409,{error:'This expense changed. Reload before editing.'});
     const before={...expense};Object.assign(expense,input,{revision:expense.revision+1,updatedAt:new Date().toISOString(),updatedBy:user.id});audit(user,'EDIT_EXPENSE','site-expense',expense.id);db.audit[0].before=before;db.audit[0].after={...expense};
    }
    if(req.method==='POST')audit(user,'CREATE','site-expense',expense.id);save(db);return json(res,req.method==='POST'?201:200,{data:expense});
   }
   return json(res,405,{error:'Unsupported action'});
  }catch(e){return json(res,422,{error:e.message})}
 };
}
module.exports={createSiteLogService,expenseInput};

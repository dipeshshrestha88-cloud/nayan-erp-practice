// Versioned document service. Storage and metadata repositories are injected.
const crypto = require('node:crypto');
const categories = [
 ['registration','Company registration','कम्पनी दर्ता'],
 ['license','Class D contractor licence','घ वर्गको इजाजतपत्र'],
 ['municipality','Municipal registration / renewal','पालिका दर्ता तथा नवीकरण'],
 ['pan','PAN / VAT certificate','स्थायी लेखा नम्बर'],
 ['tax-clearance','Tax clearance','कर चुक्ता प्रमाणपत्र']
];
module.exports = function({auth,json,repository,storage}) {
 return async function(req,res,parts) {
  const user=auth(req,res,req.method==='POST'?['admin','finance-manager']:undefined);if(!user)return;
  const category=parts[2];
  if(req.method==='GET'&&parts.length===2)return json(res,200,{data:categories.map(([id,name,nepali])=>({id,name,nepali,versions:repository.list(id)}))});
  if(!categories.some(c=>c[0]===category))return json(res,404,{error:'Document category not found'});
  if(req.method==='GET'&&parts.length===4){const version=repository.list(category).find(v=>v.id===parts[3]);if(!version)return json(res,404,{error:'Version not found'});const bytes=await storage.read(version.objectKey);res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+encodeURIComponent(version.fileName)+'"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);}
  if(req.method==='POST'&&parts.length===3){
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>10*1024*1024)return json(res,413,{error:'Maximum PDF size is 10 MB'});chunks.push(chunk);}
   const bytes=Buffer.concat(chunks);if(bytes.subarray(0,5).toString()!=='%PDF-')return json(res,422,{error:'Please upload a valid PDF file'});
   const checksum=crypto.createHash('sha256').update(bytes).digest('hex');
   const prior=repository.list(category).find(v=>v.checksum===checksum);if(prior)return json(res,200,{data:prior,duplicate:true});
   let fileName;try{fileName=decodeURIComponent(req.headers['x-file-name']||'document.pdf')}catch{return json(res,422,{error:'Invalid filename'})}
   fileName=fileName.replace(/[\\/\x00-\x1f]/g,'_').slice(0,200);if(!fileName.toLowerCase().endsWith('.pdf'))return json(res,422,{error:'PDF filename required'});
   const id=crypto.randomUUID(),objectKey='company-documents/'+category+'/'+id+'.pdf';
   await storage.put(objectKey,bytes);
   const version={id,objectKey,fileName,size:bytes.length,checksum,uploadedAt:new Date().toISOString(),uploadedBy:user.name};
   repository.append(category,version,user);return json(res,201,{data:version});
  }
  return json(res,405,{error:'Method not supported'});
 };
};
